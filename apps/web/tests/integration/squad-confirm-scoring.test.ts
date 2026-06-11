import { beforeEach, describe, expect, it } from "vitest";
import { POST as createU9Demo } from "@/app/api/v1/demo/u9-match/route";
import { POST as setSquadRoute } from "@/app/api/v1/matches/[matchId]/squad/route";
import { POST as confirmSquadsRoute } from "@/app/api/v1/matches/[matchId]/squad/confirm/route";
import { POST as reopenSquadsRoute } from "@/app/api/v1/matches/[matchId]/squad/reopen/route";
import { POST as recordTossRoute } from "@/app/api/v1/matches/[matchId]/toss/route";
import { GET as getScoring } from "@/app/api/v1/matches/[matchId]/scoring/route";
import { POST as createInningsRoute } from "@/app/api/v1/matches/[matchId]/innings/route";
import { POST as recordDeliveryRoute } from "@/app/api/v1/deliveries/route";
import { PATCH as updateDeliveryRoute } from "@/app/api/v1/deliveries/[deliveryId]/route";
import { POST as finalizeRoute } from "@/app/api/v1/matches/[matchId]/finalize/route";
import { parseApiErrorMessage } from "@/lib/client/api";
import { prisma } from "@howzzat/db";
import { resetDatabase } from "@howzzat/db/testing";
import { emptyParams, jsonRequest, params, readJson } from "../helpers/request";

