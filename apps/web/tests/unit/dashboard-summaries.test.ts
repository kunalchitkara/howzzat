import { describe, expect, it } from "vitest";
import {
  formatMatchStatusSummary,
  formatPlayerCount,
  summarizeMatchStatuses,
} from "@/lib/dashboard/summaries";

describe("dashboard summaries", () => {
  it("counts scheduled, live, and played fixtures", () => {
    expect(
      summarizeMatchStatuses([
        { status: "SCHEDULED" },
        { status: "SCHEDULED" },
        { status: "LIVE" },
        { status: "COMPLETED" },
        { status: "WALKOVER" },
      ]),
    ).toEqual({
      scheduled: 2,
      ongoing: 1,
      played: 2,
      total: 5,
    });
  });

  it("formats match and player summaries", () => {
    expect(formatPlayerCount(12)).toBe("12 players");
    expect(formatPlayerCount(1)).toBe("1 player");
    expect(
      formatMatchStatusSummary({
        scheduled: 2,
        ongoing: 1,
        played: 3,
        total: 6,
      }),
    ).toBe("2 scheduled · 1 live · 3 played");
    expect(
      formatMatchStatusSummary({
        scheduled: 0,
        ongoing: 0,
        played: 0,
        total: 0,
      }),
    ).toBe("No fixtures yet");
  });
});
