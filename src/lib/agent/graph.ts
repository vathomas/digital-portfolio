/**
 * LangGraph correction loop — Showcase 1 "Recursive Portfolio" Chatbot.
 *
 *   retrieve → grade → (pass) → generate
 *                    → (fail) → rewrite → retrieve   (max 2 retries)
 *
 * Real mode: grade + rewrite use GPT-4o-mini; generate uses Claude Sonnet.
 * retrieve stays on the mock corpus until DATABASE_URL + pgvector is wired.
 * The graph emits a `thoughts[]` trace consumed by the "See Thoughts" toggle.
 */

import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import { generateText } from 'ai';
import { anthropic, CLAUDE_QUALITY } from './llm';
import { retrieve as retrieveChunks, type KnowledgeChunk } from './knowledge';
import { TOKEN_CAPS, WORD_BUDGETS, checkFinishReason } from './llm-caps';

export type Thought =
  | { node: 'retrieve'; query: string; hits: { id: string; topic: string }[] }
  | { node: 'grade'; verdict: 'pass' | 'fail'; reason: string }
  | { node: 'rewrite'; from: string; to: string }
  | { node: 'generate'; tokens: number; truncated?: boolean };

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
  // Real mode: pgvector + OpenAI embeddings. Falls back to keyword overlap
  // when DATABASE_URL or OPENAI_API_KEY is absent (local dev / unconfigured).
  const hits = await retrieveChunks(state.query, 3);
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
  const ctxText = state.context.map((c) => c.text).join('\n\n');

  const { text } = await generateText({
    model: anthropic(CLAUDE_QUALITY),
    system:
      'You are a relevance grader. Given a question and retrieved context, decide if the context ' +
      'adequately answers the question. Respond with exactly "YES - <brief reason>" or "NO - <brief reason>". ' +
      'Reason must be under 20 words.',
    prompt: `Question: ${state.question}\n\nContext:\n${ctxText || '(no context retrieved)'}`,
    maxOutputTokens: TOKEN_CAPS.chatGrade,
  });

  const pass = text.trim().toUpperCase().startsWith('YES');
  const reason = text.replace(/^(YES|NO)\s*[-–]?\s*/i, '').trim();

  return {
    thoughts: [
      {
        node: 'grade' as const,
        verdict: pass ? ('pass' as const) : ('fail' as const),
        reason,
      },
    ],
  };
}

async function rewrite(state: typeof AgentState.State) {
  const { text } = await generateText({
    model: anthropic(CLAUDE_QUALITY),
    system:
      'Rewrite the given search query to be broader and more likely to retrieve relevant information ' +
      'from a personal portfolio knowledge base about Thomas Abraham. Return only the rewritten query, ' +
      'one sentence, no preamble.',
    prompt: `Original query: "${state.query}"`,
    maxOutputTokens: TOKEN_CAPS.chatRewrite,
  });

  const rewritten = text.trim();
  return {
    query: rewritten,
    attempts: state.attempts + 1,
    thoughts: [{ node: 'rewrite' as const, from: state.query, to: rewritten }],
  };
}

async function generate(state: typeof AgentState.State) {
  if (state.context.length === 0) {
    const answer =
      "I couldn't find anything in Thomas's portfolio that maps to that question. " +
      'Try asking about his Bank of England work, his agentic AI projects (market-research-agentic-team, ' +
      "customer-service-agent), his certifications, or his planned move to Adelaide.";
    return { answer, thoughts: [{ node: 'generate' as const, tokens: 0 }] };
  }

  const ctxBlock = state.context
    .map((c, i) => `[${i + 1}] Source: ${c.source} / ${c.topic}\n${c.text}`)
    .join('\n\n');

  const { text, usage, finishReason } = await generateText({
    model: anthropic(CLAUDE_QUALITY),
    system:
      "You are the portfolio assistant for Thomas Abraham, a Full-Stack Product Engineer specialising " +
      'in Agentic AI. Answer questions about Thomas accurately and concisely based ONLY on the provided ' +
      'context. Speak in third person. Be warm and professional. If the context does not fully cover ' +
      "the question, say what you know and acknowledge the gap. " +
      `Keep your response under ${WORD_BUDGETS.chatGenerate} words.`,
    prompt: `Context:\n${ctxBlock}\n\nQuestion: ${state.question}`,
    maxOutputTokens: TOKEN_CAPS.chatGenerate,
  });

  const truncationNote = checkFinishReason(finishReason, 'chat.generate');
  const answer = truncationNote ? `${text}\n\n_${truncationNote}_` : text;

  return {
    answer,
    thoughts: [
      {
        node: 'generate' as const,
        tokens: usage?.totalTokens ?? 0,
        truncated: truncationNote !== null,
      },
    ],
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
    // Expose retrieved context texts so callers (e.g. the Ragas eval script)
    // can compute context_precision and context_recall without re-querying.
    contexts: (result.context as KnowledgeChunk[]).map((c) => c.text),
  };
}
