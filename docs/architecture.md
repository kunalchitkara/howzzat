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
Expo scorer  ──POST /api/...──►  Next.js API routes
                                      │
                                      ▼
                               Prisma → D1 (prod) / SQLite (dev)
                                      │
                               rules-engine replay / validate
```

Public dashboards: Next.js SSR/ISR reading materialized stats.

## Rules profiles

1. **Builtin** — `packages/rules-engine/profiles/*.json` (e.g. `u9-softball-london-v1`)
2. **Clone** — manager copies template → new `RulesProfileTemplate` + `RulesProfileVersion`
3. **Configure** — JSON overrides merged via `mergeProfile()` before saving version
4. **Tournament bind** — `Tournament.rulesProfileVersionId` + `TournamentRulesBinding` timeline

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
