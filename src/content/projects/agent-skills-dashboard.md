---
title: "Agent Skills Dashboard"
description: "Sample observability UI for agent runs — KPI strip, model latency-vs-success scatter, and per-tool accuracy. Metrics are placeholders today; the page is the aggregation surface that would sit over a production telemetry table."
techStack: ["Astro", "React", "Recharts", "TypeScript", "Tailwind v4"]
agentLogicType: "Tool-Use"
status: "wip"
publishedAt: 2025-09-01
featured: true
---

> **Sample observability UI — metrics are placeholders.** The dashboard renders
> from a static TypeScript mock dataset, not a live telemetry pipeline. The
> intent is to show the observability *surface* — what aggregations matter and
> how they're laid out — not to claim live production numbers.

A high-signal technical showcase of what an observability layer for the other portfolio agents would look like, rendered against a representative mock dataset.

## What's on the page

**KPI strip** — total runs, weighted success rate, weighted average latency, and tool accuracy across all models in the dataset.

**Success Rate vs. Latency (scatter)** — each dot is a model, sized by total runs. Reveals the latency-vs-quality frontier: cloud models cluster top-right (slower, more accurate); local Llama variants trade quality for speed and cost.

**Tool Usage Accuracy (bar)** — per-tool success rate across all agent invocations in the dataset, sorted descending.

**Model breakdown table** — model · hosting (cloud/local) · success · latency · runs · cost per 1k runs, with horizontal scroll on phones.

## Live playground

The ReAct tool-use playground used to live at the bottom of this page; it now has its own route at **`/playground`**. Submit a query and watch the agent's thoughts, tool calls, and observations stream in over SSE.

## Data Source

Today: a static module at `src/lib/agent/dashboard-data.ts` exports `MODELS`, `TOOLS`, and a `summarize()` aggregation, with numbers chosen to look plausible for the model families involved.

Planned: every agent run from the other showcases writes a row to a Postgres `agent_runs` table — model, tool calls, latency, success, cost — and this page becomes a thin read-only aggregation layer over it.
