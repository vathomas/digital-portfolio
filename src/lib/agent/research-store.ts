/**
 * Persistent store for completed research reports, keyed by reportId.
 *
 * The SSE route runs the agent and stashes the final ResearchReport here;
 * the PDF download route reads it back. On Vercel each request runs in a
 * fresh container, so an in-memory Map would lose the report between the
 * SSE invocation and the PDF download. We use Vercel Blob instead — both
 * routes read from the same blob URL, derived from the report id.
 *
 * Local development: if BLOB_READ_WRITE_TOKEN is missing, falls back to a
 * module-scoped Map so `npm run dev` still works without provisioning Blob.
 */

import { put } from '@vercel/blob';
import type { ResearchReport } from './research-graph';

const BLOB_PREFIX = 'reports/';

const memoryFallback = new Map<string, ResearchReport>();
const TTL_MS = 60 * 60 * 1000; // 1 hour, only used by the in-memory fallback
const expiries = new Map<string, number>();

function hasBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function blobPath(id: string): string {
  return `${BLOB_PREFIX}${id}.json`;
}

function blobUrl(id: string): string | null {
  const host = process.env.BLOB_HOSTNAME;
  if (!host) return null;
  return `https://${host}/${blobPath(id)}`;
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
  if (hasBlob()) {
    const url = blobUrl(id);
    if (!url) return null;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      return (await res.json()) as ResearchReport;
    } catch {
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
