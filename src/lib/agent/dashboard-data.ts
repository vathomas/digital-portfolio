/**
 * Mock benchmark dataset for the Agent Skills Dashboard.
 *
 * In real mode, these are aggregated from a `agent_runs` table populated
 * by the production agents (Showcases 1-4) writing telemetry to Postgres.
 * For now, the numbers are an illustrative placeholder dataset — they are
 * NOT measured, and the dashboard UI labels them as such.
 */

export interface ModelStats {
  id: string;
  name: string;
  family: 'gpt' | 'claude' | 'llama' | 'gemini';
  hosted: 'cloud' | 'local';
  successRate: number;       // 0-100 (%)
  avgLatencyMs: number;      // mean latency in ms
  totalRuns: number;
  costPer1kRuns: number;     // USD
  /** Color for chart tints. Tailwind agent-* + complementary palette. */
  color: string;
}

export const MODELS: ModelStats[] = [
  { id: 'claude-sonnet',  name: 'Claude Sonnet 4.5', family: 'claude', hosted: 'cloud', successRate: 96.4, avgLatencyMs: 920, totalRuns: 1284, costPer1kRuns: 18.40, color: '#22c55e' },
  { id: 'gpt-4o',         name: 'GPT-4o',            family: 'gpt',    hosted: 'cloud', successRate: 95.1, avgLatencyMs: 1180, totalRuns: 1547, costPer1kRuns: 12.90, color: '#a855f7' },
  { id: 'gpt-4o-mini',    name: 'GPT-4o-mini',       family: 'gpt',    hosted: 'cloud', successRate: 91.8, avgLatencyMs: 610, totalRuns: 2103, costPer1kRuns: 1.85, color: '#c084fc' },
  { id: 'llama-3-70b',    name: 'Llama 3 70B',       family: 'llama',  hosted: 'local', successRate: 87.2, avgLatencyMs: 1640, totalRuns: 412, costPer1kRuns: 0.45, color: '#f59e0b' },
  { id: 'llama-3-8b',     name: 'Llama 3 8B',        family: 'llama',  hosted: 'local', successRate: 78.6, avgLatencyMs: 280, totalRuns: 891, costPer1kRuns: 0.12, color: '#fbbf24' },
];

export interface ToolStats {
  name: string;
  /** Total invocations across all agents. */
  invocations: number;
  /** Successful + correctly-shaped tool calls. */
  successful: number;
  /** Calls where the agent picked the wrong tool / arg shape. */
  failed: number;
  /** Tool description for the dashboard tooltip. */
  description: string;
}

export const TOOLS: ToolStats[] = [
  { name: 'pgvector_search',   invocations: 1421, successful: 1389, failed: 32,  description: 'Cosine-similarity retrieval over the portfolio corpus' },
  { name: 'tavily_search',     invocations: 932,  successful: 894,  failed: 38,  description: 'Web search for the Deep Research agent' },
  { name: 'get_weather',       invocations: 287,  successful: 281,  failed: 6,   description: 'Current weather lookup' },
  { name: 'github_repo_read',  invocations: 244,  successful: 226,  failed: 18,  description: 'Fetch repository metadata + recent commits' },
  { name: 'arxiv_fetch',       invocations: 188,  successful: 175,  failed: 13,  description: 'Pull abstracts from ArXiv given an ID' },
  { name: 'get_user_location', invocations: 173,  successful: 173,  failed: 0,   description: 'Resolve user location from request headers' },
];

/* ─────────────── Aggregations ─────────────── */

export interface DashboardSummary {
  totalRuns: number;
  weightedSuccessRate: number;
  weightedLatencyMs: number;
  totalCostUsd: number;
  toolAccuracy: number;
}

export function summarize(): DashboardSummary {
  const totalRuns = MODELS.reduce((sum, m) => sum + m.totalRuns, 0);
  const weightedSuccessRate =
    MODELS.reduce((sum, m) => sum + m.successRate * m.totalRuns, 0) / totalRuns;
  const weightedLatencyMs =
    MODELS.reduce((sum, m) => sum + m.avgLatencyMs * m.totalRuns, 0) / totalRuns;
  const totalCostUsd =
    MODELS.reduce((sum, m) => sum + (m.costPer1kRuns * m.totalRuns) / 1000, 0);
  const toolTotal = TOOLS.reduce((sum, t) => sum + t.invocations, 0);
  const toolOk = TOOLS.reduce((sum, t) => sum + t.successful, 0);
  const toolAccuracy = (toolOk / toolTotal) * 100;

  return {
    totalRuns,
    weightedSuccessRate,
    weightedLatencyMs,
    totalCostUsd,
    toolAccuracy,
  };
}
