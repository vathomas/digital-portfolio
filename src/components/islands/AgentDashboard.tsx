// Phase 2: Wire to Postgres metrics + charting library (Recharts) + live playground
export default function AgentDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
        <span className="text-xs font-mono text-gray-500">AgentDashboard — Phase 2 placeholder</span>
      </div>

      {/* Chart placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">Success Rate vs. Latency</h3>
          <div className="h-40 bg-gray-800 rounded-lg flex items-center justify-center">
            <p className="text-gray-700 text-xs font-mono">Chart — Phase 2</p>
          </div>
          <p className="text-xs text-gray-700 mt-2 font-mono">GPT-4o vs. Llama 3</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">Tool Usage Accuracy</h3>
          <div className="h-40 bg-gray-800 rounded-lg flex items-center justify-center">
            <p className="text-gray-700 text-xs font-mono">Chart — Phase 2</p>
          </div>
          <p className="text-xs text-gray-700 mt-2 font-mono">Correct API calls vs. failures</p>
        </div>
      </div>

      {/* Playground placeholder */}
      <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Live Playground</h3>
        <p className="text-xs text-gray-600 font-mono mb-4">
          Trigger a tool-use event: agent fetches local weather → recommends a portfolio project based on mood
        </p>
        <button
          disabled
          className="bg-gray-800 border border-gray-700 text-gray-600 px-4 py-2 rounded-lg text-sm cursor-not-allowed font-mono"
        >
          Run Agent Tool → (Phase 2)
        </button>
      </div>
    </div>
  );
}
