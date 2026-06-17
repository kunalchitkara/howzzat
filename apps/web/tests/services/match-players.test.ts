import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@howzzat/db";
import { resetDatabase, seedTestFixtures } from "@howzzat/db/testing";
import { POST as addMatchPlayerRoute } from "@/app/api/v1/matches/[matchId]/players/route";
import {
  addMatchPlayer,
  createMatch,
  recordToss,
} from "@/lib/services/matches";
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

    await addMatchPlayer(match.id, { side: "home", legalName: "Jamie" });
    await expect(
      addMatchPlayer(match.id, { side: "home", legalName: "  jamie  " }),
    ).rejects.toMatchObject({
      status: 400,
      code: "PLAYER_NAME_EXISTS",
      message: expect.stringContaining("Name already exists"),
    });

    const homeSquad = await prisma.matchSquadPlayer.findMany({
      where: { matchId: match.id, teamId: fixtures.teamAId },
      include: { player: true },
    });
    const jamies = homeSquad.filter(
      (s) => s.player.legalName.toLowerCase() === "jamie",
    );
    expect(jamies).toHaveLength(1);
  });

  it("allows the same name on opposite match sides", async () => {
    const match = await matchWithToss();

    await addMatchPlayer(match.id, { side: "home", legalName: "Alex" });
    await expect(
      addMatchPlayer(match.id, { side: "away", legalName: "Alex" }),
    ).resolves.toBeDefined();

    const squad = await prisma.matchSquadPlayer.findMany({
      where: { matchId: match.id },
      include: { player: true },
    });
    const alexes = squad.filter(
      (s) => s.player.legalName.toLowerCase() === "alex",
    );
    expect(alexes).toHaveLength(2);
  });

  it("rejects duplicate against roster players already in the lineup", async () => {
    const match = await matchWithToss();

    await prisma.matchSquadPlayer.create({
      data: {
        matchId: match.id,
        playerId: fixtures.playerIds[0]!,
        teamId: fixtures.teamAId,
        role: "player",
      },
    });

    await expect(
      addMatchPlayer(match.id, { side: "home", legalName: "Alice" }),
    ).rejects.toMatchObject({
      status: 400,
      code: "PLAYER_NAME_EXISTS",
    });
  });

  it("returns 400 from POST /matches/:id/players for duplicate names", async () => {
    const match = await matchWithToss();
    await addMatchPlayer(match.id, { side: "home", legalName: "Sam" });

    const res = await readJson(
      await addMatchPlayerRoute(
        jsonRequest("POST", `/api/v1/matches/${match.id}/players`, {
          side: "home",
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
});
