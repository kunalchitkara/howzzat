import { prisma } from "../db";
import { ApiError } from "../api/http";
import { slugify } from "../api/slug";
import type { createTeamSchema, createPlayerSchema } from "../validations";
import type { z } from "zod";

type CreateTeamInput = z.infer<typeof createTeamSchema>;
type CreatePlayerInput = z.infer<typeof createPlayerSchema>;

const DUPLICATE_NAME_MESSAGE =
  'This team already has a player with that name. Use a second name initial (e.g. "Avyaan S") or suffix I, II, III if second names also match.';

function normalizePlayerName(name: string): string {
  return name.trim().toLowerCase();
}

/** Reject duplicate legal names on the same team (case-insensitive, trimmed). */
export async function assertUniquePlayerNameOnTeam(
  teamId: string,
  legalName: string,
  excludePlayerId?: string,
) {
  const normalized = normalizePlayerName(legalName);
  if (!normalized) return;

  const memberships = await prisma.teamMembership.findMany({
    where: { teamId, active: true },
    include: { player: true },
  });
  const conflict = memberships.find(
    (m) =>
      m.playerId !== excludePlayerId &&
      normalizePlayerName(m.player.legalName) === normalized,
  );
  if (conflict) {
    throw new ApiError(400, DUPLICATE_NAME_MESSAGE, "DUPLICATE_PLAYER_NAME", {
      existingName: conflict.player.legalName,
    });
  }
}

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
  await assertUniquePlayerNameOnTeam(team.id, input.legalName);

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
