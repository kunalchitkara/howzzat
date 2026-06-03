# Howzzat REST API (v1)

Base URL: `http://localhost:3000/api/v1` (development)

All successful responses use `{ "data": ... }`. Errors use `{ "error", "code", "details?" }`.

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Service status + endpoint index |

## Organizations

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/organizations` | — | List organizations |
| POST | `/organizations` | `{ name, slug?, description?, homeGround? }` | Create organization |
| GET | `/organizations/:orgId` | — | Organization with teams & tournaments |

## Teams

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/organizations/:orgId/teams` | — | List teams |
| POST | `/organizations/:orgId/teams` | `{ name, slug?, homeGround?, ageGroup? }` | Create team |
| GET | `/teams/:teamId` | — | Team with squad |
| GET | `/teams/:teamId/players` | — | Active players |
| POST | `/teams/:teamId/players` | `{ legalName, displayName?, dateOfBirth?, shirtNumber? }` | Add player |

## Tournaments

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/organizations/:orgId/tournaments` | — | List tournaments |
| POST | `/organizations/:orgId/tournaments` | `{ name, slug?, ageGroup?, seasonLabel?, rulesTemplateBuiltinId?, rulesProfileVersionId? }` | Create tournament |
| GET | `/tournaments/:tournamentId` | — | Full tournament (teams, matches, rules) |
| POST | `/tournaments/:tournamentId/teams` | `{ teamId, publicSlug? }` | Register team |
| GET | `/tournaments/:tournamentId/matches` | — | List fixtures |
| POST | `/tournaments/:tournamentId/matches` | `{ homeTeamId, awayTeamId, matchNumber?, scheduledAt?, venue?, playersPerSide? }` | Create match |
| GET | `/tournaments/:tournamentId/invites` | — | List invites |
| POST | `/tournaments/:tournamentId/invites` | `{ email, role?, teamId? }` | Invite coach |
| POST | `/tournaments/:tournamentId/rules/preview` | `{ mode, toVersionId? \| overrides? }` | Preview rule change impact |
| POST | `/tournaments/:tournamentId/rules/apply` | `{ mode, toVersionId? \| overrides?, effectiveFromMatchId? }` | Apply BACKFILL or FUTURE_ONLY |

## Matches & scoring

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/matches/:matchId` | — | Match with innings & deliveries |
| PATCH | `/matches/:matchId` | `{ status?, homeScore?, marginText?, ... }` | Update match |
| GET | `/matches/:matchId/scorecard` | — | Computed scorecard via rules engine |
| POST | `/matches/:matchId/innings` | `{ battingTeamId, inningsNumber }` | Start innings |
| POST | `/matches/:matchId/squad` | `{ teamId, playerIds[] }` | Set match squad |
| POST | `/matches/:matchId/finalize` | — | Mark COMPLETED, sync scores |
| POST | `/deliveries` | See below | Record ball-by-ball |

### Delivery payload

```json
{
  "inningsId": "cuid",
  "overNumber": 1,
  "ballInOver": 1,
  "runsOffBat": 4,
  "extrasRuns": 0,
  "strikerId": "cuid",
  "nonStrikerId": "cuid",
  "bowlerId": "cuid",
  "wicketType": "bowled",
  "dismissedBatsmanId": "cuid"
}
```

Extras: `extrasType` = `wide` | `no_ball` | `bye` | `leg_bye` | `wide_runs` | `no_ball_runs`

## Rules profiles

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/rules/profiles?includeConfig=true` | — | List templates + latest version |
| POST | `/rules/profiles` | `{ builtinId? \| templateId?, name?, overrides?, label? }` | Clone & configure |
| GET | `/rules/profiles/:versionId` | — | Version with parsed config |

## Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/public/orgs/:orgSlug/tournaments/:tournamentSlug` | Public tournament dashboard data |

## Example: end-to-end flow

```bash
# 1. Create org
curl -X POST localhost:3000/api/v1/organizations \
  -H 'Content-Type: application/json' \
  -d '{"name":"Edgware Cricket Club","slug":"edgware-cc"}'

# 2. Create tournament (defaults to u9-softball-london-v1)
curl -X POST localhost:3000/api/v1/organizations/{orgId}/tournaments \
  -H 'Content-Type: application/json' \
  -d '{"name":"U9 Softball 2026","ageGroup":"U9","seasonLabel":"Summer 2026"}'

# 3. Create team + players, register in tournament, create match, start innings, score ball
curl -X POST localhost:3000/api/v1/deliveries \
  -H 'Content-Type: application/json' \
  -d '{"inningsId":"...","overNumber":1,"ballInOver":1,"runsOffBat":4,"strikerId":"...","nonStrikerId":"...","bowlerId":"..."}'
```

Auth (Better Auth / magic link) is planned — APIs are currently open for development.
