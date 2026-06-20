# Howzzat architecture

## Stack (locked)

| Layer | Technology |
|-------|------------|
| Monorepo | pnpm + Turborepo |
| Web & API | Next.js 15 (TypeScript, App Router) |
| Mobile scorer | Expo + React Native |
| Rules | `@howzzat/rules-engine` (pure TS, tested) |
| Database | Cloudflare D1 (SQLite) via Prisma |
| Deploy (target) | Cloudflare Pages/Workers + D1; local dev uses SQLite file |

## Request flow

```text
Expo scorer  ──POST /api/v1/...──►  Next.js API routes
                                      │
                                      ▼
                               Prisma → D1 (prod) / SQLite (dev)
                                      │
                               rules-engine replay / validate
                                      │
                               scorecard aggregate + ball-by-ball build
```

Public dashboards: Next.js SSR reading computed scorecards (materialized stats on finalize planned).

## Web app modules

| Path | Role |
|------|------|
| `apps/web/src/lib/scorecard/` | Aggregate deliveries → scorecard + ball-by-ball views |
| `apps/web/src/components/scorecard/` | ScorecardView, InningsPanel, BallByBallPanel |
| `apps/web/src/components/scoring/` | ScorePad live scorer |
| `apps/web/src/lib/services/scoring.ts` | Scoring context + delivery persistence |

See [scorecard-and-scoring.md](./scorecard-and-scoring.md) for UI behaviour, strike rotation, and partnership scoring.

## Rules profiles

1. **Builtin** — `packages/rules-engine/profiles/*.json` (e.g. `u9-softball-london-v1`)
2. **Clone** — manager copies template → new `RulesProfileTemplate` + `RulesProfileVersion`
3. **Configure** — JSON overrides merged via `mergeProfile()` before saving version
4. **Tournament bind** — `Tournament.rulesProfileVersionId` + `TournamentRulesBinding` timeline

U9 profile includes `rotateStrikeAfterWicket: true` — strike swaps after each wicket while the pair continues.

## Mid-tournament rule changes

When a coach updates rules:

1. Create new `RulesProfileVersion` (immutable config snapshot)
2. Create `RuleChangeRequest` with `mode`:
   - **FUTURE_ONLY** — deliveries before index keep `rulesVersionId`; new balls use new version
   - **BACKFILL** — replay all `Delivery` rows through `replayInnings()` with new profile; update `PlayerMatchStats`

Preview in UI via `apps/web/src/lib/rule-changes.ts` → `previewRuleChange()`.

## Cost controls (Cloudflare)

- D1: minimal cost at junior-league scale
- Cache public match pages after `COMPLETED`
- Live scoring: poll or Durable Objects only when needed

## Migration from edgeware-u9

`tooling/import-edgeware/` (TODO): Google Sheet → `Delivery` rows + golden test against rules-engine.

## React versions (monorepo)

| App | React | Notes |
|-----|-------|-------|
| `apps/web` | **19.x** | Next.js 15 App Router; `@types/react` pinned via root `pnpm.overrides` |
| `apps/mobile` | **18.3.x** | Expo SDK 52 / React Native 0.76 — not yet on React 19 |

Root `package.json` overrides `@types/react` and `@types/react-dom` to 19.x so the web app and shared TS tooling resolve consistent types. Mobile keeps its own `@types/react@~18.3` in `apps/mobile/package.json`. Do not bump mobile to React 19 until Expo documents support for the target SDK.

## Prisma / database config

- **Today:** Prisma 6.x — `packages/db/prisma/schema.prisma` + `DATABASE_URL` in `packages/db/.env` (CLI) and `apps/web/.env.local` (Next.js).
- **Prisma 7 path:** stub at `packages/db/prisma.config.ts` (`earlyAccess: true`). Full migration = move datasource URL to config, upgrade `prisma` + `@prisma/client`, validate Turso adapter.
- **Production:** Turso libSQL — `DATABASE_URL=libsql://…` + `DATABASE_AUTH_TOKEN`; validated at web startup via `apps/web/src/lib/env.ts`.

## Tenant isolation (API)

Mutating routes under organizations and tournaments require a signed-in user with org **OWNER/MANAGER** or **tournament manager** role:

- `POST /organizations/:orgId/tournaments`
- `POST /organizations/:orgId/teams`
- `POST /tournaments/:id/matches`
- `POST|GET /tournaments/:id/invites` (list/create)
- `DELETE /tournaments/:id/invites/:inviteId`

Wallet and scoring mutations use separate checks (`assertCanTopUpWallet`, `assertCanMutateScoring`). Public read routes (scorecard, public tournament hub) remain unauthenticated.

Integration tests: `apps/web/tests/integration/api-gaps.test.ts` (tenant isolation).

## Node.js

CI pins **Node 20 LTS** (`.github/workflows/ci.yml`). Local dev: Node 20+ per root `engines`. Node 26+ may emit experimental warnings from dependencies — prefer Node 20 for parity with CI/Vercel.
