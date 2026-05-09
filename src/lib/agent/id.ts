/**
 * Strict format validator for report IDs.
 *
 * IDs flow from query strings into Vercel Blob paths and fetch URLs, so they
 * must be tightly constrained — anything else is a path-traversal vector.
 * Allow only URL-safe alphanumerics + `-` and `_` (the nanoid / UUID alphabet),
 * length 8–64. Adjust the upper bound only if a downstream generator changes.
 */
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function isValidReportId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id);
}
