import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@howzzat/db";
import { resetDatabase, seedTestFixtures } from "@howzzat/db/testing";
import {
  createMatch,
  createInnings,
  recordDelivery,
  getMatchScorecard,
  finalizeMatchInnings,
} from "@/lib/services/matches";

describe("matches and scoring service", () => {
  let fixtures: Awaited<ReturnType<typeof seedTestFixtures>>;

  beforeEach(async () => {
    await resetDatabase(prisma);
    fixtures = await seedTestFixtures(prisma);
  });

  it("creates match and records deliveries with correct totals", async () => {
    const match = await createMatch(fixtures.tournamentId, {
      homeTeamId: fixtures.tournamentTeamAId,
      awayTeamId: fixtures.tournamentTeamBId,
      playersPerSide: 8,
    });

    const innings = await createInnings(match.id, {
      battingTeamId: fixtures.tournamentTeamAId,
      inningsNumber: 1,
    });

    const [striker, nonStriker, bowler] = fixtures.playerIds;

    const r1 = await recordDelivery({
      inningsId: innings.id,
      overNumber: 1,
      ballInOver: 1,
      runsOffBat: 4,
      extrasRuns: 0,
      strikerId: striker!,
      nonStrikerId: nonStriker!,
      bowlerId: bowler!,
    });
    expect(r1.totals.totalRuns).toBe(204);
    expect(r1.totals.batRuns).toBe(4);

    const r2 = await recordDelivery({
      inningsId: innings.id,
      overNumber: 1,
      ballInOver: 2,
      runsOffBat: 0,
      extrasRuns: 0,
      wicketType: "bowled",
      strikerId: striker!,
      nonStrikerId: nonStriker!,
      bowlerId: bowler!,
      dismissedBatsmanId: striker!,
    });
    expect(r2.totals.totalRuns).toBe(199); // 204 - 5 wicket
    expect(r2.totals.wickets).toBe(1);
    expect(r2.totals.netRuns).toBe(-1); // 4 - 5

    const updated = await prisma.innings.findUnique({
      where: { id: innings.id },
    });
    expect(updated?.totalRuns).toBe(199);

    const liveMatch = await prisma.match.findUnique({ where: { id: match.id } });
    expect(liveMatch?.status).toBe("LIVE");
  });

  it("rejects invalid delivery (bat runs > 6)", async () => {
    const match = await createMatch(fixtures.tournamentId, {
      homeTeamId: fixtures.tournamentTeamAId,
      awayTeamId: fixtures.tournamentTeamBId,
    });
    const innings = await createInnings(match.id, {
      battingTeamId: fixtures.tournamentTeamAId,
      inningsNumber: 1,
    });
    const [striker, nonStriker, bowler] = fixtures.playerIds;

    await expect(
      recordDelivery({
        inningsId: innings.id,
        overNumber: 1,
        ballInOver: 1,
        runsOffBat: 7,
        extrasRuns: 0,
        strikerId: striker!,
        nonStrikerId: nonStriker!,
        bowlerId: bowler!,
      }),
    ).rejects.toThrow("Bat runs cannot exceed 6");
  });

  it("builds scorecard from deliveries", async () => {
    const match = await createMatch(fixtures.tournamentId, {
      homeTeamId: fixtures.tournamentTeamAId,
      awayTeamId: fixtures.tournamentTeamBId,
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
      runsOffBat: 2,
      extrasRuns: 0,
      strikerId: striker!,
      nonStrikerId: nonStriker!,
      bowlerId: bowler!,
    });

    const scorecard = await getMatchScorecard(match.id);
    expect(scorecard.inningsScorecards).toHaveLength(1);
    expect(scorecard.inningsScorecards[0]?.computed.totalRuns).toBe(202);
  });

  it("finalizes match with completed status", async () => {
    const match = await createMatch(fixtures.tournamentId, {
      homeTeamId: fixtures.tournamentTeamAId,
      awayTeamId: fixtures.tournamentTeamBId,
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
      runsOffBat: 1,
      extrasRuns: 0,
      strikerId: striker!,
      nonStrikerId: nonStriker!,
      bowlerId: bowler!,
    });

    const finalized = await finalizeMatchInnings(match.id);
    expect(finalized.status).toBe("COMPLETED");
    expect(finalized.homeScore).toBe(201);
  });
});
