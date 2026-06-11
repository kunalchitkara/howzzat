import { describe, expect, it } from "vitest";
import { strikeAfterDeliveries } from "@/lib/scoring/strike-state";
import type { DeliveryEvent } from "@howzzat/rules-engine";

describe("strikeAfterDeliveries", () => {
  it("rotates strike on odd runs", () => {
    const deliveries: DeliveryEvent[] = [
      {
        overNumber: 1,
        ballInOver: 1,
        isLegalBall: true,
        runsOffBat: 1,
        extrasRuns: 0,
        strikerId: "a",
        nonStrikerId: "b",
        bowlerId: "x",
      },
    ];
    expect(strikeAfterDeliveries(deliveries)?.strikerId).toBe("b");
  });
});
