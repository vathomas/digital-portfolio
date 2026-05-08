/**
 * Showcase 2 — Deep Research Agent (plan-and-execute autonomous loop).
 *
 *   plan → search(×N) → factcheck → summarize → cost
 *
 * Implemented as an async generator that yields Thought events.
 * The SSE route consumes this generator and pipes each event to the browser.
 *
 * Mock mode: deterministic timings + canned sources keyed off the topic.
 * Real mode swap-points are marked `// REAL MODE swap:` — typically Tavily
 * for search and Claude/GPT for synthesis.
 */

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
 * Mock-mode topic-aware source generator. Builds plausible-looking citations
 * by interpolating the user's topic into a few canned templates. Real-mode
 * swap: Tavily/Brave search → fetch → extract.
 */
function mockSourcesFor(topic: string, subQuestion: string): Source[] {
  const kw = topicKeywords(topic);
  const anchor = kw[0] ?? 'topic';
  const arxivId = `${2410 + Math.floor(Math.random() * 4)}.${String(Math.floor(Math.random() * 90000) + 10000)}`;

  return [
    {
      title: `Empirical study on ${anchor}: scaling and bottlenecks`,
      citation: `arXiv:${arxivId} (Chen et al., 2026)`,
      finding: `Quantitative analysis relevant to "${subQuestion}" — observed 1.7× throughput improvement under typical load profiles.`,
    },
    {
      title: `Industry report — ${kw.slice(0, 3).join(' ')}`,
      citation: `Gartner Research Note #G00${Math.floor(Math.random() * 90000) + 10000}, Q1 2026`,
      finding: `Adoption metrics indicate this category is forecast to grow 38% YoY through 2027.`,
    },
    {
      title: `Benchmarks: ${anchor} vs. prior generation`,
      citation: `MLPerf Inference v4.1 results (Mar 2026)`,
      finding: `Sub-question "${subQuestion}" — measured improvements concentrated in memory-bound workloads.`,
    },
  ];
}

async function* planNode(topic: string): AsyncGenerator<Thought, string[]> {
  yield t('plan', 'thought', `Decomposing topic "${topic}" into research sub-questions…`);
  await sleep(700);

  // REAL MODE swap: prompt LLM to produce a JSON array of sub-questions
  const kw = topicKeywords(topic);
  const subQuestions = [
    `What is the current state of ${kw[0] ?? 'the topic'}?`,
    `What are the latest measurable benchmarks or metrics?`,
    `What are the leading critiques or counter-evidence?`,
  ];

  yield t('plan', 'success', `Generated ${subQuestions.length} sub-questions.`);
  for (const q of subQuestions) yield t('plan', 'observation', `  • ${q}`);
  return subQuestions;
}

async function* searchNode(topic: string, subQuestion: string, idx: number): AsyncGenerator<Thought, Source[]> {
  yield t('search', 'action', `Searching ArXiv + web for: "${subQuestion}"`);
  await sleep(600 + Math.random() * 800);

  yield t('search', 'thought', `Filtering results by recency and citation count…`);
  await sleep(400);

  // REAL MODE swap: tavily.search({ query: subQuestion }) → extract
  const sources = mockSourcesFor(topic, subQuestion);

  yield t('search', 'success', `Found ${sources.length} high-signal sources for sub-question ${idx + 1}.`);
  for (const s of sources) yield t('search', 'observation', `  ↳ ${s.citation}`);
  return sources;
}

async function* factcheckNode(allSources: Source[]): AsyncGenerator<Thought, Source[]> {
  yield t('factcheck', 'thought', `Cross-referencing ${allSources.length} sources for contradictions…`);
  await sleep(900);

  // REAL MODE swap: LLM cluster claims, flag conflicts
  yield t('factcheck', 'action', `Verifying primary citations against secondary sources…`);
  await sleep(700);

  const verified = allSources; // mock: all pass
  yield t('factcheck', 'success', `${verified.length}/${allSources.length} sources verified. No contradictions detected.`);
  return verified;
}

async function* summarizeNode(topic: string, subQuestions: string[], sources: Source[]): AsyncGenerator<Thought, string> {
  yield t('summarize', 'action', `Drafting executive summary…`);
  await sleep(800);

  yield t('summarize', 'thought', `Structuring report: overview → findings → outlook.`);
  await sleep(600);

  // REAL MODE swap: stream Claude Sonnet with sources as grounded context
  const summary = [
    `## Executive Summary`,
    ``,
    `This report investigates "${topic}" across ${subQuestions.length} dimensions, drawing from ${sources.length} primary and secondary sources.`,
    ``,
    `### Key Findings`,
    ``,
    ...sources.map((s, i) => `${i + 1}. **${s.title}** — ${s.finding} (${s.citation})`),
    ``,
    `### Outlook`,
    ``,
    `The evidence base supports continued investment in this area, with measurable improvements concentrated in operational efficiency. Ongoing monitoring of the cited benchmarks is recommended.`,
    ``,
    `_Generated by the Deep Research Agent — mock mode demonstration._`,
  ].join('\n');

  yield t('summarize', 'success', `Summary drafted (${summary.length} chars, ${sources.length} citations).`);
  return summary;
}

async function* costNode(tokenCounts: Record<string, number>, durationMs: number): AsyncGenerator<Thought, ResearchReport['cost']> {
  yield t('cost', 'thought', `Tallying token usage and dollar cost…`);
  await sleep(300);

  // Mock pricing (real mode uses actual OpenAI/Anthropic invoice rates):
  //   GPT-4o-mini  in  $0.15 / 1M tokens, out $0.60 / 1M tokens
  //   Claude Sonnet in $3.00 / 1M tokens, out $15.00 / 1M tokens
  const totalTokens = Object.values(tokenCounts).reduce((a, b) => a + b, 0);
  const usd = totalTokens * 0.0000035 + 0.005; // ~$0.04 typical

  yield t('cost', 'success', `Cost: $${usd.toFixed(3)} · Tokens: ${totalTokens.toLocaleString()} · Duration: ${(durationMs / 1000).toFixed(1)}s`);

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

  yield t('system', 'info', `🚀 Deep Research Agent — topic: "${topic}"`);
  yield t('system', 'info', `Report ID: ${reportId}`);

  // Plan
  const subQuestions = yield* planNode(topic);

  // Search (executed sequentially so the user sees the stream advance)
  const allSources: Source[] = [];
  for (let i = 0; i < subQuestions.length; i++) {
    const found = yield* searchNode(topic, subQuestions[i], i);
    allSources.push(...found);
  }

  // Fact-check
  const verified = yield* factcheckNode(allSources);

  // Summarize
  const summary = yield* summarizeNode(topic, subQuestions, verified);

  // Cost (mock token counts per node)
  const tokenCounts = {
    plan: 850,
    search: subQuestions.length * 1200,
    factcheck: 2100,
    summarize: 4400,
  };
  const durationMs = Date.now() - startedAt;
  const cost = yield* costNode(tokenCounts, durationMs);

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
