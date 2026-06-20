import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@howzzat/db";
import { resetDatabase, seedTestFixtures, seedRulesProfile } from "@howzzat/db/testing";
import { createOrganization } from "@/lib/services/organizations";
import {
  createTournament,
  addTeamToTournament,
  getTournament,
  dedupeTournamentTeamsByName,
} from "@/lib/services/tournaments";
import { createTeam } from "@/lib/services/teams";
import { createMatch, listMatchIdsWithDeliveries } from "@/lib/services/matches";

/** Mirrors tournament dashboard page fixture loading. */
async function loadTournamentFixtureRows(tournamentId: string) {
  const tournament = await getTournament(tournamentId);
  const matchesWithDeliveries = await listMatchIdsWithDeliveries(
    tournament.matches.map((m) => m.id),
  );

  return tournament.matches.map((m) => ({
    id: m.id,
    slug: m.slug,
    status: m.status,
    scheduledAt: m.scheduledAt?.toISOString() ?? null,
    venue: m.venue,
    marginText: m.marginText,
    homeTeamName: m.homeTeam?.team?.name ?? "TBD",
    awayTeamName: m.awayTeam?.team?.name ?? "TBD",
    hasDeliveries: matchesWithDeliveries.has(m.id),
  }));
}

describe("tournament dashboard fixture loading", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("loads fixture rows for tournament with no matches", async () => {
    const fx = await seedTestFixtures(prisma);
    const rows = await loadTournamentFixtureRows(fx.tournamentId);
    expect(rows).toEqual([]);
  });

  it("returns empty delivery set for empty match id list", async () => {
    await expect(listMatchIdsWithDeliveries([])).resolves.toEqual(new Set());
  });

  it("loads fixture rows for tournament with scheduled matches", async () => {
    const fx = await seedTestFixtures(prisma);
    await createMatch(fx.tournamentId, {
      homeTeamId: fx.tournamentTeamAId,
      awayTeamId: fx.tournamentTeamBId,
      scheduledAt: "2026-06-19T10:00:00.000Z",
    });

    const rows = await loadTournamentFixtureRows(fx.tournamentId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.homeTeamName).toBeTruthy();
    expect(rows[0]?.awayTeamName).toBeTruthy();
    expect(rows[0]?.hasDeliveries).toBe(false);
  });

  it("dedupes tournament teams by name for create-match form", async () => {
    const org = await createOrganization({ name: "Dupes Club" });
    const teamA = await createTeam(org.id, { name: "Main U9", slug: "main-u9-a" });
    const teamB = await createTeam(org.id, { name: "main u9", slug: "main-u9-b" });
    const { version } = await seedRulesProfile(prisma);
    const tournament = await createTournament(org.id, {
      name: "Summer",
      rulesProfileVersionId: version.id,
    });
    await addTeamToTournament(tournament.id, teamA.id);
    await addTeamToTournament(tournament.id, teamB.id);

    const loaded = await getTournament(tournament.id);
    const deduped = dedupeTournamentTeamsByName(
      loaded.teams.map((tt) => ({ id: tt.id, name: tt.team.name })),
    );
    expect(deduped).toHaveLength(1);
  });
});
