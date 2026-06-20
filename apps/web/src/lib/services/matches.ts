import type { DeliveryEvent } from "@howzzat/rules-engine";
import {
  applyDelivery,
  finalizeInnings,
  replayInnings,
  resolveDeliveryIsLegalBall,
  resolveInningsConfig,
} from "@howzzat/rules-engine";
import { resolveInningsConfigForBatting } from "@/lib/scoring/innings-config";
import { describeSquadConfirmError } from "@/lib/scoring/squad-validation";
import {
  canAcceptDelivery,
  countLegalBalls,
  isInningsComplete,
  maxLegalBalls,
} from "@/lib/scoring/ball-position";
import { buildHostResultLine } from "@/lib/scoring/match-result";
import { buildRecordDeliveryResponse } from "@/lib/scoring/build-delivery-response";
import type { RecordDeliveryResponse } from "@/lib/scoring/delivery-response";
import { deliveryToEvent } from "./match-utils";
import { prisma } from "../db";
import { ApiError } from "../api/http";
import {
  allocateUniqueMatchSlug,
  buildMatchSlug,
  isCuid,
} from "../match-slug";
import { getRulesProfileFromVersion, resolveRulesVersionIdForCoachTournament, coachTournamentStuckOnDemoCap } from "./rules-helpers";
import { chargeMatchAtFinalize } from "./tournament-billing";
import {
  findOrCreateTournamentTeamByName,
  loadTournamentEnrollmentContext,
} from "./tournaments";
import type {
  createMatchSchema,
  createInningsSchema,
  createDeliverySchema,
  updateDeliverySchema,
  updateMatchSchema,
  setMatchSquadSchema,
  addMatchPlayerSchema,
} from "../validations";
import type { z } from "zod";

type CreateMatchInput = z.infer<typeof createMatchSchema>;
type CreateInningsInput = z.infer<typeof createInningsSchema>;
type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
type UpdateDeliveryInput = z.infer<typeof updateDeliverySchema>;
type UpdateMatchInput = z.infer<typeof updateMatchSchema>;
type SetSquadInput = z.infer<typeof setMatchSquadSchema>;
type AddMatchPlayerInput = z.infer<typeof addMatchPlayerSchema>;

const PLAYER_NAME_EXISTS_MESSAGE =
  'Name already exists. Try adding a second name initial (e.g. "Sam P").';

function normalizePlayerName(name: string): string {
  return name.trim().toLowerCase();
}

/** Reject duplicate legal names on the same match side (case-insensitive, trimmed). */
async function assertUniquePlayerNameOnMatchSide(
  matchId: string,
  teamId: string,
  legalName: string,
) {
  const normalized = normalizePlayerName(legalName);
  if (!normalized) return;

  const squadPlayers = await prisma.matchSquadPlayer.findMany({
    where: { matchId, teamId },
    include: { player: true },
  });
  const conflict = squadPlayers.find(
    (s) => normalizePlayerName(s.player.legalName) === normalized,
  );
  if (conflict) {
    throw new ApiError(400, PLAYER_NAME_EXISTS_MESSAGE, "PLAYER_NAME_EXISTS", {
      existingName: conflict.player.legalName,
    });
  }
}

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
  scoringUser: { select: { id: true, name: true, email: true } },
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

export async function getMatch(matchRef: string) {
  const match = await prisma.match.findFirst({
    where: { OR: [{ id: matchRef }, { slug: matchRef }] },
    include: matchInclude,
  });
  if (!match) throw new ApiError(404, "Match not found", "MATCH_NOT_FOUND");
  if (!match.slug) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: match.tournamentId },
      select: { ageGroup: true },
    });
    const slug = await allocateUniqueMatchSlug(
      prisma,
      buildMatchSlug({
        ageGroup: tournament?.ageGroup,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        scheduledAt: match.scheduledAt,
        createdAt: match.createdAt,
      }),
    );
    await prisma.match.update({ where: { id: match.id }, data: { slug } });
    return { ...match, slug };
  }
  return match;
}

/** True when the URL used the internal id instead of the public slug. */
export function shouldRedirectToMatchSlug(
  matchRef: string,
  match: { id: string; slug: string | null },
): match is { id: string; slug: string } {
  return Boolean(match.slug && isCuid(matchRef) && matchRef === match.id);
}

