import type { BatterRow, BowlerRow } from "@/lib/scorecard/types";

export interface TournamentFixture {
  id: string;
  matchNumber: number | null;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: string;
  awayTeamId: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  marginText: string | null;
  venue: string | null;
  scheduledAt: string | null;
  isLive: boolean;
}

export interface TeamStanding {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  points: number;
  runsFor: number;
  runsAgainst: number;
  highestScore: number;
  bestWinMargin: number;
}

export interface PlayerSeasonStats {
  playerId: string;
  name: string;
  teamName: string;
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  strikeRate: number;
  wickets: number;
  netRuns: number;
  highestScore: number;
  fours: number;
  sixes: number;
}

export interface LeaderboardSection {
  title: string;
  emoji: string;
  entries: { rank: number; name: string; teamName: string; value: string; detail?: string }[];
}

export interface TournamentOverview {
  matchesPlayed: number;
  matchesScheduled: number;
  liveMatches: number;
  highestTeamScore: number;
  bestWinMargin: number;
}

export interface TournamentInsights {
  overview: TournamentOverview;
  standings: TeamStanding[];
  playerStats: PlayerSeasonStats[];
  leaderboards: LeaderboardSection[];
  fixtures: TournamentFixture[];
}

interface MatchResultInput {
  id: string;
  matchNumber: number | null;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  winningTeamId: string | null;
  marginText: string | null;
  venue: string | null;
  scheduledAt: Date | null;
}

export interface PlayerMatchContribution {
  matchId: string;
  playerId: string;
  name: string;
  teamName: string;
  batting?: Pick<BatterRow, "runs" | "balls" | "netRuns" | "fours" | "sixes" | "isNotOut">;
  bowling?: Pick<BowlerRow, "wickets">;
}

function strikeRate(runs: number, balls: number): number {
  if (balls === 0) return 0;
  return Math.round((runs / balls) * 1000) / 10;
}

export function buildFixtures(matches: MatchResultInput[]): TournamentFixture[] {
  return matches.map((m) => ({
    id: m.id,
    matchNumber: m.matchNumber,
    homeTeam: m.homeTeamName,
    awayTeam: m.awayTeamName,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    status: m.status,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    marginText: m.marginText,
    venue: m.venue,
    scheduledAt: m.scheduledAt?.toISOString().slice(0, 10) ?? null,
    isLive: m.status === "LIVE",
  }));
}

export function buildStandings(
  matches: MatchResultInput[],
  teamNames: Map<string, string>,
): TeamStanding[] {
  const table = new Map<string, TeamStanding>();

  for (const [teamId, teamName] of teamNames) {
    table.set(teamId, {
      teamId,
      teamName,
      played: 0,
      won: 0,
      lost: 0,
      drawn: 0,
      points: 0,
      runsFor: 0,
      runsAgainst: 0,
      highestScore: 0,
      bestWinMargin: 0,
    });
  }

  for (const m of matches) {
    if (m.status !== "COMPLETED" && m.status !== "WALKOVER") continue;
    const home = table.get(m.homeTeamId);
    const away = table.get(m.awayTeamId);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;

    if (m.homeScore != null && m.awayScore != null) {
      home.runsFor += m.homeScore;
      home.runsAgainst += m.awayScore;
      away.runsFor += m.awayScore;
      away.runsAgainst += m.homeScore;
      home.highestScore = Math.max(home.highestScore, m.homeScore);
      away.highestScore = Math.max(away.highestScore, m.awayScore);
    }

    if (m.winningTeamId === m.homeTeamId) {
      home.won += 1;
      home.points += 2;
      away.lost += 1;
      if (m.homeScore != null && m.awayScore != null) {
        const margin = Math.abs(m.homeScore - m.awayScore);
        home.bestWinMargin = Math.max(home.bestWinMargin, margin);
      }
    } else if (m.winningTeamId === m.awayTeamId) {
      away.won += 1;
      away.points += 2;
      home.lost += 1;
      if (m.homeScore != null && m.awayScore != null) {
        const margin = Math.abs(m.awayScore - m.homeScore);
        away.bestWinMargin = Math.max(away.bestWinMargin, margin);
      }
    } else if (m.status === "COMPLETED") {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    } else if (m.status === "WALKOVER" && m.winningTeamId) {
      const winner = table.get(m.winningTeamId);
      const loserId =
        m.winningTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
      const loser = table.get(loserId);
      if (winner) {
        winner.won += 1;
        winner.points += 2;
      }
      if (loser) {
        loser.lost += 1;
      }
    }
  }

  return [...table.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const aDiff = a.runsFor - a.runsAgainst;
    const bDiff = b.runsFor - b.runsAgainst;
    return bDiff - aDiff;
  });
}

