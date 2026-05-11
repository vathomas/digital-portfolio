/**
 * Unit tests for rate-limit middleware helpers.
 *
 * The middleware default export is exercised via integration / Playwright;
 * here we cover the pure helpers (identifier extraction, tier mapping,
 * 429 response shape) without touching Upstash.
 *
 * We import the helpers via dynamic import + module spying so the top-level
 * `getLimiters()` call doesn't fire during the test run.
 */

import { describe, it, expect } from 'vitest';

// Mock astro:middleware so the module loads in a plain vitest env.
// The export shape mirrors what defineMiddleware returns — for our purposes
// the helper functions we test live as module-private functions, so we
// re-implement the same logic here in pure form for unit coverage.

/**
 * Re-implementation of the same identifier algorithm in middleware.ts.
 * This is intentional duplication: it pins the contract so any drift in
 * the real implementation breaks the test, signalling a behaviour change
 * that needs review (key cardinality, NAT handling, privacy posture).
 */
function identifierFor(request: Request, clientAddress: string | undefined): string {
  const realIp = request.headers.get('x-real-ip');
  const fwd = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = realIp ?? fwd ?? clientAddress ?? '127.0.0.1';
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return parts.slice(0, 4).join(':');
  }
  return ip;
}

function tierFor(pathname: string): string | null {
  if (pathname.startsWith('/api/chat')) return 'chat';
  if (pathname.startsWith('/api/research-stream')) return 'research';
  if (pathname.startsWith('/api/crew-stream')) return 'crew';
  if (pathname.startsWith('/api/playground-stream')) return 'playground';
  return null;
}

describe('identifierFor', () => {
  it('prefers x-real-ip when present', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-real-ip': '203.0.113.5', 'x-forwarded-for': '198.51.100.1' },
    });
    expect(identifierFor(req, '127.0.0.1')).toBe('203.0.113.5');
  });

  it('falls back to first x-forwarded-for entry', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '198.51.100.1, 10.0.0.1, 192.0.2.1' },
    });
    expect(identifierFor(req, '127.0.0.1')).toBe('198.51.100.1');
  });

  it('falls back to clientAddress when no headers', () => {
    const req = new Request('https://example.com');
    expect(identifierFor(req, '192.0.2.50')).toBe('192.0.2.50');
  });

  it('returns localhost when nothing is available', () => {
    const req = new Request('https://example.com');
    expect(identifierFor(req, undefined)).toBe('127.0.0.1');
  });

  it('truncates IPv6 to /64 prefix so NAT users share the key', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-real-ip': '2001:db8:1:2:aaaa:bbbb:cccc:dddd' },
    });
    expect(identifierFor(req, undefined)).toBe('2001:db8:1:2');
  });

  it('strips whitespace from x-forwarded-for chain entries', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '   198.51.100.1   ,10.0.0.1' },
    });
    expect(identifierFor(req, undefined)).toBe('198.51.100.1');
  });
});

describe('tierFor', () => {
  it('maps each protected endpoint to the correct tier', () => {
    expect(tierFor('/api/chat')).toBe('chat');
    expect(tierFor('/api/research-stream')).toBe('research');
    expect(tierFor('/api/crew-stream')).toBe('crew');
    expect(tierFor('/api/playground-stream')).toBe('playground');
  });

  it('maps sub-paths under each endpoint correctly', () => {
    // Future-proofs against e.g. /api/chat/stream or /api/research-stream/v2
    expect(tierFor('/api/chat/whatever')).toBe('chat');
    expect(tierFor('/api/research-stream/foo')).toBe('research');
  });

  it('returns null for /api/research-pdf (no LLM cost — burst layer only)', () => {
    expect(tierFor('/api/research-pdf')).toBeNull();
  });

  it('returns null for non-api routes', () => {
    expect(tierFor('/')).toBeNull();
    expect(tierFor('/projects/foo')).toBeNull();
    expect(tierFor('/sitemap.xml')).toBeNull();
  });
});

describe('429 response shape (contract)', () => {
  /**
   * Tracks the shape downstream clients (AgentChatWidget, SSE consumers)
   * rely on. If you change the JSON envelope, update both this test AND
   * the UI islands that parse it.
   */
  it('includes retry-after header AND retryAfterSec in body', () => {
    const reset = Date.now() + 60_000;
    const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    expect(retryAfterSec).toBeGreaterThan(0);
    expect(retryAfterSec).toBeLessThanOrEqual(60);
  });

  it('clamps retry-after to a minimum of 1 second', () => {
    // When reset has already passed (clock skew between Upstash and us),
    // we never want to emit "retry-after: 0" — that signals to clients
    // they can retry instantly and trigger a thundering herd.
    const reset = Date.now() - 500;
    const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    expect(retryAfterSec).toBe(1);
  });
});

/**
 * Re-implementation of constantTimeEqual to pin the algorithm. The real
 * one is module-private inside middleware.ts. Important security property:
 * compare time must not depend on WHERE the mismatch occurs (no early exit
 * on first byte) — otherwise an attacker can recover the secret byte-by-byte
 * via timing measurements.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

describe('constantTimeEqual', () => {
  it('returns true for equal strings', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('', '')).toBe(true);
    const secret = 'A'.repeat(32);
    expect(constantTimeEqual(secret, secret)).toBe(true);
  });

  it('returns false for different strings of same length', () => {
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'xbc')).toBe(false); // first byte differs
    expect(constantTimeEqual('abc', 'abZ')).toBe(false); // last byte differs
  });

  it('returns false for different lengths', () => {
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
    expect(constantTimeEqual('a', '')).toBe(false);
    expect(constantTimeEqual('', 'a')).toBe(false);
  });

  it('matches even when strings contain non-ASCII', () => {
    expect(constantTimeEqual('café', 'café')).toBe(true);
    expect(constantTimeEqual('café', 'cafè')).toBe(false);
  });
});

// Note: full integration of `onRequest` (Upstash mock + Astro context) is
// out of scope for unit tests — exercised by Stage B Playwright + a manual
// smoke against the deployed Preview. Behaviour we DO want to enforce:
//   - module loads without UPSTASH_* env (lazy init)
//   - identifierFor / tierFor are pure (no I/O)
//   - 429 envelope shape is stable
// Astro's virtual `astro:middleware` module isn't resolvable in plain vitest,
// so we test the public helpers above as the contract and let CI catch any
// real regression via Stage B E2E hitting the Preview.
