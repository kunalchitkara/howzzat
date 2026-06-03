import {
  applyDelivery,
  createInningsState,
  finalizeInnings,
} from "./engine.js";
import { resolveInningsConfig } from "./profiles.js";
import {
  applyStrikeRotationsAfterDelivery,
} from "./strike.js";
import type {
  DeliveryEvent,
  InningsConfig,
  InningsTotals,
  RulesProfile,
} from "./types.js";

export interface SimPlayer {
  id: string;
  name: string;
}

export interface SimulateMatchOptions {
  profile: RulesProfile;
  homeTeam: string;
  awayTeam: string;
  homePlayers: SimPlayer[];
  awayPlayers: SimPlayer[];
  playersPerSide?: number;
  /** Seed for reproducible randomness. Omit for random seed. */
  seed?: number;
  venue?: string;
  date?: string;
}

export interface SimulatedInnings {
  battingSide: "home" | "away";
  battingTeamName: string;
  bowlingTeamName: string;
  deliveries: DeliveryEvent[];
  totals: InningsTotals;
  battingPlayers: SimPlayer[];
  bowlingPlayers: SimPlayer[];
}

export interface SimulatedMatch {
  seed: number;
  profile: RulesProfile;
  homeTeam: string;
  awayTeam: string;
  venue?: string;
  date?: string;
  innings: SimulatedInnings[];
  homeScore: number;
  awayScore: number;
  winner: "home" | "away" | "draw";
  margin: number;
  resultText: string;
}

type OutcomeKind =
  | "dot"
  | "one"
  | "two"
  | "three"
  | "four"
  | "six"
  | "wide"
  | "wide_byes"
  | "no_ball"
  | "no_ball_bat"
  | "no_ball_byes"
  | "bye"
  | "leg_bye"
  | "wicket";

interface OutcomeWeight {
  kind: OutcomeKind;
  weight: number;
}

const DEFAULT_OUTCOMES: OutcomeWeight[] = [
  { kind: "dot", weight: 36 },
  { kind: "one", weight: 22 },
  { kind: "two", weight: 9 },
  { kind: "three", weight: 2 },
  { kind: "four", weight: 12 },
  { kind: "six", weight: 3 },
  { kind: "wide", weight: 3 },
  { kind: "wide_byes", weight: 2 },
  { kind: "no_ball", weight: 1 },
  { kind: "no_ball_bat", weight: 2 },
  { kind: "no_ball_byes", weight: 2 },
  { kind: "bye", weight: 2 },
  { kind: "leg_bye", weight: 2 },
  { kind: "wicket", weight: 5 },
];

const WICKET_TYPES: NonNullable<DeliveryEvent["wicketType"]>[] = [
  "bowled",
  "caught",
  "caught",
  "caught",
  "run_out",
  "run_out",
  "lbw",
  "stumped",
];

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rng: () => number, items: OutcomeWeight[]): OutcomeKind {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.kind;
  }
  return items[items.length - 1]!.kind;
}

function pickOne<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

function pairForOver(overNumber: number, pairOvers: number, lineup: SimPlayer[]) {
  const pairIdx = Math.floor((overNumber - 1) / pairOvers);
  const i = pairIdx * 2;
  return {
    striker: lineup[i] ?? lineup[0]!,
    nonStriker: lineup[i + 1] ?? lineup[1] ?? lineup[0]!,
  };
}

function bowlerForOver(
  overNumber: number,
  totalOvers: number,
  lineup: SimPlayer[],
): SimPlayer {
  const oversEach = totalOvers / lineup.length;
  const idx = Math.min(
    lineup.length - 1,
    Math.floor((overNumber - 1) / oversEach),
  );
  return lineup[idx]!;
}

function pickInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function buildEvent(
  rng: () => number,
  ctx: {
    overNumber: number;
    ballInOver: number;
    striker: SimPlayer;
    nonStriker: SimPlayer;
    bowler: SimPlayer;
    fielders: SimPlayer[];
  },
): DeliveryEvent {
  const kind = pickWeighted(rng, DEFAULT_OUTCOMES);
  const base = {
    overNumber: ctx.overNumber,
    ballInOver: ctx.ballInOver,
    strikerId: ctx.striker.id,
    nonStrikerId: ctx.nonStriker.id,
    bowlerId: ctx.bowler.id,
    extrasRuns: 0,
  };

  switch (kind) {
    case "dot":
      return { ...base, isLegalBall: true, runsOffBat: 0 };
    case "one":
      return { ...base, isLegalBall: true, runsOffBat: 1 };
    case "two":
      return { ...base, isLegalBall: true, runsOffBat: 2 };
    case "three":
      return { ...base, isLegalBall: true, runsOffBat: 3 };
    case "four":
      return { ...base, isLegalBall: true, runsOffBat: 4 };
    case "six":
      return { ...base, isLegalBall: true, runsOffBat: 6 };
    case "wide":
      return { ...base, isLegalBall: false, runsOffBat: 0, extrasType: "wide" };
    case "wide_byes": {
      const byeRuns = pickInt(rng, 1, 3);
      return {
        ...base,
        isLegalBall: false,
        runsOffBat: 0,
        extrasType: "wide_runs",
        extrasRuns: byeRuns,
        extrasRunsType: "bye",
      };
    }
    case "no_ball":
      return {
        ...base,
        isLegalBall: false,
        runsOffBat: 0,
        extrasType: "no_ball",
      };
    case "no_ball_bat": {
      const runs = pickOne(rng, [1, 2, 4, 6]);
      return {
        ...base,
        isLegalBall: false,
        runsOffBat: runs,
        extrasType: "no_ball",
      };
    }
    case "no_ball_byes": {
      const extraRuns = pickInt(rng, 1, 3);
      const leg = rng() < 0.35;
      return {
        ...base,
        isLegalBall: false,
        runsOffBat: 0,
        extrasType: "no_ball_runs",
        extrasRuns: extraRuns,
        extrasRunsType: leg ? "leg_bye" : "bye",
      };
    }
    case "bye":
      return {
        ...base,
        isLegalBall: true,
        runsOffBat: 0,
        extrasType: "bye",
        extrasRuns: pickInt(rng, 1, 3),
      };
    case "leg_bye":
      return {
        ...base,
        isLegalBall: true,
        runsOffBat: 0,
        extrasType: "leg_bye",
        extrasRuns: pickInt(rng, 1, 3),
      };
    case "wicket": {
      const wicketType = pickOne(rng, WICKET_TYPES);
      const needsFielder =
        wicketType === "caught" ||
        wicketType === "run_out" ||
        wicketType === "stumped";
      const fielderCandidates = ctx.fielders.filter(
        (f) => f.id !== ctx.bowler.id,
      );
      const fielder = needsFielder
        ? pickOne(
            rng,
            fielderCandidates.length ? fielderCandidates : ctx.fielders,
          )
        : undefined;
      return {
        ...base,
        isLegalBall: true,
        runsOffBat: 0,
        wicketType,
        dismissedBatsmanId: ctx.striker.id,
        fielderId: fielder?.id,
      };
    }
  }
}

export function simulateInnings(input: {
  profile: RulesProfile;
  config: InningsConfig;
  battingPlayers: SimPlayer[];
  bowlingPlayers: SimPlayer[];
  rng: () => number;
}): DeliveryEvent[] {
  const { profile, config, battingPlayers, bowlingPlayers, rng } = input;
  const deliveries: DeliveryEvent[] = [];
  let state = createInningsState(profile, config);
  let legalBalls = 0;
  const targetLegal = config.totalOvers * 6;

  let striker = battingPlayers[0]!;
  let nonStriker = battingPlayers[1] ?? battingPlayers[0]!;
  let currentPairIdx = -1;

  while (legalBalls < targetLegal) {
    const overNumber = Math.floor(legalBalls / 6) + 1;
    const ballInOver = (legalBalls % 6) + 1;

    const pairIdx = Math.floor((overNumber - 1) / profile.pairOvers);
    if (pairIdx !== currentPairIdx) {
      currentPairIdx = pairIdx;
      const pair = pairForOver(overNumber, profile.pairOvers, battingPlayers);
      striker = pair.striker;
      nonStriker = pair.nonStriker;
    }

    const bowler = bowlerForOver(
      overNumber,
      config.totalOvers,
      bowlingPlayers,
    );

    const event = buildEvent(rng, {
      overNumber,
      ballInOver,
      striker,
      nonStriker,
      bowler,
      fielders: bowlingPlayers,
    });

    state = applyDelivery(state, event, profile);
    deliveries.push(event);

    if (event.isLegalBall) {
      legalBalls += 1;
    }

    [striker, nonStriker] = applyStrikeRotationsAfterDelivery(
      striker,
      nonStriker,
      event,
      {
        rotateStrikeAfterWicket:
          profile.dismissals.rotateStrikeAfterWicket ?? false,
      },
    );
  }

  return deliveries;
}

