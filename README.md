# sports-outlet-ai

> One brain, three faces. A monorepo housing a shared content-intelligence backend and three Next.js frontends — one per sport.

## What this is

A multi-tenant content platform for three sister sports e-commerce sites:

| Sport | Domain | Frontend | Sport env value |
|---|---|---|---|
| Tennis | [tennisoutlet.in](https://tennisoutlet.in) | `apps/tennis-frontend` | `tennis` |
| Pickleball | [pickleballoutlet.in](https://pickleballoutlet.in) | `apps/pickleball-frontend` | `pickleball` |
| Padel | [padeloutlet.in](https://padeloutlet.in) | `apps/padel-frontend` | `padel` |

> ⚠️ **Naming note.** The original brief said `paddleoutlet.in` and `paddle-frontend`. The real working domain is **`padeloutlet.in`** (verified: returns "India's First Exclusive Padel Store"). `paddleoutlet.in` resolves to a parking page (`/lander`) and is not yours. This repo uses `padel` everywhere. If you actually own `paddleoutlet.in` and intend to launch it, rename `apps/padel-frontend` → `apps/paddle-frontend` and update `infra/render.yaml`.

The content brain ingests YouTube videos, transcribes them with Whisper, extracts insights with GPT-4o-mini, verifies product mentions against the live Magento catalog, and generates draft articles. Each frontend reads its own slice via `?sport=` and renders branded content.

## Repo layout

```
sports-outlet-ai/
├── apps/
│   ├── tennis-frontend/        # Next.js 14 — tennisoutlet.in
│   ├── pickleball-frontend/    # Next.js 14 — pickleballoutlet.in
│   └── padel-frontend/         # Next.js 14 — padeloutlet.in
├── backend/
│   ├── src/
│   │   ├── server.ts           # Express entry + worker bootstrap
│   │   ├── config.ts           # env-var loader (NEVER hardcode secrets)
│   │   ├── api/                # 5 REST routes (ingest, videos, articles, generate, recommendations)
│   │   ├── agents/             # 6 agents — each with a real OpenAI call (or graceful stub)
│   │   ├── db/                 # Postgres pool
│   │   ├── queue/              # BullMQ + Redis wiring
│   │   └── knowledge/          # Vector store (Pinecone w/ in-memory fallback)
│   ├── migrations/             # SQL — videos, transcripts, insights, articles, recs, llm_spend
│   └── chatbot-legacy/         # Existing v6.8.4 chatbot, preserved verbatim. Deployed as separate Render services per sport.
├── packages/
│   ├── shared-ui/              # React: Header, Footer, ChatWidget
│   ├── types/                  # Shared TS types (Sport, Article, Video, etc.)
│   └── utils/                  # Tiny helpers (slugify, asEnv)
├── infra/
│   └── render.yaml             # Render Blueprint — 1 db + 1 redis + 4 web services
├── scripts/
│   └── cron-jobs/
│       └── refresh-content.ts  # Daily ingestion enqueuer
└── README.md
```

## Quick start (local)

```bash
# 1. Install once at the root (uses npm workspaces)
npm install

# 2. Bring up Postgres + Redis (use whatever you prefer; docker is fine)
docker run -d --name pg -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16
docker run -d --name redis -p 6379:6379 redis:7

# 3. Configure
cp .env.example .env
# Edit .env -- DATABASE_URL, REDIS_URL, OPENAI_API_KEY at minimum

# 4. Run migrations
npm --workspace backend run build && node backend/dist/migrations/run.js

# 5. Start backend
npm run dev:backend           # http://localhost:3001
# Start a frontend (in another terminal):
npm run dev:tennis            # http://localhost:3001
npm run dev:pickleball        # http://localhost:3002
npm run dev:padel             # http://localhost:3003
```

## Deploy (Render Blueprint)

```bash
# 0. Rotate every secret you previously pasted in chat (see SECURITY below) BEFORE doing anything.
# 1. Push this monorepo to a new GitHub repo.
# 2. In Render dashboard -> New + -> Blueprint -> point at your repo.
# 3. Render reads infra/render.yaml. It will:
#    - Provision Postgres + Redis
#    - Prompt for the secrets marked sync:false
#    - Auto-link DATABASE_URL and REDIS_URL to backend-api
#    - Wire NEXT_PUBLIC_API_URL on each frontend to backend-api's host
# 4. Apply.
# 5. After backend-api is healthy, set NEXT_PUBLIC_CHATBOT_URL on each
#    frontend to point at the matching chatbot service:
#       tennis-frontend     -> https://tennisoutlet-chatbot.onrender.com
#       pickleball-frontend -> https://pickleballoutlet-chatbot.onrender.com
#       padel-frontend      -> https://padeloutlet-chatbot.onrender.com
# 6. Map custom domains:
#       tennisoutlet.in     -> tennis-frontend
#       pickleballoutlet.in -> pickleball-frontend
#       padeloutlet.in      -> padel-frontend
```

### Secrets you'll be prompted for

| Env var | Where to get it |
|---|---|
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys (only if using legacy chatbot) |
| `MAGENTO_TOKEN` | Magento admin → System → Integrations |
| `PINECONE_API_KEY` | https://app.pinecone.io (optional — falls back to in-memory) |
| `YOUTUBE_API_KEY` | https://console.cloud.google.com → YouTube Data API v3 |
| `INGEST_API_KEY` | Auto-generated by Render |

## Architecture

### Pipeline flow

```
POST /ingest/channel
   │
   ▼
[ingestion-agent]  --YouTube Data API--> upsert videos table
   │ enqueue
   ▼
[transcription-agent]  --Whisper--> upsert transcripts table
   │ enqueue
   ▼
[understanding-agent]  --GPT-4o-mini (JSON mode)--> upsert insights table
   │ enqueue
   ▼
[verification-agent]  --Magento product search--> mark verified
   │ enqueue if verified
   ▼
[content-generator]   --GPT-4o-mini--> draft article + index in vector store
   │
   ▼
GET /articles  (Next.js frontends fetch with revalidate=300)
GET /recommendations  (vector similarity for "related posts")
```

### Why agents are this small (and the 6th is a stub)

Real production AI pipelines fail on infrastructure problems (rate limits, retries, backoff, cost ceilings, observability), not on prompt engineering. This implementation gives you:

- **Real OpenAI calls** in 4 of the 5 active agents (ingestion is YouTube; transcription/understanding/content-generation use OpenAI; verification uses Magento)
- **Graceful degradation** — every LLM call falls back to a stub if `OPENAI_API_KEY` is missing, so the pipeline never crashes mid-flow
- **A daily LLM spend ceiling** (`LLM_MAX_DAILY_USD`, default $10) enforced via the `llm_spend` table — kills runaway costs from a stuck loop
- **A `self-improvement-agent` that's intentionally a stub.** Closing that loop reliably requires real engagement telemetry (CTR, dwell time, conversions) that doesn't exist on day one. Stubbing it is the right v1 call. The interface is documented in `backend/src/agents/self-improvement.ts` for when you're ready.

### Where the legacy chatbot lives

`backend/chatbot-legacy/` is the existing v6.8.4 chatbot, preserved verbatim. It is **not** built or deployed by `infra/render.yaml`. Instead, the three sport-branded chatbot variants live in their own repos and deploy separately:

- `tennisoutlet-chatbot` → `https://tennisoutlet-chatbot.onrender.com`
- `pickleballoutlet-chatbot` → `https://pickleballoutlet-chatbot.onrender.com`
- `padeloutlet-chatbot` → `https://padeloutlet-chatbot.onrender.com`

Each frontend in this repo embeds the matching chatbot via `<ChatWidget chatbotUrl={...} />`, configured by `NEXT_PUBLIC_CHATBOT_URL`.

If you'd rather collapse the chatbots into this monorepo too, the cleanest move is to refactor `backend/chatbot-legacy/server.js` to read `?sport=` or `Origin` and pick the right policy URLs at request time. That's a follow-up — current variants ship today.

## API reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/healthz` | — | Service health |
| `POST` | `/ingest/channel` | `X-Ingest-Key` | Enqueue a YouTube channel for ingestion |
| `GET`  | `/videos?sport=&limit=` | — | List ingested videos |
| `GET`  | `/articles?sport=&status=&limit=` | — | List generated articles (default `status=published`) |
| `GET`  | `/articles/:slug` | — | Single article by slug |
| `POST` | `/generate` | `X-Ingest-Key` | Manually retry content generation for a video |
| `GET`  | `/recommendations?article_id=&limit=` | — | Related articles via vector similarity |

Auth: write endpoints require `X-Ingest-Key: <INGEST_API_KEY>`. Render auto-generates this on first deploy.

## Database schema

See `backend/migrations/001_init.sql`. Six tables:

- `videos` — every YouTube video ingested
- `transcripts` — Whisper output, one row per video
- `insights` — GPT-extracted topics/tips/products, one row per video
- `articles` — generated drafts and published posts
- `recommendations` — precomputed article→article links
- `llm_spend` — rolling daily LLM cost (kill switch)

Migrations run automatically as part of the Render build (`build` script chains `node dist/migrations/run.js`).

## SECURITY — read this before deploying

This repo was built in a session where the user pasted **9 production secrets in plain chat**. They are all compromised:

1. `OPENROUTER_API_KEY` — rotate at https://openrouter.ai/keys
2. `MAGENTO_TOKEN` — rotate at Magento Admin → System → Integrations
3. `MAGENTO_ACCESS_TOKEN` — same Integrations panel
4. `MAGENTO_ACCESS_TOKEN_SECRET` — same
5. `MAGENTO_CONSUMER_KEY` — same
6. `MAGENTO_CONSUMER_SECRET` — same
7. `SUPABASE_SERVICE_ROLE_KEY` — **rotate immediately at https://supabase.com/dashboard/project/osipksfiqprbisprcqjh/settings/api** (god-mode DB access)
8. GitHub PAT (`ghp_CVz...`) — revoke at https://github.com/settings/tokens
9. Render API key (`rnd_EsA...`) — revoke at https://dashboard.render.com/u/settings

**Hard rule going forward**: never paste secrets in chat or in code. Set them as Render env vars (`sync: false` in `render.yaml`) or as local `.env` files (gitignored). Reference them via `process.env.X` only.

## Roadmap (P1 → P4)

| Phase | Scope | Effort |
|---|---|---|
| **P0 — Done** | Monorepo scaffold, 5 deployable services, working pipeline with stubs | ✅ |
| **P1** | Real audio extraction (yt-dlp + S3), real Whisper transcription, prompt iteration | 2–3 weeks |
| **P2** | Editor review UI for drafts, one-click publish, Sentry + PostHog | 2 weeks |
| **P3** | Pinecone in production, "related articles" UX, on-page schema.org | 2 weeks |
| **P4** | Engagement telemetry → prompt registry → A/B framework. **Don't start this until P1–P3 are producing data worth optimizing on.** | 4+ weeks |

## License

Private — all rights reserved.
