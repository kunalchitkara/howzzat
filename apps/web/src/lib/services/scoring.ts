import {
  finalizeInnings,
  replayInnings,
  resolveInningsConfig,
} from "@howzzat/rules-engine";
import {
  currentOverBowler,
  isInningsComplete,
  nextBallAfterDeliveries,
} from "@/lib/scoring/ball-position";
import type { MatchScoringContext, ScoringPlayer } from "@/lib/scoring/types";
import {
  ageOnDate,
  isOverAgeGroup,
  parseAgeGroupCap,
} from "@/lib/scoring/age-eligibility";
import { deliveryToEvent } from "./match-utils";
import { getMatch } from "./matches";
import { getRulesProfileFromVersion } from "./rules-helpers";
import { prisma } from "../db";

type MembershipWithPlayer = {
  player: {
    id: string;
    legalName: string;
    displayName: string | null;
    dateOfBirth: Date | null;
  };
  shirtNumber: number | null;
};

function mapPlayer(
  player: MembershipWithPlayer["player"],
  teamId: string,
  ageGroupCap: number | null,
  referenceDate: Date,
): ScoringPlayer {
  const age = player.dateOfBirth
    ? ageOnDate(player.dateOfBirth, referenceDate)
    : null;
  return {
    id: player.id,
    name: player.displayName ?? player.legalName,
    teamId,
    dateOfBirth: player.dateOfBirth?.toISOString() ?? null,
    ageOnMatchDay: age,
    overAge: isOverAgeGroup(player.dateOfBirth, ageGroupCap, referenceDate),
  };
}

async function rosterForTeam(
  teamId: string,
  ageGroupCap: number | null,
  referenceDate: Date,
): Promise<ScoringPlayer[]> {
  const memberships = await prisma.teamMembership.findMany({
    where: { teamId, active: true },
    include: { player: true },
    orderBy: { shirtNumber: "asc" },
  });
  return memberships.map((m) =>
    mapPlayer(m.player, teamId, ageGroupCap, referenceDate),
  );
}

function squadPlayers(
  matchSquad: {
    playerId: string;
    teamId: string;
    role: string;
    player: MembershipWithPlayer["player"];
  }[],
  teamId: string,
  ageGroupCap: number | null,
  referenceDate: Date,
): ScoringPlayer[] {
  return matchSquad
    .filter((s) => s.teamId === teamId)
    .map((s) => ({
      ...mapPlayer(s.player, teamId, ageGroupCap, referenceDate),
      isCaptain: s.role === "captain",
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
  const ageGroupCap = parseAgeGroupCap(match.tournament.ageGroup);
  const referenceDate = match.scheduledAt ?? new Date();

  const homeRoster = await rosterForTeam(homeTeamId, ageGroupCap, referenceDate);
  const awayRoster = await rosterForTeam(awayTeamId, ageGroupCap, referenceDate);

  const homeSquad = squadPlayers(
    match.squad,
    homeTeamId,
    ageGroupCap,
    referenceDate,
  );
  const awaySquad = squadPlayers(
    match.squad,
    awayTeamId,
    ageGroupCap,
    referenceDate,
  );

  const squads = {
    home: homeSquad,
    away: awaySquad,
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
    const nextBall = nextBallAfterDeliveries(
      innings.deliveries,
      config.totalOvers,
    );
    const { locked: bowlerLocked, bowlerId: lockedBowlerId } = currentOverBowler(
      innings.deliveries,
      nextBall,
    );
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
      nextBall,
      bowlerLocked,
      lockedBowlerId,
    };
  });

  const activeInnings =
    inningsViews.find((i) => !i.complete) ?? null;

  const tossWinnerName = match.tossWinnerId
    ? teamName(match.tossWinnerId)
    : null;
  const tossCaller = match.tossCallerPlayerId
    ? match.squad.find((s) => s.playerId === match.tossCallerPlayerId)
    : null;
  const battingFirstTeamId =
    match.tossWinnerId && match.electedTo
      ? match.electedTo === "bat"
        ? match.tossWinnerId
        : match.tossWinnerId === match.homeTeamId
          ? match.awayTeamId
          : match.homeTeamId
      : null;

  let canStartInnings: MatchScoringContext["canStartInnings"] = null;
  if (!activeInnings && match.tossWinnerId && battingFirstTeamId) {
    if (inningsViews.length === 0) {
      canStartInnings = {
        inningsNumber: 1,
        battingTeamId: battingFirstTeamId,
        label: `${teamName(battingFirstTeamId)} to bat`,
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

  const singleInnings = profile.format === "pairs_single_innings";
  const inningsRequired = singleInnings ? 1 : 2;
  const canFinalize =
    inningsViews.length >= inningsRequired &&
    inningsViews.every((i) => i.complete) &&
    match.status !== "COMPLETED";

  return {
    matchId: match.id,
    status: match.status,
    toss: {
      tossWinnerTeamId: match.tossWinnerId,
      tossWinnerName,
      electedTo: match.electedTo,
      tossCallerPlayerId: match.tossCallerPlayerId,
      tossCallerName: tossCaller
        ? (tossCaller.player.displayName ?? tossCaller.player.legalName)
        : null,
      battingFirstTeamId,
    },
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
    tournamentAgeGroup: match.tournament.ageGroup,
    squads,
    rosters: { home: homeRoster, away: awayRoster },
    innings: inningsViews,
    activeInningsId: activeInnings?.id ?? null,
    canStartInnings,
    canFinalize,
  };
}
