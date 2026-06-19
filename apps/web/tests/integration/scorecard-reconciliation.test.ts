import { beforeEach, describe, expect, it } from "vitest";
import { POST as createIosDemo } from "@/app/api/v1/demo/ios-match/route";
import { POST as createU9Demo } from "@/app/api/v1/demo/u9-match/route";
import { POST as confirmSquadsRoute } from "@/app/api/v1/matches/[matchId]/squad/confirm/route";
import { POST as recordTossRoute } from "@/app/api/v1/matches/[matchId]/toss/route";
import { GET as getScoring } from "@/app/api/v1/matches/[matchId]/scoring/route";
import { POST as createInningsRoute } from "@/app/api/v1/matches/[matchId]/innings/route";
import { POST as recordDeliveryRoute } from "@/app/api/v1/deliveries/route";
import { buildMatchScorecardFromRaw } from "@/lib/scorecard/build-from-match";
import type { MatchScorecardView } from "@/lib/scorecard/types";
import { getMatchScorecard } from "@/lib/services/matches";
import { deliveryToEvent } from "@/lib/services/match-utils";
import { resolveInningsConfigForBatting } from "@/lib/scoring/innings-config";
import {
  finalizeInnings,
  getBuiltinProfile,
  replayInnings,
  type DeliveryEvent,
  type RulesProfile,
} from "@howzzat/rules-engine";
import { prisma } from "@howzzat/db";
import { resetDatabase } from "@howzzat/db/testing";
import { emptyParams, jsonRequest, params, readJson } from "../helpers/request";

type RawScorecard = Awaited<ReturnType<typeof getMatchScorecard>>;

type DeliveryInput = {
  overNumber: number;
  ballInOver: number;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  runsOffBat?: number;
  extrasType?: DeliveryEvent["extrasType"];
  extrasRuns?: number;
  extrasRunsType?: DeliveryEvent["extrasRunsType"];
  isLegalBall?: boolean;
  wicketType?: DeliveryEvent["wicketType"];
  fielderId?: string;
  dismissedBatsmanId?: string;
};

function wicketCountFromEvents(events: DeliveryEvent[]): number {
  return events.filter((d) => d.wicketType).length;
}

function lastBallTotalScore(view: MatchScorecardView, inningsIdx: number): number | undefined {
  const bbb = view.ballByBall?.innings[inningsIdx];
  if (!bbb?.overs.length) return undefined;
  const rows = bbb.overs.flatMap((o) => o.deliveries);
  return rows.at(-1)?.totalScore;
}

function assertInningsReconciliation(
  raw: RawScorecard,
  view: MatchScorecardView,
  profile: RulesProfile,
  inningsIdx: number,
) {
  const sc = raw.inningsScorecards[inningsIdx];
  const dbInnings = raw.match.innings[inningsIdx];
  const viewInnings = view.innings[inningsIdx];
  expect(sc).toBeDefined();
  expect(dbInnings).toBeDefined();
  expect(viewInnings).toBeDefined();

  const events = dbInnings!.deliveries.map(deliveryToEvent);
  const config = resolveInningsConfigForBatting(
    profile,
    raw.match,
    dbInnings!.battingTeamId,
  );
  const replayed = replayInnings(profile, config, events);
  const replayedTotals = finalizeInnings(replayed, profile);

  expect(sc!.computed).toEqual(replayedTotals);

  for (const [field, stored] of Object.entries(sc!.stored) as [
    keyof typeof sc.stored,
    number | null,
  ][]) {
    if (stored != null) {
      expect(stored, `stored.${field}`).toBe(sc!.computed[field]);
    }
  }

  const batterRuns = viewInnings!.batters.reduce((sum, b) => sum + b.runs, 0);
  expect(batterRuns).toBe(sc!.computed.batRuns);

  expect(sc!.computed.netRuns).toBe(
    sc!.computed.batRuns - profile.wicketPenalty * sc!.computed.wickets,
  );

  expect(viewInnings!.extras.total).toBe(replayed.extras);
  expect(viewInnings!.totalRuns).toBe(sc!.computed.totalRuns);
  expect(viewInnings!.wickets).toBe(sc!.computed.wickets);
  expect(viewInnings!.batRuns).toBe(sc!.computed.batRuns);
  expect(viewInnings!.netRuns).toBe(sc!.computed.netRuns);

  expect(wicketCountFromEvents(events)).toBe(sc!.computed.wickets);

  const lastTotal = lastBallTotalScore(view, inningsIdx);
  if (events.length > 0) {
    expect(lastTotal).toBe(sc!.computed.totalRuns);
  }
}

