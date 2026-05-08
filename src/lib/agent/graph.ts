/**
 * LangGraph correction loop — Showcase 1 "Recursive Portfolio" Chatbot.
 *
 *   retrieve → grade → (pass) → generate
 *                    → (fail) → rewrite → retrieve   (max 2 retries)
 *
 * Runs in MOCK MODE by default (no LLM calls, no DB). The real-mode swap-in
 * points are clearly marked. The graph emits a `thoughts[]` trace consumed by
 * the "See Thoughts" toggle in the UI.
 */

import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import { mockRetrieve, type KnowledgeChunk } from './knowledge';

export type Thought =
  | { node: 'retrieve'; query: string; hits: { id: string; topic: string }[] }
  | { node: 'grade'; verdict: 'pass' | 'fail'; reason: string }
  | { node: 'rewrite'; from: string; to: string }
  | { node: 'generate'; tokens: number };

const AgentState = Annotation.Root({
  question: Annotation<string>(),
  query: Annotation<string>(),                 // current (possibly rewritten) query
  context: Annotation<KnowledgeChunk[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  thoughts: Annotation<Thought[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  attempts: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  answer: Annotation<string>(),
});

const MAX_ATTEMPTS = 2;

/* ────────────────────────── Nodes ────────────────────────── */

async function retrieve(state: typeof AgentState.State) {
  // REAL MODE swap: replace with Neon pgvector cosine similarity search
  const hits = mockRetrieve(state.query, 3);
  return {
    context: hits,
    thoughts: [
      {
        node: 'retrieve' as const,
        query: state.query,
        hits: hits.map((h) => ({ id: h.id, topic: h.topic })),
      },
    ],
  };
}

async function grade(state: typeof AgentState.State) {
  // REAL MODE swap: prompt gpt-4o-mini "Does this context answer the question? yes/no + reason"
  const ctxText = state.context.map((c) => c.text).join(' ').toLowerCase();
  const qTerms = state.question
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 3);

  const overlap = qTerms.filter((t) => ctxText.includes(t)).length;
  const ratio = qTerms.length > 0 ? overlap / qTerms.length : 0;

  // Empty context or weak overlap triggers a rewrite
  const pass = state.context.length > 0 && ratio >= 0.25;

  return {
    thoughts: [
      {
        node: 'grade' as const,
        verdict: pass ? ('pass' as const) : ('fail' as const),
        reason: pass
          ? `Retrieved context covers ${overlap}/${qTerms.length} key terms — sufficient.`
          : state.context.length === 0
            ? 'No chunks retrieved — query is too narrow or off-topic.'
            : `Only ${overlap}/${qTerms.length} key terms covered — context is thin.`,
      },
    ],
  };
}

async function rewrite(state: typeof AgentState.State) {
  // REAL MODE swap: prompt LLM to broaden or rephrase the query
  const original = state.query;

  // Naive rewrite strategy: drop short words, add domain anchors
  const broadened = original
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 3)
    .join(' ');

  const rewritten = broadened
    ? `${broadened} Thomas Abraham experience projects`
    : 'Thomas Abraham background experience';

  return {
    query: rewritten,
    attempts: state.attempts + 1,
    thoughts: [{ node: 'rewrite' as const, from: original, to: rewritten }],
  };
}

async function generate(state: typeof AgentState.State) {
  // REAL MODE swap: stream Claude Sonnet with the context as a prompt
  const ctxBlock = state.context
    .map((c, i) => `[${i + 1}] (${c.source}/${c.topic}) ${c.text}`)
    .join('\n\n');

  const answer =
    state.context.length === 0
      ? "I couldn't find anything in Thomas's portfolio that maps to that question. " +
        "Try asking about his Bank of England work, his agentic AI projects (market-research-agentic-team, " +
        "customer-service-agent), his certifications, or his planned move to Adelaide."
      : `Based on Thomas Abraham's portfolio:\n\n${ctxBlock}\n\n` +
        `(Mock mode — in production this would be streamed from Claude Sonnet with the above as grounded context.)`;

  return {
    answer,
    thoughts: [{ node: 'generate' as const, tokens: answer.length }],
  };
}

/* ────────────────────────── Edges ────────────────────────── */

function shouldRewrite(state: typeof AgentState.State): 'rewrite' | 'generate' {
  const lastGrade = [...state.thoughts].reverse().find((t) => t.node === 'grade');
  const failed = lastGrade?.node === 'grade' && lastGrade.verdict === 'fail';
  if (failed && state.attempts < MAX_ATTEMPTS) return 'rewrite';
  return 'generate';
}

/* ────────────────────────── Build ────────────────────────── */

const graph = new StateGraph(AgentState)
  .addNode('retrieve', retrieve)
  .addNode('grade', grade)
  .addNode('rewrite', rewrite)
  .addNode('generate', generate)
  .addEdge(START, 'retrieve')
  .addEdge('retrieve', 'grade')
  .addConditionalEdges('grade', shouldRewrite, {
    rewrite: 'rewrite',
    generate: 'generate',
  })
  .addEdge('rewrite', 'retrieve')
  .addEdge('generate', END);

export const portfolioAgent = graph.compile();

/**
 * Convenience: run the graph and return both the final answer and the trace.
 */
export async function askPortfolioAgent(question: string) {
  const result = await portfolioAgent.invoke({ question, query: question });
  return {
    answer: result.answer,
    thoughts: result.thoughts,
    attempts: result.attempts,
  };
}
