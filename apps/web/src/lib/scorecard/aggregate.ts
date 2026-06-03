import type { DeliveryEvent, RulesProfile } from "@howzzat/rules-engine";
import { applyDelivery, createInningsState } from "@howzzat/rules-engine";
import type {
  BatterRow,
  BowlerRow,
  ExtrasBreakdown,
  FallOfWicket,
  FieldingRow,
  InningsScorecardView,
  PartnershipRow,
  PlayerInfo,
} from "./types";

function playerName(players: Map<string, PlayerInfo>, id: string): string {
  return players.get(id)?.displayName ?? players.get(id)?.name ?? "Unknown";
}

function formatDismissal(
  d: DeliveryEvent,
  players: Map<string, PlayerInfo>,
): string {
  if (!d.wicketType) return "";
  const bowler = playerName(players, d.bowlerId);
  const fielder = d.fielderId ? playerName(players, d.fielderId) : undefined;
  switch (d.wicketType) {
    case "bowled":
      return `b ${bowler}`;
    case "caught":
      return fielder ? `c ${fielder} b ${bowler}` : `c & b ${bowler}`;
    case "stumped":
      return fielder ? `st ${fielder} b ${bowler}` : `st b ${bowler}`;
    case "lbw":
      return `lbw b ${bowler}`;
    case "hit_wicket":
      return `hit wkt b ${bowler}`;
    case "run_out":
      return fielder ? `run out (${fielder})` : "run out";
    default:
      return d.wicketType;
  }
}

function ballsToOvers(balls: number): number {
  const full = Math.floor(balls / 6);
  const rem = balls % 6;
  return full + rem / 10;
}

function economy(runs: number, oversDecimal: number): number {
  if (oversDecimal <= 0) return 0;
  const whole = Math.floor(oversDecimal);
  const balls = Math.round((oversDecimal - whole) * 10);
  const totalBalls = whole * 6 + balls;
  if (totalBalls === 0) return 0;
  return Math.round((runs / (totalBalls / 6)) * 10) / 10;
}

export function aggregateInningsFromDeliveries(input: {
  teamName: string;
  inningsLabel: string;
  deliveries: DeliveryEvent[];
  players: PlayerInfo[];
  profile: RulesProfile;
  totalRuns: number;
  wickets: number;
  batRuns: number;
  netRuns: number;
  oversBowled: number;
}): Omit<
  InningsScorecardView,
  "partnerships" | "fielding"
