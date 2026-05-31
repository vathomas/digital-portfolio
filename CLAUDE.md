# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Dev server at http://localhost:4321
npm run build      # Production build to ./dist/
npm run preview    # Serve the production build locally
npm run astro check  # Type-check all .astro files
```

## Architecture

**Astro v6** static site with **React islands** for interactivity and **Tailwind v4** for styling.

### Key Astro v6 Differences from Earlier Versions
- Content config lives at `src/content.config.ts` (NOT `src/content/config.ts`)
- Collections use the `glob()` loader: `loader: glob({ pattern: '**/*.md', base: './src/content/projects' })`
- Collection entries use `.id` not `.slug`
- `render()` is a named import from `astro:content`, not a method on the entry: `const { Content } = await render(project)`
- Tailwind is wired as a Vite plugin (`@tailwindcss/vite`), not via `@astrojs/tailwind` (which doesn't support v6)

### Styling
Tailwind v4 — the theme is extended in `src/styles/global.css` using `@theme {}` blocks (not `tailwind.config.*`). The custom `agent-*` green color palette is defined there. `global.css` is imported in `BaseLayout.astro`.

### Content Collections
Project entries live in `src/content/projects/*.md`. The schema is in `src/content.config.ts` and enforces: `title`, `description`, `techStack[]`, `agentLogicType` (enum), `status` (enum: `live` | `wip` | `prototype` | `archived`), `publishedAt`, `featured`, plus optional `demoUrl`, `repoUrl`, and a `ragas` block.

### Islands
React components in `src/components/islands/` are the only interactive parts. All of the Phase 2 islands below are built; each sets its hydration directive at the call site in its `.astro` page:
- `AgentChatWidget.tsx` — `client:load` (self-correcting RAG chat, used on `/chat`)
- `ProjectFilterBar.tsx` — `client:idle` (filterable project grid, used on `/projects`)
- `DeepResearchAgent.tsx` — `client:load` (plan-and-execute research agent, used on `/research`)
- `CrewOrchestrator.tsx` + `CrewFlowChart.tsx` — `client:load` (multi-agent crew + live Mermaid flowchart, used on `/crew`)
- `AgentPlayground.tsx` — `client:load` (ReAct tool-use playground, used on `/playground`)
- `AgentDashboard.tsx` — `client:load` (telemetry/observability UI, used on `/dashboard`)

Agent logic for the in-site showcases lives under `src/lib/agent/` (`graph.ts`, `research-graph.ts`, `crew-graph.ts`, `playground-graph.ts`); these call Claude via the Vercel AI SDK when `ANTHROPIC_API_KEY` is set. The playground planner and the RAG retrieval layer (`knowledge.ts`) degrade to deterministic mock/offline output without keys; the research search node falls back to offline stubs without `TAVILY_API_KEY`.

### Page Routes
| Route | Purpose |
|---|---|
| `/` | Hero + featured showcase cards (static) |
| `/projects` | Full list with `ProjectFilterBar` island |
| `/projects/[slug]` | Individual project detail via `getStaticPaths` |
| `/about` | Bio, experience, skills + a CTA card linking to `/chat` |
| `/chat` | Showcase 1 — `AgentChatWidget` island |
| `/research` | Showcase 2 — `DeepResearchAgent` island |
| `/crew` | Showcase 3 — `CrewOrchestrator` island |
| `/playground` | Showcase 4 — `AgentPlayground` island |
| `/dashboard` | Showcase 5 (wip) — `AgentDashboard` island |
| `/certifications` | Certifications list |

### Layouts
- `BaseLayout.astro` — HTML shell, nav, footer, imports `global.css`
- `ProjectLayout.astro` — Wraps project detail pages, renders metadata header

### API Routes
Server routes live under `src/pages/api/` (all `export const prerender = false`):
- `chat.ts` — POST, runs the RAG correction loop for `/chat`
- `research-stream.ts` — SSE, streams the research agent's thoughts; `research-pdf.ts` serves the generated PDF
- `crew-stream.ts` — SSE, streams the multi-agent crew's events
- `playground-stream.ts` — SSE, streams the ReAct trace

Keep island components as thin UI wrappers; all AI logic belongs in these API routes or `src/lib/agent/`. Requests are rate-limited per-tier in `src/middleware.ts` (Upstash); inputs are length-validated server-side before any model/tool call.