async function recordDeliveries(inningsId: string, deliveries: DeliveryInput[]) {
  for (const d of deliveries) {
    const res = await readJson(
      await recordDeliveryRoute(
        jsonRequest("POST", "/api/v1/deliveries", {
          inningsId,
          overNumber: d.overNumber,
          ballInOver: d.ballInOver,
          runsOffBat: d.runsOffBat ?? 0,
          extrasType: d.extrasType,
          extrasRuns: d.extrasRuns ?? 0,
          extrasRunsType: d.extrasRunsType,
          isLegalBall: d.isLegalBall,
          wicketType: d.wicketType,
          fielderId: d.fielderId,
          dismissedBatsmanId: d.dismissedBatsmanId,
          strikerId: d.strikerId,
          nonStrikerId: d.nonStrikerId,
          bowlerId: d.bowlerId,
        }),
        emptyParams(),
      ),
    );
    expect(res.status).toBe(201);
  }
}

async function setupU9Match() {
  const created = await readJson(
    await createU9Demo(jsonRequest("POST", "/api/v1/demo/u9-match"), emptyParams()),
  );
  expect(created.status).toBe(201);
  const matchId = created.body.data.matchId as string;

  await prisma.match.update({
    where: { id: matchId },
    data: { squadsConfirmedAt: null, tossWinnerId: null, electedTo: null },
  });

  const scoring0 = await readJson(
    await getScoring(
      jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
      params({ matchId }),
    ),
  );

  const homeTtId = scoring0.body.data.homeTeam.id as string;
  await readJson(
    await recordTossRoute(
      jsonRequest("POST", `/api/v1/matches/${matchId}/toss`, {
        tossWinnerTeamId: homeTtId,
        electedTo: "bat",
      }),
      params({ matchId }),
    ),
  );
  await readJson(
    await confirmSquadsRoute(
      jsonRequest("POST", `/api/v1/matches/${matchId}/squad/confirm`, {
        totalOvers: 4,
      }),
      params({ matchId }),
    ),
  );

  return { matchId, scoring: scoring0.body.data };
}

