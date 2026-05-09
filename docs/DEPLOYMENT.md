# Deployment guide

This document is the click-by-click runbook for taking the portfolio from local dev to a production Vercel deployment with all four showcases in real mode. Everything below is one-time setup unless marked otherwise.

If you only want to demo locally, skip to the bottom: [§7 Local development](#7-local-development) — only `ANTHROPIC_API_KEY` is required and every showcase has a mock-mode fallback.

---

## Variable reference

The full env-var contract lives in [`.env.example`](../.env.example). Brief recap:

| Variable | Used by | Required for production? |
|---|---|---|
| `ANTHROPIC_API_KEY` | All four showcases (generation) | **Yes** |
| `OPENAI_API_KEY` | Showcase 1 embeddings | Yes (real RAG) |
| `DATABASE_URL` | Showcase 1 pgvector retrieval | Yes (real RAG) |
| `TAVILY_API_KEY` | Showcase 2 web search | Yes (real research) |
| `OPENWEATHERMAP_API_KEY` | Showcase 4 weather tool | No — falls back to mock |
| `BLOB_READ_WRITE_TOKEN` | Showcase 2 PDF storage | **Yes** on Vercel |
| `PGSSL_REJECT_UNAUTHORIZED` | Optional Postgres TLS opt-out | No |
| `GITHUB_TOKEN` | Reserved (future) | No |

Every variable should be scoped to **Production + Preview + Development** in the Vercel dashboard so preview deploys behave identically to production.

---

## 1. Create accounts

You need accounts at:

- **Vercel** — https://vercel.com/signup
- **Anthropic** — https://console.anthropic.com (paid, ~$5 minimum)
- **OpenAI** — https://platform.openai.com (paid, $5 minimum)
- **Neon** — https://console.neon.tech (free tier covers this project)
- **Tavily** — https://tavily.com (free tier: 1000 searches/month)
- **OpenWeatherMap** — https://home.openweathermap.org/users/sign_up (free tier)

GitHub is implied — you'll connect Vercel to your GitHub repo for auto-deploy.

---

## 2. Vercel project setup

1. From the Vercel dashboard, click **Add New… → Project**.
2. Import the `digital-portfolio` repository.
3. Framework preset will auto-detect as **Astro**. Leave the build settings on their defaults — `astro.config.mjs` already wires `@astrojs/vercel`.
4. Click **Deploy** without filling in env vars yet. The first deploy will run in mock mode for everything; that's fine — we'll add keys next.

After the first deploy completes you'll have a URL like `digital-portfolio-xxxx.vercel.app`. Note it down — you'll need it for `site:` in `astro.config.mjs` if you want canonical URLs.

---

## 3. Provision Neon Postgres (Showcase 1)

1. From the Vercel dashboard, open your project → **Storage** tab → **Create → Postgres → Neon**.
2. Pick the region closest to your function region (`lhr1` London, `fra1` Frankfurt, `iad1` US East).
3. Vercel auto-injects `POSTGRES_URL` and several aliased copies. **Add an explicit alias** named `DATABASE_URL` pointing at the same value — the codebase reads `DATABASE_URL`.
4. Vercel also injects `POSTGRES_URL_NON_POOLING`, `POSTGRES_USER`, etc. — leave them; we don't read them but they don't conflict.

You don't need to run any SQL by hand — `npm run seed` (next section) creates the extension and table for you.

---

## 4. Get API keys

For each provider, generate a key and add it to **Vercel → Project → Settings → Environment Variables**, scoped to **Production + Preview + Development**:

| Provider | Where to generate | Variable name |
|---|---|---|
| Anthropic | https://console.anthropic.com → Settings → API Keys | `ANTHROPIC_API_KEY` |
| OpenAI | https://platform.openai.com/api-keys → Create new secret key | `OPENAI_API_KEY` |
| Tavily | https://tavily.com/dashboard → API Keys | `TAVILY_API_KEY` |
| OpenWeatherMap | https://home.openweathermap.org/api_keys | `OPENWEATHERMAP_API_KEY` |

Tick **Sensitive / Encrypt** on all of them. The Vercel UI will hide the values after save.

---

## 5. Seed the corpus (one-off)

Locally, copy the same env vars into `.env`:

```bash
cp .env.example .env
# then paste at minimum DATABASE_URL and OPENAI_API_KEY
```

Run the seed script. It applies the schema (idempotent) and embeds every chunk in `src/lib/agent/knowledge.ts` into `corpus_chunks`:

```bash
npm run seed
```

Expected output:

```
[seed] applying schema (idempotent)...
[seed] embedding 9 chunks via text-embedding-3-small...
[seed]   ✓ cv-summary
[seed]   ✓ cv-boe
…
[seed] done. 9 chunks indexed.
```

Verify:

```bash
psql "$DATABASE_URL" -c "SELECT count(*) FROM corpus_chunks"
# count → 9
```

Re-running the seed is safe — it uses `INSERT … ON CONFLICT (id) DO UPDATE` so re-embeddings just overwrite the rows.

---

## 6. Provision Vercel Blob (Showcase 2)

This is the **post-deploy** step we deferred earlier. Without it, the Showcase 2 PDF download will return 404 in production.

1. Vercel dashboard → your project → **Storage → Create → Blob**.
2. Name: `digital-portfolio-reports` (any name works; this is just a label).
3. Pick the same region as your Postgres for lower latency.
4. Click **Connect** to attach it to the project. Vercel auto-injects `BLOB_READ_WRITE_TOKEN` for all environments — no copy-paste needed.
5. **Redeploy** so the running function picks up the new env var: **Deployments → ⋯ on latest → Redeploy**.

Verify by running a research query on the live site, clicking **Download PDF**, and confirming the file downloads.

---

## 7. Local development

For everyday hacking, you do not need to provision anything except an Anthropic key:

```bash
git clone https://github.com/vathomas/digital-portfolio.git
cd digital-portfolio
npm install
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env
npm run dev
```

Open <http://localhost:4321>. Without the optional keys:

- Showcase 1 retrieval falls back to keyword overlap over the in-memory corpus.
- Showcase 2 search falls back to clearly-labelled offline source stubs.
- Showcase 4 weather falls back to canned May-in-London data.
- Showcase 2 PDF storage uses an in-memory `Map` (works because dev keeps a single Node process alive).

The 4 LangGraph / async-generator orchestrations themselves run identically to production — only the leaf data sources differ.

---

## 8. Verification checklist

After your first prod deploy:

- [ ] `https://your-domain.vercel.app/` loads
- [ ] `/about` chat returns a thoughts trace with real `corpus_chunks.*` IDs (not mock IDs)
- [ ] `/research` agent emits live SSE events and the **Download PDF** button returns a real PDF (proves Blob round-trip works)
- [ ] `/crew` agent runs PM → Coder → Reviewer cycle to completion
- [ ] `/dashboard` playground answers "weather in London" with real OpenWeatherMap data
- [ ] Vercel function logs show no `[research-store]`, `[knowledge]`, or `[research-graph]` warnings on a clean run

If any of those fail, the Vercel **Logs** tab is the first place to look — every fallback path logs a single line identifying which env var is missing.

---

## 9. Cost expectations

A representative single-user session, all four showcases hit once:

| Showcase | What it spends | Approx |
|---|---|---|
| 1 (chat, 1 turn) | 1 OpenAI embed + 2 Haiku grader/rewrite + 1 Sonnet generate | $0.005 |
| 2 (research) | 1 Haiku plan + 3 Tavily searches + 1 Haiku factcheck + 1 Sonnet summary | $0.04 |
| 3 (crew, 2 cycles) | 2 Haiku PM/Reviewer + 2 Sonnet Coder | $0.03 |
| 4 (playground) | 2-3 Haiku planner turns | $0.005 |
| **Total** | | **~$0.08 per full session** |

Vercel + Neon + Blob fit the free tiers for portfolio-level traffic. Typical monthly bill once shared on LinkedIn (couple hundred sessions): **under $5**.
