import type { DeliveryEvent, RuleChangeMode, RulesProfile } from "./types.js";
import { replayInnings } from "./engine.js";
import type { InningsConfig } from "./types.js";

export interface RuleVersionBinding {
  rulesProfileId: string;
  rulesJson: RulesProfile;
  effectiveFromDeliveryIndex: number;
}

/**
 * When a coach changes rules mid-tournament:
 * - FUTURE_ONLY: deliveries before change keep old rules; after use new rules.
 * - BACKFILL: replay entire innings (or match) with new rules from ball 1.
 */
export function applyRuleChange(
  deliveries: DeliveryEvent[],
  config: InningsConfig,
  oldProfile: RulesProfile,
  newProfile: RulesProfile,
  changeIndex: number,
  mode: RuleChangeMode,
): {
  replayedDeliveries: DeliveryEvent[];
  oldTotals: ReturnType<typeof replayInnings>;
  newTotals: ReturnType<typeof replayInnings>;
} {
  if (mode === "BACKFILL") {
    const newTotals = replayInnings(newProfile, config, deliveries);
    const oldTotals = replayInnings(oldProfile, config, deliveries);
    return {
      replayedDeliveries: deliveries,
      oldTotals,
      newTotals,
    };
  }

  // FUTURE_ONLY: split at changeIndex
  const before = deliveries.slice(0, changeIndex);
  const after = deliveries.slice(changeIndex);

  const beforeState = replayInnings(oldProfile, config, before);
  // Continue with new profile from same structural deliveries (re-validate)
  const newTotals = replayInnings(newProfile, config, deliveries);

  return {
    replayedDeliveries: deliveries,
    oldTotals: beforeState,
    newTotals,
  };
}

export function buildVersionTimeline(
  bindings: RuleVersionBinding[],
): RuleVersionBinding[] {
  return [...bindings].sort(
    (a, b) => a.effectiveFromDeliveryIndex - b.effectiveFromDeliveryIndex,
  );
}
