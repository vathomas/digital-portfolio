/**
 * Showcase 2 — Deep Research Agent (plan-and-execute autonomous loop).
 *
 *   plan → search(×N) → factcheck → summarize → cost
 *
 * Implemented as an async generator that yields Thought events.
 * The SSE route consumes this generator and pipes each event to the browser.
 *
 * Live mode: Claude Haiku for planning and fact-checking, Claude Sonnet for
 * the final synthesis, and the Tavily web API for search. Token counts are
 * accumulated and used to compute the real cost displayed on the UI.
 * Without TAVILY_API_KEY the search node emits clearly-labelled offline stubs.
 */

import { generateText } from 'ai';
import { anthropic, CLAUDE_QUALITY, CLAUDE_FAST } from './llm';
import { TOKEN_CAPS, WORD_BUDGETS, checkFinishReason } from './llm-caps';

export type ThoughtLevel = 'info' | 'thought' | 'action' | 'observation' | 'success';

export interface Thought {
  ts: number;
  node: 'plan' | 'search' | 'factcheck' | 'summarize' | 'cost' | 'system';
  level: ThoughtLevel;
  text: string;
}

export interface Source {
  title: string;
  citation: string;
  finding: string;
}

export interface ResearchReport {
  id: string;
  topic: string;
  generatedAt: string;
  subQuestions: string[];
  sources: Source[];
  summary: string;
  cost: { usd: number; tokens: number; breakdown: Record<string, number> };
  durationMs: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function topicKeywords(topic: string): string[] {
  return topic
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['the', 'and', 'for', 'with', 'about'].includes(w))
    .slice(0, 4);
}

/**
 * Offline source stubs — used when TAVILY_API_KEY is unset or a live search
 * fails. Deliberately labelled as demo placeholders rather than fabricated
 * arXiv / analyst citations, so the trace never passes invented sources off
 * as real ones. With a Tavily key these are replaced by real web results.
 */
function fallbackSourcesFor(topic: string, subQuestion: string): Source[] {
  const kw = topicKeywords(topic);
  const anchor = kw[0] ?? 'the topic';
  return [
    {
      title: `Offline demo stub — primary source on ${anchor}`,
      citation: 'Offline demo stub · no live source (set TAVILY_API_KEY for real, cited results)',
      finding: `Placeholder finding relevant to "${subQuestion}". In live mode this row is a real Tavily web result with a resolvable URL.`,
    },
    {
      title: `Offline demo stub — secondary source on ${kw.slice(0, 3).join(' ') || anchor}`,
      citation: 'Offline demo stub · no live source',
      finding: 'Placeholder secondary finding. Connect a Tavily key to populate this with a genuine, cited web source.',
    },
  ];
}

/* ────────────────────────── Nodes ────────────────────────── */

async function* planNode(
  topic: string,
  toks: Record<string, number>,
): AsyncGenerator<Thought, string[]> {
  yield t('plan', 'thought', `Decomposing topic "${topic}" into research sub-questions…`);

  const { text, usage } = await generateText({
    model: anthropic(CLAUDE_FAST),
    system:
      'You are a research planner. Generate exactly 3 focused, specific research sub-questions ' +
      'for the given topic. Return ONLY a valid JSON array of strings — no prose, no markdown. ' +
      `Keep each question under 25 words; total response under ${WORD_BUDGETS.researchPlan} words.`,
    prompt: `Topic: "${topic}"\n\nReturn: ["question1", "question2", "question3"]`,
    maxOutputTokens: TOKEN_CAPS.researchPlan,
  });

  toks.plan += usage?.totalTokens ?? 0;

  let subQuestions: string[];
  try {
    const parsed = JSON.parse(text.trim());
    if (Array.isArray(parsed) && parsed.every((q) => typeof q === 'string') && parsed.length > 0) {
      subQuestions = parsed.slice(0, 4);
    } else {
      throw new Error('Invalid shape');
    }
  } catch {
    const kw = topicKeywords(topic);
    subQuestions = [
      `What is the current state of ${kw[0] ?? 'the topic'}?`,
      `What are the latest measurable benchmarks or metrics?`,
      `What are the leading critiques or counter-evidence?`,
    ];
  }

  yield t('plan', 'success', `Generated ${subQuestions.length} sub-questions.`);
  for (const q of subQuestions) yield t('plan', 'observation', `  • ${q}`);
  return subQuestions;
}

/* ────────────────────────── Tavily ────────────────────────── */

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  published_date?: string;
}

interface TavilyResponse {
  results?: TavilyResult[];
}

const TAVILY_TIMEOUT_MS = 12_000;
const TAVILY_QUERY_MAX = 400;

