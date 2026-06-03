import { describe, expect, it } from "vitest";
import {
  isInningsComplete,
  nextBallAfterDeliveries,
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

  it("detects innings complete", () => {
    const deliveries = Array.from({ length: 96 }, () => ({
      isLegalBall: true,
    }));
    expect(isInningsComplete(deliveries, 16)).toBe(true);
    expect(isInningsComplete(deliveries.slice(0, 95), 16)).toBe(false);
  });
});
