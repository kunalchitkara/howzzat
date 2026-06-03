import type { DeliveryEvent } from "@howzzat/rules-engine";
import {
  applyDelivery,
  finalizeInnings,
  replayInnings,
  resolveInningsConfig,
} from "@howzzat/rules-engine";
import { deliveryToEvent } from "./match-utils";
import { prisma } from "../db";
import { ApiError } from "../api/http";
import { getRulesProfileFromVersion } from "./rules-helpers";
import { getTournament } from "./tournaments";
import type {
  createMatchSchema,
  createInningsSchema,
  createDeliverySchema,
  updateMatchSchema,
  setMatchSquadSchema,
} from "../validations";
import type { z } from "zod";

type CreateMatchInput = z.infer<typeof createMatchSchema>;
type CreateInningsInput = z.infer<typeof createInningsSchema>;
type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
type UpdateMatchInput = z.infer<typeof updateMatchSchema>;
type SetSquadInput = z.infer<typeof setMatchSquadSchema>;

const matchInclude = {
  tournament: {
    include: { rulesProfileVersion: { include: { template: true } } },
  },
  homeTeam: { include: { team: true } },
  awayTeam: { include: { team: true } },
  innings: {
    orderBy: { inningsNumber: "asc" as const },
    include: {
      deliveries: { orderBy: { sequence: "asc" as const } },
    },
  },
  squad: { include: { player: true } },
  playerStats: { include: { player: true } },
};

export async function listMatches(tournamentId: string) {
  return prisma.match.findMany({
    where: { tournamentId },
    orderBy: [{ matchNumber: "asc" }, { scheduledAt: "asc" }],
    include: {
      homeTeam: { include: { team: true } },
      awayTeam: { include: { team: true } },
    },
  });
}

export async function getMatch(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: matchInclude,
  });
  if (!match) throw new ApiError(404, "Match not found", "MATCH_NOT_FOUND");
  return match;
}

export async function createMatch(tournamentId: string, input: CreateMatchInput) {
  const tournament = await getTournament(tournamentId);

  if (input.homeTeamId === input.awayTeamId) {
    throw new ApiError(400, "Home and away teams must differ", "SAME_TEAMS");
  }

  const home = await prisma.tournamentTeam.findUnique({
    where: { id: input.homeTeamId },
  });
  const away = await prisma.tournamentTeam.findUnique({
    where: { id: input.awayTeamId },
  });
  if (!home || !away || home.tournamentId !== tournamentId || away.tournamentId !== tournamentId) {
    throw new ApiError(400, "Invalid tournament teams", "INVALID_TEAMS");
  }

  return prisma.match.create({
    data: {
      tournamentId,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      matchNumber: input.matchNumber,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      venue: input.venue,
      playersPerSide: input.playersPerSide ?? 8,
      isOfficial: input.isOfficial ?? true,
      publicSlug: input.publicSlug,
      rulesVersionId: tournament.rulesProfileVersionId,
    },
    include: {
      homeTeam: { include: { team: true } },
      awayTeam: { include: { team: true } },
    },
  });
}

export async function updateMatch(matchId: string, input: UpdateMatchInput) {
  await getMatch(matchId);
  return prisma.match.update({
    where: { id: matchId },
    data: {
      status: input.status,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      venue: input.venue,
      resultSummary: input.resultSummary,
      homeScore: input.homeScore,
      awayScore: input.awayScore,
      marginText: input.marginText,
      winningTeamId: input.winningTeamId,
    },
    include: matchInclude,
  });
}

export async function setMatchSquad(matchId: string, input: SetSquadInput) {
  const match = await getMatch(matchId);

  const memberships = await prisma.teamMembership.findMany({
    where: {
      teamId: input.teamId,
      playerId: { in: input.playerIds },
      active: true,
    },
  });
  if (memberships.length !== input.playerIds.length) {
    throw new ApiError(
      400,
      "All players must be active squad members of the team",
      "INVALID_SQUAD",
    );
  }

  await prisma.matchSquadPlayer.deleteMany({
    where: { matchId, teamId: input.teamId },
  });

  await prisma.matchSquadPlayer.createMany({
    data: input.playerIds.map((playerId) => ({
      matchId,
      playerId,
      teamId: input.teamId,
    })),
  });

  return getMatch(matchId);
}

export async function createInnings(matchId: string, input: CreateInningsInput) {
  const match = await getMatch(matchId);
  const rulesVersionId =
    match.rulesVersionId ?? match.tournament.rulesProfileVersionId;

  const existing = await prisma.innings.findUnique({
    where: {
      matchId_inningsNumber: {
        matchId,
        inningsNumber: input.inningsNumber,
      },
    },
  });
  if (existing) {
    throw new ApiError(409, "Innings already exists", "INNINGS_EXISTS");
  }

  const tt = await prisma.tournamentTeam.findUnique({
    where: { id: input.battingTeamId },
  });
  if (!tt || tt.tournamentId !== match.tournamentId) {
    throw new ApiError(400, "Invalid batting team", "INVALID_TEAM");
  }

  const innings = await prisma.innings.create({
    data: {
      matchId,
      battingTeamId: input.battingTeamId,
      inningsNumber: input.inningsNumber,
      rulesVersionId,
    },
  });

  if (match.status === "SCHEDULED") {
    await prisma.match.update({
      where: { id: matchId },
      data: { status: "LIVE", rulesVersionId },
    });
  }

  return innings;
}