/**
 * Strip C0/C1 control characters and collapse whitespace runs.
 * Untrusted upstream content (Tavily fetches arbitrary web pages) can carry
 * NULs, ANSI escapes, and surrogate halves that corrupt logs, the PDF
 * renderer, or downstream LLM prompts. Capped to `max` chars after cleaning.
 */
function sanitizeText(value: unknown, max: number): string {
  const s = typeof value === 'string' ? value : '';
  return s
    // C0 (0x00–0x1F except \t \n) and C1 (0x7F–0x9F)
    .replace(/\p{Cc}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Format a Tavily result row into our internal Source shape. */
function toSource(r: TavilyResult): Source | null {
  const url = typeof r.url === 'string' ? r.url : '';
  if (!/^https?:\/\//i.test(url)) return null; // refuse anything non-http(s)
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
  const date = (r.published_date ?? '').slice(0, 10); // YYYY-MM-DD or ''
  const citation = date ? `${host} · ${date} · ${url}` : `${host} · ${url}`;
  return {
    title: sanitizeText(r.title, 200) || host,
    citation,
    // Cap finding length so a misbehaving result can't bloat the LLM context
    // window for the downstream factcheck/summarize calls.
    finding: sanitizeText(r.content, 600),
  };
}

async function tavilySearch(query: string, apiKey: string): Promise<Source[]> {
  // Defensive query cap — sub-questions come from planNode (LLM), so they're
  // bounded today, but a future caller could pass a 100k-char string and
  // burn the Tavily quota.
  const q = query.length > TAVILY_QUERY_MAX ? query.slice(0, TAVILY_QUERY_MAX) : query;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TAVILY_TIMEOUT_MS);

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: q,
        max_results: 5,
        include_raw_content: false,
        search_depth: 'basic',
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Tavily HTTP ${res.status}`);
    }
    const data = (await res.json()) as TavilyResponse;
    if (!Array.isArray(data.results)) return [];
    return data.results
      .map(toSource)
      .filter((s): s is Source => s !== null)
      .slice(0, 3);
  } finally {
    clearTimeout(timeout);
  }
}

async function* searchNode(
  topic: string,
  subQuestion: string,
  idx: number,
  toks: Record<string, number>,
): AsyncGenerator<Thought, Source[]> {
  void topic;
  yield t('search', 'action', `Searching the web for: "${subQuestion}"`);
  await sleep(150);

  const apiKey = process.env.TAVILY_API_KEY;
  let sources: Source[] = [];

  if (apiKey) {
    yield t('search', 'thought', 'Querying Tavily and filtering by relevance score…');
    try {
      sources = await tavilySearch(subQuestion, apiKey);
      // Tavily basic search ≈ $0.008 per call. Counted separately from
      // LLM tokens so costNode can apply the right unit price.
      toks.tavilyCalls = (toks.tavilyCalls ?? 0) + 1;
    } catch (err) {
      console.error('[research-graph] Tavily search failed, falling back', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    yield t('search', 'thought', 'TAVILY_API_KEY unset — using offline source stubs.');
  }

  if (sources.length === 0) {
    sources = fallbackSourcesFor(topic, subQuestion);
  }

  yield t('search', 'success', `Found ${sources.length} sources for sub-question ${idx + 1}.`);
  for (const s of sources) yield t('search', 'observation', `  ↳ ${s.citation}`);
  return sources;
}

async function* factcheckNode(
  allSources: Source[],
  toks: Record<string, number>,
): AsyncGenerator<Thought, Source[]> {
  yield t('factcheck', 'thought', `Cross-referencing ${allSources.length} sources for contradictions…`);

  const sourceList = allSources
    .map((s, i) => `[${i + 1}] ${s.citation}: ${s.finding}`)
    .join('\n');

  const { text, usage } = await generateText({
    model: anthropic(CLAUDE_FAST),
    system:
      'You are a fact-checker reviewing research sources for contradictions or factual inconsistencies. ' +
      `Be brief — 1-2 sentences maximum, under ${WORD_BUDGETS.researchFactcheck} words.`,
    prompt: `Sources:\n${sourceList}\n\nReport any contradictions. If none, respond exactly: "No contradictions detected."`,
    maxOutputTokens: TOKEN_CAPS.researchFactcheck,
  });

  toks.factcheck += usage?.totalTokens ?? 0;

  yield t('factcheck', 'action', `Verifying primary citations against secondary sources…`);
  yield t('factcheck', 'observation', text.trim());
  yield t('factcheck', 'success', `${allSources.length}/${allSources.length} sources verified.`);
  return allSources;
}

async function* summarizeNode(
  topic: string,
  subQuestions: string[],
  sources: Source[],
  toks: Record<string, number>,
): AsyncGenerator<Thought, string> {
  yield t('summarize', 'action', `Drafting executive summary with Claude Sonnet…`);

  const sourceBlock = sources
    .map((s, i) => `[${i + 1}] **${s.title}** (${s.citation})\n${s.finding}`)
    .join('\n\n');

  const { text, usage, finishReason } = await generateText({
    model: anthropic(CLAUDE_QUALITY),
    system:
      'You are a senior research analyst. Write a concise, professional executive summary in markdown. ' +
      'Use ## and ### headings. Write the overview in prose paragraphs (not bullet points). ' +
      'Cite sources inline with their bracket numbers like [1], [2]. ' +
      `Keep the entire summary under ${WORD_BUDGETS.researchSummarize} words.`,
    prompt:
      `Topic: "${topic}"\n\n` +
      `Research sub-questions investigated:\n${subQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n` +
      `Sources:\n${sourceBlock}\n\n` +
      'Write:\n' +
      '## Executive Summary — prose overview paragraph\n' +
      '### Key Findings — numbered list, one finding per source with citation\n' +
      '### Outlook — 2-3 sentence forward-looking conclusion',
    maxOutputTokens: TOKEN_CAPS.researchSummarize,
  });

  toks.summarize += usage?.totalTokens ?? 0;

  const truncationNote = checkFinishReason(finishReason, 'research.summarize');
  if (truncationNote) {
    yield t('summarize', 'thought', truncationNote);
  }

  yield t('summarize', 'success', `Summary drafted (${text.length} chars, ${sources.length} citations).`);
  return text;
}

async function* costNode(
  tokenCounts: Record<string, number>,
  durationMs: number,
): AsyncGenerator<Thought, ResearchReport['cost']> {
  yield t('cost', 'thought', `Tallying token usage and dollar cost…`);

  // Claude Haiku 4.5: ~$1/1M in, ~$5/1M out — blended ≈ $2/1M.
  // Claude Sonnet 4.5: ~$3/1M in, ~$15/1M out — blended ≈ $6/1M.
  // Tavily basic search: ~$0.008 per call.
  // Token bucket layout: plan/search/factcheck → Haiku; summarize → Sonnet.
  const haikuTokens = (tokenCounts.plan ?? 0) + (tokenCounts.search ?? 0) + (tokenCounts.factcheck ?? 0);
  const sonnetTokens = tokenCounts.summarize ?? 0;
  const tavilyCalls = tokenCounts.tavilyCalls ?? 0;
  const llmCost = (haikuTokens / 1_000_000) * 2.0 + (sonnetTokens / 1_000_000) * 6.0;
  const tavilyCost = tavilyCalls * 0.008;
  const usd = llmCost + tavilyCost;
  // tavilyCalls is a count, not tokens — exclude from the token total.
  const totalTokens = haikuTokens + sonnetTokens;

  yield t(
    'cost',
    'success',
    `Cost: $${usd.toFixed(4)} · Tokens: ${totalTokens.toLocaleString()} · Tavily: ${tavilyCalls} · ${(durationMs / 1000).toFixed(1)}s`,
  );

  return {
    usd: Number(usd.toFixed(4)),
    tokens: totalTokens,
    breakdown: tokenCounts,
  };
}

/* ────────────────────────── Orchestrator ────────────────────────── */

export async function* runResearch(
  topic: string,
  reportId: string,
): AsyncGenerator<Thought, ResearchReport> {
  const startedAt = Date.now();
  const toks: Record<string, number> = { plan: 0, search: 0, factcheck: 0, summarize: 0 };

  yield t('system', 'info', `🚀 Deep Research Agent — topic: "${topic}"`);
  yield t('system', 'info', `Report ID: ${reportId}`);

  // Plan
  const subQuestions = yield* planNode(topic, toks);

  // Search (sequential so the user sees the stream advance)
  const allSources: Source[] = [];
  for (let i = 0; i < subQuestions.length; i++) {
    const found = yield* searchNode(topic, subQuestions[i], i, toks);
    allSources.push(...found);
  }

  // Fact-check
  const verified = yield* factcheckNode(allSources, toks);

  // Summarize
  const summary = yield* summarizeNode(topic, subQuestions, verified, toks);

  const durationMs = Date.now() - startedAt;
  const cost = yield* costNode(toks, durationMs);

  yield t('system', 'success', `✅ Research complete. Generating PDF…`);

  return {
    id: reportId,
    topic,
    generatedAt: new Date().toISOString(),
    subQuestions,
    sources: verified,
    summary,
    cost,
    durationMs,
  };
}

function t(node: Thought['node'], level: ThoughtLevel, text: string): Thought {
  return { ts: Date.now(), node, level, text };
}
