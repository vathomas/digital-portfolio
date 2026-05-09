import type { APIRoute } from 'astro';
import { runResearch } from '../../lib/agent/research-graph';
import { saveReport } from '../../lib/agent/research-store';
import { isValidReportId } from '../../lib/agent/id';

export const prerender = false;

/**
 * GET /api/research-stream?topic=...&id=...
 *
 * Server-Sent Events endpoint. Streams the agent's thought events to the
 * browser as the plan-and-execute pipeline runs, then emits a final
 * `complete` event with the reportId once the report is ready for PDF
 * download.
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const topic = url.searchParams.get('topic')?.trim();
  const id = url.searchParams.get('id')?.trim();

  if (!topic || !id) {
    return new Response('topic and id query params are required', { status: 400 });
  }
  if (topic.length > 500) {
    return new Response('topic must be 500 characters or fewer', { status: 400 });
  }
  if (!isValidReportId(id)) {
    return new Response('id must match [A-Za-z0-9_-]{8,64}', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      try {
        const generator = runResearch(topic, id);
        let result;

        while (true) {
          const { value, done } = await generator.next();
          if (done) {
            result = value;
            break;
          }
          send('thought', value);
        }

        if (result) {
          await saveReport(result);
          send('complete', {
            id: result.id,
            cost: result.cost,
            durationMs: result.durationMs,
            sourcesCount: result.sources.length,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        send('error', { message: msg });
      } finally {
        controller.close();
      }
    },
    cancel() {
      // Client disconnected — nothing to clean up in mock mode
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering if proxied
    },
  });
};
