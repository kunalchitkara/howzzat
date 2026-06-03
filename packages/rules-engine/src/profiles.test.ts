import { describe, expect, it } from "vitest";
import {
  getBuiltinProfile,
  listBuiltinProfiles,
  mergeProfile,
  resolveInningsConfig,
} from "./profiles.js";

const profile = getBuiltinProfile("u9-softball-london-v1")!;

describe("profiles", () => {
  it("lists builtin profiles", () => {
    expect(listBuiltinProfiles().length).toBeGreaterThan(0);
  });

  it("returns undefined for unknown profile", () => {
    expect(getBuiltinProfile("unknown")).toBeUndefined();
  });

  it("merges overrides without mutating base", () => {
    const merged = mergeProfile(profile, { wicketPenalty: 10 });
    expect(merged.wicketPenalty).toBe(10);
    expect(profile.wicketPenalty).toBe(5);
  });

  it("resolves 10-player = 20 overs and 5 pairs", () => {
    const cfg = resolveInningsConfig(profile, 10);
    expect(cfg.totalOvers).toBe(20);
    expect(cfg.pairCount).toBe(5);
  });

  it("clamps players below minimum", () => {
    const cfg = resolveInningsConfig(profile, 4);
    expect(cfg.playersPerSide).toBe(8);
    expect(cfg.totalOvers).toBe(16);
  });
});
