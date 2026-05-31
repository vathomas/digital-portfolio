---
title: "Software Architect Crew"
description: "A 3-agent crew (PM → Coder → Reviewer) that takes a product prompt to reviewed code. Mermaid.js flowchart shows which agent currently holds the token; each agent's reasoning streams live over SSE."
techStack: ["Astro", "Vercel AI SDK", "Claude Sonnet", "Mermaid.js", "SSE"]
agentLogicType: "Multi-Agent"
status: "live"
publishedAt: 2025-08-01
featured: true
---

A demonstration of multi-agent orchestration: three specialised agents collaborate to go from a natural-language product prompt to reviewed code in Python or TypeScript.

## The crew

| Agent | Role | Model |
|---|---|---|
| **Product Manager** | Interprets the prompt, writes structured requirements | Claude Haiku 4.5 |
| **Coder** | Generates implementation from the requirements | Claude Sonnet 4.5 |
| **Reviewer** | Finds bugs and decides `REVISE` vs `APPROVE` | Claude Haiku 4.5 |

The feedback loop between Reviewer and Coder mirrors a real engineering team — the crew self-corrects until the Reviewer approves (capped at a sensible max cycles).

## Visual proof: live flowchart

A **Mermaid.js** flowchart rendered inside the Astro page highlights which agent currently "holds the token" — updating in real time as the SSE stream emits state events. The chart makes the orchestration legible to non-technical visitors.

## Tech choices

- **Custom orchestrator** as an async generator — no third-party multi-agent framework. The graph is small enough that explicit code is clearer than a runtime abstraction.
- **Vercel AI SDK (`ai`)** for all model calls. Quality work (code generation) routes to Claude Sonnet; fast structured work (requirements, review) routes to Claude Haiku.
- **Server-Sent Events** for the live trace — every thought, every state transition, every artifact streams to the browser as the run progresses.
- **Mermaid.js** renders the flowchart client-side, fed by the live `state` events.

## Why this matters

This project draws on my experience as a **Scrum Master** at the Bank of England — translating the human ceremonies of sprint planning, refinement, and review into an automated multi-agent workflow you can watch run end-to-end.
