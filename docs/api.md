# Howzzat REST API (v1)

Base URL: `http://localhost:3000/api/v1` (development)

All successful responses use `{ "data": ... }`. Errors use `{ "error", "code", "details?" }`.

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Service status + endpoint index |

## Auth (session cookie)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/auth/email/send` | `{ email }` | Send 6-digit email OTP (Resend). |
| POST | `/auth/email/verify` | `{ email, code, name? }` | Verify email OTP; creates session. |
| POST | `/auth/register` | `{ email, password, name? }` | Create account (password min 8 chars). |
| POST | `/auth/login/password` | `{ email, password }` | Sign in with password. |
| POST | `/auth/login` | `{ email, name? }` | Dev/test only: passwordless sign-in. |
| POST | `/auth/logout` | — | Clear session |
| GET | `/auth/me` | — | Current user + org memberships, or `null` |
| GET | `/me/organizations` | — | Organizations for signed-in user |
| GET | `/invites/:token` | — | Invite preview (public) |
| POST | `/invites/:token/accept` | — | Accept invite (requires session) |

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
| POST | `/tournaments/:tournamentId/invites` | `{ email, kind?, role?, teamId? }` | Invite manager (`kind`: `MANAGER` or `ORG_MANAGER`) |
| POST | `/tournaments/:tournamentId/rules/preview` | `{ mode, toVersionId? \| overrides? }` | Preview rule change impact |
| POST | `/tournaments/:tournamentId/rules/apply` | `{ mode, toVersionId? \| overrides?, effectiveFromMatchId? }` | Apply BACKFILL or FUTURE_ONLY |

## Matches & scoring

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/matches/:matchId` | — | Match with innings & deliveries |
| PATCH | `/matches/:matchId` | `{ status?, homeScore?, marginText?, ... }` | Update match |
| GET | `/matches/:matchId/scorecard` | — | Computed scorecard via rules engine (includes `ballByBall` when innings exist) |
| GET | `/matches/:matchId/scoring` | — | Live scoring context (squads, next ball, pair/strike flags) |
| GET | `/matches/:matchId/live` | — | Lightweight live snapshot for spectator polling |
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

## Demo (development)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/demo/simulated` | Server-rendered simulated match scorecard page |
| GET | `/api/demo/simulated?seed=N` | JSON `MatchScorecardView` for simulated U9 match |

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

## Web UI routes

| Path | Description |
|------|-------------|
| `/login` | Manager sign-in |
| `/dashboard` | Club management (orgs, teams, tournaments, invites) |
| `/invite/:token` | Accept tournament invite |
| `/orgs/:orgSlug/tournaments/:tournamentSlug` | Public tournament page |

Session auth uses an HttpOnly cookie. Scoring and org APIs remain open in development; signed-in users get OWNER membership when creating an org.
