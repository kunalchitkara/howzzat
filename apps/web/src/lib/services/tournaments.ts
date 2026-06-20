import { prisma } from "../db";
import { ApiError } from "../api/http";
import { randomToken, slugify, uniqueSlug } from "../api/slug";
import { cloneRulesProfile, resolveRulesVersionForTournament } from "./rules";
import { resolveOrganizationId } from "./organizations";
import { rulesProfileVersionWithTemplate } from "./rules-template-select";
import type { createTournamentSchema } from "../validations";
import type { z } from "zod";

type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

/** Shadow org teams created for opponent names (no roster required upfront). */
export const EXTERNAL_TEAM_SLUG_PREFIX = "ext-";

export function isExternalTeam(team: { slug: string }): boolean {
  return team.slug.startsWith(EXTERNAL_TEAM_SLUG_PREFIX);
}

export function teamNamesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function dedupeTournamentTeamsByName<T extends { id: string; name: string }>(
  teams: T[],
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const team of teams) {
    const key = team.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(team);
  }
  return result;
}

type TournamentTeamEntry = TournamentEnrollmentContext["teams"][number];

function findTournamentTeamEntryByName(
  teams: TournamentTeamEntry[],
  name: string,
): TournamentTeamEntry | undefined {
  return teams.find((tt) => teamNamesMatch(tt.team.name, name));
}

const tournamentTeamEntrySelect = {
  id: true,
  publicSlug: true,
  team: { select: { id: true, name: true, slug: true } },
} as const;

async function findTournamentTeamEntryInDb(tournamentId: string, name: string) {
  const entries = await prisma.tournamentTeam.findMany({
    where: { tournamentId },
    select: tournamentTeamEntrySelect,
  });
  return findTournamentTeamEntryByName(entries, name);
}

/** Create or reuse a name-only opponent team in the org. */
export async function ensureExternalTeam(orgId: string, name: string) {
  const trimmed = name.trim();
  const orgTeams = await prisma.team.findMany({
    where: { organizationId: orgId },
  });
  const existing = orgTeams.find((t) => teamNamesMatch(t.name, trimmed));
  if (existing) return existing;

  return prisma.team.create({
    data: {
      organizationId: orgId,
      name: trimmed,
      slug: uniqueSlug(`${EXTERNAL_TEAM_SLUG_PREFIX}${trimmed}`, randomToken()),
    },
  });
}

/** Lightweight tournament row for match scheduling (avoids full roster/match includes). */
export type TournamentEnrollmentContext = {
  id: string;
  organizationId: string;
  ageGroup: string | null;
  rulesProfileVersionId: string;
  teams: Array<{
    id: string;
    publicSlug: string | null;
    team: { id: string; name: string; slug: string };
  }>;
};

export async function loadTournamentEnrollmentContext(
  tournamentId: string,
): Promise<TournamentEnrollmentContext> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      organizationId: true,
      ageGroup: true,
      rulesProfileVersionId: true,
      teams: {
        select: {
          id: true,
          publicSlug: true,
          team: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
  if (!tournament) {
    throw new ApiError(404, "Tournament not found", "TOURNAMENT_NOT_FOUND");
  }
  return tournament;
}

/** Enroll a team by org roster id or free-text name (creates external team). */
export async function findOrCreateTournamentTeamByName(
  tournamentId: string,
  name: string,
  ctx?: TournamentEnrollmentContext,
) {
  const tournament =
    ctx ?? (await loadTournamentEnrollmentContext(tournamentId));
  const trimmed = name.trim();
  const existingInCtx = findTournamentTeamEntryByName(tournament.teams, trimmed);
  if (existingInCtx) return existingInCtx;

  const existingInDb = await findTournamentTeamEntryInDb(tournamentId, trimmed);
  if (existingInDb) {
    if (ctx) {
      ctx.teams.push(existingInDb);
    }
    return existingInDb;
  }

  const team = await ensureExternalTeam(tournament.organizationId, trimmed);
  const entry = await addTeamToTournament(tournamentId, team.id, undefined, {
    organizationId: tournament.organizationId,
  });
  if (ctx) {
    ctx.teams.push(entry);
  }
  return entry;
}

export async function listTournaments(orgRef: string) {
  const orgId = await resolveOrganizationId(orgRef);
  return prisma.tournament.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    include: {
      rulesProfileVersion: rulesProfileVersionWithTemplate,
      _count: { select: { teams: true, matches: true } },
    },
  });
}

export async function listTournamentsForUser(userId: string) {
  return prisma.tournament.findMany({
    where: { managers: { some: { userId } } },
    orderBy: { createdAt: "desc" },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      rulesProfileVersion: rulesProfileVersionWithTemplate,
      _count: { select: { teams: true, matches: true } },
    },
  });
}

export async function getTournament(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      organization: true,
      rulesProfileVersion: rulesProfileVersionWithTemplate,
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
      rulesProfileVersion: rulesProfileVersionWithTemplate,
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

export async function getTournamentByPublicToken(publicToken: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { publicToken },
    include: { organization: true },
  });
  if (!tournament || !tournament.isPublic) {
    throw new ApiError(404, "Tournament not found", "TOURNAMENT_NOT_FOUND");
  }
  return tournament;
}

export async function createTournament(orgRef: string, input: CreateTournamentInput) {
  const orgId = await resolveOrganizationId(orgRef);
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
      rulesProfileVersion: rulesProfileVersionWithTemplate,
    },
  });

  return tournament;
}

export async function addTeamToTournament(
  tournamentId: string,
  teamId: string,
  publicSlug?: string,
  options?: { organizationId: string },
) {
  const organizationId =
    options?.organizationId ??
    (await getTournament(tournamentId)).organizationId;
  const existingByTeamId = await prisma.tournamentTeam.findUnique({
    where: { tournamentId_teamId: { tournamentId, teamId } },
    include: { team: true },
  });
  if (existingByTeamId) {
    throw new ApiError(
      409,
      "Team already in tournament",
      "TEAM_ALREADY_ENROLLED",
    );
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new ApiError(404, "Team not found", "TEAM_NOT_FOUND");
  if (team.organizationId !== organizationId) {
    throw new ApiError(
      400,
      "Team must belong to the same organization as the tournament",
      "TEAM_ORG_MISMATCH",
    );
  }

  const tournamentEntries = await prisma.tournamentTeam.findMany({
    where: { tournamentId },
    include: { team: true },
  });
  const existingByName = tournamentEntries.find((tt) =>
    teamNamesMatch(tt.team.name, team.name),
  );
  if (existingByName) {
    return existingByName;
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

export async function addNamedTeamToTournament(
  tournamentId: string,
  name: string,
  publicSlug?: string,
) {
  const entry = await findOrCreateTournamentTeamByName(tournamentId, name);
  if (publicSlug && entry.publicSlug !== publicSlug) {
    return prisma.tournamentTeam.update({
      where: { id: entry.id },
      data: { publicSlug },
      include: { team: true },
    });
  }
  return entry;
}
