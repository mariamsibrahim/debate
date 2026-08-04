# Debate — Founding Blueprint

> "Make intelligent disagreement the default." An AI-moderated structured
> debate platform where people leave smarter than they arrived — Omegle's
> spontaneity, Chess.com's ranking rigor, Discord's rooms, Reddit's topic
> gravity, Duolingo's habit loop.

This is the full product/technical/GTM blueprint. The `apps/` and
`packages/` in this repo implement the MVP slice described in §2 — the rest
is the roadmap this codebase is built to grow into.

## 1. Vision & Product Thesis

Every major social platform optimizes engagement by rewarding outrage,
tribalism, and speed of reaction. Debate optimizes for a different terminal
value: intellectual growth measured over time.

| What social media rewards | What Debate rewards |
| --- | --- |
| Outrage & tribalism | Curiosity & evidence |
| Echo chambers | Exposure to strong opposing views |
| Volume over evidence | Structure over volume |
| Dunking, not listening | Changing your mind, visibly |

The mechanism is an AI referee that never picks a side — it enforces
structure, calls for evidence, and scores reasoning quality, not ideology.
That single piece of infrastructure is the moat: anyone can build
video-chat matchmaking; almost no one can build a moderator users trust to
be fair.

## 2. PRD & MVP Scope (this repo)

**Problem:** no product is designed around disagreeing well. Twitter/X
rewards dunks, Reddit rewards karma-farming consensus, Omegle-style video
chat has no structure or safety, and real debate clubs are geographically
gated.

**Primary users:** university students, working professionals, philosophy /
politics / science / econ / psych hobbyists. **Secondary:** schools,
debate clubs, content creators, journalists, teachers.

**In scope for the MVP (built here):**
- Email/password auth, profile with core stats
- Text matchmaking (casual + ranked), 1v1
- 3 formats: Blitz (5m), Standard (10m), Casual Discussion (untimed)
- AI Moderator: timing, insult/off-topic/evidence-request flags
- AI Judge: 8-category scoring + written feedback
- Global + 8-category Elo (Politics, Science, History, Technology, Sports,
  Entertainment, Philosophy, Economics)
- Debate history, leaderboard (global + category)
- Evergreen topic library (~50 seeded topics across categories)

**Deliberately out of scope for v1:** team debates, tournaments, voice/video
UI (the WebRTC signaling relay exists, no media UI yet), live audience
voting/spectator chat, the live topic-ingestion engine, shadow-ban
tooling/appeals UI, Watch Mode, communities/DMs.

**Ruling:** ship text-first, single-format-deep, not feature-broad. The
thing that needs validating first is narrower than the full vision: will a
stranger have a better, fairer, smarter argument here than on Twitter, and
come back tomorrow? That only requires text + timer + AI moderator + AI
judge + rating.

## 3. User Journeys

- **First-time debater:** sign up → pick interests → Quick Debate → matched
  in <20s → guided Blitz debate → AI Judge scorecard → first rating.
- **Returning competitive user:** checks rating → queues Ranked Debate in
  strongest category → shares result.
- **Curious lurker:** watches a live debate (future Watch Mode) → votes →
  reads AI summary → debates the topic themselves.
- **Educator:** assigns a topic/format to a class (future Education tier) →
  reviews AI Judge scorecards and civility metrics for grading.

## 4. Home Screen

A dashboard, not a feed — get the user into a debate in under three taps.
Action row (Quick / Ranked / Casual / Watch Live) → status strip (rating,
streak, daily challenge) → live rail → trending topics → top debaters →
tournaments → friends/notifications in a persistent header.

## 5. User Profile

Username, bio, country (optional), interests, favorite topics, political
preference (optional). **Skill Rating, Civility Score, Accuracy Score,
Evidence Score, and Open-Minded Score are shown as prominently as
win/loss** — not buried in a stats tab, so the product never silently
becomes "argue to win."

## 6. Matchmaking

