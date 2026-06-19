import type { RulesProfile } from "@howzzat/rules-engine";

/** Suggest innings length from squad size and rules formula (e.g. 10 players → 20 overs). */
export function suggestOversForFormula(formula: string, squadSize: number): number {
  if (formula.startsWith("fixed:")) {
    return Number(formula.slice("fixed:".length));
  }
  if (formula === "2 * playersPerSide") {
    return Math.max(2, squadSize) * 2;
  }
  if (formula === "playersPerSide") {
    return Math.max(2, squadSize);
  }
  return Math.max(2, squadSize) * 2;
}

/** Suggest innings length from squad size and rules (e.g. 10 players → 20 overs). */
export function suggestOversForSquad(
  profile: RulesProfile,
  squadSize: number,
  matchOvers?: number | null,
): number {
  if (matchOvers != null && matchOvers > 0) return matchOvers;
  return suggestOversForFormula(profile.oversPerInnings.formula, squadSize);
}
