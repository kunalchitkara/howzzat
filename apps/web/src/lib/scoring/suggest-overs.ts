import type { RulesProfile } from "@howzzat/rules-engine";

/** Suggest innings length from squad size and rules (e.g. 10 players → 20 overs). */
export function suggestOversForSquad(
  profile: RulesProfile,
  squadSize: number,
  matchOvers?: number | null,
): number {
  if (matchOvers != null && matchOvers > 0) return matchOvers;
  const formula = profile.oversPerInnings.formula;
  if (formula.startsWith("fixed:")) {
    return Number(formula.slice("fixed:".length));
  }
  if (formula === "2 * playersPerSide") {
    return Math.max(2, squadSize) * 2;
  }
  return Math.max(2, squadSize) * 2;
}
