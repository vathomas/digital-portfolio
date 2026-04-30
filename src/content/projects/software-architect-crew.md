---
title: "Software Architect Crew"
description: "A 3-agent crew that takes a product prompt to reviewed code — PM, Coder, and Reviewer — with a live Mermaid.js flowchart showing which agent holds the token."
techStack: ["LangGraph", "CrewAI", "Mermaid.js", "OpenAI", "WebSockets"]
agentLogicType: "Multi-Agent"
status: "wip"
publishedAt: 2025-08-01
featured: true
---

A demonstration of multi-agent orchestration: three specialized agents collaborate to go from a natural-language product prompt to reviewed, deployable code.

## The Crew

| Agent | Role |
|---|---|
| **Product Manager** | Interprets the prompt, writes structured requirements |
| **Coder** | Generates Python or TypeScript implementation |
| **Reviewer** | Finds bugs, flags issues, and routes back to Coder if needed |

The feedback loop between Reviewer → Coder mirrors real engineering team dynamics — the agent crew self-corrects until the Reviewer approves.

## Visual Proof: Live Flowchart

A **Mermaid.js** flowchart rendered inside the Astro page highlights which agent currently "holds the token" — updating in real time via WebSocket events. The chart makes the orchestration legible to non-technical visitors.

## Why This Matters

This project draws directly on my experience as a **Scrum Master** at the Bank of England — translating the human ceremonies of sprint planning, refinement, and review into an automated multi-agent workflow.
