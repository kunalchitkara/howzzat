# Scorecard, ball-by-ball & live scoring

Howzzat derives all match stats by replaying `Delivery` rows through `@howzzat/rules-engine`. The web app renders Cricbuzz-style scorecards, expandable ball-by-ball commentary, and a live scorer pad.

## Demo pages (local)

| URL | Description |
|-----|-------------|
| `/demo/scorecard` | Static Edgware-style scorecard sample |
| `/demo/simulated` | Full simulated U9 match (both innings, scorecard + ball-by-ball) |
| `/match/demo-score/score` | Live ball-by-ball scorer (seeded demo fixture) |
| `/match/[matchId]` | Match scorecard from database |

Run web: `pnpm dev:web` (or `cd apps/web && pnpm dev --port 3005` if 3000 is taken).

## Scorecard view

Components live under `apps/web/src/components/scorecard/`:

- **ScorecardView** — match header, scorecard / ball-by-ball toggle, both innings stacked
- **MatchSummaryPanel** — edgeware-u9 style result hero, score grid, top bat/bowl, player of the match
- **MatchInsightsPanel** — auto-generated insights with **Parents** / **Coaches** tabs (upbeat vs critical, seeded variety from match data)
- **InningsPanel** — batting, extras, fall of wickets, partnerships, bowling, fielding
- **BattingTable / BowlingTable** — Edgware blue styling, net runs column for U9
- **BallByBallPanel** — per-over expandable commentary

Data pipeline:

```text
Delivery[]  →  rules-engine replay  →  aggregate.ts  →  MatchScorecardView
                                      →  ball-by-ball.ts  →  MatchBallByBall
```

### Partnership runs

A **partnership score is the team runs added during that pair's overs**, including:

- Runs off the bat
- Wides, no-balls, byes, leg byes
- Wicket penalties (−5 under U9)

It is **not** the sum of the two batters' individual scores. Individual batter rows still show bat runs and balls faced only.

Implemented in `aggregatePartnerships()` and per-over summaries in `buildBallByBallInnings()`.

## Ball-by-ball display

### Over labels

| Context | Example |
|---------|---------|
| Over heading | **1st Over**, **2nd Over**, … |
| Balls 1–5 | `0.1` … `0.5` (first over), `1.1` … (second over) |
| End of over (6th legal ball) | `1`, `2`, … (over number only) |

See `apps/web/src/lib/scoring/ball-label.ts`.

### Over summary row

Each collapsed over header shows:

- **Both batters** — cumulative runs and balls (e.g. `Gurfateh 12* (8)`); `*` = on strike at end of over
- **Partnership** — team runs in current pair so far (e.g. `P2: 17 (1 wkt)`)
- Over runs, wickets, and running total score

### Strike rotation (U9 London)

Central logic: `packages/rules-engine/src/strike.ts` → `applyStrikeRotationsAfterDelivery()`.

| Event | Strike rotates? |
|-------|-----------------|
| Odd runs off bat | Yes |
| Odd byes / leg byes (legal ball) | Yes |
| Odd runs on no-ball (incl. off bat) | Yes |
| End of over (6th legal ball) | Yes |
| Wicket (pair continues) | Yes (`rotateStrikeAfterWicket` in U9 profile) |

**Double rotation:** last-ball single → odd run + end of over → same batter faces first ball of next over.

Ball-by-ball **tracks strike through the innings** when rendering (not only stored `strikerId` on each delivery). Pair openers reset every 4 overs per U9 pairs rules.

## Live scoring (ScorePad)

`apps/web/src/components/scoring/ScorePad.tsx` — tap runs 0–6, wide, no-ball, wicket; squad and innings management.

API:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/matches/:matchId/scoring` | Scoring context (squads, next ball, rules flags) |
| POST | `/api/v1/deliveries` | Record a delivery |
| POST | `/api/v1/matches/:matchId/innings` | Start innings |
| POST | `/api/v1/matches/:matchId/finalize` | Complete match |

Strike rotation after each delivery uses the same rules-engine helper as the simulator.

## Match simulator

`packages/rules-engine/src/simulator.ts` — weighted random outcomes (dots, boundaries, extras, wickets) through the real engine.

Used by `/demo/simulated` and `GET /api/demo/simulated?seed=42`. Server-side render avoids client bundling issues with the rules engine.

## Rules engine additions

| Module | Purpose |
|--------|---------|
| `strike.ts` | Strike rotation helpers |
| `simulator.ts` | Random full-match generator |
| `profiles/u9-softball-london-v1.json` | `rotateStrikeAfterWicket: true` |

## Tests

| Area | File |
|------|------|
| Strike rotation | `packages/rules-engine/src/strike.test.ts` |
| Simulator | `packages/rules-engine/src/simulator.test.ts` |
| Ball labels | `apps/web/tests/unit/ball-label.test.ts` |
| Ball-by-ball | `apps/web/tests/unit/ball-by-ball.test.ts` |
| Match summary & insights | `apps/web/tests/unit/match-summary.test.ts` |
| Aggregates / partnerships | `apps/web/tests/unit/scorecard-aggregate.test.ts` |
| Simulated scorecard | `apps/web/tests/unit/simulated-scorecard.test.ts` |
| Live scoring | `apps/web/tests/services/scoring.test.ts` |
