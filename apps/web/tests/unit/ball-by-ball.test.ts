import { describe, expect, it } from "vitest";
import { getBuiltinProfile } from "@howzzat/rules-engine";
import { buildBallByBallInnings } from "@/lib/scorecard/ball-by-ball";

const profile = getBuiltinProfile("u9-softball-london-v1")!;

function delivery(
  partial: Partial<import("@howzzat/rules-engine").DeliveryEvent> &
    Pick<
      import("@howzzat/rules-engine").DeliveryEvent,
      "overNumber" | "ballInOver"
    >,
): import("@howzzat/rules-engine").DeliveryEvent {
  return {
    isLegalBall: true,
    runsOffBat: 0,
    extrasRuns: 0,
    strikerId: "g",
    nonStrikerId: "p",
    bowlerId: "b",
    ...partial,
  };
}

describe("ball-by-ball", () => {
  it("formats deliveries with running score", () => {
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

    expect(bbb.overs).toHaveLength(1);
    expect(bbb.overs[0]?.displayOver).toBe("1st Over");
    expect(bbb.overs[0]?.deliveries).toHaveLength(2);
    expect(bbb.overs[0]?.deliveries[0]?.totalScore).toBe(204);
    expect(bbb.overs[0]?.deliveries[0]?.displayBall).toBe("0.1");
    expect(bbb.overs[0]?.deliveries[0]?.bowlerName).toBe("Bowler");
    expect(bbb.overs[0]?.deliveries[0]?.strikerName).toBe("Striker");
    expect(bbb.overs[0]?.deliveries[1]?.isWicket).toBe(true);
    expect(bbb.overs[0]?.deliveries[1]?.totalScore).toBe(199);
    expect(bbb.overs[0]?.batterSummaries).toHaveLength(2);
    expect(bbb.overs[0]?.partnershipLabel).toBe("P1");
  });

  it("tracks strike after wicket and end of over", () => {
    const bbb = buildBallByBallInnings({
      teamName: "Team A",
      label: "Team A — Innings 1",
      profile,
      totalOvers: 16,
      players: [
        { id: "g", name: "Gurfateh" },
        { id: "p", name: "Partner" },
        { id: "c", name: "Chase" },
        { id: "d", name: "Dev" },
        { id: "b", name: "Bowler" },
      ],
      deliveries: [
        delivery({
          overNumber: 5,
          ballInOver: 4,
          wicketType: "lbw",
          dismissedBatsmanId: "c",
          strikerId: "c",
          nonStrikerId: "d",
        }),
        delivery({ overNumber: 5, ballInOver: 5, strikerId: "c", nonStrikerId: "d" }),
        delivery({ overNumber: 5, ballInOver: 6, strikerId: "c", nonStrikerId: "d" }),
        delivery({ overNumber: 6, ballInOver: 6, strikerId: "c", nonStrikerId: "d" }),
        delivery({ overNumber: 7, ballInOver: 1, strikerId: "c", nonStrikerId: "d" }),
      ],
    });

    const over5 = bbb.overs.find((o) => o.overNumber === 5);
    const over6 = bbb.overs.find((o) => o.overNumber === 6);
    const over7 = bbb.overs.find((o) => o.overNumber === 7);

    expect(over5?.displayOver).toBe("5th Over");
    expect(over5?.deliveries[0]?.displayBall).toBe("4.4");
    expect(over5?.deliveries[0]?.strikerName).toBe("Chase");
    expect(over5?.deliveries[1]?.displayBall).toBe("4.5");
    expect(over5?.deliveries[1]?.strikerName).toBe("Dev");

    expect(over6?.deliveries.at(-1)?.displayBall).toBe("6.0");
    expect(over6?.deliveries.at(-1)?.strikerName).toBe("Chase");

    expect(over7?.displayOver).toBe("7th Over");
    expect(over7?.deliveries[0]?.displayBall).toBe("6.1");
    expect(over7?.deliveries[0]?.strikerName).toBe("Dev");
    expect(over5?.partnershipLabel).toBe("P2");
    expect(over5?.batterSummaries.some((b) => b.name === "Chase")).toBe(true);
  });

  it("partnership score includes extras not just bat runs", () => {
    const bbb = buildBallByBallInnings({
      teamName: "Team A",
      label: "Team A — Innings 1",
      profile,
      totalOvers: 16,
      players: [
        { id: "g", name: "Gurfateh" },
        { id: "p", name: "Partner" },
        { id: "b", name: "Bowler" },
      ],
      deliveries: [
        delivery({
          overNumber: 1,
          ballInOver: 1,
          extrasType: "wide",
          isLegalBall: false,
        }),
        delivery({ overNumber: 1, ballInOver: 1, runsOffBat: 4 }),
        delivery({ overNumber: 1, ballInOver: 2 }),
      ],
    });

    expect(bbb.overs[0]?.partnershipRuns).toBe(6);
    expect(
      bbb.overs[0]?.batterSummaries.find((b) => b.name === "Gurfateh")?.runs,
    ).toBe(4);
  });

  it("returns same striker after last-ball single (double rotation)", () => {
    const bbb = buildBallByBallInnings({
      teamName: "Team A",
      label: "Team A — Innings 1",
      profile,
      totalOvers: 16,
      players: [
        { id: "g", name: "Gurfateh" },
        { id: "p", name: "Partner" },
        { id: "b", name: "Bowler" },
      ],
      deliveries: [
        delivery({ overNumber: 1, ballInOver: 6, runsOffBat: 1 }),
        delivery({ overNumber: 2, ballInOver: 1 }),
      ],
    });

    expect(bbb.overs[0]?.deliveries[0]?.strikerName).toBe("Gurfateh");
    expect(bbb.overs[1]?.deliveries[0]?.strikerName).toBe("Gurfateh");
  });
});
