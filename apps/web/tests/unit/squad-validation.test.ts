import { describe, expect, it } from "vitest";
import {
  canConfirmLineup,
  describeLineupBlockers,
  describeSquadConfirmError,
} from "@/lib/scoring/squad-validation";

describe("squad validation messages", () => {
  it("describes a partial home lineup for U9 pairs (4 minimum)", () => {
    expect(
      describeLineupBlockers({
        homeTeamName: "U9 ECC",
        awayTeamName: "Test Hayes U9",
        homeCount: 3,
        awayCount: 0,
        min: 4,
        max: 10,
        awayRosterEmpty: true,
      }),
    ).toBe(
      "U9 ECC needs 1 more player (3 of 4 selected). Test Hayes U9 needs 4 players — type names in Add player below.",
    );
  });

  it("allows confirm when both sides meet profile minimum", () => {
    expect(canConfirmLineup(4, 4, 4, 10)).toBe(true);
    expect(
      describeLineupBlockers({
        homeTeamName: "U9 ECC",
        awayTeamName: "Test Hayes U9",
        homeCount: 4,
        awayCount: 4,
        min: 4,
        max: 10,
      }),
    ).toBe("");
  });

  it("describes too many players per side", () => {
    expect(
      describeSquadConfirmError({
        homeTeamName: "U9 ECC",
        awayTeamName: "Test Hayes U9",
        homeCount: 11,
        awayCount: 4,
        min: 4,
        max: 10,
      }),
    ).toBe("U9 ECC has 11 selected — maximum is 10.");
  });
});
