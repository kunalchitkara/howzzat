import { prisma } from "../db";
import { ApiError } from "../api/http";
import { slugify } from "../api/slug";
import type { createOrganizationSchema } from "../validations";
import type { z } from "zod";

type CreateOrgInput = z.infer<typeof createOrganizationSchema>;

export async function listOrganizations() {
  return prisma.organization.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { teams: true, tournaments: true } },
    },
  });
}

export async function getOrganization(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      teams: true,
      tournaments: {
        orderBy: { createdAt: "desc" },
        include: {
          rulesProfileVersion: {
            include: { template: true },
          },
        },
      },
    },
  });
  if (!org) throw new ApiError(404, "Organization not found", "ORG_NOT_FOUND");
  return org;
}

export async function getOrganizationBySlug(slug: string) {
  const org = await prisma.organization.findUnique({
    where: { slug },
    include: {
      teams: true,
      tournaments: { where: { isPublic: true } },
    },
  });
  if (!org) throw new ApiError(404, "Organization not found", "ORG_NOT_FOUND");
  return org;
}

export async function createOrganization(
  input: CreateOrgInput,
  ownerUserId?: string,
) {
  const slug = input.slug ?? slugify(input.name);
  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) {
    throw new ApiError(409, "Organization slug already exists", "SLUG_EXISTS");
  }
  return prisma.organization.create({
    data: {
      name: input.name,
      slug,
      description: input.description,
      homeGround: input.homeGround,
      memberships: ownerUserId
        ? {
            create: {
              userId: ownerUserId,
              role: "OWNER",
            },
          }
        : undefined,
    },
    include: {
      _count: { select: { teams: true, tournaments: true } },
    },
  });
}

export async function listOrganizationsForUser(userId: string) {
  return prisma.organization.findMany({
    where: {
      OR: [
        { memberships: { some: { userId } } },
        { tournaments: { some: { managers: { some: { userId } } } } },
      ],
    },
    orderBy: { name: "asc" },
    include: {
      memberships: { where: { userId } },
      tournaments: {
        where: { managers: { some: { userId } } },
        select: { id: true },
      },
      _count: { select: { teams: true, tournaments: true } },
    },
  });
}

/** Org detail scoped to what the user may see (all tournaments if org member, else managed only). */
export async function getOrganizationForUser(orgId: string, userId: string) {
  const org = await getOrganization(orgId);

  const membership = await prisma.orgMembership.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });
  if (membership) return org;

  const managedIds = new Set(
    (
      await prisma.tournamentManager.findMany({
        where: { userId, tournament: { organizationId: orgId } },
        select: { tournamentId: true },
      })
    ).map((m) => m.tournamentId),
  );
  if (managedIds.size === 0) {
    throw new ApiError(404, "Organization not found", "ORG_NOT_FOUND");
  }

  return {
    ...org,
    tournaments: org.tournaments.filter((t) => managedIds.has(t.id)),
  };
}