/** Mirrors web ScorePad: confirm squads → toss → both innings → finalize. */
describe("squad confirm and scoring e2e", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  async function scorePadConfirmSquads(matchId: string, scoring: Record<string, unknown>) {
    const homeTeamId = scoring.homeTeam as { teamId: string };
    const awayTeamId = scoring.awayTeam as { teamId: string };
    const squads = scoring.squads as {
      home: { id: string }[];
      away: { id: string }[];
    };
    const homePlayerIds = squads.home.map((p) => p.id);
    const awayPlayerIds = squads.away.map((p) => p.id);

    await readJson(
      await setSquadRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/squad`, {
          teamId: homeTeamId.teamId,
          playerIds: homePlayerIds,
        }),
        params({ matchId }),
      ),
    );
    await readJson(
      await setSquadRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/squad`, {
          teamId: awayTeamId.teamId,
          playerIds: awayPlayerIds,
        }),
        params({ matchId }),
      ),
    );
    return readJson(
      await confirmSquadsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/squad/confirm`, {
          totalOvers: 4,
        }),
        params({ matchId }),
      ),
    );
  }

  async function bowlLegalOvers(
    inningsId: string,
    overs: number,
    strikerId: string,
    nonStrikerId: string,
    bowlerId: string,
    runsPerBall = 1,
  ) {
    for (let i = 0; i < overs * 6; i++) {
      const over = Math.floor(i / 6) + 1;
      const ball = (i % 6) + 1;
      const res = await readJson(
        await recordDeliveryRoute(
          jsonRequest("POST", "/api/v1/deliveries", {
            inningsId,
            overNumber: over,
            ballInOver: ball,
            runsOffBat: runsPerBall,
            strikerId,
            nonStrikerId,
            bowlerId,
          }),
          emptyParams(),
        ),
      );
      expect(res.status).toBe(201);
    }
  }

  it("parses API error strings (not only error.message)", () => {
    expect(parseApiErrorMessage({ error: "Confirm match squads before the toss" })).toBe(
      "Confirm match squads before the toss",
    );
    expect(parseApiErrorMessage({ error: { message: "nested" } })).toBe("nested");
  });

  it("reopen squads before match starts (back from toss)", async () => {
    const created = await readJson(
      await createU9Demo(jsonRequest("POST", "/api/v1/demo/u9-match"), emptyParams()),
    );
    const matchId = created.body.data.matchId as string;

    await prisma.match.update({
      where: { id: matchId },
      data: { squadsConfirmedAt: new Date() },
    });

    const reopen = await readJson(
      await reopenSquadsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/squad/reopen`),
        params({ matchId }),
      ),
    );
    expect(reopen.status).toBe(200);

    const scoring = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    expect(scoring.body.data.squadsConfirmed).toBe(false);
    expect(scoring.body.data.canReopenSquads).toBe(true);
    expect(scoring.body.data.toss.tossWinnerTeamId).toBeNull();
  });

  it("confirm-only when squads unchanged (ScorePad skip-save path)", async () => {
    const created = await readJson(
      await createU9Demo(jsonRequest("POST", "/api/v1/demo/u9-match"), emptyParams()),
    );
    const matchId = created.body.data.matchId as string;

    await prisma.match.update({
      where: { id: matchId },
      data: { squadsConfirmedAt: null },
    });

    const confirmRes = await readJson(
      await confirmSquadsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/squad/confirm`, {
          totalOvers: 4,
        }),
        params({ matchId }),
      ),
    );
    expect(confirmRes.status).toBe(200);

    const scoring = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    expect(scoring.body.data.squadsConfirmed).toBe(true);
    expect(scoring.body.data.canStartInnings).toBeNull();
  });

  it("full U9 demo: squads → toss → 4 overs × 2 innings → finalize", async () => {
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
    expect(scoring0.body.data.squadsConfirmed).toBe(false);
    expect(scoring0.body.data.rosters.home.length).toBe(10);
    expect(scoring0.body.data.rosters.away.length).toBe(10);
    expect(scoring0.body.data.squads.home.length).toBe(4);
    expect(scoring0.body.data.squads.away.length).toBe(4);
    expect(scoring0.body.data.squadMin).toBe(2);
    expect(scoring0.body.data.squadMax).toBe(11);
    expect(scoring0.body.data.squads.home[0]?.name).toBe("Gurfateh");
    expect(scoring0.body.data.squads.home[0]?.isCaptain).toBe(true);

    const confirmRes = await scorePadConfirmSquads(matchId, scoring0.body.data);
    expect(confirmRes.status).toBe(200);

    const homeTtId = scoring0.body.data.homeTeam.id as string;
    const awayTtId = scoring0.body.data.awayTeam.id as string;
    const homePlayers = scoring0.body.data.squads.home as { id: string }[];
    const awayPlayers = scoring0.body.data.squads.away as { id: string }[];

    await readJson(
      await recordTossRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/toss`, {
          tossWinnerTeamId: homeTtId,
          electedTo: "bat",
        }),
        params({ matchId }),
      ),
    );

    const inn1 = await readJson(
      await createInningsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/innings`, {
          battingTeamId: homeTtId,
          inningsNumber: 1,
        }),
        params({ matchId }),
      ),
    );
    const innings1Id = inn1.body.data.id as string;
    await bowlLegalOvers(
      innings1Id,
      4,
      homePlayers[0]!.id,
      homePlayers[1]!.id,
      awayPlayers[0]!.id,
    );

    const mid = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    expect(mid.body.data.innings[0]?.complete).toBe(true);
    expect(mid.body.data.canStartInnings?.inningsNumber).toBe(2);
    expect(mid.body.data.canStartInnings?.targetRuns).toBe(
      mid.body.data.innings[0]!.totalRuns + 1,
    );

    const inn2 = await readJson(
      await createInningsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/innings`, {
          battingTeamId: awayTtId,
          inningsNumber: 2,
        }),
        params({ matchId }),
      ),
    );
    const innings2Id = inn2.body.data.id as string;
    await bowlLegalOvers(
      innings2Id,
      4,
      awayPlayers[0]!.id,
      awayPlayers[1]!.id,
      homePlayers[0]!.id,
    );

    const preFin = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    expect(preFin.body.data.canFinalize).toBe(true);
    expect(preFin.body.data.suggestedResult?.line).toMatch(/won by \d+ runs/);

    const fin = await readJson(
      await finalizeRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/finalize`),
        params({ matchId }),
      ),
    );
    expect(fin.status).toBe(200);
    expect(fin.body.data.status).toBe("COMPLETED");
    expect(fin.body.data.marginText).toBeTruthy();
  });

  it("records deliveries with a 5-player squad (flexible squad size)", async () => {
    const created = await readJson(
      await createU9Demo(jsonRequest("POST", "/api/v1/demo/u9-match"), emptyParams()),
    );
    const matchId = created.body.data.matchId as string;

    const scoring0 = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    const homeTeamId = scoring0.body.data.homeTeam.teamId as string;
    const awayTeamId = scoring0.body.data.awayTeam.teamId as string;
    const homeFive = scoring0.body.data.rosters.home
      .slice(0, 5)
      .map((p: { id: string }) => p.id);

    await readJson(
      await setSquadRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/squad`, {
          teamId: homeTeamId,
          playerIds: homeFive,
        }),
        params({ matchId }),
      ),
    );
    await readJson(
      await setSquadRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/squad`, {
          teamId: awayTeamId,
          playerIds: scoring0.body.data.squads.away.map((p: { id: string }) => p.id),
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
    const inn1 = await readJson(
      await createInningsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/innings`, {
          battingTeamId: homeTtId,
          inningsNumber: 1,
        }),
        params({ matchId }),
      ),
    );
    const innings1Id = inn1.body.data.id as string;
    const awayPlayers = scoring0.body.data.squads.away as { id: string }[];

    const ball = await readJson(
      await recordDeliveryRoute(
        jsonRequest("POST", "/api/v1/deliveries", {
          inningsId: innings1Id,
          overNumber: 1,
          ballInOver: 1,
          runsOffBat: 4,
          strikerId: homeFive[0],
          nonStrikerId: homeFive[1],
          bowlerId: awayPlayers[0]!.id,
        }),
        emptyParams(),
      ),
    );
    expect(ball.status).toBe(201);

    const after = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    expect(after.body.data.innings[0]?.totalRuns).toBe(204);
    expect(after.body.data.innings[0]?.recentBalls.length).toBe(1);
    expect(after.body.data.playersPerSide).toBe(5);
  });

  it("edits a past delivery from ball history and recalculates score", async () => {
    const created = await readJson(
      await createU9Demo(jsonRequest("POST", "/api/v1/demo/u9-match"), emptyParams()),
    );
    const matchId = created.body.data.matchId as string;

    const scoring0 = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    await scorePadConfirmSquads(matchId, scoring0.body.data);

    const homeTtId = scoring0.body.data.homeTeam.id as string;
    const homePlayers = scoring0.body.data.squads.home as { id: string }[];
    const awayPlayers = scoring0.body.data.squads.away as { id: string }[];

    await readJson(
      await recordTossRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/toss`, {
          tossWinnerTeamId: homeTtId,
          electedTo: "bat",
        }),
        params({ matchId }),
      ),
    );

    const inn1 = await readJson(
      await createInningsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/innings`, {
          battingTeamId: homeTtId,
          inningsNumber: 1,
        }),
        params({ matchId }),
      ),
    );
    const innings1Id = inn1.body.data.id as string;

    const ball1 = await readJson(
      await recordDeliveryRoute(
        jsonRequest("POST", "/api/v1/deliveries", {
          inningsId: innings1Id,
          overNumber: 1,
          ballInOver: 1,
          runsOffBat: 1,
          strikerId: homePlayers[0]!.id,
          nonStrikerId: homePlayers[1]!.id,
          bowlerId: awayPlayers[0]!.id,
        }),
        emptyParams(),
      ),
    );
    const deliveryId = ball1.body.data.delivery.id as string;

    const patched = await readJson(
      await updateDeliveryRoute(
        jsonRequest("PATCH", `/api/v1/deliveries/${deliveryId}`, {
          runsOffBat: 4,
          isLegalBall: true,
          extrasType: null,
          extrasRuns: 0,
          wicketType: null,
        }),
        params({ deliveryId }),
      ),
    );
    expect(patched.status).toBe(200);

    const after = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    expect(after.body.data.innings[0]?.totalRuns).toBe(204);
    expect(after.body.data.innings[0]?.deliveries[0]?.runsOffBat).toBe(4);
  });
});
