import { describe, expect, it } from "vitest";
import { getBuiltinProfile } from "@howzzat/rules-engine";
import type { DeliveryEvent } from "@howzzat/rules-engine";
import {
  aggregateFielding,
  aggregateInningsFromDeliveries,
  aggregatePartnerships,
} from "@/lib/scorecard/aggregate";

const profile = getBuiltinProfile("u9-softball-london-v1")!;

const players = [
  { id: "p1", name: "Alice", displayName: "Alice A" },
  { id: "p2", name: "Bob" },
  { id: "p3", name: "Carol" },
];

describe("scorecard aggregate", () => {
  it("builds batter and bowler rows from deliveries", () => {
    const deliveries: DeliveryEvent[] = [
      {
        overNumber: 1,
        ballInOver: 1,
        isLegalBall: true,
        runsOffBat: 4,
        extrasRuns: 0,
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: "p3",
      },
      {
        overNumber: 1,
        ballInOver: 2,
        isLegalBall: true,
        runsOffBat: 0,
        extrasRuns: 0,
        wicketType: "bowled",
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: "p3",
        dismissedBatsmanId: "p1",
      },
    ];

    const view = aggregateInningsFromDeliveries({
      teamName: "Team A",
      inningsLabel: "Team A — Innings 1",
      deliveries,
      players,
      profile,
      totalRuns: 199,
      wickets: 1,
      batRuns: 4,
      netRuns: -1,
      oversBowled: 0.2,
    });

    expect(view.batters).toHaveLength(1);
    expect(view.batters[0]?.name).toBe("Alice A");
    expect(view.batters[0]?.runs).toBe(4);
    expect(view.batters[0]?.balls).toBe(2);
    expect(view.batters[0]?.fours).toBe(1);
    expect(view.batters[0]?.netRuns).toBe(-1);
    expect(view.batters[0]?.dismissal).toBe("b Carol");

    expect(view.bowlers).toHaveLength(1);
    expect(view.bowlers[0]?.wickets).toBe(1);
    expect(view.bowlers[0]?.runs).toBe(4);

    expect(view.fallOfWickets).toHaveLength(1);
    expect(view.fallOfWickets[0]?.score).toBe(199);
  });

  it("aggregates fielding stats", () => {
    const deliveries: DeliveryEvent[] = [
      {
        overNumber: 2,
        ballInOver: 3,
        isLegalBall: true,
        runsOffBat: 0,
        extrasRuns: 0,
        wicketType: "caught",
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: "p3",
        fielderId: "p2",
        dismissedBatsmanId: "p1",
      },
    ];

    const playerMap = new Map(players.map((p) => [p.id, p]));
    const fielding = aggregateFielding(deliveries, playerMap);

    expect(fielding).toHaveLength(1);
    expect(fielding[0]?.fielderName).toBe("Bob");
    expect(fielding[0]?.catches).toBe(1);
  });

  it("partnership runs use team score including extras", () => {
    const deliveries: DeliveryEvent[] = [
      {
        overNumber: 1,
        ballInOver: 1,
        isLegalBall: false,
        extrasType: "wide",
        extrasRuns: 0,
        runsOffBat: 0,
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: "p3",
      },
      {
        overNumber: 1,
        ballInOver: 1,
        isLegalBall: true,
        runsOffBat: 4,
        extrasRuns: 0,
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: "p3",
      },
    ];

    const partnerships = aggregatePartnerships(
      deliveries,
      [
        { id: "p1", name: "Alice" },
        { id: "p2", name: "Bob" },
        { id: "p3", name: "Carol" },
        { id: "p4", name: "Dave" },
      ],
      profile,
      16,
    );

    expect(partnerships[0]?.runs).toBe(6);
  });

  it("credits bowler wides and no-balls on illegal deliveries", () => {
    const deliveries: DeliveryEvent[] = [
      {
        overNumber: 1,
        ballInOver: 1,
        isLegalBall: false,
        extrasType: "wide",
        extrasRuns: 0,
        runsOffBat: 0,
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: "p3",
      },
      {
        overNumber: 1,
        ballInOver: 1,
        isLegalBall: false,
        extrasType: "wide_runs",
        extrasRuns: 2,
        runsOffBat: 0,
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: "p3",
      },
      {
        overNumber: 1,
        ballInOver: 2,
        isLegalBall: false,
        extrasType: "no_ball",
        extrasRuns: 0,
        runsOffBat: 4,
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: "p3",
      },
      {
        overNumber: 1,
        ballInOver: 2,
        isLegalBall: false,
        extrasType: "no_ball_runs",
        extrasRuns: 1,
        extrasRunsType: "bye",
        runsOffBat: 0,
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: "p3",
      },
    ];

    const view = aggregateInningsFromDeliveries({
      teamName: "Team A",
      inningsLabel: "Team A — Innings 1",
      deliveries,
      players,
      profile,
      totalRuns: 212,
      wickets: 0,
      batRuns: 4,
      netRuns: 12,
      oversBowled: 0.1,
    });

    expect(view.extras.wides).toBe(4);
    expect(view.extras.noBalls).toBe(4);
    expect(view.extras.byes).toBe(3);
    expect(view.extras.total).toBe(11);

    expect(view.bowlers).toHaveLength(1);
    const bowler = view.bowlers[0];
    expect(bowler?.wides).toBe(2);
    expect(bowler?.noBalls).toBe(2);
    expect(bowler?.runs).toBe(15);
    expect(bowler?.overs).toBe(0);
    expect(bowler?.dots).toBe(0);
  });

  it("counts legal-ball dots and wickets for the bowler only on legal deliveries", () => {
    const deliveries: DeliveryEvent[] = [
      {
        overNumber: 1,
        ballInOver: 1,
        isLegalBall: true,
        runsOffBat: 0,
        extrasRuns: 0,
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: "p3",
      },
      {
        overNumber: 1,
        ballInOver: 2,
        isLegalBall: true,
        runsOffBat: 0,
        extrasRuns: 0,
        wicketType: "bowled",
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: "p3",
        dismissedBatsmanId: "p1",
      },
      {
        overNumber: 1,
        ballInOver: 3,
        isLegalBall: false,
        extrasType: "wide",
        extrasRuns: 0,
        runsOffBat: 0,
        strikerId: "p2",
        nonStrikerId: "p1",
        bowlerId: "p3",
      },
    ];

    const view = aggregateInningsFromDeliveries({
      teamName: "Team A",
      inningsLabel: "Team A — Innings 1",
      deliveries,
      players,
      profile,
      totalRuns: 198,
      wickets: 1,
      batRuns: 0,
      netRuns: -2,
      oversBowled: 0.2,
    });

    const bowler = view.bowlers[0];
    expect(bowler?.overs).toBe(0.2);
    expect(bowler?.dots).toBe(1);
    expect(bowler?.wickets).toBe(1);
    expect(bowler?.wides).toBe(1);
    expect(bowler?.runs).toBe(2);
  });

  it("tracks leg-bye extras on legal deliveries", () => {
    const deliveries: DeliveryEvent[] = [
      {
        overNumber: 2,
        ballInOver: 1,
        isLegalBall: true,
        extrasType: "leg_bye",
        extrasRuns: 3,
        runsOffBat: 0,
        strikerId: "p1",
        nonStrikerId: "p2",
        bowlerId: "p3",
      },
    ];

    const view = aggregateInningsFromDeliveries({
      teamName: "Team A",
      inningsLabel: "Team A — Innings 1",
      deliveries,
      players,
      profile,
      totalRuns: 203,
      wickets: 0,
      batRuns: 0,
      netRuns: 3,
      oversBowled: 0.1,
    });

    expect(view.extras.legByes).toBe(3);
    expect(view.extras.total).toBe(3);
    expect(view.bowlers[0]?.runs).toBe(3);
    expect(view.bowlers[0]?.overs).toBe(0.1);
  });
});
