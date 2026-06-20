import type { RulesProfile } from "@howzzat/rules-engine";

function clampedSquadSize(squadSize: number): number {
  return Math.max(2, squadSize);
}

/** Pairs profiles: total overs = (players ÷ 2) × pairOvers (= 2 overs per player when pairOvers is 4). */
export function suggestPairsOvers(playerCount: number, pairOvers: number): number {
  return clampedSquadSize(playerCount) * (pairOvers / 2);
}

/** Suggest innings length from squad size and rules formula (e.g. 10 players → 20 overs). */
export function suggestOversForFormula(
  formula: string,
  squadSize: number,
  pairOvers = 4,
): number {
  const players = clampedSquadSize(squadSize);
  if (formula.startsWith("fixed:")) {
    return Number(formula.slice("fixed:".length));
  }
  if (formula === "2 * playersPerSide") {
    return players * 2;
  }
  if (formula === "playersPerSide") {
    return suggestPairsOvers(players, pairOvers);
  }
  return players * 2;
}

/** Lineup UI: scale with playing count on pairs matches (U9: 2 overs per player). */
export function suggestLineupOvers(
  formula: string,
  squadSize: number,
  pairOvers: number,
): number {
  if (pairOvers <= 4) {
    return suggestPairsOvers(squadSize, pairOvers);
  }
  return suggestOversForFormula(formula, squadSize, pairOvers);
}

/** Suggest innings length from squad size and rules (e.g. 10 players → 20 overs). */
export function suggestOversForSquad(
  profile: RulesProfile,
  squadSize: number,
  matchOvers?: number | null,
): number {
  if (matchOvers != null && matchOvers > 0) return matchOvers;
  return suggestOversForFormula(
    profile.oversPerInnings.formula,
    squadSize,
    profile.pairOvers,
  );
}
