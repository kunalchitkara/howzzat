import { describe, expect, it } from "vitest";
import { getBuiltinProfile } from "@howzzat/rules-engine";
import { buildBallByBallInnings } from "@/lib/scorecard/ball-by-ball";
import {
  buildInningsCommentary,
  buildMatchCommentary,
  extractKeyMoments,
  formatOverSummary,
} from "@/lib/scorecard/commentary";

const profile = getBuiltinProfile("u9-softball-london-v1")!;

describe("commentary", () => {
  it("formats over summary with runs and wickets", () => {
    const bbb = buildBallByBallInnings({
      teamName: "Team A",
      label: "Team A — Innings 1",
      profile,
      totalOvers: 16,
      players: [
        { id: "s", name: "Striker" },
        { id: "ns", name: "NonStriker" },
        { id: "b", name: "Bowler" },
      ],
      deliveries: [
        {
          overNumber: 1,
          ballInOver: 1,
          isLegalBall: true,
          runsOffBat: 4,
          extrasRuns: 0,
          strikerId: "s",
          nonStrikerId: "ns",
          bowlerId: "b",
        },
        {
          overNumber: 1,
          ballInOver: 2,
          isLegalBall: true,
          runsOffBat: 0,
          extrasRuns: 0,
          wicketType: "bowled",
          strikerId: "s",
          nonStrikerId: "ns",
          bowlerId: "b",
          dismissedBatsmanId: "s",
        },
      ],
    });

    const over = bbb.overs[0]!;
    expect(formatOverSummary(over)).toBe("-1 runs off the over · 1 wicket");

    const moments = extractKeyMoments(over);
    expect(moments.some((m) => m.kind === "wicket")).toBe(true);
    expect(moments.some((m) => m.kind === "boundary")).toBe(true);
  });

  it("reports maiden over when no runs or wickets", () => {
    const bbb = buildBallByBallInnings({
      teamName: "Team A",
      label: "Team A — Innings 1",
      profile,
      totalOvers: 16,
      players: [
        { id: "s", name: "Striker" },
        { id: "ns", name: "NonStriker" },
        { id: "b", name: "Bowler" },
      ],
      deliveries: Array.from({ length: 6 }, (_, i) => ({
        overNumber: 1,
        ballInOver: i + 1,
        isLegalBall: true,
        runsOffBat: 0,
        extrasRuns: 0,
        strikerId: "s",
        nonStrikerId: "ns",
        bowlerId: "b",
      })),
    });

    expect(formatOverSummary(bbb.overs[0]!)).toBe("Maiden over");
  });

  it("builds reverse-chronological innings commentary", () => {
    const bbb = buildBallByBallInnings({
      teamName: "Team A",
      label: "Team A — Innings 1",
      profile,
      totalOvers: 16,
      players: [
        { id: "s", name: "Striker" },
        { id: "ns", name: "NonStriker" },
        { id: "b", name: "Bowler" },
      ],
      deliveries: [
        {
          overNumber: 1,
          ballInOver: 1,
          isLegalBall: true,
          runsOffBat: 1,
          extrasRuns: 0,
          strikerId: "s",
          nonStrikerId: "ns",
          bowlerId: "b",
        },
        {
          overNumber: 2,
          ballInOver: 1,
          isLegalBall: true,
          runsOffBat: 4,
          extrasRuns: 0,
          strikerId: "s",
          nonStrikerId: "ns",
          bowlerId: "b",
        },
      ],
    });

    const innings = buildInningsCommentary(bbb);
    expect(innings.overs[0]?.overNumber).toBe(2);
    expect(innings.overs[1]?.overNumber).toBe(1);

    const match = buildMatchCommentary({ innings: [bbb] });
    expect(match.innings).toHaveLength(1);
  });
});
