import { describe, expect, it } from "vitest";
import type { DeliveryEvent } from "./types.js";
import {
  applyStrikeRotationsAfterDelivery,
  rotateStrikePair,
  shouldRotateStrike,
} from "./strike.js";

function ball(partial: Partial<DeliveryEvent>): DeliveryEvent {
  return {
    overNumber: 1,
    ballInOver: 1,
    isLegalBall: true,
    runsOffBat: 0,
    extrasRuns: 0,
    strikerId: "a",
    nonStrikerId: "b",
    bowlerId: "c",
    ...partial,
  };
}

describe("strike rotation", () => {
  it("rotates after a single", () => {
    expect(shouldRotateStrike(ball({ runsOffBat: 1 }))).toBe(true);
  });

  it("does not rotate after an even number of runs", () => {
    expect(shouldRotateStrike(ball({ runsOffBat: 2 }))).toBe(false);
    expect(shouldRotateStrike(ball({ runsOffBat: 4 }))).toBe(false);
  });

  it("rotates after odd byes on a legal ball", () => {
    expect(
      shouldRotateStrike(ball({ extrasType: "bye", extrasRuns: 3 })),
    ).toBe(true);
  });

  it("rotates after no-ball single off the bat", () => {
    expect(
      shouldRotateStrike(
        ball({ isLegalBall: false, extrasType: "no_ball", runsOffBat: 1 }),
      ),
    ).toBe(true);
  });

  it("swaps striker and non-striker", () => {
    expect(rotateStrikePair("Ariyan", "Krish")).toEqual(["Krish", "Ariyan"]);
  });

  it("rotates at end of over on the 6th legal ball", () => {
    const [s, ns] = applyStrikeRotationsAfterDelivery(
      "Ariyan",
      "Krish",
      ball({ ballInOver: 6, runsOffBat: 0 }),
      { rotateStrikeAfterWicket: true },
    );
    expect(s).toBe("Krish");
    expect(ns).toBe("Ariyan");
  });

  it("rotates after wicket under U9 rules", () => {
    const [s, ns] = applyStrikeRotationsAfterDelivery(
      "Ariyan",
      "Krish",
      ball({ wicketType: "bowled", dismissedBatsmanId: "a" }),
      { rotateStrikeAfterWicket: true },
    );
    expect(s).toBe("Krish");
    expect(ns).toBe("Ariyan");
  });

  it("double rotation on last-ball single returns striker to same end", () => {
    const [s, ns] = applyStrikeRotationsAfterDelivery(
      "Ariyan",
      "Krish",
      ball({ ballInOver: 6, runsOffBat: 1 }),
      { rotateStrikeAfterWicket: true },
    );
    expect(s).toBe("Ariyan");
    expect(ns).toBe("Krish");
  });
});
