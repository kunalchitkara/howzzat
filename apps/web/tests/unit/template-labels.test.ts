import { describe, expect, it } from "vitest";
import {
  formatOversSummary,
  templateOptionLabel,
} from "@/lib/rules/template-labels";

describe("rules template labels", () => {
  it("describes MJCA pairs as overs per player", () => {
    expect(
      formatOversSummary({
        oversPerInnings: { formula: "2 * playersPerSide" },
        playersPerSide: { default: 8 },
        pairOvers: 4,
      }),
    ).toBe("2 overs/player (8 players → 16 total)");
  });

  it("describes iOS demo as overs per player", () => {
    expect(
      formatOversSummary({
        oversPerInnings: { formula: "playersPerSide" },
        playersPerSide: { default: 2 },
        pairOvers: 2,
      }),
    ).toBe("2 overs/player (2 players → 2 total)");
  });

  it("describes fixed-length demo pairs as overs per pair", () => {
    expect(
      formatOversSummary({
        oversPerInnings: { formula: "fixed:4" },
        playersPerSide: { default: 4 },
        pairOvers: 4,
      }),
    ).toBe("4 overs/pair (4 players)");
  });

  it("builds full dropdown option label", () => {
    expect(
      templateOptionLabel("Demo — 2 overs per player (iOS)", {
        oversPerInnings: { formula: "playersPerSide" },
        playersPerSide: { default: 2 },
        pairOvers: 2,
      }),
    ).toBe("Demo — 2 overs per player (iOS) — 2 overs/player (2 players → 2 total)");
  });
});
