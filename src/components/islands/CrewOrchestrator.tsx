import { useState, useRef, useEffect } from 'react';
import CrewFlowChart, { type CrewNode } from './CrewFlowChart';

type Level = 'info' | 'thought' | 'action' | 'success' | 'warn' | 'error';
type AgentId = 'pm' | 'coder' | 'reviewer' | 'system';
type Verdict = 'REVISE' | 'APPROVE';

interface ThoughtPayload {
  ts: number;
  agent: AgentId;
  level: Level;
  text: string;
}

interface StatePayload {
  ts: number;
  active: CrewNode;
  cycle: number;
}

interface RequirementsArtifact {
  goal: string;
  acceptance: string[];
  edgeCases: string[];
}

interface CodeArtifact {
  language: 'python' | 'typescript';
  code: string;
  notes?: string;
}

interface ReviewArtifact {
  verdict: Verdict;
  issues: { severity: 'major' | 'minor'; text: string }[];
}

interface ArtifactPayload {
  kind: 'requirements' | 'code' | 'review';
  agent: AgentId;
  cycle: number;
  data?: RequirementsArtifact | CodeArtifact;
  verdict?: Verdict;
  issues?: { severity: 'major' | 'minor'; text: string }[];
}

interface CompletePayload {
  cycles: number;
  durationMs: number;
  language: 'python' | 'typescript';
  finalCode: CodeArtifact;
}

const SUGGESTIONS = [
  'A function that splits a comma-separated string into parts',
  'A debounce function for a search box',
  'A function that returns the nth Fibonacci number',
];