export async function createMatch(tournamentId: string, input: CreateMatchInput) {
  const ctx = await loadTournamentEnrollmentContext(tournamentId);

  const resolveTeamId = async (
    teamId: string | undefined,
    teamName: string | undefined,
  ) => {
    if (teamId) return teamId;
    if (!teamName) return undefined;
    return (await findOrCreateTournamentTeamByName(tournamentId, teamName, ctx))
      .id;
  };

  const homeTeamId = await resolveTeamId(input.homeTeamId, input.homeTeamName);
  const awayTeamId = await resolveTeamId(input.awayTeamId, input.awayTeamName);

  if (!homeTeamId || !awayTeamId) {
    throw new ApiError(400, "Home and away teams required", "MISSING_TEAMS");
  }

  if (homeTeamId === awayTeamId) {
    throw new ApiError(400, "Home and away teams must differ", "SAME_TEAMS");
  }

  const home = ctx.teams.find((tt) => tt.id === homeTeamId);
  const away = ctx.teams.find((tt) => tt.id === awayTeamId);
  if (!home || !away) {
    throw new ApiError(400, "Invalid tournament teams", "INVALID_TEAMS");
  }

  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;
  const slug = await allocateUniqueMatchSlug(
    prisma,
    buildMatchSlug({
      ageGroup: ctx.ageGroup,
      homeTeam: home,
      awayTeam: away,
      scheduledAt,
      createdAt: new Date(),
    }),
  );

  return prisma.match.create({
    data: {
      tournamentId,
      homeTeamId,
      awayTeamId,
      matchNumber: input.matchNumber,
      scheduledAt,
      venue: input.venue,
      playersPerSide: input.playersPerSide ?? 8,
      isOfficial: input.isOfficial ?? true,
      publicSlug: input.publicSlug,
      slug,
      rulesVersionId: ctx.rulesProfileVersionId,
    },
    include: {
      homeTeam: { include: { team: true } },
      awayTeam: { include: { team: true } },
    },
  });
}

async function matchHasDeliveries(matchId: string): Promise<boolean> {
  const count = await prisma.delivery.count({
    where: { innings: { matchId } },
  });
  return count > 0;
}

/** Match ids that have at least one scored delivery (for fixture cancel UX). */
export async function listMatchIdsWithDeliveries(
  matchIds: string[],
): Promise<Set<string>> {
  if (matchIds.length === 0) return new Set();

  const rows = await prisma.innings.findMany({
    where: {
      matchId: { in: matchIds },
      deliveries: { some: {} },
    },
    select: { matchId: true },
    distinct: ["matchId"],
  });
  return new Set(rows.map((row) => row.matchId));
}

async function slugForRescheduledMatch(
  match: Awaited<ReturnType<typeof getMatch>>,
  scheduledAt: Date,
): Promise<string> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: match.tournamentId },
    select: { ageGroup: true },
  });
  const base = buildMatchSlug({
    ageGroup: tournament?.ageGroup,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    scheduledAt,
    createdAt: match.createdAt,
  });
  return allocateUniqueMatchSlug(prisma, base, match.id);
}

