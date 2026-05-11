/**
 * Output-token caps per LLM operation — financial guardrail layer.
 *
 * Every `generateText` / `streamText` call in this codebase must pass one of
 * the caps in `TOKEN_CAPS` as `maxOutputTokens`. The cap bounds the worst-case
 * dollar cost per single LLM call so a bot, runaway loop, or hallucination
 * cannot rack up an unbounded bill (Anthropic Sonnet output is ~$15/1M tokens,
 * Haiku ~$5/1M — see https://www.anthropic.com/pricing).
 *
 * Sizing strategy:
 *   1. Caps are sized empirically — large enough that finishReason='length'
 *      stays rare for normal queries, small enough that a misbehaving call
 *      stops at a known cost.
 *   2. System prompts include a matching word budget (≈ 0.75 × cap) so the
 *      model self-paces and lands its conclusion before the hard cap kicks
 *      in. See WORD_BUDGETS below.
 *   3. Every call checks finishReason — when 'length', we log + surface a
 *      "response truncated" note to the user via checkFinishReason().
 *
 * Worst-case spend per HTTP request, with all caps hit:
 *
 *   /api/chat         retrieve→grade→[rewrite→retrieve→]generate
 *                     = grade ($0.0005) + rewrite ($0.001) + generate ($0.012)
 *                     ≈ $0.014 per request
 *
 *   /api/research     plan + factcheck + summarize + 3×Tavily ($0.024)
 *                     ≈ $0.057 per request (LLM portion $0.033)
 *
 *   /api/crew         pm + 2 × (coder + reviewer)
 *                     ≈ $0.068 per request
 *
 *   /api/playground   6 planner iterations
 *                     ≈ $0.018 per request
 *
 * These caps DO NOT replace rate limiting — they're a per-call backstop.
 * A bot calling /api/research 1000×/minute still costs ~$57/min uncapped.
 * Rate limit middleware (TODO follow-up) is the primary defence; this file
 * is the secondary "fail-safe" layer per Phase-3 spec.
 *
 * IMPORTANT — `maxOutputTokens` vs `maxTokens`:
 *   AI SDK v6 renamed the option to `maxOutputTokens`. Older code that
 *   passed `maxTokens` (e.g. the prior playground-graph implementation,
 *   cast through `as Record<string, unknown>`) was silently ignored.
 *   Always import the cap from this file AND pass it via the strongly-typed
 *   `maxOutputTokens` field so future SDK upgrades surface breakage at
 *   compile time, not in the billing dashboard.
 */

import type { FinishReason } from 'ai';

/**
 * Per-operation max output tokens. Numbers tuned to balance quality and cost.
 * Increase only when finishReason='length' alerts spike for a given op.
 */
export const TOKEN_CAPS = {
  /** Showcase 1 — relevance grader (1-line yes/no + reason) */
  chatGrade: 100,
  /** Showcase 1 — query rewriter (1 short rewritten sentence) */
  chatRewrite: 200,
  /** Showcase 1 — final answer to user (paragraph, 1–2 short follow-ups) */
  chatGenerate: 800,

  /** Showcase 2 — sub-question planner (JSON array of 3 strings) */
  researchPlan: 300,
  /** Showcase 2 — fact-check verdict (1–2 sentences) */
  researchFactcheck: 200,
  /** Showcase 2 — executive summary (markdown, multiple H3 sections) */
  researchSummarize: 2000,

  /** Showcase 3 — PM agent requirements JSON */
  crewPm: 600,
  /** Showcase 3 — Coder agent code body */
  crewCoder: 2000,
  /** Showcase 3 — Reviewer JSON verdict + issues */
  crewReviewer: 500,

  /** Showcase 4 — ReAct planner JSON per iteration */
  playgroundPlanner: 600,
} as const;

/**
 * Word budgets to embed in system prompts so the model self-paces.
 * Roughly 0.75 × the token cap (1 token ≈ 0.75 English words on average).
 * Use these in prompts as: "Keep your response under N words."
 */
export const WORD_BUDGETS = {
  chatGenerate: 600,
  researchPlan: 200,
  researchFactcheck: 50,
  researchSummarize: 1500,
  crewPm: 400,
  crewCoder: 1500,
  crewReviewer: 350,
  playgroundPlanner: 400,
} as const;

/**
 * Inspect a finishReason returned by generateText/streamText.
 *
 * @param finishReason  The reason the model stopped (from AI SDK).
 * @param opLabel       Human-readable op name for the log line (e.g. "chat.generate").
 * @returns A user-visible warning string when the cap was hit, else null.
 *
 * Truncation note is appended to the user-visible answer (chat) or surfaced
 * as a thought/system event (SSE showcases). 'stop' = clean finish, 'tool-calls'
 * = expected for tool-using flows, others are logged but pass through silently.
 */
export function checkFinishReason(
  finishReason: FinishReason | undefined,
  opLabel: string,
): string | null {
  if (finishReason === 'length') {
    console.warn(`[token-cap] ${opLabel} truncated at max-token cap`);
    return '⚠️ Response truncated due to length limits — try a more focused query for a complete answer.';
  }
  if (finishReason === 'content-filter') {
    console.warn(`[token-cap] ${opLabel} blocked by content filter`);
    return '⚠️ Response blocked by safety filter.';
  }
  return null;
}