export function simulateMatch(options: SimulateMatchOptions): SimulatedMatch {
  const seed =
    options.seed ?? Math.floor(Math.random() * 2147483647);
  const rng = mulberry32(seed);
  const playersPerSide =
    options.playersPerSide ?? options.profile.playersPerSide.default;
  const config = resolveInningsConfig(options.profile, playersPerSide);
  const inningsConfig: InningsConfig = {
    playersPerSide: config.playersPerSide,
    totalOvers: config.totalOvers,
  };

  const homeLineup = options.homePlayers.slice(0, config.playersPerSide);
  const awayLineup = options.awayPlayers.slice(0, config.playersPerSide);

  if (homeLineup.length < config.playersPerSide) {
    throw new Error(
      `Need ${config.playersPerSide} home players, got ${homeLineup.length}`,
    );
  }
  if (awayLineup.length < config.playersPerSide) {
    throw new Error(
      `Need ${config.playersPerSide} away players, got ${awayLineup.length}`,
    );
  }

  const inn1Deliveries = simulateInnings({
    profile: options.profile,
    config: inningsConfig,
    battingPlayers: homeLineup,
    bowlingPlayers: awayLineup,
    rng,
  });
  const inn1Totals = finalizeInnings(
    inn1Deliveries.reduce(
      (s, d) => applyDelivery(s, d, options.profile),
      createInningsState(options.profile, inningsConfig),
    ),
    options.profile,
  );

  const inn2Deliveries = simulateInnings({
    profile: options.profile,
    config: inningsConfig,
    battingPlayers: awayLineup,
    bowlingPlayers: homeLineup,
    rng,
  });
  const inn2Totals = finalizeInnings(
    inn2Deliveries.reduce(
      (s, d) => applyDelivery(s, d, options.profile),
      createInningsState(options.profile, inningsConfig),
    ),
    options.profile,
  );

  const homeScore = inn1Totals.totalRuns;
  const awayScore = inn2Totals.totalRuns;
  let winner: SimulatedMatch["winner"] = "draw";
  let margin = 0;
  let resultText = "Match tied";

  if (homeScore > awayScore) {
    winner = "home";
    margin = homeScore - awayScore;
    resultText = `${options.homeTeam} won by ${margin} runs`;
  } else if (awayScore > homeScore) {
    winner = "away";
    margin = awayScore - homeScore;
    resultText = `${options.awayTeam} won by ${margin} runs`;
  }

  return {
    seed,
    profile: options.profile,
    homeTeam: options.homeTeam,
    awayTeam: options.awayTeam,
    venue: options.venue,
    date: options.date,
    innings: [
      {
        battingSide: "home",
        battingTeamName: options.homeTeam,
        bowlingTeamName: options.awayTeam,
        deliveries: inn1Deliveries,
        totals: inn1Totals,
        battingPlayers: homeLineup,
        bowlingPlayers: awayLineup,
      },
      {
        battingSide: "away",
        battingTeamName: options.awayTeam,
        bowlingTeamName: options.homeTeam,
        deliveries: inn2Deliveries,
        totals: inn2Totals,
        battingPlayers: awayLineup,
        bowlingPlayers: homeLineup,
      },
    ],
    homeScore,
    awayScore,
    winner,
    margin,
    resultText,
  };
}

/** Default U9-style player names for quick demos. */
export const DEMO_PLAYER_NAMES = [
  "Ariyan",
  "Krish",
  "Veer",
  "Avyaan",
  "Qaim",
  "Kaiyan",
  "Aanya",
  "Taran",
  "Drish",
  "Shyam",
];

export const DEMO_OPPONENT_NAMES = [
  "Sahib",
  "Ekamvir",
  "Gurfateh",
  "Elijah",
  "Rudransh",
  "Arnav",
  "Harshan",
  "Sehaj",
  "Eknoor",
  "Gurman",
];

export const DEMO_CLUB_NAMES = [
  "Edgware CC",
  "Hayes U9",
  "Radlett Rangers",
  "Wembley Lions",
  "Stanmore Colts",
  "Mill Hill Youth",
];

export function makePlayers(prefix: string, names: string[]): SimPlayer[] {
  return names.map((name, i) => ({
    id: `${prefix}-${i}`,
    name,
  }));
}
