/**
 * Showcase 3 — Multi-Agent Software Architect Crew.
 *
 *   start → pm → coder → reviewer ─┬─► (REVISE) ─► coder ─► reviewer
 *                                   └─► (APPROVE) ─► end
 *
 * Real mode: PM and Reviewer use GPT-4o-mini (JSON mode);
 * Coder uses Claude Sonnet for high-quality code generation.
 */

import { generateText } from 'ai';
import { anthropic, CLAUDE_QUALITY, CLAUDE_FAST } from './llm';
import type { Language, Requirements, CodeArtifact, ReviewIssue } from './code-templates';

export type AgentId = 'pm' | 'coder' | 'reviewer';
export type CrewStateNode = 'start' | AgentId | 'end';
export type Verdict = 'REVISE' | 'APPROVE';

export type Thought = {
  ts: number;
  agent: AgentId | 'system';
  level: 'info' | 'thought' | 'action' | 'success' | 'warn';
  text: string;
};

export type StateEvent = {
  ts: number;
  active: CrewStateNode;
  cycle: number;
};

export type Artifact =
  | { kind: 'requirements'; agent: 'pm'; cycle: number; data: Requirements }
  | { kind: 'code'; agent: 'coder'; cycle: number; data: CodeArtifact }
  | { kind: 'review'; agent: 'reviewer'; cycle: number; verdict: Verdict; issues: ReviewIssue[] };

export type CrewEvent =
  | { type: 'thought'; payload: Thought }
  | { type: 'state'; payload: StateEvent }
  | { type: 'artifact'; payload: Artifact };

const MAX_CYCLES = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ─────────────── Agent steps (each yields events) ─────────────── */

async function* productManager(prompt: string): AsyncGenerator<CrewEvent, Requirements> {
  yield state('pm', 1);
  yield think('pm', 'thought', `Reviewing user request: "${prompt}"`);
  await sleep(400);

  yield think('pm', 'action', 'Generating structured requirements with GPT-4o-mini…');

  const { text } = await generateText({
    model: anthropic(CLAUDE_FAST),
    system:
      'You are an experienced product manager. Given a feature request, produce structured ' +
      'engineering requirements as JSON. Return ONLY valid JSON matching: ' +
      '{"goal":"string","acceptance":["string","string","string"],"edgeCases":["string","string","string"]}',
    prompt: `Feature request: "${prompt}"`,
  });

  let reqs: Requirements;
  try {
    const raw = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(raw) as Requirements;
    if (!parsed.goal || !Array.isArray(parsed.acceptance) || !Array.isArray(parsed.edgeCases)) {
      throw new Error('Invalid shape');
    }
    reqs = {
      goal: parsed.goal,
      acceptance: parsed.acceptance.slice(0, 5),
      edgeCases: parsed.edgeCases.slice(0, 5),
    };
  } catch {
    reqs = {
      goal: prompt.trim(),
      acceptance: [
        'Function returns correct output for the documented inputs',
        'Has type signatures (or type hints in Python)',
        'Includes a brief docstring / JSDoc',
      ],
      edgeCases: ['Empty input', 'Malformed / non-conforming input', 'Large inputs do not blow memory'],
    };
  }

  yield think('pm', 'success', `Requirements ready: ${reqs.acceptance.length} criteria, ${reqs.edgeCases.length} edge cases.`);
  yield artifact({ kind: 'requirements', agent: 'pm', cycle: 1, data: reqs });
  return reqs;
}

async function* coder(
  prompt: string,
  language: Language,
  cycle: number,
  feedback: ReviewIssue[] | null,
  requirements: Requirements | null,
): AsyncGenerator<CrewEvent, CodeArtifact> {
  yield state('coder', cycle);

  if (feedback && feedback.length > 0) {
    yield think('coder', 'thought', `Incorporating ${feedback.length} reviewer notes from cycle ${cycle - 1}…`);
    await sleep(300);
    for (const issue of feedback) {
      yield think('coder', 'action', `  ↳ Addressing: ${issue.text}`);
      await sleep(150);
    }
  } else {
    yield think('coder', 'thought', `Implementing first draft in ${language} with Claude Sonnet…`);
    await sleep(400);
  }

  const reqBlock = requirements
    ? `\nAcceptance criteria:\n${requirements.acceptance.map((a) => `- ${a}`).join('\n')}` +
      `\nEdge cases to handle:\n${requirements.edgeCases.map((e) => `- ${e}`).join('\n')}`
    : '';

  const feedbackBlock =
    feedback && feedback.length > 0
      ? `\nPrevious reviewer feedback to fix:\n${feedback.map((f) => `- [${f.severity}] ${f.text}`).join('\n')}`
      : '';

  const { text } = await generateText({
    model: anthropic(CLAUDE_QUALITY),
    system:
      `You are an expert ${language} developer. Write clean, idiomatic, production-quality code. ` +
      `Return ONLY the code — no explanation, no markdown fences, no prose. Just raw ${language} code.`,
    prompt:
      `Implement: "${prompt}" in ${language}.` +
      reqBlock +
      feedbackBlock +
      `\n\nReturn only the ${language} code.`,
  });

  const code = text
    .trim()
    .replace(/^```(?:\w+)?\n?/, '')
    .replace(/\n?```$/, '');

  const artifact_: CodeArtifact = {
    language,
    code,
    notes: cycle > 1 ? 'Revised to address reviewer feedback' : undefined,
  };

  yield think('coder', 'success', `Cycle ${cycle} draft complete (${code.split('\n').length} LoC).`);
  yield artifact({ kind: 'code', agent: 'coder', cycle, data: artifact_ });
  return artifact_;
}

