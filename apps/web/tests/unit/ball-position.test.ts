import { describe, expect, it } from "vitest";
import { formatBallLabel } from "@/lib/scoring/ball-label";
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

function legalDeliveries(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    overNumber: Math.floor(i / 6) + 1,
    ballInOver: (i % 6) + 1,
    isLegalBall: true,
  }));
}

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
    const row = {
      overNumber: 1,
      ballInOver: 1,
      bowlerId: "b1",
      isLegalBall: true,
    };
    expect(currentOverBowler([], next)).toEqual({ locked: false, bowlerId: null });
    expect(currentOverBowler([row], next)).toEqual({
      locked: true,
      bowlerId: "b1",
    });
  });

  it("keeps bowler locked on illegal ball in same over", () => {
    const next = { overNumber: 2, ballInOver: 4 };
    expect(
      currentOverBowler(
        [
          {
            overNumber: 2,
            ballInOver: 3,
            bowlerId: "b1",
            isLegalBall: true,
          },
          {
            overNumber: 2,
            ballInOver: 3,
            bowlerId: "b1",
            isLegalBall: false,
          },
        ],
        next,
      ),
    ).toEqual({ locked: true, bowlerId: "b1" });
  });

  it("unlocks bowler at start of a new over", () => {
    const next = { overNumber: 2, ballInOver: 1 };
    expect(
      currentOverBowler(
        [
          {
            overNumber: 1,
            ballInOver: 6,
            bowlerId: "b1",
            isLegalBall: true,
          },
        ],
        next,
      ),
    ).toEqual({ locked: false, bowlerId: null });
  });

  it("detects innings complete", () => {
    const deliveries = Array.from({ length: 95 }, () => ({
      isLegalBall: true,
    }));
    expect(isInningsComplete(deliveries, 16)).toBe(true);
    expect(isInningsComplete(deliveries.slice(0, 94), 16)).toBe(false);
  });

  it("last ball reflects bowled delivery not next", () => {
    const last = lastBallAfterDeliveries([
      { overNumber: 1, ballInOver: 6, isLegalBall: true },
    ]);
    expect(last).toEqual({ overNumber: 1, ballInOver: 6 });
  });

  it("formats overs spare", () => {
    expect(oversToSpare(4, 18)).toBe("0.5");
    expect(formatOversFromLegalBalls(18)).toBe("3.0");
  });

  it("caps MJCA innings before the final N.0 marker ball", () => {
    expect(maxLegalBalls(1)).toBe(6);
    expect(maxLegalBalls(2)).toBe(11);
    expect(maxLegalBalls(4)).toBe(23);
    expect(maxLegalBalls(16)).toBe(95);

    const eleven = legalDeliveries(11);
    expect(isInningsComplete(eleven, 2)).toBe(true);
    expect(canAcceptDelivery(eleven, 2, true).ok).toBe(false);
    expect(canAcceptDelivery(eleven.slice(0, 10), 2, true).ok).toBe(true);
  });

  it("2-over innings: last scorable prompt is MJCA 1.5 (over 2 ball 5)", () => {
    const ten = legalDeliveries(10);
    const next = nextBallAfterDeliveries(ten, 2);
    expect(next).toEqual({ overNumber: 2, ballInOver: 5 });
    expect(formatBallLabel(next.overNumber, next.ballInOver)).toBe("1.5");
    expect(isInningsComplete(ten, 2)).toBe(false);

    const eleven = legalDeliveries(11);
    expect(isInningsComplete(eleven, 2)).toBe(true);
    expect(formatBallLabel(2, 5)).toBe("1.5");
    expect(formatBallLabel(2, 6)).toBe("2.0");
  });

  it("U9 wides count toward the six balls in an over", () => {
    const deliveries = [
      ...legalDeliveries(6),
      { overNumber: 2, ballInOver: 1, isLegalBall: true },
      { overNumber: 2, ballInOver: 2, isLegalBall: true },
      { overNumber: 2, ballInOver: 3, isLegalBall: true },
      { overNumber: 2, ballInOver: 4, isLegalBall: true },
      { overNumber: 2, ballInOver: 5, isLegalBall: true },
      { overNumber: 2, ballInOver: 6, isLegalBall: true },
    ];
    expect(nextBallAfterDeliveries(deliveries, 4)).toEqual({
      overNumber: 3,
      ballInOver: 1,
    });
  });

  it("rebowled extras repeat the ball until a counting delivery", () => {
    const deliveries = [
      ...legalDeliveries(3),
      { overNumber: 1, ballInOver: 4, isLegalBall: false },
      { overNumber: 1, ballInOver: 4, isLegalBall: false },
      { overNumber: 1, ballInOver: 4, isLegalBall: true },
    ];
    expect(nextBallAfterDeliveries(deliveries, 16)).toEqual({
      overNumber: 1,
      ballInOver: 5,
    });
  });
});
