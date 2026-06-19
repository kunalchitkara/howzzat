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
  updateTeam,
  deleteTeam,
} from "@/lib/services/teams";
import {
  createTournament,
  addTeamToTournament,
  addNamedTeamToTournament,
  findOrCreateTournamentTeamByName,
  getTournament,
  getTournamentBySlug,
} from "@/lib/services/tournaments";
import { cancelOrDeleteMatch, createMatch, updateMatch } from "@/lib/services/matches";
import { cloneRulesProfile } from "@/lib/services/rules";

function availableOrgTeams(
  orgTeams: { id: string; name: string }[],
  tournamentTeamIds: string[],
) {
  const enrolled = new Set(tournamentTeamIds);
  return orgTeams.filter((t) => !enrolled.has(t.id));
}

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

  it("gets organization by slug", async () => {
    const org = await createOrganization({ name: "Slug Test", slug: "slug-test" });
    const fetched = await getOrganization("slug-test");
    expect(fetched.id).toBe(org.id);
    expect(fetched.name).toBe("Slug Test");
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

  it("filters enrolled teams from add-team picker", async () => {
    const org = await createOrganization({ name: "Filter Club" });
    const teamA = await createTeam(org.id, { name: "Team A", ageGroup: "U9" });
    const teamB = await createTeam(org.id, { name: "Team B", ageGroup: "U9" });
    const { version } = await seedRulesProfile(prisma);
    const tournament = await createTournament(org.id, {
      name: "League",
      rulesProfileVersionId: version.id,
    });
    await addTeamToTournament(tournament.id, teamA.id);

    const orgTeams = [
      { id: teamA.id, name: teamA.name },
      { id: teamB.id, name: teamB.name },
    ];
    const tour = await getTournament(tournament.id);
    const enrolledTeamIds = tour.teams.map((tt) => tt.teamId);
    const available = availableOrgTeams(orgTeams, enrolledTeamIds);

    expect(available).toEqual([{ id: teamB.id, name: teamB.name }]);
  });

  it("creates a match using tournament team ids", async () => {
    const org = await createOrganization({ name: "Fixture Club" });
    const teamA = await createTeam(org.id, { name: "Home XI", ageGroup: "U9" });
    const teamB = await createTeam(org.id, { name: "Away XI", ageGroup: "U9" });
    const { version } = await seedRulesProfile(prisma);
    const tournament = await createTournament(org.id, {
      name: "Cup",
      rulesProfileVersionId: version.id,
    });
    const ttHome = await addTeamToTournament(tournament.id, teamA.id);
    const ttAway = await addTeamToTournament(tournament.id, teamB.id);

    const match = await createMatch(tournament.id, {
      homeTeamId: ttHome.id,
      awayTeamId: ttAway.id,
      venue: "Main Ground",
    });

    expect(match.homeTeamId).toBe(ttHome.id);
    expect(match.awayTeamId).toBe(ttAway.id);
  });

  it("persists scheduledAt when creating a match", async () => {
    const org = await createOrganization({ name: "Dated Fixture Club" });
    const teamA = await createTeam(org.id, { name: "Home XI", ageGroup: "U9" });
    const teamB = await createTeam(org.id, { name: "Away XI", ageGroup: "U9" });
    const { version } = await seedRulesProfile(prisma);
    const tournament = await createTournament(org.id, {
      name: "Dated Cup",
      rulesProfileVersionId: version.id,
    });
    const ttHome = await addTeamToTournament(tournament.id, teamA.id);
    const ttAway = await addTeamToTournament(tournament.id, teamB.id);

    const scheduledAt = "2026-07-12T10:00:00.000Z";
    const match = await createMatch(tournament.id, {
      homeTeamId: ttHome.id,
      awayTeamId: ttAway.id,
      scheduledAt,
      venue: "North Field",
    });

    expect(match.scheduledAt?.toISOString()).toBe(scheduledAt);
    expect(match.slug).toMatch(/20260712/);
  });

  it("updates scheduledAt and slug for scheduled matches", async () => {
    const org = await createOrganization({ name: "Reschedule Club" });
    const teamA = await createTeam(org.id, { name: "Home XI", ageGroup: "U9" });
    const teamB = await createTeam(org.id, { name: "Away XI", ageGroup: "U9" });
    const { version } = await seedRulesProfile(prisma);
    const tournament = await createTournament(org.id, {
      name: "Reschedule Cup",
      ageGroup: "U9",
      rulesProfileVersionId: version.id,
    });
    const ttHome = await addTeamToTournament(tournament.id, teamA.id);
    const ttAway = await addTeamToTournament(tournament.id, teamB.id);

    const match = await createMatch(tournament.id, {
      homeTeamId: ttHome.id,
      awayTeamId: ttAway.id,
      scheduledAt: "2026-07-12T10:00:00.000Z",
    });

    const updated = await updateMatch(match.id, {
      scheduledAt: "2026-08-01T10:00:00.000Z",
    });
    expect(updated.scheduledAt?.toISOString()).toBe("2026-08-01T10:00:00.000Z");
    expect(updated.slug).toMatch(/20260801$/);
  });

  it("rejects rescheduling live matches", async () => {
    const fx = await seedTestFixtures(prisma);
    const match = await createMatch(fx.tournamentId, {
      homeTeamId: fx.tournamentTeamAId,
      awayTeamId: fx.tournamentTeamBId,
      scheduledAt: "2026-06-04T10:00:00.000Z",
    });
    await prisma.match.update({ where: { id: match.id }, data: { status: "LIVE" } });

    await expect(
      updateMatch(match.id, { scheduledAt: "2026-06-19T10:00:00.000Z" }),
    ).rejects.toMatchObject({ code: "MATCH_NOT_SCHEDULED" });
  });

  it("deletes scheduled fixtures without scoring data", async () => {
    const fx = await seedTestFixtures(prisma);
    const match = await createMatch(fx.tournamentId, {
      homeTeamId: fx.tournamentTeamAId,
      awayTeamId: fx.tournamentTeamBId,
    });

    const result = await cancelOrDeleteMatch(match.id);
    expect(result.deleted).toBe(true);
    expect(await prisma.match.findUnique({ where: { id: match.id } })).toBeNull();
  });

  it("soft-cancels live fixtures that have deliveries", async () => {
    const fx = await seedTestFixtures(prisma);
    const match = await createMatch(fx.tournamentId, {
      homeTeamId: fx.tournamentTeamAId,
      awayTeamId: fx.tournamentTeamBId,
    });
    const innings = await prisma.innings.create({
      data: {
        matchId: match.id,
        battingTeamId: fx.tournamentTeamAId,
        inningsNumber: 1,
        rulesVersionId: fx.rulesVersionId,
      },
    });
    await prisma.delivery.create({
      data: {
        inningsId: innings.id,
        sequence: 1,
        overNumber: 1,
        ballInOver: 1,
        isLegalBall: true,
        runsOffBat: 1,
        extrasRuns: 0,
        strikerId: fx.playerIds[0]!,
        nonStrikerId: fx.playerIds[1]!,
        bowlerId: fx.playerIds[2]!,
        rulesVersionId: fx.rulesVersionId,
      },
    });
    await prisma.match.update({ where: { id: match.id }, data: { status: "LIVE" } });

    const result = await cancelOrDeleteMatch(match.id);
    expect(result.cancelled).toBe(true);
    const row = await prisma.match.findUnique({ where: { id: match.id } });
    expect(row?.status).toBe("ABANDONED");
  });

  it("creates a match from team names without pre-enrolled teams", async () => {
    const org = await createOrganization({ name: "Quick Fixture Club" });
    const teamA = await createTeam(org.id, { name: "Edgware U9", ageGroup: "U9" });
    await createTeam(org.id, { name: "Unused", ageGroup: "U9" });
    const { version } = await seedRulesProfile(prisma);
    const tournament = await createTournament(org.id, {
      name: "Quick Cup",
      ageGroup: "U9",
      rulesProfileVersionId: version.id,
    });
    await addTeamToTournament(tournament.id, teamA.id);

    const match = await createMatch(tournament.id, {
      homeTeamName: "Edgware U9",
      awayTeamName: "Hayes U9",
      venue: "Demo Ground",
    });

    expect(match.homeTeam.team.name).toBe("Edgware U9");
    expect(match.awayTeam.team.name).toBe("Hayes U9");
    expect(match.awayTeam.team.slug.startsWith("ext-")).toBe(true);
  });

  it("does not duplicate tournament teams when adding the same name twice", async () => {
    const org = await createOrganization({ name: "Dedupe Club" });
    const { version } = await seedRulesProfile(prisma);
    const tournament = await createTournament(org.id, {
      name: "Dedupe Cup",
      rulesProfileVersionId: version.id,
    });

    await addNamedTeamToTournament(tournament.id, "Test Hayes U9");
    await addNamedTeamToTournament(tournament.id, "test hayes u9");

    const enrolled = await prisma.tournamentTeam.findMany({
      where: { tournamentId: tournament.id },
      include: { team: true },
    });
    expect(enrolled).toHaveLength(1);
    expect(enrolled[0]?.team.name).toBe("Test Hayes U9");
  });

  it("reuses org roster team when enrolling by name instead of creating external duplicate", async () => {
    const org = await createOrganization({ name: "Roster Dedupe Club" });
    const rosterTeam = await createTeam(org.id, { name: "Test Hayes U9", ageGroup: "U9" });
    const { version } = await seedRulesProfile(prisma);
    const tournament = await createTournament(org.id, {
      name: "Roster Cup",
      rulesProfileVersionId: version.id,
    });

    const entry = await addNamedTeamToTournament(tournament.id, "Test Hayes U9");

    expect(entry.team.id).toBe(rosterTeam.id);
    expect(entry.team.slug.startsWith("ext-")).toBe(false);
  });

  it("dedupes org roster enrollment when an external team with the same name is already enrolled", async () => {
    const org = await createOrganization({ name: "Mixed Dedupe Club" });
    const { version } = await seedRulesProfile(prisma);
    const tournament = await createTournament(org.id, {
      name: "Mixed Cup",
      rulesProfileVersionId: version.id,
    });

    const externalEntry = await addNamedTeamToTournament(tournament.id, "Test Hayes U9");
    expect(externalEntry.team.slug.startsWith("ext-")).toBe(true);

    const rosterTeam = await createTeam(org.id, { name: "Test Hayes U9", ageGroup: "U9" });
    const viaRoster = await addTeamToTournament(tournament.id, rosterTeam.id);

    const enrolled = await prisma.tournamentTeam.findMany({
      where: { tournamentId: tournament.id },
    });
    expect(enrolled).toHaveLength(1);
    expect(viaRoster.id).toBe(externalEntry.id);
  });

  it("scheduling a match does not duplicate an opponent already in the tournament", async () => {
    const org = await createOrganization({ name: "Schedule Dedupe Club" });
    const homeTeam = await createTeam(org.id, { name: "U9 ECC", ageGroup: "U9" });
    const { version } = await seedRulesProfile(prisma);
    const tournament = await createTournament(org.id, {
      name: "Schedule Cup",
      ageGroup: "U9",
      rulesProfileVersionId: version.id,
    });
    await addTeamToTournament(tournament.id, homeTeam.id);
    await addNamedTeamToTournament(tournament.id, "Test Hayes U9");

    await createMatch(tournament.id, {
      homeTeamName: "U9 ECC",
      awayTeamName: "Test Hayes U9",
      venue: "Main Ground",
    });

    const enrolled = await prisma.tournamentTeam.findMany({
      where: { tournamentId: tournament.id },
      include: { team: true },
    });
    expect(enrolled).toHaveLength(2);
    expect(enrolled.map((tt) => tt.team.name).sort()).toEqual(["Test Hayes U9", "U9 ECC"]);
  });

  it("findOrCreateTournamentTeamByName is idempotent within one scheduling context", async () => {
    const org = await createOrganization({ name: "Ctx Dedupe Club" });
    const { version } = await seedRulesProfile(prisma);
    const tournament = await createTournament(org.id, {
      name: "Ctx Cup",
      rulesProfileVersionId: version.id,
    });
    const ctx = {
      id: tournament.id,
      organizationId: org.id,
      ageGroup: "U9" as string | null,
      rulesProfileVersionId: version.id,
      teams: [] as Array<{
        id: string;
        publicSlug: string | null;
        team: { id: string; name: string; slug: string };
      }>,
    };

    const first = await findOrCreateTournamentTeamByName(
      tournament.id,
      "Test Hayes U9",
      ctx,
    );
    const second = await findOrCreateTournamentTeamByName(
      tournament.id,
      "Test Hayes U9",
      ctx,
    );

    expect(second.id).toBe(first.id);
    expect(ctx.teams).toHaveLength(1);
  });

  it("rejects org team ids when scheduling a match", async () => {
    const org = await createOrganization({ name: "Bad Fixture Club" });
    const teamA = await createTeam(org.id, { name: "Home XI", ageGroup: "U9" });
    const teamB = await createTeam(org.id, { name: "Away XI", ageGroup: "U9" });
    const { version } = await seedRulesProfile(prisma);
    const tournament = await createTournament(org.id, {
      name: "Cup",
      rulesProfileVersionId: version.id,
    });
    await addTeamToTournament(tournament.id, teamA.id);
    await addTeamToTournament(tournament.id, teamB.id);

    await expect(
      createMatch(tournament.id, {
        homeTeamId: teamA.id,
        awayTeamId: teamB.id,
      }),
    ).rejects.toMatchObject({ code: "INVALID_TEAMS" });
  });

  it("rejects scheduling the same tournament team as home and away", async () => {
    const org = await createOrganization({ name: "Same Team Club" });
    const teamA = await createTeam(org.id, { name: "Solo XI", ageGroup: "U9" });
    const teamB = await createTeam(org.id, { name: "Other XI", ageGroup: "U9" });
    const { version } = await seedRulesProfile(prisma);
    const tournament = await createTournament(org.id, {
      name: "Cup",
      rulesProfileVersionId: version.id,
    });
    const ttHome = await addTeamToTournament(tournament.id, teamA.id);
    await addTeamToTournament(tournament.id, teamB.id);

    await expect(
      createMatch(tournament.id, {
        homeTeamId: ttHome.id,
        awayTeamId: ttHome.id,
      }),
    ).rejects.toMatchObject({ code: "SAME_TEAMS" });
  });

  it("updates and deletes a team", async () => {
    const org = await createOrganization({ name: "Edit Club" });
    const team = await createTeam(org.id, { name: "U9 Cubs", ageGroup: "U9" });

    const updated = await updateTeam(team.id, { name: "U10 Cubs", ageGroup: "U10" });
    expect(updated.name).toBe("U10 Cubs");
    expect(updated.ageGroup).toBe("U10");

    await deleteTeam(team.id);
    await expect(deleteTeam(team.id)).rejects.toMatchObject({
      code: "TEAM_NOT_FOUND",
    });
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