describe("scorecard arithmetic reconciliation", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("U9 single innings: stored/computed totals, batters, extras, ball-by-ball", async () => {
    const profile = getBuiltinProfile("u9-softball-london-v1")!;
    expect(profile.startingScore).toBe(200);
    expect(profile.wicketPenalty).toBe(5);

    const { matchId, scoring } = await setupU9Match();
    const homeTtId = scoring.homeTeam.id as string;
    const home = scoring.squads.home as { id: string }[];
    const away = scoring.squads.away as { id: string }[];
    const [p1, p2, p3] = home;
    const bowler = away[0]!;

    const inn1 = await readJson(
      await createInningsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/innings`, {
          battingTeamId: homeTtId,
          inningsNumber: 1,
        }),
        params({ matchId }),
      ),
    );
    const inningsId = inn1.body.data.id as string;

    await recordDeliveries(inningsId, [
      { overNumber: 1, ballInOver: 1, strikerId: p1!.id, nonStrikerId: p2!.id, bowlerId: bowler.id, runsOffBat: 4 },
      {
        overNumber: 1,
        ballInOver: 2,
        strikerId: p1!.id,
        nonStrikerId: p2!.id,
        bowlerId: bowler.id,
        extrasType: "wide",
        isLegalBall: false,
      },
      {
        overNumber: 1,
        ballInOver: 2,
        strikerId: p1!.id,
        nonStrikerId: p2!.id,
        bowlerId: bowler.id,
        extrasType: "wide_runs",
        extrasRuns: 2,
        isLegalBall: false,
      },
      {
        overNumber: 1,
        ballInOver: 3,
        strikerId: p1!.id,
        nonStrikerId: p2!.id,
        bowlerId: bowler.id,
        extrasType: "no_ball",
        runsOffBat: 4,
        isLegalBall: false,
      },
      {
        overNumber: 1,
        ballInOver: 4,
        strikerId: p1!.id,
        nonStrikerId: p2!.id,
        bowlerId: bowler.id,
        runsOffBat: 0,
        wicketType: "bowled",
        dismissedBatsmanId: p1!.id,
      },
      { overNumber: 1, ballInOver: 5, strikerId: p2!.id, nonStrikerId: p3!.id, bowlerId: bowler.id, runsOffBat: 1 },
      {
        overNumber: 1,
        ballInOver: 6,
        strikerId: p2!.id,
        nonStrikerId: p3!.id,
        bowlerId: bowler.id,
        extrasType: "bye",
        extrasRuns: 3,
      },
      {
        overNumber: 2,
        ballInOver: 1,
        strikerId: p2!.id,
        nonStrikerId: p3!.id,
        bowlerId: bowler.id,
        extrasType: "leg_bye",
        extrasRuns: 1,
      },
      {
        overNumber: 2,
        ballInOver: 2,
        strikerId: p2!.id,
        nonStrikerId: p3!.id,
        bowlerId: bowler.id,
        extrasType: "no_ball_runs",
        extrasRuns: 2,
        extrasRunsType: "bye",
        isLegalBall: false,
      },
      {
        overNumber: 2,
        ballInOver: 3,
        strikerId: p2!.id,
        nonStrikerId: p3!.id,
        bowlerId: bowler.id,
        runsOffBat: 0,
        wicketType: "caught",
        fielderId: away[1]!.id,
        dismissedBatsmanId: p2!.id,
      },
    ]);

    const raw = await getMatchScorecard(matchId);
    const view = await buildMatchScorecardFromRaw(raw);

    expect(raw.inningsScorecards).toHaveLength(1);
    assertInningsReconciliation(raw, view, profile, 0);

    const sc = raw.inningsScorecards[0]!;
    expect(sc.computed.batRuns).toBe(9);
    expect(sc.computed.wickets).toBe(2);
    expect(sc.computed.netRuns).toBe(-1);
    expect(view.innings[0]!.extras.wides).toBe(4);
    expect(view.innings[0]!.extras.noBalls).toBe(4);
    expect(view.innings[0]!.extras.byes).toBe(7);
    expect(view.innings[0]!.extras.legByes).toBe(1);
    expect(view.innings[0]!.extras.total).toBe(16);
  });

  it("U9 two innings: reconcile both sides after varied ball sequences", async () => {
    const profile = getBuiltinProfile("u9-softball-london-v1")!;
    const { matchId, scoring } = await setupU9Match();
    const homeTtId = scoring.homeTeam.id as string;
    const awayTtId = scoring.awayTeam.id as string;
    const home = scoring.squads.home as { id: string }[];
    const away = scoring.squads.away as { id: string }[];

    const inn1 = await readJson(
      await createInningsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/innings`, {
          battingTeamId: homeTtId,
          inningsNumber: 1,
        }),
        params({ matchId }),
      ),
    );
    await recordDeliveries(inn1.body.data.id as string, [
      { overNumber: 1, ballInOver: 1, strikerId: home[0]!.id, nonStrikerId: home[1]!.id, bowlerId: away[0]!.id, runsOffBat: 6 },
      { overNumber: 1, ballInOver: 2, strikerId: home[0]!.id, nonStrikerId: home[1]!.id, bowlerId: away[0]!.id, runsOffBat: 4 },
      {
        overNumber: 1,
        ballInOver: 3,
        strikerId: home[0]!.id,
        nonStrikerId: home[1]!.id,
        bowlerId: away[0]!.id,
        extrasType: "wide",
        isLegalBall: false,
      },
      {
        overNumber: 1,
        ballInOver: 4,
        strikerId: home[0]!.id,
        nonStrikerId: home[1]!.id,
        bowlerId: away[0]!.id,
        runsOffBat: 0,
        wicketType: "bowled",
        dismissedBatsmanId: home[0]!.id,
      },
      { overNumber: 1, ballInOver: 5, strikerId: home[1]!.id, nonStrikerId: home[2]!.id, bowlerId: away[0]!.id, runsOffBat: 2 },
    ]);

    const inn2 = await readJson(
      await createInningsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/innings`, {
          battingTeamId: awayTtId,
          inningsNumber: 2,
        }),
        params({ matchId }),
      ),
    );
    await recordDeliveries(inn2.body.data.id as string, [
      { overNumber: 1, ballInOver: 1, strikerId: away[0]!.id, nonStrikerId: away[1]!.id, bowlerId: home[0]!.id, runsOffBat: 1 },
      {
        overNumber: 1,
        ballInOver: 2,
        strikerId: away[0]!.id,
        nonStrikerId: away[1]!.id,
        bowlerId: home[0]!.id,
        extrasType: "no_ball",
        runsOffBat: 2,
        isLegalBall: false,
      },
      {
        overNumber: 1,
        ballInOver: 3,
        strikerId: away[0]!.id,
        nonStrikerId: away[1]!.id,
        bowlerId: home[0]!.id,
        extrasType: "bye",
        extrasRuns: 2,
      },
      {
        overNumber: 1,
        ballInOver: 4,
        strikerId: away[0]!.id,
        nonStrikerId: away[1]!.id,
        bowlerId: home[0]!.id,
        runsOffBat: 0,
        wicketType: "caught",
        fielderId: home[1]!.id,
        dismissedBatsmanId: away[0]!.id,
      },
      { overNumber: 1, ballInOver: 5, strikerId: away[1]!.id, nonStrikerId: away[2]!.id, bowlerId: home[0]!.id, runsOffBat: 3 },
    ]);

    const raw = await getMatchScorecard(matchId);
    const view = await buildMatchScorecardFromRaw(raw);

    expect(raw.inningsScorecards).toHaveLength(2);
    assertInningsReconciliation(raw, view, profile, 0);
    assertInningsReconciliation(raw, view, profile, 1);

    expect(raw.inningsScorecards[0]!.computed.batRuns).toBe(12);
    expect(raw.inningsScorecards[0]!.computed.wickets).toBe(1);
    expect(raw.inningsScorecards[1]!.computed.batRuns).toBe(6);
    expect(raw.inningsScorecards[1]!.computed.wickets).toBe(1);
  });

  it("standard iOS profile: reconcile extras-heavy innings (0 start, no wicket penalty)", async () => {
    const profile = getBuiltinProfile("demo-2-over-pairs-v1")!;
    expect(profile.startingScore).toBe(0);
    expect(profile.wicketPenalty).toBe(0);

    const created = await readJson(
      await createIosDemo(jsonRequest("POST", "/api/v1/demo/ios-match"), emptyParams()),
    );
    const matchId = created.body.data.matchId as string;

    const scoring0 = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    const homeId = scoring0.body.data.homeTeam.id as string;
    const strikerId = scoring0.body.data.squads.home[0]!.id as string;
    const nonStrikerId = scoring0.body.data.squads.home[1]!.id as string;
    const bowlerId = scoring0.body.data.squads.away[0]!.id as string;

    await readJson(
      await recordTossRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/toss`, {
          tossWinnerTeamId: homeId,
          electedTo: "bat",
        }),
        params({ matchId }),
      ),
    );
    await readJson(
      await confirmSquadsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/squad/confirm`, {
          totalOvers: 2,
        }),
        params({ matchId }),
      ),
    );

    const inningsRes = await readJson(
      await createInningsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/innings`, {
          battingTeamId: homeId,
          inningsNumber: 1,
        }),
        params({ matchId }),
      ),
    );

    await recordDeliveries(inningsRes.body.data.id as string, [
      {
        overNumber: 1,
        ballInOver: 1,
        strikerId,
        nonStrikerId,
        bowlerId,
        extrasType: "wide_runs",
        extrasRuns: 2,
        isLegalBall: false,
      },
      {
        overNumber: 1,
        ballInOver: 2,
        strikerId,
        nonStrikerId,
        bowlerId,
        extrasType: "no_ball",
        runsOffBat: 4,
        isLegalBall: false,
      },
      {
        overNumber: 1,
        ballInOver: 3,
        strikerId,
        nonStrikerId,
        bowlerId,
        extrasType: "no_ball_runs",
        extrasRuns: 2,
        extrasRunsType: "bye",
        isLegalBall: false,
      },
      {
        overNumber: 1,
        ballInOver: 4,
        strikerId,
        nonStrikerId,
        bowlerId,
        extrasType: "bye",
        extrasRuns: 3,
      },
      {
        overNumber: 1,
        ballInOver: 5,
        strikerId,
        nonStrikerId,
        bowlerId,
        extrasType: "leg_bye",
        extrasRuns: 1,
      },
      { overNumber: 1, ballInOver: 6, strikerId, nonStrikerId, bowlerId, runsOffBat: 2 },
    ]);

    const raw = await getMatchScorecard(matchId);
    const view = await buildMatchScorecardFromRaw(raw);

    assertInningsReconciliation(raw, view, profile, 0);
    expect(raw.inningsScorecards[0]!.computed.totalRuns).toBe(20);
    expect(raw.inningsScorecards[0]!.computed.batRuns).toBe(6);
    expect(raw.inningsScorecards[0]!.computed.netRuns).toBe(
      raw.inningsScorecards[0]!.computed.batRuns,
    );
  });
});
