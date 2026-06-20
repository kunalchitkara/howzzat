import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@howzzat/db";
import { resetDatabase, seedTestFixtures } from "@howzzat/db/testing";
import {
  createMatch,
  createInnings,
  recordDelivery,
  recordToss,
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

    await setMatchSquad(match.id, {
      teamId: fixtures.teamAId,
      playerIds: fixtures.playerIds,
    });

    const beforeToss = await getMatchScoringContext(match.id);
    expect(beforeToss.activeInningsId).toBeNull();
    expect(beforeToss.canStartInnings).toBeNull();

    await recordToss(match.id, {
      tossWinnerTeamId: fixtures.tournamentTeamAId,
      tossCallerPlayerId: fixtures.playerIds[0]!,
      electedTo: "bat",
    });

    await prisma.match.update({
      where: { id: match.id },
      data: { squadsConfirmedAt: new Date() },
    });

    const ctx = await getMatchScoringContext(match.id);
    expect(ctx.canStartInnings?.inningsNumber).toBe(1);
    expect(ctx.canStartInnings?.battingTeamId).toBe(fixtures.tournamentTeamAId);
    // Home squad has 4 players from fixtures; overs follow lineup count (2 × players).
    expect(ctx.totalOvers).toBe(8);
    expect(ctx.squads.home.length).toBeGreaterThan(0);
  });

  it("returns isCaptain for the match squad captain", async () => {
    const match = await createMatch(fixtures.tournamentId, {
      homeTeamId: fixtures.tournamentTeamAId,
      awayTeamId: fixtures.tournamentTeamBId,
      playersPerSide: 8,
    });

    const captainId = fixtures.playerIds[0]!;
    await setMatchSquad(match.id, {
      teamId: fixtures.teamAId,
      playerIds: fixtures.playerIds,
      captainId,
    });

    const ctx = await getMatchScoringContext(match.id);
    const captain = ctx.squads.home.find((p) => p.id === captainId);
    expect(captain?.isCaptain).toBe(true);
    expect(ctx.squads.home.filter((p) => p.isCaptain)).toHaveLength(1);
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

    await recordToss(match.id, {
      tossWinnerTeamId: fixtures.tournamentTeamAId,
      tossCallerPlayerId: fixtures.playerIds[0]!,
      electedTo: "bat",
    });

    await prisma.match.update({
      where: { id: match.id },
      data: { squadsConfirmedAt: new Date() },
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
    expect(ctx.innings[0]?.lastBall).toEqual({ overNumber: 1, ballInOver: 1 });
    expect(ctx.innings[0]?.displayOvers).toBe("0.1");
    expect(ctx.innings[0]?.bowlerLocked).toBe(true);
    expect(ctx.innings[0]?.lockedBowlerId).toBe(bowler);
  });
});
