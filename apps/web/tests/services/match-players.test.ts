import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@howzzat/db";
import { resetDatabase, seedTestFixtures } from "@howzzat/db/testing";
import { POST as addMatchPlayerRoute } from "@/app/api/v1/matches/[matchId]/players/route";
import {
  addMatchPlayer,
  createMatch,
  recordToss,
} from "@/lib/services/matches";
import { getMatchScoringContext } from "@/lib/services/scoring";
import { jsonRequest, params, readJson } from "../helpers/request";

describe("match quick-add players", () => {
  let fixtures: Awaited<ReturnType<typeof seedTestFixtures>>;

  beforeEach(async () => {
    await resetDatabase(prisma);
    fixtures = await seedTestFixtures(prisma);
  });

  async function matchWithToss() {
    const match = await createMatch(fixtures.tournamentId, {
      homeTeamId: fixtures.tournamentTeamAId,
      awayTeamId: fixtures.tournamentTeamBId,
      playersPerSide: 8,
    });
    await recordToss(match.id, {
      tossWinnerTeamId: fixtures.tournamentTeamAId,
      electedTo: "bat",
    });
    return match;
  }

  it("rejects duplicate player names on the same match side", async () => {
    const match = await matchWithToss();

    await addMatchPlayer(match.id, { side: "away", legalName: "Jamie" });
    await expect(
      addMatchPlayer(match.id, { side: "away", legalName: "  jamie  " }),
    ).rejects.toMatchObject({
      status: 400,
      code: "PLAYER_NAME_EXISTS",
      message: expect.stringContaining("Name already exists"),
    });

    const awaySquad = await prisma.matchSquadPlayer.findMany({
      where: { matchId: match.id, teamId: fixtures.teamBId },
      include: { player: true },
    });
    const jamies = awaySquad.filter(
      (s) => s.player.legalName.toLowerCase() === "jamie",
    );
    expect(jamies).toHaveLength(1);
  });

  it("allows the same name on opposite match sides", async () => {
    const match = await matchWithToss();

    await addMatchPlayer(match.id, { side: "home", legalName: "Alex" });
    await addMatchPlayer(match.id, { side: "away", legalName: "Alex" });

    const squad = await prisma.matchSquadPlayer.findMany({
      where: { matchId: match.id },
      include: { player: true },
    });
    const alexes = squad.filter(
      (s) => s.player.legalName.toLowerCase() === "alex",
    );
    expect(alexes).toHaveLength(1);

    const players = await prisma.player.findMany({
      where: { legalName: { equals: "Alex" } },
    });
    expect(players).toHaveLength(2);
  });

  it("rejects duplicate against players already in the away lineup", async () => {
    const match = await matchWithToss();

    await addMatchPlayer(match.id, { side: "away", legalName: "Alex" });

    await expect(
      addMatchPlayer(match.id, { side: "away", legalName: "Alex" }),
    ).rejects.toMatchObject({
      status: 400,
      code: "PLAYER_NAME_EXISTS",
    });
  });

  it("returns 400 from POST /matches/:id/players for duplicate names", async () => {
    const match = await matchWithToss();
    await addMatchPlayer(match.id, { side: "away", legalName: "Sam" });

    const res = await readJson(
      await addMatchPlayerRoute(
        jsonRequest("POST", `/api/v1/matches/${match.id}/players`, {
          side: "away",
          legalName: "sam",
        }),
        params({ matchId: match.id }),
      ),
    );

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      code: "PLAYER_NAME_EXISTS",
      error: expect.stringContaining("Name already exists"),
    });
  });

  it("creates club team membership for home quick-add without adding to match lineup", async () => {
    const match = await matchWithToss();

    await addMatchPlayer(match.id, { side: "home", legalName: "Jamie" });

    const membership = await prisma.teamMembership.findFirst({
      where: {
        active: true,
        player: { legalName: "Jamie" },
        team: { organizationId: fixtures.orgId },
      },
    });
    expect(membership).toBeTruthy();

    const matchSquad = await prisma.matchSquadPlayer.findFirst({
      where: { matchId: match.id, playerId: membership!.playerId },
    });
    expect(matchSquad).toBeNull();
  });

  it("does not create club membership for away quick-add", async () => {
    const match = await matchWithToss();

    await addMatchPlayer(match.id, { side: "away", legalName: "Opponent Kid" });

    const membership = await prisma.teamMembership.findFirst({
      where: {
        active: true,
        player: { legalName: "Opponent Kid" },
        team: { organizationId: fixtures.orgId },
      },
    });
    expect(membership).toBeNull();

    const matchOnly = await prisma.matchSquadPlayer.findFirst({
      where: {
        matchId: match.id,
        teamId: fixtures.teamBId,
        player: { legalName: "Opponent Kid" },
      },
      include: { player: true },
    });
    expect(matchOnly).toBeTruthy();
  });

  it("reuses existing club roster player on home quick-add", async () => {
    const match = await matchWithToss();

    await addMatchPlayer(match.id, { side: "home", legalName: "Alice" });

    const players = await prisma.player.findMany({
      where: { legalName: { equals: "Alice" } },
    });
    expect(players).toHaveLength(1);
    expect(players[0]!.id).toBe(fixtures.playerIds[0]);
  });

  it("shows home quick-add player on next match roster", async () => {
    const match1 = await matchWithToss();
    await addMatchPlayer(match1.id, { side: "home", legalName: "Future Star" });

    const match2 = await createMatch(fixtures.tournamentId, {
      homeTeamId: fixtures.tournamentTeamAId,
      awayTeamId: fixtures.tournamentTeamBId,
      playersPerSide: 8,
    });
    await recordToss(match2.id, {
      tossWinnerTeamId: fixtures.tournamentTeamAId,
      electedTo: "bat",
    });

    const ctx = await getMatchScoringContext(match2.id);
    expect(ctx.rosters.home.map((p) => p.name)).toContain("Future Star");
  });
});
