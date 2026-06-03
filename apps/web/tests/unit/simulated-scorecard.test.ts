import { describe, expect, it } from "vitest";
import { generateSimulatedScorecard } from "@/lib/scorecard/simulated";

describe("simulated scorecard", () => {
  it("generates a full two-innings scorecard", () => {
    const view = generateSimulatedScorecard({ seed: 999 });
    expect(view.innings).toHaveLength(2);
    expect(view.innings[0]?.batters.length).toBeGreaterThan(0);
    expect(view.innings[0]?.bowlers.length).toBeGreaterThan(0);
    expect(view.innings[0]?.partnerships.length).toBe(4);
    expect(view.resultBanner?.text).toMatch(/won by|tied/);
  });

  it("is reproducible for the same seed", () => {
    const a = generateSimulatedScorecard({ seed: 777, homeTeam: "A", awayTeam: "B" });
    const b = generateSimulatedScorecard({ seed: 777, homeTeam: "A", awayTeam: "B" });
    expect(a.innings[0]?.totalRuns).toBe(b.innings[0]?.totalRuns);
    expect(a.innings[1]?.totalRuns).toBe(b.innings[1]?.totalRuns);
  });

  it("includes ball-by-ball for both innings", () => {
    const view = generateSimulatedScorecard({ seed: 42 });
    expect(view.ballByBall?.innings).toHaveLength(2);
    expect(view.ballByBall?.innings[0]?.overs.length).toBeGreaterThan(0);
    expect(view.ballByBall?.innings[1]?.overs.length).toBeGreaterThan(0);
    expect(view.ballByBall?.innings[0]?.overs[0]?.batterSummaries.length).toBe(2);
  });
});
