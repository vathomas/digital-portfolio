/**
 * Mock knowledge corpus — stands in for pgvector retrieval until Neon is wired.
 * Each chunk is what a real similarity search would return; the mock retriever
 * picks chunks by keyword overlap so the demo behaves plausibly.
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
 * Mock retriever — keyword overlap stand-in for cosine similarity over pgvector.
 * Replace with a real Neon + pgvector query when DATABASE_URL is configured.
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
