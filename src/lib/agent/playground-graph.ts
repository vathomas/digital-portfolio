/**
 * Showcase 4 — Playground tool-use agent (ReAct pattern, real LLM planner).
 *
 *   Thought → Action (tool call) → Observation → … → Final Answer
 *
 * Each iteration emits a Step event so the UI can render the trace as it
 * unfolds. Real mode: Claude Haiku 4.5 plans each turn given the user query,
 * the tool registry, and the observation log so far. Mock mode (no
 * ANTHROPIC_API_KEY, or LLM returns unparseable output): falls back to a
 * regex heuristic so the demo still functions.
 *
 * Pass the incoming request Headers so get_user_location can read
 * Vercel's x-vercel-ip-city / country / timezone headers.
 */

import { generateText } from 'ai';
import { anthropic, CLAUDE_FAST } from './llm';
import { TOKEN_CAPS, WORD_BUDGETS, checkFinishReason } from './llm-caps';
import { makeToolRegistry, type ToolDefinition } from './playground-tools';

export type StepKind = 'thought' | 'action' | 'observation' | 'answer' | 'system' | 'error';

export interface Step {
  ts: number;
  kind: StepKind;
  /** For action: the tool name. For observation: the tool that returned it. */
  tool?: string;
  /** For action: the JSON args passed in. */
  args?: Record<string, string>;
  /** For observation: the JSON returned by the tool. */
  result?: unknown;
  /** Free-text body for thoughts/answers. */
  text?: string;
}

