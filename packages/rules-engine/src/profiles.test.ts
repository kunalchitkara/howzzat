import { describe, expect, it } from "vitest";
import {
  getBuiltinProfile,
  listBuiltinProfiles,
  listMjcaProfiles,
  mergeProfile,
  MJCA_BUILTIN_PROFILE_IDS,
  resolveInningsConfig,
} from "./profiles.js";
import type { RulesProfile } from "./types.js";

const profile = getBuiltinProfile("u9-softball-london-v1")!;

describe("profiles", () => {
  it("lists builtin profiles", () => {
    expect(listBuiltinProfiles().length).toBeGreaterThanOrEqual(13);
  });

  it("returns undefined for unknown profile", () => {
    expect(getBuiltinProfile("unknown")).toBeUndefined();
  });

  it("merges overrides without mutating base", () => {
    const merged = mergeProfile(profile, { wicketPenalty: 10 });
    expect(merged.wicketPenalty).toBe(10);
    expect(profile.wicketPenalty).toBe(5);
  });

  it("merges nested scoring overrides", () => {
    const base = getBuiltinProfile("mjca-u9-outdoor-v1")!;
    const merged = mergeProfile(base, {
      scoring: { wide: { default: { runs: 3, rebowl: false } } },
    } as Partial<RulesProfile>);
    expect(merged.scoring.wide.default.runs).toBe(3);
    expect(base.scoring.wide.default.runs).toBe(2);
    expect(merged.scoring.wide.lastOver.runs).toBe(1);
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

describe("MJCA builtin templates", () => {
  it("registers all mjca-* profiles", () => {
    expect(MJCA_BUILTIN_PROFILE_IDS.length).toBe(11);
    expect(listMjcaProfiles().every((p) => p.league?.prefix === "mjca")).toBe(true);
  });

  it.each(MJCA_BUILTIN_PROFILE_IDS)("%s loads with valid innings config", (id) => {
    const p = getBuiltinProfile(id)!;
    expect(p.id).toBe(id);
    expect(p.league?.sourceUrl).toMatch(/^https:\/\/mjcacricket\.org\//);
    const players = p.playersPerSide.default;
    const cfg = resolveInningsConfig(p, players);
    expect(cfg.totalOvers).toBeGreaterThan(0);
    expect(cfg.pairCount).toBeGreaterThan(0);
  });

  it("mjca-u9 uses pairs formula", () => {
    const u9 = getBuiltinProfile("mjca-u9-outdoor-v1")!;
    expect(resolveInningsConfig(u9, 8).totalOvers).toBe(16);
    expect(resolveInningsConfig(u9, 10).totalOvers).toBe(20);
  });

  it("mjca standard innings use fixed 20 overs", () => {
    const std = getBuiltinProfile("mjca-outdoor-standard-20-v1")!;
    expect(resolveInningsConfig(std, 11).totalOvers).toBe(20);
    expect(std.format).toBe("standard_innings");
  });
});