export default function CrewOrchestrator() {
  const [prompt, setPrompt] = useState('');
  const [language, setLanguage] = useState<'python' | 'typescript'>('typescript');
  const [running, setRunning] = useState(false);
  const [activeNode, setActiveNode] = useState<CrewNode | null>(null);
  const [visitedNodes, setVisitedNodes] = useState<CrewNode[]>([]);
  const [cycle, setCycle] = useState(0);

  const [logs, setLogs] = useState<ThoughtPayload[]>([]);
  const [requirements, setRequirements] = useState<RequirementsArtifact | null>(null);
  const [codeVersions, setCodeVersions] = useState<{ cycle: number; data: CodeArtifact }[]>([]);
  const [reviews, setReviews] = useState<{ cycle: number; verdict: Verdict; issues: ReviewArtifact['issues'] }[]>([]);
  const [completion, setCompletion] = useState<CompletePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const logScrollRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<EventSource | null>(null);

  // Auto-scroll log
  useEffect(() => {
    logScrollRef.current?.scrollTo({ top: logScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  useEffect(() => () => sourceRef.current?.close(), []);

  function start(p: string) {
    const t = p.trim();
    if (!t || running) return;

    // Reset state for a new run
    setPrompt(t);
    setLogs([]);
    setRequirements(null);
    setCodeVersions([]);
    setReviews([]);
    setCompletion(null);
    setError(null);
    setActiveNode('start');
    setVisitedNodes([]);
    setCycle(0);
    setRunning(true);

    const url = `/api/crew-stream?prompt=${encodeURIComponent(t)}&language=${language}`;
    const es = new EventSource(url);
    sourceRef.current = es;

    es.addEventListener('thought', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as ThoughtPayload;
        setLogs((prev) => [...prev, data]);
      } catch { /* ignore */ }
    });

    es.addEventListener('state', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as StatePayload;
        setActiveNode(data.active);
        setCycle(data.cycle);
        setVisitedNodes((prev) => (prev.includes(data.active) ? prev : [...prev, data.active]));
      } catch { /* ignore */ }
    });

    es.addEventListener('artifact', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as ArtifactPayload;
        if (data.kind === 'requirements' && data.data) {
          setRequirements(data.data as RequirementsArtifact);
        } else if (data.kind === 'code' && data.data) {
          setCodeVersions((prev) => [...prev, { cycle: data.cycle, data: data.data as CodeArtifact }]);
        } else if (data.kind === 'review' && data.verdict) {
          setReviews((prev) => [...prev, { cycle: data.cycle, verdict: data.verdict!, issues: data.issues ?? [] }]);
        }
      } catch { /* ignore */ }
    });

    es.addEventListener('complete', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as CompletePayload;
        setCompletion(data);
      } catch { /* ignore */ }
      finishRun(es);
    });

    es.addEventListener('error', (e) => {
      const msgEvent = e as MessageEvent;
      if (msgEvent.data) {
        try {
          const parsed = JSON.parse(msgEvent.data);
          setError(parsed.message ?? 'Stream error');
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
    setActiveNode((cur) => (cur === 'end' ? cur : 'end'));
    setRunning(false);
  }

  return (
    <div className="space-y-6">
      {/* Composer */}
      <form onSubmit={(e) => { e.preventDefault(); start(prompt); }} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={running}
          placeholder="Describe a function for the crew to build…"
          className="flex-1 bg-gray-900 border border-gray-800 focus:border-agent-600 focus:outline-none rounded-lg px-4 py-2.5 text-gray-100 placeholder-gray-600 disabled:opacity-60"
        />
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as 'python' | 'typescript')}
          disabled={running}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-gray-200 text-sm font-mono disabled:opacity-60"
        >
          <option value="typescript">TypeScript</option>
          <option value="python">Python</option>
        </select>
        <button
          type="submit"
          disabled={running || !prompt.trim()}
          className="bg-agent-600 hover:bg-agent-500 disabled:bg-gray-800 disabled:text-gray-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {running ? 'Running…' : 'Dispatch Crew'}
        </button>
      </form>

      {/* Suggestions */}
      {logs.length === 0 && !running && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-600 self-center mr-1">Try:</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setPrompt(s); start(s); }}
              className="text-xs bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-agent-700 text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-full transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Two-column: flowchart + log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CrewFlowChart active={activeNode} visited={visitedNodes} cycle={cycle} />

        {/* Live log */}
        <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden">
          <div className="border-b border-gray-800 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${running ? 'bg-agent-500 animate-pulse' : completion ? 'bg-agent-700' : 'bg-gray-700'}`}></span>
              <span className="text-xs font-mono text-gray-400">
                Crew transcript {running ? '· streaming' : completion ? '· complete' : '· idle'}
              </span>
            </div>
          </div>
          <div ref={logScrollRef} className="px-4 py-3 h-[260px] overflow-y-auto font-mono text-xs space-y-1">
            {logs.length === 0 && !running && (
              <p className="text-gray-700 italic py-8 text-center">Dispatch the crew to begin.</p>
            )}
            {logs.map((log, i) => <LogRow key={i} log={log} />)}
            {error && <div className="text-red-400 mt-2">⨯ {error}</div>}
          </div>
        </div>
      </div>

      {/* Artifacts */}
      {requirements && (
        <ArtifactCard
          agent="pm"
          title="Product Manager — Requirements"
          subtitle={requirements.goal}
        >
          <div className="space-y-3">
            <Section label="Acceptance criteria" items={requirements.acceptance} />
            <Section label="Edge cases" items={requirements.edgeCases} />
          </div>
        </ArtifactCard>
      )}

      {codeVersions.map((v, i) => {
        const review = reviews[i];
        return (
          <div key={i} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ArtifactCard
              agent="coder"
              title={`Coder — Draft v${v.cycle}`}
              subtitle={v.data.notes ?? `${v.data.language} · cycle ${v.cycle}`}
            >
              <pre className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs leading-relaxed overflow-x-auto text-gray-200 font-mono">
                <code>{v.data.code}</code>
              </pre>
            </ArtifactCard>

            {review && (
              <ArtifactCard
                agent="reviewer"
                title={`Reviewer — Cycle ${review.cycle}`}
                subtitle={review.verdict === 'APPROVE' ? '✅ Approved for merge' : `↺ ${review.issues.length} issue(s) flagged`}
                accent={review.verdict === 'APPROVE' ? 'success' : 'warn'}
              >
                {review.issues.length > 0 ? (
                  <ul className="space-y-1.5">
                    {review.issues.map((iss, j) => (
                      <li key={j} className="text-sm text-gray-300 flex gap-2">
                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded shrink-0 ${
                          iss.severity === 'major'
                            ? 'bg-red-900/40 text-red-400 border border-red-800'
                            : 'bg-yellow-900/30 text-yellow-400 border border-yellow-800'
                        }`}>
                          {iss.severity}
                        </span>
                        <span>{iss.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-agent-400">All checks pass. No issues to address.</p>
                )}
              </ArtifactCard>
            )}
          </div>
        );
      })}

      {/* Completion banner */}
      {completion && (
        <div className="rounded-xl border border-agent-800 bg-agent-900/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-white font-semibold">Crew shipped final code</p>
            <p className="text-sm text-gray-400">
              {completion.cycles} cycle{completion.cycles === 1 ? '' : 's'} · {(completion.durationMs / 1000).toFixed(1)}s · {completion.language}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── helper components ─────────────── */

function LogRow({ log }: { log: ThoughtPayload }) {
  const time = new Date(log.ts).toLocaleTimeString('en-GB', { hour12: false });
  return (
    <div className="flex gap-2 leading-relaxed">
      <span className="text-gray-700 shrink-0">{time}</span>
      <span className={`shrink-0 w-16 ${agentColor(log.agent)}`}>{log.agent.toUpperCase()}</span>
      <span className={`shrink-0 w-16 ${levelColor(log.level)}`}>{log.level.toUpperCase()}</span>
      <span className="text-gray-300 break-words">{log.text}</span>
    </div>
  );
}

function ArtifactCard({
  agent,
  title,
  subtitle,
  children,
  accent = 'default',
}: {
  agent: AgentId;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accent?: 'default' | 'success' | 'warn';
}) {
  const borderColor =
    accent === 'success' ? 'border-agent-800' :
    accent === 'warn' ? 'border-yellow-800/60' :
    'border-gray-800';
  return (
    <div className={`rounded-xl border ${borderColor} bg-gray-900/40 overflow-hidden`}>
      <div className="border-b border-gray-800 px-4 py-2.5 flex items-center gap-2">
        <span className={`text-xs font-mono ${agentColor(agent)}`}>{agent.toUpperCase()}</span>
        <span className="text-gray-700">·</span>
        <span className="text-sm text-white font-medium">{title}</span>
      </div>
      <div className="px-4 py-3 space-y-2">
        {subtitle && <p className="text-xs text-gray-500 italic">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

function Section({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">{label}</p>
      <ul className="space-y-0.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-gray-300 flex gap-2">
            <span className="text-gray-700">›</span>{it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function agentColor(agent: AgentId): string {
  switch (agent) {
    case 'pm': return 'text-purple-400';
    case 'coder': return 'text-agent-400';
    case 'reviewer': return 'text-yellow-400';
    case 'system': return 'text-gray-500';
  }
}

function levelColor(level: Level): string {
  switch (level) {
    case 'info': return 'text-gray-500';
    case 'thought': return 'text-blue-400';
    case 'action': return 'text-yellow-400';
    case 'success': return 'text-agent-400';
    case 'warn': return 'text-orange-400';
    case 'error': return 'text-red-400';
  }
}
