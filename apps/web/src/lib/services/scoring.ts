import {
  finalizeInnings,
  replayInnings,
} from "@howzzat/rules-engine";
import {
  countLegalBalls,
  currentOverBowler,
  formatOversFromLegalBalls,
  isInningsComplete,
  lastBallAfterDeliveries,
  nextBallAfterDeliveries,
} from "@/lib/scoring/ball-position";
import { resolveInningsConfigForBatting } from "@/lib/scoring/innings-config";
import { buildHostResultLine } from "@/lib/scoring/match-result";
import { deliverySymbol } from "@/lib/scoring/delivery-symbol";
import { buildRecentBalls } from "@/lib/scoring/recent-balls";
import type { AuthUser } from "@/lib/auth/session";
import type { MatchScoringContext, ScoringPlayer } from "@/lib/scoring/types";
import { buildScoringLockInfo, SCORING_ROLES } from "./scoring-lock";
import { userHasOrgRole } from "@/lib/auth/request";
import { canUserScoreMatch } from "./tournament-access";
import {
  ageGroupsMatch,
  ageOnDate,
  canonicalAgeGroupKey,
  isOverAgeGroup,
  parseAgeGroupCap,
} from "@/lib/scoring/age-eligibility";
import { deliveryToEvent } from "./match-utils";
import { getMatch } from "./matches";
import {
  getRulesProfileFromVersion,
  resolveRulesVersionIdForCoachTournament,
} from "./rules-helpers";
import { prisma } from "../db";
import { isExternalTeam, teamNamesMatch } from "./tournaments";
import type { RulesProfile } from "@howzzat/rules-engine";

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

function resolveTournamentAgeGroup(
  tournamentAgeGroup: string | null,
  profile: RulesProfile,
): string | null {
  return (
    tournamentAgeGroup?.trim() ||
    profile.league?.ageGroup?.trim() ||
    null
  );
}

function teamAgeGroupKey(team: {
  ageGroup: string | null;
  name: string;
}): string | null {
  return (
    canonicalAgeGroupKey(team.ageGroup) ?? canonicalAgeGroupKey(team.name)
  );
}

async function rosterForTeam(
  teamId: string,
  ageGroupCap: number | null,
  referenceDate: Date,
): Promise<ScoringPlayer[]> {
  const memberships = await prisma.teamMembership.findMany({
    where: { teamId, active: true },
    include: { player: true },
    orderBy: [{ shirtNumber: "asc" }, { createdAt: "asc" }],
  });
  const seen = new Set<string>();
  const roster: ScoringPlayer[] = [];
  for (const m of memberships) {
    if (seen.has(m.playerId)) continue;
    seen.add(m.playerId);
    roster.push(mapPlayer(m.player, teamId, ageGroupCap, referenceDate));
  }
  return roster;
}

/** Club squads for the tournament age band when the enrolled team has no roster. */
async function rosterForOrgAgeBand(
  orgId: string,
  tournamentAgeGroup: string | null,
  ageGroupCap: number | null,
  referenceDate: Date,
): Promise<ScoringPlayer[]> {
  const tournamentKey = canonicalAgeGroupKey(tournamentAgeGroup);
  if (!tournamentKey) return [];

  const teams = await prisma.team.findMany({
    where: { organizationId: orgId },
    select: { id: true, ageGroup: true, slug: true, name: true },
    orderBy: { name: "asc" },
  });

  const seen = new Set<string>();
  const roster: ScoringPlayer[] = [];
  for (const team of teams) {
    if (isExternalTeam(team)) continue;
    const teamKey = teamAgeGroupKey(team);
    if (!teamKey || !ageGroupsMatch(teamKey, tournamentKey)) continue;
    const teamRoster = await rosterForTeam(team.id, ageGroupCap, referenceDate);
    for (const player of teamRoster) {
      if (seen.has(player.id)) continue;
      seen.add(player.id);
      roster.push(player);
    }
  }
  return roster;
}

function opponentSideInMatch(
  homeTeam: { teamId: string; team: { name: string } },
  awayTeam: { teamId: string; team: { name: string } },
  opponentOrgTeamId: string,
  opponentName: string,
): "home" | "away" | null {
  if (
    homeTeam.teamId === opponentOrgTeamId ||
    teamNamesMatch(homeTeam.team.name, opponentName)
  ) {
    return "home";
  }
  if (
    awayTeam.teamId === opponentOrgTeamId ||
    teamNamesMatch(awayTeam.team.name, opponentName)
  ) {
    return "away";
  }
  return null;
}

