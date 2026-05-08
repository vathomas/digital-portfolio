import type { APIRoute } from 'astro';
import { askPortfolioAgent } from '../../lib/agent/graph';

export const prerender = false;

/**
 * POST /api/chat
 *
 * Body: { message: string }
 * Returns: { answer: string, thoughts: Thought[], attempts: number }
 *
 * Mock-mode for now — runs the LangGraph correction loop with the canned
 * corpus and a heuristic grader. Swap to streaming via Vercel AI SDK
 * `streamText` when real LLM keys are wired.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const { message } = (await request.json()) as { message?: string };
    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await askPortfolioAgent(message);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
