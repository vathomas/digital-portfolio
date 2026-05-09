import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CORPUS, mockRetrieve, retrieve } from './knowledge';

describe('CORPUS', () => {
  it('has at least 8 chunks (CV + repos + contact)', () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(8);
  });

  it('every chunk has a unique id', () => {
    const ids = CORPUS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every chunk declares a known source bucket', () => {
    const knownSources = new Set(['cv', 'repo', 'github']);
    for (const chunk of CORPUS) {
      expect(knownSources.has(chunk.source)).toBe(true);
    }
  });
});

describe('mockRetrieve', () => {
  it('finds the Bank of England chunk for a BoE query', () => {
    const hits = mockRetrieve('What did Thomas do at the Bank of England?');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.id).toBe('cv-boe');
  });

  it('returns at most k chunks', () => {
    const hits = mockRetrieve('thomas tech stack', 2);
    expect(hits.length).toBeLessThanOrEqual(2);
  });

  it('returns an empty array when no terms match', () => {
    const hits = mockRetrieve('quantum cryptography neutrino oscillation');
    expect(hits).toEqual([]);
  });
});

describe('retrieve (router)', () => {
  // Snapshot env to restore after each test — these tests mutate it.
  let originalDb: string | undefined;
  let originalKey: string | undefined;

  beforeEach(() => {
    originalDb = process.env.DATABASE_URL;
    originalKey = process.env.OPENAI_API_KEY;
    delete process.env.DATABASE_URL;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (originalDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDb;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  });

  it('falls back to mockRetrieve when DATABASE_URL is unset', async () => {
    const hits = await retrieve('Bank of England', 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.id).toBe('cv-boe');
  });

  it('still falls back when OPENAI_API_KEY is missing even with a DB url', async () => {
    process.env.DATABASE_URL = 'postgres://nowhere';
    // No OPENAI_API_KEY → router stays on mockRetrieve, never opens a pool
    const hits = await retrieve('certifications', 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.id).toBe('cv-certs');
  });
});
