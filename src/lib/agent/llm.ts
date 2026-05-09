/**
 * Shared LLM provider instances and model aliases.
 *
 * `astro.config.mjs` calls `configDotenv({ override: true })` at startup,
 * which sets the correct values in `process.env` even if those variables
 * were previously empty in the shell environment.
 *
 * Note: @ai-sdk/anthropic v3 defaults to https://api.anthropic.com/messages
 * (missing the /v1 path). We explicitly set the correct baseURL.
 *
 * Claude 4 model IDs — Claude 3 models are deprecated as of 2026.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com/v1',
});

/** Claude Sonnet 4.5 — high quality generation, code writing, synthesis */
export const CLAUDE_QUALITY = 'claude-sonnet-4-5-20250929' as const;

/** Claude Haiku 4.5 — fast, cheap; grading, planning, reviewing */
export const CLAUDE_FAST = 'claude-haiku-4-5-20251001' as const;

/**
 * OpenAI provider — used only for embeddings (text-embedding-3-small).
 * Generation across all four showcases is Anthropic. We pull in OpenAI here
 * because Anthropic does not yet expose a public embeddings endpoint.
 */
export const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Embeddings: 1536 dims, $0.02 / 1M tokens, plenty for portfolio-sized corpora. */
export const EMBED_MODEL = 'text-embedding-3-small' as const;
export const EMBED_DIMS = 1536 as const;
