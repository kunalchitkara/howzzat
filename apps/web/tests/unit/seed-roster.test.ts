import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@howzzat/db";
import { resetDatabase } from "@howzzat/db/testing";
import { seedTeamRoster } from "@/lib/demo/seed-roster";

describe("seedTeamRoster", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("deactivates players removed from the roster list", async () => {
    const org = await prisma.organization.create({
      data: { name: "Test Org", slug: "test-org" },
    });
    const team = await prisma.team.create({
      data: { organizationId: org.id, name: "Test Team", slug: "test-team" },
    });

    await seedTeamRoster(prisma, team.id, ["Aanya", "Qaim", "Krish"], "u9-demo");
    await seedTeamRoster(prisma, team.id, ["Aanya", "Qaim"], "u9-demo");

    const active = await prisma.teamMembership.findMany({
      where: { teamId: team.id, seasonLabel: "u9-demo", active: true },
      include: { player: true },
      orderBy: { shirtNumber: "asc" },
    });
    expect(active.map((m) => m.player.legalName)).toEqual(["Aanya", "Qaim"]);

    const inactive = await prisma.teamMembership.findMany({
      where: { teamId: team.id, seasonLabel: "u9-demo", active: false },
      include: { player: true },
    });
    expect(inactive.map((m) => m.player.legalName)).toEqual(["Krish"]);
  });
});
