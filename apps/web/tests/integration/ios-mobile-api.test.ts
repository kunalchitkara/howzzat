import { beforeEach, describe, expect, it } from "vitest";
import { POST as createIosDemo } from "@/app/api/v1/demo/ios-match/route";
import { POST as confirmSquadsRoute } from "@/app/api/v1/matches/[matchId]/squad/confirm/route";
import { POST as recordTossRoute } from "@/app/api/v1/matches/[matchId]/toss/route";
import { GET as getScoring } from "@/app/api/v1/matches/[matchId]/scoring/route";
import { POST as createInningsRoute } from "@/app/api/v1/matches/[matchId]/innings/route";
import { POST as recordDeliveryRoute } from "@/app/api/v1/deliveries/route";
import { prisma } from "@howzzat/db";
import { resetDatabase } from "@howzzat/db/testing";
import { emptyParams, jsonRequest, params, readJson } from "../helpers/request";

/** Mirrors the unauthenticated iOS client flow (home → squads → toss → score). */
describe("iOS mobile API (no auth)", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("POST /demo/ios-match returns the shape the mobile client expects", async () => {
    const res = await readJson(
      await createIosDemo(jsonRequest("POST", "/api/v1/demo/ios-match"), emptyParams()),
    );
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      homeTeam: "Edgware U9",
      awayTeam: "Hayes",
      totalOvers: 2,
      reset: false,
    });
    expect(typeof res.body.data.matchId).toBe("string");
  });

  it("GET /scoring allows demo scoring without a session (mobile skips claimScoring)", async () => {
    const created = await readJson(
      await createIosDemo(jsonRequest("POST", "/api/v1/demo/ios-match"), emptyParams()),
    );
    const matchId = created.body.data.matchId as string;

    const scoring = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    expect(scoring.status).toBe(200);
    expect(scoring.body.data.scoringLock).toMatchObject({
      requiresAuth: false,
      canScore: true,
      lockedByOther: false,
    });
    expect(scoring.body.data.squadsConfirmed).toBe(false);
    expect(scoring.body.data.playersPerSide).toBe(2);
  });

  it("squads → toss → first delivery without auth cookie", async () => {
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

    const confirmRes = await readJson(
      await confirmSquadsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/squad/confirm`, {
          totalOvers: 2,
        }),
        params({ matchId }),
      ),
    );
    expect(confirmRes.status).toBe(200);

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
    const inningsId = inningsRes.body.data.id as string;

    const deliveryRes = await readJson(
      await recordDeliveryRoute(
        jsonRequest("POST", "/api/v1/deliveries", {
          inningsId,
          overNumber: 1,
          ballInOver: 1,
          runsOffBat: 4,
          strikerId,
          nonStrikerId,
          bowlerId,
        }),
        emptyParams(),
      ),
    );
    expect(deliveryRes.status).toBe(201);

    const scoringAfter = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    expect(scoringAfter.body.data.innings[0]?.totalRuns).toBe(4);
    expect(scoringAfter.body.data.scoringLock.canScore).toBe(true);
  });

  it("resetting ios-match preserves publicSlug ios-live", async () => {
    const first = await readJson(
      await createIosDemo(jsonRequest("POST", "/api/v1/demo/ios-match"), emptyParams()),
    );
    const matchId = first.body.data.matchId as string;

    const second = await readJson(
      await createIosDemo(jsonRequest("POST", "/api/v1/demo/ios-match"), emptyParams()),
    );
    expect(second.status).toBe(200);
    expect(second.body.data.matchId).toBe(matchId);
    expect(second.body.data.reset).toBe(true);

    const row = await prisma.match.findUnique({ where: { id: matchId } });
    expect(row?.publicSlug).toBe("ios-live");
  });
});
