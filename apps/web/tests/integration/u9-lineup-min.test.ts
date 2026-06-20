import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@howzzat/db";
import { resetDatabase } from "@howzzat/db/testing";
import { getBuiltinProfile } from "@howzzat/rules-engine";
import { GET as getScoring } from "@/app/api/v1/matches/[matchId]/scoring/route";
import { POST as confirmSquadsRoute } from "@/app/api/v1/matches/[matchId]/squad/confirm/route";
import { getMatchScoringContext } from "@/lib/services/scoring";
import { addNamedTeamToTournament } from "@/lib/services/tournaments";
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

  it("merges org U9 roster when enrolled home team has only part of the club squad", async () => {
    const fx = await seedMjcaU9Tournament();
    const benchTeam = await prisma.team.create({
      data: {
        organizationId: (await prisma.tournament.findUniqueOrThrow({
          where: { id: fx.tournamentId },
          select: { organizationId: true },
        })).organizationId,
        name: "U9 ECC Bench",
        slug: "u9-ecc-bench",
        ageGroup: "U9",
      },
    });
    for (const name of ["Ravi", "Sam"]) {
      const player = await prisma.player.create({ data: { legalName: name } });
      await prisma.teamMembership.create({
        data: { teamId: benchTeam.id, playerId: player.id, seasonLabel: "2026" },
      });
    }

    const match = await createMatch(fx.tournamentId, {
      homeTeamId: fx.tournamentTeamHomeId,
      awayTeamId: fx.tournamentTeamAwayId,
    });
    await setMatchSquad(match.id, {
      teamId: fx.homeTeamId,
      playerIds: fx.homePlayerIds.slice(0, 2),
      captainId: fx.homePlayerIds[0]!,
    });
    await recordToss(match.id, {
      tossWinnerTeamId: fx.tournamentTeamHomeId,
      electedTo: "bat",
    });

    const ctx = await getMatchScoringContext(match.id);
    expect(ctx.rosters.home.map((p) => p.name).sort()).toEqual(
      ["Avyaan", "Ravi", "Sam", "Taran", "Veer"],
    );
    expect(ctx.squads.home.map((p) => p.name).sort()).toEqual(["Taran", "Veer"]);
  });

  it("loads org U9 roster for home when tournament team is external name-only", async () => {
    const profile = getBuiltinProfile("mjca-u9-outdoor-v1")!;
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
      data: { name: "ECC", slug: "ecc-external-lineup-test" },
    });
    const mainU9 = await prisma.team.create({
      data: {
        organizationId: org.id,
        name: "Main U9",
        slug: "main-u9",
        ageGroup: "U9",
      },
    });
    const tournament = await prisma.tournament.create({
      data: {
        organizationId: org.id,
        name: "Test ECC U9",
        slug: "test-ecc-u9-external-lineup",
        ageGroup: "U9",
        rulesProfileVersionId: rulesVersion.id,
        isPublic: true,
        rulesBindings: { create: { rulesProfileVersionId: rulesVersion.id } },
      },
    });

    for (const name of ["Veer", "Taran", "Avyaan"]) {
      const player = await prisma.player.create({ data: { legalName: name } });
      await prisma.teamMembership.create({
        data: { teamId: mainU9.id, playerId: player.id, seasonLabel: "2026" },
      });
    }

    const ttHome = await addNamedTeamToTournament(tournament.id, "Test ECC U9");
    const ttAway = await addNamedTeamToTournament(tournament.id, "Test Hayes U9");
    expect(ttHome.team.slug.startsWith("ext-")).toBe(true);

    const match = await createMatch(tournament.id, {
      homeTeamId: ttHome.id,
      awayTeamId: ttAway.id,
    });
    await recordToss(match.id, {
      tossWinnerTeamId: ttHome.id,
      electedTo: "bat",
    });

    const scoring = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${match.id}/scoring`),
        params({ matchId: match.id }),
      ),
    );

    expect(scoring.status).toBe(200);
    expect(scoring.body.data.rosters.home.map((p: { name: string }) => p.name).sort()).toEqual(
      ["Avyaan", "Taran", "Veer"],
    );
    expect(scoring.body.data.rosters.away).toHaveLength(0);
  });

  it("loads org U9 roster when tournament ageGroup is null but rules profile is U9", async () => {
    const profile = getBuiltinProfile("mjca-u9-outdoor-v1")!;
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
      data: { name: "ECC", slug: "ecc-null-agegroup-lineup-test" },
    });
    const mainU9 = await prisma.team.create({
      data: {
        organizationId: org.id,
        name: "Main U9",
        slug: "main-u9-null-age",
        ageGroup: "U9",
      },
    });
    const tournament = await prisma.tournament.create({
      data: {
        organizationId: org.id,
        name: "Test ECC U9",
        slug: "test-ecc-u9-null-agegroup",
        ageGroup: null,
        rulesProfileVersionId: rulesVersion.id,
        isPublic: true,
        rulesBindings: { create: { rulesProfileVersionId: rulesVersion.id } },
      },
    });

    for (const name of ["Veer", "Taran"]) {
      const player = await prisma.player.create({ data: { legalName: name } });
      await prisma.teamMembership.create({
        data: { teamId: mainU9.id, playerId: player.id, seasonLabel: "2026" },
      });
    }

    const ttHome = await addNamedTeamToTournament(tournament.id, "Test ECC U9");
    const ttAway = await addNamedTeamToTournament(tournament.id, "Test Hayes U9");

    const match = await createMatch(tournament.id, {
      homeTeamId: ttHome.id,
      awayTeamId: ttAway.id,
    });
    await recordToss(match.id, {
      tossWinnerTeamId: ttHome.id,
      electedTo: "bat",
    });

    const scoring = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${match.id}/scoring`),
        params({ matchId: match.id }),
      ),
    );

    expect(scoring.status).toBe(200);
    expect(scoring.body.data.tournamentAgeGroup).toBe("U9");
    expect(scoring.body.data.rosters.home.map((p: { name: string }) => p.name).sort()).toEqual(
      ["Taran", "Veer"],
    );
  });

  it("loads org U9 roster when squad team ageGroup is null but name includes U9", async () => {
    const profile = getBuiltinProfile("mjca-u9-outdoor-v1")!;
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
      data: { name: "ECC", slug: "ecc-team-name-age-test" },
    });
    const mainU9 = await prisma.team.create({
      data: {
        organizationId: org.id,
        name: "Main U9",
        slug: "main-u9-no-age-field",
        ageGroup: null,
      },
    });
    const tournament = await prisma.tournament.create({
      data: {
        organizationId: org.id,
        name: "Test ECC U9",
        slug: "test-ecc-u9-team-name-age",
        ageGroup: "U9",
        rulesProfileVersionId: rulesVersion.id,
        isPublic: true,
        rulesBindings: { create: { rulesProfileVersionId: rulesVersion.id } },
      },
    });

    const player = await prisma.player.create({ data: { legalName: "Veer" } });
    await prisma.teamMembership.create({
      data: { teamId: mainU9.id, playerId: player.id, seasonLabel: "2026" },
    });

    const ttHome = await addNamedTeamToTournament(tournament.id, "Test ECC U9");
    const ttAway = await addNamedTeamToTournament(tournament.id, "Test Hayes U9");

    const match = await createMatch(tournament.id, {
      homeTeamId: ttHome.id,
      awayTeamId: ttAway.id,
    });
    await recordToss(match.id, {
      tossWinnerTeamId: ttHome.id,
      electedTo: "bat",
    });

    const ctx = await getMatchScoringContext(match.id);
    expect(ctx.rosters.home.map((p) => p.name)).toEqual(["Veer"]);
  });

  it("quick-add home creates club membership visible on next match roster", async () => {
    const fx = await seedMjcaU9Tournament();
    const match1 = await createMatch(fx.tournamentId, {
      homeTeamId: fx.tournamentTeamHomeId,
      awayTeamId: fx.tournamentTeamAwayId,
    });
    await recordToss(match1.id, {
      tossWinnerTeamId: fx.tournamentTeamHomeId,
      electedTo: "bat",
    });
    await addMatchPlayer(match1.id, { side: "home", legalName: "Club Kid" });

    const membership = await prisma.teamMembership.findFirst({
      where: {
        teamId: fx.homeTeamId,
        player: { legalName: "Club Kid" },
        active: true,
      },
    });
    expect(membership).toBeTruthy();

    const match2 = await createMatch(fx.tournamentId, {
      homeTeamId: fx.tournamentTeamHomeId,
      awayTeamId: fx.tournamentTeamAwayId,
    });
    await recordToss(match2.id, {
      tossWinnerTeamId: fx.tournamentTeamHomeId,
      electedTo: "bat",
    });
    const ctx = await getMatchScoringContext(match2.id);
    expect(ctx.rosters.home.map((p) => p.name)).toContain("Club Kid");
  });

  it("loads away roster from previous matches against the same opponent", async () => {
    const fx = await seedMjcaU9Tournament();
    const priorMatch = await createMatch(fx.tournamentId, {
      homeTeamId: fx.tournamentTeamHomeId,
      awayTeamId: fx.tournamentTeamAwayId,
    });
    await recordToss(priorMatch.id, {
      tossWinnerTeamId: fx.tournamentTeamHomeId,
      electedTo: "bat",
    });
    await addMatchPlayer(priorMatch.id, { side: "away", legalName: "Prior Alex" });
    await addMatchPlayer(priorMatch.id, { side: "away", legalName: "Prior Ben" });

    const rematch = await createMatch(fx.tournamentId, {
      homeTeamId: fx.tournamentTeamHomeId,
      awayTeamId: fx.tournamentTeamAwayId,
    });
    await recordToss(rematch.id, {
      tossWinnerTeamId: fx.tournamentTeamHomeId,
      electedTo: "bat",
    });

    const ctx = await getMatchScoringContext(rematch.id);
    expect(ctx.rosters.away.map((p) => p.name).sort()).toEqual([
      "Prior Alex",
      "Prior Ben",
    ]);
  });

  it("allows quick-add up to 15 players per away side", async () => {
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
      await addMatchPlayer(match.id, { side: "away", legalName: `Away ${i}` });
    }
    await expect(
      addMatchPlayer(match.id, { side: "away", legalName: "Away 16" }),
    ).rejects.toMatchObject({ code: "SQUAD_TOO_LARGE" });

    const awaySquad = await prisma.matchSquadPlayer.findMany({
      where: { matchId: match.id, teamId: fx.awayTeamId },
    });
    expect(awaySquad).toHaveLength(15);
  });

  it("allows 10+ club roster players while playing lineup stays capped", async () => {
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
      playerIds: fx.homePlayerIds.slice(0, 2),
    });

    for (let i = 1; i <= 13; i++) {
      await addMatchPlayer(match.id, { side: "home", legalName: `Bench ${i}` });
    }

    const memberships = await prisma.teamMembership.count({
      where: { teamId: fx.homeTeamId, active: true },
    });
    expect(memberships).toBeGreaterThanOrEqual(16);

    const lineup = await prisma.matchSquadPlayer.findMany({
      where: { matchId: match.id, teamId: fx.homeTeamId },
    });
    expect(lineup).toHaveLength(2);

    const benchPlayers = await prisma.player.findMany({
      where: { legalName: { startsWith: "Bench " } },
      orderBy: { legalName: "asc" },
    });
    const lineupIds = [...fx.homePlayerIds, ...benchPlayers.map((p) => p.id)];
    expect(lineupIds).toHaveLength(16);

    await setMatchSquad(match.id, {
      teamId: fx.homeTeamId,
      playerIds: lineupIds.slice(0, 15),
    });
    const lineup15 = await prisma.matchSquadPlayer.findMany({
      where: { matchId: match.id, teamId: fx.homeTeamId },
    });
    expect(lineup15).toHaveLength(15);
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

    await addMatchPlayer(match.id, { side: "away", legalName: "C" });
    await addMatchPlayer(match.id, { side: "away", legalName: "D" });
    await setMatchSquad(match.id, {
      teamId: fx.homeTeamId,
      playerIds: fx.homePlayerIds.slice(0, 2),
    });

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
      await addMatchPlayer(match.id, { side: "away", legalName: `A${i}` });
    }
    const homeIds: string[] = [];
    for (let i = 1; i <= 10; i++) {
      await addMatchPlayer(match.id, { side: "home", legalName: `H${i}` });
      const player = await prisma.player.findFirstOrThrow({
        where: { legalName: `H${i}` },
      });
      homeIds.push(player.id);
    }
    await setMatchSquad(match.id, { teamId: fx.homeTeamId, playerIds: homeIds });

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
    const ravi = await prisma.player.findFirstOrThrow({
      where: { legalName: "Ravi" },
    });
    await setMatchSquad(match.id, {
      teamId: fx.homeTeamId,
      playerIds: [...fx.homePlayerIds, ravi.id],
    });

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
    await setMatchSquad(match.id, {
      teamId: fx.homeTeamId,
      playerIds: [fx.homePlayerIds[0]!],
    });

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
