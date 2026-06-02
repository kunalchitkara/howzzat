import type {
  DeliveryEvent,
  InningsConfig,
  InningsState,
  InningsTotals,
  RulesProfile,
} from "./types.js";

export function createInningsState(
  profile: RulesProfile,
  config: InningsConfig,
): InningsState {
  return {
    config,
    deliveries: [],
    totalRuns: profile.startingScore,
    wickets: 0,
    batRuns: 0,
    extras: 0,
  };
}

function isLastOver(overNumber: number, totalOvers: number): boolean {
  return overNumber >= totalOvers;
}

function getExtraRule(
  profile: RulesProfile,
  type: "wide" | "noBall",
  overNumber: number,
  totalOvers: number,
) {
  const block = type === "wide" ? profile.scoring.wide : profile.scoring.noBall;
  return isLastOver(overNumber, totalOvers) ? block.lastOver : block.default;
}

/** Validate a delivery before persisting. */
export function validateDelivery(
  state: InningsState,
  event: DeliveryEvent,
  profile: RulesProfile,
): { ok: true } | { ok: false; error: string } {
  const { totalOvers } = state.config;
  if (event.overNumber < 1 || event.overNumber > totalOvers) {
    return { ok: false, error: `Over ${event.overNumber} out of range 1–${totalOvers}` };
  }
  if (event.runsOffBat < profile.scoring.runsOffBat.min) {
    return { ok: false, error: "Negative bat runs not allowed" };
  }
  if (event.runsOffBat > profile.scoring.runsOffBat.max) {
    return {
      ok: false,
      error: `Bat runs cannot exceed ${profile.scoring.runsOffBat.max}`,
    };
  }
  return { ok: true };
}

/** Apply one delivery and return new innings state (immutable). */
export function applyDelivery(
  state: InningsState,
  event: DeliveryEvent,
  profile: RulesProfile,
): InningsState {
  const validation = validateDelivery(state, event, profile);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  let runsDelta = event.runsOffBat;
  let batRunsDelta = event.runsOffBat;
  let extrasDelta = 0;
  let wicketsDelta = 0;

  if (event.extrasType === "wide" || event.extrasType === "wide_runs") {
    const rule = getExtraRule(
      profile,
      "wide",
      event.overNumber,
      state.config.totalOvers,
    );
    const wideRuns = rule.runs + (event.extrasType === "wide_runs" ? event.extrasRuns : 0);
    extrasDelta += wideRuns;
    runsDelta += wideRuns - (event.extrasType === "wide_runs" ? 0 : 0);
    if (event.extrasType === "wide") {
      extrasDelta = rule.runs;
      runsDelta = event.runsOffBat + rule.runs;
      batRunsDelta = event.runsOffBat;
    }
  }

  if (event.extrasType === "no_ball" || event.extrasType === "no_ball_runs") {
    const rule = getExtraRule(
      profile,
      "noBall",
      event.overNumber,
      state.config.totalOvers,
    );
    if (event.extrasType === "no_ball") {
      extrasDelta += rule.runs;
      runsDelta = event.runsOffBat + rule.runs;
      batRunsDelta = event.runsOffBat;
    } else {
      extrasDelta += rule.runs + event.extrasRuns;
      runsDelta += rule.runs + event.extrasRuns;
    }
  }

  if (event.extrasType === "bye" || event.extrasType === "leg_bye") {
    extrasDelta += event.extrasRuns;
    runsDelta += event.extrasRuns;
  }

  if (event.wicketType) {
    wicketsDelta = 1;
    runsDelta -= profile.wicketPenalty;
  }

  const totalRuns = state.totalRuns + runsDelta;
  const batRuns = state.batRuns + batRunsDelta;
  const extras = state.extras + extrasDelta;

  return {
    ...state,
    deliveries: [...state.deliveries, event],
    totalRuns,
    wickets: state.wickets + wicketsDelta,
    batRuns,
    extras,
  };
}

/** Replay all deliveries with a given rules profile (for backfill). */
export function replayInnings(
  profile: RulesProfile,
  config: InningsConfig,
  deliveries: DeliveryEvent[],
): InningsState {
  let state = createInningsState(profile, config);
  for (const d of deliveries) {
    state = applyDelivery(state, d, profile);
  }
  return state;
}

export function finalizeInnings(
  state: InningsState,
  profile: RulesProfile,
): InningsTotals {
  const legalDeliveries = state.deliveries.filter((d) => d.isLegalBall);
  const oversBowled = legalDeliveries.length
    ? Math.max(...legalDeliveries.map((d) => d.overNumber))
    : 0;
  const netRuns = state.batRuns - profile.wicketPenalty * state.wickets;

  return {
    totalRuns: state.totalRuns,
    wickets: state.wickets,
    batRuns: state.batRuns,
    netRuns,
    oversBowled,
  };
}

export function netRuns(batRuns: number, wickets: number, profile: RulesProfile): number {
  return batRuns - profile.wicketPenalty * wickets;
}
