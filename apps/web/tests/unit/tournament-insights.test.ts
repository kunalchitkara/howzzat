import { describe, expect, it } from "vitest";
import {
  aggregatePlayerSeasonStats,
  buildFixtures,
  buildLeaderboards,
  buildStandings,
  buildTournamentInsights,
  type PlayerMatchContribution,
} from "@/lib/tournament/insights";

describe("tournament insights", () => {
  const teamNames = new Map([
    ["t1", "Edgware"],
    ["t2", "Hayes"],
    ["t3", "Pinner"],
  ]);

  const matches = [
    {
      id: "m1",
      matchNumber: 1,
      status: "COMPLETED",
      homeTeamId: "t1",
      awayTeamId: "t2",
      homeTeamName: "Edgware",
      awayTeamName: "Hayes",
      homeScore: 315,
      awayScore: 307,
      winningTeamId: "t1",
      marginText: "Edgware won by 8 runs",
      venue: "Home",
      scheduledAt: new Date("2026-06-07"),
    },
    {
      id: "m2",
      matchNumber: 2,
      status: "COMPLETED",
      homeTeamId: "t3",
      awayTeamId: "t1",
      homeTeamName: "Pinner",
      awayTeamName: "Edgware",
      homeScore: 308,
      awayScore: 263,
      winningTeamId: "t1",
      marginText: "Edgware won by 45 runs",
      venue: "Away",
      scheduledAt: new Date("2026-06-14"),
    },
    {
      id: "m3",
      matchNumber: 3,
      status: "SCHEDULED",
      homeTeamId: "t1",
      awayTeamId: "t2",
      homeTeamName: "Edgware",
      awayTeamName: "Hayes",
      homeScore: null,
      awayScore: null,
      winningTeamId: null,
      marginText: null,
      venue: null,
      scheduledAt: new Date("2026-06-21"),
    },
  ];

  it("builds standings from completed matches", () => {
    const standings = buildStandings(matches, teamNames);
    const edgware = standings.find((s) => s.teamId === "t1");
    expect(edgware?.played).toBe(2);
    expect(edgware?.won).toBe(2);
    expect(edgware?.points).toBe(4);
    expect(edgware?.highestScore).toBe(315);
    expect(edgware?.bestWinMargin).toBe(45);
  });

  it("builds fixtures with live flag", () => {
    const fixtures = buildFixtures([
      ...matches,
      {
        id: "m4",
        matchNumber: 4,
        status: "LIVE",
        homeTeamId: "t1",
        awayTeamId: "t3",
        homeTeamName: "Edgware",
        awayTeamName: "Pinner",
        homeScore: 210,
        awayScore: null,
        winningTeamId: null,
        marginText: null,
        venue: null,
        scheduledAt: null,
      },
    ]);
    expect(fixtures.find((f) => f.id === "m4")?.isLive).toBe(true);
    expect(fixtures.find((f) => f.id === "m3")?.status).toBe("SCHEDULED");
  });

  it("aggregates player season stats and leaderboards", () => {
    const contributions: PlayerMatchContribution[] = [
      {
        matchId: "m1",
        playerId: "p1",
        name: "Veer",
        teamName: "Edgware",
        batting: { runs: 8, balls: 10, netRuns: 8, fours: 1, sixes: 0, isNotOut: true },
      },
      {
        matchId: "m2",
        playerId: "p1",
        name: "Veer",
        teamName: "Edgware",
        batting: { runs: 10, balls: 8, netRuns: 6, fours: 0, sixes: 0, isNotOut: false },
      },
      {
        matchId: "m1",
        playerId: "p2",
        name: "Ariyan",
        teamName: "Edgware",
        batting: { runs: 11, balls: 10, netRuns: 11, fours: 2, sixes: 0, isNotOut: true },
        bowling: { wickets: 2 },
      },
    ];

    const stats = aggregatePlayerSeasonStats(contributions);
    const veer = stats.find((s) => s.playerId === "p1");
    expect(veer?.runs).toBe(18);
    expect(veer?.matches).toBe(2);
    expect(veer?.strikeRate).toBe(100);

    const boards = buildLeaderboards(stats);
    expect(boards[0]?.entries[0]?.name).toBe("Veer");
    expect(boards.some((b) => b.title === "Most wickets")).toBe(true);
  });

  it("builds full tournament insights", () => {
    const insights = buildTournamentInsights({
      matches,
      teamNames,
      playerContributions: [],
    });
    expect(insights.overview.matchesPlayed).toBe(2);
    expect(insights.overview.matchesScheduled).toBe(1);
    expect(insights.standings[0]?.teamId).toBe("t1");
    expect(insights.fixtures).toHaveLength(3);
  });
});