export function aggregatePlayerSeasonStats(
  contributions: PlayerMatchContribution[],
): PlayerSeasonStats[] {
  const map = new Map<string, PlayerSeasonStats>();

  for (const c of contributions) {
    let entry = map.get(c.playerId);
    if (!entry) {
      entry = {
        playerId: c.playerId,
        name: c.name,
        teamName: c.teamName,
        matches: 0,
        innings: 0,
        runs: 0,
        balls: 0,
        strikeRate: 0,
        wickets: 0,
        netRuns: 0,
        highestScore: 0,
        fours: 0,
        sixes: 0,
      };
      map.set(c.playerId, entry);
    }

    if (c.batting) {
      entry.innings += 1;
      entry.runs += c.batting.runs;
      entry.balls += c.batting.balls;
      entry.netRuns += c.batting.netRuns;
      entry.fours += c.batting.fours;
      entry.sixes += c.batting.sixes;
      entry.highestScore = Math.max(entry.highestScore, c.batting.runs);
    }
    if (c.bowling) {
      entry.wickets += c.bowling.wickets;
    }
  }

  const matchCounts = new Map<string, Set<string>>();
  for (const c of contributions) {
    if (!matchCounts.has(c.playerId)) matchCounts.set(c.playerId, new Set());
    matchCounts.get(c.playerId)!.add(c.matchId);
  }

  for (const entry of map.values()) {
    entry.strikeRate = strikeRate(entry.runs, entry.balls);
    entry.matches = matchCounts.get(entry.playerId)?.size ?? 0;
  }

  return [...map.values()].sort((a, b) => b.runs - a.runs);
}

function topN<T>(items: T[], n: number, compare: (a: T, b: T) => number): T[] {
  return [...items].sort(compare).slice(0, n);
}

export function buildLeaderboards(stats: PlayerSeasonStats[]): LeaderboardSection[] {
  const withBatting = stats.filter((s) => s.runs > 0 || s.balls > 0);
  const withBowling = stats.filter((s) => s.wickets > 0);

  const sections: LeaderboardSection[] = [];

  if (withBatting.length > 0) {
    sections.push({
      title: "Most runs",
      emoji: "🏏",
      entries: topN(withBatting, 5, (a, b) => b.runs - a.runs).map((s, i) => ({
        rank: i + 1,
        name: s.name,
        teamName: s.teamName,
        value: String(s.runs),
        detail: s.balls > 0 ? `SR ${s.strikeRate}` : undefined,
      })),
    });

    sections.push({
      title: "Highest score (single innings)",
      emoji: "🌟",
      entries: topN(withBatting, 5, (a, b) => b.highestScore - a.highestScore).map(
        (s, i) => ({
          rank: i + 1,
          name: s.name,
          teamName: s.teamName,
          value: String(s.highestScore),
        }),
      ),
    });

    sections.push({
      title: "Best net runs",
      emoji: "🏆",
      entries: topN(withBatting, 5, (a, b) => b.netRuns - a.netRuns).map((s, i) => ({
        rank: i + 1,
        name: s.name,
        teamName: s.teamName,
        value: s.netRuns >= 0 ? `+${s.netRuns}` : String(s.netRuns),
      })),
    });
  }

  if (withBowling.length > 0) {
    sections.push({
      title: "Most wickets",
      emoji: "🎯",
      entries: topN(withBowling, 5, (a, b) => b.wickets - a.wickets).map((s, i) => ({
        rank: i + 1,
        name: s.name,
        teamName: s.teamName,
        value: String(s.wickets),
      })),
    });
  }

  return sections;
}

export function buildTournamentOverview(
  fixtures: TournamentFixture[],
  standings: TeamStanding[],
): TournamentOverview {
  const completed = fixtures.filter(
    (f) => f.status === "COMPLETED" || f.status === "WALKOVER",
  );
  const live = fixtures.filter((f) => f.isLive);
  const scheduled = fixtures.filter((f) => f.status === "SCHEDULED");

  const highestTeamScore = Math.max(0, ...standings.map((s) => s.highestScore));
  const bestWinMargin = Math.max(0, ...standings.map((s) => s.bestWinMargin));

  return {
    matchesPlayed: completed.length,
    matchesScheduled: scheduled.length,
    liveMatches: live.length,
    highestTeamScore,
    bestWinMargin,
  };
}

export function buildTournamentInsights(input: {
  matches: MatchResultInput[];
  teamNames: Map<string, string>;
  playerContributions: PlayerMatchContribution[];
}): TournamentInsights {
  const fixtures = buildFixtures(input.matches);
  const standings = buildStandings(input.matches, input.teamNames);
  const playerStats = aggregatePlayerSeasonStats(input.playerContributions);
  const leaderboards = buildLeaderboards(playerStats);
  const overview = buildTournamentOverview(fixtures, standings);

  return {
    overview,
    standings,
    playerStats,
    leaderboards,
    fixtures,
  };
}
