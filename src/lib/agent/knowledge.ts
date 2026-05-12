/**
 * Knowledge corpus and retrieval for the Recursive Portfolio Chatbot.
 *
 * Real mode: `retrieve()` runs a pgvector cosine-similarity search against
 * the `corpus_chunks` table seeded by `scripts/seed-corpus.ts`. Embeddings
 * are produced with OpenAI text-embedding-3-small (1536 dims).
 *
 * Mock mode (no DATABASE_URL or no OPENAI_API_KEY): `mockRetrieve()` does a
 * keyword-overlap fallback over the in-memory CORPUS so `npm run dev` still
 * answers plausibly without provisioning Neon.
 *
 * Sources: CV V1 (relocating Adelaide, June 2026) + Repo Analysis writeup.
 */

export interface KnowledgeChunk {
  id: string;
  source: 'cv' | 'repo' | 'github';
  topic: string;
  text: string;
}

export const CORPUS: KnowledgeChunk[] = [
  {
    id: 'cv-summary',
    source: 'cv',
    topic: 'profile summary',
    text:
      'Thomas Abraham is a Full-Stack Product Engineer with 10+ years of experience across the UK, ' +
      'New Zealand, and India. NZ Citizen with Australian work rights, currently in London and ' +
      'relocating to Adelaide, SA in June 2026. Specialises in React, TypeScript, C#, .NET, Azure, ' +
      'and Agentic AI systems.',
  },
  {
    id: 'cv-boe',
    source: 'cv',
    topic: 'Bank of England role',
    text:
      'At the Bank of England (July 2023 – Present), Thomas builds full-stack production systems ' +
      'in React/Redux/TypeScript and C#/.NET/MS SQL. Pioneered AI-augmented engineering workflows ' +
      'using GitHub Copilot, Claude, and GPT-5. Acts as Scrum Master and Release Champion in Azure ' +
      'DevOps. E2E testing with Cypress; unit testing with Jest, NUnit, and xUnit.',
  },
  {
    id: 'cv-rbnz',
    source: 'cv',
    topic: 'Reserve Bank of New Zealand role',
    text:
      'At RBNZ (June 2021 – February 2023), Thomas built Azure Functions for file processing, ' +
      'calendar automation, and notifications. Designed DevOps pipelines with Bicep IaC, TeamCity, ' +
      'and Octopus Deploy. Integrated Refinitiv Real-Time Optimised market data and led the ' +
      '.NET 4.6 → 4.8 upgrade.',
  },
  {
    id: 'cv-glassbox',
    source: 'cv',
    topic: 'Glassbox role',
    text:
      'At Glassbox Limited NZ (2015 – 2021), Thomas built retail petroleum management modules in ' +
      'Angular/TypeScript/ASP.NET Web API. Led the migration of the fuel reconciliation module ' +
      'from Silverlight to Angular 6. Built a cross-platform mobile app with NativeScript, Angular 4, ' +
      'and .NET Core. Rewrote the core accounts module to support a 5× increase in account capacity.',
  },
  {
    id: 'cv-certs',
    source: 'cv',
    topic: 'certifications',
    text:
      'Certifications: DeepLearning.AI Agentic AI; Generative AI for Software Development ' +
      '(3-course professional cert); AI-Powered Software & System Design; Team Software Engineering ' +
      'with AI; IBM Build RAG Applications; IBM Develop Generative AI Applications; ' +
      'Microsoft Certified Azure Fundamentals (AZ-900).',
  },
  {
    id: 'repo-market-research',
    source: 'repo',
    topic: 'market-research-agentic-team project',
    text:
      'vathomas/market-research-agentic-team is a multi-agent system using LangGraph: a Researcher ' +
      'agent calls Tavily web search, a Writer agent drafts the report, and a Critic agent runs a ' +
      'reflection loop that sends the draft back for revision until quality criteria are met. ' +
      'Built with GPT-4o, LangGraph state graph, Tavily API, and Python. Demonstrates planner-' +
      'executor patterns and self-correction.',
  },
  {
    id: 'repo-customer-service',
    source: 'repo',
    topic: 'customer-service-agent project',
    text:
      'vathomas/customer-service-agent is a tool-using agent backed by DuckDB. It uses two LLMs — ' +
      'one for tool selection and one for response synthesis — coordinated through a structured tool ' +
      'registry. Includes assertion-based guardrails that validate tool outputs before returning ' +
      'them to the user. Demonstrates ReAct-style reasoning with provable safety checks.',
  },
  {
    id: 'cv-stack',
    source: 'cv',
    topic: 'tech stack',
    text:
      'Frontend: React, TypeScript, Redux, Angular, NativeScript. Backend: C#, .NET, ASP.NET Web ' +
      'API, Node.js. Cloud: Azure, Azure Functions, Bicep, Azure DevOps. AI: LangGraph, RAG, ' +
      'pgvector, Claude, GPT-5, GitHub Copilot. Data: MS SQL, Entity Framework, pgvector, MySQL.',
  },
  {
    id: 'cv-contact',
    source: 'cv',
    topic: 'contact and links',
    text:
      'Contact: ta.abraham@outlook.com. LinkedIn: linkedin.com/in/tvabraham. ' +
      'GitHub: github.com/vathomas. Phone (NZ): +64 22 086 3258. ' +
      'Currently in London, UK; relocating to Adelaide, SA in June 2026.',
  },
];