export async function recordDelivery(input: CreateDeliveryInput) {
  const innings = await prisma.innings.findUnique({
    where: { id: input.inningsId },
    include: {
      match: {
        include: {
          tournament: true,
        },
      },
      deliveries: { orderBy: { sequence: "asc" } },
    },
  });
  if (!innings) {
    throw new ApiError(404, "Innings not found", "INNINGS_NOT_FOUND");
  }

  const profile = await getRulesProfileFromVersion(innings.rulesVersionId);
  const config = resolveInningsConfig(profile, innings.match.playersPerSide);

  const inningsConfig = {
    playersPerSide: config.playersPerSide,
    totalOvers: config.totalOvers,
  };

  const priorEvents = innings.deliveries.map(deliveryToEvent);
  const priorState = replayInnings(profile, inningsConfig, priorEvents);

  const event: DeliveryEvent = {
    overNumber: input.overNumber,
    ballInOver: input.ballInOver,
    isLegalBall: input.isLegalBall ?? true,
    runsOffBat: input.runsOffBat,
    extrasType: input.extrasType,
    extrasRuns: input.extrasRuns,
    wicketType: input.wicketType,
    strikerId: input.strikerId,
    nonStrikerId: input.nonStrikerId,
    bowlerId: input.bowlerId,
    fielderId: input.fielderId,
    dismissedBatsmanId: input.dismissedBatsmanId,
  };

  applyDelivery(priorState, event, profile);

  const sequence = innings.deliveries.length + 1;

  const delivery = await prisma.delivery.create({
    data: {
      inningsId: input.inningsId,
      sequence,
      overNumber: input.overNumber,
      ballInOver: input.ballInOver,
      isLegalBall: input.isLegalBall ?? true,
      runsOffBat: input.runsOffBat,
      extrasType: input.extrasType,
      extrasRuns: input.extrasRuns,
      wicketType: input.wicketType,
      strikerId: input.strikerId,
      nonStrikerId: input.nonStrikerId,
      bowlerId: input.bowlerId,
      fielderId: input.fielderId,
      dismissedBatsmanId: input.dismissedBatsmanId,
      rulesVersionId: innings.rulesVersionId,
    },
  });

  const finalState = replayInnings(profile, inningsConfig, [
    ...priorEvents,
    event,
  ]);
  const totals = finalizeInnings(finalState, profile);

  await prisma.innings.update({
    where: { id: input.inningsId },
    data: {
      totalRuns: totals.totalRuns,
      wickets: totals.wickets,
      batRuns: totals.batRuns,
      netRuns: totals.netRuns,
      oversBowled: totals.oversBowled,
    },
  });

  if (innings.match.status === "SCHEDULED") {
    await prisma.match.update({
      where: { id: innings.matchId },
      data: { status: "LIVE" },
    });
  }

  return { delivery, totals };
}

export async function finalizeMatchInnings(matchId: string) {
  const match = await getMatch(matchId);

  let homeScore: number | undefined;
  let awayScore: number | undefined;

  if (match.innings.length >= 1) {
    const inn1 = match.innings[0];
    if (inn1?.battingTeamId === match.homeTeamId) {
      homeScore = inn1.totalRuns ?? undefined;
    } else {
      awayScore = inn1.totalRuns ?? undefined;
    }
  }
  if (match.innings.length >= 2) {
    const inn2 = match.innings[1];
    if (inn2?.battingTeamId === match.homeTeamId) {
      homeScore = inn2.totalRuns ?? undefined;
    } else {
      awayScore = inn2.totalRuns ?? undefined;
    }
  }

  return prisma.match.update({
    where: { id: matchId },
    data: {
      status: "COMPLETED",
      homeScore,
      awayScore,
    },
    include: matchInclude,
  });
}

export async function getMatchScorecard(matchId: string) {
  const match = await getMatch(matchId);
  const profile = await getRulesProfileFromVersion(
    match.rulesVersionId ?? match.tournament.rulesProfileVersionId,
  );

  const inningsScorecards = match.innings.map((innings) => {
    const config = resolveInningsConfig(profile, match.playersPerSide);
    const events = innings.deliveries.map(deliveryToEvent);
    const state = replayInnings(profile, {
      playersPerSide: config.playersPerSide,
      totalOvers: config.totalOvers,
    }, events);
    const totals = finalizeInnings(state, profile);

    return {
      inningsId: innings.id,
      inningsNumber: innings.inningsNumber,
      battingTeamId: innings.battingTeamId,
      stored: {
        totalRuns: innings.totalRuns,
        wickets: innings.wickets,
        batRuns: innings.batRuns,
        netRuns: innings.netRuns,
      },
      computed: totals,
      deliveryCount: innings.deliveries.length,
    };
  });

  return { match, profile: { id: profile.id, name: profile.name }, inningsScorecards };
}
