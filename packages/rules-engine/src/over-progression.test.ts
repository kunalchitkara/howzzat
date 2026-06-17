import { describe, expect, it } from "vitest";
import { getBuiltinProfile } from "./profiles.js";
import {
  countOverProgressBalls,
  extraRebowls,
  isEndOfOverDelivery,
  resolveDeliveryIsLegalBall,
} from "./over-progression.js";
import type { DeliveryEvent } from "./types.js";

const u9 = getBuiltinProfile("u9-softball-london-v1")!;
const hardball = getBuiltinProfile("mjca-girls-u17-hardball-v1")!;

function ball(
  partial: Partial<DeliveryEvent> & Pick<DeliveryEvent, "overNumber">,
): DeliveryEvent {
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

describe("extraRebowls", () => {
  it("U9 default overs: wides and no-balls do not rebowl", () => {
    expect(extraRebowls(u9, "wide", 1, 16)).toBe(false);
    expect(extraRebowls(u9, "no_ball", 3, 16)).toBe(false);
  });

  it("U9 last over: wides and no-balls rebowl", () => {
    expect(extraRebowls(u9, "wide", 16, 16)).toBe(true);
    expect(extraRebowls(u9, "no_ball", 16, 16)).toBe(true);
  });

  it("hardball: wides rebowl in every over", () => {
    expect(extraRebowls(hardball, "wide", 1, 20)).toBe(true);
    expect(extraRebowls(hardball, "no_ball", 20, 20)).toBe(true);
  });
});

describe("resolveDeliveryIsLegalBall", () => {
  it("marks U9 wides as legal (count toward over)", () => {
    expect(
      resolveDeliveryIsLegalBall(
        { overNumber: 2, extrasType: "wide" },
        u9,
        16,
        false,
      ),
    ).toBe(true);
    expect(
      resolveDeliveryIsLegalBall(
        { overNumber: 2, extrasType: "wide_runs" },
        u9,
        16,
        false,
      ),
    ).toBe(true);
  });

  it("marks rebowled wides as illegal", () => {
    expect(
      resolveDeliveryIsLegalBall(
        { overNumber: 16, extrasType: "wide" },
        u9,
        16,
        false,
      ),
    ).toBe(false);
    expect(
      resolveDeliveryIsLegalBall(
        { overNumber: 1, extrasType: "wide" },
        hardball,
        20,
        false,
      ),
    ).toBe(false);
  });
});

describe("over progression with U9 wides", () => {
  it("ends over after six deliveries including wides", () => {
    const deliveries = [
      ball({ overNumber: 2, ballInOver: 1, runsOffBat: 4 }),
      ball({ overNumber: 2, ballInOver: 2, runsOffBat: 1 }),
      ball({
        overNumber: 2,
        ballInOver: 3,
        isLegalBall: true,
        extrasType: "wide",
      }),
      ball({
        overNumber: 2,
        ballInOver: 4,
        isLegalBall: true,
        extrasType: "wide_runs",
        extrasRuns: 2,
      }),
      ball({
        overNumber: 2,
        ballInOver: 5,
        wicketType: "bowled",
        dismissedBatsmanId: "s1",
      }),
      ball({ overNumber: 2, ballInOver: 6, extrasType: "leg_bye", extrasRuns: 3 }),
    ];
    expect(countOverProgressBalls(deliveries, u9, 16)).toBe(6);
    expect(
      isEndOfOverDelivery(deliveries[deliveries.length - 1]!, u9, 16),
    ).toBe(true);
  });
});
