/**
 * Mock tool registry for the playground (Showcase 4).
 *
 * Each tool has a name, description, parameter schema, and a `call`
 * implementation. In mock mode the implementations return canned-but-
 * plausible data; real-mode swaps each call to its actual API.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, string>;
  call: (args: Record<string, string>) => Promise<unknown>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ─────────────── Mock implementations ─────────────── */

async function getUserLocation(): Promise<unknown> {
  await sleep(280);
  // REAL MODE swap: read CF-IPCountry / X-Vercel-IP-City headers, or
  //                 prompt the user for browser geolocation
  return {
    city: 'London',
    country: 'United Kingdom',
    lat: 51.5074,
    lon: -0.1278,
    timezone: 'Europe/London',
    source: 'mock-headers',
  };
}

async function getWeather(args: Record<string, string>): Promise<unknown> {
  await sleep(420);
  const city = args.city ?? 'London';
  // REAL MODE swap: fetch('https://api.openweathermap.org/data/2.5/weather?…')
  // Canned values picked to match May in London — overcast, mid-teens.
  return {
    city,
    temp_c: 14,
    condition: 'Overcast clouds',
    humidity_pct: 72,
    wind_kph: 11,
    mood_label: 'contemplative',
    description: 'Cool overcast — good weather for deep work.',
  };
}

async function getCurrentTime(): Promise<unknown> {
  await sleep(80);
  const now = new Date();
  return {
    iso: now.toISOString(),
    local: now.toLocaleString('en-GB', { timeZone: 'Europe/London' }),
    timezone: 'Europe/London',
  };
}

async function searchPortfolioProjects(args: Record<string, string>): Promise<unknown> {
  await sleep(360);
  const mood = (args.mood ?? '').toLowerCase();

  // REAL MODE swap: pgvector cosine search; for now a manual mood→project map
  // weighted by closest-fit. Lifted from the actual content collection.
  const all = [
    {
      slug: 'recursive-portfolio-chatbot',
      title: 'Recursive Portfolio Chatbot',
      moods: ['contemplative', 'curious', 'reflective'],
      pitch: 'Self-correcting RAG agent over my CV — perfect for slow, exploratory chats.',
    },
    {
      slug: 'deep-research-agent',
      title: 'Deep Research Agent',
      moods: ['focused', 'analytical', 'contemplative'],
      pitch: 'Long-running plan-and-execute pipeline; emits a PDF report with citations.',
    },
    {
      slug: 'software-architect-crew',
      title: 'Software Architect Crew',
      moods: ['energetic', 'collaborative', 'productive'],
      pitch: 'Three agents collaborating on code — fun to watch the feedback loop.',
    },
    {
      slug: 'agent-skills-dashboard',
      title: 'Agent Skills Dashboard',
      moods: ['analytical', 'data-driven', 'curious'],
      pitch: 'Live performance metrics + tool-use playground — this very page.',
    },
  ];

  // Score by mood overlap; tiebreak alphabetically
  const ranked = all
    .map((p) => ({ ...p, score: p.moods.includes(mood) ? 1 : 0 }))
    .sort((a, b) => (b.score - a.score) || a.title.localeCompare(b.title));

  return {
    matched_mood: mood || 'any',
    top_recommendation: ranked[0],
    runners_up: ranked.slice(1, 3),
  };
}

/* ─────────────── Registry ─────────────── */

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  get_user_location: {
    name: 'get_user_location',
    description: 'Resolve the requesting user\'s city/country/timezone from request headers.',
    parameters: {},
    call: getUserLocation,
  },
  get_weather: {
    name: 'get_weather',
    description: 'Get the current weather for a city. Returns temperature, condition, and a derived mood label.',
    parameters: { city: 'string — name of the city' },
    call: getWeather,
  },
  get_current_time: {
    name: 'get_current_time',
    description: 'Get the current time in the user\'s local timezone.',
    parameters: {},
    call: getCurrentTime,
  },
  search_portfolio_projects: {
    name: 'search_portfolio_projects',
    description: 'Find a portfolio project that matches a given mood label.',
    parameters: { mood: 'string — mood label, e.g. "contemplative", "energetic"' },
    call: searchPortfolioProjects,
  },
};

export const TOOL_NAMES = Object.keys(TOOL_REGISTRY);
