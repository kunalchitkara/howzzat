import {
  finalizeInnings,
  replayInnings,
  resolveInningsConfig,
} from "@howzzat/rules-engine";
import {
  isInningsComplete,
  nextBallAfterDeliveries,
} from "@/lib/scoring/ball-position";
import type { MatchScoringContext, ScoringPlayer } from "@/lib/scoring/types";
import { deliveryToEvent } from "./match-utils";
import { getMatch } from "./matches";
import { getRulesProfileFromVersion } from "./rules-helpers";
import { prisma } from "../db";

async function rosterForTeam(teamId: string): Promise<ScoringPlayer[]> {
  const memberships = await prisma.teamMembership.findMany({
    where: { teamId, active: true },
    include: { player: true },
    orderBy: { shirtNumber: "asc" },
  });
  return memberships.map((m) => ({
    id: m.player.id,
    name: m.player.displayName ?? m.player.legalName,
    teamId,
  }));
}

function squadPlayers(
  matchSquad: { playerId: string; teamId: string; player: { legalName: string; displayName: string | null } }[],
  teamId: string,
): ScoringPlayer[] {
  return matchSquad
    .filter((s) => s.teamId === teamId)
    .map((s) => ({
      id: s.playerId,
      name: s.player.displayName ?? s.player.legalName,
      teamId,
    }));
}

export async function getMatchScoringContext(
  matchId: string,
): Promise<MatchScoringContext> {
  const match = await getMatch(matchId);
  const profile = await getRulesProfileFromVersion(
    match.rulesVersionId ?? match.tournament.rulesProfileVersionId,
  );
  const config = resolveInningsConfig(profile, match.playersPerSide);

  const homeTeamId = match.homeTeam.team.id;
  const awayTeamId = match.awayTeam.team.id;

  const homeSquad = squadPlayers(match.squad, homeTeamId);
  const awaySquad = squadPlayers(match.squad, awayTeamId);

  const squads = {
    home:
      homeSquad.length > 0
        ? homeSquad
        : await rosterForTeam(homeTeamId),
    away:
      awaySquad.length > 0
        ? awaySquad
        : await rosterForTeam(awayTeamId),
  };

  const teamName = (tournamentTeamId: string) =>
    tournamentTeamId === match.homeTeamId
      ? match.homeTeam.team.name
      : match.awayTeam.team.name;

  const inningsViews = match.innings.map((innings) => {
    const events = innings.deliveries.map(deliveryToEvent);
    const state = replayInnings(
      profile,
      {
        playersPerSide: config.playersPerSide,
        totalOvers: config.totalOvers,
      },
      events,
    );
    const totals = finalizeInnings(state, profile);
    const battingTeamId = innings.battingTeamId;
    const bowlingTeamId =
      battingTeamId === match.homeTeamId
        ? match.awayTeamId
        : match.homeTeamId;

    return {
      id: innings.id,
      inningsNumber: innings.inningsNumber,
      battingTeamId,
      battingTeamName: teamName(battingTeamId),
      bowlingTeamName: teamName(bowlingTeamId),
      totalRuns: totals.totalRuns,
      wickets: totals.wickets,
      batRuns: totals.batRuns,
      netRuns: totals.netRuns,
      oversBowled: totals.oversBowled,
      deliveryCount: innings.deliveries.length,
      complete: isInningsComplete(innings.deliveries, config.totalOvers),
      nextBall: nextBallAfterDeliveries(
        innings.deliveries,
        config.totalOvers,
      ),
    };
  });

  const activeInnings =
    inningsViews.find((i) => !i.complete) ?? null;

  let canStartInnings: MatchScoringContext["canStartInnings"] = null;
  if (!activeInnings) {
    if (inningsViews.length === 0) {
      canStartInnings = {
        inningsNumber: 1,
        battingTeamId: match.homeTeamId,
        label: `${match.homeTeam.team.name} to bat (1st innings)`,
      };
    } else if (inningsViews.length === 1 && inningsViews[0]?.complete) {
      const first = inningsViews[0];
      const secondBatting =
        first.battingTeamId === match.homeTeamId
          ? match.awayTeamId
          : match.homeTeamId;
      canStartInnings = {
        inningsNumber: 2,
        battingTeamId: secondBatting,
        label: `${teamName(secondBatting)} to bat (2nd innings)`,
      };
    }
  }

  const canFinalize =
    inningsViews.length >= 2 &&
    inningsViews.every((i) => i.complete) &&
    match.status !== "COMPLETED";

  return {
    matchId: match.id,
    status: match.status,
    homeTeam: {
      id: match.homeTeamId,
      name: match.homeTeam.team.name,
      teamId: homeTeamId,
    },
    awayTeam: {
      id: match.awayTeamId,
      name: match.awayTeam.team.name,
      teamId: awayTeamId,
    },
    venue: match.venue ?? undefined,
    playersPerSide: config.playersPerSide,
    totalOvers: config.totalOvers,
    pairOvers: profile.pairOvers,
    startingScore: profile.startingScore,
    wicketPenalty: profile.wicketPenalty,
    rotateStrikeAfterWicket: profile.dismissals.rotateStrikeAfterWicket ?? false,
    squads,
    innings: inningsViews,
    activeInningsId: activeInnings?.id ?? null,
    canStartInnings,
    canFinalize,
  };
}
