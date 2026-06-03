import {
  applyDelivery,
  applyStrikeRotationsAfterDelivery,
  createInningsState,
  type DeliveryEvent,
  type RulesProfile,
} from "@howzzat/rules-engine";
import { formatBallLabel, formatOverHeading } from "@/lib/scoring/ball-label";
import type {
  BallByBallDelivery,
  BallByBallInnings,
  BallByBallOver,
  MatchBallByBall,
  PlayerInfo,
} from "./types";

function name(players: Map<string, PlayerInfo>, id: string): string {
  return players.get(id)?.displayName ?? players.get(id)?.name ?? "Unknown";
}

function formatDescription(
  d: DeliveryEvent,
  players: Map<string, PlayerInfo>,
): { symbol: string; description: string } {
  if (d.wicketType) {
    const batter = name(players, d.dismissedBatsmanId ?? d.strikerId);
    const bowler = name(players, d.bowlerId);
    const fielder = d.fielderId ? name(players, d.fielderId) : undefined;
    switch (d.wicketType) {
      case "bowled":
        return { symbol: "W", description: `${batter} b ${bowler}` };
      case "caught":
        return {
          symbol: "W",
          description: fielder
            ? `${batter} c ${fielder} b ${bowler}`
            : `${batter} c & b ${bowler}`,
        };
      case "run_out":
        return {
          symbol: "W",
          description: fielder
            ? `${batter} run out (${fielder})`
            : `${batter} run out`,
        };
      case "lbw":
        return { symbol: "W", description: `${batter} lbw b ${bowler}` };
      case "stumped":
        return {
          symbol: "W",
          description: fielder
            ? `${batter} st ${fielder} b ${bowler}`
            : `${batter} st b ${bowler}`,
        };
      default:
        return { symbol: "W", description: `${batter} out` };
    }
  }

  if (d.extrasType === "wide") {
    return { symbol: "+", description: "Wide (+2)" };
  }
  if (d.extrasType === "wide_runs") {
    return {
      symbol: "+",
      description: `Wide (+2) + ${d.extrasRuns} bye${d.extrasRuns === 1 ? "" : "s"}`,
    };
  }
  if (d.extrasType === "no_ball" && d.runsOffBat > 0) {
    const bat =
      d.runsOffBat === 4
        ? "FOUR"
        : d.runsOffBat === 6
          ? "SIX"
          : `${d.runsOffBat} run${d.runsOffBat === 1 ? "" : "s"}`;
    return { symbol: "O", description: `No ball (+2), ${bat} off bat` };
  }
  if (d.extrasType === "no_ball") {
    return { symbol: "O", description: "No ball (+2)" };
  }
  if (d.extrasType === "no_ball_runs") {
    const kind = d.extrasRunsType === "leg_bye" ? "leg bye" : "bye";
    return {
      symbol: "O",
      description: `No ball (+2) + ${d.extrasRuns} ${kind}${d.extrasRuns === 1 ? "" : "s"}`,
    };
  }
  if (d.extrasType === "bye") {
    return {
      symbol: "Δ",
      description: `${d.extrasRuns} bye${d.extrasRuns === 1 ? "" : "s"}`,
    };
  }
  if (d.extrasType === "leg_bye") {
    return {
      symbol: "v",
      description: `${d.extrasRuns} leg bye${d.extrasRuns === 1 ? "" : "s"}`,
    };
  }

  if (d.runsOffBat === 0) {
    return { symbol: "·", description: "no run" };
  }
  if (d.runsOffBat === 4) {
    return { symbol: "4", description: "FOUR" };
  }
  if (d.runsOffBat === 6) {
    return { symbol: "6", description: "SIX" };
  }
  return {
    symbol: String(d.runsOffBat),
    description: `${d.runsOffBat} run${d.runsOffBat === 1 ? "" : "s"}`,
  };
}

interface BatterTrack {
  runs: number;
  balls: number;
  name: string;
}

function ensureBatter(
  stats: Map<string, BatterTrack>,
  id: string,
  playerMap: Map<string, PlayerInfo>,
): BatterTrack {
  let entry = stats.get(id);
  if (!entry) {
    entry = { runs: 0, balls: 0, name: name(playerMap, id) };
    stats.set(id, entry);
  }
  return entry;
}

function creditBatterFromDelivery(
  d: DeliveryEvent,
  facingStrikerId: string,
  stats: Map<string, BatterTrack>,
  playerMap: Map<string, PlayerInfo>,
) {
  const isWide =
    d.extrasType === "wide" || d.extrasType === "wide_runs";
  const isNoBall =
    d.extrasType === "no_ball" || d.extrasType === "no_ball_runs";
  const entry = ensureBatter(stats, facingStrikerId, playerMap);

  if (!isWide && d.runsOffBat > 0) {
    if (d.isLegalBall || isNoBall) {
      if (d.isLegalBall) entry.balls += 1;
      entry.runs += d.runsOffBat;
    }
  } else if (d.isLegalBall && !d.extrasType) {
    entry.balls += 1;
  }
}

function batterSummariesAtOverEnd(
  activePairIds: string[],
  strikerId: string,
  stats: Map<string, BatterTrack>,
  playerMap: Map<string, PlayerInfo>,
) {
  return activePairIds.map((id) => {
    const track = ensureBatter(stats, id, playerMap);
    return {
      name: track.name,
      runs: track.runs,
      balls: track.balls,
      isStriker: id === strikerId,
    };
  });
}

