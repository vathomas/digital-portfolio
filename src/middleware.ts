/**
 * Rate-limit middleware — defence-in-depth financial guardrail.
 *
 * Runs ahead of every request and intercepts /api/* traffic before the
 * expensive LLM/Tavily logic spins up. Uses Upstash Redis (REST API, edge-
 * compatible) for a globally-coherent sliding window so a bot can't bypass
 * limits by hopping Vercel regions.
 *
 * Layered defence:
 *   1. Per-endpoint sliding window — research and crew (expensive) get the
 *      tightest budgets; chat and playground (cheap, conversational) looser.
 *   2. Global burst window — 30 requests/minute across all /api/* keeps a
 *      single IP from spreading load across all four showcases to evade
 *      per-endpoint caps.
 *   3. Token caps inside each LLM call (see src/lib/agent/llm-caps.ts) cap
 *      worst-case cost PER CALL even when a request makes it through here.
 *
 * Failure mode: if Upstash is unreachable (timeout, 5xx, missing env), the
 * middleware FAILS OPEN — request proceeds. We'd rather degrade gracefully
 * than 500 the entire site during an Upstash outage. The failure is logged
 * with [rate-limit:fail-open] so it shows up loud in Vercel logs.
 *
 * CI bypass: Stage B (preview-eval.yml) fires ~54 requests per run (50
 * Ragas + 4 Playwright). To prevent CI from being rate-limited, the
 * middleware bypasses all checks when the request carries a valid
 * `x-vercel-protection-bypass` header. Real users don't have this header;
 * only the Vercel Deployment Protection bypass secret authorises it.
 *
 * Upstash quota: free tier = 10,000 commands/day. Each rate-limit check
 * uses ~2 commands (read + atomic increment). Two layered windows per
 * request = ~4 commands. 10,000 / 4 = 2,500 requests/day budget before
 * paying. Plenty for a portfolio.
 *
 * Privacy: the identifier is the user's IP, hashed for IPv6 to /64 so
 * NAT'd users on shared /64 ranges aren't keyed by their full address.
 * `analytics: true` sends IP-keyed counters to Upstash for the dashboard —
 * acceptable for a portfolio; flip to `false` if you want zero telemetry.
 */

import { defineMiddleware } from 'astro:middleware';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Constant-time string equality.
 * Naïve `a === b` short-circuits on the first mismatching byte, leaking
 * timing information about how many leading bytes matched. Used here to
 * compare the CI bypass header against the configured secret — the secret
 * is 32 bytes, and a timing oracle would otherwise let an attacker recover
 * it one byte at a time.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// ─────────────────────────────────────────────────────────────────────────
// Client construction is lazy so missing env vars fail open at request time
// (with a clear log) rather than crashing on module load.
// ─────────────────────────────────────────────────────────────────────────

type Limiter = { limit: (id: string) => Promise<{ success: boolean; reset: number; remaining: number; limit: number }> };

interface RateLimiters {
  research: Limiter;
  crew: Limiter;
  chat: Limiter;
  playground: Limiter;
  burst: Limiter;
}

let limitersPromise: Promise<RateLimiters | null> | null = null;

function getLimiters(): Promise<RateLimiters | null> {
  if (limitersPromise) return limitersPromise;
  limitersPromise = (async () => {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      console.warn('[rate-limit] UPSTASH env unset — middleware running in pass-through mode (no protection).');
      return null;
    }
    const redis = new Redis({ url, token });

    // Tier sizing matches the per-call worst-case cost from llm-caps.ts.
    // Research is the most expensive (~$0.057/call incl. Tavily) so gets
    // the tightest sliding window.
    const make = (limit: number, window: `${number} ${'s' | 'm' | 'h' | 'd'}`, prefix: string): Limiter =>
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, window),
        analytics: true,
        prefix,
      });

    return {
      research: make(3, '1 h', 'rl:research'),
      crew: make(5, '1 h', 'rl:crew'),
      chat: make(10, '10 m', 'rl:chat'),
      playground: make(10, '10 m', 'rl:playground'),
      burst: make(30, '1 m', 'rl:burst'),
    };
  })();
  return limitersPromise;
}

