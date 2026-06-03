import type { MatchScorecardView, PlayerInfo } from "@/lib/scorecard/types";
import {
  aggregateFielding,
  aggregateInningsFromDeliveries,
} from "@/lib/scorecard/aggregate";
import { buildMatchBallByBall } from "@/lib/scorecard/ball-by-ball";
import { getMatchScorecard } from "@/lib/services/matches";
import { deliveryToEvent } from "@/lib/services/match-utils";
import { getRulesProfileFromVersion } from "@/lib/services/rules-helpers";
import { resolveInningsConfig } from "@howzzat/rules-engine";

type RawScorecard = Awaited<ReturnType<typeof getMatchScorecard>>;

export async function buildMatchScorecardFromRaw(
  raw: RawScorecard,
): Promise<MatchScorecardView> {
  const { match, profile } = raw;

  const homeName = match.homeTeam.team.name;
  const awayName = match.awayTeam.team.name;
  const players: PlayerInfo[] = match.squad.map((s) => ({
    id: s.player.id,
    name: s.player.legalName,
    displayName: s.player.displayName ?? undefined,
  }));

  const playerMap = new Map(players.map((p) => [p.id, p]));
  const rulesProfile = await getRulesProfileFromVersion(
    match.rulesVersionId ?? match.tournament.rulesProfileVersionId,
  );

  const inningsViews = match.innings.map((innings, idx) => {
    const teamName =
      innings.battingTeamId === match.homeTeamId ? homeName : awayName;
    const events = innings.deliveries.map(deliveryToEvent);
    const sc = raw.inningsScorecards[idx];
    const totals = sc?.computed ?? {
      totalRuns: innings.totalRuns ?? 200,
      wickets: innings.wickets ?? 0,
      batRuns: innings.batRuns ?? 0,
      netRuns: innings.netRuns ?? 0,
      oversBowled: innings.oversBowled ?? 0,
    };

    const base = aggregateInningsFromDeliveries({
      teamName,
      inningsLabel: `${teamName} — Innings ${innings.inningsNumber}`,
      deliveries: events,
      players,
      profile: rulesProfile,
      totalRuns: totals.totalRuns,
      wickets: totals.wickets,
      batRuns: totals.batRuns,
      netRuns: totals.netRuns,
      oversBowled: totals.oversBowled,
    });

    return {
      ...base,
      partnerships: [],
      fielding: aggregateFielding(events, playerMap),
    };
  });

  let resultBanner: MatchScorecardView["resultBanner"];
  if (
    match.status === "COMPLETED" &&
    match.homeScore != null &&
    match.awayScore != null
  ) {
    const margin = Math.abs(match.homeScore - match.awayScore);
    const homeWon = match.homeScore > match.awayScore;
    resultBanner = {
      text:
        match.marginText ??
        `${homeWon ? homeName : awayName} won by ${margin} runs`,
      subtext: `${match.playersPerSide * 2} overs · ${profile.name}`,
      variant: "neutral",
    };
  }

  return {
    matchTitle: `${homeName} vs ${awayName}`,
    venue: match.venue ?? undefined,
    date: match.scheduledAt?.toISOString().slice(0, 10),
    status: match.status,
    resultBanner,
    innings: inningsViews,
    ballByBall:
      match.innings.length > 0
        ? buildMatchBallByBall({
            profile: rulesProfile,
            totalOvers: resolveInningsConfig(
              rulesProfile,
              match.playersPerSide,
            ).totalOvers,
            players,
            innings: match.innings.map((innings) => {
              const battingClubTeamId =
                innings.battingTeamId === match.homeTeamId
                  ? match.homeTeam.team.id
                  : match.awayTeam.team.id;
              return {
                teamName:
                  innings.battingTeamId === match.homeTeamId
                    ? homeName
                    : awayName,
                label: `${innings.battingTeamId === match.homeTeamId ? homeName : awayName} — Innings ${innings.inningsNumber}`,
                deliveries: innings.deliveries.map(deliveryToEvent),
                battingOrder: match.squad
                  .filter((s) => s.teamId === battingClubTeamId)
                  .map((s) => ({
                    id: s.player.id,
                    name: s.player.legalName,
                    displayName: s.player.displayName ?? undefined,
                  })),
              };
            }),
          })
        : undefined,
    rulesNote: `Base ${rulesProfile.startingScore} · −${rulesProfile.wicketPenalty} per wicket · Net = bat runs − (${rulesProfile.wicketPenalty} × wickets)`,
  };
}

export async function buildMatchScorecardView(
  matchId: string,
): Promise<MatchScorecardView> {
  const raw = await getMatchScorecard(matchId);
  return buildMatchScorecardFromRaw(raw);
}
