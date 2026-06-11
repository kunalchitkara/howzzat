import type { DeliveryEvent } from "@howzzat/rules-engine";
import {
  applyDelivery,
  finalizeInnings,
  replayInnings,
  resolveInningsConfig,
} from "@howzzat/rules-engine";
import { resolveInningsConfigForBatting } from "@/lib/scoring/innings-config";
import {
  canAcceptDelivery,
  countLegalBalls,
  isInningsComplete,
} from "@/lib/scoring/ball-position";
import { buildHostResultLine } from "@/lib/scoring/match-result";
import { deliveryToEvent } from "./match-utils";
import { prisma } from "../db";
import { ApiError } from "../api/http";
import { getRulesProfileFromVersion } from "./rules-helpers";
import { getTournament } from "./tournaments";
import type {
  createMatchSchema,
  createInningsSchema,
  createDeliverySchema,
  updateDeliverySchema,
  updateMatchSchema,
  setMatchSquadSchema,
} from "../validations";
import type { z } from "zod";

type CreateMatchInput = z.infer<typeof createMatchSchema>;
type CreateInningsInput = z.infer<typeof createInningsSchema>;
type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
type UpdateDeliveryInput = z.infer<typeof updateDeliverySchema>;
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
      tossWinnerId: input.tossWinnerId,
      electedTo: input.electedTo,
      tossCallerPlayerId: input.tossCallerPlayerId,
    },
    include: matchInclude,
  });
}

/** Record toss and set match LIVE. Returns batting team id for 1st innings. */
export async function recordToss(
  matchId: string,
  input: {
    tossWinnerTeamId: string;
    tossCallerPlayerId?: string;
    electedTo: "bat" | "bowl";
  },
) {
  const match = await getMatch(matchId);
  if (!match.squadsConfirmedAt) {
    throw new ApiError(400, "Confirm match squads before the toss", "SQUADS_NOT_CONFIRMED");
  }
  const teams = [match.homeTeamId, match.awayTeamId];
  if (!teams.includes(input.tossWinnerTeamId)) {
    throw new ApiError(400, "Toss winner must be a match team", "INVALID_TOSS");
  }

  if (input.tossCallerPlayerId) {
    const inSquad = match.squad.some(
      (s) => s.playerId === input.tossCallerPlayerId,
    );
    if (!inSquad) {
      throw new ApiError(400, "Toss caller must be in match squad", "INVALID_TOSS");
    }
  }

  const battingFirstId =
    input.electedTo === "bat"
      ? input.tossWinnerTeamId
      : teams.find((t) => t !== input.tossWinnerTeamId)!;

  await prisma.match.update({
    where: { id: matchId },
    data: {
      tossWinnerId: input.tossWinnerTeamId,
      tossCallerPlayerId: input.tossCallerPlayerId ?? null,
      electedTo: input.electedTo,
      status: "LIVE",
    },
  });

  return { battingFirstId, tossWinnerTeamId: input.tossWinnerTeamId };
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
      role: playerId === input.captainId ? "captain" : "player",
    })),
  });

  return getMatch(matchId);
}

export async function confirmMatchSquads(
  matchId: string,
  options?: { totalOvers?: number },
) {
  const match = await getMatch(matchId);
  const profile = await getRulesProfileFromVersion(
    match.rulesVersionId ?? match.tournament.rulesProfileVersionId,
  );
  const squadMin = profile.playersPerSide.min;
  const squadMax = profile.playersPerSide.max;
  const homeCount = match.squad.filter(
    (s) => s.teamId === match.homeTeam.team.id,
  ).length;
  const awayCount = match.squad.filter(
    (s) => s.teamId === match.awayTeam.team.id,
  ).length;
  if (homeCount < squadMin || awayCount < squadMin) {
    throw new ApiError(
      400,
      `Each side needs at least ${squadMin} players in the match squad`,
      "SQUAD_INCOMPLETE",
    );
  }
  if (homeCount > squadMax || awayCount > squadMax) {
    throw new ApiError(
      400,
      `Each side can have at most ${squadMax} players in the match squad`,
      "SQUAD_TOO_LARGE",
    );
  }
  const playersPerSide = Math.min(
    squadMax,
    Math.max(homeCount, awayCount),
  );
  const defaultOvers = resolveInningsConfig(profile, playersPerSide).totalOvers;
  const totalOvers = options?.totalOvers ?? defaultOvers;
  if (totalOvers < 1 || totalOvers > 50) {
    throw new ApiError(
      400,
      "Overs per innings must be between 1 and 50",
      "INVALID_OVERS",
    );
  }
  await prisma.match.update({
    where: { id: matchId },
    data: {
      squadsConfirmedAt: new Date(),
      playersPerSide,
      totalOvers,
    },
  });
  return getMatch(matchId);
}

