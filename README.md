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

Want it running online instead of just locally? See [DEPLOY.md](./DEPLOY.md)
for the Render (API + Postgres) + Vercel (web) walkthrough.

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

## Changing the look

Everything visible — every color, font, and corner radius across the whole
web app — is defined once, in
[`apps/web/src/styles/globals.css`](./apps/web/src/styles/globals.css). No
component ever hardcodes a color or font; they all read `bg-brass`,
`text-ink-muted`, `font-serif`, etc., which [`tailwind.config.ts`](./apps/web/tailwind.config.ts)
points at the CSS variables defined there. Edit a value in one file, and it
updates everywhere it's used.

| To change... | Edit... |
| --- | --- |
| The primary accent color (buttons, links, rank badges) | `--brass` in `globals.css` |
| The secondary accent (the "Opposition" side in debates) | `--teal` |
| Background / card colors | `--bg`, `--surface`, `--surface-2` |
| Text colors | `--ink`, `--ink-muted` |
| How rounded corners are, everywhere | `--radius` |
| Headline/body/data fonts | `--font-serif` / `--font-sans` / `--font-mono` |
| Dark mode's version of any of the above | the `@media (prefers-color-scheme: dark)` block right below the light values |

Each token is commented in place with what it's used for. There's also a
`:root[data-theme="dark"]` / `:root[data-theme="light"]` override pair
already wired up and waiting for a manual light/dark toggle button, if you
add one later — it isn't hooked up to any UI yet, the app currently just
follows the OS/browser preference.

To swap in a real webfont instead of the current system-font stacks, add an
`@font-face` rule to `globals.css` and point `--font-serif` (or `-sans` /
`-mono`) at its family name — nothing else needs to change.
