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

  it("rejects duplicate player names on the same team", async () => {
    const org = await createOrganization({ name: "Player Club" });
    const team = await createTeam(org.id, { name: "U9" });
    await addPlayerToTeam(team.id, { legalName: "Avyaan", shirtNumber: 1 });
    await expect(
      addPlayerToTeam(team.id, { legalName: "  avyaan  ", shirtNumber: 2 }),
    ).rejects.toMatchObject({
      status: 400,
      code: "DUPLICATE_PLAYER_NAME",
    });
    const players = await listTeamPlayers(team.id);
    expect(players).toHaveLength(1);
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

  it("reuses the same player across tournaments via team membership", async () => {
    const org = await createOrganization({ name: "Reuse Club" });
    const team = await createTeam(org.id, { name: "U9 Lions", ageGroup: "U9" });
    const membership = await addPlayerToTeam(team.id, {
      legalName: "Jamie",
      shirtNumber: 7,
    });
    const { version } = await seedRulesProfile(prisma);

    const summer = await createTournament(org.id, {
      name: "Summer Cup",
      ageGroup: "U9",
      rulesProfileVersionId: version.id,
    });
    const winter = await createTournament(org.id, {
      name: "Winter Cup",
      ageGroup: "U10",
      rulesProfileVersionId: version.id,
    });

    await addTeamToTournament(summer.id, team.id);
    await addTeamToTournament(winter.id, team.id);

    const playerCount = await prisma.player.count({
      where: { legalName: "Jamie" },
    });
    expect(playerCount).toBe(1);
    expect(membership.playerId).toBeTruthy();

    const summerTour = await prisma.tournament.findUniqueOrThrow({
      where: { id: summer.id },
      include: { teams: { include: { team: { include: { memberships: true } } } } },
    });
    const winterTour = await prisma.tournament.findUniqueOrThrow({
      where: { id: winter.id },
      include: { teams: { include: { team: { include: { memberships: true } } } } },
    });
    const summerPlayerIds =
      summerTour.teams[0]?.team.memberships.map((m) => m.playerId) ?? [];
    const winterPlayerIds =
      winterTour.teams[0]?.team.memberships.map((m) => m.playerId) ?? [];
    expect(summerPlayerIds).toContain(membership.playerId);
    expect(winterPlayerIds).toContain(membership.playerId);
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
