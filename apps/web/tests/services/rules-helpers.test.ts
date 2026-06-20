import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@howzzat/db";
import { resetDatabase } from "@howzzat/db/testing";
import { getBuiltinProfile } from "@howzzat/rules-engine";
import {
  getRulesProfileFromVersion,
  resolveRulesVersionIdForCoachTournament,
} from "@/lib/services/rules-helpers";

describe("resolveRulesVersionIdForCoachTournament", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  async function seedDemoRulesVersion() {
    const demo = getBuiltinProfile("demo-2-over-pairs-v1")!;
    const template = await prisma.rulesProfileTemplate.create({
      data: {
        builtinId: demo.id,
        name: demo.name,
        description: demo.description,
        isPublic: false,
      },
    });
    return prisma.rulesProfileVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        configJson: JSON.stringify(demo),
      },
    });
  }

  it("rebinds coach tournament stuck on demo-2-over to MJCA U9", async () => {
    const demoVersion = await seedDemoRulesVersion();
    const org = await prisma.organization.create({
      data: { name: "ECC", slug: "ecc-rules-rebind" },
    });
    const tournament = await prisma.tournament.create({
      data: {
        organizationId: org.id,
        name: "Test ECC U9",
        slug: "test-ecc-u9-rebind",
        ageGroup: "U9",
        rulesProfileVersionId: demoVersion.id,
      },
    });
    const homeTeam = await prisma.team.create({
      data: { organizationId: org.id, name: "U9 ECC", slug: "u9-ecc", ageGroup: "U9" },
    });
    const awayTeam = await prisma.team.create({
      data: { organizationId: org.id, name: "Away", slug: "away", ageGroup: "U9" },
    });
    const ttHome = await prisma.tournamentTeam.create({
      data: { tournamentId: tournament.id, teamId: homeTeam.id },
    });
    const ttAway = await prisma.tournamentTeam.create({
      data: { tournamentId: tournament.id, teamId: awayTeam.id },
    });
    const match = await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        homeTeamId: ttHome.id,
        awayTeamId: ttAway.id,
        rulesVersionId: demoVersion.id,
        slug: "rebind-test",
      },
    });

    const resolved = await resolveRulesVersionIdForCoachTournament({
      tournamentId: tournament.id,
      tournamentSlug: tournament.slug,
      rulesVersionId: demoVersion.id,
    });

    const profile = await getRulesProfileFromVersion(resolved);
    expect(profile.playersPerSide.max).toBe(15);

    const updatedTournament = await prisma.tournament.findUniqueOrThrow({
      where: { id: tournament.id },
    });
    expect(updatedTournament.rulesProfileVersionId).toBe(resolved);

    const updatedMatch = await prisma.match.findUniqueOrThrow({
      where: { id: match.id },
    });
    expect(updatedMatch.rulesVersionId).toBe(resolved);
  });

  it("leaves demo tournament slugs on demo rules", async () => {
    const demoVersion = await seedDemoRulesVersion();
    const org = await prisma.organization.create({
      data: { name: "Demo Org", slug: "demo-org" },
    });
    const tournament = await prisma.tournament.create({
      data: {
        organizationId: org.id,
        name: "U9 Demo",
        slug: "u9-demo",
        rulesProfileVersionId: demoVersion.id,
      },
    });

    const resolved = await resolveRulesVersionIdForCoachTournament({
      tournamentId: tournament.id,
      tournamentSlug: tournament.slug,
      rulesVersionId: demoVersion.id,
    });
    expect(resolved).toBe(demoVersion.id);
  });
});
