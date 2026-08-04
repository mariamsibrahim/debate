# Debate

> Make intelligent disagreement the default.

This is the MVP core loop from the [founding blueprint](./BLUEPRINT.md): auth →
matchmaking → a live, timed, AI-moderated debate → an AI Judge scorecard →
Elo update → leaderboard. Text-only for now (voice/video, tournaments,
Watch Mode, and the live topic-ingestion engine are documented future work,
not built here — see the blueprint).

## Stack

- **apps/api** — NestJS + Prisma/PostgreSQL + Socket.IO. Auth, matchmaking,
  the debate state machine, and the AI Moderator/Judge (Anthropic Claude).
- **apps/web** — Next.js (App Router) + Tailwind. Home, auth, matchmaking
  queue, the live debate room, scorecards, profile, leaderboard.
- **packages/shared** — TypeScript types and constants (Elo tiers, debate
  phase timing tables, WebSocket event contracts) shared by both apps so the
  backend's authoritative timer and the frontend's countdown can't drift.

## Setup

```bash
npm install                 # also builds packages/shared (postinstall)
docker compose up -d        # starts Postgres on :5432
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
npm run db:migrate          # create tables
npm run db:seed             # ~50 evergreen topics + 2 demo users
```

Add your `ANTHROPIC_API_KEY` to `apps/api/.env` to get real AI Moderator
flags and AI Judge scorecards. **Without a key, both run in a documented
stub mode** (the Moderator produces no flags; the Judge returns a flat,
neutral 70-across-the-board scorecard) so the rest of the app — matchmaking,
the timer, Elo updates, the UI — still works end-to-end for local
development without API costs.

Run both apps (two terminals):

```bash
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:3000
```

Sign in with a seeded demo account (`ada@example.com` / `grace@example.com`,
password `password123`) in two separate browser sessions to match yourself
against yourself and try the full flow.

## What's real vs. stubbed

| Area | Status |
| --- | --- |
| Auth, profiles, Elo, leaderboard | Real, persisted in Postgres |
| Matchmaking queue + scoring algorithm | Real, in-memory (see ruling below) |
| Debate timer/state machine | Real, server-authoritative |
| AI Moderator / AI Judge | Real Claude calls if `ANTHROPIC_API_KEY` is set, else stub |
| Voice/video | Not built — signaling relay (`webrtc:signal`) exists and is wired into the gateway, ready for a P2P `RTCPeerConnection` client, but no media UI ships yet |
| Tournaments, Watch Mode, communities, live topic ingestion | Not built — documented in the blueprint as post-MVP |

**Known MVP limitation:** the matchmaking queue and debate phase timers are
held in-memory in a single Node process (blueprint §6/§24 already flags this
as the first thing to extract into its own service — a Redis-backed queue
and a durable scheduler — once this needs to run on more than one instance).

## Tests

```bash
npm test    # Elo math + matchmaking scoring, apps/api
```
