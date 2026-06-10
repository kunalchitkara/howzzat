import { describe, expect, it } from "vitest";
import {
  ageOnDate,
  isOverAgeGroup,
  parseAgeGroupCap,
} from "@/lib/scoring/age-eligibility";

describe("age eligibility", () => {
  it("parses U9/U10 from tournament labels", () => {
    expect(parseAgeGroupCap("U9")).toBe(9);
    expect(parseAgeGroupCap("Girls U11")).toBe(11);
    expect(parseAgeGroupCap("Summer")).toBeNull();
  });

  it("flags players above the age cap", () => {
    const on = new Date("2026-06-01");
    const dobU9Ok = new Date("2017-06-01"); // 9 on match day
    const dobU9Over = new Date("2016-06-01"); // 10 on match day
    expect(isOverAgeGroup(dobU9Ok, 9, on)).toBe(false);
    expect(isOverAgeGroup(dobU9Over, 9, on)).toBe(true);
    expect(ageOnDate(dobU9Over, on)).toBe(10);
  });
});