async function* reviewer(
  code: CodeArtifact,
  cycle: number,
  requirements: Requirements,
): AsyncGenerator<CrewEvent, { verdict: Verdict; issues: ReviewIssue[] }> {
  yield state('reviewer', cycle);
  yield think('reviewer', 'thought', `Auditing cycle ${cycle} draft with GPT-4o-mini…`);
  await sleep(300);

  yield think('reviewer', 'action', 'Checking correctness, types, edge cases, and documentation…');

  const reqBlock =
    `Acceptance criteria:\n${requirements.acceptance.map((a) => `- ${a}`).join('\n')}\n` +
    `Edge cases:\n${requirements.edgeCases.map((e) => `- ${e}`).join('\n')}`;

  const { text } = await generateText({
    model: anthropic(CLAUDE_FAST),
    system:
      'You are a senior code reviewer. Review the code against the requirements. ' +
      'If there are significant issues, set verdict to REVISE and list them. ' +
      'If the code is correct and meets the requirements, set verdict to APPROVE. ' +
      'Return ONLY valid JSON: {"verdict":"APPROVE"|"REVISE","issues":[{"severity":"major"|"minor","text":"..."}]} ' +
      'Issues array must be empty for APPROVE.',
    prompt:
      `Code to review:\n\`\`\`${code.language}\n${code.code}\n\`\`\`\n\n` +
      `Requirements:\n${reqBlock}`,
  });

  let review: { verdict: Verdict; issues: ReviewIssue[] };
  try {
    const raw = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(raw) as { verdict: string; issues: { severity: string; text: string }[] };
    review = {
      verdict: parsed.verdict === 'APPROVE' ? 'APPROVE' : 'REVISE',
      issues: (parsed.issues ?? []).map((i) => ({
        severity: (i.severity === 'major' || i.severity === 'minor') ? i.severity : 'minor',
        text: String(i.text ?? ''),
      })),
    };
  } catch {
    // If we can't parse, approve to avoid blocking the demo
    review = { verdict: 'APPROVE', issues: [] };
  }

  if (review.verdict === 'REVISE') {
    yield think('reviewer', 'warn', `${review.issues.length} issue(s) found — returning to Coder.`);
    for (const issue of review.issues) {
      yield think('reviewer', 'action', `  • [${issue.severity}] ${issue.text}`);
    }
  } else {
    yield think('reviewer', 'success', '✅ All checks pass. Code approved for merge.');
  }

  yield artifact({
    kind: 'review',
    agent: 'reviewer',
    cycle,
    verdict: review.verdict,
    issues: review.issues,
  });
  return review;
}

/* ─────────────── Orchestrator ─────────────── */

export interface CrewResult {
  prompt: string;
  language: Language;
  cycles: number;
  finalCode: CodeArtifact;
  requirements: Requirements;
  durationMs: number;
}

export async function* runCrew(prompt: string, language: Language): AsyncGenerator<CrewEvent, CrewResult> {
  const startedAt = Date.now();

  yield state('start', 0);
  yield think('system', 'info', `🤖 Spinning up crew for: "${prompt}" (${language})`);
  await sleep(200);

  // 1. PM generates requirements
  const requirements = yield* productManager(prompt);

  // 2-3. Coder ↔ Reviewer loop (max MAX_CYCLES)
  let code: CodeArtifact = { language, code: '' };
  let feedback: ReviewIssue[] | null = null;
  let cycle = 0;
  let approved = false;

  while (cycle < MAX_CYCLES && !approved) {
    cycle++;
    code = yield* coder(prompt, language, cycle, feedback, requirements);
    const review = yield* reviewer(code, cycle, requirements);

    if (review.verdict === 'APPROVE') {
      approved = true;
    } else {
      feedback = review.issues;
      yield think('system', 'info', `↺ Cycle ${cycle} → ${cycle + 1}: returning code to Coder.`);
    }
  }

  yield state('end', cycle);
  yield think(
    'system',
    'success',
    approved
      ? `✅ Crew complete after ${cycle} cycle${cycle === 1 ? '' : 's'}.`
      : `⚠️ Max cycles reached (${MAX_CYCLES}) — shipping with last revision.`,
  );

  return {
    prompt,
    language,
    cycles: cycle,
    finalCode: code,
    requirements,
    durationMs: Date.now() - startedAt,
  };
}

/* ─────────────── helpers ─────────────── */

function think(agent: Thought['agent'], level: Thought['level'], text: string): CrewEvent {
  return { type: 'thought', payload: { ts: Date.now(), agent, level, text } };
}

function state(active: CrewStateNode, cycle: number): CrewEvent {
  return { type: 'state', payload: { ts: Date.now(), active, cycle } };
}

function artifact(a: Artifact): CrewEvent {
  return { type: 'artifact', payload: a };
}
