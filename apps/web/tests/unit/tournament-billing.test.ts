import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@howzzat/db";
import { resetDatabase, seedTestFixtures } from "@howzzat/db/testing";
import {
  DEFAULT_FEE_PER_PLAYER_PENCE,
  matchChargePence,
} from "@howzzat/shared";
import {
  chargeMatchAtFinalize,
  isTournamentBillingWaived,
  resolveFeePerPlayerPence,
} from "@/lib/services/tournament-billing";
import {
  confirmMatchSquads,
  createInnings,
  createMatch,
  finalizeMatchInnings,
  recordDelivery,
  recordToss,
  setMatchSquad,
} from "@/lib/services/matches";

describe("billing constants", () => {
  it("charges per squad player at default rate", () => {
    expect(matchChargePence(12, DEFAULT_FEE_PER_PLAYER_PENCE)).toBe(240);
    expect(matchChargePence(22, 20)).toBe(440);
  });
});

describe("tournament billing service", () => {
  it("resolves fee override", () => {
    expect(resolveFeePerPlayerPence({ feeOverridePence: null })).toBe(20);
    expect(resolveFeePerPlayerPence({ feeOverridePence: 15 })).toBe(15);
  });

  it("waives billing during promo window", () => {
    const future = new Date(Date.now() + 86_400_000);
    expect(isTournamentBillingWaived({ billingFreeUntil: future })).toBe(true);
    expect(isTournamentBillingWaived({ billingFreeUntil: null })).toBe(false);
  });
});

describe("charge at match finalize", () => {
  let fixtures: Awaited<ReturnType<typeof seedTestFixtures>>;

  beforeEach(async () => {
    await resetDatabase(prisma);
    fixtures = await seedTestFixtures(prisma);
    await prisma.tournament.update({
      where: { id: fixtures.tournamentId },
      data: { balancePence: 1000 },
    });
  });

  async function setupMatchWithSquads(playerCountPerSide = 8) {
    const match = await createMatch(fixtures.tournamentId, {
      homeTeamId: fixtures.tournamentTeamAId,
      awayTeamId: fixtures.tournamentTeamBId,
    });
    await recordToss(match.id, {
      tossWinnerTeamId: fixtures.tournamentTeamAId,
      electedTo: "bat",
    });

    const homePlayers: string[] = [];
    const awayPlayers: string[] = [];
    for (let i = 0; i < playerCountPerSide; i++) {
      const home = await prisma.player.create({
        data: { legalName: `Home ${i + 1}` },
      });
      await prisma.teamMembership.create({
        data: {
          teamId: fixtures.teamAId,
          playerId: home.id,
          seasonLabel: "2026",
        },
      });
      homePlayers.push(home.id);

      const away = await prisma.player.create({
        data: { legalName: `Away ${i + 1}` },
      });
      await prisma.teamMembership.create({
        data: {
          teamId: fixtures.teamBId,
          playerId: away.id,
          seasonLabel: "2026",
        },
      });
      awayPlayers.push(away.id);
    }

    await setMatchSquad(match.id, {
      teamId: fixtures.teamAId,
      playerIds: homePlayers,
    });
    await setMatchSquad(match.id, {
      teamId: fixtures.teamBId,
      playerIds: awayPlayers,
    });
    await confirmMatchSquads(match.id, { totalOvers: 4 });
    return { match, homePlayers, awayPlayers };
  }

  it("deducts wallet on finalize based on confirmed squad size", async () => {
    const { match, homePlayers } = await setupMatchWithSquads(8);
    const innings = await createInnings(match.id, {
      battingTeamId: fixtures.tournamentTeamAId,
      inningsNumber: 1,
    });
    const striker = homePlayers[0]!;
    const nonStriker = homePlayers[1]!;
    const bowler = homePlayers[2]!;
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

    await finalizeMatchInnings(match.id);

    const tournament = await prisma.tournament.findUniqueOrThrow({
      where: { id: fixtures.tournamentId },
    });
    const playerCount = 16;
    const expectedCharge = matchChargePence(playerCount, DEFAULT_FEE_PER_PLAYER_PENCE);
    expect(tournament.balancePence).toBe(1000 - expectedCharge);

    const ledger = await prisma.usageLedger.findUniqueOrThrow({
      where: { matchId: match.id },
    });
    expect(ledger.playerCount).toBe(playerCount);
    expect(ledger.amountPence).toBe(expectedCharge);
    expect(ledger.waived).toBe(false);
  });

  it("does not double-charge when finalize is retried", async () => {
    const { match } = await setupMatchWithSquads(8);
    await chargeMatchAtFinalize(match.id);
    await chargeMatchAtFinalize(match.id);

    const entries = await prisma.usageLedger.findMany({
      where: { matchId: match.id },
    });
    expect(entries).toHaveLength(1);
  });

  it("records charge but skips deduction when billing waived", async () => {
    await prisma.tournament.update({
      where: { id: fixtures.tournamentId },
      data: { billingFreeUntil: new Date(Date.now() + 86_400_000) },
    });
    const match = (await setupMatchWithSquads(8)).match;
    await chargeMatchAtFinalize(match.id);

    const tournament = await prisma.tournament.findUniqueOrThrow({
      where: { id: fixtures.tournamentId },
    });
    expect(tournament.balancePence).toBe(1000);

    const ledger = await prisma.usageLedger.findUniqueOrThrow({
      where: { matchId: match.id },
    });
    expect(ledger.waived).toBe(true);
  });
});
