# MJCA rules templates

Howzzat ships prefixed **`mjca-*`** built-in rules profiles aligned with [Middlesex Junior Cricket Association (MJCA)](https://mjcacricket.org/mjca-rules/competition-rules/) outdoor competition rules used across London and Middlesex leagues.

Tournament designers can:

1. Pick any MJCA template when creating a tournament (dashboard → New tournament).
2. Toggle **Customize rules** to override tunable fields (starting score, wicket penalty, pair overs, squad size, wide/no-ball runs).
3. Clone and configure via API: `POST /api/v1/rules/profiles` with `builtinId` + `overrides`.

Overrides are stored as a new private rules profile version bound to the tournament.

## Template catalogue

| Template ID | MJCA source | Format | Scoring engine |
|-------------|-------------|--------|----------------|
| `mjca-u9-outdoor-v1` | [U9 outdoor](https://mjcacricket.org/mjca-rules/competition-rules/under-9-outdoor-competition-rules/) | Pairs (4 overs/pair, 2×players overs) | Full |
| `mjca-u10-boys-pairs-v1` | [U10 outdoor](https://mjcacricket.org/mjca-rules/competition-rules/under-10-outdoor-competition-rules/) | Pairs | Full |
| `mjca-girls-u10-softball-pairs-v1` | [Girls outdoor](https://mjcacricket.org/mjca-rules/competition-rules/girls-outdoor-rules/) | Pairs (softball/incrediball) | Full |
| `mjca-girls-u11-hardball-pairs-v1` | Girls outdoor | Pairs (pink hardball) | Full |
| `mjca-girls-u12-hardball-pairs-v1` | Girls outdoor | Pairs | Full |
| `mjca-girls-u13-hardball-v1` | Girls outdoor | Standard 20-over | Partial* |
| `mjca-girls-u14-hardball-v1` | Girls outdoor | Standard 20-over | Partial* |
| `mjca-girls-u15-hardball-v1` | Girls outdoor | Standard 20-over | Partial* |
| `mjca-girls-u17-hardball-v1` | Girls outdoor | Standard 20-over | Partial* |
| `mjca-u17-premier-v1` | [U17 specific](https://mjcacricket.org/mjca-rules/competition-rules/u17-specific-rules/) | Standard 20-over | Partial* |
| `mjca-outdoor-standard-20-v1` | [Main outdoor rules](https://mjcacricket.org/mjca-rules/competition-rules/) | Standard 20-over | Partial* |

\* **Partial** = template documents MJCA wide/no-ball, fielding circles, VRR, free hit, etc. in `league.pendingEngine`. Live scoring today fully supports **pairs** formats; standard innings templates are ready for configuration and future engine work.

## Tunable fields

Each template's `league.tunable` array lists fields designers may override:

- `playersPerSide` — min/max/default squad size
- `pairOvers` — overs per batting pair (pairs formats)
- `startingScore` — pairs starting total (e.g. 200)
- `wicketPenalty` — runs deducted per wicket (pairs)
- `wide` / `noBall` — default runs and re-bowl behaviour
- `totalOvers` — via `oversPerInnings.formula` (`fixed:20`, `2 * playersPerSide`, or `playersPerSide` for 2 overs per player when `pairOvers` is 2)

## API examples

List seeded templates:

```http
GET /api/v1/rules/profiles?includeConfig=true
```

Create tournament with MJCA U10 and custom wicket penalty:

```http
POST /api/v1/organizations/{orgId}/tournaments
{
  "name": "U10 Spring League",
  "rulesTemplateBuiltinId": "mjca-u10-boys-pairs-v1",
  "rulesOverrides": { "wicketPenalty": 5, "startingScore": 200 }
}
```

Clone a custom org-wide profile:

```http
POST /api/v1/rules/profiles
{
  "builtinId": "mjca-u9-outdoor-v1",
  "name": "Edgware U9 2026",
  "overrides": { "playersPerSide": { "default": 8 } }
}
```

## Seeding

All built-in profiles (including every `mjca-*` template) are seeded from JSON in `packages/rules-engine/profiles/`:

```bash
pnpm db:push && pnpm --filter @howzzat/db exec prisma db seed
```

Calling either demo reset endpoint also re-seeds **all** public templates (not just the demo profile):

```bash
curl -X POST http://localhost:3005/api/v1/demo/u9-match
# or
curl -X POST http://localhost:3005/api/v1/demo/ios-match
```

## Related

- `u9-softball-london-v1` — legacy London pairs template (overlaps with `mjca-u9-outdoor-v1`)
- `docs/api.md` — rules profiles endpoints
- `packages/rules-engine/src/profiles.ts` — builtin registry