export async function updateMatch(matchId: string, input: UpdateMatchInput) {
  const match = await getMatch(matchId);

  if (input.scheduledAt !== undefined && match.status !== "SCHEDULED") {
    throw new ApiError(
      400,
      "Only scheduled fixtures can be rescheduled",
      "MATCH_NOT_SCHEDULED",
    );
  }

  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;
  const slug =
    scheduledAt !== undefined
      ? await slugForRescheduledMatch(match, scheduledAt)
      : undefined;

  return prisma.match.update({
    where: { id: match.id },
    data: {
      status: input.status,
      scheduledAt,
      slug,
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

export async function cancelOrDeleteMatch(matchId: string) {
  const match = await getMatch(matchId);

  if (match.status === "COMPLETED") {
    throw new ApiError(
      400,
      "Completed matches cannot be cancelled",
      "MATCH_COMPLETED",
    );
  }
  if (match.status === "ABANDONED" || match.status === "WALKOVER") {
    throw new ApiError(
      400,
      "This match is already closed",
      "MATCH_NOT_CANCELLABLE",
    );
  }

  const hasDeliveries = await matchHasDeliveries(match.id);

  if (!hasDeliveries) {
    await prisma.match.delete({ where: { id: match.id } });
    return { deleted: true, cancelled: false };
  }

  await prisma.match.update({
    where: { id: match.id },
    data: { status: "ABANDONED" },
  });
  return { deleted: false, cancelled: true };
}

/** Record toss (before lineups). Returns batting team id for 1st innings once squads are confirmed. */
export async function recordToss(
  matchId: string,
  input: {
    tossWinnerTeamId: string;
    tossCallerPlayerId?: string;
    electedTo: "bat" | "bowl";
  },
) {
  const match = await getMatch(matchId);
  matchId = match.id;
  if (match.squadsConfirmedAt) {
    throw new ApiError(
      400,
      "Lineups already confirmed — reopen squads to change the toss",
      "SQUADS_ALREADY_CONFIRMED",
    );
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
  matchId = match.id;

  const players = await prisma.player.findMany({
    where: { id: { in: input.playerIds } },
  });
  if (players.length !== input.playerIds.length) {
    throw new ApiError(400, "Unknown player in squad", "INVALID_SQUAD");
  }

  const memberships = await prisma.teamMembership.findMany({
    where: {
      teamId: input.teamId,
      playerId: { in: input.playerIds },
      active: true,
    },
  });
  const memberIds = new Set(memberships.map((m) => m.playerId));
  const nonMembers = input.playerIds.filter((id) => !memberIds.has(id));
  if (nonMembers.length > 0) {
    const adHocInSquad = await prisma.matchSquadPlayer.findMany({
      where: {
        matchId,
        teamId: input.teamId,
        playerId: { in: nonMembers },
      },
    });
    const adHocIds = new Set(adHocInSquad.map((s) => s.playerId));
    const invalid = nonMembers.filter((id) => !adHocIds.has(id));
    if (invalid.length > 0) {
      throw new ApiError(
        400,
        "Players must be on the team roster or added at scoring time",
        "INVALID_SQUAD",
      );
    }
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

export async function addMatchPlayer(matchId: string, input: AddMatchPlayerInput) {
  const match = await getMatch(matchId);
  matchId = match.id;
  if (match.squadsConfirmedAt) {
    throw new ApiError(400, "Lineups already confirmed", "SQUADS_ALREADY_CONFIRMED");
  }
  if (!match.tossWinnerId) {
    throw new ApiError(400, "Record the toss before adding players", "TOSS_REQUIRED");
  }

  const tournamentTeam =
    input.side === "home" ? match.homeTeam : match.awayTeam;
  const orgTeamId = tournamentTeam.team.id;
  const legalName = input.legalName.trim();

  const rulesVersionId = await resolveRulesVersionIdForCoachTournament({
    tournamentId: match.tournament.id,
    tournamentSlug: match.tournament.slug,
    rulesVersionId: match.rulesVersionId ?? match.tournament.rulesProfileVersionId,
  });
  const profile = await getRulesProfileFromVersion(rulesVersionId);
  const squadMax = profile.playersPerSide.max;
  const sideCount = match.squad.filter((s) => s.teamId === orgTeamId).length;
  if (sideCount >= squadMax) {
    const teamName = tournamentTeam.team.name;
    const message = coachTournamentStuckOnDemoCap(match.tournament.slug, squadMax)
      ? `${teamName} already has ${squadMax} players under the current demo rules cap. MJCA U9 allows up to 15 per side — refresh this page to reload tournament rules, or check the rules profile in the dashboard.`
      : `${teamName} already has ${squadMax} players — remove someone before adding another`;
    throw new ApiError(400, message, "SQUAD_TOO_LARGE");
  }

  await assertUniquePlayerNameOnMatchSide(matchId, orgTeamId, legalName);

  const player = await prisma.player.create({
    data: { legalName, displayName: legalName },
  });

  await prisma.matchSquadPlayer.create({
    data: {
      matchId,
      playerId: player.id,
      teamId: orgTeamId,
      role: "player",
    },
  });

  return getMatch(matchId);
}

export async function confirmMatchSquads(
  matchId: string,
  options?: { totalOvers?: number },
) {
  const match = await getMatch(matchId);
  matchId = match.id;
  if (!match.tossWinnerId) {
    throw new ApiError(
      400,
      "Record the toss before confirming lineups",
      "TOSS_REQUIRED",
    );
  }
  const rulesVersionId = await resolveRulesVersionIdForCoachTournament({
    tournamentId: match.tournament.id,
    tournamentSlug: match.tournament.slug,
    rulesVersionId: match.rulesVersionId ?? match.tournament.rulesProfileVersionId,
  });
  const profile = await getRulesProfileFromVersion(rulesVersionId);
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
      describeSquadConfirmError({
        homeTeamName: match.homeTeam.team.name,
        awayTeamName: match.awayTeam.team.name,
        homeCount,
        awayCount,
        min: squadMin,
        max: squadMax,
      }),
      "SQUAD_INCOMPLETE",
    );
  }
  if (homeCount > squadMax || awayCount > squadMax) {
    throw new ApiError(
      400,
      describeSquadConfirmError({
        homeTeamName: match.homeTeam.team.name,
        awayTeamName: match.awayTeam.team.name,
        homeCount,
        awayCount,
        min: squadMin,
        max: squadMax,
      }),
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
  matchId = match.id;
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
      status: match.tossWinnerId ? "LIVE" : "SCHEDULED",
    },
  });
  return getMatch(matchId);
}

export async function endInningsEarly(matchId: string, inningsId: string) {
  const match = await getMatch(matchId);
  matchId = match.id;
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
  matchId = match.id;
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
  matchId = match.id;
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

export async function recordDelivery(input: CreateDeliveryInput): Promise<{
  delivery: Awaited<ReturnType<typeof prisma.delivery.create>>;
  totals: ReturnType<typeof finalizeInnings>;
  slim: RecordDeliveryResponse;
}> {
  if (input.clientDeliveryId) {
    const existing = await prisma.delivery.findUnique({
      where: { clientDeliveryId: input.clientDeliveryId },
      include: {
        innings: {
          include: {
            match: {
              include: {
                tournament: true,
                homeTeam: { include: { team: true } },
                awayTeam: { include: { team: true } },
                squad: true,
                innings: {
                  orderBy: { inningsNumber: "asc" },
                  include: {
                    deliveries: { orderBy: { sequence: "asc" } },
                  },
                },
              },
            },
            deliveries: { orderBy: { sequence: "asc" } },
          },
        },
      },
    });
    if (existing) {
      const match = existing.innings.match;
      const profile = await getRulesProfileFromVersion(existing.rulesVersionId);
      const config = resolveInningsConfigForBatting(
        profile,
        match,
        existing.innings.battingTeamId,
      );
      const firstInnings =
        existing.innings.inningsNumber === 2
          ? match.innings.find((i) => i.inningsNumber === 1)
          : null;
      const slim = buildRecordDeliveryResponse({
        delivery: existing,
        allDeliveries: existing.innings.deliveries,
        profile,
        inningsConfig: config,
        innings: existing.innings,
        firstInningsTotalRuns: firstInnings?.totalRuns ?? null,
      });
      const events = existing.innings.deliveries.map(deliveryToEvent);
      const totals = finalizeInnings(
        replayInnings(profile, config, events),
        profile,
      );
      return { delivery: existing, totals, slim };
    }
  }

  const innings = await prisma.innings.findUnique({
    where: { id: input.inningsId },
    include: {
      match: {
        include: {
          tournament: true,
          homeTeam: { include: { team: true } },
          awayTeam: { include: { team: true } },
          squad: true,
          innings: {
            orderBy: { inningsNumber: "asc" },
            select: { inningsNumber: true, totalRuns: true },
          },
        },
      },
      deliveries: { orderBy: { sequence: "asc" } },
    },
  });
  if (!innings) {
    throw new ApiError(404, "Innings not found", "INNINGS_NOT_FOUND");
  }

  const matchForConfig = innings.match;
  const profile = await getRulesProfileFromVersion(innings.rulesVersionId);
  const config = resolveInningsConfigForBatting(
    profile,
    matchForConfig,
    innings.battingTeamId,
  );

  const resolvedIsLegal = resolveDeliveryIsLegalBall(
    {
      overNumber: input.overNumber,
      extrasType: input.extrasType as DeliveryEvent["extrasType"],
    },
    profile,
    config.totalOvers,
    input.isLegalBall ?? true,
  );

  const accept = canAcceptDelivery(
    innings.deliveries,
    config.totalOvers,
    resolvedIsLegal,
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
    isLegalBall: resolvedIsLegal,
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
      clientDeliveryId: input.clientDeliveryId,
      sequence,
      overNumber: input.overNumber,
      ballInOver: input.ballInOver,
      isLegalBall: resolvedIsLegal,
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

  const allDeliveries = [...innings.deliveries, delivery];
  const firstInningsTotalRuns =
    innings.inningsNumber === 2
      ? (innings.match.innings.find((i) => i.inningsNumber === 1)?.totalRuns ?? null)
      : null;
  const slim = buildRecordDeliveryResponse({
    delivery,
    allDeliveries,
    profile,
    inningsConfig: config,
    innings: { ...innings, deliveries: allDeliveries },
    firstInningsTotalRuns,
  });

  return { delivery, totals, slim };
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

  const profile = await getRulesProfileFromVersion(row.rulesVersionId);
  const match = await getMatch(row.innings.matchId);
  const config = resolveInningsConfigForBatting(
    profile,
    match,
    row.innings.battingTeamId,
  );

  merged.isLegalBall = resolveDeliveryIsLegalBall(
    {
      overNumber: row.overNumber,
      extrasType: merged.extrasType as DeliveryEvent["extrasType"],
    },
    profile,
    config.totalOvers,
    merged.isLegalBall,
  );

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

  const inningsConfig = {
    playersPerSide: config.playersPerSide,
    totalOvers: config.totalOvers,
  };

  const events = row.innings.deliveries.map((d) =>
    d.id === deliveryId
      ? deliveryToEvent({ ...d, ...merged })
      : deliveryToEvent(d),
  );

  if (countLegalBalls(events) > maxLegalBalls(config.totalOvers)) {
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
  matchId = match.id;
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
  matchId = match.id;
  const profile = await getRulesProfileFromVersion(
    match.rulesVersionId ?? match.tournament.rulesProfileVersionId,
  );
  const { homeScore, awayScore, winningTeamId, marginText } =
    computeStoredMatchResult(match, profile);

  const finalized = await prisma.match.update({
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

  await chargeMatchAtFinalize(matchId);

  return finalized;
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
