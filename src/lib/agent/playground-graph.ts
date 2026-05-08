/**
 * Showcase 4 — Playground tool-use agent (ReAct pattern).
 *
 *   Thought → Action (tool call) → Observation → … → Final Answer
 *
 * Each iteration emits a Step event so the UI can render the trace as
 * it unfolds. The mock planner picks tools based on simple keyword
 * heuristics; in real mode the planner is an LLM with the tool registry
 * passed as the system prompt.
 */

import { TOOL_REGISTRY } from './playground-tools';

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
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ─────────────── Mock planner: keyword → tool plan ─────────────── */

interface PlannedAction {
  thought: string;
  tool: keyof typeof TOOL_REGISTRY | null;
  args: Record<string, string>;
}

/**
 * Decide the next action based on the original query and what we've already
 * observed. Returns `{ tool: null }` to signal "now produce a final answer".
 */
function planNext(query: string, observed: Record<string, unknown>): PlannedAction {
  const q = query.toLowerCase();
  const wantsLocation = /where am i|my location|nearby|local|near me/.test(q) ||
                        /weather|time|here/.test(q);
  const wantsWeather = /weather|rain|sunny|hot|cold|mood|outside/.test(q);
  const wantsTime = /time|hour|now|currently/.test(q) && !wantsWeather;
  const wantsProject = /project|portfolio|recommend|showcase|build/.test(q);

  // 1. If we need location and don't have it, fetch it first
  if ((wantsLocation || wantsWeather) && !observed.location) {
    return {
      thought: 'I need the user\'s location before I can fetch local weather or recommend something based on context.',
      tool: 'get_user_location',
      args: {},
    };
  }

  // 2. Weather, given we have location
  if (wantsWeather && !observed.weather && observed.location) {
    const city = (observed.location as { city?: string }).city ?? 'London';
    return {
      thought: `Now that I know the user is in ${city}, I can fetch current weather to derive a mood.`,
      tool: 'get_weather',
      args: { city },
    };
  }

  // 3. Time
  if (wantsTime && !observed.time) {
    return {
      thought: 'The user wants the current time — I\'ll call the time tool.',
      tool: 'get_current_time',
      args: {},
    };
  }

  // 4. Project recommendation
  if (wantsProject && !observed.project) {
    const mood = (observed.weather as { mood_label?: string })?.mood_label ?? 'any';
    return {
      thought: mood !== 'any'
        ? `Weather suggests a "${mood}" mood — I'll search the portfolio for a matching project.`
        : 'I\'ll search the portfolio without a mood filter and pick the best match.',
      tool: 'search_portfolio_projects',
      args: { mood },
    };
  }

  // No more tools needed — emit final answer
  return {
    thought: 'I have enough information to answer the user.',
    tool: null,
    args: {},
  };
}

/* ─────────────── Final-answer synthesizer ─────────────── */

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

const MAX_ITERATIONS = 6;

export async function* runPlayground(query: string): AsyncGenerator<Step, PlaygroundResult> {
  const startedAt = Date.now();
  const observed: Record<string, unknown> = {};
  const steps: Step[] = [];
  const toolsUsed: string[] = [];

  yield emit({ kind: 'system', text: `🛠 Planning tool calls for: "${query}"` });
  await sleep(220);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const plan = planNext(query, observed);

    yield emit({ kind: 'thought', text: plan.thought });
    await sleep(280);

    if (!plan.tool) break;

    // Action
    yield emit({ kind: 'action', tool: plan.tool, args: plan.args });
    const tool = TOOL_REGISTRY[plan.tool];
    if (!tool) {
      yield emit({ kind: 'error', text: `Unknown tool: ${plan.tool}` });
      break;
    }

    // Call tool
    const result = await tool.call(plan.args);
    toolsUsed.push(plan.tool);

    // Persist observation in our scratchpad
    if (plan.tool === 'get_user_location') observed.location = result;
    else if (plan.tool === 'get_weather') observed.weather = result;
    else if (plan.tool === 'get_current_time') observed.time = result;
    else if (plan.tool === 'search_portfolio_projects') observed.project = result;

    yield emit({ kind: 'observation', tool: plan.tool, result });
    await sleep(220);
  }

  const finalAnswer = synthesizeAnswer(query, observed);
  yield emit({ kind: 'answer', text: finalAnswer });

  return {
    query,
    steps,
    finalAnswer,
    toolsUsed,
    durationMs: Date.now() - startedAt,
  };

  function emit(s: Omit<Step, 'ts'>): Step {
    const step: Step = { ts: Date.now(), ...s };
    steps.push(step);
    return step;
  }
}
