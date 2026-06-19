import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@howzzat/db";
import { resetDatabase } from "@howzzat/db/testing";
import { getBuiltinProfile } from "@howzzat/rules-engine";
import { GET as getScoring } from "@/app/api/v1/matches/[matchId]/scoring/route";
import { POST as confirmSquadsRoute } from "@/app/api/v1/matches/[matchId]/squad/confirm/route";
import {
  addMatchPlayer,
  createMatch,
  recordToss,
  setMatchSquad,
} from "@/lib/services/matches";
import { jsonRequest, params, readJson } from "../helpers/request";

async function seedMjcaU9Tournament() {
  const profile = getBuiltinProfile("mjca-u9-outdoor-v1")!;
  expect(profile.playersPerSide.min).toBe(2);
  expect(profile.playersPerSide.max).toBe(15);

  const template = await prisma.rulesProfileTemplate.create({
    data: {
      builtinId: profile.id,
      name: profile.name,
      description: profile.description,
      isPublic: true,
    },
  });
  const rulesVersion = await prisma.rulesProfileVersion.create({
    data: {
      templateId: template.id,
      version: 1,
      configJson: JSON.stringify(profile),
      label: "v1",
    },
  });

  const org = await prisma.organization.create({
    data: { name: "ECC", slug: "ecc-u9-lineup-test" },
  });
  const homeTeam = await prisma.team.create({
    data: { organizationId: org.id, name: "U9 ECC", slug: "u9-ecc", ageGroup: "U9" },
  });
  const awayTeam = await prisma.team.create({
    data: {
      organizationId: org.id,
      name: "Test Hayes U9",
      slug: "test-hayes-u9",
      ageGroup: "U9",
    },
  });
  const tournament = await prisma.tournament.create({
    data: {
      organizationId: org.id,
      name: "Test ECC U9",
      slug: "test-ecc-u9-lineup",
      ageGroup: "U9",
      rulesProfileVersionId: rulesVersion.id,
      isPublic: true,
      rulesBindings: { create: { rulesProfileVersionId: rulesVersion.id } },
    },
  });
  const ttHome = await prisma.tournamentTeam.create({
    data: { tournamentId: tournament.id, teamId: homeTeam.id, publicSlug: "u9-ecc" },
  });
  const ttAway = await prisma.tournamentTeam.create({
    data: {
      tournamentId: tournament.id,
      teamId: awayTeam.id,
      publicSlug: "test-hayes-u9",
    },
  });

  const homePlayerIds: string[] = [];
  for (const name of ["Veer", "Taran", "Avyaan"]) {
    const player = await prisma.player.create({ data: { legalName: name } });
    homePlayerIds.push(player.id);
    await prisma.teamMembership.create({
      data: { teamId: homeTeam.id, playerId: player.id, seasonLabel: "2026" },
    });
  }

  return {
    tournamentId: tournament.id,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    tournamentTeamHomeId: ttHome.id,
    tournamentTeamAwayId: ttAway.id,
    homePlayerIds,
  };
}

