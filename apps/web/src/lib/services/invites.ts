import { prisma } from "../db";
import { ApiError } from "../api/http";
import { randomToken } from "../api/slug";
import { getTournament } from "./tournaments";
import type { createInviteSchema } from "../validations";
import type { z } from "zod";

type CreateInviteInput = z.infer<typeof createInviteSchema>;

export async function listInvites(tournamentId: string) {
  await getTournament(tournamentId);
  return prisma.tournamentInvite.findMany({
    where: { tournamentId },
    orderBy: { createdAt: "desc" },
    include: { team: true },
  });
}

export async function createInvite(
  tournamentId: string,
  input: CreateInviteInput,
) {
  await getTournament(tournamentId);

  if (input.teamId) {
    const team = await prisma.team.findUnique({ where: { id: input.teamId } });
    if (!team) throw new ApiError(404, "Team not found", "TEAM_NOT_FOUND");
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const kind = input.kind ?? "MANAGER";

  return prisma.tournamentInvite.create({
    data: {
      tournamentId,
      email: input.email.toLowerCase(),
      kind,
      role: input.role ?? "MANAGER",
      teamId: input.teamId,
      token: randomToken(),
      expiresAt,
    },
    include: { team: true },
  });
}

export async function acceptInvite(token: string, userId: string) {
  const invite = await prisma.tournamentInvite.findUnique({
    where: { token },
    include: { tournament: true },
  });
  if (!invite) {
    throw new ApiError(404, "Invite not found", "INVITE_NOT_FOUND");
  }
  if (invite.acceptedAt) {
    throw new ApiError(409, "Invite already accepted", "INVITE_USED");
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new ApiError(410, "Invite expired", "INVITE_EXPIRED");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found", "USER_NOT_FOUND");

  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new ApiError(
      403,
      "Sign in with the invited email address",
      "INVITE_EMAIL_MISMATCH",
    );
  }

  if (invite.kind === "MANAGER") {
    await prisma.tournamentManager.upsert({
      where: {
        tournamentId_userId: {
          tournamentId: invite.tournamentId,
          userId,
        },
      },
      create: {
        tournamentId: invite.tournamentId,
        userId,
        role: "MANAGER",
      },
      update: {},
    });
  } else {
    await prisma.orgMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId: invite.tournament.organizationId,
          userId,
        },
      },
      create: {
        organizationId: invite.tournament.organizationId,
        userId,
        role: invite.role,
      },
      update: { role: invite.role },
    });
  }

  return prisma.tournamentInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });
}

export async function deleteInvite(tournamentId: string, inviteId: string) {
  await getTournament(tournamentId);

  const invite = await prisma.tournamentInvite.findUnique({
    where: { id: inviteId },
  });
  if (!invite || invite.tournamentId !== tournamentId) {
    throw new ApiError(404, "Invite not found", "INVITE_NOT_FOUND");
  }
  if (invite.acceptedAt) {
    throw new ApiError(
      409,
      "Accepted invites cannot be removed",
      "INVITE_ALREADY_ACCEPTED",
    );
  }

  await prisma.tournamentInvite.delete({ where: { id: inviteId } });
  return { deleted: true };
}