export interface PlaygroundResult {
  query: string;
  steps: Step[];
  finalAnswer: string;
  toolsUsed: string[];
  durationMs: number;
  /** LLM tokens consumed across all planner turns (0 if running in mock mode). */
  plannerTokens: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MAX_ITERATIONS = 6;
const QUERY_MAX = 500;
const OBSERVATION_PREVIEW_MAX = 800; // chars per observation when re-fed to the LLM

/* ─────────────── Real LLM planner ─────────────── */

interface PlannerStep {
  thought: string;
  action: string | null; // null when the planner wants to finalise
  args: Record<string, string>;
  answer: string | null;
}

/**
 * Build the catalog block describing every tool. Stays inside the system
 * prompt so the LLM sees the same description every turn (and the user's
 * query, which is the only untrusted text, stays in the user prompt).
 */
function toolCatalog(tools: Record<string, ToolDefinition>): string {
  return Object.values(tools)
    .map((t) => {
      const params = Object.keys(t.parameters).length === 0
        ? '(no args)'
        : Object.entries(t.parameters)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
      return `- ${t.name}(${params}): ${t.description}`;
    })
    .join('\n');
}

/** Strip markdown code fences and surrounding whitespace from an LLM JSON reply. */
function stripFences(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

/**
 * Coerce LLM output into our PlannerStep shape, refusing anything that
 * doesn't match. Tool-name validation happens here; unknown tools are
 * treated as "no action" so the loop can ask the LLM to try again or
 * finalise. Args are stringified — the playground tools all accept
 * Record<string, string>.
 */
function parsePlannerJson(
  raw: string,
  toolNames: Set<string>,
): PlannerStep | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  const thought = typeof obj.thought === 'string' ? obj.thought : '';

  // Final-answer branch
  if (typeof obj.answer === 'string') {
    return { thought, action: null, args: {}, answer: obj.answer };
  }

  // Tool-call branch
  if (typeof obj.action === 'string' && toolNames.has(obj.action)) {
    const argsIn = (obj.args && typeof obj.args === 'object')
      ? (obj.args as Record<string, unknown>)
      : {};
    const args: Record<string, string> = {};
    for (const [k, v] of Object.entries(argsIn)) {
      if (typeof v === 'string') args[k] = v;
      else if (typeof v === 'number' || typeof v === 'boolean') args[k] = String(v);
      // silently drop anything else (objects, arrays, null) — tools take
      // Record<string, string> and don't need to handle nested structures
    }
    return { thought, action: obj.action, args, answer: null };
  }

  return null;
}

/** Truncate a tool result for inclusion in the next planner prompt. */
function previewObservation(value: unknown): string {
  let s: string;
  try {
    s = JSON.stringify(value);
  } catch {
    s = String(value);
  }
  if (s.length > OBSERVATION_PREVIEW_MAX) {
    s = `${s.slice(0, OBSERVATION_PREVIEW_MAX)}…(truncated)`;
  }
  return s;
}

async function llmPlanNext(
  query: string,
  history: { tool: string; args: Record<string, string>; result: unknown }[],
  tools: Record<string, ToolDefinition>,
): Promise<{ step: PlannerStep | null; tokens: number }> {
  const toolNames = new Set(Object.keys(tools));

  const system =
    'You are a concise tool-using agent for a portfolio playground. ' +
    'Given the user query and the trace so far, decide the SINGLE next action. ' +
    'Available tools:\n' +
    toolCatalog(tools) + '\n\n' +
    'Respond with EXACTLY ONE valid JSON object on a single line, no markdown fences:\n' +
    '  - To call a tool: {"thought":"<one sentence>","action":"<tool_name>","args":{...}}\n' +
    '  - To finish:      {"thought":"<one sentence>","answer":"<final answer in markdown>"}\n' +
    'Rules: choose only from the listed tools; do not call the same tool twice with the same args; ' +
    'finalise as soon as you have enough information; keep "answer" under 400 characters; ' +
    `total response under ${WORD_BUDGETS.playgroundPlanner} words.`;

  const traceText = history.length === 0
    ? '(no observations yet)'
    : history
        .map((h, i) =>
          `[${i + 1}] action=${h.tool} args=${JSON.stringify(h.args)} → ${previewObservation(h.result)}`,
        )
        .join('\n');

  const prompt = `User query: "${query}"\n\nTrace so far:\n${traceText}\n\nReturn the JSON for the next step.`;

  const { text, usage, finishReason } = await generateText({
    model: anthropic(CLAUDE_FAST),
    system,
    prompt,
    // Financial guardrail — bounds worst-case cost per planner iteration.
    // Previously cast via `as Record<string, unknown>` under the wrong key
    // (`maxTokens`); AI SDK v6 uses `maxOutputTokens`. Now strongly typed
    // so SDK upgrades will surface field renames at build time.
    maxOutputTokens: TOKEN_CAPS.playgroundPlanner,
  });

  // Logged via checkFinishReason for observability; the caller surfaces
  // truncation to the user via a system step (see runPlayground).
  checkFinishReason(finishReason, 'playground.planner');

  return {
    step: parsePlannerJson(text, toolNames),
    tokens: usage?.totalTokens ?? 0,
  };
}

/* ─────────────── Regex fallback planner ─────────────── */

/**
 * Used when ANTHROPIC_API_KEY is unset (local dev / mock mode) or when the
 * LLM returns unparseable output for an iteration. Same heuristics as the
 * pre-real-mode implementation.
 */
function regexPlanNext(query: string, observed: Record<string, unknown>): PlannerStep {
  const q = query.toLowerCase();
  const wantsLocation = /where am i|my location|nearby|local|near me/.test(q) ||
                        /weather|time|here/.test(q);
  const wantsWeather = /weather|rain|sunny|hot|cold|mood|outside/.test(q);
  const wantsTime = /time|hour|now|currently/.test(q) && !wantsWeather;
  const wantsProject = /project|portfolio|recommend|showcase|build/.test(q);

  if ((wantsLocation || wantsWeather) && !observed.location) {
    return {
      thought: "I need the user's location before I can fetch local weather or recommend something based on context.",
      action: 'get_user_location',
      args: {},
      answer: null,
    };
  }
  if (wantsWeather && !observed.weather && observed.location) {
    const city = (observed.location as { city?: string }).city ?? 'London';
    return {
      thought: `Now that I know the user is in ${city}, I can fetch current weather to derive a mood.`,
      action: 'get_weather',
      args: { city },
      answer: null,
    };
  }
  if (wantsTime && !observed.time) {
    const tz = (observed.location as { timezone?: string })?.timezone;
    return {
      thought: "The user wants the current time — I'll call the time tool.",
      action: 'get_current_time',
      args: tz ? { timezone: tz } : {},
      answer: null,
    };
  }
  if (wantsProject && !observed.project) {
    const mood = (observed.weather as { mood_label?: string })?.mood_label ?? 'any';
    return {
      thought:
        mood !== 'any'
          ? `Weather suggests a "${mood}" mood — I'll search the portfolio for a matching project.`
          : "I'll search the portfolio without a mood filter and pick the best match.",
      action: 'search_portfolio_projects',
      args: { mood },
      answer: null,
    };
  }
  return {
    thought: 'I have enough information to answer the user.',
    action: null,
    args: {},
    answer: null,
  };
}

/* ─────────────── Final-answer synthesizer (fallback only) ─────────────── */

/**
 * Used when the regex planner finalises (no LLM available) OR when MAX_ITERATIONS
 * is exhausted without the LLM producing an `answer`. In real mode the LLM
 * normally produces the final answer itself.
 */
function synthesizeAnswer(query: string, observed: Record<string, unknown>): string {
  const loc = observed.location as { city?: string; timezone?: string } | undefined;
  const weather = observed.weather as { temp_c?: number; condition?: string; mood_label?: string; description?: string } | undefined;
  const time = observed.time as { local?: string } | undefined;
  const project = observed.project as { top_recommendation?: { title?: string; pitch?: string; slug?: string } } | undefined;

  const parts: string[] = [];

  if (loc) {
    parts.push(`You're in **${loc.city}** (${loc.timezone}).`);
  }
  if (weather) {
    parts.push(`Current weather: **${weather.temp_c}°C, ${weather.condition?.toLowerCase()}** — that gives a "${weather.mood_label}" mood. ${weather.description}`);
  }
  if (time) {
    parts.push(`Local time is **${time.local}**.`);
  }
  if (project?.top_recommendation) {
    const rec = project.top_recommendation;
    parts.push(`Given that mood, I'd recommend **${rec.title}** — ${rec.pitch} (see [/projects/${rec.slug}](/projects/${rec.slug})).`);
  }

  if (parts.length === 0) {
    return `I parsed your request — "${query}" — but couldn't map it to a tool I know. Try asking for the weather, the time, or a project recommendation based on mood.`;
  }

  return parts.join('\n\n');
}

/* ─────────────── Orchestrator ─────────────── */

export async function* runPlayground(
  query: string,
  headers?: Headers,
): AsyncGenerator<Step, PlaygroundResult> {
  const startedAt = Date.now();

  // Defence in depth: the API route already caps query length, but trim again
  // here so any future caller can't blow the planner context window.
  const cappedQuery = query.length > QUERY_MAX ? query.slice(0, QUERY_MAX) : query;

  const observed: Record<string, unknown> = {};
  const history: { tool: string; args: Record<string, string>; result: unknown }[] = [];
  const steps: Step[] = [];
  const toolsUsed: string[] = [];
  let plannerTokens = 0;

  const TOOLS = makeToolRegistry(headers);
  const useLlm = Boolean(process.env.ANTHROPIC_API_KEY);

  yield emit({
    kind: 'system',
    text: useLlm
      ? `🛠 Claude Haiku is planning tool calls for: "${cappedQuery}"`
      : `🛠 Mock planner (regex) for: "${cappedQuery}"`,
  });
  await sleep(180);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let plan: PlannerStep | null = null;

    if (useLlm) {
      try {
        const { step, tokens } = await llmPlanNext(cappedQuery, history, TOOLS);
        plannerTokens += tokens;
        plan = step;
      } catch (err) {
        console.error('[playground-graph] LLM planner failed, falling back to regex', {
          message: err instanceof Error ? err.message : String(err),
        });
      }
      if (!plan) {
        // LLM produced unparseable output or threw — fall through to regex
        // for THIS turn so the loop makes forward progress.
        plan = regexPlanNext(cappedQuery, observed);
      }
    } else {
      plan = regexPlanNext(cappedQuery, observed);
    }

    yield emit({ kind: 'thought', text: plan.thought });
    await sleep(220);

    // Final-answer branch: LLM produced an `answer`.
    if (plan.answer) {
      yield emit({ kind: 'answer', text: plan.answer });
      return done(plan.answer);
    }

    // No more tools needed, no answer either — synthesise from observations.
    if (!plan.action) break;

    // Action
    const tool = TOOLS[plan.action];
    if (!tool) {
      yield emit({ kind: 'error', text: `Unknown tool: ${plan.action}` });
      break;
    }

    yield emit({ kind: 'action', tool: plan.action, args: plan.args });
    let result: unknown;
    try {
      result = await tool.call(plan.args);
    } catch (err) {
      yield emit({ kind: 'error', text: `Tool ${plan.action} failed: ${err instanceof Error ? err.message : String(err)}` });
      break;
    }

    toolsUsed.push(plan.action);
    history.push({ tool: plan.action, args: plan.args, result });

    // Persist observation in our scratchpad (used by the regex fallback).
    if (plan.action === 'get_user_location') observed.location = result;
    else if (plan.action === 'get_weather') observed.weather = result;
    else if (plan.action === 'get_current_time') observed.time = result;
    else if (plan.action === 'search_portfolio_projects') observed.project = result;

    yield emit({ kind: 'observation', tool: plan.action, result });
    await sleep(180);
  }

  const finalAnswer = synthesizeAnswer(cappedQuery, observed);
  yield emit({ kind: 'answer', text: finalAnswer });
  return done(finalAnswer);

  function done(answer: string): PlaygroundResult {
    return {
      query: cappedQuery,
      steps,
      finalAnswer: answer,
      toolsUsed,
      durationMs: Date.now() - startedAt,
      plannerTokens,
    };
  }

  function emit(s: Omit<Step, 'ts'>): Step {
    const step: Step = { ts: Date.now(), ...s };
    steps.push(step);
    return step;
  }
}
