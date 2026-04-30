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
Project entries live in `src/content/projects/*.md`. The schema is in `src/content.config.ts` and enforces: `title`, `description`, `techStack[]`, `agentLogicType` (enum), `status` (enum), `publishedAt`, `featured`.

### Islands
React components in `src/components/islands/` are the only interactive parts. Each island has a specific hydration directive set at the call site in `.astro` pages:
- `AgentChatWidget.tsx` — `client:load` (chat, used on `/about`)
- `ProjectFilterBar.tsx` — `client:idle` (filterable project grid, used on `/projects`)
- `AgentDashboard.tsx` — `client:visible` (metrics dashboard, used on `/dashboard`)

Phase 2 islands (`DeepResearchAgent`, `CrewOrchestrator`, `AgentFlowChart`) are planned but not yet created.

### Page Routes
| Route | Purpose |
|---|---|
| `/` | Hero + featured project cards (static) |
| `/projects` | Full list with `ProjectFilterBar` island |
| `/projects/[slug]` | Individual project detail via `getStaticPaths` |
| `/about` | `AgentChatWidget` island placeholder |
| `/research` | Phase 2 placeholder |
| `/crew` | Phase 2 placeholder |
| `/dashboard` | `AgentDashboard` island placeholder |

### Layouts
- `BaseLayout.astro` — HTML shell, nav, footer, imports `global.css`
- `ProjectLayout.astro` — Wraps project detail pages, renders metadata header

### Future API Routes
When wiring Phase 2 AI backends, add server routes under `src/pages/api/`. Keep island components as thin UI wrappers; all AI logic belongs in API routes or external services.
