/**
 * Lazy Postgres pool for serverless environments.
 *
 * On Vercel, each invocation reuses module-scope state where possible, so a
 * lazy-initialised Pool keeps connection setup off the cold-start path while
 * still letting warm invocations share the pool. Use Neon's *pooled* (pgBouncer)
 * connection string in production so we don't exhaust the database's direct
 * connection limit under serverless burst load.
 *
 * Anything that imports this module must tolerate `DATABASE_URL` being unset —
 * call `hasDatabase()` first and use the in-process fallbacks elsewhere
 * (e.g. `mockRetrieve` in `agent/knowledge.ts`).
 */

import { Pool, type PoolConfig } from 'pg';

let pool: Pool | null = null;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — cannot open pg pool');
  }

  const config: PoolConfig = {
    connectionString,
    // Neon's certificates are signed by public CAs (Let's Encrypt / DigiCert)
    // that Node's bundled root store trusts. We validate the chain — the only
    // reason to override would be a self-signed deployment, in which case the
    // operator can opt out explicitly via PGSSL_REJECT_UNAUTHORIZED=false.
    ssl: {
      rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false',
    },
    // Serverless functions are short-lived; keep the pool small so we don't
    // exceed Neon's per-function connection allowance during a burst.
    max: 3,
    idleTimeoutMillis: 10_000,
  };

  pool = new Pool(config);
  return pool;
}
