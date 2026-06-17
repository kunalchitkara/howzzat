import { prisma } from "../db";
import { ApiError } from "../api/http";
import { aggregateInningsFromDeliveries } from "@/lib/scorecard/aggregate";
import type { PlayerInfo } from "@/lib/scorecard/types";
import {
  buildTournamentInsights,
  buildLeaderboards,
  type PlayerMatchContribution,
  type TournamentInsights,
} from "@/lib/tournament/insights";
import { deliveryToEvent } from "./match-utils";
import { getRulesProfileFromVersion } from "./rules-helpers";

async function loadTournamentMatches(tournamentId: string) {
  return prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      teams: { include: { team: true } },
      matches: {
        where: { isOfficial: true },
        orderBy: [{ matchNumber: "asc" }, { scheduledAt: "asc" }],
        include: {
          homeTeam: { include: { team: true } },
          awayTeam: { include: { team: true } },
          innings: {
            orderBy: { inningsNumber: "asc" },
            include: {
              deliveries: { orderBy: { sequence: "asc" } },
            },
          },
          squad: { include: { player: true } },
        },
      },
    },
  });
}

export async function getTournamentInsights(
  tournamentId: string,
  options?: { focusTeamIds?: string[] },
): Promise<TournamentInsights> {
  const tournament = await loadTournamentMatches(tournamentId);
  if (!tournament) {
    throw new ApiError(404, "Tournament not found", "TOURNAMENT_NOT_FOUND");
  }

  const teamNames = new Map(
    tournament.teams.map((tt) => [tt.id, tt.team.name]),
  );

  const matchInputs = tournament.matches.map((m) => ({
    id: m.id,
    slug: m.slug,
    matchNumber: m.matchNumber,
    status: m.status,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    homeTeamName: m.homeTeam.team.name,
    awayTeamName: m.awayTeam.team.name,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    winningTeamId: m.winningTeamId,
    marginText: m.marginText,
    venue: m.venue,
    scheduledAt: m.scheduledAt,
  }));

  const contributions: PlayerMatchContribution[] = [];
  const rulesVersionId = tournament.rulesProfileVersionId;

  for (const match of tournament.matches) {
    if (match.innings.length === 0) continue;

    const profile = await getRulesProfileFromVersion(
      match.rulesVersionId ?? rulesVersionId,
    );
    const players: PlayerInfo[] = match.squad.map((s) => ({
      id: s.player.id,
      name: s.player.legalName,
      displayName: s.player.displayName ?? undefined,
    }));

    const teamNameFor = (tournamentTeamId: string) =>
      tournamentTeamId === match.homeTeamId
        ? match.homeTeam.team.name
        : match.awayTeam.team.name;

    for (const innings of match.innings) {
      const events = innings.deliveries.map(deliveryToEvent);
      if (events.length === 0) continue;

      const teamName = teamNameFor(innings.battingTeamId);
      const agg = aggregateInningsFromDeliveries({
        teamName,
        inningsLabel: "",
        deliveries: events,
        players,
        profile,
        totalRuns: innings.totalRuns ?? profile.startingScore,
        wickets: innings.wickets ?? 0,
        batRuns: innings.batRuns ?? 0,
        netRuns: innings.netRuns ?? 0,
        oversBowled: innings.oversBowled ?? 0,
      });

      for (const batter of agg.batters) {
        if (batter.dismissal === "did not bat" && batter.runs === 0) continue;
        contributions.push({
          matchId: match.id,
          playerId: batter.playerId,
          name: batter.name,
          teamName,
          batting: {
            runs: batter.runs,
            balls: batter.balls,
            netRuns: batter.netRuns,
            fours: batter.fours,
            sixes: batter.sixes,
            isNotOut: batter.isNotOut,
          },
        });
      }

      for (const bowler of agg.bowlers) {
        if (bowler.wickets === 0 && bowler.overs === 0) continue;
        contributions.push({
          matchId: match.id,
          playerId: bowler.playerId,
          name: bowler.name,
          teamName: teamNameFor(
            innings.battingTeamId === match.homeTeamId
              ? match.awayTeamId
              : match.homeTeamId,
          ),
          bowling: { wickets: bowler.wickets },
        });
      }
    }
  }

  const insights = buildTournamentInsights({
    matches: matchInputs,
    teamNames,
    playerContributions: contributions,
  });

  const focusIds = options?.focusTeamIds;
  if (!focusIds?.length) return insights;

  const focusNames = new Set(
    focusIds
      .map((id) => teamNames.get(id))
      .filter((name): name is string => Boolean(name)),
  );
  if (focusNames.size === 0) return insights;

  const playerStats = insights.playerStats.filter((p) =>
    focusNames.has(p.teamName),
  );
  return {
    ...insights,
    playerStats,
    leaderboards: buildLeaderboards(playerStats),
  };
}

export async function getPublicTournamentInsights(
  orgSlug: string,
  tournamentSlug: string,
): Promise<TournamentInsights & { tournamentName: string; orgName: string }> {
  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) throw new ApiError(404, "Organization not found", "ORG_NOT_FOUND");

  const tournament = await prisma.tournament.findUnique({
    where: {
      organizationId_slug: { organizationId: org.id, slug: tournamentSlug },
    },
  });
  if (!tournament || !tournament.isPublic) {
    throw new ApiError(404, "Tournament not found", "TOURNAMENT_NOT_FOUND");
  }

  const insights = await getTournamentInsights(tournament.id);
  return {
    ...insights,
    tournamentName: tournament.name,
    orgName: org.name,
  };
}
