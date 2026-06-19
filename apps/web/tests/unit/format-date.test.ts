import { describe, expect, it } from "vitest";
import { dateInputValue, formatFixtureDate } from "@/lib/format-date";

describe("formatFixtureDate", () => {
  it("formats UTC dates readably", () => {
    expect(formatFixtureDate(new Date("2026-06-19T10:00:00.000Z"))).toBe(
      "19 Jun 2026",
    );
  });

  it("returns null for missing dates", () => {
    expect(formatFixtureDate(null)).toBeNull();
  });

  it("builds date input values", () => {
    expect(dateInputValue(new Date("2026-06-19T10:00:00.000Z"))).toBe("2026-06-19");
  });
});
