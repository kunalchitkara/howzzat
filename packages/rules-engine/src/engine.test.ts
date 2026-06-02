import { describe, expect, it } from "vitest";
import {
  applyDelivery,
  createInningsState,
  finalizeInnings,
  netRuns,
  replayInnings,
} from "./engine.js";
import { getBuiltinProfile, resolveInningsConfig } from "./profiles.js";
import { applyRuleChange } from "./rule-changes.js";
import type { DeliveryEvent } from "./types.js";

const profile = getBuiltinProfile("u9-softball-london-v1")!;

describe("u9-softball-london-v1", () => {
  it("loads builtin profile", () => {
    expect(profile.startingScore).toBe(200);
    expect(profile.wicketPenalty).toBe(5);
  });

  it("resolves 8-player = 16 overs", () => {
    const cfg = resolveInningsConfig(profile, 8);
    expect(cfg.totalOvers).toBe(16);
    expect(cfg.pairCount).toBe(4);
  });

  it("starts innings at 200", () => {
    const cfg = resolveInningsConfig(profile, 8);
    const state = createInningsState(profile, {
      playersPerSide: cfg.playersPerSide,
      totalOvers: cfg.totalOvers,
    });
    expect(state.totalRuns).toBe(200);
  });

  it("applies dot ball with no score change", () => {
    const cfg = resolveInningsConfig(profile, 8);
    let state = createInningsState(profile, {
      playersPerSide: cfg.playersPerSide,
      totalOvers: cfg.totalOvers,
    });
    const event: DeliveryEvent = {
      overNumber: 1,
      ballInOver: 1,
      isLegalBall: true,
      runsOffBat: 0,
      extrasRuns: 0,
      strikerId: "p1",
      nonStrikerId: "p2",
      bowlerId: "b1",
    };
    state = applyDelivery(state, event, profile);
    expect(state.totalRuns).toBe(200);
    expect(state.batRuns).toBe(0);
  });

  it("applies 4 runs off the bat", () => {
    const cfg = resolveInningsConfig(profile, 8);
    let state = createInningsState(profile, {
      playersPerSide: cfg.playersPerSide,
      totalOvers: cfg.totalOvers,
    });
    state = applyDelivery(
      state,
      {
        overNumber: 1,
        ballInOver: 1,
        isLegalBall: true,
        runsOffBat: 4,
        extrasRuns: 0,
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: "b1",
      },
      profile,
    );
    expect(state.totalRuns).toBe(204);
    expect(state.batRuns).toBe(4);
  });

  it("applies wicket penalty of 5", () => {
    const cfg = resolveInningsConfig(profile, 8);
    let state = createInningsState(profile, {
      playersPerSide: cfg.playersPerSide,
      totalOvers: cfg.totalOvers,
    });
    state = applyDelivery(
      state,
      {
        overNumber: 1,
        ballInOver: 1,
        isLegalBall: true,
        runsOffBat: 0,
        extrasRuns: 0,
        wicketType: "bowled",
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: "b1",
        dismissedBatsmanId: "p1",
      },
      profile,
    );
    expect(state.totalRuns).toBe(195);
    expect(state.wickets).toBe(1);
  });

  it("computes net runs per Edgware convention", () => {
    expect(netRuns(17, 3, profile)).toBe(2); // Ariyan-style: 17 - 15
    expect(netRuns(8, 0, profile)).toBe(8);
  });

  it("finalizes innings totals", () => {
    const cfg = resolveInningsConfig(profile, 8);
    const deliveries: DeliveryEvent[] = [
      {
        overNumber: 1,
        ballInOver: 1,
        isLegalBall: true,
        runsOffBat: 6,
        extrasRuns: 0,
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: "b1",
      },
      {
        overNumber: 1,
        ballInOver: 2,
        isLegalBall: true,
        runsOffBat: 0,
        extrasRuns: 0,
        wicketType: "caught",
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: "b1",
        dismissedBatsmanId: "p1",
      },
    ];
    const state = replayInnings(
      profile,
      { playersPerSide: cfg.playersPerSide, totalOvers: cfg.totalOvers },
      deliveries,
    );
    const totals = finalizeInnings(state, profile);
    expect(totals.batRuns).toBe(6);
    expect(totals.wickets).toBe(1);
    expect(totals.netRuns).toBe(1);
    expect(totals.totalRuns).toBe(201); // 200 + 6 - 5
  });
});

describe("rule changes", () => {
  it("supports BACKFILL replay with new wicket penalty", () => {
    const cfg = resolveInningsConfig(profile, 8);
    const config = {
      playersPerSide: cfg.playersPerSide,
      totalOvers: cfg.totalOvers,
    };
    const deliveries: DeliveryEvent[] = [
      {
        overNumber: 1,
        ballInOver: 1,
        isLegalBall: true,
        runsOffBat: 0,
        extrasRuns: 0,
        wicketType: "bowled",
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: "b1",
      },
    ];
    const stricter = { ...profile, wicketPenalty: 10 };
    const result = applyRuleChange(
      deliveries,
      config,
      profile,
      stricter,
      0,
      "BACKFILL",
    );
    expect(result.oldTotals.totalRuns).toBe(195);
    expect(result.newTotals.totalRuns).toBe(190);
  });
});
