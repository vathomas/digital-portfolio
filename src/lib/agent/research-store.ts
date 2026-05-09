/**
 * Persistent store for completed research reports, keyed by reportId.
 *
 * The SSE route runs the agent and stashes the final ResearchReport here;
 * the PDF download route reads it back. On Vercel each request runs in a
 * fresh container, so an in-memory Map would lose the report between the
 * SSE invocation and the PDF download. We use Vercel Blob instead.
 *
 * URL discovery uses `head()` from @vercel/blob (authenticated via
 * BLOB_READ_WRITE_TOKEN) — that avoids hand-constructing URLs from a
 * separate BLOB_HOSTNAME env var and works identically for public or
 * private blobs (a future flip to access:'private' is a one-line change).
 *
 * Local development: if BLOB_READ_WRITE_TOKEN is missing, falls back to a
 * module-scoped Map so `npm run dev` still works without provisioning Blob.
 *
 * Defence-in-depth: blobPath() refuses any id that doesn't match the
 * canonical format, so even a future caller that forgets to validate at
 * the route boundary cannot path-traverse out of the reports/ prefix.
 */

import { put, head } from '@vercel/blob';
import type { ResearchReport } from './research-graph';
import { isValidReportId } from './id';

const BLOB_PREFIX = 'reports/';

const memoryFallback = new Map<string, ResearchReport>();
const TTL_MS = 60 * 60 * 1000; // 1 hour, only used by the in-memory fallback
const expiries = new Map<string, number>();

function hasBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function blobPath(id: string): string {
  if (!isValidReportId(id)) throw new Error('invalid report id');
  return `${BLOB_PREFIX}${id}.json`;
}

export async function saveReport(report: ResearchReport): Promise<void> {
  if (hasBlob()) {
    await put(blobPath(report.id), JSON.stringify(report), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }

  // Dev / unconfigured: use in-memory Map with TTL.
  memoryFallback.set(report.id, report);
  expiries.set(report.id, Date.now() + TTL_MS);
  pruneExpired();
}

export async function getReport(id: string): Promise<ResearchReport | null> {
  if (!isValidReportId(id)) return null;

  if (hasBlob()) {
    try {
      // head() looks up the blob by pathname using the token; returns the
      // canonical URL (and 404s cleanly if the blob doesn't exist).
      const meta = await head(blobPath(id));
      const res = await fetch(meta.url, { cache: 'no-store' });
      if (!res.ok) {
        console.error('[research-store] blob fetch failed', { id, status: res.status });
        return null;
      }
      return (await res.json()) as ResearchReport;
    } catch (err) {
      // head() throws BlobNotFoundError for missing blobs — that's not an
      // error worth logging at the same volume as a real failure, but the
      // SDK doesn't export the discriminator type cleanly, so log everything
      // and let it be filtered downstream.
      console.error('[research-store] getReport error', {
        id,
        message: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  pruneExpired();
  return memoryFallback.get(id) ?? null;
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [id, exp] of expiries) {
    if (exp < now) {
      expiries.delete(id);
      memoryFallback.delete(id);
    }
  }
}
