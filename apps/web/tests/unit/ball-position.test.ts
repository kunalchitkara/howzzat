import { describe, expect, it } from "vitest";
import {
  canAcceptDelivery,
  currentOverBowler,
  formatOversFromLegalBalls,
  isInningsComplete,
  lastBallAfterDeliveries,
  maxLegalBalls,
  nextBallAfterDeliveries,
  oversToSpare,
} from "@/lib/scoring/ball-position";

describe("ball position", () => {
  it("starts at 1.1 with no deliveries", () => {
    expect(nextBallAfterDeliveries([], 16)).toEqual({
      overNumber: 1,
      ballInOver: 1,
    });
  });

  it("advances after a legal ball", () => {
    const next = nextBallAfterDeliveries(
      [{ overNumber: 1, ballInOver: 1, isLegalBall: true }],
      16,
    );
    expect(next).toEqual({ overNumber: 1, ballInOver: 2 });
  });

  it("repeats ball on illegal delivery", () => {
    const next = nextBallAfterDeliveries(
      [{ overNumber: 2, ballInOver: 4, isLegalBall: false }],
      16,
    );
    expect(next).toEqual({ overNumber: 2, ballInOver: 4 });
  });

  it("locks bowler after first delivery in an over", () => {
    const next = { overNumber: 1, ballInOver: 2 };
    expect(currentOverBowler([], next)).toEqual({ locked: false, bowlerId: null });
    expect(
      currentOverBowler([{ overNumber: 1, bowlerId: "b1" }], next),
    ).toEqual({ locked: true, bowlerId: "b1" });
  });

  it("keeps bowler locked on illegal ball in same over", () => {
    const next = { overNumber: 2, ballInOver: 4 };
    expect(
      currentOverBowler(
        [
          { overNumber: 2, bowlerId: "b1" },
          { overNumber: 2, bowlerId: "b1" },
        ],
        next,
      ),
    ).toEqual({ locked: true, bowlerId: "b1" });
  });

  it("unlocks bowler at start of a new over", () => {
    const next = { overNumber: 2, ballInOver: 1 };
    expect(
      currentOverBowler([{ overNumber: 1, bowlerId: "b1" }], next),
    ).toEqual({ locked: false, bowlerId: null });
  });

  it("detects innings complete", () => {
    const deliveries = Array.from({ length: 96 }, () => ({
      isLegalBall: true,
    }));
    expect(isInningsComplete(deliveries, 16)).toBe(true);
    expect(isInningsComplete(deliveries.slice(0, 95), 16)).toBe(false);
  });

  it("last ball reflects bowled delivery not next", () => {
    const last = lastBallAfterDeliveries([
      { overNumber: 1, ballInOver: 6, isLegalBall: true },
    ]);
    expect(last).toEqual({ overNumber: 1, ballInOver: 6 });
  });

  it("formats overs spare", () => {
    expect(oversToSpare(4, 18)).toBe("1.0");
    expect(formatOversFromLegalBalls(18)).toBe("3.0");
  });

  it("caps innings at totalOvers * 6 legal balls", () => {
    expect(maxLegalBalls(2)).toBe(12);
    const twelve = Array.from({ length: 12 }, () => ({ isLegalBall: true }));
    expect(isInningsComplete(twelve, 2)).toBe(true);
    expect(canAcceptDelivery(twelve, 2, true).ok).toBe(false);
    expect(canAcceptDelivery(twelve, 2, false).ok).toBe(false);
    expect(canAcceptDelivery(twelve.slice(0, 11), 2, true).ok).toBe(true);
    expect(canAcceptDelivery(twelve.slice(0, 11), 2, false).ok).toBe(true);
  });
});