> {
  const playerMap = new Map(input.players.map((p) => [p.id, p]));
  const wicketPenalty = input.profile.wicketPenalty;
  const startingScore = input.profile.startingScore;

  const batters = new Map<
    string,
    BatterRow & { dismissals: string[] }
  >();
  const bowlers = new Map<string, BowlerRow & { legalBalls: number }>();
  const extras: ExtrasBreakdown = {
    total: 0,
    wides: 0,
    noBalls: 0,
    byes: 0,
    legByes: 0,
  };
  const fow: FallOfWicket[] = [];
  let runningScore = startingScore;

  for (const p of input.players) {
    batters.set(p.id, {
      playerId: p.id,
      name: p.displayName ?? p.name,
      dismissal: "did not bat",
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      netRuns: 0,
      wicketsLost: 0,
      isNotOut: true,
      dismissals: [],
    });
  }

  for (const d of input.deliveries) {
    const striker = batters.get(d.strikerId);
    const isWide =
      d.extrasType === "wide" || d.extrasType === "wide_runs";
    const isNoBall =
      d.extrasType === "no_ball" || d.extrasType === "no_ball_runs";

    if (striker && !isWide && d.runsOffBat > 0) {
      if (d.isLegalBall || isNoBall) {
        if (d.isLegalBall) {
          striker.balls += 1;
        }
        striker.runs += d.runsOffBat;
        if (d.runsOffBat === 4) striker.fours += 1;
        if (d.runsOffBat === 6) striker.sixes += 1;
      }
    } else if (striker && d.isLegalBall && !d.extrasType) {
      striker.balls += 1;
    }

    if (d.extrasType === "wide") {
      extras.wides += 2;
      extras.total += 2;
    }
    if (d.extrasType === "wide_runs") {
      extras.wides += 2;
      extras.byes += d.extrasRuns;
      extras.total += 2 + d.extrasRuns;
    }
    if (d.extrasType === "no_ball") {
      extras.noBalls += 2;
      extras.total += 2;
    }
    if (d.extrasType === "no_ball_runs") {
      extras.noBalls += 2;
      if (d.extrasRunsType === "leg_bye") {
        extras.legByes += d.extrasRuns;
      } else {
        extras.byes += d.extrasRuns;
      }
      extras.total += 2 + d.extrasRuns;
    }
    if (d.extrasType === "bye") {
      extras.byes += d.extrasRuns;
      extras.total += d.extrasRuns;
    }
    if (d.extrasType === "leg_bye") {
      extras.legByes += d.extrasRuns;
      extras.total += d.extrasRuns;
    }

    if (d.isLegalBall) {
      let bowler = bowlers.get(d.bowlerId);
      if (!bowler) {
        bowler = {
          playerId: d.bowlerId,
          name: playerName(playerMap, d.bowlerId),
          overs: 0,
          maidens: 0,
          runs: 0,
          wickets: 0,
          wides: 0,
          noBalls: 0,
          dots: 0,
          economy: 0,
          legalBalls: 0,
        };
        bowlers.set(d.bowlerId, bowler);
      }
      bowler.legalBalls += 1;
      const conceded =
        d.runsOffBat +
        (d.extrasType?.startsWith("wide") || d.extrasType?.startsWith("no_ball")
          ? d.extrasType === "wide" || d.extrasType === "no_ball"
            ? 2
            : 2 + d.extrasRuns
          : d.extrasType === "bye" || d.extrasType === "leg_bye"
            ? d.extrasRuns
            : 0);
      bowler.runs += conceded;
      if (d.runsOffBat === 0 && !d.wicketType && !d.extrasType) {
        bowler.dots += 1;
      }
      if (d.extrasType === "wide" || d.extrasType === "wide_runs") {
        bowler.wides += 1;
      }
      if (d.extrasType === "no_ball" || d.extrasType === "no_ball_runs") {
        bowler.noBalls += 1;
      }
      if (
        d.wicketType &&
        d.wicketType !== "run_out" &&
        d.dismissedBatsmanId
      ) {
        bowler.wickets += 1;
      }
    }

    if (d.wicketType && d.dismissedBatsmanId) {
      const batter = batters.get(d.dismissedBatsmanId);
      const text = formatDismissal(d, playerMap);
      if (batter) {
        batter.wicketsLost += 1;
        batter.dismissals.push(text);
        batter.isNotOut = false;
        batter.dismissal =
          batter.wicketsLost > 1
            ? `wkt ×${batter.wicketsLost}`
            : text || "out";
      }
      runningScore -= wicketPenalty;
      fow.push({
        wicket: fow.length + 1,
        score: runningScore,
        batterName: playerName(playerMap, d.dismissedBatsmanId),
        over: d.overNumber,
        ball: d.ballInOver,
        dismissal: text,
      });
    }

    runningScore +=
      d.runsOffBat +
      (d.extrasType === "wide" || d.extrasType === "wide_runs"
        ? d.extrasType === "wide"
          ? 2
          : 2 + d.extrasRuns
        : d.extrasType === "no_ball" || d.extrasType === "no_ball_runs"
          ? d.extrasType === "no_ball"
            ? 2
            : 2 + d.extrasRuns
          : d.extrasType === "bye" || d.extrasType === "leg_bye"
            ? d.extrasRuns
            : 0);
  }

  const batterRows: BatterRow[] = [...batters.values()]
    .filter((b) => b.balls > 0 || b.wicketsLost > 0 || b.runs > 0)
    .map(({ dismissals: _, ...b }) => ({
      ...b,
      netRuns: b.runs - wicketPenalty * b.wicketsLost,
      dismissal: b.isNotOut
        ? b.wicketsLost > 0
          ? `not out (no wkts)` // pairs continue
          : "not out"
        : b.dismissal,
    }));

  const bowlerRows: BowlerRow[] = [...bowlers.values()]
    .map(({ legalBalls, ...b }) => {
      const overs = ballsToOvers(legalBalls);
      return {
        ...b,
        overs,
        economy: economy(b.runs, overs),
      };
    })
    .sort((a, b) => b.overs - a.overs);

  return {
    teamName: input.teamName,
    inningsLabel: input.inningsLabel,
    totalRuns: input.totalRuns,
    wickets: input.wickets,
    overs: input.oversBowled,
    batRuns: input.batRuns,
    netRuns: input.netRuns,
    startingScore,
    batRunsFromPlay: input.batRuns,
    extras,
    batters: batterRows,
    bowlers: bowlerRows,
    fallOfWickets: fow,
  };
}

