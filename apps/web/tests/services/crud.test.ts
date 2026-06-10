import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@howzzat/db";
import { resetDatabase, seedTestFixtures, seedRulesProfile } from "@howzzat/db/testing";
import { ApiError } from "@/lib/api/http";
import {
  createOrganization,
  getOrganization,
  listOrganizations,
} from "@/lib/services/organizations";
import {
  createTeam,
  addPlayerToTeam,
  listTeamPlayers,
} from "@/lib/services/teams";
import {
  createTournament,
  addTeamToTournament,
  getTournamentBySlug,
} from "@/lib/services/tournaments";
import { cloneRulesProfile } from "@/lib/services/rules";

describe("organizations service", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("creates and lists organizations", async () => {
    await createOrganization({ name: "Edgware CC" });
    const list = await listOrganizations();
    expect(list).toHaveLength(1);
    expect(list[0]?.slug).toBe("edgware-cc");
  });

  it("rejects duplicate slug", async () => {
    await createOrganization({ name: "Club One", slug: "same-slug" });
    await expect(
      createOrganization({ name: "Club Two", slug: "same-slug" }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("gets organization by id", async () => {
    const org = await createOrganization({ name: "Get Test" });
    const fetched = await getOrganization(org.id);
    expect(fetched.name).toBe("Get Test");
  });
});

describe("teams and tournaments service", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("creates team, tournament, and registers team", async () => {
    const org = await createOrganization({ name: "London Club" });
    const team = await createTeam(org.id, { name: "U9 Softball" });
    const { version } = await seedRulesProfile(prisma);
    const tournament = await createTournament(org.id, {
      name: "Summer 2026",
      rulesProfileVersionId: version.id,
    });
    const entry = await addTeamToTournament(tournament.id, team.id);
    expect(entry.teamId).toBe(team.id);
  });

  it("adds players to team", async () => {
    const org = await createOrganization({ name: "Player Club" });
    const team = await createTeam(org.id, { name: "U9" });
    await addPlayerToTeam(team.id, { legalName: "Ariyan", shirtNumber: 1 });
    const players = await listTeamPlayers(team.id);
    expect(players).toHaveLength(1);
    expect(players[0]?.player.legalName).toBe("Ariyan");
  });

  it("loads public tournament by slug", async () => {
    const fixtures = await seedTestFixtures(prisma);
    const tournament = await getTournamentBySlug(
      "test-club",
      "test-tournament",
    );
    expect(tournament.id).toBe(fixtures.tournamentId);
    expect(tournament.teams).toHaveLength(2);
  });
});

describe("rules service", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("clones builtin profile with overrides", async () => {
    await seedTestFixtures(prisma);
    const version = await cloneRulesProfile({
      builtinId: "u9-softball-london-v1",
      overrides: { wicketPenalty: 10 },
      name: "Strict U9",
    });
    expect(version.config.wicketPenalty).toBe(10);
    expect(version.version).toBe(1);
  });
});
