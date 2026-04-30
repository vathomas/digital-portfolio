---
title: "Agent Skills Dashboard"
description: "Performance charts comparing GPT-4o vs. Llama 3 across my agents, tool-use accuracy metrics, and a live playground to trigger real agent actions."
techStack: ["Recharts", "Postgres", "OpenAI", "Llama 3", "Astro", "FastAPI"]
agentLogicType: "Tool-Use"
status: "wip"
publishedAt: 2025-09-01
featured: true
---

A high-signal technical showcase: rather than claiming AI expertise, this dashboard shows the data from running my agents in production over time.

## Key Charts

**Success Rate vs. Latency**
Scatter plot comparing GPT-4o and a locally-hosted Llama 3 across agent tasks. Shows the cost/speed/quality tradeoff I've benchmarked directly — not theoretical numbers.

**Tool Usage Accuracy**
Bar chart showing how often each agent correctly selected and called the right custom API tool versus falling back or hallucinating a tool call. Broken down by task type.

## Live Playground

A "Playground" section lets visitors trigger a real tool-use event:

> "Agent, get the weather in my location and recommend a project from my portfolio based on the current mood."

The agent calls a weather API, reasons about the result, and returns a personalised project recommendation — with the full tool-call trace visible below the response.

## Data Source

All metrics come from logged agent runs stored in **Postgres**, populated by the other three showcases as they run. The dashboard is the observability layer for the entire portfolio.
