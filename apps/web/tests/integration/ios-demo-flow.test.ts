import { beforeEach, describe, expect, it } from "vitest";
import { POST as createIosDemo } from "@/app/api/v1/demo/ios-match/route";
import { POST as confirmSquadsRoute } from "@/app/api/v1/matches/[matchId]/squad/confirm/route";
import { POST as recordTossRoute } from "@/app/api/v1/matches/[matchId]/toss/route";
import { GET as getScoring } from "@/app/api/v1/matches/[matchId]/scoring/route";
import { GET as getLive } from "@/app/api/v1/matches/[matchId]/live/route";
import { GET as getScorecard } from "@/app/api/v1/matches/[matchId]/scorecard/route";
import { POST as createInningsRoute } from "@/app/api/v1/matches/[matchId]/innings/route";
import { POST as recordDeliveryRoute } from "@/app/api/v1/deliveries/route";
import { POST as finalizeRoute } from "@/app/api/v1/matches/[matchId]/finalize/route";
import { getBuiltinProfile } from "@howzzat/rules-engine";
import { prisma } from "@howzzat/db";
import { resetDatabase } from "@howzzat/db/testing";
import { formatBallLabel } from "@/lib/scoring/ball-label";
import { maxLegalBalls } from "@/lib/scoring/ball-position";
import { emptyParams, jsonRequest, params, readJson } from "../helpers/request";

async function bowlOvers(
  inningsId: string,
  runsSequence: number[],
  strikerId: string,
  nonStrikerId: string,
  bowlerId: string,
) {
  for (let i = 0; i < runsSequence.length; i++) {
    const over = Math.floor(i / 6) + 1;
    const ball = (i % 6) + 1;
    const deliveryRes = await readJson(
      await recordDeliveryRoute(
        jsonRequest("POST", "/api/v1/deliveries", {
          inningsId,
          overNumber: over,
          ballInOver: ball,
          runsOffBat: runsSequence[i],
          strikerId,
          nonStrikerId,
          bowlerId,
        }),
        emptyParams(),
      ),
    );
    expect(deliveryRes.status).toBe(201);
  }
}

