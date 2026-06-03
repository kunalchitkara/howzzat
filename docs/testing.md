# Testing

Howzzat uses **Vitest** across the monorepo.

## Commands

```bash
# All tests
pnpm test

# Rules engine only (pure unit, no DB)
pnpm test:unit

# Services + API integration (SQLite test DB)
pnpm test:api
```

## Coverage

### `@howzzat/rules-engine` (~36 tests)

| File | Covers |
|------|--------|
| `engine.test.ts` | Starting score, dot/runs/wicket, net runs, finalize, BACKFILL |
| `engine.extras.test.ts` | Wides, no-balls, byes, last-over wide, validation, replay |
| `profiles.test.ts` | mergeProfile, 8/10 player configs, clamping |
| `strike.test.ts` | Odd runs, end of over, U9 wicket rotation, double rotation |
| `simulator.test.ts` | Random match generation through engine |

### `@howzzat/web` (~45 tests)

| File | Covers |
|------|--------|
| `tests/unit/ball-label.test.ts` | Over headings (1st Over), ball labels (0.1, …) |
| `tests/unit/ball-by-ball.test.ts` | Strike tracking, partnership team score, over summaries |
| `tests/unit/scorecard-aggregate.test.ts` | Batting/bowling/fielding/partnership aggregates |
| `tests/unit/simulated-scorecard.test.ts` | Full simulated match scorecard + both innings BBB |
| `tests/unit/` | Slug helpers, ball position, HTTP helpers |
| `tests/services/crud.test.ts` | Orgs, teams, tournaments, rules clone, public slug |
| `tests/services/scoring.test.ts` | Match create, deliveries, scorecard, finalize |
| `tests/services/scoring-context.test.ts` | Live scoring context API |
| `tests/services/rule-changes.test.ts` | BACKFILL + FUTURE_ONLY preview and apply |
| `tests/api/v1.test.ts` | Full HTTP flow via Next.js route handlers |

## Test database

API and service tests use an isolated SQLite file:

`apps/web/.test-db.db` (gitignored)

Setup deletes the file and runs `prisma db push` before the suite. Each test resets rows via `resetDatabase()` from `@howzzat/db`.

**Never point tests at your dev `packages/db/prisma/dev.db`.**

## Adding tests

1. **Rules logic** → `packages/rules-engine/src/*.test.ts` (no database)
2. **Business logic** → `apps/web/tests/services/` using `seedTestFixtures()`
3. **HTTP contracts** → `apps/web/tests/api/` calling route handlers directly

```typescript
import { GET } from "@/app/api/v1/organizations/route";
import { jsonRequest, emptyParams, readJson } from "../helpers/request";

const res = await readJson(
  await GET(jsonRequest("GET", "/api/v1/organizations"), emptyParams()),
);
expect(res.status).toBe(200);
```
