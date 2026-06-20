import { describe, expect, it } from "vitest";
import {
  isDemoRulesTemplate,
  rulesTemplateDescription,
  templateOptionLabel,
} from "@/lib/rules/template-labels";

describe("rules template labels", () => {
  it("returns profile name only in dropdown labels", () => {
    expect(templateOptionLabel("MJCA U9 Outdoor")).toBe("MJCA U9 Outdoor");
    expect(templateOptionLabel("Demo — 2 overs per player (iOS)")).toBe(
      "Demo — 2 overs per player (iOS)",
    );
  });

  it("identifies demo-only templates", () => {
    expect(isDemoRulesTemplate("demo-u9-4-over-v1")).toBe(true);
    expect(isDemoRulesTemplate("demo-2-over-pairs-v1")).toBe(true);
    expect(isDemoRulesTemplate("mjca-u9-outdoor-v1")).toBe(false);
    expect(isDemoRulesTemplate(null)).toBe(false);
  });

  it("builds rules-focused descriptions without overs or squad size", () => {
    expect(
      rulesTemplateDescription({
        format: "pairs_single_innings",
        startingScore: 200,
        wicketPenalty: 5,
        league: { ballType: "softball" },
        scoring: {
          wide: { default: { runs: 2, rebowl: false } },
          noBall: { default: { runs: 2, rebowl: false } },
        },
      }),
    ).toBe(
      "Pairs innings · softball · 200 start · −5 per wicket · Wides 2 · No-balls 2",
    );
  });

  it("falls back to stored description when config is empty", () => {
    expect(rulesTemplateDescription(undefined, "Legacy profile")).toBe("Legacy profile");
  });
});
