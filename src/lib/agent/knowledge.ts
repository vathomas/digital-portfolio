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
  /* ─────────────────────────── Identity & overview ─────────────────────────── */
  {
    id: 'cv-summary',
    source: 'cv',
    topic: 'profile summary',
    text:
      'Thomas Abraham is a Full-Stack Product Engineer with 10+ years of experience delivering ' +
      'scalable web and mobile applications across the UK, New Zealand, and India, including ' +
      "mission-critical systems for central banks. He specialises in React, TypeScript, C#, .NET, " +
      'Azure, and Agentic AI systems, and is proficient in AI-augmented development using ' +
      'GitHub Copilot with Claude, GPT, and Grok.',
  },
  {
    id: 'cv-location-relocation',
    source: 'cv',
    topic: 'location and relocation to Adelaide',
    text:
      'Thomas is currently based in London, UK. He is a New Zealand citizen, which gives him full ' +
      'Australian work rights, and he is relocating to Adelaide, South Australia in June 2026.',
  },
  {
    id: 'cv-experience-span',
    source: 'cv',
    topic: 'years of experience and career span',
    text:
      'Thomas has 10+ years of professional experience as a Full-Stack Product Engineer, with ' +
      'roles spanning the UK, New Zealand, and India from 2013 to the present.',
  },

  /* ─────────────────────────── Bank of England (current) ─────────────────────────── */
  {
    id: 'cv-boe',
    source: 'cv',
    topic: 'Bank of England role',
    text:
      'Thomas currently works at the Bank of England in London as a Product Engineer (July 2023 ' +
      '– Present). He develops and maintains full-stack production systems using React, Redux, and ' +
      'TypeScript on the frontend, and C#, .NET, and MS SQL on the backend. He uses GitHub Copilot ' +
      'in agentic mode with Claude, GPT, and Grok for AI-augmented development, acts as Scrum ' +
      'Master and Release Champion on a rotating basis, and mentors junior engineers.',
  },
  {
    id: 'cv-boe-ai-tools',
    source: 'cv',
    topic: 'AI tools at the Bank of England',
    text:
      'At the Bank of England, Thomas uses GitHub Copilot in agentic mode within VS Code, ' +
      'integrating models including Claude Opus, Claude Sonnet, GPT, and Grok for planning, code ' +
      'generation, refactoring, and unit test writing. He led a React-Redux ecosystem package ' +
      'upgrade using these agentic workflows, completing it 25% faster than the estimated baseline ' +
      'and increasing unit test coverage by 15%.',
  },
  {
    id: 'cv-boe-testing',
    source: 'cv',
    topic: 'testing frameworks at the Bank of England',
    text:
      'At the Bank of England, Thomas uses Jest for frontend unit testing, NUnit and xUnit for ' +
      'backend unit testing, and Cypress for automated end-to-end testing.',
  },
  {
    id: 'cv-boe-agile',
    source: 'cv',
    topic: 'agile and Scrum roles at the Bank of England',
    text:
      'At the Bank of England, Thomas participates in all Scrum ceremonies including Backlog ' +
      'Refinement, Sprint Planning, Daily Stand-up, Sprint Reviews, and Retrospectives. He serves ' +
      'as Scrum Master and Release Champion on a rotating basis each sprint, coordinating the ' +
      'deployment lifecycle in Azure DevOps.',
  },

  /* ─────────────────────────── Reserve Bank of New Zealand ─────────────────────────── */
  {
    id: 'cv-rbnz',
    source: 'cv',
    topic: 'Reserve Bank of New Zealand role',
    text:
      'Before the Bank of England, Thomas worked at the Reserve Bank of New Zealand (RBNZ) in ' +
      'Wellington as a Full-Stack .NET Developer (June 2021 – February 2023). He developed Azure ' +
      'Functions powering three core operational workflows (file processing, automated calendar ' +
      'management, and notification systems), built end-to-end CI/CD pipelines using Bicep IaC, ' +
      'TeamCity, and Octopus Deploy, integrated the Refinitiv Real-Time Optimised API for live ' +
      'market data ingestion, and upgraded core .NET applications from version 4.6 to 4.8.',
  },
  {
    id: 'cv-rbnz-cloud-iac',
    source: 'cv',
    topic: 'RBNZ cloud and IaC work',
    text:
      'At RBNZ, Thomas built and maintained end-to-end CI/CD pipelines across Azure DevOps, ' +
      'TeamCity, and Octopus Deploy using Bicep IaC templates, reducing environment provisioning ' +
      'time and standardising deployment practices across the engineering team.',
  },
  {
    id: 'cv-rbnz-refinitiv',
    source: 'cv',
    topic: 'Refinitiv Real-Time Optimised integration at RBNZ',
    text:
      "At RBNZ, Thomas integrated the organisation's market data capture services with the " +
      'Refinitiv Real-Time Optimised API, enabling real-time ingestion of live financial market ' +
      'data to support time-critical operations at a national central bank.',
  },
  {
    id: 'cv-rbnz-support',
    source: 'cv',
    topic: 'production support and incident response at RBNZ',
    text:
      'At RBNZ, Thomas resolved high-priority Level 3 production incidents within tight SLA ' +
      'windows, maintaining system stability for a nationally critical financial institution. He ' +
      'also authored comprehensive technical runbooks that were adopted by the support team.',
  },

  /* ─────────────────────────── Glassbox & early career ─────────────────────────── */
  {
    id: 'cv-glassbox',
    source: 'cv',
    topic: 'Glassbox role',
    text:
      'At Glassbox Limited in Palmerston North, New Zealand (September 2015 – January 2021), ' +
      'Thomas worked as a Full-Stack Software Developer building retail petroleum management ' +
      'software. He designed and delivered 6+ modules including a sales dashboard, audit trail, ' +
      'price change, site monitoring, and reporting features in Angular, TypeScript, and ASP.NET ' +
      'Web API. He also led migration of the fuel reconciliation module from Silverlight to ' +
      'Angular 6, built a cross-platform mobile app with NativeScript and Angular 4, and rewrote ' +
      'the core customer accounts module to support a 5x increase in account capacity.',
  },
  {
    id: 'cv-glassbox-legacy',
    source: 'cv',
    topic: 'legacy migration work at Glassbox',
    text:
      'At Glassbox, Thomas led the end-to-end migration of a fuel reconciliation module from ' +
      'deprecated Silverlight to Angular 6, and independently upgraded the entire application to ' +
      'Angular 9, eliminating browser compatibility risk and reducing technical debt across a ' +
      'complex, production-critical codebase.',
  },
  {
    id: 'cv-glassbox-mobile',
    source: 'cv',
    topic: 'cross-platform mobile app at Glassbox',
    text:
      'At Glassbox, Thomas was the sole developer of a cross-platform native fuel management ' +
      'app for iOS and Android using NativeScript, Angular 4, and .NET Core. This delivered a ' +
      'unified codebase that replaced the need for two separate native builds.',
  },
  {
    id: 'cv-glassbox-perf',
    source: 'cv',
    topic: 'performance engineering at Glassbox',
    text:
      'At Glassbox, Thomas rewrote the core customer accounts module to support a 5x increase ' +
      'in account capacity and implemented complex new business hierarchies within SQL and T-SQL.',
  },
  {
    id: 'cv-india-early',
    source: 'cv',
    topic: 'early career in India (Maria Software, Zen Technologies)',
    text:
      'Thomas began his career at Maria Software Pvt Ltd and Zen Technologies in Kerala, India ' +
      'from June 2013 to March 2015, where he built retail and education management desktop ' +
      'applications using VB.NET, PHP, and SQL, and delivered programming and web development ' +
      'training in C, C++, and PHP.',
  },

  /* ─────────────────────────── Tech stack ─────────────────────────── */
  {
    id: 'cv-frontend-stack',
    source: 'cv',
    topic: 'frontend technologies',
    text:
      "Thomas's frontend skills include TypeScript, React, Redux, Angular, NativeScript, jQuery, " +
      'JavaScript, HTML5, and CSS3/Sass with SignalR for real-time communication.',
  },
  {
    id: 'cv-backend-stack',
    source: 'cv',
    topic: 'backend technologies',
    text:
      "Thomas's backend skills include C#, .NET, ASP.NET Web API, ASP.NET MVC, VB.NET, " +
      'WinForms, and Node.js.',
  },
  {
    id: 'cv-cloud-devops-stack',
    source: 'cv',
    topic: 'cloud and DevOps skills',
    text:
      "Thomas's cloud and DevOps skills include Azure Functions, Bicep IaC, Azure DevOps, " +
      'CI/CD Pipelines, TeamCity, Octopus Deploy, Git, Bitbucket, and SonarQube. He holds the ' +
      'Microsoft Certified: Azure Fundamentals (AZ-900) certification.',
  },
  {
    id: 'cv-databases',
    source: 'cv',
    topic: 'databases',
    text:
      'Thomas has worked with MS SQL Server, MySQL, MS Access, Entity Framework ORM, pgvector ' +
      'for vector similarity search, and DuckDB for in-process analytical SQL queries.',
  },
  {
    id: 'cv-ai-stack',
    source: 'cv',
    topic: 'AI and agentic AI technologies',
    text:
      'Thomas works with Agentic AI systems, RAG (Retrieval-Augmented Generation) applications, ' +
      'LLM orchestration, LangGraph, pgvector, Claude (Anthropic), GPT-4o and GPT-5 (OpenAI), and ' +
      'GitHub Copilot in agentic mode. He holds multiple certifications in these areas from ' +
      'DeepLearning.AI and IBM.',
  },
  {
    id: 'cv-ai-dev-tools',
    source: 'cv',
    topic: 'AI-augmented development tools used daily',
    text:
      'Thomas uses GitHub Copilot, VS Code, Claude Code, Cursor, and Antigravity as part of his ' +
      'AI-augmented development environment for daily planning, code generation, refactoring, and ' +
      'testing workflows.',
  },

  /* ─────────────────────────── Certifications & education ─────────────────────────── */
  {
    id: 'cv-certs',
    source: 'cv',
    topic: 'AI certifications',
    text:
      'Thomas holds the following AI certifications: Agentic AI (DeepLearning.AI); Generative AI ' +
      'for Software Development — a 3-course professional certificate (DeepLearning.AI); ' +
      'AI-Powered Software and System Design (DeepLearning.AI); Team Software Engineering with AI ' +
      '(DeepLearning.AI); Build RAG Applications: Get Started (IBM/Coursera); Develop Generative ' +
      'AI Applications: Get Started (IBM/Coursera).',
  },
  {
    id: 'cv-cert-genai-detail',
    source: 'cv',
    topic: 'Generative AI for Software Development certificate detail',
    text:
      'Generative AI for Software Development is a 3-course professional certificate from ' +
      'DeepLearning.AI. Thomas completed all three constituent courses: Introduction to ' +
      'Generative AI for Software Development, AI-Powered Software and System Design, and Team ' +
      'Software Engineering with AI.',
  },
  {
    id: 'cv-cert-microsoft',
    source: 'cv',
    topic: 'Microsoft Azure Fundamentals certification',
    text:
      'Thomas holds the Microsoft Certified: Azure Fundamentals (AZ-900) certification, earned ' +
      'in 2025.',
  },
  {
    id: 'cv-education',
    source: 'cv',
    topic: 'education',
    text:
      'Thomas holds a Graduate Diploma in Software Development from UCOL (Universal College of ' +
      'Learning), New Zealand (2015–2016), and a Bachelor of Technology in Information Technology ' +
      'from Mahatma Gandhi University, India (2009–2013). He also holds multiple AI certifications ' +
      'from DeepLearning.AI and IBM completed in 2026.',
  },

  /* ─────────────────────────── GitHub & agentic patterns ─────────────────────────── */
  {
    id: 'github-profile',
    source: 'github',
    topic: 'GitHub profile and notable repositories',
    text:
      "Thomas's GitHub profile is github.com/vathomas. His notable repositories include " +
      'market-research-agentic-team (a multi-agent market research system) and customer-service-' +
      'agent (a transactional autonomous customer service agent).',
  },
  {
    id: 'repo-market-research',
    source: 'repo',
    topic: 'market-research-agentic-team project',
    text:
      'market-research-agentic-team is a multi-agent system on GitHub where a Researcher agent ' +
      'calls the Tavily web search API, a Writer agent drafts a report, and a Critic agent runs ' +
      'a reflection loop that sends the draft back for revision until quality criteria are met. ' +
      'It uses GPT-4o, LangGraph state graphs, and the Tavily API, and demonstrates ' +
      'plan-then-execute and self-correction patterns.',
  },
  {
    id: 'repo-customer-service',
    source: 'repo',
    topic: 'customer-service-agent project',
    text:
      'customer-service-agent is an autonomous customer service agent on GitHub that handles ' +
      'natural-language retail requests (purchases, returns, stock queries) end-to-end. It uses ' +
      'a formal tool registry, argument canonicalisation, DuckDB in-process SQL over Pandas ' +
      'DataFrames, and assertion-based guardrails. It is model-agnostic and supports both GPT-4o ' +
      '(OpenAI) and Claude (Anthropic).',
  },
  {
    id: 'repo-agentic-patterns',
    source: 'repo',
    topic: 'agentic patterns demonstrated across GitHub projects',
    text:
      "Thomas's GitHub projects demonstrate plan-then-execute (structured JSON plans executed " +
      'step by step), reflection loops (LLM re-evaluates the plan after each step and can revise ' +
      'remaining steps), ReAct-style tool use (LLM decides which tool to call, executor dispatches ' +
      'it), assertion-based guardrails (validation tools check business rules before committing ' +
      'state), and multi-model orchestration (the same execution layer works with GPT-4o or Claude).',
  },
  {
    id: 'repo-plan-then-execute',
    source: 'repo',
    topic: 'plan-then-execute pattern rationale',
    text:
      'Plan-then-execute is an agentic pattern where the LLM first generates a structured JSON ' +
      'plan specifying which tools to call and with what arguments, and then a separate executor ' +
      'runs those steps sequentially. Thomas uses it because it separates reasoning (LLM) from ' +
      'execution (code), makes the system auditable, and allows validation at each step — giving ' +
      'more control and observability than a pure ReAct loop.',
  },
  {
    id: 'repo-reflection-loop',
    source: 'repo',
    topic: 'reflection loop mechanics in the market research agent',
    text:
      'After each step executes in market-research-agentic-team, the system builds a reflection ' +
      'prompt containing the original query, the full execution history, and the remaining ' +
      'planned steps, and asks GPT-4o whether the plan needs to change. If the model returns a ' +
      'revised plan, the executor adopts it and continues; otherwise the original plan proceeds. ' +
      'This lets the agent correct course mid-execution if new information changes the strategy.',
  },
  {
    id: 'repo-arg-canonicalisation',
    source: 'repo',
    topic: 'argument canonicalisation in the customer service agent',
    text:
      'Argument canonicalisation is a normalisation step in customer-service-agent that maps ' +
      'LLM-generated argument aliases to canonical names before tool execution. For example, ' +
      "'quantity' is normalised to 'qty' and 'change' to 'delta'. This makes the system robust " +
      'to natural LLM variation across runs without retraining the model or over-engineering ' +
      'prompts.',
  },
  {
    id: 'repo-duckdb',
    source: 'repo',
    topic: 'DuckDB rationale in the customer service agent',
    text:
      'Thomas used DuckDB alongside Pandas so that mutable in-memory DataFrames (inventory, ' +
      'transactions) could also be queried with expressive SQL. DuckDB runs entirely in-process ' +
      'with zero server setup and is very fast for analytical queries. When a tool mutates a ' +
      'DataFrame, it is immediately re-registered in DuckDB so subsequent SQL queries see the ' +
      'latest state.',
  },

  /* ─────────────────────────── Digital portfolio (this site) ─────────────────────────── */
  {
    id: 'portfolio-stack',
    source: 'repo',
    topic: 'digital portfolio tech stack',
    text:
      'The digital portfolio is built with Astro v6 (SSR mode), React islands for interactive ' +
      'components, and Tailwind CSS v4. It is deployed on Vercel and uses the Vercel AI SDK with ' +
      'Anthropic Claude models (Sonnet and Haiku) for all AI features. The backend uses Neon ' +
      'Postgres with pgvector for vector similarity search and OpenAI text-embedding-3-small for ' +
      'embeddings.',
  },
  {
    id: 'portfolio-showcases',
    source: 'repo',
    topic: 'four AI showcases in the digital portfolio',
    text:
      'The portfolio contains four agentic AI showcases: (1) Recursive Portfolio Chatbot — a RAG ' +
      'agent with a LangGraph correction loop using pgvector retrieval; (2) Deep Research Agent — ' +
      'a plan-and-execute pipeline that runs web searches via Tavily and synthesises an executive ' +
      'summary with Claude Sonnet; (3) Crew Orchestrator — a multi-agent system where specialist ' +
      'agents collaborate on a task; (4) Agent Playground — a live tool-use demo where a Claude ' +
      'Haiku ReAct loop decides which tools to call.',
  },
  {
    id: 'portfolio-rag-chatbot',
    source: 'repo',
    topic: 'how the RAG chatbot in this portfolio works',
    text:
      "The portfolio's RAG chatbot (Showcase 1) retrieves relevant context from a corpus of " +
      "Thomas's CV and project notes stored in a Neon Postgres database using pgvector cosine " +
      'similarity search. Queries are embedded with OpenAI text-embedding-3-small, the top ' +
      'matching chunks are retrieved, and Claude Sonnet generates a grounded answer. A LangGraph ' +
      'correction loop re-queries with a rewritten question if the initial retrieval is ' +
      'insufficient.',
  },

  /* ─────────────────────────── Contact & cross-cutting ─────────────────────────── */
  {
    id: 'cv-contact',
    source: 'cv',
    topic: 'contact and links',
    text:
      'Contact: email ta.abraham@outlook.com. LinkedIn: linkedin.com/in/tvabraham. ' +
      'GitHub: github.com/vathomas. Phone (NZ): +64 22 086 3258. ' +
      'Currently in London, UK; relocating to Adelaide, SA in June 2026.',
  },
  {
    id: 'cv-mission-critical',
    source: 'cv',
    topic: 'mission-critical financial systems experience',
    text:
      'Thomas has worked on mission-critical systems for two central banks: the Bank of England ' +
      '(July 2023 – present), where he builds full-stack production systems and supports ' +
      'incident resolution, and the Reserve Bank of New Zealand (June 2021 – February 2023), ' +
      'where he integrated the Refinitiv Real-Time Optimised API for live financial market data ' +
      'and resolved Level 3 production incidents within SLA windows.',
  },
  {
    id: 'cv-agentic-production-ready',
    source: 'cv',
    topic: 'production-ready agentic AI experience',
    text:
      'Beyond certifications, Thomas has hands-on engineering experience building agentic AI: ' +
      'he built autonomous multi-step agents from scratch in Python with tool registries, ' +
      'argument resolution, state mutation with DuckDB, assertion-based guardrails, and ' +
      'reflection loops. He applies GitHub Copilot in agentic mode daily at the Bank of England, ' +
      'and his portfolio showcases four deployed agentic demos using real APIs (Claude, OpenAI ' +
      'embeddings, Tavily, pgvector) in a CI/CD-tested Vercel production environment.',
  },
  {
    id: 'cv-iac-experience',
    source: 'cv',
    topic: 'Infrastructure-as-Code (IaC) experience',
    text:
      'Thomas has hands-on IaC experience with Azure Bicep, which he used at RBNZ to build and ' +
      'maintain CI/CD pipelines that reduced environment provisioning time and standardised ' +
      'deployment across the engineering team. His digital portfolio also includes Terraform IaC ' +
      'configuration covering Vercel project settings, Neon Postgres, and GitHub Actions secrets.',
  },

  /* ─────────────────────────── Legacy compact tech stack (kept for backwards compat) ─────────────────────────── */
  {
    id: 'cv-stack',
    source: 'cv',
    topic: 'tech stack summary',
    text:
      'Frontend: React, TypeScript, Redux, Angular, NativeScript. Backend: C#, .NET, ASP.NET ' +
      'Web API, Node.js. Cloud: Azure, Azure Functions, Bicep, Azure DevOps. AI: LangGraph, RAG, ' +
      'pgvector, Claude, GPT-5, GitHub Copilot. Data: MS SQL, Entity Framework, pgvector, MySQL.',
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