export function aggregatePartnerships(
  deliveries: DeliveryEvent[],
  battingOrder: PlayerInfo[],
  profile: RulesProfile,
  totalOvers: number,
): PartnershipRow[] {
  const pairOvers = profile.pairOvers;
  const pairCount = totalOvers / pairOvers;
  const wicketPenalty = profile.wicketPenalty;
  const config = {
    playersPerSide: profile.playersPerSide.default,
    totalOvers,
  };

  let state = createInningsState(profile, config);
  let deliveryIdx = 0;
  const rows: PartnershipRow[] = [];

  for (let p = 0; p < pairCount; p++) {
    const startOver = p * pairOvers + 1;
    const endOver = (p + 1) * pairOvers;
    const batter1 = battingOrder[p * 2];
    const batter2 = battingOrder[p * 2 + 1];
    if (!batter1 || !batter2) continue;

    const ids = new Set([batter1.id, batter2.id]);

    while (
      deliveryIdx < deliveries.length &&
      deliveries[deliveryIdx]!.overNumber < startOver
    ) {
      state = applyDelivery(state, deliveries[deliveryIdx]!, profile);
      deliveryIdx++;
    }

    const startTotal = state.totalRuns;
    let balls = 0;
    let fours = 0;
    let sixes = 0;
    let wickets = 0;

    while (
      deliveryIdx < deliveries.length &&
      deliveries[deliveryIdx]!.overNumber <= endOver
    ) {
      const d = deliveries[deliveryIdx]!;
      if (d.strikerId && ids.has(d.strikerId) && d.isLegalBall) {
        balls += 1;
        if (d.runsOffBat === 4) fours += 1;
        if (d.runsOffBat === 6) sixes += 1;
      }
      if (
        d.wicketType &&
        d.dismissedBatsmanId &&
        ids.has(d.dismissedBatsmanId)
      ) {
        wickets += 1;
      }
      state = applyDelivery(state, d, profile);
      deliveryIdx++;
    }

    const teamRuns = state.totalRuns - startTotal;

    rows.push({
      label: `P${p + 1}`,
      batter1: batter1.displayName ?? batter1.name,
      batter2: batter2.displayName ?? batter2.name,
      runs: teamRuns,
      balls,
      fours,
      sixes,
      wickets,
      netRuns: teamRuns - wicketPenalty * wickets,
    });
  }

  return rows;
}

export function aggregateFielding(
  deliveries: DeliveryEvent[],
  players: Map<string, PlayerInfo>,
): FieldingRow[] {
  const map = new Map<string, FieldingRow>();

  for (const d of deliveries) {
    if (d.wicketType === "caught" && d.fielderId) {
      const row = map.get(d.fielderId) ?? {
        fielderName: playerName(players, d.fielderId),
        catches: 0,
        runOuts: 0,
        details: [],
      };
      row.catches += 1;
      row.details.push(
        `c ${row.fielderName} b ${playerName(players, d.bowlerId)} — Ov ${d.overNumber}`,
      );
      map.set(d.fielderId, row);
    }
    if (d.wicketType === "run_out" && d.fielderId) {
      const row = map.get(d.fielderId) ?? {
        fielderName: playerName(players, d.fielderId),
        catches: 0,
        runOuts: 0,
        details: [],
      };
      row.runOuts += 1;
      row.details.push(`run out — Ov ${d.overNumber}`);
      map.set(d.fielderId, row);
    }
  }

  return [...map.values()].sort(
    (a, b) => b.catches + b.runOuts - (a.catches + a.runOuts),
  );
}
