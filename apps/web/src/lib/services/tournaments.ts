import { prisma } from "../db";
import { ApiError } from "../api/http";
import { randomToken, slugify } from "../api/slug";
import { cloneRulesProfile, resolveRulesVersionForTournament } from "./rules";
import type { createTournamentSchema } from "../validations";
import type { z } from "zod";

type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

export async function listTournaments(orgId: string) {
  return prisma.tournament.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    include: {
      rulesProfileVersion: { include: { template: true } },
      _count: { select: { teams: true, matches: true } },
    },
  });
}

export async function getTournament(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      organization: true,
      rulesProfileVersion: { include: { template: true } },
      rulesBindings: {
        orderBy: { effectiveFrom: "asc" },
        include: { rulesProfileVersion: true },
      },
      teams: {
        include: {
          team: {
            include: {
              memberships: {
                where: { active: true },
                include: { player: true },
              },
            },
          },
        },
      },
      matches: {
        orderBy: [{ matchNumber: "asc" }, { scheduledAt: "asc" }],
        include: {
          homeTeam: { include: { team: true } },
          awayTeam: { include: { team: true } },
        },
      },
    },
  });
  if (!tournament) {
    throw new ApiError(404, "Tournament not found", "TOURNAMENT_NOT_FOUND");
  }
  return tournament;
}

export async function getTournamentBySlug(orgSlug: string, tournamentSlug: string) {
  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) throw new ApiError(404, "Organization not found", "ORG_NOT_FOUND");

  const tournament = await prisma.tournament.findUnique({
    where: {
      organizationId_slug: {
        organizationId: org.id,
        slug: tournamentSlug,
      },
    },
    include: {
      organization: true,
      rulesProfileVersion: { include: { template: true } },
      teams: { include: { team: true } },
      matches: {
        where: { isOfficial: true },
        orderBy: [{ matchNumber: "asc" }, { scheduledAt: "asc" }],
        include: {
          homeTeam: { include: { team: true } },
          awayTeam: { include: { team: true } },
        },
      },
    },
  });
  if (!tournament || !tournament.isPublic) {
    throw new ApiError(404, "Tournament not found", "TOURNAMENT_NOT_FOUND");
  }
  return tournament;
}

export async function createTournament(orgId: string, input: CreateTournamentInput) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new ApiError(404, "Organization not found", "ORG_NOT_FOUND");

  let rulesVersion = await resolveRulesVersionForTournament(input);

  if (input.rulesOverrides && Object.keys(input.rulesOverrides).length > 0) {
    const builtinId =
      input.rulesTemplateBuiltinId ?? rulesVersion.template.builtinId ?? undefined;
    if (!builtinId) {
      throw new ApiError(
        400,
        "rulesOverrides requires a builtin template",
        "MISSING_TEMPLATE",
      );
    }
    const cloned = await cloneRulesProfile({
      builtinId,
      name: `${input.name} rules`,
      overrides: input.rulesOverrides,
      label: "Tournament config",
    });
    rulesVersion = cloned;
  }
  const slug = input.slug ?? slugify(input.name);

  const existing = await prisma.tournament.findUnique({
    where: { organizationId_slug: { organizationId: orgId, slug } },
  });
  if (existing) {
    throw new ApiError(409, "Tournament slug already exists", "SLUG_EXISTS");
  }

  const tournament = await prisma.tournament.create({
    data: {
      organizationId: orgId,
      name: input.name,
      slug,
      publicToken: randomToken(),
      ageGroup: input.ageGroup,
      seasonLabel: input.seasonLabel,
      rulesProfileVersionId: rulesVersion.id,
      isPublic: input.isPublic ?? true,
      startsOn: input.startsOn ? new Date(input.startsOn) : undefined,
      endsOn: input.endsOn ? new Date(input.endsOn) : undefined,
      rulesBindings: {
        create: {
          rulesProfileVersionId: rulesVersion.id,
          notes: "Initial rules binding",
        },
      },
    },
    include: {
      rulesProfileVersion: { include: { template: true } },
    },
  });

  return tournament;
}

export async function addTeamToTournament(
  tournamentId: string,
  teamId: string,
  publicSlug?: string,
) {
  const tournament = await getTournament(tournamentId);
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new ApiError(404, "Team not found", "TEAM_NOT_FOUND");
  if (team.organizationId !== tournament.organizationId) {
    throw new ApiError(
      400,
      "Team must belong to the same organization as the tournament",
      "TEAM_ORG_MISMATCH",
    );
  }

  const slug = publicSlug ?? slugify(team.slug);

  return prisma.tournamentTeam.create({
    data: {
      tournamentId,
      teamId,
      publicSlug: slug,
    },
    include: { team: true },
  });
}
