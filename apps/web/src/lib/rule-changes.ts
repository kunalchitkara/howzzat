/**
 * Server-side helpers for mid-tournament rule changes.
 * Coaches choose BACKFILL (replay all deliveries) or FUTURE_ONLY (from next ball).
 */
import type { RuleChangeMode } from "@howzzat/rules-engine";
import { applyRuleChange } from "@howzzat/rules-engine";
import type { DeliveryEvent, RulesProfile } from "@howzzat/rules-engine";

export interface ApplyTournamentRuleChangeInput {
  deliveries: DeliveryEvent[];
  inningsConfig: { playersPerSide: number; totalOvers: number };
  oldProfile: RulesProfile;
  newProfile: RulesProfile;
  changeDeliveryIndex: number;
  mode: RuleChangeMode;
}

export function previewRuleChange(input: ApplyTournamentRuleChangeInput) {
  const { oldTotals, newTotals } = applyRuleChange(
    input.deliveries,
    input.inningsConfig,
    input.oldProfile,
    input.newProfile,
    input.changeDeliveryIndex,
    input.mode,
  );
  return {
    before: {
      totalRuns: oldTotals.totalRuns,
      wickets: oldTotals.wickets,
      netRuns: oldTotals.batRuns - input.oldProfile.wicketPenalty * oldTotals.wickets,
    },
    after: {
      totalRuns: newTotals.totalRuns,
      wickets: newTotals.wickets,
      netRuns: newTotals.batRuns - input.newProfile.wicketPenalty * newTotals.wickets,
    },
  };
}