describe("U9 MJCA lineup limits (2–15 players)", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("exposes squadMin 2 and squadMax 15 from MJCA U9 rules profile in scoring context", async () => {
    const fx = await seedMjcaU9Tournament();
    const match = await createMatch(fx.tournamentId, {
      homeTeamId: fx.tournamentTeamHomeId,
      awayTeamId: fx.tournamentTeamAwayId,
    });
    await recordToss(match.id, {
      tossWinnerTeamId: fx.tournamentTeamHomeId,
      electedTo: "bat",
    });

    const scoring = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${match.id}/scoring`),
        params({ matchId: match.id }),
      ),
    );

    expect(scoring.status).toBe(200);
    expect(scoring.body.data.squadMin).toBe(2);
    expect(scoring.body.data.squadMax).toBe(15);
    expect(scoring.body.data.oversPerInningsFormula).toBe("2 * playersPerSide");
    expect(scoring.body.data.rosters.home).toHaveLength(3);
    expect(scoring.body.data.rosters.away).toHaveLength(0);
  });

  it("allows quick-add up to 15 players per side", async () => {
    const fx = await seedMjcaU9Tournament();
    const match = await createMatch(fx.tournamentId, {
      homeTeamId: fx.tournamentTeamHomeId,
      awayTeamId: fx.tournamentTeamAwayId,
    });
    await recordToss(match.id, {
      tossWinnerTeamId: fx.tournamentTeamHomeId,
      electedTo: "bat",
    });

    for (let i = 1; i <= 15; i++) {
      await addMatchPlayer(match.id, { side: "home", legalName: `Home ${i}` });
    }
    await expect(
      addMatchPlayer(match.id, { side: "home", legalName: "Home 16" }),
    ).rejects.toMatchObject({ code: "SQUAD_TOO_LARGE" });

    const homeSquad = await prisma.matchSquadPlayer.findMany({
      where: { matchId: match.id, teamId: fx.homeTeamId },
    });
    expect(homeSquad).toHaveLength(15);
  });

  it("confirms lineups with 2 players per side", async () => {
    const fx = await seedMjcaU9Tournament();
    const match = await createMatch(fx.tournamentId, {
      homeTeamId: fx.tournamentTeamHomeId,
      awayTeamId: fx.tournamentTeamAwayId,
    });
    await recordToss(match.id, {
      tossWinnerTeamId: fx.tournamentTeamHomeId,
      electedTo: "bat",
    });

    await addMatchPlayer(match.id, { side: "home", legalName: "A" });
    await addMatchPlayer(match.id, { side: "home", legalName: "B" });
    await addMatchPlayer(match.id, { side: "away", legalName: "C" });
    await addMatchPlayer(match.id, { side: "away", legalName: "D" });

    const confirm = await readJson(
      await confirmSquadsRoute(
        jsonRequest("POST", `/api/v1/matches/${match.id}/squad/confirm`, {}),
        params({ matchId: match.id }),
      ),
    );
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.totalOvers).toBe(4);
    const updated = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
    expect(updated.playersPerSide).toBe(2);
  });

  it("confirms lineups with 10 players per side and 20 overs", async () => {
    const fx = await seedMjcaU9Tournament();
    const match = await createMatch(fx.tournamentId, {
      homeTeamId: fx.tournamentTeamHomeId,
      awayTeamId: fx.tournamentTeamAwayId,
    });
    await recordToss(match.id, {
      tossWinnerTeamId: fx.tournamentTeamHomeId,
      electedTo: "bat",
    });

    for (let i = 1; i <= 10; i++) {
      await addMatchPlayer(match.id, { side: "home", legalName: `H${i}` });
      await addMatchPlayer(match.id, { side: "away", legalName: `A${i}` });
    }

    const confirm = await readJson(
      await confirmSquadsRoute(
        jsonRequest("POST", `/api/v1/matches/${match.id}/squad/confirm`, {}),
        params({ matchId: match.id }),
      ),
    );
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.totalOvers).toBe(20);
    const updated = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
    expect(updated.playersPerSide).toBe(10);
  });

  it("confirms lineups with 3 roster + 1 quick-add home and 4 quick-add away", async () => {
    const fx = await seedMjcaU9Tournament();
    const match = await createMatch(fx.tournamentId, {
      homeTeamId: fx.tournamentTeamHomeId,
      awayTeamId: fx.tournamentTeamAwayId,
    });
    await recordToss(match.id, {
      tossWinnerTeamId: fx.tournamentTeamHomeId,
      electedTo: "bat",
    });

    await setMatchSquad(match.id, {
      teamId: fx.homeTeamId,
      playerIds: fx.homePlayerIds,
    });
    await addMatchPlayer(match.id, { side: "home", legalName: "Ravi" });

    for (const name of ["Alex", "Ben", "Chris", "Dan"]) {
      await addMatchPlayer(match.id, { side: "away", legalName: name });
    }

    const confirm = await readJson(
      await confirmSquadsRoute(
        jsonRequest("POST", `/api/v1/matches/${match.id}/squad/confirm`, {
          totalOvers: 8,
        }),
        params({ matchId: match.id }),
      ),
    );
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.squadsConfirmedAt).toBeTruthy();

    const homeSquad = await prisma.matchSquadPlayer.findMany({
      where: { matchId: match.id, teamId: fx.homeTeamId },
    });
    const awaySquad = await prisma.matchSquadPlayer.findMany({
      where: { matchId: match.id, teamId: fx.awayTeamId },
    });
    expect(homeSquad).toHaveLength(4);
    expect(awaySquad).toHaveLength(4);
  });

  it("rejects confirm below profile minimum with coach-friendly message", async () => {
    const fx = await seedMjcaU9Tournament();
    const match = await createMatch(fx.tournamentId, {
      homeTeamId: fx.tournamentTeamHomeId,
      awayTeamId: fx.tournamentTeamAwayId,
    });
    await recordToss(match.id, {
      tossWinnerTeamId: fx.tournamentTeamHomeId,
      electedTo: "bat",
    });
    await addMatchPlayer(match.id, { side: "home", legalName: "Only one" });

    const confirm = await readJson(
      await confirmSquadsRoute(
        jsonRequest("POST", `/api/v1/matches/${match.id}/squad/confirm`, {}),
        params({ matchId: match.id }),
      ),
    );
    expect(confirm.status).toBe(400);
    expect(confirm.body.code).toBe("SQUAD_INCOMPLETE");
    expect(confirm.body.error).toContain("Test Hayes U9 needs 2 more players");
  });
});
