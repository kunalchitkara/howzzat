import { describe, expect, it } from "vitest";
import { getBuiltinProfile } from "@howzzat/rules-engine";
import { nextBallAfterDeliveries } from "@/lib/scoring/ball-position";
import { resolveScoringIsLegalBall } from "@/lib/scoring/delivery-legal";

const u9Extras = getBuiltinProfile("u9-softball-london-v1")!.scoring;

describe("U9 over progression", () => {
  it("resolves wides as legal balls outside the last over", () => {
    expect(
      resolveScoringIsLegalBall(
        { overNumber: 2, extrasType: "wide" },
        { wide: u9Extras.wide, noBall: u9Extras.noBall },
        16,
        false,
      ),
    ).toBe(true);
  });

  it("advances after six deliveries when wides count in the over", () => {
    const overTwo = [
      ...Array.from({ length: 6 }, (_, i) => ({
        overNumber: 1,
        ballInOver: i + 1,
        isLegalBall: true,
      })),
      { overNumber: 2, ballInOver: 1, isLegalBall: true },
      { overNumber: 2, ballInOver: 2, isLegalBall: true },
      { overNumber: 2, ballInOver: 3, isLegalBall: true },
      { overNumber: 2, ballInOver: 4, isLegalBall: true },
      { overNumber: 2, ballInOver: 5, isLegalBall: true },
      { overNumber: 2, ballInOver: 6, isLegalBall: true },
    ];
    expect(nextBallAfterDeliveries(overTwo, 16)).toEqual({
      overNumber: 3,
      ballInOver: 1,
    });
  });

  it("simulates a full over with two wides ending after six counting balls", () => {
    type Row = {
      overNumber: number;
      ballInOver: number;
      isLegalBall: boolean;
      extrasType?: "wide" | "wide_runs";
    };
    const deliveries: Row[] = [];
    const extras = { wide: u9Extras.wide, noBall: u9Extras.noBall };

    function record(partial: {
      runsOffBat?: number;
      extrasType?: "wide" | "wide_runs";
      extrasRuns?: number;
      wicketType?: string;
    }) {
      const next = nextBallAfterDeliveries(deliveries, 4);
      const isLegalBall = resolveScoringIsLegalBall(
        { overNumber: next.overNumber, extrasType: partial.extrasType },
        extras,
        4,
        partial.extrasType ? false : true,
      );
      deliveries.push({ ...next, isLegalBall, extrasType: partial.extrasType });
    }

    for (let i = 0; i < 6; i++) record({ runsOffBat: 1 });

    record({ runsOffBat: 4 });
    record({ runsOffBat: 1 });
    record({ extrasType: "wide" });
    record({ extrasType: "wide_runs", extrasRuns: 2 });
    record({ wicketType: "bowled" });
    record({ runsOffBat: 1 });

    expect(deliveries.filter((d) => d.overNumber === 2)).toHaveLength(6);
    expect(deliveries.every((d) => d.isLegalBall)).toBe(true);
    expect(nextBallAfterDeliveries(deliveries, 4)).toEqual({
      overNumber: 3,
      ballInOver: 1,
    });
  });
});
