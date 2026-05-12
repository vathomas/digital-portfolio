import { useState, useRef, useEffect } from 'react';

type Thought =
  | { node: 'retrieve'; query: string; hits: { id: string; topic: string }[] }
  | { node: 'grade'; verdict: 'pass' | 'fail'; reason: string }
  | { node: 'rewrite'; from: string; to: string }
  | { node: 'generate'; tokens: number };

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thoughts?: Thought[];
  attempts?: number;
}

const SUGGESTIONS = [
  'What does Thomas do at the Bank of England?',
  'Tell me about his agentic AI projects',
  'What certifications does he hold?',
  'Where is he moving to in 2026?',
];

export default function AgentChatWidget() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showThoughts, setShowThoughts] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  async function send(message: string) {
    const text = message.trim();
    if (!text || busy) return;

    const userTurn: ChatTurn = { id: crypto.randomUUID(), role: 'user', content: text };
    setTurns((t) => [...t, userTurn]);
    setInput('');
    setBusy(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      // Rate-limit handled with a friendly message so users see actionable
      // guidance instead of a parse error on the JSON envelope.
      if (res.status === 429) {
        const rl = (await res.json().catch(() => ({}))) as { retryAfterSec?: number };
        const wait = rl.retryAfterSec ?? 60;
        setTurns((t) => [
          ...t,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `You're sending messages a bit fast — please wait ${wait}s and try again.`,
          },
        ]);
        return;
      }

      const data = (await res.json()) as {
        answer?: string;
        thoughts?: Thought[];
        attempts?: number;
        error?: string;
      };

      const assistantTurn: ChatTurn = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer ?? data.error ?? 'No response.',
        thoughts: data.thoughts,
        attempts: data.attempts,
      };
      setTurns((t) => [...t, assistantTurn]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setTurns((t) => [
        ...t,
        { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${msg}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-800 px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 bg-agent-500 rounded-full animate-pulse shrink-0"></span>
          <span className="text-[11px] sm:text-xs font-mono text-gray-400 truncate">
            Recursive Portfolio Agent · LangGraph
          </span>
        </div>
        <label className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-gray-400 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={showThoughts}
            onChange={(e) => setShowThoughts(e.target.checked)}
            className="accent-agent-500"
          />
          🧠 See Thoughts
        </label>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="px-3 sm:px-4 py-3 sm:py-4 max-h-72 sm:max-h-96 overflow-y-auto space-y-3 sm:space-y-4">
        {turns.length === 0 && (
          <div className="text-center py-6">
            <p className="text-gray-500 text-sm mb-4">
              Ask the agent anything about Thomas's background, projects, or experience.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-agent-700 text-gray-300 px-3 py-1.5 rounded-full transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn) => (
          <div
            key={turn.id}
            className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              data-role={turn.role}
              className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
                turn.role === 'user'
                  ? 'bg-agent-700/40 border border-agent-800 text-gray-100'
                  : 'bg-gray-800/80 border border-gray-700 text-gray-200'
              }`}
            >
              <p className="whitespace-pre-wrap">{turn.content}</p>

              {turn.role === 'assistant' && showThoughts && turn.thoughts && (
                <details open className="mt-3 pt-3 border-t border-gray-700/60">
                  <summary className="text-xs text-agent-400 cursor-pointer font-mono">
                    Reasoning trace · {turn.thoughts.length} steps
                    {turn.attempts ? ` · ${turn.attempts} retries` : ''}
                  </summary>
                  <ol className="mt-2 space-y-1.5">
                    {turn.thoughts.map((t, i) => (
                      <li
                        key={i}
                        className="text-xs font-mono text-gray-400 bg-gray-950/60 border border-gray-800 rounded px-2 py-1.5"
                      >
                        <ThoughtLine thought={t} />
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="bg-gray-800/80 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-500">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-agent-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-agent-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-agent-500 rounded-full animate-bounce"></span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Composer — taller buttons on mobile to meet the 44px touch-target
          recommendation; tighter on desktop where pointer precision is fine. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-gray-800 px-3 sm:px-4 py-2.5 sm:py-3 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder="Ask about Thomas's background, skills, or projects…"
          className="flex-1 min-w-0 bg-gray-800 border border-gray-700 focus:border-agent-600 focus:outline-none rounded-lg px-3 sm:px-4 py-2.5 sm:py-2 text-sm text-gray-100 placeholder-gray-600 disabled:opacity-50 min-h-[44px] sm:min-h-0"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="bg-agent-600 hover:bg-agent-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 shrink-0"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function ThoughtLine({ thought }: { thought: Thought }) {
  switch (thought.node) {
    case 'retrieve':
      return (
        <span>
          <span className="text-agent-500">retrieve</span> · query={JSON.stringify(thought.query)} ·
          hits=[{thought.hits.map((h) => h.id).join(', ') || '∅'}]
        </span>
      );
    case 'grade':
      return (
        <span>
          <span className={thought.verdict === 'pass' ? 'text-agent-500' : 'text-yellow-500'}>
            grade
          </span>{' '}
          · verdict={thought.verdict} · {thought.reason}
        </span>
      );
    case 'rewrite':
      return (
        <span>
          <span className="text-yellow-500">rewrite</span> · {JSON.stringify(thought.from)} →{' '}
          {JSON.stringify(thought.to)}
        </span>
      );
    case 'generate':
      return (
        <span>
          <span className="text-agent-500">generate</span> · {thought.tokens} tokens
        </span>
      );
  }
}