/** End-to-end flow used by the iOS 2-over demo (both teams bat). */
describe("iOS demo integration flow", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("toss → 2 overs each side → extras → scorecard → finalize", async () => {
    const profile = getBuiltinProfile("demo-2-over-pairs-v1");
    expect(profile).toBeDefined();
    expect(profile!.pairOvers).toBe(2);
    expect(profile!.format).toBe("standard_innings");

    const created = await readJson(
      await createIosDemo(jsonRequest("POST", "/api/v1/demo/ios-match"), emptyParams()),
    );
    expect(created.status).toBe(201);
    const matchId = created.body.data.matchId as string;
    expect(created.body.data.totalOvers).toBe(2);

    const scoring0 = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    expect(scoring0.status).toBe(200);
    const ctx0 = scoring0.body.data;
    expect(ctx0.totalOvers).toBe(2);
    expect(ctx0.canStartInnings).toBeNull();
    expect(ctx0.squads.home.length).toBe(2);
    expect(ctx0.squads.away.length).toBe(2);
    expect(ctx0.rosters.home.length).toBe(10);
    expect(ctx0.rosters.away.length).toBe(10);
    expect(ctx0.squads.home[0]?.name).toBe("Aanya");
    expect(ctx0.squads.home[0]?.isCaptain).toBe(true);

    expect(scoring0.body.data.squadsConfirmed).toBe(false);

    const homeId = ctx0.homeTeam.id as string;
    const awayId = ctx0.awayTeam.id as string;

    const tossRes = await readJson(
      await recordTossRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/toss`, {
          tossWinnerTeamId: homeId,
          electedTo: "bat",
        }),
        params({ matchId }),
      ),
    );
    expect(tossRes.status).toBe(200);
    expect(tossRes.body.data.battingFirstId).toBe(homeId);

    const confirmRes = await readJson(
      await confirmSquadsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/squad/confirm`, {
          totalOvers: 2,
        }),
        params({ matchId }),
      ),
    );
    expect(confirmRes.status).toBe(200);

    const strikerId = ctx0.squads.home[0]!.id as string;
    const nonStrikerId = ctx0.squads.home[1]!.id as string;
    const bowlerId = ctx0.squads.away[0]!.id as string;

    const inningsRes = await readJson(
      await createInningsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/innings`, {
          battingTeamId: homeId,
          inningsNumber: 1,
        }),
        params({ matchId }),
      ),
    );
    expect(inningsRes.status).toBe(201);
    const innings1Id = inningsRes.body.data.id as string;

    const runsSequence = [4, 1, 0, 2, 6, 0, 3, 1, 4, 0, 2];
    await bowlOvers(innings1Id, runsSequence, strikerId, nonStrikerId, bowlerId);

    const scoringAfter1 = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    expect(scoringAfter1.body.data.innings[0]?.complete).toBe(true);
    expect(scoringAfter1.body.data.canFinalize).toBe(false);
    expect(scoringAfter1.body.data.canStartInnings?.inningsNumber).toBe(2);
    expect(scoringAfter1.body.data.canStartInnings?.battingTeamId).toBe(awayId);
    const firstInningsRuns = runsSequence.reduce((a, b) => a + b, 0);
    expect(scoringAfter1.body.data.innings[0]?.totalRuns).toBe(firstInningsRuns);

    const innings2Res = await readJson(
      await createInningsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/innings`, {
          battingTeamId: awayId,
          inningsNumber: 2,
        }),
        params({ matchId }),
      ),
    );
    expect(innings2Res.status).toBe(201);
    const innings2Id = innings2Res.body.data.id as string;

    const awayStriker = ctx0.squads.away[0]!.id as string;
    const awayNonStriker = ctx0.squads.away[1]!.id as string;
    const homeBowler = ctx0.squads.home[0]!.id as string;

    await bowlOvers(innings2Id, runsSequence, awayStriker, awayNonStriker, homeBowler);

    const scoring2 = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    expect(scoring2.body.data.innings.length).toBe(2);
    expect(scoring2.body.data.innings[1]?.complete).toBe(true);
    expect(scoring2.body.data.canFinalize).toBe(true);

    const liveRes = await readJson(
      await getLive(
        jsonRequest("GET", `/api/v1/matches/${matchId}/live`),
        params({ matchId }),
      ),
    );
    expect(liveRes.status).toBe(200);
    expect(liveRes.body.data.innings.length).toBe(2);

    const cardRes = await readJson(
      await getScorecard(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scorecard`),
        params({ matchId }),
      ),
    );
    expect(cardRes.status).toBe(200);
    expect(cardRes.body.data.view.innings.length).toBe(2);
    const bbb1 = cardRes.body.data.view.ballByBall?.innings[0];
    expect(bbb1?.overs.length).toBe(2);
    const ballCount1 = bbb1?.overs.reduce((n, o) => n + o.deliveries.length, 0) ?? 0;
    expect(ballCount1).toBe(11);

    const finRes = await readJson(
      await finalizeRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/finalize`),
        params({ matchId }),
      ),
    );
    expect(finRes.status).toBe(200);
    expect(finRes.body.data.status).toBe("COMPLETED");
  });

  it("last scorable ball in 2-over innings is MJCA 1.5 before innings ends", async () => {
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
    const inningsId = inningsRes.body.data.id as string;

    await bowlOvers(inningsId, Array(10).fill(1), strikerId, nonStrikerId, bowlerId);

    const beforeLast = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    const inn = beforeLast.body.data.innings[0];
    expect(inn?.complete).toBe(false);
    expect(inn?.displayOvers).toBe("1.4");
    expect(inn?.nextBall).toEqual({ overNumber: 2, ballInOver: 5 });
    expect(formatBallLabel(inn?.nextBall.overNumber, inn?.nextBall.ballInOver)).toBe(
      "1.5",
    );

    const lastBallRes = await readJson(
      await recordDeliveryRoute(
        jsonRequest("POST", "/api/v1/deliveries", {
          inningsId,
          overNumber: 2,
          ballInOver: 5,
          runsOffBat: 1,
          strikerId,
          nonStrikerId,
          bowlerId,
        }),
        emptyParams(),
      ),
    );
    expect(lastBallRes.status).toBe(201);

    const afterLast = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    expect(afterLast.body.data.innings[0]?.complete).toBe(true);
    expect(afterLast.body.data.innings[0]?.displayOvers).toBe("2.0");
    expect(afterLast.body.data.innings[0]?.lastBall).toEqual({
      overNumber: 2,
      ballInOver: 5,
    });
    expect(maxLegalBalls(2)).toBe(11);
  });

  it("rejects a 12th legal ball in a 2-over innings", async () => {
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
    const inningsId = inningsRes.body.data.id as string;

    await bowlOvers(inningsId, Array(11).fill(1), strikerId, nonStrikerId, bowlerId);

    const extra = await readJson(
      await recordDeliveryRoute(
        jsonRequest("POST", "/api/v1/deliveries", {
          inningsId,
          overNumber: 2,
          ballInOver: 5,
          runsOffBat: 1,
          strikerId,
          nonStrikerId,
          bowlerId,
        }),
        emptyParams(),
      ),
    );
    expect(extra.status).toBe(400);
    expect(extra.body.error).toMatch(/complete|ended/i);
  });

  it("records wide+runs, no-ball+runs, byes and leg-byes on extras deliveries", async () => {
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

    const inningsRes = await readJson(
      await createInningsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/innings`, {
          battingTeamId: homeId,
          inningsNumber: 1,
        }),
        params({ matchId }),
      ),
    );
    const inningsId = inningsRes.body.data.id as string;

    const extrasCases = [
      {
        overNumber: 1,
        ballInOver: 1,
        body: {
          extrasType: "wide_runs",
          extrasRuns: 2,
          runsOffBat: 0,
          isLegalBall: false,
        },
      },
      {
        overNumber: 1,
        ballInOver: 2,
        body: {
          extrasType: "no_ball",
          extrasRuns: 0,
          runsOffBat: 4,
          isLegalBall: false,
        },
      },
      {
        overNumber: 1,
        ballInOver: 3,
        body: {
          extrasType: "no_ball_runs",
          extrasRuns: 2,
          extrasRunsType: "bye",
          runsOffBat: 0,
          isLegalBall: false,
        },
      },
      {
        overNumber: 1,
        ballInOver: 4,
        body: {
          extrasType: "bye",
          extrasRuns: 3,
          runsOffBat: 0,
          isLegalBall: true,
        },
      },
      {
        overNumber: 1,
        ballInOver: 5,
        body: {
          extrasType: "leg_bye",
          extrasRuns: 1,
          runsOffBat: 0,
          isLegalBall: true,
        },
      },
    ] as const;

    for (const c of extrasCases) {
      const res = await readJson(
        await recordDeliveryRoute(
          jsonRequest("POST", "/api/v1/deliveries", {
            inningsId,
            overNumber: c.overNumber,
            ballInOver: c.ballInOver,
            strikerId,
            nonStrikerId,
            bowlerId,
            ...c.body,
          }),
          emptyParams(),
        ),
      );
      expect(res.status).toBe(201);
    }

    const scoring = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    // Wd+2 (4), Nb+4 (6), Nb+2b (4), 3 byes, 1 leg bye
    expect(scoring.body.data.innings[0]?.totalRuns).toBe(18);
  });
});
