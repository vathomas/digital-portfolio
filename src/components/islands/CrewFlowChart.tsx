import { useEffect, useRef, useState } from 'react';

export type CrewNode = 'start' | 'pm' | 'coder' | 'reviewer' | 'end';

interface Props {
  /** Currently-active node — gets the green highlight. */
  active: CrewNode | null;
  /** Nodes the token has already passed through — get a "done" style. */
  visited: CrewNode[];
  /** Current cycle number (informational). */
  cycle: number;
}

/**
 * Live flowchart for the Software Architect Crew. Re-renders the Mermaid
 * graph whenever the active node changes, applying classDef styles to
 * highlight the token-holder.
 */
export default function CrewFlowChart({ active, visited, cycle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mermaid, setMermaid] = useState<typeof import('mermaid').default | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Lazy-load mermaid on the client
  useEffect(() => {
    let cancelled = false;
    import('mermaid').then((mod) => {
      if (cancelled) return;
      mod.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'strict',
        flowchart: { curve: 'basis', padding: 12 },
        themeVariables: {
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: '13px',
        },
      });
      setMermaid(mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-render the diagram whenever state changes
  useEffect(() => {
    if (!mermaid || !containerRef.current) return;

    const diagram = buildDiagram(active, visited);
    const id = `crew-${Date.now()}`;
    let cancelled = false;

    mermaid
      .render(id, diagram)
      .then(({ svg }) => {
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setRenderError(null);
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Mermaid render failed';
        if (!cancelled) setRenderError(msg);
      });

    return () => {
      cancelled = true;
    };
  }, [mermaid, active, visited]);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden">
      <div className="border-b border-gray-800 px-4 py-2.5 flex items-center justify-between">
        <span className="text-xs font-mono text-gray-400">
          Crew flow {active ? `· ${active.toUpperCase()} holds the token` : '· idle'}
        </span>
        {cycle > 0 && (
          <span className="text-xs font-mono text-agent-500">cycle {cycle}</span>
        )}
      </div>
      <div className="p-4 min-h-[260px] flex items-center justify-center">
        {renderError ? (
          <p className="text-xs text-red-400 font-mono">⨯ {renderError}</p>
        ) : (
          <div ref={containerRef} className="w-full [&_svg]:max-w-full [&_svg]:h-auto" />
        )}
      </div>
    </div>
  );
}

/* ─────────────── diagram builder ─────────────── */

function buildDiagram(active: CrewNode | null, visited: CrewNode[]): string {
  const cls = (node: CrewNode) => {
    if (active === node) return ':::active';
    if (visited.includes(node)) return ':::done';
    return '';
  };

  // Note: classDef colours are applied with classDef + the :::class suffix.
  return `
graph LR
  Start([User Prompt])${cls('start')} --> PM[Product Manager]${cls('pm')}
  PM --> Coder[Coder]${cls('coder')}
  Coder --> Reviewer[Reviewer]${cls('reviewer')}
  Reviewer -->|REVISE| Coder
  Reviewer -->|APPROVE| End([Final Code])${cls('end')}

  classDef active fill:#22c55e,stroke:#16a34a,stroke-width:3px,color:#0b0f0d
  classDef done fill:#1f2937,stroke:#374151,color:#9ca3af
`.trim();
}
