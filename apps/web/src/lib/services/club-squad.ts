import { prisma } from "../db";
import { slugify } from "../api/slug";
import {
  ageGroupsMatch,
  canonicalAgeGroupKey,
} from "@/lib/scoring/age-eligibility";
import { isExternalTeam } from "./tournaments";
import { assertUniquePlayerNameOnTeam } from "./teams";

function normalizePlayerName(name: string): string {
  return name.trim().toLowerCase();
}

function teamAgeGroupKey(team: {
  ageGroup: string | null;
  name: string;
}): string | null {
  return (
    canonicalAgeGroupKey(team.ageGroup) ?? canonicalAgeGroupKey(team.name)
  );
}

type OrgTeamRow = {
  id: string;
  name: string;
  slug: string;
  ageGroup: string | null;
};

/** Canonical club squad for an age band — enrolled home team when it matches, else an existing U9-style team, else create one. */
export async function resolveClubSquadTeam(options: {
  orgId: string;
  tournamentAgeGroup: string | null;
  enrolledOrgTeam: OrgTeamRow;
}): Promise<OrgTeamRow> {
  const tournamentKey = canonicalAgeGroupKey(options.tournamentAgeGroup);
  const enrolled = options.enrolledOrgTeam;

  if (!isExternalTeam(enrolled)) {
    const enrolledKey = teamAgeGroupKey(enrolled);
    if (!tournamentKey || (enrolledKey && ageGroupsMatch(enrolledKey, tournamentKey))) {
      return enrolled;
    }
  }

  if (tournamentKey) {
    const teams = await prisma.team.findMany({
      where: { organizationId: options.orgId },
      select: { id: true, name: true, slug: true, ageGroup: true },
      orderBy: { createdAt: "asc" },
    });
    for (const team of teams) {
      if (isExternalTeam(team)) continue;
      const teamKey = teamAgeGroupKey(team);
      if (teamKey && ageGroupsMatch(teamKey, tournamentKey)) {
        return team;
      }
    }
  }

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: options.orgId },
    select: { name: true },
  });
  const ageLabel = tournamentKey ?? "Squad";
  const name = `${org.name} ${ageLabel}`;
  const slug = slugify(name);
  const existing = await prisma.team.findUnique({
    where: { organizationId_slug: { organizationId: options.orgId, slug } },
    select: { id: true, name: true, slug: true, ageGroup: true },
  });
  if (existing) return existing;

  return prisma.team.create({
    data: {
      organizationId: options.orgId,
      name,
      slug,
      ageGroup: options.tournamentAgeGroup ?? undefined,
    },
    select: { id: true, name: true, slug: true, ageGroup: true },
  });
}

/** Find an active player by name on a single team roster. */
async function findPlayerOnTeamByName(
  teamId: string,
  legalName: string,
): Promise<{ playerId: string } | null> {
  const normalized = normalizePlayerName(legalName);
  if (!normalized) return null;

  const memberships = await prisma.teamMembership.findMany({
    where: { teamId, active: true },
    include: { player: true },
  });
  const match = memberships.find(
    (m) => normalizePlayerName(m.player.legalName) === normalized,
  );
  return match ? { playerId: match.playerId } : null;
}

/** Find an active club player by name across non-external org teams in the tournament age band. */
export async function findClubPlayerByNameInAgeBand(options: {
  orgId: string;
  tournamentAgeGroup: string | null;
  legalName: string;
  excludeOrgTeamIds?: string[];
}): Promise<{ playerId: string } | null> {
  const normalized = normalizePlayerName(options.legalName);
  if (!normalized) return null;

  const tournamentKey = canonicalAgeGroupKey(options.tournamentAgeGroup);
  const exclude = new Set(options.excludeOrgTeamIds ?? []);
  const teams = await prisma.team.findMany({
    where: { organizationId: options.orgId },
    select: { id: true, ageGroup: true, slug: true, name: true },
  });

  const teamIds: string[] = [];
  for (const team of teams) {
    if (exclude.has(team.id) || isExternalTeam(team)) continue;
    if (tournamentKey) {
      const teamKey = teamAgeGroupKey(team);
      if (!teamKey || !ageGroupsMatch(teamKey, tournamentKey)) continue;
    }
    teamIds.push(team.id);
  }
  if (teamIds.length === 0) return null;

  const memberships = await prisma.teamMembership.findMany({
    where: { teamId: { in: teamIds }, active: true },
    include: { player: true },
  });
  const match = memberships.find(
    (m) => normalizePlayerName(m.player.legalName) === normalized,
  );
  return match ? { playerId: match.playerId } : null;
}

/**
 * Ensure a home-side quick-add player exists on the club squad (membership on canonical age-band team).
 * Reuses an existing org player when the name already appears on the club roster.
 */
export async function ensureClubPlayerForQuickAdd(options: {
  orgId: string;
  tournamentAgeGroup: string | null;
  enrolledOrgTeam: OrgTeamRow;
  legalName: string;
}): Promise<{ playerId: string }> {
  const legalName = options.legalName.trim();

  if (!isExternalTeam(options.enrolledOrgTeam)) {
    const onEnrolled = await findPlayerOnTeamByName(
      options.enrolledOrgTeam.id,
      legalName,
    );
    if (onEnrolled) return onEnrolled;
  }

  const existing = await findClubPlayerByNameInAgeBand({
    orgId: options.orgId,
    tournamentAgeGroup: options.tournamentAgeGroup,
    legalName,
  });
  if (existing) return existing;

  const clubSquadTeam = await resolveClubSquadTeam({
    orgId: options.orgId,
    tournamentAgeGroup: options.tournamentAgeGroup,
    enrolledOrgTeam: options.enrolledOrgTeam,
  });
  await assertUniquePlayerNameOnTeam(clubSquadTeam.id, legalName);

  const player = await prisma.player.create({
    data: { legalName, displayName: legalName },
  });
  await prisma.teamMembership.create({
    data: { teamId: clubSquadTeam.id, playerId: player.id },
  });
  return { playerId: player.id };
}