/** Players from past matches against the same opponent (squad + ball-by-ball). */
async function rosterFromOpponentHistory(options: {
  currentMatchId: string;
  orgId: string;
  opponentOrgTeamId: string;
  opponentName: string;
  ageGroupCap: number | null;
  referenceDate: Date;
}): Promise<ScoringPlayer[]> {
  const pastMatches = await prisma.match.findMany({
    where: {
      id: { not: options.currentMatchId },
      tournament: { organizationId: options.orgId },
    },
    include: {
      homeTeam: { include: { team: true } },
      awayTeam: { include: { team: true } },
      squad: { include: { player: true } },
      innings: { include: { deliveries: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });

  const seen = new Set<string>();
  const roster: ScoringPlayer[] = [];
  const playerIdsFromDeliveries = new Set<string>();

  const addPlayer = (player: MembershipWithPlayer["player"], teamId: string) => {
    if (seen.has(player.id)) return;
    seen.add(player.id);
    roster.push(mapPlayer(player, teamId, options.ageGroupCap, options.referenceDate));
  };

  for (const past of pastMatches) {
    const side = opponentSideInMatch(
      past.homeTeam,
      past.awayTeam,
      options.opponentOrgTeamId,
      options.opponentName,
    );
    if (!side) continue;

    const opponentOrgId =
      side === "home" ? past.homeTeam.teamId : past.awayTeam.teamId;
    const opponentTournamentTeamId =
      side === "home" ? past.homeTeamId : past.awayTeamId;

    for (const squadPlayer of past.squad) {
      if (squadPlayer.teamId !== opponentOrgId) continue;
      addPlayer(squadPlayer.player, opponentOrgId);
    }

    for (const innings of past.innings) {
      const opponentBatting = innings.battingTeamId === opponentTournamentTeamId;
      const opponentBowling = !opponentBatting;
      for (const delivery of innings.deliveries) {
        const ids: (string | null)[] = [];
        if (opponentBatting) {
          ids.push(
            delivery.strikerId,
            delivery.nonStrikerId,
            delivery.dismissedBatsmanId,
          );
        }
        if (opponentBowling) {
          ids.push(delivery.bowlerId, delivery.fielderId);
        }
        for (const id of ids) {
          if (id) playerIdsFromDeliveries.add(id);
        }
      }
    }
  }

  if (playerIdsFromDeliveries.size > 0) {
    const deliveryPlayers = await prisma.player.findMany({
      where: { id: { in: [...playerIdsFromDeliveries] } },
    });
    for (const player of deliveryPlayers) {
      addPlayer(player, options.opponentOrgTeamId);
    }
  }

  return roster;
}

async function rosterForMatchSide(options: {
  orgTeamId: string;
  orgTeamSlug: string;
  orgId: string;
  tournamentAgeGroup: string | null;
  ageGroupCap: number | null;
  referenceDate: Date;
  useOrgAgeBandFallback: boolean;
  opponentHistory?: {
    currentMatchId: string;
    opponentName: string;
  };
}): Promise<ScoringPlayer[]> {
  const direct = await rosterForTeam(
    options.orgTeamId,
    options.ageGroupCap,
    options.referenceDate,
  );
  const external = isExternalTeam({ slug: options.orgTeamSlug });
  const needsOrgFallback =
    options.useOrgAgeBandFallback && (direct.length === 0 || external);

  let roster = direct;
  if (needsOrgFallback) {
    const orgRoster = await rosterForOrgAgeBand(
      options.orgId,
      options.tournamentAgeGroup,
      options.ageGroupCap,
      options.referenceDate,
    );
    if (orgRoster.length > 0) {
      roster = orgRoster;
    }
  }

  if (options.opponentHistory) {
    const history = await rosterFromOpponentHistory({
      currentMatchId: options.opponentHistory.currentMatchId,
      orgId: options.orgId,
      opponentOrgTeamId: options.orgTeamId,
      opponentName: options.opponentHistory.opponentName,
      ageGroupCap: options.ageGroupCap,
      referenceDate: options.referenceDate,
    });
    const seen = new Set(roster.map((p) => p.id));
    roster = [
      ...roster,
      ...history.filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      }),
    ];
  }

  return roster;
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
  user: AuthUser | null = null,
): Promise<MatchScoringContext> {
  const match = await getMatch(matchId);
  const orgId = match.tournament.organizationId;
  const authorizedToScore = user
    ? userHasOrgRole(user, orgId, [...SCORING_ROLES]) ||
      (await canUserScoreMatch(match.id, user.id))
    : false;
  const rulesVersionId = await resolveRulesVersionIdForCoachTournament({
    tournamentId: match.tournament.id,
    tournamentSlug: match.tournament.slug,
    rulesVersionId: match.rulesVersionId ?? match.tournament.rulesProfileVersionId,
  });
  const profile = await getRulesProfileFromVersion(rulesVersionId);
  const config = resolveInningsConfigForBatting(
    profile,
    match,
    match.homeTeamId,
  );

  const homeTeamId = match.homeTeam.team.id;
  const awayTeamId = match.awayTeam.team.id;
  const tournamentAgeGroup = resolveTournamentAgeGroup(
    match.tournament.ageGroup,
    profile,
  );
  const ageGroupCap = parseAgeGroupCap(tournamentAgeGroup);
  const referenceDate = match.scheduledAt ?? new Date();

  const homeRoster = await rosterForMatchSide({
    orgTeamId: homeTeamId,
    orgTeamSlug: match.homeTeam.team.slug,
    orgId,
    tournamentAgeGroup,
    ageGroupCap,
    referenceDate,
    useOrgAgeBandFallback: true,
  });
  const awayRoster = await rosterForMatchSide({
    orgTeamId: awayTeamId,
    orgTeamSlug: match.awayTeam.team.slug,
    orgId,
    tournamentAgeGroup,
    ageGroupCap,
    referenceDate,
    useOrgAgeBandFallback: false,
    opponentHistory: {
      currentMatchId: match.id,
      opponentName: match.awayTeam.team.name,
    },
  });

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

  const mergeRoster = (roster: ScoringPlayer[], squad: ScoringPlayer[]) => {
    const seen = new Set(roster.map((p) => p.id));
    return [...roster, ...squad.filter((p) => !seen.has(p.id))];
  };

  const squads = {
    home: homeSquad,
    away: awaySquad,
  };

  const teamName = (tournamentTeamId: string) =>
    tournamentTeamId === match.homeTeamId
      ? match.homeTeam.team.name
      : match.awayTeam.team.name;

  const inningsViews = match.innings.map((innings) => {
    const inningsConfig = resolveInningsConfigForBatting(
      profile,
      match,
      innings.battingTeamId,
    );
    const events = innings.deliveries.map(deliveryToEvent);
    const state = replayInnings(
      profile,
      {
        playersPerSide: inningsConfig.playersPerSide,
        totalOvers: inningsConfig.totalOvers,
      },
      events,
    );
    const totals = finalizeInnings(state, profile);
    const nextBall = nextBallAfterDeliveries(
      innings.deliveries,
      inningsConfig.totalOvers,
    );
    const { locked: bowlerLocked, bowlerId: lockedBowlerId } = currentOverBowler(
      innings.deliveries.map((d) => ({
        overNumber: d.overNumber,
        ballInOver: d.ballInOver,
        bowlerId: d.bowlerId,
        isLegalBall: d.isLegalBall,
        extrasType: d.extrasType,
      })),
      nextBall,
      { profile, totalOvers: inningsConfig.totalOvers },
    );
    const legalBallsBowled = countLegalBalls(innings.deliveries);
    const inningsComplete = isInningsComplete(
      innings.deliveries,
      inningsConfig.totalOvers,
      innings.endedAt,
    );
    const lastBall = lastBallAfterDeliveries(innings.deliveries);
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
      legalBallsBowled,
      displayOvers: inningsComplete
        ? `${inningsConfig.totalOvers}.0`
        : formatOversFromLegalBalls(legalBallsBowled),
      deliveryCount: innings.deliveries.length,
      complete: inningsComplete,
      nextBall,
      lastBall,
      recentBalls: buildRecentBalls(innings.deliveries),
      deliveries: innings.deliveries.map((d) => ({
        id: d.id,
        sequence: d.sequence,
        overNumber: d.overNumber,
        ballInOver: d.ballInOver,
        symbol: deliverySymbol(d),
        runsOffBat: d.runsOffBat,
        isLegalBall: d.isLegalBall,
        extrasType: d.extrasType,
        extrasRuns: d.extrasRuns,
        extrasRunsType: d.extrasRunsType,
        wicketType: d.wicketType,
        strikerId: d.strikerId,
        nonStrikerId: d.nonStrikerId,
        bowlerId: d.bowlerId,
        fielderId: d.fielderId,
        dismissedBatsmanId: d.dismissedBatsmanId,
      })),
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
  if (
    !activeInnings &&
    match.squadsConfirmedAt &&
    match.tossWinnerId &&
    battingFirstTeamId
  ) {
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
        targetRuns: first.totalRuns + 1,
      };
    }
  }

  const singleInnings = profile.format === "pairs_single_innings";
  const inningsRequired = singleInnings ? 1 : 2;
  const canFinalize =
    inningsViews.length >= inningsRequired &&
    inningsViews.every((i) => i.complete) &&
    match.status !== "COMPLETED";

  let chase: MatchScoringContext["chase"] = null;
  if (activeInnings?.inningsNumber === 2 && inningsViews[0]) {
    const targetRuns = inningsViews[0].totalRuns + 1;
    chase = {
      targetRuns,
      runsNeeded: Math.max(0, targetRuns - activeInnings.totalRuns),
      defendingTeamId: inningsViews[0].battingTeamId,
      chasingTeamId: activeInnings.battingTeamId,
      targetReached: activeInnings.totalRuns >= targetRuns,
    };
  }

  const inningsForResult = match.innings.map((inn, idx) => ({
    battingTeamId: inn.battingTeamId,
    totalRuns: inningsViews[idx]?.totalRuns ?? 0,
    deliveries: inn.deliveries,
  }));

  const resultLine =
    inningsViews.length >= 2 && inningsViews.every((i) => i.complete)
      ? buildHostResultLine({
          hostTeamId: match.homeTeamId,
          hostTeamName: match.homeTeam.team.name,
          homeTeamId: match.homeTeamId,
          homeTeamName: match.homeTeam.team.name,
          awayTeamId: match.awayTeamId,
          awayTeamName: match.awayTeam.team.name,
          innings: inningsForResult,
          totalOvers: config.totalOvers,
          chaseContinuedAfterTarget: match.chaseContinuedAfterTarget,
        })
      : null;

  const hostWon = resultLine
    ? resultLine.startsWith(match.homeTeam.team.name) &&
      resultLine.includes("won")
    : false;

  const activeConfig = activeInnings
    ? resolveInningsConfigForBatting(
        profile,
        match,
        activeInnings.battingTeamId,
      )
    : config;

  return {
    matchId: match.id,
    status: match.status,
    hostTeamId: match.homeTeamId,
    squadsConfirmed: Boolean(match.squadsConfirmedAt),
    canReopenSquads:
      match.status !== "COMPLETED" && match.innings.length === 0,
    chaseContinuedAfterTarget: match.chaseContinuedAfterTarget,
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
    playersPerSide: activeConfig.playersPerSide,
    squadMin: profile.playersPerSide.min,
    squadMax: profile.playersPerSide.max,
    oversPerInningsFormula: profile.oversPerInnings.formula,
    totalOvers: activeConfig.totalOvers,
    matchTotalOvers: match.totalOvers,
    pairOvers: profile.pairOvers,
    startingScore: profile.startingScore,
    wicketPenalty: profile.wicketPenalty,
    rotateStrikeAfterWicket: profile.dismissals.rotateStrikeAfterWicket ?? false,
    extrasScoring: {
      wide: profile.scoring.wide,
      noBall: profile.scoring.noBall,
    },
    tournamentAgeGroup,
    squads,
    rosters: {
      home: mergeRoster(homeRoster, homeSquad),
      away: mergeRoster(awayRoster, awaySquad),
    },
    innings: inningsViews,
    activeInningsId: activeInnings?.id ?? null,
    canStartInnings,
    canFinalize,
    chase,
    suggestedResult: resultLine
      ? { line: resultLine, hostWon }
      : null,
    scoringLock: buildScoringLockInfo(match, user, authorizedToScore),
  };
}
