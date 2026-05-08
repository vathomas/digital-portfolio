/**
 * In-memory store for completed research reports, keyed by reportId.
 *
 * The SSE route runs the agent and stashes the final ResearchReport here;
 * the PDF download route reads it back. Reports auto-expire after an hour
 * to keep memory bounded for the demo.
 *
 * Production would persist these to Postgres / object storage.
 */

import type { ResearchReport } from './research-graph';

const TTL_MS = 60 * 60 * 1000; // 1 hour

interface StoredReport {
  report: ResearchReport;
  expiresAt: number;
}

const store = new Map<string, StoredReport>();

export function saveReport(report: ResearchReport): void {
  store.set(report.id, { report, expiresAt: Date.now() + TTL_MS });
  pruneExpired();
}

export function getReport(id: string): ResearchReport | null {
  pruneExpired();
  return store.get(id)?.report ?? null;
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (entry.expiresAt < now) store.delete(id);
  }
}
