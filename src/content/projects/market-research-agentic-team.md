---
title: "Market Research Agentic Team"
description: "End-to-end AI marketing pipeline in Python/Jupyter — multi-agent market research, internal product matching, AI image generation, copywriting, and an executive markdown report. Includes a reflection loop that monitors execution and dynamically revises the remaining plan."
techStack: ["Python", "Jupyter", "OpenAI", "Image Generation", "Markdown"]
agentLogicType: "Multi-Agent"
status: "prototype"
publishedAt: 2025-12-01
featured: false
---

A practical demonstration of AI orchestration and prompt-driven workflow automation: a multi-agent marketing pipeline that takes a product brief and returns a packaged executive report — research, matched catalogue items, generated imagery, copywriting, the lot.

## The pipeline

1. **Tool-enabled market research** — agents call out for external context and pull it back into the plan.
2. **Internal product catalogue matching** — finds the items in our own catalogue that best fit the brief.
3. **AI image generation** — produces creative assets keyed off the research and the matches.
4. **Copywriting** — drafts the marketing language for each asset.
5. **Executive packaging** — assembles a clean markdown report ready for stakeholders.

## Reflection-based planning loop

The thing that lifts this above a linear pipeline is the **reflection loop**: a planner monitors execution and dynamically rewrites the remaining plan when steps surface new information or fail. The agents don't just execute — they re-plan.

## Stack

Python + Jupyter notebooks, OpenAI for the language models and image generation, markdown for the final deliverable. Built to be read top-to-bottom in a notebook, not deployed as a service — the notebook *is* the artefact.

## Status

A research prototype that lives in a private notebook rather than on this site — the write-up above is the public summary.
