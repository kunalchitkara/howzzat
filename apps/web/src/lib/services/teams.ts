import { prisma } from "../db";
import { ApiError } from "../api/http";
import { slugify } from "../api/slug";
import type { createTeamSchema, createPlayerSchema } from "../validations";
import type { z } from "zod";

type CreateTeamInput = z.infer<typeof createTeamSchema>;
type CreatePlayerInput = z.infer<typeof createPlayerSchema>;

export async function listTeams(orgId: string) {
  return prisma.team.findMany({
    where: { organizationId: orgId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { memberships: true } },
    },
  });
}

export async function getTeam(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      organization: true,
      memberships: {
        where: { active: true },
        include: { player: true },
        orderBy: { shirtNumber: "asc" },
      },
    },
  });
  if (!team) throw new ApiError(404, "Team not found", "TEAM_NOT_FOUND");
  return team;
}

export async function createTeam(orgId: string, input: CreateTeamInput) {
  const slug = input.slug ?? slugify(input.name);
  const existing = await prisma.team.findUnique({
    where: { organizationId_slug: { organizationId: orgId, slug } },
  });
  if (existing) {
    throw new ApiError(409, "Team slug already exists", "SLUG_EXISTS");
  }

  return prisma.team.create({
    data: {
      organizationId: orgId,
      name: input.name,
      slug,
      homeGround: input.homeGround,
      ageGroup: input.ageGroup,
    },
  });
}

export async function addPlayerToTeam(teamId: string, input: CreatePlayerInput) {
  const team = await getTeam(teamId);

  const player = await prisma.player.create({
    data: {
      legalName: input.legalName,
      displayName: input.displayName,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
    },
  });

  const membership = await prisma.teamMembership.create({
    data: {
      teamId: team.id,
      playerId: player.id,
      shirtNumber: input.shirtNumber,
      seasonLabel: input.seasonLabel,
    },
    include: { player: true },
  });

  return membership;
}

export async function listTeamPlayers(teamId: string) {
  await getTeam(teamId);
  return prisma.teamMembership.findMany({
    where: { teamId, active: true },
    include: { player: true },
    orderBy: { shirtNumber: "asc" },
  });
}
