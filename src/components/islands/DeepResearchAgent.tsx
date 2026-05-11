import { useState, useRef, useEffect } from 'react';

type Level = 'info' | 'thought' | 'action' | 'observation' | 'success' | 'error';

interface LogLine {
  ts: number;
  node: string;
  level: Level;
  text: string;
}

interface CompleteEvent {
  id: string;
  cost: { usd: number; tokens: number };
  durationMs: number;
  sourcesCount: number;
}

const SUGGESTIONS = [
  "NVIDIA H200 benchmarks vs H100",
  'Latest RAG techniques in production',
  'Agentic AI evaluation frameworks 2026',
];

// Manual research baseline used to compute "time saved"
const BASELINE_HOURS = 4;
const ANALYST_HOURLY_USD = 50;

export default function DeepResearchAgent() {
  const [topic, setTopic] = useState('');
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<CompleteEvent | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const logScrollRef = useRef<HTMLDivElement>(null);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  // Auto-scroll log
  useEffect(() => {
    logScrollRef.current?.scrollTo({ top: logScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  // Cleanup on unmount
  useEffect(() => () => {
    sourceRef.current?.close();
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  function start(topicValue: string) {
    const t = topicValue.trim();
    if (!t || running) return;

    setTopic(t);
    setLogs([]);
    setReport(null);
    setError(null);
    setElapsedMs(0);
    setRunning(true);

    startedAtRef.current = Date.now();
    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 100);

    const id = crypto.randomUUID();
    const url = `/api/research-stream?topic=${encodeURIComponent(t)}&id=${id}`;
    const es = new EventSource(url);
    sourceRef.current = es;

    // Native EventSource cannot surface the 429 status — when the middleware
    // rate-limits us, the connection closes immediately with no events. We
    // detect this by tracking whether ANY event arrived before the close.
    let receivedAny = false;

    es.addEventListener('thought', (e) => {
      receivedAny = true;
      try {
        const data = JSON.parse((e as MessageEvent).data) as LogLine;
        setLogs((prev) => [...prev, data]);
      } catch { /* ignore malformed */ }
    });

    es.addEventListener('complete', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as CompleteEvent;
        setReport(data);
      } catch { /* ignore */ }
      finishRun(es);
    });

    es.addEventListener('error', (e) => {
      // Could be either a server-emitted "error" event or a connection error
      const msgEvent = e as MessageEvent;
      if (msgEvent.data) {
        try {
          const parsed = JSON.parse(msgEvent.data);
          setError(parsed.message ?? 'Stream error');
        } catch {
          setError('Stream error');
        }
      } else if (es.readyState === EventSource.CLOSED) {
        // Closed before any event arrived → likely a rate-limit (429) or
        // an immediate server error. EventSource hides the status code,
        // so we hint at the most actionable cause.
        if (!receivedAny) {
          setError(
            'Connection refused before any output arrived. You may be hitting rate limits ' +
              '(3 research requests per hour). Please wait and try again.',
          );
        }
      } else {
        setError('Connection lost');
      }
      finishRun(es);
    });
  }

  function finishRun(es: EventSource) {
    es.close();
    sourceRef.current = null;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setRunning(false);
  }

  function abort() {
    sourceRef.current?.close();
    sourceRef.current = null;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setRunning(false);
    setLogs((prev) => [
      ...prev,
      { ts: Date.now(), node: 'system', level: 'error', text: '⛔ Aborted by user.' },
    ]);
  }

  // Derived metrics
  const elapsedS = elapsedMs / 1000;
  const cost = report?.cost.usd ?? mockProgressiveCost(elapsedMs);
  const tokens = report?.cost.tokens ?? Math.round(elapsedMs * 0.5);
  const sources = report?.sourcesCount ?? Math.min(9, Math.floor(elapsedS / 3));
  const timeSavedSec = Math.max(0, BASELINE_HOURS * 3600 - elapsedS);
  const dollarSaved = ANALYST_HOURLY_USD * BASELINE_HOURS - cost;

  return (
    <div className="space-y-6">
      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(topic);
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={running}
          placeholder="Research topic, e.g. 'NVIDIA H200 benchmarks'…"
          className="flex-1 bg-gray-900 border border-gray-800 focus:border-agent-600 focus:outline-none rounded-lg px-4 py-2.5 text-gray-100 placeholder-gray-600 disabled:opacity-60"
        />
        {running ? (
          <button
            type="button"
            onClick={abort}
            className="bg-red-700 hover:bg-red-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Abort
          </button>
        ) : (
          <button
            type="submit"
            disabled={!topic.trim()}
            className="bg-agent-600 hover:bg-agent-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Run Research
          </button>
        )}
      </form>

      {/* Suggestion chips */}
      {logs.length === 0 && !running && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-600 self-center mr-1">Try:</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setTopic(s);
                start(s);
              }}
              className="text-xs bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-agent-700 text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-full transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Two-column: log + metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Live log (left, 2/3) */}
        <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-950 overflow-hidden">
          <div className="border-b border-gray-800 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${running ? 'bg-agent-500 animate-pulse' : report ? 'bg-agent-700' : 'bg-gray-700'}`}></span>
              <span className="text-xs font-mono text-gray-400">
                Live thought stream {running ? '· streaming' : report ? '· complete' : '· idle'}
              </span>
            </div>
          </div>
          <div ref={logScrollRef} className="px-4 py-3 h-80 overflow-y-auto font-mono text-xs space-y-1">
            {logs.length === 0 && !running && (
              <p className="text-gray-700 italic py-8 text-center">
                Submit a topic to begin. The agent will plan, search, fact-check, summarize, and emit a PDF report — streaming each thought live.
              </p>
            )}
            {logs.map((log, i) => (
              <LogRow key={i} log={log} />
            ))}
            {error && (
              <div className="text-red-400 mt-2">⨯ {error}</div>
            )}
          </div>
        </div>

        {/* Metrics (right, 1/3) */}
        <div className="space-y-3">
          <MetricCard label="Time elapsed" value={`${elapsedS.toFixed(1)}s`} accent={running} />
          <MetricCard
            label="Time saved vs analyst"
            value={formatDuration(timeSavedSec)}
            sublabel={`baseline: ${BASELINE_HOURS}h manual research`}
          />
          <MetricCard
            label="Cost per report"
            value={`$${cost.toFixed(3)}`}
            sublabel={`${tokens.toLocaleString()} tokens`}
          />
          <MetricCard
            label="Cost saved"
            value={`$${dollarSaved.toFixed(2)}`}
            sublabel={`vs $${ANALYST_HOURLY_USD}/hr analyst`}
          />
          <MetricCard label="Sources verified" value={String(sources)} />
        </div>
      </div>

      {/* PDF download — appears when complete */}
      {report && (
        <div className="rounded-xl border border-agent-800 bg-agent-900/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-white font-semibold">Report ready</p>
            <p className="text-sm text-gray-400">
              ID: <span className="font-mono text-xs">{report.id}</span> · {report.sourcesCount} sources
            </p>
          </div>
          <a
            href={`/api/research-pdf?id=${report.id}`}
            className="bg-agent-600 hover:bg-agent-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            ↓ Download PDF
          </a>
        </div>
      )}
    </div>
  );
}

/* ────────────────────── helper components ────────────────────── */

function LogRow({ log }: { log: LogLine }) {
  const time = new Date(log.ts).toLocaleTimeString('en-GB', { hour12: false });
  const prefix = labelFor(log.level);
  const color = colorFor(log.level);

  return (
    <div className="flex gap-2 leading-relaxed">
      <span className="text-gray-700 shrink-0">{time}</span>
      <span className={`${color} shrink-0 w-20`}>{prefix}</span>
      <span className="text-gray-300 break-words">{log.text}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sublabel,
  accent = false,
}: {
  label: string;
  value: string;
  sublabel?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-lg border bg-gray-900/60 px-4 py-3 ${accent ? 'border-agent-700' : 'border-gray-800'}`}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-semibold ${accent ? 'text-agent-400' : 'text-white'}`}>{value}</p>
      {sublabel && <p className="text-[11px] text-gray-600 mt-0.5">{sublabel}</p>}
    </div>
  );
}

function labelFor(level: Level): string {
  switch (level) {
    case 'info': return 'INFO';
    case 'thought': return 'THOUGHT';
    case 'action': return 'ACTION';
    case 'observation': return 'OBSERVE';
    case 'success': return 'OK';
    case 'error': return 'ERROR';
  }
}

function colorFor(level: Level): string {
  switch (level) {
    case 'info': return 'text-gray-500';
    case 'thought': return 'text-blue-400';
    case 'action': return 'text-yellow-400';
    case 'observation': return 'text-gray-500';
    case 'success': return 'text-agent-400';
    case 'error': return 'text-red-400';
  }
}

function formatDuration(sec: number): string {
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  }
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}m ${s}s`;
  }
  return `${sec.toFixed(0)}s`;
}

// Cosmetic: trickle the cost upward as time elapses, so the dashboard isn't static
// during the run. Caps below the typical mock-mode total.
function mockProgressiveCost(ms: number): number {
  const ratio = Math.min(1, ms / 30000);
  return ratio * 0.04;
}
