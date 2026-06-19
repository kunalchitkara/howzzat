import {
  DEMO_CLUB_NAMES,
  DEMO_OPPONENT_NAMES,
  DEMO_PLAYER_NAMES,
  getBuiltinProfile,
  makePlayers,
  resolveInningsConfig,
  simulateMatch,
  type SimulatedMatch,
} from "@howzzat/rules-engine";
import {
  aggregateFielding,
  aggregateInningsFromDeliveries,
  aggregatePartnerships,
} from "@/lib/scorecard/aggregate";
import { buildMatchBallByBall } from "@/lib/scorecard/ball-by-ball";
import type { MatchScorecardView, PlayerInfo } from "@/lib/scorecard/types";

export interface GenerateSimulatedOptions {
  seed?: number;
  homeTeam?: string;
  awayTeam?: string;
  venue?: string;
  date?: string;
}

function toPlayerInfo(players: { id: string; name: string }[]): PlayerInfo[] {
  return players.map((p) => ({ id: p.id, name: p.name, displayName: p.name }));
}

function pickTeams(rng: () => number): { home: string; away: string } {
  const shuffled = [...DEMO_CLUB_NAMES].sort(() => rng() - 0.5);
  return { home: shuffled[0]!, away: shuffled[1] ?? "Hayes U9" };
}

function inningsToView(
  sim: SimulatedMatch,
  inningsIdx: number,
  totalOvers: number,
): MatchScorecardView["innings"][number] {
  const inn = sim.innings[inningsIdx]!;
  const allPlayers = toPlayerInfo([
    ...inn.battingPlayers,
    ...inn.bowlingPlayers,
  ]);
  const battingInfo = toPlayerInfo(inn.battingPlayers);
  const playerMap = new Map(allPlayers.map((p) => [p.id, p]));

  const base = aggregateInningsFromDeliveries({
    teamName: inn.battingTeamName,
    inningsLabel: `${inn.battingTeamName} — Innings ${inningsIdx + 1}`,
    deliveries: inn.deliveries,
    players: allPlayers,
    profile: sim.profile,
    totalRuns: inn.totals.totalRuns,
    wickets: inn.totals.wickets,
    batRuns: inn.totals.batRuns,
    netRuns: inn.totals.netRuns,
    oversBowled: inn.totals.oversBowled,
  });

  return {
    ...base,
    partnerships: aggregatePartnerships(
      inn.deliveries,
      battingInfo,
      sim.profile,
      totalOvers,
    ),
    fielding: aggregateFielding(inn.deliveries, playerMap),
  };
}

export function simulatedMatchToScorecard(
  sim: SimulatedMatch,
): MatchScorecardView {
  const config = resolveInningsConfig(
    sim.profile,
    sim.profile.playersPerSide.default,
  );

  const variant =
    sim.winner === "draw"
      ? "neutral"
      : sim.winner === "home"
        ? "win"
        : "loss";

  return {
    matchTitle: `${sim.homeTeam} vs ${sim.awayTeam}`,
    venue: sim.venue,
    date: sim.date ?? new Date().toISOString().slice(0, 10),
    status: "COMPLETED",
    resultBanner: {
      text: sim.resultText,
      subtext: `${config.totalOvers} overs · Simulated · seed ${sim.seed}`,
      variant,
    },
    toss: {
      winnerName: sim.homeTeam,
      electedTo: "bat",
    },
    innings: sim.innings.map((_, i) =>
      inningsToView(sim, i, config.totalOvers),
    ),
    ballByBall: buildMatchBallByBall({
      profile: sim.profile,
      totalOvers: config.totalOvers,
      players: [
        ...toPlayerInfo(sim.innings[0]!.battingPlayers),
        ...toPlayerInfo(sim.innings[0]!.bowlingPlayers),
        ...toPlayerInfo(sim.innings[1]!.battingPlayers),
        ...toPlayerInfo(sim.innings[1]!.bowlingPlayers),
      ].filter(
        (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i,
      ),
      innings: sim.innings.map((inn, i) => ({
        teamName: inn.battingTeamName,
        label: `${inn.battingTeamName} — Innings ${i + 1}`,
        deliveries: inn.deliveries,
        battingOrder: toPlayerInfo(inn.battingPlayers),
      })),
    }),
    rulesNote: `Simulated U9 match · Base ${sim.profile.startingScore} · −${sim.profile.wicketPenalty} per wicket`,
  };
}

export function generateSimulatedScorecard(
  options: GenerateSimulatedOptions = {},
): MatchScorecardView {
  const profile = getBuiltinProfile("u9-softball-london-v1")!;
  const seed =
    options.seed ?? Math.floor(Math.random() * 2147483647);
  const rng = () => {
    seedState = (seedState + 0x6d2b79f5) >>> 0;
    let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let seedState = seed >>> 0;

  const teams =
    options.homeTeam && options.awayTeam
      ? { home: options.homeTeam, away: options.awayTeam }
      : pickTeams(rng);

  const sim = simulateMatch({
    profile,
    homeTeam: teams.home,
    awayTeam: teams.away,
    homePlayers: makePlayers("home", DEMO_PLAYER_NAMES),
    awayPlayers: makePlayers("away", DEMO_OPPONENT_NAMES),
    seed,
    venue: options.venue ?? "Simulated ground",
    date: options.date,
  });

  return simulatedMatchToScorecard(sim);
}
