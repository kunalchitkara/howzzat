import { describe, expect, it } from "vitest";
import { formatBallLabel, formatOverHeading } from "@/lib/scoring/ball-label";

describe("formatBallLabel", () => {
  it("uses zero-based over for balls 1–5", () => {
    expect(formatBallLabel(1, 1)).toBe("0.1");
    expect(formatBallLabel(1, 5)).toBe("0.5");
    expect(formatBallLabel(20, 1)).toBe("19.1");
    expect(formatBallLabel(20, 5)).toBe("19.5");
  });

  it("uses N.0 for the 6th ball of each over", () => {
    expect(formatBallLabel(1, 6)).toBe("1.0");
    expect(formatBallLabel(2, 6)).toBe("2.0");
    expect(formatBallLabel(20, 6)).toBe("20.0");
  });
});

describe("formatOverHeading", () => {
  it("uses ordinal over labels", () => {
    expect(formatOverHeading(1)).toBe("1st Over");
    expect(formatOverHeading(2)).toBe("2nd Over");
    expect(formatOverHeading(3)).toBe("3rd Over");
    expect(formatOverHeading(4)).toBe("4th Over");
    expect(formatOverHeading(11)).toBe("11th Over");
    expect(formatOverHeading(21)).toBe("21st Over");
  });
});
