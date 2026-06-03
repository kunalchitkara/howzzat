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

export async function createOrganization(input: CreateOrgInput) {
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
    },
  });
}
