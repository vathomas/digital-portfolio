/**
 * Showcase 3 — Multi-Agent Software Architect Crew.
 *
 *   start → pm → coder → reviewer ─┬─► (REVISE) ─► coder ─► reviewer
 *                                   └─► (APPROVE) ─► end
 *
 * Three specialised agents collaborate. Each emits thoughts and artifacts
 * over an SSE stream; the UI uses the `state` events to highlight the
 * agent currently "holding the token" in a Mermaid flowchart.
 *
 * Mock-mode by default — see `code-templates.ts` for the canned outputs.
 * Real-mode swap-points are marked `// REAL MODE swap:`.
 */

import {
  mockRequirements,
  mockCodeV1,
  mockCodeV2,
  mockReviewV1,
  mockReviewV2,
  type Language,
  type Requirements,
  type CodeArtifact,
  type ReviewIssue,
} from './code-templates';

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
  await sleep(700);

  yield think('pm', 'action', 'Drafting acceptance criteria…');
  await sleep(800);

  // REAL MODE swap: prompt LLM for structured requirements (JSON mode)
  const reqs = mockRequirements(prompt);

  yield think('pm', 'success', `Requirements ready: ${reqs.acceptance.length} criteria, ${reqs.edgeCases.length} edge cases.`);
  yield artifact({ kind: 'requirements', agent: 'pm', cycle: 1, data: reqs });
  return reqs;
}

async function* coder(
  prompt: string,
  language: Language,
  cycle: number,
  feedback: ReviewIssue[] | null,
): AsyncGenerator<CrewEvent, CodeArtifact> {
  yield state('coder', cycle);

  if (feedback) {
    yield think('coder', 'thought', `Incorporating ${feedback.length} reviewer notes from cycle ${cycle - 1}…`);
    await sleep(600);
    for (const issue of feedback) {
      yield think('coder', 'action', `  ↳ Fixing: ${issue.text}`);
      await sleep(220);
    }
  } else {
    yield think('coder', 'thought', `Implementing first draft in ${language}…`);
    await sleep(900);
  }

  // REAL MODE swap: prompt LLM with reqs + feedback → code
  const code = cycle === 1 ? mockCodeV1(prompt, language) : mockCodeV2(prompt, language);

  yield think('coder', 'success', `Cycle ${cycle} draft complete (${code.code.split('\n').length} LoC).`);
  yield artifact({ kind: 'code', agent: 'coder', cycle, data: code });
  return code;
}

async function* reviewer(
  code: CodeArtifact,
  cycle: number,
): AsyncGenerator<CrewEvent, { verdict: Verdict; issues: ReviewIssue[] }> {
  yield state('reviewer', cycle);
  yield think('reviewer', 'thought', `Auditing cycle ${cycle} draft…`);
  await sleep(700);

  yield think('reviewer', 'action', 'Checking type signatures, edge cases, and error handling…');
  await sleep(800);

  // REAL MODE swap: prompt LLM with code + reqs → JSON {verdict, issues[]}
  const review = cycle === 1 ? mockReviewV1() : mockReviewV2();

  if (review.verdict === 'REVISE') {
    yield think('reviewer', 'warn', `${review.issues.length} issues found — sending back to Coder.`);
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
  await sleep(300);

  // 1. PM
  const requirements = yield* productManager(prompt);

  // 2-3. Coder ↔ Reviewer loop (max MAX_CYCLES)
  let code: CodeArtifact = { language, code: '' };
  let feedback: ReviewIssue[] | null = null;
  let cycle = 0;
  let approved = false;

  while (cycle < MAX_CYCLES && !approved) {
    cycle++;
    code = yield* coder(prompt, language, cycle, feedback);
    const review = yield* reviewer(code, cycle);

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
      : `⚠️ Max cycles reached (${MAX_CYCLES}) — shipping with reviewer's last verdict.`,
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
