/** Minimal config shape for rules template dropdown labels. */
export type RulesTemplateLabelConfig = {
  pairOvers?: number;
  playersPerSide?: { default?: number; min?: number; max?: number };
  oversPerInnings?: { formula?: string };
};

/** Human-readable overs summary for tournament template picker options. */
export function formatOversSummary(config: RulesTemplateLabelConfig | undefined): string {
  if (!config) return "";
  const formula = config.oversPerInnings?.formula;
  const def = config.playersPerSide?.default;

  if (formula === "2 * playersPerSide") {
    if (def != null) {
      return `2 overs/player (${def} players → ${2 * def} total)`;
    }
    return "2 overs/player";
  }

  if (formula === "playersPerSide") {
    const perPlayer = config.pairOvers ?? 2;
    if (def != null) {
      return `${perPlayer} overs/player (${def} players → ${def} total)`;
    }
    return `${perPlayer} overs/player`;
  }

  if (formula?.startsWith("fixed:")) {
    const fixed = Number(formula.slice("fixed:".length));
    if (config.pairOvers === fixed && def != null) {
      return `${fixed} overs/pair (${def} players)`;
    }
    return `${fixed} overs/innings`;
  }

  return "";
}

export function templateOptionLabel(
  name: string,
  config: RulesTemplateLabelConfig | undefined,
): string {
  const overs = formatOversSummary(config);
  if (overs) return `${name} — ${overs}`;
  return name;
}
