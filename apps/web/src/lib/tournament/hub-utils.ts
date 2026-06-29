import { matchScorecardPath } from "@/lib/match-slug";
import type { TeamStanding, TournamentFixture } from "@/lib/tournament/insights";

export function fixtureScorecardPath(fixture: { id: string; slug: string | null }): string {
  return matchScorecardPath(fixture);
}

export function clubSeasonRecord(
  standings: TeamStanding[],
  clubTeamIds: string[],
): { played: number; won: number; lost: number; drawn: number } {
  const record = { played: 0, won: 0, lost: 0, drawn: 0 };
  for (const teamId of clubTeamIds) {
    const row = standings.find((s) => s.teamId === teamId);
    if (!row) continue;
    record.played += row.played;
    record.won += row.won;
    record.lost += row.lost;
    record.drawn += row.drawn;
  }
  return record;
}

export function fixtureResultLabel(fixture: TournamentFixture): string {
  if (fixture.isLive) return "LIVE";
  if (fixture.status === "WALKOVER") return "Walkover";
  if (fixture.status === "SCHEDULED") return "Upcoming";
  if (fixture.status === "ABANDONED") return "Abandoned";
  if (fixture.marginText) return fixture.marginText;
  if (fixture.homeScore != null && fixture.awayScore != null) {
    return `${fixture.homeScore} – ${fixture.awayScore}`;
  }
  return fixture.status;
}

export function fixtureHasScorecard(fixture: TournamentFixture): boolean {
  return (
    fixture.isLive ||
    fixture.status === "COMPLETED" ||
    fixture.status === "WALKOVER" ||
    (fixture.homeScore != null && fixture.awayScore != null)
  );
}
