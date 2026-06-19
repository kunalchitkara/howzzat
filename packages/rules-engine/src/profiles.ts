import type { RulesProfile } from "./types.js";
import u9SoftballLondonV1 from "../profiles/u9-softball-london-v1.json" with {
  type: "json",
};
import demo2OverPairsV1 from "../profiles/demo-2-over-pairs-v1.json" with {
  type: "json",
};
import demoU94OverV1 from "../profiles/demo-u9-4-over-v1.json" with {
  type: "json",
};
import mjcaU9OutdoorV1 from "../profiles/mjca-u9-outdoor-v1.json" with {
  type: "json",
};
import mjcaU10BoysPairsV1 from "../profiles/mjca-u10-boys-pairs-v1.json" with {
  type: "json",
};
import mjcaGirlsU10SoftballPairsV1 from "../profiles/mjca-girls-u10-softball-pairs-v1.json" with {
  type: "json",
};
import mjcaGirlsU11HardballPairsV1 from "../profiles/mjca-girls-u11-hardball-pairs-v1.json" with {
  type: "json",
};
import mjcaGirlsU12HardballPairsV1 from "../profiles/mjca-girls-u12-hardball-pairs-v1.json" with {
  type: "json",
};
import mjcaGirlsU13HardballV1 from "../profiles/mjca-girls-u13-hardball-v1.json" with {
  type: "json",
};
import mjcaGirlsU14HardballV1 from "../profiles/mjca-girls-u14-hardball-v1.json" with {
  type: "json",
};
import mjcaGirlsU15HardballV1 from "../profiles/mjca-girls-u15-hardball-v1.json" with {
  type: "json",
};
import mjcaGirlsU17HardballV1 from "../profiles/mjca-girls-u17-hardball-v1.json" with {
  type: "json",
};
import mjcaU17PremierV1 from "../profiles/mjca-u17-premier-v1.json" with {
  type: "json",
};
import mjcaOutdoorStandard20V1 from "../profiles/mjca-outdoor-standard-20-v1.json" with {
  type: "json",
};

const BUILTIN_PROFILES: Record<string, RulesProfile> = {
  "u9-softball-london-v1": u9SoftballLondonV1 as RulesProfile,
  "demo-2-over-pairs-v1": demo2OverPairsV1 as RulesProfile,
  "demo-u9-4-over-v1": demoU94OverV1 as RulesProfile,
  "mjca-u9-outdoor-v1": mjcaU9OutdoorV1 as RulesProfile,
  "mjca-u10-boys-pairs-v1": mjcaU10BoysPairsV1 as RulesProfile,
  "mjca-girls-u10-softball-pairs-v1": mjcaGirlsU10SoftballPairsV1 as RulesProfile,
  "mjca-girls-u11-hardball-pairs-v1": mjcaGirlsU11HardballPairsV1 as RulesProfile,
  "mjca-girls-u12-hardball-pairs-v1": mjcaGirlsU12HardballPairsV1 as RulesProfile,
  "mjca-girls-u13-hardball-v1": mjcaGirlsU13HardballV1 as RulesProfile,
  "mjca-girls-u14-hardball-v1": mjcaGirlsU14HardballV1 as RulesProfile,
  "mjca-girls-u15-hardball-v1": mjcaGirlsU15HardballV1 as RulesProfile,
  "mjca-girls-u17-hardball-v1": mjcaGirlsU17HardballV1 as RulesProfile,
  "mjca-u17-premier-v1": mjcaU17PremierV1 as RulesProfile,
  "mjca-outdoor-standard-20-v1": mjcaOutdoorStandard20V1 as RulesProfile,
};

export const MJCA_BUILTIN_PROFILE_IDS = Object.keys(BUILTIN_PROFILES).filter((id) =>
  id.startsWith("mjca-"),
);

export function getBuiltinProfile(id: string): RulesProfile | undefined {
  return BUILTIN_PROFILES[id];
}

export function listBuiltinProfiles(): RulesProfile[] {
  return Object.values(BUILTIN_PROFILES);
}

export function listMjcaProfiles(): RulesProfile[] {
  return MJCA_BUILTIN_PROFILE_IDS.map((id) => BUILTIN_PROFILES[id]!);
}

/** Deep-merge overrides onto a base profile (for cloned tournament configs). */
export function mergeProfile(
  base: RulesProfile,
  overrides: Partial<RulesProfile>,
): RulesProfile {
  const scoring = overrides.scoring
    ? {
        ...base.scoring,
        ...overrides.scoring,
        wide: overrides.scoring.wide
          ? {
              ...base.scoring.wide,
              ...overrides.scoring.wide,
              default: {
                ...base.scoring.wide.default,
                ...overrides.scoring.wide.default,
              },
              lastOver: {
                ...base.scoring.wide.lastOver,
                ...overrides.scoring.wide.lastOver,
              },
            }
          : base.scoring.wide,
        noBall: overrides.scoring.noBall
          ? {
              ...base.scoring.noBall,
              ...overrides.scoring.noBall,
              default: {
                ...base.scoring.noBall.default,
                ...overrides.scoring.noBall.default,
              },
              lastOver: {
                ...base.scoring.noBall.lastOver,
                ...overrides.scoring.noBall.lastOver,
              },
            }
          : base.scoring.noBall,
      }
    : base.scoring;

  return {
    ...base,
    ...overrides,
    playersPerSide: { ...base.playersPerSide, ...overrides.playersPerSide },
    oversPerInnings: overrides.oversPerInnings
      ? { ...base.oversPerInnings, ...overrides.oversPerInnings }
      : base.oversPerInnings,
    scoring,
    dismissals: overrides.dismissals
      ? { ...base.dismissals, ...overrides.dismissals }
      : base.dismissals,
    display: overrides.display
      ? { ...base.display, ...overrides.display }
      : base.display,
    league: overrides.league
      ? { ...base.league, ...overrides.league }
      : base.league,
  };
}

export function resolveOversPerInnings(
  profile: RulesProfile,
  playersPerSide: number,
): number {
  const formula = profile.oversPerInnings.formula;
  if (formula === "2 * playersPerSide") {
    return 2 * playersPerSide;
  }
  if (formula === "playersPerSide") {
    return playersPerSide;
  }
  if (formula.startsWith("fixed:")) {
    return Number(formula.slice("fixed:".length));
  }
  throw new Error(`Unknown overs formula: ${formula}`);
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