export function buildBallByBallInnings(input: {
  teamName: string;
  label: string;
  deliveries: DeliveryEvent[];
  players: PlayerInfo[];
  /** Batting lineup order for pair rotation; defaults to `players`. */
  battingOrder?: PlayerInfo[];
  profile: RulesProfile;
  totalOvers: number;
}): BallByBallInnings {
  const playerMap = new Map(input.players.map((p) => [p.id, p]));
  const lineup = input.battingOrder ?? input.players;
  const config = {
    playersPerSide: input.profile.playersPerSide.default,
    totalOvers: input.totalOvers,
  };

  let state = createInningsState(input.profile, config);
  const rows: BallByBallDelivery[] = [];
  const pairOvers = input.profile.pairOvers;
  const rotateAfterWicket =
    input.profile.dismissals.rotateStrikeAfterWicket ?? false;

  let currentPairIdx = -1;
  let strikerId = input.deliveries[0]?.strikerId ?? "";
  let nonStrikerId = input.deliveries[0]?.nonStrikerId ?? "";
  let activePairIds: string[] = [];
  let pairLabel = "P1";
  let partnershipStartTotal = 0;
  let partnershipWickets = 0;
  const batterStats = new Map<string, BatterTrack>();
  const overEndSummaries = new Map<
    number,
    Pick<
      BallByBallOver,
      | "batterSummaries"
      | "partnershipLabel"
      | "partnershipRuns"
      | "partnershipWickets"
    >
  >();

  input.deliveries.forEach((d, idx) => {
    const pairIdx = Math.floor((d.overNumber - 1) / pairOvers);
    if (pairIdx !== currentPairIdx) {
      currentPairIdx = pairIdx;
      const i = pairIdx * 2;
      strikerId = lineup[i]?.id ?? d.strikerId;
      nonStrikerId = lineup[i + 1]?.id ?? d.nonStrikerId ?? strikerId;
      activePairIds = [strikerId, nonStrikerId];
      pairLabel = `P${pairIdx + 1}`;
      partnershipStartTotal = state.totalRuns;
      partnershipWickets = 0;
    }

    const prevTotal = state.totalRuns;
    state = applyDelivery(state, d, input.profile);
    creditBatterFromDelivery(d, strikerId, batterStats, playerMap);
    if (
      d.wicketType &&
      d.dismissedBatsmanId &&
      activePairIds.includes(d.dismissedBatsmanId)
    ) {
      partnershipWickets += 1;
    }
    const { symbol, description } = formatDescription(d, playerMap);
    const isWicket = Boolean(d.wicketType);
    const delta = state.totalRuns - prevTotal;

    rows.push({
      sequence: idx + 1,
      overNumber: d.overNumber,
      ballInOver: d.ballInOver,
      displayBall: formatBallLabel(d.overNumber, d.ballInOver),
      symbol,
      description,
      strikerName: name(playerMap, strikerId),
      bowlerName: name(playerMap, d.bowlerId),
      runsAdded: delta,
      totalScore: state.totalRuns,
      wickets: state.wickets,
      isWicket,
      isLegalBall: d.isLegalBall,
    });

    [strikerId, nonStrikerId] = applyStrikeRotationsAfterDelivery(
      strikerId,
      nonStrikerId,
      d,
      { rotateStrikeAfterWicket: rotateAfterWicket },
    );

    const nextOver = input.deliveries[idx + 1]?.overNumber;
    if (!nextOver || nextOver !== d.overNumber) {
      overEndSummaries.set(d.overNumber, {
        batterSummaries: batterSummariesAtOverEnd(
          activePairIds,
          strikerId,
          batterStats,
          playerMap,
        ),
        partnershipLabel: pairLabel,
        partnershipRuns: state.totalRuns - partnershipStartTotal,
        partnershipWickets,
      });
    }
  });

  const overMap = new Map<number, BallByBallOver>();
  for (const row of rows) {
    let over = overMap.get(row.overNumber);
    if (!over) {
      over = {
        overNumber: row.overNumber,
        displayOver: formatOverHeading(row.overNumber),
        runs: 0,
        wickets: 0,
        deliveries: [],
        batterSummaries: [],
        partnershipLabel: "",
        partnershipRuns: 0,
        partnershipWickets: 0,
      };
      overMap.set(row.overNumber, over);
    }
    over.deliveries.push(row);
    over.runs += row.runsAdded;
  }

  for (const over of overMap.values()) {
    over.wickets = over.deliveries.filter((d) => d.isWicket).length;
    const summary = overEndSummaries.get(over.overNumber);
    if (summary) {
      over.batterSummaries = summary.batterSummaries;
      over.partnershipLabel = summary.partnershipLabel;
      over.partnershipRuns = summary.partnershipRuns;
      over.partnershipWickets = summary.partnershipWickets;
    }
  }

  const overs = [...overMap.values()].sort(
    (a, b) => a.overNumber - b.overNumber,
  );

  return {
    teamName: input.teamName,
    label: input.label,
    overs,
  };
}

export function buildMatchBallByBall(input: {
  innings: {
    teamName: string;
    label: string;
    deliveries: DeliveryEvent[];
    battingOrder?: PlayerInfo[];
  }[];
  players: PlayerInfo[];
  profile: RulesProfile;
  totalOvers: number;
}): MatchBallByBall {
  return {
    innings: input.innings.map((inn) =>
      buildBallByBallInnings({
        teamName: inn.teamName,
        label: inn.label,
        deliveries: inn.deliveries,
        players: input.players,
        battingOrder: inn.battingOrder,
        profile: input.profile,
        totalOvers: input.totalOvers,
      }),
    ),
  };
}
