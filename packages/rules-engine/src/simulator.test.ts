import { describe, expect, it } from "vitest";
import { finalizeInnings, replayInnings } from "./engine.js";
import { getBuiltinProfile, resolveInningsConfig } from "./profiles.js";
import {
  DEMO_OPPONENT_NAMES,
  DEMO_PLAYER_NAMES,
  makePlayers,
  simulateInnings,
  simulateMatch,
} from "./simulator.js";

const profile = getBuiltinProfile("u9-softball-london-v1")!;

describe("match simulator", () => {
  it("simulates a full legal-ball innings", () => {
    const config = resolveInningsConfig(profile, 8);
    const deliveries = simulateInnings({
      profile,
      config: {
        playersPerSide: config.playersPerSide,
        totalOvers: config.totalOvers,
      },
      battingPlayers: makePlayers("h", DEMO_PLAYER_NAMES),
      bowlingPlayers: makePlayers("a", DEMO_OPPONENT_NAMES),
      rng: () => 0.3,
    });

    expect(deliveries.filter((d) => d.isLegalBall)).toHaveLength(96);
    const totals = finalizeInnings(
      replayInnings(
        profile,
        { playersPerSide: 8, totalOvers: 16 },
        deliveries,
      ),
      profile,
    );
    expect(totals.totalRuns).toBeGreaterThanOrEqual(profile.startingScore - 100);
  });

  it("produces reproducible results with the same seed", () => {
    const opts = {
      profile,
      homeTeam: "Team A",
      awayTeam: "Team B",
      homePlayers: makePlayers("h", DEMO_PLAYER_NAMES),
      awayPlayers: makePlayers("a", DEMO_OPPONENT_NAMES),
      seed: 42,
    };
    const a = simulateMatch(opts);
    const b = simulateMatch(opts);
    expect(a.homeScore).toBe(b.homeScore);
    expect(a.awayScore).toBe(b.awayScore);
    expect(a.innings[0]?.deliveries.length).toBe(b.innings[0]?.deliveries.length);
  });

  it("swaps strike after a single within a pair", () => {
    const players = makePlayers("h", ["Ariyan", "Krish", "Veer", "Avyaan", "Qaim", "Kaiyan", "Aanya", "Taran"]);
    let roll = 0;
    const rng = () => {
      roll += 1;
      return roll === 1 ? 0.25 : 0.99;
    };

    const config = resolveInningsConfig(profile, 8);
    const deliveries = simulateInnings({
      profile,
      config: { playersPerSide: 8, totalOvers: 16 },
      battingPlayers: players,
      bowlingPlayers: makePlayers("a", DEMO_OPPONENT_NAMES),
      rng,
    });

    const legal = deliveries.filter((d) => d.isLegalBall);
    const firstSingleIdx = legal.findIndex((d) => d.runsOffBat === 1);
    if (firstSingleIdx >= 0 && firstSingleIdx + 1 < legal.length) {
      const single = legal[firstSingleIdx]!;
      const next = legal[firstSingleIdx + 1]!;
      expect(single.strikerId).toBe("h-0");
      expect(next.strikerId).toBe("h-1");
    }
  });

  it("simulates two innings with a result", () => {
    const match = simulateMatch({
      profile,
      homeTeam: "Edgware CC",
      awayTeam: "Hayes U9",
      homePlayers: makePlayers("h", DEMO_PLAYER_NAMES),
      awayPlayers: makePlayers("a", DEMO_OPPONENT_NAMES),
      seed: 12345,
      venue: "Canons High School",
    });

    expect(match.innings).toHaveLength(2);
    expect(match.homeScore).toBeGreaterThan(0);
    expect(match.awayScore).toBeGreaterThan(0);
    expect(match.resultText).toMatch(/won by|tied/);
    expect(match.innings[0]?.deliveries.length).toBeGreaterThan(96);
  });
});
