/**
 * Idempotent seed script: applies the pgvector schema and embeds every
 * chunk in the in-memory CORPUS into the `corpus_chunks` table.
 *
 * Run after provisioning Neon + setting DATABASE_URL + OPENAI_API_KEY:
 *
 *   npm run seed
 *
 * Re-running is safe: schema DDL uses IF NOT EXISTS, the upsert uses
 * ON CONFLICT (id) DO UPDATE so new corpus content / re-embeddings just
 * overwrite the existing rows.
 */

import { configDotenv } from 'dotenv';
configDotenv({ override: true });

import { embed } from 'ai';
import { Pool } from 'pg';
import { CORPUS } from '../src/lib/agent/knowledge';
import { openai, EMBED_MODEL, EMBED_DIMS } from '../src/lib/agent/llm';

const SCHEMA_DDL = `
  CREATE EXTENSION IF NOT EXISTS vector;

  CREATE TABLE IF NOT EXISTS corpus_chunks (
    id        text PRIMARY KEY,
    source    text NOT NULL,
    topic     text NOT NULL,
    text      text NOT NULL,
    embedding vector(${EMBED_DIMS}) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS corpus_chunks_embedding_idx
    ON corpus_chunks
    USING hnsw (embedding vector_cosine_ops);
`;

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required to seed the corpus');
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for text-embedding-3-small');
  }

  const pool = new Pool({
    connectionString: url,
    // Validate Neon's TLS chain against the system CA bundle. Operators using
    // a self-signed deployment can opt out via PGSSL_REJECT_UNAUTHORIZED=false.
    ssl: {
      rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false',
    },
  });

  try {
    console.log('[seed] applying schema (idempotent)...');
    await pool.query(SCHEMA_DDL);

    console.log(`[seed] embedding ${CORPUS.length} chunks via ${EMBED_MODEL}...`);
    for (const chunk of CORPUS) {
      const { embedding } = await embed({
        model: openai.embedding(EMBED_MODEL),
        // Embed topic + text together — topics carry signal that pure body text
        // doesn't (e.g. "Bank of England role" anchors retrieval for queries
        // about the BoE that don't mention every term in the chunk body).
        value: `${chunk.topic}\n\n${chunk.text}`,
      });

      const embedLiteral = `[${embedding.join(',')}]`;
      await pool.query(
        `INSERT INTO corpus_chunks (id, source, topic, text, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)
         ON CONFLICT (id) DO UPDATE
           SET source = EXCLUDED.source,
               topic = EXCLUDED.topic,
               text = EXCLUDED.text,
               embedding = EXCLUDED.embedding,
               updated_at = now()`,
        [chunk.id, chunk.source, chunk.topic, chunk.text, embedLiteral],
      );
      console.log(`[seed]   ✓ ${chunk.id}`);
    }

    const { rows } = await pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM corpus_chunks',
    );
    console.log(`[seed] done. ${rows[0]?.count ?? '?'} chunks indexed.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
