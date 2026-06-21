import { prisma } from "../db";
import { ApiError } from "../api/http";
import { slugify } from "../api/slug";
import { resolveOrganizationId } from "./organizations";
import type {
  createTeamSchema,
  createPlayerSchema,
  updatePlayerSchema,
  updateTeamSchema,
} from "../validations";
import type { z } from "zod";

type CreateTeamInput = z.infer<typeof createTeamSchema>;
type CreatePlayerInput = z.infer<typeof createPlayerSchema>;
type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;
type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

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

export async function listTeams(orgRef: string) {
  const orgId = await resolveOrganizationId(orgRef);
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

export async function createTeam(orgRef: string, input: CreateTeamInput) {
  const orgId = await resolveOrganizationId(orgRef);
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

export async function updatePlayerOnTeam(
  teamId: string,
  playerId: string,
  input: UpdatePlayerInput,
) {
  const team = await getTeam(teamId);
  const membership = team.memberships.find((m) => m.playerId === playerId);
  if (!membership) {
    throw new ApiError(404, "Player not found on this team", "PLAYER_NOT_FOUND");
  }

  if (input.legalName !== undefined) {
    await assertUniquePlayerNameOnTeam(teamId, input.legalName, playerId);
  }

  const playerData: {
    legalName?: string;
    displayName?: string | null;
    dateOfBirth?: Date | null;
  } = {};
  if (input.legalName !== undefined) playerData.legalName = input.legalName;
  if (input.displayName !== undefined) playerData.displayName = input.displayName;
  if (input.dateOfBirth !== undefined) {
    playerData.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
  }

  const membershipData: { shirtNumber?: number | null } = {};
  if (input.shirtNumber !== undefined) membershipData.shirtNumber = input.shirtNumber;

  if (Object.keys(playerData).length > 0) {
    await prisma.player.update({ where: { id: playerId }, data: playerData });
  }
  if (Object.keys(membershipData).length > 0) {
    await prisma.teamMembership.update({
      where: { id: membership.id },
      data: membershipData,
    });
  }

  return prisma.teamMembership.findUniqueOrThrow({
    where: { id: membership.id },
    include: { player: true },
  });
}

export async function updateTeam(teamId: string, input: UpdateTeamInput) {
  const team = await getTeam(teamId);

  if (input.name && input.name !== team.name) {
    const slug = slugify(input.name);
    const existing = await prisma.team.findFirst({
      where: {
        organizationId: team.organizationId,
        slug,
        NOT: { id: teamId },
      },
    });
    if (existing) {
      throw new ApiError(409, "Team slug already exists", "SLUG_EXISTS");
    }
  }

  return prisma.team.update({
    where: { id: teamId },
    data: {
      ...(input.name !== undefined ? { name: input.name, slug: slugify(input.name) } : {}),
      ...(input.ageGroup !== undefined ? { ageGroup: input.ageGroup } : {}),
      ...(input.homeGround !== undefined ? { homeGround: input.homeGround } : {}),
    },
  });
}

export async function deleteTeam(teamId: string) {
  const team = await getTeam(teamId);

  const tournamentEntry = await prisma.tournamentTeam.findFirst({
    where: { teamId },
    include: {
      tournament: {
        select: { name: true },
      },
      _count: { select: { homeMatches: true, awayMatches: true } },
    },
  });
  if (tournamentEntry) {
    const matchCount =
      tournamentEntry._count.homeMatches + tournamentEntry._count.awayMatches;
    if (matchCount > 0) {
      throw new ApiError(
        400,
        `${team.name} is in ${matchCount} scheduled ${matchCount === 1 ? "match" : "matches"}. Remove those fixtures first, then delete the team.`,
        "TEAM_HAS_MATCHES",
      );
    }
    throw new ApiError(
      400,
      `${team.name} is currently in tournament "${tournamentEntry.tournament.name}". Remove it from the tournament first, then delete the team.`,
      "TEAM_IN_TOURNAMENT",
    );
  }

  await prisma.team.delete({ where: { id: teamId } });
}
