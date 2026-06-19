import { describe, expect, it } from "vitest";
import {
  buildCommentaryMatchSummary,
  buildMatchSummary,
} from "@/lib/scorecard/match-summary";
import { edgwareM4DemoScorecard } from "@/lib/scorecard/demo-edgware-m4";

describe("match summary", () => {
  it("builds edgeware M4 style summary", () => {
    const summary = buildMatchSummary(edgwareM4DemoScorecard);
    expect(summary).not.toBeNull();
    expect(summary!.headline).toBe("Hayes won by 51 runs");
    expect(summary!.scores).toHaveLength(2);
    expect(summary!.scores[0]?.value).toBe(281);
    expect(summary!.scores[1]?.value).toBe(230);
    expect(summary!.highlights.some((h) => h.name === "Gurfateh")).toBe(true);
    expect(summary!.highlights.some((h) => h.name === "Veer")).toBe(true);
  });

  it("parent insights stay upbeat", () => {
    const summary = buildMatchSummary(edgwareM4DemoScorecard)!;
    expect(summary.parentInsights.length).toBeGreaterThanOrEqual(4);
    expect(
      summary.parentInsights.some(
        (i) =>
          i.title.includes("partnership") ||
          i.title.includes("Star") ||
          i.title.includes("fought"),
      ),
    ).toBe(true);
    const negativeTone = summary.parentInsights.some((i) =>
      /too many|weak pair|negative net|leaked/i.test(i.body),
    );
    expect(negativeTone).toBe(false);
  });

  it("coach insights are critical and data-led", () => {
    const summary = buildMatchSummary(edgwareM4DemoScorecard)!;
    expect(summary.coachInsights.length).toBeGreaterThanOrEqual(4);
    expect(
      summary.coachInsights.some(
        (i) =>
          i.title.includes("wickets") ||
          i.title.includes("Weak pair") ||
          i.title.includes("negative net") ||
          i.body.includes("Edgware"),
      ),
    ).toBe(true);
  });

  it("picks a varied coach set deterministically per match", () => {
    const a = buildMatchSummary(edgwareM4DemoScorecard)!;
    const b = buildMatchSummary(edgwareM4DemoScorecard)!;
    expect(a.coachInsights.map((i) => i.title)).toEqual(
      b.coachInsights.map((i) => i.title),
    );
  });

  it("commentary summary uses completed result for finished matches", () => {
    const summary = buildCommentaryMatchSummary(edgwareM4DemoScorecard)!;
    expect(summary.headline).toBe("Hayes won by 51 runs");
    expect(summary.marginValue).toBe("51 runs");
  });

  it("commentary summary shows live header for in-progress matches", () => {
    const live = {
      ...edgwareM4DemoScorecard,
      status: "LIVE",
      resultBanner: undefined,
      innings: [edgwareM4DemoScorecard.innings[0]!],
    };
    const summary = buildCommentaryMatchSummary(live)!;
    expect(summary.headline).toBe("Hayes 281/9");
    expect(summary.marginLabel).toBe("Status");
    expect(summary.marginValue).toBe("Live");
  });
});