/**
 * Real retriever — embed the query with OpenAI, then cosine-similarity search
 * against the seeded `corpus_chunks` table. Returns top-k chunks ordered most
 * similar first. Throws if the database or embedding provider is misconfigured;
 * `retrieve()` wraps this with the mock fallback.
 *
 * The embedding is sent as a text literal cast to `vector` rather than a
 * parameterised array — pgvector accepts the `[0.1,0.2,...]` text format and
 * this avoids needing a custom node-postgres type registration. The whole
 * vector goes through as a parameter, so this is not concatenated SQL.
 */
/** Defensive cap on per-call embedding input size (chars, not tokens). */
const EMBED_INPUT_MAX = 4000;

export async function pgvectorRetrieve(query: string, k = 3): Promise<KnowledgeChunk[]> {
  const { embed } = await import('ai');
  const { openai, EMBED_MODEL } = await import('./llm');
  const { getPool } = await import('../db');

  // Defence in depth: even though the API route caps message length, this
  // function is exported and a future caller may forget the limit. Truncate
  // here to bound the OpenAI bill and the embedding latency.
  let input = query;
  if (input.length > EMBED_INPUT_MAX) {
    console.warn('[knowledge] truncating embedding input', {
      from: input.length,
      to: EMBED_INPUT_MAX,
    });
    input = input.slice(0, EMBED_INPUT_MAX);
  }

  const { embedding } = await embed({
    model: openai.embedding(EMBED_MODEL),
    value: input,
  });

  // Defence in depth: refuse to round-trip non-finite values to Postgres.
  // pgvector would reject them with a confusing error; failing fast here is
  // cleaner and removes any chance that a future provider regression leaks
  // unsanitised content into the SQL literal.
  if (!Array.isArray(embedding) || !embedding.every(Number.isFinite)) {
    throw new Error('embedding contained non-finite values');
  }

  const embedLiteral = `[${embedding.join(',')}]`;
  const pool = getPool();
  const { rows } = await pool.query<KnowledgeChunk>(
    `SELECT id, source, topic, text
       FROM corpus_chunks
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
    [embedLiteral, k],
  );
  return rows;
}

/**
 * Unified retrieval entrypoint. Uses pgvector when both DATABASE_URL and
 * OPENAI_API_KEY are set; otherwise falls back to keyword overlap so local
 * dev and unconfigured deploys still produce reasonable answers.
 *
 * Self-healing: if pgvector returns zero rows (e.g. the corpus_chunks table
 * exists but was never seeded — a common operational gap), fall back to the
 * in-memory keyword retriever instead of returning an empty context. The
 * graph's generate node treats empty context as "I don't know", so without
 * this fallback an unseeded production DB makes every answer a canned miss.
 */
export async function retrieve(query: string, k = 3): Promise<KnowledgeChunk[]> {
  if (process.env.DATABASE_URL && process.env.OPENAI_API_KEY) {
    try {
      const rows = await pgvectorRetrieve(query, k);
      if (rows.length === 0) {
        console.warn('[knowledge] pgvector returned 0 rows — falling back to mock. ' +
          'The corpus_chunks table is likely unseeded; run `npm run seed`.');
        return mockRetrieve(query, k);
      }
      return rows;
    } catch (err) {
      console.error('[knowledge] pgvector retrieve failed, falling back to mock', {
        message: err instanceof Error ? err.message : String(err),
      });
      return mockRetrieve(query, k);
    }
  }
  return mockRetrieve(query, k);
}

/**
 * Mock retriever — keyword overlap stand-in for cosine similarity over pgvector.
 * Used when DATABASE_URL or OPENAI_API_KEY is missing, and as the fallback
 * path when pgvectorRetrieve throws at runtime.
 */
export function mockRetrieve(query: string, k = 3): KnowledgeChunk[] {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);

  const scored = CORPUS.map((chunk) => {
    const haystack = `${chunk.topic} ${chunk.text}`.toLowerCase();
    const score = terms.reduce((acc, t) => (haystack.includes(t) ? acc + 1 : acc), 0);
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, k).filter((s) => s.score > 0);
  // Fall back to summary if nothing matches — graph will detect this and rewrite
  return top.length > 0 ? top.map((s) => s.chunk) : [];
}
