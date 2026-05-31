---
title: "Agent Playground"
description: "Live ReAct tool-use playground — Claude Haiku plans each turn against a small tool registry (weather, local time, portfolio recommender) and streams every thought, action, and observation over SSE."
techStack: ["Astro", "Vercel AI SDK", "Claude Haiku", "SSE", "React"]
agentLogicType: "ReAct"
status: "live"
publishedAt: 2026-05-15
featured: true
---

A focused single-page demo of the **ReAct** pattern: thought → action (tool call) → observation → repeat → answer. The agent reasons about the user's query, decides which tools to call, in what order, and synthesises the final response. Every step streams to the UI live.

## The loop

1. **Thought** — the planner LLM reads the user query, the tool registry, and the observation log so far, and writes a short reasoning step.
2. **Action** — the planner emits a structured tool call (name + JSON args). The router invokes the tool and captures the result.
3. **Observation** — the tool's JSON return is pushed onto the log and rendered in the trace.
4. **Repeat** until the planner emits a final answer.

## Tools

A small, deliberately scoped registry:

- `get_user_location` — derives the visitor's city / country / timezone from `x-vercel-ip-*` request headers.
- `get_weather` — current conditions for a place.
- `get_local_time` — current local time.
- `recommend_project` — returns the best-matching project from this portfolio for a given mood / theme.

## Real vs. mock mode

Real mode uses **Claude Haiku 4.5** as the planner — chosen for speed and low cost over depth, since each tool-use turn is small and the loop runs several iterations. If `ANTHROPIC_API_KEY` is missing or the model returns unparseable output, the agent falls back to a regex heuristic so the demo still works locally without an API key.

## Why a separate page

This used to be a tab at the bottom of the dashboard — it kept getting confused with the telemetry surface. The playground is its own thing: a live, single-purpose demonstration of tool-use, separate from the (placeholder) observability charts.
