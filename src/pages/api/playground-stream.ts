import type { APIRoute } from 'astro';
import { runPlayground } from '../../lib/agent/playground-graph';

export const prerender = false;

/**
 * GET /api/playground-stream?query=...
 *
 * SSE endpoint streaming the playground agent's ReAct trace:
 *   - step      every thought / action / observation / answer
 *   - complete  fired once with toolsUsed + duration
 *   - error     fatal
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('query')?.trim();

  if (!query) {
    return new Response('query param is required', { status: 400 });
  }
  if (query.length > 500) {
    return new Response('query must be 500 characters or fewer', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const generator = runPlayground(query, request.headers);
        let result;
        while (true) {
          const { value, done } = await generator.next();
          if (done) {
            result = value;
            break;
          }
          send('step', value);
        }
        if (result) {
          send('complete', {
            toolsUsed: result.toolsUsed,
            durationMs: result.durationMs,
            stepCount: result.steps.length,
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
