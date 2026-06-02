import type { RulesProfile } from "./types.js";
import u9SoftballLondonV1 from "../profiles/u9-softball-london-v1.json" with {
  type: "json",
};

const BUILTIN_PROFILES: Record<string, RulesProfile> = {
  "u9-softball-london-v1": u9SoftballLondonV1 as RulesProfile,
};

export function getBuiltinProfile(id: string): RulesProfile | undefined {
  return BUILTIN_PROFILES[id];
}

export function listBuiltinProfiles(): RulesProfile[] {
  return Object.values(BUILTIN_PROFILES);
}

/** Deep-merge overrides onto a base profile (for cloned tournament configs). */
export function mergeProfile(
  base: RulesProfile,
  overrides: Partial<RulesProfile>,
): RulesProfile {
  return {
    ...base,
    ...overrides,
    playersPerSide: { ...base.playersPerSide, ...overrides.playersPerSide },
    scoring: overrides.scoring
      ? { ...base.scoring, ...overrides.scoring }
      : base.scoring,
    dismissals: overrides.dismissals
      ? { ...base.dismissals, ...overrides.dismissals }
      : base.dismissals,
    display: overrides.display
      ? { ...base.display, ...overrides.display }
      : base.display,
  };
}

export function resolveOversPerInnings(
  profile: RulesProfile,
  playersPerSide: number,
): number {
  if (profile.oversPerInnings.formula === "2 * playersPerSide") {
    return 2 * playersPerSide;
  }
  throw new Error(`Unknown overs formula: ${profile.oversPerInnings.formula}`);
}

export function resolveInningsConfig(
  profile: RulesProfile,
  playersPerSide: number,
): { playersPerSide: number; totalOvers: number; pairCount: number } {
  const clamped = Math.min(
    profile.playersPerSide.max,
    Math.max(profile.playersPerSide.min, playersPerSide),
  );
  const totalOvers = resolveOversPerInnings(profile, clamped);
  const pairCount = totalOvers / profile.pairOvers;
  if (!Number.isInteger(pairCount)) {
    throw new Error(
      `Invalid pair config: ${totalOvers} overs / ${profile.pairOvers} per pair`,
    );
  }
  return { playersPerSide: clamped, totalOvers, pairCount };
}
