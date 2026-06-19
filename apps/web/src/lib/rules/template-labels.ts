/** Minimal config shape for rules template picker labels and descriptions. */
export type RulesTemplateLabelConfig = {
  format?: string;
  startingScore?: number;
  wicketPenalty?: number;
  league?: { ballType?: string; ageGroup?: string };
  scoring?: {
    wide?: { default?: { runs?: number; rebowl?: boolean } };
    noBall?: { default?: { runs?: number; rebowl?: boolean } };
  };
};

const DEMO_BUILTIN_PREFIX = "demo-";

/** Demo-only profiles (iOS/U9 reset flows) — hidden from tournament picker. */
export function isDemoRulesTemplate(builtinId: string | null | undefined): boolean {
  return builtinId?.startsWith(DEMO_BUILTIN_PREFIX) ?? false;
}

/** Dropdown option: profile name only (no overs or squad size). */
export function templateOptionLabel(name: string): string {
  return name;
}

function formatExtra(name: string, runs?: number, rebowl?: boolean): string | null {
  if (runs == null) return null;
  return rebowl ? `${name} ${runs}, rebowl` : `${name} ${runs}`;
}

/** Rules-focused blurb for the template picker (scoring behaviour, not match length). */
export function rulesTemplateDescription(
  config: RulesTemplateLabelConfig | undefined,
  fallback?: string | null,
): string {
  if (!config) return fallback ?? "";

  const parts: string[] = [];

  if (config.format === "pairs_single_innings") parts.push("Pairs innings");
  else if (config.format === "standard_innings") parts.push("Standard innings");

  const ball = config.league?.ballType;
  if (ball) parts.push(ball);

  if (config.startingScore != null && config.startingScore > 0) {
    parts.push(`${config.startingScore} start`);
  }
  if (config.wicketPenalty != null && config.wicketPenalty > 0) {
    parts.push(`−${config.wicketPenalty} per wicket`);
  }

  const wide = formatExtra(
    "Wides",
    config.scoring?.wide?.default?.runs,
    config.scoring?.wide?.default?.rebowl,
  );
  const noBall = formatExtra(
    "No-balls",
    config.scoring?.noBall?.default?.runs,
    config.scoring?.noBall?.default?.rebowl,
  );
  if (wide) parts.push(wide);
  if (noBall) parts.push(noBall);

  return parts.length > 0 ? parts.join(" · ") : (fallback ?? "");
}
