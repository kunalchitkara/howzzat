import { describe, expect, it } from "vitest";
import {
  DEFAULT_FEE_PER_PLAYER_PENCE,
  hasMinimumScoringBalance,
  matchChargePence,
  MIN_BALANCE_TO_SCORE_PENCE,
} from "@howzzat/shared";
import {
  assertTournamentCanStartScoring,
  isTournamentBillingWaived,
  resolveFeePerPlayerPence,
} from "@/lib/services/tournament-billing";
import { ApiError } from "@/lib/api/http";

describe("billing constants", () => {
  it("uses £2.50 minimum to start scoring", () => {
    expect(MIN_BALANCE_TO_SCORE_PENCE).toBe(250);
    expect(hasMinimumScoringBalance(250)).toBe(true);
    expect(hasMinimumScoringBalance(249)).toBe(false);
  });

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

  it("blocks scoring below £2.50", () => {
    expect(() =>
      assertTournamentCanStartScoring({
        balancePence: 100,
        billingFreeUntil: null,
      }),
    ).toThrow(ApiError);

    expect(() =>
      assertTournamentCanStartScoring({
        balancePence: 250,
        billingFreeUntil: null,
      }),
    ).not.toThrow();
  });

  it("skips balance check when billing waived", () => {
    const future = new Date(Date.now() + 86_400_000);
    expect(() =>
      assertTournamentCanStartScoring({
        balancePence: 0,
        billingFreeUntil: future,
      }),
    ).not.toThrow();
  });
});