User picks: topic, format/difficulty, language, text/voice/video,
casual/ranked, time limit.

**Algorithm** (implemented in `apps/api/src/matchmaking`): hard-filter on
language/topic/format/mode, then score candidates by weighted Elo distance +
civility gap, with an acceptable-Elo-delta window that starts at ±75 and
widens by ±25 every 5s of wait (capped at ±400). Recently-matched pairs are
blocked from re-matching for a cooldown window. Users below a civility floor
are contained to their own pool rather than banned outright. Casual and
Ranked pools are fully separate — Casual never touches Elo.

**Ruling:** run matchmaking as a stateless worker pool reading from a
scored queue, not a database-polling loop — this repo's `MatchmakingService`
is a pure, unit-tested scoring/pairing engine; production at scale swaps its
in-memory queue for Redis without changing the algorithm.

## 7. Debate Formats & Flow

| Format | Length | Structure | Status |
| --- | --- | --- | --- |
| Blitz | 5 min | 1m open · 2m rebuttal · 1m close · AI summary | Built |
| Standard | 10 min | 2m open · 2×2m rounds · cross-ex · 1m close | Built |
| Casual Discussion | Untimed | No scoring pressure, moderator present, no Elo | Built |
| Deep Dive | 20 min | Standard + extra rounds | Roadmap |
| Oxford Style | ~25 min | Pre/post audience vote, floor speeches | Roadmap |
| Lincoln-Douglas | ~30 min | Value-based, cross-ex heavy | Roadmap |
| Parliamentary | ~20 min | Government vs. Opposition, points of information | Roadmap |
| Devil's Advocate | 10 min | Must argue the side you don't hold | Roadmap |
| Team Debate (2v2) | 20 min | Paired turns, shared team score | Roadmap |
| Tournament Mode | Bracketed | Any format, single/double elimination | Roadmap |

Every phase is server-clocked (never client-clocked), with a hard cutoff —
enforced by `DebatesGateway`'s phase timers, never the client.

## 8. AI Moderator

A non-participant, tool-using overlay (`apps/api/src/ai/moderator.service.ts`)
that watches the transcript and injects short, neutral interjections into a
separate Moderator lane — never rewriting or blocking a message.

Responsibilities: timekeeping & turn enforcement (deterministic, not
model-decided), insult/harassment flags, unsupported-claim flags, logical
fallacy detection, off-topic drift detection, misinformation flags on
well-established facts.

**Ruling:** a streaming tool-use loop with a fixed neutral system prompt and
callable tools (`flag_unsupported_claim`, `flag_logical_fallacy`,
`flag_incivility`, `flag_off_topic`, `request_clarification`), while timing
and turn-taking stay deterministic server logic — so the clock can never
drift, hallucinate, or be prompt-injected.

## 9. AI Judge & Scoring

Runs once, post-debate (`apps/api/src/ai/judge.service.ts`), over the full
transcript. Scores Logic, Structure, Evidence, Clarity, Persuasiveness,
Respectfulness, Responsiveness, and Consistency (0–100 each) — never which
side was "right." Output is forced structured tool-call JSON, not free-text
parsing, so scores are auditable and reproducible.

## 10. Elo & Ranking System

Tiers: Bronze (<1000) · Silver (1000–1199) · Gold (1200–1399) · Platinum
(1400–1599) · Diamond (1600–1799) · Master (1800–1999) · Grandmaster (2000+).

`R' = R + K·(S − E)` where `S` blends 60% AI-Judge win/loss/draw outcome with
40% relative scorecard totals (a strong-but-losing performance costs less
rating than a blowout). `K = 40` for a player's first 20 rated debates, `20`
up to 1800, `10` above. Separate ratings per category (Politics, Science,
History, Technology, Sports, Entertainment, Philosophy, Economics); global
rating is the participation-weighted average, not a separate ladder.

## 11. Debate Intelligence Engine (roadmap — not built in this repo)

