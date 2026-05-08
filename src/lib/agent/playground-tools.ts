/**
 * Tool registry for the playground (Showcase 4).
 *
 * Each tool has a name, description, parameter schema, and a `call`
 * implementation.
 *
 * Real mode:
 *   - get_user_location: reads Vercel IP headers (x-vercel-ip-city etc.)
 *   - get_weather: calls OpenWeather API if OPENWEATHERMAP_API_KEY is set
 *   - get_current_time: always real (uses Date)
 *   - search_portfolio_projects: mood-keyed lookup (pgvector swap TBD)
 *
 * Use makeToolRegistry(headers) to get a registry that has access to the
 * request headers for location resolution.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, string>;
  call: (args: Record<string, string>) => Promise<unknown>;
}

/* ─────────────── Location ─────────────── */

async function getUserLocation(headers?: Headers): Promise<unknown> {
  if (headers) {
    // Vercel sets these on every request in production
    const rawCity = headers.get('x-vercel-ip-city');
    const country = headers.get('x-vercel-ip-country');
    const lat = headers.get('x-vercel-ip-latitude');
    const lon = headers.get('x-vercel-ip-longitude');
    const timezone = headers.get('x-vercel-ip-timezone');

    if (rawCity) {
      const city = decodeURIComponent(rawCity);
      return {
        city,
        country: country ?? 'Unknown',
        lat: lat ? parseFloat(lat) : null,
        lon: lon ? parseFloat(lon) : null,
        timezone: timezone ?? 'UTC',
        source: 'vercel-headers',
      };
    }
  }

  // Fallback for local dev / non-Vercel environments
  return {
    city: 'London',
    country: 'United Kingdom',
    lat: 51.5074,
    lon: -0.1278,
    timezone: 'Europe/London',
    source: 'mock-fallback',
  };
}

/* ─────────────── Weather ─────────────── */

function deriveMoodLabel(temp_c: number, condition: string): string {
  const cond = condition.toLowerCase();
  if (cond.includes('thunder') || cond.includes('storm')) return 'dramatic';
  if (cond.includes('rain') || cond.includes('drizzle')) return 'reflective';
  if (cond.includes('cloud') || cond.includes('overcast')) return 'contemplative';
  if (cond.includes('clear') || cond.includes('sun')) {
    if (temp_c >= 22) return 'energetic';
    if (temp_c >= 15) return 'focused';
    return 'curious';
  }
  if (cond.includes('snow') || cond.includes('fog') || cond.includes('mist')) return 'introspective';
  return 'analytical';
}

function moodDescription(temp_c: number, condition: string): string {
  const mood = deriveMoodLabel(temp_c, condition);
  const descs: Record<string, string> = {
    dramatic: 'Stormy weather — great for ambitious, high-stakes builds.',
    reflective: 'Rain brings focus — ideal for deep reading and documentation.',
    contemplative: 'Overcast and cool — perfect for systems thinking.',
    energetic: 'Warm and sunny — good energy for shipping features.',
    focused: 'Clear and mild — prime conditions for writing code.',
    curious: 'Crisp and clear — good for exploring new ideas.',
    introspective: 'Quiet, hushed conditions — ideal for architecture decisions.',
    analytical: 'Steady conditions — solid for data analysis work.',
  };
  return descs[mood] ?? 'Good conditions for focused work.';
}

async function getWeather(args: Record<string, string>): Promise<unknown> {
  const city = args.city ?? 'London';
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;

  if (apiKey) {
    try {
      const url =
        `https://api.openweathermap.org/data/2.5/weather` +
        `?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`OpenWeather HTTP ${res.status}`);
      const data = await res.json() as Record<string, unknown>;

      const main = data.main as Record<string, number>;
      const weatherArr = data.weather as { description: string }[];
      const wind = data.wind as { speed: number };

      const temp_c = Math.round(main?.temp ?? 0);
      const condition = weatherArr?.[0]?.description ?? 'Unknown';
      const humidity_pct = main?.humidity ?? 0;
      const wind_kph = Math.round((wind?.speed ?? 0) * 3.6);
      const mood_label = deriveMoodLabel(temp_c, condition);

      return {
        city,
        temp_c,
        condition,
        humidity_pct,
        wind_kph,
        mood_label,
        description: moodDescription(temp_c, condition),
      };
    } catch {
      // Fall through to mock if API call fails
    }
  }

  // Mock fallback — May in London
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

/* ─────────────── Time ─────────────── */

async function getCurrentTime(args: Record<string, string>): Promise<unknown> {
  const now = new Date();
  const timezone = args.timezone ?? 'UTC';
  return {
    iso: now.toISOString(),
    local: now.toLocaleString('en-GB', { timeZone: timezone }),
    timezone,
  };
}

/* ─────────────── Portfolio search ─────────────── */

async function searchPortfolioProjects(args: Record<string, string>): Promise<unknown> {
  const mood = (args.mood ?? '').toLowerCase();

  // Swap for pgvector cosine search once DATABASE_URL is provisioned.
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

  const ranked = all
    .map((p) => ({ ...p, score: p.moods.includes(mood) ? 1 : 0 }))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return {
    matched_mood: mood || 'any',
    top_recommendation: ranked[0],
    runners_up: ranked.slice(1, 3),
  };
}

/* ─────────────── Registry factory ─────────────── */

export function makeToolRegistry(headers?: Headers): Record<string, ToolDefinition> {
  return {
    get_user_location: {
      name: 'get_user_location',
      description: "Resolve the requesting user's city/country/timezone from request headers.",
      parameters: {},
      call: () => getUserLocation(headers),
    },
    get_weather: {
      name: 'get_weather',
      description: 'Get current weather for a city. Returns temperature, condition, and a mood label.',
      parameters: { city: 'string — name of the city' },
      call: getWeather,
    },
    get_current_time: {
      name: 'get_current_time',
      description: "Get the current time in the user's local timezone.",
      parameters: { timezone: 'string — IANA timezone, e.g. "Europe/London"' },
      call: getCurrentTime,
    },
    search_portfolio_projects: {
      name: 'search_portfolio_projects',
      description: 'Find a portfolio project that matches a given mood label.',
      parameters: { mood: 'string — mood label, e.g. "contemplative", "energetic"' },
      call: searchPortfolioProjects,
    },
  };
}

// Default registry (no headers — used if playground-graph is called without request context)
export const TOOL_REGISTRY = makeToolRegistry();
export const TOOL_NAMES = Object.keys(TOOL_REGISTRY);
