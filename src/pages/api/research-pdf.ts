import type { APIRoute } from 'astro';
import { getReport } from '../../lib/agent/research-store';
import { buildReportPdf } from '../../lib/agent/pdf-builder';

export const prerender = false;

/**
 * GET /api/research-pdf?id=...
 *
 * Returns the generated PDF for a previously-completed report.
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id')?.trim();

  if (!id) {
    return new Response('id query param is required', { status: 400 });
  }

  const report = getReport(id);
  if (!report) {
    return new Response('Report not found or expired', { status: 404 });
  }

  const pdfBytes = await buildReportPdf(report);
  const filename = sanitizeFilename(`research_${report.topic}_${report.id.slice(0, 8)}.pdf`);

  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-cache',
    },
  });
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.-]+/g, '_').slice(0, 120);
}
