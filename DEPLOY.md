# Deploying Debate

This gets the MVP onto the internet on Render (API + Postgres) and Vercel
(the Next.js web app). Both have workable free tiers. I can't create
accounts, enter payment details, or click through either dashboard for you
— this is the exact sequence to do it yourself in about 15 minutes.

The two services need each other's URL (the API needs to know the web
app's origin for CORS/WebSockets; the web app needs the API's URL to call
it), so the order below deploys the API first, then the web app, then
circles back to finish wiring the API up.

## 0. Get the code onto GitHub

1. Create a new **empty** repository on github.com (no README/license —
   this repo already has one, and an empty remote avoids a merge).
2. Send me the repo URL (e.g. `https://github.com/you/debate.git`) and
   I'll push this existing commit history to it.

## 1. Render — Postgres + the API

1. In the Render dashboard: **New → Blueprint**, connect the GitHub repo.
   Render will read [`render.yaml`](./render.yaml) and propose:
   - `debate-postgres` — a free Postgres database
   - `debate-api` — a Docker-built web service from `apps/api/Dockerfile`
2. Click **Apply**. First build takes a few minutes (it's a multi-stage
   Docker build: installs deps, builds `packages/shared`, generates the
   Prisma client, builds the API, then on container start runs
   `prisma migrate deploy` before starting the server).
3. Once it's live, open `debate-api` → **Environment** and set:
   - `ANTHROPIC_API_KEY` — your key, for real AI Moderator/Judge output
     (leave unset and it runs in the documented stub mode instead)
   - `WEB_ORIGIN` — leave as a placeholder (`https://placeholder.vercel.app`)
     for now; you'll come back and fix this in step 3.
4. Copy the service's public URL, e.g. `https://debate-api.onrender.com`
   — the web app needs it next.
5. Seed the evergreen topics once the deploy is live: Render dashboard →
   `debate-api` → **Shell**, then run:
   ```bash
   cd apps/api && npm run db:seed
   ```

## 2. Vercel — the web app

1. **Add New → Project**, import the same GitHub repo.
2. Vercel will detect the npm-workspaces monorepo. Set:
   - **Root Directory:** `apps/web`
   - **Framework Preset:** Next.js (auto-detected)
   - Leave the install/build commands as Vercel's Next.js defaults — it
     installs from the repo root automatically because it detects the
     `workspaces` field in the root `package.json`, which is what lets it
     resolve `@debate/shared`.
3. Add an environment variable:
   - `NEXT_PUBLIC_API_URL` = the Render URL from step 1.4
     (e.g. `https://debate-api.onrender.com`)
4. Deploy. Copy the resulting URL, e.g. `https://debate.vercel.app`.

## 3. Finish wiring the API up

1. Back in Render → `debate-api` → **Environment**, set `WEB_ORIGIN` to
   the real Vercel URL from step 2.4 (e.g. `https://debate.vercel.app`,
   no trailing slash). Render redeploys automatically on env var changes.

## 4. Try it

Visit the Vercel URL, sign up (or use the seeded demo accounts —
`ada@example.com` / `grace@example.com`, password `password123`), and
queue for a Quick Debate in two separate browser sessions/tabs to match
yourself and see the full loop: matchmaking → timed debate → AI Judge
scorecard → Elo update → leaderboard.

## Known free-tier caveats

- Render's free web services spin down after 15 minutes idle and take
  ~30-60s to wake on the next request — the first request after a lull
  will be slow. Fine for trying it out, not for a real launch.
- The matchmaking queue and debate timers live in the API process's memory
  (documented in the README) — a free-tier restart mid-debate loses that
  debate's in-progress state. Acceptable for testing, a real launch needs
  the Redis-backed queue noted in the blueprint's scaling section first.
- Without `ANTHROPIC_API_KEY` set, the Moderator produces no flags and the
  Judge returns a flat neutral scorecard — the rest of the loop still
  works end-to-end, just without real AI output.
