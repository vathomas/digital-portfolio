import type { APIRoute } from 'astro';
import { runCrew } from '../../lib/agent/crew-graph';
import type { Language } from '../../lib/agent/code-templates';

export const prerender = false;

/**
 * GET /api/crew-stream?prompt=...&language=python|typescript
 *
 * Streams the multi-agent crew's events as SSE:
 *   - state     {active, cycle}        — which agent is "holding the token"
 *   - thought   {agent, level, text}   — running narrative for the log
 *   - artifact  {kind, ...}            — structured outputs (reqs / code / review)
 *   - complete  {cycles, durationMs}   — fired once when the run finishes
 *   - error     {message}              — fatal error
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const prompt = url.searchParams.get('prompt')?.trim();
  const language = (url.searchParams.get('language') ?? 'typescript') as Language;

  if (!prompt) {
    return new Response('prompt query param is required', { status: 400 });
  }
  if (prompt.length > 500) {
    return new Response('prompt must be 500 characters or fewer', { status: 400 });
  }
  if (language !== 'python' && language !== 'typescript') {
    return new Response('language must be "python" or "typescript"', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const generator = runCrew(prompt, language);
        let result;

        while (true) {
          const { value, done } = await generator.next();
          if (done) {
            result = value;
            break;
          }
          send(value.type, value.payload);
        }

        if (result) {
          send('complete', {
            cycles: result.cycles,
            durationMs: result.durationMs,
            language: result.language,
            finalCode: result.finalCode,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        send('error', { message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
};
