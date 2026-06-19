import { describe, expect, it } from "vitest";
import { getBuiltinProfile } from "@howzzat/rules-engine";
import { suggestOversForSquad } from "@/lib/scoring/suggest-overs";

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
