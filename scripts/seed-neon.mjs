#!/usr/bin/env node
/**
 * Seed script: populate Neon pgvector with portfolio corpus.
 *
 * Usage: node scripts/seed-neon.mjs
 * (DATABASE_URL is loaded from .env automatically)
 */

import pg from 'pg';
import 'dotenv/config';
import { CORPUS } from '../src/lib/agent/knowledge.ts';

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set. Add it to .env and try again.');
  process.exit(1);
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    statement_timeout: 60000,
    connect_timeout: 10000,
  });

  try {
    console.log('Connecting to Neon...');
    await client.connect();
    console.log('✓ Connected to Neon\n');

    // Clear old data
    console.log('Clearing old chunks...');
    await client.query('DELETE FROM portfolio_chunks');
    console.log('✓ Cleared\n');

    // Use placeholder embeddings (zero vectors) for mock mode
    const embedding = JSON.stringify(new Array(1536).fill(0));

    // Batch insert all chunks in one statement (safer, faster)
    console.log(`Inserting ${CORPUS.length} chunks in batch...`);

    const values = CORPUS.map((chunk, i) => {
      const paramBase = i * 5;
      return `($${paramBase + 1}, $${paramBase + 2}, $${paramBase + 3}, $${paramBase + 4}, $${paramBase + 5}::vector)`;
    }).join(',');

    const flatParams = CORPUS.flatMap(chunk => [
      chunk.id,
      chunk.source,
      chunk.topic,
      chunk.text,
      embedding,
    ]);

    const query = `
      INSERT INTO portfolio_chunks (id, source, topic, text, embedding)
      VALUES ${values}
      ON CONFLICT (id) DO NOTHING
    `;

    const result = await client.query(query, flatParams);
    console.log(`✓ Inserted ${result.rowCount} chunks\n`);

    // Verify
    const countResult = await client.query('SELECT COUNT(*) as count FROM portfolio_chunks');
    const count = parseInt(countResult.rows[0].count);
    console.log(`✓ Total chunks in DB: ${count}`);

    if (count === CORPUS.length) {
      console.log('\n✅ Seed complete! Ready to use real pgvector queries.');
    } else {
      console.warn(`\n⚠️  Warning: Expected ${CORPUS.length} chunks, got ${count}`);
    }
  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\nConnection closed.');
  }
}

main();