An always-on pipeline that discovers, classifies, and ranks what the world
is arguing about: connector-based ingestion (Reddit, X/Twitter, YouTube,
Google Trends, Hacker News, news/RSS, arXiv, court/gov feeds) → dedupe →
LLM classification (category, popularity, controversy, evidence
availability, quality score) → embedding-based knowledge graph → trend
detection → publish. Runs hourly as scheduled batch jobs (not a real-time
stream processor — hourly freshness is more than sufficient for debate
topics, and batch jobs are an order of magnitude cheaper to build and debug).

This repo ships the permanent hand-curated evergreen library (§seed data)
that this engine is designed to sit on top of, plus a keyword-overlap
`suggest()` stand-in for the eventual AI Topic Generator.

## 12. Community, Watch Mode & Special Modes (roadmap)

Following, friends, DMs, communities/clubs, weekly challenges, bookmarks —
scoped in once the core loop is proven. Watch Mode (live spectator chat,
polling, predictions, clips). **Change My Mind:** a user posts a held
belief; only disagreeing users may challenge them; the poster self-reports
No Change / Partially Changed / Completely Changed, feeding the
Open-Minded Score. **Learning Mode:** post-debate study artifact — named
fallacies, weakest/strongest arguments, missing evidence, suggested reading.

## 13. Moderation & Trust (roadmap beyond the MVP report endpoint)

Escalation ladder: private warning → formal warning + civility hit →
temporary ban (severity-scaled) → permanent ban + fingerprint flag. Every
action carries an appeal path. Users below a trust threshold enter shadow
moderation (reports carry less weight, matches contained to a review pool)
rather than an outright ban, reducing mass-reporting abuse.

## 14–15. Tournaments & Gamification (roadmap)

