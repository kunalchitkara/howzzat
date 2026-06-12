# Howzzat

**Cricket Scoring** — ball-by-ball live scoring, configurable rules, and public dashboards for clubs and leagues.

Built for **London U9/U10/U11 softball leagues** first (pairs innings, 200 starting score, shared county rules), designed to scale to more formats and adult cricket later.

| | |
|---|---|
| **Status** | Active development — rules engine, scorecard UI, live scorer, match simulator |
| **Reference** | [edgeware-u9](https://github.com/kunalchitkara/edgeware-u9) — Edgware CC U9 Softball 2026 dashboard (production use today) |
| **Stack** | Next.js · Expo · TypeScript · Prisma · Cloudflare D1 |

---

## Table of contents

1. [Why Howzzat exists](#why-howzzat-exists)
2. [What it does](#what-it-does)
3. [How it compares](#how-it-compares)
4. [Architecture](#architecture)
5. [Repository structure](#repository-structure)
6. [Rules engine & U9 profile](#rules-engine--u9-profile)
7. [Mid-tournament rule changes](#mid-tournament-rule-changes)
8. [Data model (overview)](#data-model-overview)
9. [Getting started](#getting-started)
10. [Development workflow](#development-workflow)
11. [Deploying to production](#deploying-to-production)
12. [Roadmap](#roadmap)
13. [Migrating from edgeware-u9](#migrating-from-edgeware-u9)
14. [Contributing & license](#contributing--license)

---

## Why Howzzat exists

Junior club cricket in London often runs on:

- A **Google Sheet** for live ball-by-ball scoring (complex symbols for wides, pairs, wicket penalties)
- A **Python script** to regenerate a static HTML dashboard after each match
- A **manual git push** to GitHub Pages for parents to see results

That pipeline works — [edgeware-u9](https://kunalchitkara.github.io/edgeware-u9/) proves it — but it does not scale to multiple clubs, coaches, or tournaments. Howzzat generalises the same **rules-aware stats** (net runs, partnerships, fielding credits, leaderboards) into a multi-tenant product:

- Managers **create tournaments** and invite coaches
- Scorers record **ball-by-ball** on mobile
- Spectators get **public dashboards** without login
- **Player history** spans seasons and tournaments
- **Rules profiles** can be cloned and tweaked per competition

Season 1 goal: **free for London junior leagues** to gain adoption; monetisation per tournament later without redesign.

---

## What it does

### For tournament managers

- Create organisations (clubs) and tournaments (age group, season, slug)
- Select or **clone** a rules profile (e.g. U9 Softball London)
- Configure allowed overrides (wicket penalty, wide runs, player count, etc.)
- Add teams, squads, fixtures, venues
- Invite coaches/scorers from other clubs
- Publish **public URLs** for tournament, team, and match pages

### For scorers (mobile app)

- Ball-by-ball entry: runs, dot, wide, no-ball, wicket, run-out, fielder
- Live innings view driven by the **rules engine** (not hard-coded UI logic)
- Official vs **practice** matches (practice stats excluded from season tables)

### For spectators

- Live and post-match scorecards via public link (no account)
- Season overview, fixtures, player cards, leaderboards
- Rules guide generated from the active profile

### Analytics (design target)

| Level | Examples |
|-------|----------|
| Match | Full scorecard, partnerships, fall of wickets, bowling figures |
| Tournament | Leaderboards (runs, wickets, economy, catches, net runs) |
| Player | Career across tournaments; batting avg, net runs, fielding |

---

## How it compares

| | Spreadsheet + HTML | Generic scoring apps | **Howzzat** |
|---|-------------------|----------------------|-------------|
| U9 London pairs rules | Custom sheet + formulas | Rarely supported | **First-class rules profile** |
| Ball-by-ball | Yes | Varies | Yes |
| Public dashboard | Manual deploy | Often paid / limited | **Built-in, shareable links** |
| Multi-club tournament | No | Sometimes | **Yes (invites, RLS planned)** |
| Player cross-season | Manual | Limited | **Global player entity** |
| Cost at scale | Free (Sheets) | Subscription | **Cloudflare D1 — low egress** |

Not trying to be ESPNcricinfo — aiming for **Cricbuzz-lite for youth clubs**: fast, readable, correct for local rules.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│  apps/mobile (Expo)          apps/web (Next.js 15)              │
│  • Tap-to-score UI           • Cricbuzz-style scorecards ✅      │
│  • Offline queue (planned)   • Live ScorePad scorer ✅           │
│                              • Match simulator + demos ✅        │
│                              • API routes (/api/v1/*) ✅         │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│  packages/rules-engine (pure TypeScript)                          │
│  • validateDelivery / applyDelivery / replayInnings               │
│  • Strike rotation (odd runs, end of over, U9 wicket swap)       │
│  • Match simulator (simulateMatch)                               │
│  • Builtin profiles: u9-softball-london-v1                       │
│  • mergeProfile() for clone + configure                           │
│  • applyRuleChange() — BACKFILL | FUTURE_ONLY                     │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│  packages/db (Prisma)                                            │
│  • SQLite locally  →  Cloudflare D1 in production (same dialect) │
└─────────────────────────────────────────────────────────────────┘
```

**Design principles**

1. **Deliveries are the source of truth** — every stat is derived by replaying balls through the rules engine.
2. **Rules never live in React components** — same logic on server, mobile, and tests.
3. **Rules versions are immutable** — tournaments bind to a version; changes create a new version.
4. **Public pages are read-heavy** — materialise stats on match complete; cache/ISR in production.

See [docs/architecture.md](./docs/architecture.md) for deployment notes.

---

## Repository structure

```text
howzzat/
├── apps/
│   ├── web/                      # Next.js — web + API (Vercel)
│   │   └── src/app/              # App Router pages & /api routes
│   ├── mobile/                   # Expo Router — scorer
│   │   └── app/                  # index, match flow (no-auth demo)
│   └── landing/                  # Static marketing site (Cloudflare Pages)
├── packages/
│   ├── rules-engine/             # Core scoring logic + profiles/*.json
│   ├── db/                       # Prisma schema, migrations, seed
│   └── shared/                   # Shared constants & re-exports
├── docs/
│   ├── architecture.md
│   ├── scorecard-and-scoring.md
│   ├── testing.md
│   ├── api.md
│   └── rule-changes.md
├── wrangler.toml                 # Cloudflare D1 binding
├── turbo.json                    # Turborepo task graph
└── pnpm-workspace.yaml
```

---

## Rules engine & U9 profile

### Builtin profile: `u9-softball-london-v1`

Used across many **Middlesex / London junior Sunday leagues**. Matches the conventions documented in [edgeware-u9](https://github.com/kunalchitkara/edgeware-u9).

| Rule | Value |
|------|--------|
| Format | Pairs — each team bats once |
| Players per side | 8–10 (16 or 20 overs) |
| Pair length | 4 overs per pair |
| Starting score | **200** (avoids negative totals) |
| Wicket penalty | **−5** runs (pair continues) |
| Wide / no-ball (overs 1–n−1) | +2, no rebowl |
| Last over | Wide/NB +1, rebowl, up to 3 extra balls |
| Net runs (display) | Bat runs − (5 × wickets) |
| Strike after wicket | Yes (pair continues batting) |
| Run out | Fielder credit; bowler does **not** get a wicket |

**MJCA ball notation:** each full over has six legal balls, but the final over ends at ball five — the `N.0` label marks completion, not a seventh scorable delivery (e.g. 2 overs → balls `1.1`–`1.5`, `2.1`–`2.5`). The engine exposes this as `maxLegalBalls(totalOvers)` (`2 → 11`, `4 → 23`, `16 → 95`).

Profile JSON: [`packages/rules-engine/profiles/u9-softball-london-v1.json`](./packages/rules-engine/profiles/u9-softball-london-v1.json)

### Clone & configure

Managers duplicate a template → `RulesProfileTemplate` + new `RulesProfileVersion` with merged JSON (`mergeProfile()` in code). Only safe fields are exposed in the UI (planned); raw JSON for power users later.

### Running tests

```bash
pnpm --filter @howzzat/rules-engine test
```

Nine unit tests cover starting score, wicket penalty, net runs, extras, strike rotation, simulator, and BACKFILL rule changes.

See [docs/scorecard-and-scoring.md](./docs/scorecard-and-scoring.md) for scorecard UI, ball-by-ball, live scoring, and partnership rules.

---

## Mid-tournament rule changes

Coaches sometimes need to fix a misconfigured rule mid-season. Howzzat supports two modes ([full doc](./docs/rule-changes.md)):

| Mode | Behaviour |
|------|-----------|
| **FUTURE_ONLY** | Deliveries before the change keep their `rulesVersionId`; new balls use the new profile. |
| **BACKFILL** | Replay **all** deliveries in affected innings with the new profile; update scorecards and `PlayerMatchStats`. |

Preview impact before applying via `apps/web/src/lib/rule-changes.ts` → `previewRuleChange()`.

---

## Data model (overview)

| Entity | Purpose |
|--------|---------|
| `Organization` | Club (e.g. Edgware CC) |
| `Tournament` | Competition + age group + active rules version |
| `RulesProfileTemplate` / `RulesProfileVersion` | Cloneable, versioned rules JSON |
| `TournamentRulesBinding` | Timeline when a version became active |
| `RuleChangeRequest` | BACKFILL or FUTURE_ONLY change workflow |
| `Team` / `Player` / `TeamMembership` | Squad; players persist across tournaments |
| `Match` / `Innings` / `Delivery` | Ball-by-ball storage |
| `PlayerMatchStats` | Materialised aggregates (regenerated on finalize / backfill) |

Schema: [`packages/db/prisma/schema.prisma`](./packages/db/prisma/schema.prisma)

---

## Getting started

### Prerequisites

- **Node.js** 20+
- **pnpm** 9+ (`npm install -g pnpm` or Corepack)
- For mobile: **Expo Go** on your phone or iOS Simulator / Android emulator

### Install

```bash
git clone https://github.com/kunalchitkara/howzzat.git
cd howzzat
pnpm install
```

### Database (local SQLite)

```bash
cp packages/db/.env.example packages/db/.env
pnpm db:generate
pnpm db:push
pnpm --filter @howzzat/db exec prisma db seed
```

Seeds the `u9-softball-london-v1` template into the database.

### Run web

```bash
pnpm dev:web
# or, if port 3000 is taken:
cd apps/web && pnpm dev --port 3005
```

Open [http://localhost:3005](http://localhost:3005) (default when 3000 is busy).

| Page | Description |
|------|-------------|
| `/` | Home + links to demos |
| `/demo/u9-score` | Reset **Edgware U9 vs Hayes** 4-over demo and open scorer |
| `/demo/scorecard` | Static Hayes vs Edgware scorecard (M4 sample) |
| `/demo/simulated` | Simulated full U9 match (scorecard + ball-by-ball) |
| `/match/{matchId}/score` | Live scorer for a match |

**Reset demos** (no auth):

```bash
# U9 4-over pairs — Edgware U9 vs Hayes, pick 2–11 from 10 per side
curl -X POST http://localhost:3005/api/v1/demo/u9-match

# iOS/mobile 2-over pairs demo (public slug ios-live)
curl -X POST http://localhost:3005/api/v1/demo/ios-match
```

| Endpoint | Description |
|----------|-------------|
| `/api/health` | Service health JSON |
| `/api/profiles` | Builtin rules profiles JSON |
| `/api/v1/matches/:id/scorecard` | Computed scorecard + ball-by-ball |
| `/api/v1/matches/:id/scoring` | Live scoring context |
| `/api/demo/simulated?seed=N` | Regenerate simulated match JSON |

### Run mobile scorer (demo)

```bash
pnpm dev:mobile
```

Point the app at your local API: `EXPO_PUBLIC_API_URL=http://localhost:3005 pnpm dev:mobile` (or set in `apps/mobile/app.json` → `extra.apiUrl`).

Scan the QR code with Expo Go. **Start demo** runs a full 2-over **Edgware U9 vs Hayes** match without signing in (squads → toss → score → result). Optional Google sign-in for authenticated scoring later.

### Run all tests

```bash
pnpm test              # all tests (rules-engine + web)
pnpm test:unit         # rules engine only
pnpm test:api          # services + API routes
```

---

## Development workflow

```bash
# Build everything
pnpm build

# Format
pnpm format

# Prisma Studio (inspect local DB)
pnpm db:studio
```

### Adding a new builtin rules profile

1. Add `packages/rules-engine/profiles/your-profile-v1.json`
2. Register in `packages/rules-engine/src/profiles.ts`
3. Add tests in `packages/rules-engine/src/`
4. Extend `packages/db/prisma/seed.ts` if it should ship as a public template

### Environment variables

Copy `apps/web/.env.example` → `apps/web/.env.local` for the web app. See also `packages/db/.env` for Prisma CLI.

| Location | Variable | Purpose |
|----------|----------|---------|
| `packages/db/.env` | `DATABASE_URL` | `file:./prisma/dev.db` locally |
| `apps/web/.env.local` | `DATABASE_URL` | `file:../../packages/db/prisma/dev.db` or `libsql://…` (Turso) |
| `apps/web/.env.local` | `DATABASE_AUTH_TOKEN` | Turso auth token (production) |
| `apps/web/.env.local` | `COUPON_ADMIN_SECRET` | Platform admin — `X-Admin-Secret` header for `POST /api/v1/admin/coupons` |
| `apps/web/.env.local` | `GOOGLE_*`, `TWILIO_*`, `STRIPE_*` | OAuth, SMS OTP, wallet top-ups |

**Wallet coupons:** create codes via admin API (`POST /api/v1/admin/coupons` with `X-Admin-Secret`) or `pnpm exec tsx scripts/generate-coupon.ts --amount 2000`. Tournament managers redeem at `POST /api/v1/tournaments/:id/wallet/redeem-coupon`.

---

## Deploying to production

**Current setup:** Next.js on **Vercel** (`app.howzzat.uk`) with **Turso** (libSQL) for production data; landing page on **Cloudflare Pages** (`howzzat.uk`). Local dev uses SQLite via the same Prisma schema.

1. **Database** — Turso: `DATABASE_URL=libsql://…` + `DATABASE_AUTH_TOKEN` on Vercel. `apps/web/src/lib/db.ts` switches adapter automatically.
2. **App** — import `apps/web` in Vercel; set env vars from `apps/web/.env.example`.
3. **Landing** — `pnpm landing:deploy` (Wrangler Pages).

Step-by-step DNS, Stripe webhooks, and email routing: [`docs/cloudflare-setup.md`](./docs/cloudflare-setup.md).

Cloudflare D1 remains an option for edge-native deploy later ([`wrangler.toml`](./wrangler.toml)).

---

## Roadmap

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **0** | Monorepo, rules engine, U9 profile, Prisma schema, Expo/Next skeleton | ✅ |
| **1** | Auth (Google, SMS), org/tournament CRUD, invites | 🟡 |
| **2** | Full scorer UX (pairs, wides, fielders, squad picker) | 🟡 ScorePad + API |
| **3** | Public dashboards (parity with edgeware-u9) | 🟡 Scorecard + ball-by-ball UI |
| **4** | Google Sheet import + golden tests vs Edgware M2/M4 | 🔲 |
| **5** | Live scoring (SSE / Realtime), Turso production | 🟡 Vercel + Turso live |
| **6** | Monetisation (wallet coupons, Stripe top-ups) | 🟡 |

---

## Migrating from edgeware-u9

The [edgeware-u9](https://github.com/kunalchitkara/edgeware-u9) repo remains the **2026 Edgware archive**. Migration plan:

1. Import completed match tabs (M2, M4, …) from Google Sheets → `Delivery` rows.
2. Assert totals match the existing dashboard (golden tests).
3. Point public URLs to Howzzat team/tournament pages.
4. Retire `gen_dashboard.py` for new matches.

Tooling: `tooling/import-edgeware/` (planned).

---

## Contributing & license

This project is in active early development. Issues and PRs welcome for:

- Rules engine correctness (especially London U9 variants)
- Scorer UX on real match-day devices
- Accessibility of public dashboards

**License:** TBD — intended **free for junior clubs** in the 2026 London season.

---

## Acknowledgements

Born from weekend scoring at **Edgware Cricket Club** U9 Softball — thanks to coaches, parents, and players who validated the stats model on the boundary.

**Howzzat** — because every parent asks the same question after a dot ball. 🏏
