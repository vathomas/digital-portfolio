---
title: "Recursive Portfolio Chatbot"
description: "A self-correcting RAG agent that answers questions about my background using a LangGraph correction loop — with a 'See Thoughts' toggle showing internal reasoning."
techStack: ["LangGraph", "Vercel AI SDK", "Postgres", "pgvector", "React"]
agentLogicType: "Self-Correcting"
status: "wip"
publishedAt: 2025-06-01
featured: true
# Ragas scores are placeholders until the CI eval gate (Phase 3 Step 8b)
# runs the suite against the live preview URL and overwrites these values.
# The shape and the UI rendering are the deliverable here.
ragas:
  faithfulness: 0.91
  answer_relevancy: 0.88
  context_precision: 0.85
  context_recall: 0.79
  evaluatedAt: 2026-05-09
  questionCount: 50
  preliminary: true
---

An "About Me" page on steroids. Instead of a static bio, visitors chat with an agent that retrieves context from my resume, GitHub activity, and project descriptions.

## The Correction Loop

The agent uses a **LangGraph** correction loop:

1. **Retrieve** — fetch context from pgvector embeddings of my resume and GitHub
2. **Grade** — a grader LLM asks: "Does this actually answer the question?"
3. **Rewrite** — if "No", the query is rewritten and the loop retries
4. **Respond** — only answers the visitor when confident

## "See Thoughts" Toggle

A toggle next to the chat exposes the agent's internal JSON reasoning trace in real time — showing exactly which retrieval step fired, what the grader scored, and why the query was rewritten. This is the transparency feature that makes it a portfolio piece, not just a chatbot.

## Tech Choices

- **LangGraph** for the stateful correction loop
- **Vercel AI SDK** for streaming responses to the React island
- **Postgres + pgvector** for semantic memory (resume, GitHub, project writeups)
