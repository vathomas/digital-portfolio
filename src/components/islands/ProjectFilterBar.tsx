import { useState } from 'react';

type AgentLogicType = 'ReAct' | 'Plan-and-Execute' | 'Multi-Agent' | 'Self-Correcting' | 'Tool-Use';

interface Project {
  slug: string;
  title: string;
  description: string;
  techStack: string[];
  agentLogicType: AgentLogicType;
  status: 'live' | 'wip' | 'prototype' | 'archived';
}

interface Props {
  projects: Project[];
}

const statusColors: Record<string, string> = {
  live: 'text-green-400',
  wip: 'text-yellow-400',
  prototype: 'text-blue-400',
  archived: 'text-gray-500',
};

const ALL = 'All';
const FILTERS: (AgentLogicType | typeof ALL)[] = [
  ALL, 'ReAct', 'Plan-and-Execute', 'Multi-Agent', 'Self-Correcting', 'Tool-Use',
];

export default function ProjectFilterBar({ projects }: Props) {
  const [active, setActive] = useState<AgentLogicType | typeof ALL>(ALL);

  const visible = active === ALL ? projects : projects.filter((p) => p.agentLogicType === active);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-8">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActive(f)}
            className={`text-xs px-3 py-1.5 rounded-full border font-mono transition-colors ${
              active === f
                ? 'bg-green-900/50 border-green-700 text-green-400'
                : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visible.map((p) => (
          <a
            key={p.slug}
            href={`/projects/${p.slug}`}
            className="block bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-green-700 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded border border-gray-700">
                {p.agentLogicType}
              </span>
              <span className={`text-xs font-mono ${statusColors[p.status]}`}>{p.status}</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-green-400 transition-colors">
              {p.title}
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">{p.description}</p>
            <div className="flex flex-wrap gap-2">
              {p.techStack.slice(0, 4).map((t) => (
                <span key={t} className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded">{t}</span>
              ))}
              {p.techStack.length > 4 && (
                <span className="text-xs text-gray-600">+{p.techStack.length - 4} more</span>
              )}
            </div>
          </a>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="text-gray-600 font-mono text-sm text-center py-12">
          No projects matching "{active}"
        </p>
      )}
    </div>
  );
}
