import { useState, useRef, useEffect } from 'react';

type StepKind = 'thought' | 'action' | 'observation' | 'answer' | 'system' | 'error';

interface Step {
  ts: number;
  kind: StepKind;
  tool?: string;
  args?: Record<string, string>;
  result?: unknown;
  text?: string;
}

interface Complete {
  toolsUsed: string[];
  durationMs: number;
  stepCount: number;
}

const SUGGESTIONS = [
  'Get the weather where I am and recommend a project that matches the mood',
  'What time is it locally for me right now?',
  'Pick a portfolio project for an analytical mood',
];

export default function AgentPlayground() {
  const [query, setQuery] = useState('');
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState<Complete | null>(null);
  const [error, setError] = useState<string | null>(null);

  const traceRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    traceRef.current?.scrollTo({ top: traceRef.current.scrollHeight, behavior: 'smooth' });
  }, [steps]);

  useEffect(() => () => sourceRef.current?.close(), []);

  function start(q: string) {
    const t = q.trim();
    if (!t || running) return;

    setQuery(t);
    setSteps([]);
    setComplete(null);
    setError(null);
    setRunning(true);

    const es = new EventSource(`/api/playground-stream?query=${encodeURIComponent(t)}`);
    sourceRef.current = es;

    es.addEventListener('step', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as Step;
        setSteps((prev) => [...prev, data]);
      } catch { /* ignore */ }
    });

    es.addEventListener('complete', (e) => {
      try {
        setComplete(JSON.parse((e as MessageEvent).data) as Complete);
      } catch { /* ignore */ }
      finishRun(es);
    });

    es.addEventListener('error', (e) => {
      const m = e as MessageEvent;
      if (m.data) {
        try {
          setError(JSON.parse(m.data).message ?? 'Stream error');
        } catch { setError('Stream error'); }
      } else if (es.readyState !== EventSource.CLOSED) {
        setError('Connection lost');
      }
      finishRun(es);
    });
  }

  function finishRun(es: EventSource) {
    es.close();
    sourceRef.current = null;
    setRunning(false);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); start(query); }} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={running}
          placeholder="Ask the agent something it needs to use tools to answer…"
          className="flex-1 bg-gray-900 border border-gray-800 focus:border-agent-600 focus:outline-none rounded-lg px-4 py-2.5 text-gray-100 placeholder-gray-600 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={running || !query.trim()}
          className="bg-agent-600 hover:bg-agent-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {running ? 'Running…' : 'Run Agent'}
        </button>
      </form>

      {steps.length === 0 && !running && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-600 self-center mr-1">Try:</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setQuery(s); start(s); }}
              className="text-xs bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-agent-700 text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-full transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden">
        <div className="border-b border-gray-800 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${running ? 'bg-agent-500 animate-pulse' : complete ? 'bg-agent-700' : 'bg-gray-700'}`}></span>
            <span className="text-xs font-mono text-gray-400">
              ReAct trace {running ? '· streaming' : complete ? `· ${complete.stepCount} steps in ${(complete.durationMs / 1000).toFixed(1)}s` : '· idle'}
            </span>
          </div>
        </div>

        <div ref={traceRef} className="px-4 py-3 max-h-96 overflow-y-auto space-y-3">
          {steps.length === 0 && !running && (
            <p className="text-gray-700 italic py-8 text-center text-sm">
              Submit a query — watch the agent reason, call tools, observe results, and synthesise an answer.
            </p>
          )}
          {steps.map((s, i) => <StepRow key={i} step={s} />)}
          {error && <div className="text-red-400 mt-2 text-sm">⨯ {error}</div>}
        </div>
      </div>

      {complete && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-gray-500 self-center">Tools called:</span>
          {complete.toolsUsed.map((t, i) => (
            <span key={i} className="bg-agent-900/40 text-agent-400 border border-agent-800 px-2 py-0.5 rounded font-mono">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StepRow({ step }: { step: Step }) {
  if (step.kind === 'thought') {
    return (
      <Row label="THOUGHT" color="text-blue-400">
        <p className="text-sm text-gray-200">{step.text}</p>
      </Row>
    );
  }
  if (step.kind === 'action') {
    return (
      <Row label="ACTION" color="text-yellow-400">
        <p className="text-sm">
          <span className="text-agent-400 font-mono">{step.tool}</span>
          <span className="text-gray-500">(</span>
          <span className="text-gray-300 font-mono text-xs">
            {step.args && Object.keys(step.args).length > 0
              ? JSON.stringify(step.args)
              : ''}
          </span>
          <span className="text-gray-500">)</span>
        </p>
      </Row>
    );
  }
  if (step.kind === 'observation') {
    return (
      <Row label="OBSERVE" color="text-gray-400">
        <pre className="text-xs text-gray-400 bg-gray-950/60 border border-gray-800 rounded px-2 py-1.5 overflow-x-auto font-mono">
          {JSON.stringify(step.result, null, 2)}
        </pre>
      </Row>
    );
  }
  if (step.kind === 'answer') {
    return (
      <Row label="ANSWER" color="text-agent-400">
        <div className="text-sm text-gray-100 leading-relaxed prose-invert">
          {renderAnswer(step.text ?? '')}
        </div>
      </Row>
    );
  }
  if (step.kind === 'system') {
    return (
      <Row label="SYSTEM" color="text-gray-500">
        <p className="text-sm text-gray-400">{step.text}</p>
      </Row>
    );
  }
  if (step.kind === 'error') {
    return (
      <Row label="ERROR" color="text-red-400">
        <p className="text-sm text-red-400">{step.text}</p>
      </Row>
    );
  }
  return null;
}

function Row({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className={`text-xs font-mono w-20 shrink-0 pt-0.5 ${color}`}>{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

/**
 * Render the final answer. Markdown is light here — bold (**…**) and inline
 * links ([text](url)). Avoids pulling in a full markdown lib for one usage.
 */
function renderAnswer(text: string) {
  const lines = text.split('\n\n');
  return (
    <>
      {lines.map((line, i) => (
        <p key={i} className="mb-2 last:mb-0" dangerouslySetInnerHTML={{ __html: lightMarkdown(line) }} />
      ))}
    </>
  );
}

function lightMarkdown(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
      const safe = /^https?:\/\//i.test(url) ? url : '#';
      return `<a href="${safe}" class="text-agent-400 hover:text-agent-300 underline" rel="noopener noreferrer">${text}</a>`;
    });
}
