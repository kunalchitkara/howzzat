import { describe, expect, it } from "vitest";
import { getBuiltinProfile } from "@howzzat/rules-engine";
import {
  suggestLineupOvers,
  suggestOversForFormula,
  suggestOversForSquad,
  suggestPairsOvers,
} from "@/lib/scoring/suggest-overs";

describe("suggestPairsOvers", () => {
  it("uses 2 overs per player when pairOvers is 4", () => {
    expect(suggestPairsOvers(2, 4)).toBe(4);
    expect(suggestPairsOvers(3, 4)).toBe(6);
    expect(suggestPairsOvers(10, 4)).toBe(20);
  });
});

describe("suggestOversForFormula", () => {
  it("doubles players for U9 pairs formula", () => {
    expect(suggestOversForFormula("2 * playersPerSide", 2, 4)).toBe(4);
    expect(suggestOversForFormula("2 * playersPerSide", 10, 4)).toBe(20);
  });

  it("uses pairOvers for playersPerSide formula", () => {
    expect(suggestOversForFormula("playersPerSide", 2, 2)).toBe(2);
    expect(suggestOversForFormula("playersPerSide", 2, 4)).toBe(4);
  });

  it("returns fixed overs unchanged", () => {
    expect(suggestOversForFormula("fixed:20", 10, 20)).toBe(20);
  });
});

describe("suggestLineupOvers", () => {
  it("scales with playing count on pairs profiles", () => {
    expect(suggestLineupOvers("fixed:4", 2, 4)).toBe(4);
    expect(suggestLineupOvers("fixed:4", 10, 4)).toBe(20);
    expect(suggestLineupOvers("2 * playersPerSide", 3, 4)).toBe(6);
  });

  it("keeps fixed overs on standard profiles", () => {
    expect(suggestLineupOvers("fixed:20", 11, 20)).toBe(20);
  });
});

describe("suggestOversForSquad", () => {
  it("suggests 20 overs for 10 players on pairs profile", () => {
    const profile = getBuiltinProfile("mjca-u9-outdoor-v1")!;
    expect(suggestOversForSquad(profile, 10)).toBe(20);
  });

  it("prefers match overs when already set", () => {
    const profile = getBuiltinProfile("mjca-u9-outdoor-v1")!;
    expect(suggestOversForSquad(profile, 10, 16)).toBe(16);
  });

  it("suggests 2 overs per player on iOS demo profile", () => {
    const profile = getBuiltinProfile("demo-2-over-pairs-v1")!;
    expect(suggestOversForSquad(profile, 2)).toBe(2);
  });
});
