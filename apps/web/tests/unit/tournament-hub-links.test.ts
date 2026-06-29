import { describe, expect, it } from "vitest";
import {
  matchPublicRef,
  matchScorecardPath,
  matchScorerPath,
} from "@/lib/match-slug";
import {
  clubSeasonRecord,
  fixtureHasScorecard,
  fixtureResultLabel,
  fixtureScorecardPath,
} from "@/lib/tournament/hub-utils";
import type { TournamentFixture } from "@/lib/tournament/insights";

describe("match public paths", () => {
  it("prefers slug in scorecard and scorer URLs", () => {
    const match = { id: "cuid123", slug: "u9-edgware-hayes-20260607" };
    expect(matchPublicRef(match)).toBe("u9-edgware-hayes-20260607");
    expect(matchScorecardPath(match)).toBe("/match/u9-edgware-hayes-20260607");
    expect(matchScorerPath(match)).toBe("/match/u9-edgware-hayes-20260607/score");
  });

  it("falls back to id when slug is missing", () => {
    const match = { id: "cuid123", slug: null };
    expect(matchScorecardPath(match)).toBe("/match/cuid123");
    expect(matchScorerPath(match)).toBe("/match/cuid123/score");
  });
});

describe("tournament hub fixture helpers", () => {
  const completed: TournamentFixture = {
    id: "m1",
    slug: "u9-edgware-hayes-20260607",
    matchNumber: 5,
    homeTeam: "Edgware",
    awayTeam: "Hayes",
    homeTeamId: "t1",
    awayTeamId: "t2",
    status: "COMPLETED",
    homeScore: 315,
    awayScore: 307,
    marginText: "Edgware won by 8 runs",
    venue: "Home",
    scheduledAt: "7 Jun 2026",
    isLive: false,
  };

  it("builds fixture scorecard path via slug", () => {
    expect(fixtureScorecardPath(completed)).toBe(
      "/match/u9-edgware-hayes-20260607",
    );
  });

  it("labels results and detects scorecard availability", () => {
    expect(fixtureResultLabel(completed)).toBe("Edgware won by 8 runs");
    expect(fixtureHasScorecard(completed)).toBe(true);

    const scheduled: TournamentFixture = {
      ...completed,
      id: "m2",
      slug: "u9-edgware-hayes-20260621",
      status: "SCHEDULED",
      homeScore: null,
      awayScore: null,
      marginText: null,
      isLive: false,
    };
    expect(fixtureResultLabel(scheduled)).toBe("Upcoming");
    expect(fixtureHasScorecard(scheduled)).toBe(false);

    const live: TournamentFixture = { ...completed, isLive: true, status: "LIVE" };
    expect(fixtureHasScorecard(live)).toBe(true);
  });

  it("aggregates club season record from standings", () => {
    const record = clubSeasonRecord(
      [
        {
          teamId: "club",
          teamName: "Edgware",
          played: 7,
          won: 6,
          lost: 1,
          drawn: 0,
          points: 12,
          runsFor: 2000,
          runsAgainst: 1800,
          highestScore: 315,
          bestWinMargin: 61,
        },
        {
          teamId: "opp",
          teamName: "Hayes",
          played: 2,
          won: 1,
          lost: 1,
          drawn: 0,
          points: 2,
          runsFor: 500,
          runsAgainst: 500,
          highestScore: 281,
          bestWinMargin: 51,
        },
      ],
      ["club"],
    );
    expect(record).toEqual({ played: 7, won: 6, lost: 1, drawn: 0 });
  });
});
