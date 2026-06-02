# Mid-tournament rule changes

Coaches can clone `u9-softball-london-v1` and tweak settings (e.g. wicket penalty, wide runs). If they change rules after matches have started:

## Modes

### FUTURE_ONLY (default recommendation)

- Historical deliveries keep their original `rulesVersionId`
- New deliveries use the new version
- Leaderboards for completed matches unchanged unless manager explicitly recalculates

### BACKFILL

- Replays every delivery in affected innings with the new rules profile
- Updates `totalRuns`, `netRuns`, bowling figures, and `PlayerMatchStats`
- Use when the change fixes an error in the configured rules (not a format change mid-season)

## UX flow (planned)

1. Manager opens Tournament → Rules → "New version from current"
2. Edit allowed fields (wicket penalty, wide/no-ball runs, starting score, etc.)
3. Preview impact on last completed match
4. Choose FUTURE_ONLY or BACKFILL
5. Confirm → creates `RuleChangeRequest` → background job applies

## Engine

See `packages/rules-engine/src/rule-changes.ts` and `applyRuleChange()`.
