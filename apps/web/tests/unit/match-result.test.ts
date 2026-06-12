import { describe, expect, it } from "vitest";
import { buildHostResultLine } from "@/lib/scoring/match-result";

const home = { id: "home-tt", name: "Blues" };
const away = { id: "away-tt", name: "Golds" };

describe("buildHostResultLine", () => {
  it("host defending wins by runs", () => {
    const line = buildHostResultLine({
      hostTeamId: home.id,
      hostTeamName: home.name,
      homeTeamId: home.id,
      homeTeamName: home.name,
      awayTeamId: away.id,
      awayTeamName: away.name,
      totalOvers: 4,
      chaseContinuedAfterTarget: false,
      innings: [
        { battingTeamId: home.id, totalRuns: 245, deliveries: [{ isLegalBall: true }] },
        { battingTeamId: away.id, totalRuns: 230, deliveries: Array(23).fill({ isLegalBall: true }) },
      ],
    });
    expect(line).toBe("Blues won by 15 runs");
  });

  it("host chasing wins with overs spare", () => {
    const line = buildHostResultLine({
      hostTeamId: home.id,
      hostTeamName: home.name,
      homeTeamId: home.id,
      homeTeamName: home.name,
      awayTeamId: away.id,
      awayTeamName: away.name,
      totalOvers: 4,
      chaseContinuedAfterTarget: false,
      innings: [
        { battingTeamId: away.id, totalRuns: 220, deliveries: [] },
        {
          battingTeamId: home.id,
          totalRuns: 221,
          deliveries: Array(18).fill({ isLegalBall: true }),
        },
      ],
    });
    expect(line).toBe("Blues won with 0.5 overs to spare");
  });

  it("host chasing continued wins by runs", () => {
    const line = buildHostResultLine({
      hostTeamId: home.id,
      hostTeamName: home.name,
      homeTeamId: home.id,
      homeTeamName: home.name,
      awayTeamId: away.id,
      awayTeamName: away.name,
      totalOvers: 4,
      chaseContinuedAfterTarget: true,
      innings: [
        { battingTeamId: away.id, totalRuns: 220, deliveries: [] },
        { battingTeamId: home.id, totalRuns: 235, deliveries: Array(20).fill({ isLegalBall: true }) },
      ],
    });
    expect(line).toBe("Blues won by 15 runs");
  });
});
