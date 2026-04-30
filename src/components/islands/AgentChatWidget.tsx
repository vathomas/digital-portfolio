// Phase 2: Wire to LangGraph RAG backend + Vercel AI SDK streaming
export default function AgentChatWidget() {
  return (
    <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
        <span className="text-xs font-mono text-gray-500">AgentChatWidget — Phase 2 placeholder</span>
      </div>
      <div className="bg-gray-800 rounded-lg p-4 mb-3 min-h-32 flex items-center justify-center">
        <p className="text-gray-600 text-sm font-mono">Chat messages will appear here</p>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          disabled
          placeholder="Ask me about my background, skills, or projects..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-500 placeholder-gray-700 cursor-not-allowed"
        />
        <button
          disabled
          className="bg-gray-800 border border-gray-700 text-gray-600 px-4 py-2 rounded-lg text-sm cursor-not-allowed"
        >
          Send
        </button>
      </div>
      <p className="text-xs text-gray-700 mt-2 font-mono">
        Self-correcting RAG · LangGraph · pgvector · "See Thoughts" toggle
      </p>
    </div>
  );
}
