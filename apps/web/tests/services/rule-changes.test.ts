import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@howzzat/db";
import { resetDatabase, seedTestFixtures } from "@howzzat/db/testing";
import {
  previewTournamentRuleChange,
  applyTournamentRuleChange,
} from "@/lib/services/rule-changes";
import { createMatch, createInnings, recordDelivery } from "@/lib/services/matches";

describe("rule changes service", () => {
  let fixtures: Awaited<ReturnType<typeof seedTestFixtures>>;

  beforeEach(async () => {
    await resetDatabase(prisma);
    fixtures = await seedTestFixtures(prisma);
  });

  async function scoreOneWicketInnings() {
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
      runsOffBat: 0,
      extrasRuns: 0,
      wicketType: "bowled",
      strikerId: striker!,
      nonStrikerId: nonStriker!,
      bowlerId: bowler!,
      dismissedBatsmanId: striker!,
    });
    return { match, innings };
  }

  it("previews BACKFILL with higher wicket penalty", async () => {
    await scoreOneWicketInnings();
    const preview = await previewTournamentRuleChange(fixtures.tournamentId, {
      mode: "BACKFILL",
      overrides: { wicketPenalty: 10 },
    });
    expect(preview.before?.totalRuns).toBe(195);
    expect(preview.after?.totalRuns).toBe(190);
  });

  it("applies BACKFILL and updates stored innings totals", async () => {
    const { innings } = await scoreOneWicketInnings();
    await applyTournamentRuleChange(fixtures.tournamentId, {
      mode: "BACKFILL",
      overrides: { wicketPenalty: 10 },
    });
    const updated = await prisma.innings.findUnique({
      where: { id: innings.id },
    });
    expect(updated?.totalRuns).toBe(190);
  });

  it("applies FUTURE_ONLY and updates tournament rules version", async () => {
    await scoreOneWicketInnings();
    const result = await applyTournamentRuleChange(fixtures.tournamentId, {
      mode: "FUTURE_ONLY",
      overrides: { wicketPenalty: 8 },
    });
    expect(result.toVersionId).toBeDefined();
    const tournament = await prisma.tournament.findUnique({
      where: { id: fixtures.tournamentId },
    });
    expect(tournament?.rulesProfileVersionId).toBe(result.toVersionId);
  });
});
