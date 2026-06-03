import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDatabase, seedTestFixtures } from "@howzzat/db";
import {
  createMatch,
  createInnings,
  recordDelivery,
  setMatchSquad,
} from "@/lib/services/matches";
import { getMatchScoringContext } from "@/lib/services/scoring";

describe("scoring context service", () => {
  let fixtures: Awaited<ReturnType<typeof seedTestFixtures>>;

  beforeEach(async () => {
    await resetDatabase(prisma);
    fixtures = await seedTestFixtures(prisma);
  });

  it("returns setup state before innings", async () => {
    const match = await createMatch(fixtures.tournamentId, {
      homeTeamId: fixtures.tournamentTeamAId,
      awayTeamId: fixtures.tournamentTeamBId,
      playersPerSide: 8,
    });

    const ctx = await getMatchScoringContext(match.id);
    expect(ctx.activeInningsId).toBeNull();
    expect(ctx.canStartInnings?.inningsNumber).toBe(1);
    expect(ctx.totalOvers).toBe(16);
    expect(ctx.squads.home.length).toBeGreaterThan(0);
  });

  it("tracks active innings and totals after deliveries", async () => {
    const match = await createMatch(fixtures.tournamentId, {
      homeTeamId: fixtures.tournamentTeamAId,
      awayTeamId: fixtures.tournamentTeamBId,
      playersPerSide: 8,
    });

    await setMatchSquad(match.id, {
      teamId: fixtures.teamAId,
      playerIds: fixtures.playerIds,
    });

    const innings = await createInnings(match.id, {
      battingTeamId: fixtures.tournamentTeamAId,
      inningsNumber: 1,
    });

    const [striker, nonStriker, bowler] = fixtures.playerIds;
    await recordDelivery({
      inningsId: innings.id,
      overNumber: 1,
      ballInOver: 1,
      runsOffBat: 4,
      extrasRuns: 0,
      strikerId: striker!,
      nonStrikerId: nonStriker!,
      bowlerId: bowler!,
    });

    const ctx = await getMatchScoringContext(match.id);
    expect(ctx.activeInningsId).toBe(innings.id);
    expect(ctx.innings[0]?.totalRuns).toBe(204);
    expect(ctx.innings[0]?.nextBall).toEqual({ overNumber: 1, ballInOver: 2 });
  });
});
