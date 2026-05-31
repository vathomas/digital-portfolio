---
title: "Customer Service Agent"
description: "Prototype Python/Jupyter retail agent for sunglasses inventory and transactions — formal tool registry, argument canonicalisation, DuckDB over pandas, assertive validation, and propose-vs-commit transaction tooling driven by GPT-4o plan reflection."
techStack: ["Python", "Jupyter", "GPT-4o", "DuckDB", "pandas"]
agentLogicType: "Tool-Use"
status: "live"
publishedAt: 2025-11-01
repoUrl: "https://github.com/vathomas/customer-service-agent"
featured: false
---

A transactional retail assistant built as a working prototype. The agent manages a sunglasses catalogue — inventory queries, recommendations, holds, sales — through a small set of tools that take its job seriously.

## What makes it interesting

- **Formal tool registry** — every tool has a typed signature; the agent can't call something that isn't there.
- **Argument canonicalisation** — fuzzy product names get normalised against the catalogue before any tool runs, so the agent can't fail silently on a typo.
- **Assertive validation** — preconditions are checked at the tool boundary; bad calls fail loudly with structured errors the agent can recover from.
- **DuckDB over pandas** — analytical queries run in DuckDB against pandas DataFrames, giving the agent SQL ergonomics without the operational overhead of a database.
- **Propose-vs-commit transactions** — state-changing tools first *propose* the change and return a preview; the agent must explicitly *commit* before the inventory actually moves. Mirrors how a careful human would work a till.
- **Plan / execute / reflect** — GPT-4o drives plan reflection: after each step, it grades progress and revises the plan rather than blindly executing the original.

## Stack

Python + Jupyter, OpenAI **GPT-4o** for planning and reflection, DuckDB for analytical SQL, pandas as the in-memory store.

## Source

[github.com/vathomas/customer-service-agent](https://github.com/vathomas/customer-service-agent)
