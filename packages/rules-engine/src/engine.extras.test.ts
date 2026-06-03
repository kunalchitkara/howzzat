import { describe, expect, it } from "vitest";
import {
  applyDelivery,
  createInningsState,
  replayInnings,
  validateDelivery,
} from "./engine.js";
import { getBuiltinProfile, resolveInningsConfig } from "./profiles.js";
import { applyRuleChange } from "./rule-changes.js";
import type { DeliveryEvent, InningsState } from "./types.js";

const profile = getBuiltinProfile("u9-softball-london-v1")!;

function baseState(): InningsState {
  const cfg = resolveInningsConfig(profile, 8);
  return createInningsState(profile, {
    playersPerSide: cfg.playersPerSide,
    totalOvers: cfg.totalOvers,
  });
}

function ball(partial: Partial<DeliveryEvent> & Pick<DeliveryEvent, "overNumber">): DeliveryEvent {
  return {
    ballInOver: 1,
    isLegalBall: true,
    runsOffBat: 0,
    extrasRuns: 0,
    strikerId: "s1",
    nonStrikerId: "s2",
    bowlerId: "b1",
    ...partial,
  };
}

describe("validateDelivery", () => {
  it("rejects over beyond innings length", () => {
    const state = baseState();
    const result = validateDelivery(
      state,
      ball({ overNumber: 99 }),
      profile,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects bat runs above maximum", () => {
    const state = baseState();
    const result = validateDelivery(
      state,
      ball({ overNumber: 1, runsOffBat: 7 }),
      profile,
    );
    expect(result.ok).toBe(false);
  });
});

describe("extras scoring", () => {
  it("adds wide runs (+2 default)", () => {
    const state = applyDelivery(
      baseState(),
      ball({ overNumber: 1, extrasType: "wide", extrasRuns: 0 }),
      profile,
    );
    expect(state.totalRuns).toBe(202);
    expect(state.batRuns).toBe(0);
  });

  it("adds no-ball with bat runs", () => {
    const state = applyDelivery(
      baseState(),
      ball({
        overNumber: 1,
        extrasType: "no_ball",
        runsOffBat: 4,
        extrasRuns: 0,
      }),
      profile,
    );
    expect(state.totalRuns).toBe(206); // 200 + 2 NB + 4 bat
    expect(state.batRuns).toBe(4);
  });

  it("adds bye runs without bat credit", () => {
    const state = applyDelivery(
      baseState(),
      ball({ overNumber: 1, extrasType: "bye", extrasRuns: 2 }),
      profile,
    );
    expect(state.totalRuns).toBe(202);
    expect(state.batRuns).toBe(0);
  });

  it("uses last-over wide penalty (+1)", () => {
    const cfg = resolveInningsConfig(profile, 8);
    let state = createInningsState(profile, {
      playersPerSide: cfg.playersPerSide,
      totalOvers: cfg.totalOvers,
    });
    state = applyDelivery(
      state,
      ball({ overNumber: cfg.totalOvers, extrasType: "wide" }),
      profile,
    );
    expect(state.totalRuns).toBe(201);
  });
});

describe("rule changes FUTURE_ONLY", () => {
  it("splits replay at change index", () => {
    const cfg = resolveInningsConfig(profile, 8);
    const config = {
      playersPerSide: cfg.playersPerSide,
      totalOvers: cfg.totalOvers,
    };
    const deliveries: DeliveryEvent[] = [
      ball({ overNumber: 1, runsOffBat: 4 }),
      ball({ overNumber: 1, ballInOver: 2, wicketType: "bowled", dismissedBatsmanId: "s1" }),
    ];
    const stricter = { ...profile, wicketPenalty: 10 };
    const result = applyRuleChange(
      deliveries,
      config,
      profile,
      stricter,
      1,
      "FUTURE_ONLY",
    );
    expect(result.oldTotals.batRuns).toBe(4);
    expect(result.newTotals.totalRuns).toBe(194); // 200 + 4 - 10 (full replay with new penalty)
  });
});

describe("replay consistency", () => {
  it("matches sequential applyDelivery", () => {
    const cfg = resolveInningsConfig(profile, 8);
    const config = {
      playersPerSide: cfg.playersPerSide,
      totalOvers: cfg.totalOvers,
    };
    const events: DeliveryEvent[] = [
      ball({ overNumber: 1, runsOffBat: 1 }),
      ball({ overNumber: 1, ballInOver: 2, runsOffBat: 2 }),
      ball({ overNumber: 2, runsOffBat: 3 }),
    ];
    const replayed = replayInnings(profile, config, events);
    let sequential = createInningsState(profile, config);
    for (const e of events) {
      sequential = applyDelivery(sequential, e, profile);
    }
    expect(replayed.totalRuns).toBe(sequential.totalRuns);
    expect(replayed.batRuns).toBe(6);
  });
});