/** Undo squad confirm (and toss) before any innings — returns to step 1. */
export async function reopenMatchSquads(matchId: string) {
  const match = await getMatch(matchId);
  if (match.status === "COMPLETED") {
    throw new ApiError(400, "Match is complete", "MATCH_COMPLETE");
  }
  if (match.innings.length > 0) {
    throw new ApiError(
      400,
      "Cannot change squads after the match has started",
      "MATCH_STARTED",
    );
  }
  await prisma.match.update({
    where: { id: matchId },
    data: {
      squadsConfirmedAt: null,
      tossWinnerId: null,
      electedTo: null,
      tossCallerPlayerId: null,
      status: "SCHEDULED",
    },
  });
  return getMatch(matchId);
}

export async function endInningsEarly(matchId: string, inningsId: string) {
  const match = await getMatch(matchId);
  const innings = match.innings.find((i) => i.id === inningsId);
  if (!innings) {
    throw new ApiError(404, "Innings not found", "INNINGS_NOT_FOUND");
  }
  if (innings.endedAt) {
    return innings;
  }
  return prisma.innings.update({
    where: { id: inningsId },
    data: { endedAt: new Date() },
  });
}

export async function continueChaseAfterTarget(matchId: string) {
  const match = await getMatch(matchId);
  if (match.innings.length < 2) {
    throw new ApiError(400, "Second innings not started", "NO_CHASE");
  }
  await prisma.match.update({
    where: { id: matchId },
    data: { chaseContinuedAfterTarget: true },
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

  const matchForConfig = await getMatch(innings.matchId);
  const profile = await getRulesProfileFromVersion(innings.rulesVersionId);
  const config = resolveInningsConfigForBatting(
    profile,
    matchForConfig,
    innings.battingTeamId,
  );

  const incomingIsLegal = input.isLegalBall ?? true;
  const accept = canAcceptDelivery(
    innings.deliveries,
    config.totalOvers,
    incomingIsLegal,
    innings.endedAt,
  );
  if (!accept.ok) {
    throw new ApiError(400, accept.reason, "INNINGS_COMPLETE");
  }

  if (
    input.wicketType &&
    ["caught", "run_out", "stumped"].includes(input.wicketType) &&
    !input.fielderId
  ) {
    throw new ApiError(
      400,
      "Fielder required for caught, run out, and stumped",
      "FIELDER_REQUIRED",
    );
  }

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
    extrasRunsType: input.extrasRunsType,
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
      extrasRunsType: input.extrasRunsType,
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

  const allEvents = [...priorEvents, event];
  const inningsEnded = isInningsComplete(
    allEvents.map((e) => ({ isLegalBall: e.isLegalBall })),
    config.totalOvers,
    innings.endedAt,
  );

  await prisma.innings.update({
    where: { id: input.inningsId },
    data: {
      totalRuns: totals.totalRuns,
      wickets: totals.wickets,
      batRuns: totals.batRuns,
      netRuns: totals.netRuns,
      oversBowled: totals.oversBowled,
      ...(inningsEnded && !innings.endedAt ? { endedAt: new Date() } : {}),
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

async function persistInningsTotalsFromDeliveries(
  inningsId: string,
  profile: Awaited<ReturnType<typeof getRulesProfileFromVersion>>,
  inningsConfig: { playersPerSide: number; totalOvers: number },
  events: DeliveryEvent[],
) {
  let state;
  try {
    state = replayInnings(profile, inningsConfig, events);
  } catch (e) {
    throw new ApiError(
      400,
      e instanceof Error ? e.message : "Invalid delivery sequence",
      "INVALID_DELIVERY",
    );
  }
  const totals = finalizeInnings(state, profile);
  await prisma.innings.update({
    where: { id: inningsId },
    data: {
      totalRuns: totals.totalRuns,
      wickets: totals.wickets,
      batRuns: totals.batRuns,
      netRuns: totals.netRuns,
      oversBowled: totals.oversBowled,
    },
  });
  return totals;
}

export async function updateDelivery(
  deliveryId: string,
  input: UpdateDeliveryInput,
) {
  const row = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      innings: {
        include: {
          deliveries: { orderBy: { sequence: "asc" } },
        },
      },
    },
  });
  if (!row) {
    throw new ApiError(404, "Delivery not found", "DELIVERY_NOT_FOUND");
  }

  const merged = {
    runsOffBat: input.runsOffBat ?? row.runsOffBat,
    isLegalBall: input.isLegalBall ?? row.isLegalBall,
    extrasType:
      input.extrasType !== undefined ? input.extrasType : row.extrasType,
    extrasRuns: input.extrasRuns ?? row.extrasRuns,
    extrasRunsType:
      input.extrasRunsType !== undefined
        ? input.extrasRunsType
        : row.extrasRunsType,
    wicketType:
      input.wicketType !== undefined ? input.wicketType : row.wicketType,
    strikerId: input.strikerId ?? row.strikerId,
    nonStrikerId: input.nonStrikerId ?? row.nonStrikerId,
    bowlerId: input.bowlerId ?? row.bowlerId,
    fielderId:
      input.fielderId !== undefined ? input.fielderId : row.fielderId,
    dismissedBatsmanId:
      input.dismissedBatsmanId !== undefined
        ? input.dismissedBatsmanId
        : row.dismissedBatsmanId,
  };

  if (
    merged.wicketType &&
    ["caught", "run_out", "stumped"].includes(merged.wicketType) &&
    !merged.fielderId
  ) {
    throw new ApiError(
      400,
      "Fielder required for caught, run out, and stumped",
      "FIELDER_REQUIRED",
    );
  }

  const profile = await getRulesProfileFromVersion(row.rulesVersionId);
  const match = await getMatch(row.innings.matchId);
  const config = resolveInningsConfigForBatting(
    profile,
    match,
    row.innings.battingTeamId,
  );
  const inningsConfig = {
    playersPerSide: config.playersPerSide,
    totalOvers: config.totalOvers,
  };

  const events = row.innings.deliveries.map((d) =>
    d.id === deliveryId
      ? deliveryToEvent({ ...d, ...merged })
      : deliveryToEvent(d),
  );

  if (
    countLegalBalls(events) >
    config.totalOvers * 6
  ) {
    throw new ApiError(
      400,
      `Innings cannot exceed ${config.totalOvers} overs`,
      "INNINGS_COMPLETE",
    );
  }

  await persistInningsTotalsFromDeliveries(
    row.inningsId,
    profile,
    inningsConfig,
    events,
  );

  const delivery = await prisma.delivery.update({
    where: { id: deliveryId },
    data: merged,
  });

  if (match.status === "COMPLETED") {
    await syncMatchResultScores(match.id);
  }

  return { delivery };
}

function computeStoredMatchResult(
  match: Awaited<ReturnType<typeof getMatch>>,
  profile: Awaited<ReturnType<typeof getRulesProfileFromVersion>>,
) {
  let homeScore: number | undefined;
  let awayScore: number | undefined;
  let winningTeamId: string | undefined;

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
    const first = match.innings[0];
    const second = match.innings[1];
    if (first && second) {
      const target = (first.totalRuns ?? 0) + 1;
      if ((second.totalRuns ?? 0) >= target) {
        winningTeamId = second.battingTeamId;
      } else {
        winningTeamId = first.battingTeamId;
      }
    }
  }

  const config = resolveInningsConfig(profile, match.playersPerSide);
  const marginText =
    match.innings.length >= 2
      ? buildHostResultLine({
          hostTeamId: match.homeTeamId,
          hostTeamName: match.homeTeam.team.name,
          homeTeamId: match.homeTeamId,
          homeTeamName: match.homeTeam.team.name,
          awayTeamId: match.awayTeamId,
          awayTeamName: match.awayTeam.team.name,
          innings: match.innings.map((inn) => ({
            battingTeamId: inn.battingTeamId,
            totalRuns: inn.totalRuns ?? 0,
            deliveries: inn.deliveries,
          })),
          totalOvers: config.totalOvers,
          chaseContinuedAfterTarget: match.chaseContinuedAfterTarget,
        })
      : null;

  return { homeScore, awayScore, winningTeamId, marginText };
}

/** Refresh stored result lines after a delivery edit on a finished match. */
export async function syncMatchResultScores(matchId: string) {
  const match = await getMatch(matchId);
  if (match.innings.length < 2) return match;
  const profile = await getRulesProfileFromVersion(
    match.rulesVersionId ?? match.tournament.rulesProfileVersionId,
  );
  const { homeScore, awayScore, winningTeamId, marginText } =
    computeStoredMatchResult(match, profile);
  await prisma.match.update({
    where: { id: matchId },
    data: {
      homeScore,
      awayScore,
      winningTeamId,
      marginText: marginText ?? undefined,
      resultSummary: marginText ?? undefined,
    },
  });
  return getMatch(matchId);
}

export async function finalizeMatchInnings(matchId: string) {
  const match = await getMatch(matchId);
  const profile = await getRulesProfileFromVersion(
    match.rulesVersionId ?? match.tournament.rulesProfileVersionId,
  );
  const { homeScore, awayScore, winningTeamId, marginText } =
    computeStoredMatchResult(match, profile);

  return prisma.match.update({
    where: { id: matchId },
    data: {
      status: "COMPLETED",
      homeScore,
      awayScore,
      winningTeamId,
      marginText: marginText ?? undefined,
      resultSummary: marginText ?? undefined,
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
    const config = resolveInningsConfigForBatting(
      profile,
      match,
      innings.battingTeamId,
    );
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
