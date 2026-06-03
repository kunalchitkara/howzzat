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
