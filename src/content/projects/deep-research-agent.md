---
title: "Deep Research Agent"
description: "An autonomous agent that browses, fact-checks, and generates a PDF report on any topic — with live WebSocket thought streaming and per-report cost metrics."
techStack: ["LangChain", "WebSockets", "pdf-lib", "FastAPI", "OpenAI"]
agentLogicType: "ReAct"
status: "wip"
publishedAt: 2025-07-01
featured: true
---

A "Market Intelligence" agent that handles long-running autonomous research tasks. The user types a topic — for example, "NVIDIA H200 vs H100 benchmarks" — and the agent does the rest.

## What It Does

The agent runs a **ReAct loop** (Reason + Act):
- Searches ArXiv, web sources, and structured data APIs
- Fact-checks sources against each other
- Synthesises findings into a structured PDF report

## Live Thought Stream

As the agent works, every internal step is streamed to the UI via **WebSockets**:

```
Thought: Searching ArXiv for H200 benchmarks...
Action: fetch_arxiv("NVIDIA H200 inference benchmark 2024")
Thought: Source A and Source B conflict on FLOPS. Fact-checking...
Action: cross_reference_sources(...)
Thought: Confidence sufficient. Generating summary...
```

This turns the waiting time into a demonstration of agentic reasoning.

## Metrics on the Card

Every completed report displays **Cost per Report** (token usage × model price) and **estimated Time Saved** versus manual research — making the value proposition concrete and measurable.
