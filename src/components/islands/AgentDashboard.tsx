import {
  ResponsiveContainer,
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Cell,
  BarChart, Bar, LabelList,
} from 'recharts';
import { MODELS, TOOLS, summarize } from '../../lib/agent/dashboard-data';
import AgentPlayground from './AgentPlayground';

const SUMMARY = summarize();

export default function AgentDashboard() {
  return (
    <div className="space-y-10">
      {/* KPI strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total runs"     value={SUMMARY.totalRuns.toLocaleString()} />
        <Kpi label="Success rate"   value={`${SUMMARY.weightedSuccessRate.toFixed(1)}%`} accent />
        <Kpi label="Avg latency"    value={`${Math.round(SUMMARY.weightedLatencyMs)}ms`} />
        <Kpi label="Tool accuracy"  value={`${SUMMARY.toolAccuracy.toFixed(1)}%`} accent />
      </section>

      {/* Charts row */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Success Rate vs. Latency"
          subtitle="Each dot is a model — top-left is the sweet spot (high success, low latency)."
        >
          <ScatterModelChart />
        </ChartCard>

        <ChartCard
          title="Tool Usage Accuracy"
          subtitle="Per-tool success vs. failure across all production agent runs."
        >
          <ToolAccuracyChart />
        </ChartCard>
      </section>

      {/* Model comparison table — companion to scatter chart.
          Wrapped in overflow-x-auto so the 6-column table can scroll
          horizontally on phones rather than busting the viewport. */}
      <section>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Model breakdown
        </h3>
        <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs sm:text-sm">
            <thead className="bg-gray-900/80 text-[10px] sm:text-xs font-mono uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-3 sm:px-4 py-2.5">Model</th>
                <th className="text-left px-3 sm:px-4 py-2.5">Hosting</th>
                <th className="text-right px-3 sm:px-4 py-2.5">Success</th>
                <th className="text-right px-3 sm:px-4 py-2.5">Latency</th>
                <th className="text-right px-3 sm:px-4 py-2.5">Runs</th>
                <th className="text-right px-3 sm:px-4 py-2.5">$/1k runs</th>
              </tr>
            </thead>
            <tbody>
              {MODELS.map((m) => (
                <tr key={m.id} className="border-t border-gray-800 hover:bg-gray-900/40">
                  <td className="px-3 sm:px-4 py-2.5 text-white whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }}></span>
                      {m.name}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-2.5">
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${
                      m.hosted === 'cloud'
                        ? 'bg-blue-900/30 text-blue-300 border-blue-800'
                        : 'bg-orange-900/30 text-orange-300 border-orange-800'
                    }`}>
                      {m.hosted}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-2.5 text-right text-gray-200 whitespace-nowrap">{m.successRate.toFixed(1)}%</td>
                  <td className="px-3 sm:px-4 py-2.5 text-right text-gray-200 whitespace-nowrap">{m.avgLatencyMs}ms</td>
                  <td className="px-3 sm:px-4 py-2.5 text-right text-gray-400 whitespace-nowrap">{m.totalRuns.toLocaleString()}</td>
                  <td className="px-3 sm:px-4 py-2.5 text-right text-gray-400 whitespace-nowrap">${m.costPer1kRuns.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Playground */}
      <section>
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Playground</h3>
          <p className="text-gray-500 text-sm">
            Trigger a tool-use event live. The agent decides which tools to call, in what order — every
            thought, action, and observation streams in as it happens.
          </p>
        </div>
        <AgentPlayground />
      </section>
    </div>
  );
}

/* ─────────────── Charts ─────────────── */

function ScatterModelChart() {
  const data = MODELS.map((m) => ({
    name: m.name,
    latency: m.avgLatencyMs,
    success: m.successRate,
    runs: m.totalRuns,
    color: m.color,
    hosted: m.hosted,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 10, right: 16, bottom: 36, left: 8 }}>
        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="latency"
          name="Latency"
          unit="ms"
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          stroke="#374151"
          label={{ value: 'Avg latency (ms)', position: 'insideBottom', offset: -8, fill: '#9ca3af', fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="success"
          name="Success"
          unit="%"
          domain={[70, 100]}
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          stroke="#374151"
          label={{ value: 'Success rate (%)', angle: -90, position: 'insideLeft', offset: 12, fill: '#9ca3af', fontSize: 11 }}
        />
        <ZAxis type="number" dataKey="runs" range={[100, 600]} name="Runs" />
        <Tooltip
          cursor={{ strokeDasharray: '3 3', stroke: '#4b5563' }}
          contentStyle={{
            backgroundColor: '#0b0f0d',
            border: '1px solid #1f2937',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: '#fff' }}
          /* recharts v3 widened ValueType — keep our narrow handler shape;
             the runtime contract (number in, ReactNode out) is correct. */
          formatter={((v: number, name: string) => {
            if (name === 'Latency') return `${v}ms`;
            if (name === 'Success') return `${v}%`;
            if (name === 'Runs') return v.toLocaleString();
            return v;
          }) as never}
          labelFormatter={(_, payload) => {
            const d = payload?.[0]?.payload as { name?: string };
            return d?.name ?? '';
          }}
        />
        <Scatter data={data}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function ToolAccuracyChart() {
  const data = TOOLS.map((t) => ({
    name: t.name,
    accuracy: Number(((t.successful / t.invocations) * 100).toFixed(1)),
    failed: t.invocations - t.successful,
    invocations: t.invocations,
  })).sort((a, b) => b.accuracy - a.accuracy);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 32, bottom: 8, left: 8 }}>
        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          domain={[80, 100]}
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          stroke="#374151"
          unit="%"
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'ui-monospace' }}
          stroke="#374151"
          width={100}
        />
        <Tooltip
          cursor={{ fill: '#1f2937' }}
          contentStyle={{
            backgroundColor: '#0b0f0d',
            border: '1px solid #1f2937',
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={((v: number, name: string, entry: { payload: unknown }) => {
            const p = entry.payload as { invocations: number; failed: number };
            if (name === 'accuracy') return [`${v}% (${p.invocations - p.failed}/${p.invocations})`, 'Accuracy'];
            return v;
          }) as never}
        />
        <Bar dataKey="accuracy" fill="#22c55e" radius={[0, 4, 4, 0]}>
          <LabelList dataKey="accuracy" position="right" fill="#9ca3af" fontSize={11} formatter={((v: number) => `${v}%`) as never} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ─────────────── helper components ─────────────── */

function Kpi({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border bg-gray-900/60 px-4 py-3 ${accent ? 'border-agent-800' : 'border-gray-800'}`}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent ? 'text-agent-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
      <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-gray-500 mb-3">{subtitle}</p>
      {children}
    </div>
  );
}