// ─────────────────────────────────────────────────────────────────────────
// Identifier extraction
//   Vercel sets `x-real-ip` (the client's real IP) and `x-forwarded-for`
//   (chain of proxies). We trust x-real-ip first because Vercel writes it
//   from the connection itself; x-forwarded-for can include user-supplied
//   values. Astro's `clientAddress` is the fallback for non-Vercel envs
//   (local dev).
//
//   IPv6 addresses are normalised to their /64 prefix to avoid over-blocking
//   NAT'd users on shared subnets and to reduce key cardinality.
// ─────────────────────────────────────────────────────────────────────────

/** Return a stable, privacy-conscious identifier for the requester. */
function identifierFor(request: Request, clientAddress: string | undefined): string {
  const realIp = request.headers.get('x-real-ip');
  const fwd = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = realIp ?? fwd ?? clientAddress ?? '127.0.0.1';

  // IPv6 → /64 prefix. Format: "2001:db8:1:2:3:4:5:6" → "2001:db8:1:2"
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return parts.slice(0, 4).join(':');
  }
  return ip;
}

// ─────────────────────────────────────────────────────────────────────────
// Route → tier mapping
// ─────────────────────────────────────────────────────────────────────────

type Tier = keyof Omit<RateLimiters, 'burst'>;

function tierFor(pathname: string): Tier | null {
  if (pathname.startsWith('/api/chat')) return 'chat';
  if (pathname.startsWith('/api/research-stream')) return 'research';
  if (pathname.startsWith('/api/crew-stream')) return 'crew';
  if (pathname.startsWith('/api/playground-stream')) return 'playground';
  // research-pdf is a Blob fetch with no LLM cost; protected by burst window only.
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// 429 response shape
//   - JSON body so frontend can parse retry guidance.
//   - `Retry-After` (seconds) for HTTP-standard clients.
//   - `X-RateLimit-*` headers for advanced clients (also standardised by
//     IETF draft draft-ietf-httpapi-ratelimit-headers).
// ─────────────────────────────────────────────────────────────────────────

function tooManyRequests(opts: {
  tier: string;
  limit: number;
  remaining: number;
  reset: number; // epoch ms
}): Response {
  const retryAfterSec = Math.max(1, Math.ceil((opts.reset - Date.now()) / 1000));
  const body = JSON.stringify({
    error: 'rate_limit_exceeded',
    tier: opts.tier,
    message: `Rate limit reached for ${opts.tier} — try again in ${retryAfterSec}s.`,
    retryAfterSec,
  });
  return new Response(body, {
    status: 429,
    headers: {
      'content-type': 'application/json',
      'retry-after': String(retryAfterSec),
      'x-ratelimit-limit': String(opts.limit),
      'x-ratelimit-remaining': String(opts.remaining),
      'x-ratelimit-reset': String(Math.ceil(opts.reset / 1000)),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  // Only gate API routes. Static pages, sitemap, assets pass through.
  if (!url.pathname.startsWith('/api/')) return next();

  // CI bypass — Stage B Ragas + Playwright sends this header. On Preview
  // URLs, Vercel's auth wall has already verified the secret before the
  // request reaches us. On the PRODUCTION URL there is no auth wall, so
  // we must validate the header value ourselves (timing-safe compare)
  // before honouring the bypass — otherwise any client could send a
  // garbage header value and skip rate limiting.
  const bypassHeader = context.request.headers.get('x-vercel-protection-bypass');
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypassHeader && bypassSecret && constantTimeEqual(bypassHeader, bypassSecret)) {
    return next();
  }

  const limiters = await getLimiters();
  if (!limiters) return next(); // Fail-open when Upstash unconfigured.

  const id = identifierFor(context.request, context.clientAddress);

  try {
    // Layer 1 — global burst window. Catches scrapers fanning out across
    // multiple endpoints.
    const burst = await limiters.burst.limit(id);
    if (!burst.success) {
      return tooManyRequests({
        tier: 'burst',
        limit: burst.limit,
        remaining: burst.remaining,
        reset: burst.reset,
      });
    }

    // Layer 2 — per-endpoint window.
    const tier = tierFor(url.pathname);
    if (tier) {
      const result = await limiters[tier].limit(id);
      if (!result.success) {
        return tooManyRequests({
          tier,
          limit: result.limit,
          remaining: result.remaining,
          reset: result.reset,
        });
      }
    }
  } catch (err) {
    // Upstash hiccup — fail OPEN rather than 500 the entire site. Logged
    // loudly so anomalies show up in Vercel logs.
    console.warn('[rate-limit:fail-open]', {
      pathname: url.pathname,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return next();
});
