import { prisma } from "../db";
import { ApiError } from "../api/http";
import { randomToken } from "../api/slug";
import { getMatch } from "./matches";
import { matchScorerInviteUrl } from "./tournament-access";

export async function createMatchScorerInvite(
  matchId: string,
  invitedById: string,
  input: { email?: string },
  origin: string,
) {
  await getMatch(matchId);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const token = randomToken();
  const invite = await prisma.matchScorerInvite.create({
    data: {
      matchId,
      token,
      email: input.email?.toLowerCase(),
      invitedById,
      expiresAt,
    },
  });

  return {
    ...invite,
    url: matchScorerInviteUrl(token, matchId, origin),
    deepLink: `howzzat://score/invite/${token}?match=${matchId}`,
  };
}

export async function getMatchScorerInvite(token: string) {
  const invite = await prisma.matchScorerInvite.findUnique({
    where: { token },
    include: {
      match: {
        include: {
          homeTeam: { include: { team: true } },
          awayTeam: { include: { team: true } },
        },
      },
    },
  });
  if (!invite) {
    throw new ApiError(404, "Scorer invite not found", "SCORER_INVITE_NOT_FOUND");
  }
  return invite;
}

export async function acceptMatchScorerInvite(token: string, userId: string) {
  const invite = await prisma.matchScorerInvite.findUnique({
    where: { token },
    include: { match: true },
  });
  if (!invite) {
    throw new ApiError(404, "Scorer invite not found", "SCORER_INVITE_NOT_FOUND");
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new ApiError(410, "Scorer invite expired", "SCORER_INVITE_EXPIRED");
  }

  return prisma.matchScorerInvite.update({
    where: { id: invite.id },
    data: {
      acceptedAt: new Date(),
      acceptedByUserId: userId,
    },
    include: { match: true },
  });
}