Daily/weekly brackets scaling to Monthly/University/Regional/World
Championships, seeded by category Elo. XP/levels run parallel to Elo (Elo =
skill, XP = engagement); achievements reward growth behaviors ("Changed
Your Mind," "Cited 10 Sources," "Zero Incivility Flags in 20 Debates") —
not just win totals.

## 16. Design System

Two accent hues represent the two sides of any resolution — never mapped to
real-world political sides, always assigned per-debate (Proposition/
Opposition) — plus a neutral ink-on-paper ground that reads as rigorous
rather than playful.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| Ground | `#F5F6F3` | `#14171A` | Base background |
| Ink | `#1B2027` | `#E9EBEC` | Primary text |
| Brass (Proposition) | `#8C611E` | `#D9A34E` | "For" side, rank tiers, primary CTA |
| Teal (Opposition) | `#1E5B5E` | `#5FB0AB` | "Against" side, links, info |
| Danger | `#A8392E` | `#E27C6C` | Moderation/reporting only |

Serif (Iowan Old Style/Georgia stack) for headlines and resolutions, a
system sans for UI chrome, monospace with tabular figures for scores,
timers, and ratings. The debate timer is always visible and never
decorative; Moderator interjections render in a visually distinct lane so
neutrality is legible, not just claimed.

## 17. Database Schema

Implemented in `apps/api/prisma/schema.prisma`: `User`, `Profile`,
`Rating` (per category), `TrustScore`, `Topic`/`TopicRelation`
(knowledge-graph edges), `Debate`/`DebateParticipant`/`DebateEvent`
(append-only transcript log)/`DebateScore`, `Report`, `ModerationAction`,
`Achievement`/`UserAchievement`, `Bookmark`, `Follow`,
`ChangeMyMindPost`.

**Ruling:** `DebateEvent` is an append-only event log (jsonb payload)
rather than mutable rows per message — the natural fit for a transcript
that must be replayable, auditable by the AI Judge, and never edited after
the fact.

## 18. API Design

REST for auth/mutations/simple CRUD (`apps/api/src/*/*.controller.ts`).
Real-time debate/matchmaking events ride Socket.IO (`MatchmakingGateway`,
`DebatesGateway`) rather than being polled through REST, since that's
inherently a push problem. A GraphQL layer for deeply-nested read paths
(e.g. a profile screen needing ratings + history + achievements in one
round trip) is documented as the next API addition once the client needs
it — the MVP's REST shape doesn't yet justify the added surface.

## 19. Tech Architecture & Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Web | Next.js + TypeScript + Tailwind | SSR for shareable pages later, one language across the stack |
| Backend | NestJS, modular monolith | Fast to build, module boundaries make a later microservice split mechanical |
| Realtime | Socket.IO (built); LiveKit reserved for voice/video | Open-source SFU, handles scaling/recording — not worth building WebRTC infra in month one |
| DB | PostgreSQL (+ pgvector later) | Relational integrity for ratings/moderation, vector search for topics in the same store |
| Auth | Hand-rolled JWT (MVP) → Clerk (scale) | No third-party account needed to clone and run this repo locally |
| AI | Anthropic Claude (Moderator + Judge) | Tool-use for structured, auditable output |

**Ruling (peer-to-peer scope):** for 1:1 voice/video (v1.1), the browsers
connect directly to each other for media — cheaper, lower latency, no
media-server cost — while the backend stays authoritative for the debate
session itself (timer, message order, transcript) and still sees every
message, because the AI Moderator/Judge and Elo integrity depend on neither
participant controlling the record. The backend only relays the WebRTC
signaling handshake (`webrtc:signal`); it never sits in the media path.

## 20. AI Infrastructure

Moderator and Judge are two separate prompts/pipelines
(`apps/api/src/ai/`), never one "do everything" AI persona — they have
opposite constraints (fast/cheap/noise-tolerant vs. slow/thorough/
auditable), and conflating them is how a moderator ends up "judging"
mid-debate, which reads as bias in real time.

## 21–23. Security, Accessibility, Testing

Country/political-preference fields opt-in and hidden by default.
Transcripts are exportable/deletable on request. WCAG 2.1 AA floor: full
keyboard nav, ARIA live regions on the timer/moderator lane/score reveal,
reduced-motion respected. Testing: unit tests on Elo math and matchmaking
scoring (`*.spec.ts`), with an LLM eval harness against labeled transcripts
recommended before the Moderator/Judge prompts change in production.

## 24. Scaling Strategy

Modular monolith → extract matchmaking and the debate real-time service
first (the latency-sensitive paths, currently in-memory per the MVP
limitation noted in the README), then the future intelligence engine
(already isolated as queue workers by design), leaving user/social CRUD in
the monolith the longest.

## 25–26. Business Model & Growth (roadmap)

Free / Premium (voice-video, advanced stats) / Education / Enterprise /
Creator / Tournament Pass / University Licensing. Growth: seed a skilled
early cohort before general availability, university ambassadors + campus
tournaments as the highest-leverage channel, Change My Mind transcripts and
AI Judge scorecards as natively shareable artifacts.

## 27. Roadmap

| Horizon | Focus |
| --- | --- |
| 30 days | *(this repo)* Auth, profiles, text matchmaking, Blitz/Standard/Casual formats, AI Moderator v1, AI Judge v1, 8-category Elo, evergreen topic seed |
| 90 days | Public launch, voice/video via the P2P signaling relay already in place, remaining formats, Watch Mode, Change My Mind, moderation ladder, university ambassador pilot |
| 1 year | Live Debate Intelligence Engine, tournaments, communities, Education tier, mobile apps |
| 3 years | Enterprise/corporate training, international leagues, creator monetization, the knowledge graph as a public research asset |

## 28. Key Risks

| Risk | Mitigation |
| --- | --- |
| Moderator perceived as biased | Structured scoring, published rubric, no ideological output ever |
| Cold start (empty queue) | Seed a skilled cohort pre-launch |
| Toxicity despite moderation | Civility-gated matchmaking pool, fast appeal path |
| Elo gaming | Recency-penalized rematching, provisional K-factor |
| Feature scope creep pre-PMF | The §2 MVP boundary is a ruling, not a suggestion |
