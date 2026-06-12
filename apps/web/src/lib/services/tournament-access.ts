import { ApiError } from "../api/http";
import { prisma } from "../db";

export async function isTournamentManager(
  tournamentId: string,
  userId: string,
): Promise<boolean> {
  const row = await prisma.tournamentManager.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
  });
  return Boolean(row);
}

export async function canUserScoreMatch(
  matchId: string,
  userId: string,
): Promise<boolean> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { tournamentId: true },
  });
  if (!match) return false;

  if (await isTournamentManager(match.tournamentId, userId)) {
    return true;
  }

  const invite = await prisma.matchScorerInvite.findFirst({
    where: {
      matchId,
      acceptedByUserId: userId,
      acceptedAt: { not: null },
    },
  });
  return Boolean(invite);
}

export async function assertCanScoreMatch(
  matchId: string,
  userId: string,
): Promise<void> {
  if (!(await canUserScoreMatch(matchId, userId))) {
    throw new ApiError(
      403,
      "You need a manager role or a scorer invite for this match",
      "SCORING_NOT_AUTHORIZED",
    );
  }
}

export function tournamentHomeUrl(publicToken: string, origin: string): string {
  return `${origin}/t/${publicToken}`;
}

export function matchScorerInviteUrl(
  token: string,
  matchId: string,
  origin: string,
): string {
  return `${origin}/score/invite/${token}?match=${matchId}`;
}

/** Universal link path segment for mobile deep links (web fallback uses same path). */
export const DEEP_LINK_SCORER_PATH = "/score/invite";
