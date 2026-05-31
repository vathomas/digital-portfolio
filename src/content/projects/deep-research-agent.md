---
title: "Deep Research Agent"
description: "A plan-and-execute autonomous research agent — decomposes a topic, searches sources, cross-references findings, and emits a downloadable PDF. Every node streams its thoughts over SSE so the live trace is the demo."
techStack: ["Astro", "Vercel AI SDK", "Claude Sonnet", "pdf-lib", "SSE"]
agentLogicType: "Plan-and-Execute"
status: "live"
publishedAt: 2025-07-01
featured: true
---

A "Market Intelligence" agent that handles long-running autonomous research tasks. The user types a topic — for example, "NVIDIA H200 vs H100 benchmarks" — and the agent plans the work, runs it, and packages a PDF.

## The pipeline

`plan → search(×N) → factcheck → summarize → cost`

Implemented as an async generator that yields thought events at every step. The Astro API route consumes the generator and pipes each event to the browser over Server-Sent Events.

## Live thought stream

As the agent works, every internal step appears in the UI:

```
plan       Decomposing topic into 4 sub-questions…
search     Querying source A for "H200 inference benchmarks"
observe    Found 3 candidate sources
factcheck  Source A and Source B disagree on FLOPS — cross-referencing
summarize  Drafting executive summary…
cost       Tokens: 8,412 (≈ $0.07) · Duration: 11.3s
```

This turns the waiting time into a demonstration of agentic reasoning.

## Tech choices

- **Astro API route** with an async generator — no separate Python backend, no WebSocket plumbing. SSE is enough.
- **Vercel AI SDK (`ai`)** for LLM calls. Synthesis uses **Claude Sonnet 4.5**; the cheaper steps (planning, search drafting, fact-check grading) use **Claude Haiku 4.5**.
- **`pdf-lib`** generates the final report server-side — pure JavaScript, no external services. Cover page, executive summary, sources, citations, and run metadata.
- **Cost tracking** — per-node token counts are tallied against published API rates and shown on the completion card.

## Mock mode

Currently demos with deterministic mock sources so the SSE protocol and PDF pipeline can be exercised without external dependencies. Real-mode swap-points are marked in the source for the search backend.
