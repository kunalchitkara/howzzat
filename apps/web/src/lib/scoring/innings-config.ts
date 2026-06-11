import { resolveInningsConfig, type RulesProfile } from "@howzzat/rules-engine";

type SquadRow = { teamId: string };

type MatchTeams = {
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: { team: { id: string } };
  awayTeam: { team: { id: string } };
  playersPerSide: number;
  totalOvers?: number | null;
  squad: SquadRow[];
};

/** Org team id for the side that is batting this innings. */
export function orgTeamIdForBatting(
  match: MatchTeams,
  battingTournamentTeamId: string,
): string {
  return battingTournamentTeamId === match.homeTeamId
    ? match.homeTeam.team.id
    : match.awayTeam.team.id;
}

/** Rules config from how many players are actually in the match squad for the batting side. */
export function resolveInningsConfigForBatting(
  profile: RulesProfile,
  match: MatchTeams,
  battingTournamentTeamId: string,
) {
  const orgTeamId = orgTeamIdForBatting(match, battingTournamentTeamId);
  const squadCount = match.squad.filter((s) => s.teamId === orgTeamId).length;
  const playing = squadCount > 0 ? squadCount : match.playersPerSide;
  const base = resolveInningsConfig(profile, playing);
  if (match.totalOvers != null && match.totalOvers > 0) {
    return { ...base, totalOvers: match.totalOvers };
  }
  return base;
}
