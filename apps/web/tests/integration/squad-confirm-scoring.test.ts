import { beforeEach, describe, expect, it } from "vitest";
import { POST as loginRoute } from "@/app/api/v1/auth/login/route";
import { POST as createIosDemo } from "@/app/api/v1/demo/ios-match/route";
import { POST as createU9Demo } from "@/app/api/v1/demo/u9-match/route";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { POST as setSquadRoute } from "@/app/api/v1/matches/[matchId]/squad/route";
import { POST as confirmSquadsRoute } from "@/app/api/v1/matches/[matchId]/squad/confirm/route";
import { POST as reopenSquadsRoute } from "@/app/api/v1/matches/[matchId]/squad/reopen/route";
import { POST as recordTossRoute } from "@/app/api/v1/matches/[matchId]/toss/route";
import { GET as getScoring } from "@/app/api/v1/matches/[matchId]/scoring/route";
import { POST as createInningsRoute } from "@/app/api/v1/matches/[matchId]/innings/route";
import { POST as recordDeliveryRoute } from "@/app/api/v1/deliveries/route";
import { PATCH as updateDeliveryRoute } from "@/app/api/v1/deliveries/[deliveryId]/route";
import { POST as finalizeRoute } from "@/app/api/v1/matches/[matchId]/finalize/route";
import { EDGWARE_U9_ROSTER, HAYES_ROSTER } from "@/lib/demo/demo-rosters";
import { maxLegalBalls } from "@/lib/scoring/ball-position";
import { parseApiErrorMessage } from "@/lib/client/api";
import { prisma } from "@howzzat/db";
import { resetDatabase } from "@howzzat/db/testing";
import {
  emptyParams,
  jsonRequest,
  params,
  readJson,
  readResponse,
} from "../helpers/request";

/** Mirrors web ScorePad: confirm squads → toss → both innings → finalize. */
describe("squad confirm and scoring e2e", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  async function recordTossForMatch(matchId: string, homeTtId: string) {
    return readJson(
      await recordTossRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/toss`, {
          tossWinnerTeamId: homeTtId,
          electedTo: "bat",
        }),
        params({ matchId }),
      ),
    );
  }

  async function scorePadConfirmSquads(matchId: string, scoring: Record<string, unknown>) {
    const homeTeam = scoring.homeTeam as { id: string; teamId: string };
    const awayTeamId = scoring.awayTeam as { teamId: string };
    const squads = scoring.squads as {
      home: { id: string }[];
      away: { id: string }[];
    };
    const homePlayerIds = squads.home.map((p) => p.id);
    const awayPlayerIds = squads.away.map((p) => p.id);

    await recordTossForMatch(matchId, homeTeam.id);

    await readJson(
      await setSquadRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/squad`, {
          teamId: homeTeam.teamId,
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
    for (let i = 0; i < maxLegalBalls(overs); i++) {
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

  it("u9-live reset migrates stale team links and rosters", async () => {
    const created = await readJson(
      await createU9Demo(jsonRequest("POST", "/api/v1/demo/u9-match"), emptyParams()),
    );
    const matchId = created.body.data.matchId as string;
    const match = await prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: { tournament: true },
    });

    const orgId = match.tournament.organizationId;
    const oldHome = await prisma.team.create({
      data: { organizationId: orgId, name: "U9 Blues", slug: "u9-blues-stale", ageGroup: "U9" },
    });
    const oldAway = await prisma.team.create({
      data: { organizationId: orgId, name: "U9 Golds", slug: "u9-golds-stale", ageGroup: "U9" },
    });
    for (const [teamId, names] of [
      [oldHome.id, ["Gurfateh", "Arjun", "Avyaan", "Noah", "Leo"]],
      [oldAway.id, ["Gurfateh", "Arjun", "Avyaan", "Noah", "Leo"]],
    ] as const) {
      for (const name of names) {
        const player = await prisma.player.create({
          data: { legalName: name, displayName: name },
        });
        await prisma.teamMembership.create({
          data: { teamId, playerId: player.id, seasonLabel: "u9-demo", shirtNumber: 1 },
        });
      }
    }
    const oldHomeTt = await prisma.tournamentTeam.create({
      data: { tournamentId: match.tournamentId, teamId: oldHome.id, publicSlug: "stale-blues" },
    });
    const oldAwayTt = await prisma.tournamentTeam.create({
      data: { tournamentId: match.tournamentId, teamId: oldAway.id, publicSlug: "stale-golds" },
    });
    await prisma.match.update({
      where: { id: matchId },
      data: { homeTeamId: oldHomeTt.id, awayTeamId: oldAwayTt.id, venue: "Canons High School (U9 demo)" },
    });

    await readJson(
      await createU9Demo(jsonRequest("POST", "/api/v1/demo/u9-match"), emptyParams()),
    );

    const scoring = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    expect(scoring.body.data.homeTeam.name).toBe("Edgware U9");
    expect(scoring.body.data.awayTeam.name).toBe("Hayes");
    expect(scoring.body.data.venue).toBe("U9 Demo Ground");

    const homeRosterNames = (scoring.body.data.rosters.home as { name: string }[]).map(
      (p) => p.name,
    );
    const awayRosterNames = (scoring.body.data.rosters.away as { name: string }[]).map(
      (p) => p.name,
    );
    expect(homeRosterNames).toEqual([...EDGWARE_U9_ROSTER]);
    expect(awayRosterNames).toEqual([...HAYES_ROSTER]);
  });

  it("u9-live reset has no duplicate roster names after ios-demo seed", async () => {
    await readJson(
      await createIosDemo(jsonRequest("POST", "/api/v1/demo/ios-match"), emptyParams()),
    );
    const created = await readJson(
      await createU9Demo(jsonRequest("POST", "/api/v1/demo/u9-match"), emptyParams()),
    );
    const matchId = created.body.data.matchId as string;

    const scoring = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    const homeRoster = scoring.body.data.rosters.home as { id: string; name: string }[];
    const awayRoster = scoring.body.data.rosters.away as { id: string; name: string }[];

    expect(homeRoster).toHaveLength(EDGWARE_U9_ROSTER.length);
    expect(awayRoster).toHaveLength(HAYES_ROSTER.length);
    expect(new Set(homeRoster.map((p) => p.id)).size).toBe(homeRoster.length);
    expect(new Set(awayRoster.map((p) => p.id)).size).toBe(awayRoster.length);
    expect(new Set(homeRoster.map((p) => p.name)).size).toBe(homeRoster.length);
    expect(new Set(awayRoster.map((p) => p.name)).size).toBe(awayRoster.length);
    expect(homeRoster.map((p) => p.name)).toEqual([...EDGWARE_U9_ROSTER]);
    expect(awayRoster.map((p) => p.name)).toEqual([...HAYES_ROSTER]);
  });

  it("u9-live: toss → first delivery without auth", async () => {
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
    expect(scoring0.body.data.scoringLock).toMatchObject({
      requiresAuth: false,
      canScore: true,
    });

    const homeTtId = scoring0.body.data.homeTeam.id as string;
    const homePlayers = scoring0.body.data.squads.home as { id: string }[];
    const awayPlayers = scoring0.body.data.squads.away as { id: string }[];

    await recordTossForMatch(matchId, homeTtId);
    await readJson(
      await confirmSquadsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/squad/confirm`, {
          totalOvers: 4,
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
    expect(inn1.status).toBe(201);

    const delivery = await readJson(
      await recordDeliveryRoute(
        jsonRequest("POST", "/api/v1/deliveries", {
          inningsId: inn1.body.data.id,
          overNumber: 1,
          ballInOver: 1,
          runsOffBat: 4,
          strikerId: homePlayers[0]!.id,
          nonStrikerId: homePlayers[1]!.id,
          bowlerId: awayPlayers[0]!.id,
        }),
        emptyParams(),
      ),
    );
    expect(delivery.status).toBe(201);
  });

  it("u9-live: signed-in non-coach can score after toss", async () => {
    const created = await readJson(
      await createU9Demo(jsonRequest("POST", "/api/v1/demo/u9-match"), emptyParams()),
    );
    const matchId = created.body.data.matchId as string;

    const loginRes = await readResponse(
      await loginRoute(
        jsonRequest("POST", "/api/v1/auth/login", {
          email: "parent@example.com",
          name: "Parent",
        }),
        emptyParams(),
      ),
    );
    const cookie = loginRes.cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;

    const scoring0 = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`, undefined, cookie),
        params({ matchId }),
      ),
    );
    expect(scoring0.body.data.scoringLock).toMatchObject({
      requiresAuth: false,
      canScore: true,
    });

    const homeTtId = scoring0.body.data.homeTeam.id as string;
    const homePlayers = scoring0.body.data.squads.home as { id: string }[];
    const awayPlayers = scoring0.body.data.squads.away as { id: string }[];

    await recordTossForMatch(matchId, homeTtId);
    await readJson(
      await confirmSquadsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/squad/confirm`, {
          totalOvers: 4,
        }),
        params({ matchId }),
      ),
    );

    const inn1 = await readJson(
      await createInningsRoute(
        jsonRequest(
          "POST",
          `/api/v1/matches/${matchId}/innings`,
          {
            battingTeamId: homeTtId,
            inningsNumber: 1,
          },
          cookie,
        ),
        params({ matchId }),
      ),
    );
    expect(inn1.status).toBe(201);

    const delivery = await readJson(
      await recordDeliveryRoute(
        jsonRequest(
          "POST",
          "/api/v1/deliveries",
          {
            inningsId: inn1.body.data.id,
            overNumber: 1,
            ballInOver: 1,
            runsOffBat: 1,
            strikerId: homePlayers[0]!.id,
            nonStrikerId: homePlayers[1]!.id,
            bowlerId: awayPlayers[0]!.id,
          },
          cookie,
        ),
        emptyParams(),
      ),
    );
    expect(delivery.status).toBe(201);
  });

  it("parses API error strings (not only error.message)", () => {
    expect(parseApiErrorMessage({ error: "Record the toss before confirming lineups" })).toBe(
      "Record the toss before confirming lineups",
    );
    expect(parseApiErrorMessage({ error: { message: "nested" } })).toBe("nested");
  });

  it("reopen squads before match starts (keeps toss)", async () => {
    const created = await readJson(
      await createU9Demo(jsonRequest("POST", "/api/v1/demo/u9-match"), emptyParams()),
    );
    const matchId = created.body.data.matchId as string;
    const homeTtId = (
      await readJson(
        await getScoring(
          jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
          params({ matchId }),
        ),
      )
    ).body.data.homeTeam.id as string;

    await prisma.match.update({
      where: { id: matchId },
      data: {
        squadsConfirmedAt: new Date(),
        tossWinnerId: homeTtId,
        electedTo: "bat",
      },
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
    expect(scoring.body.data.toss.tossWinnerTeamId).toBe(homeTtId);
  });

  it("confirm-only when squads unchanged (ScorePad skip-save path)", async () => {
    const created = await readJson(
      await createU9Demo(jsonRequest("POST", "/api/v1/demo/u9-match"), emptyParams()),
    );
    const matchId = created.body.data.matchId as string;
    const homeTtId = (
      await readJson(
        await getScoring(
          jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
          params({ matchId }),
        ),
      )
    ).body.data.homeTeam.id as string;

    await prisma.match.update({
      where: { id: matchId },
      data: { squadsConfirmedAt: null, tossWinnerId: null, electedTo: null },
    });

    await recordTossForMatch(matchId, homeTtId);

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
    expect(scoring.body.data.canStartInnings).not.toBeNull();
  });

  it("full U9 demo: toss → lineups → 4 overs × 2 innings → finalize", async () => {
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
    expect(scoring0.body.data.squadMin).toBe(4);
    expect(scoring0.body.data.squadMax).toBe(11);
    expect(scoring0.body.data.squads.home[0]?.name).toBe("Aanya");
    expect(scoring0.body.data.squads.home[0]?.isCaptain).toBe(true);

    const confirmRes = await scorePadConfirmSquads(matchId, scoring0.body.data);
    expect(confirmRes.status).toBe(200);

    const homeTtId = scoring0.body.data.homeTeam.id as string;
    const awayTtId = scoring0.body.data.awayTeam.id as string;
    const homePlayers = scoring0.body.data.squads.home as { id: string }[];
    const awayPlayers = scoring0.body.data.squads.away as { id: string }[];

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

    const homeTtId = scoring0.body.data.homeTeam.id as string;
    await recordTossForMatch(matchId, homeTtId);

    await readJson(
      await confirmSquadsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/squad/confirm`, {
          totalOvers: 4,
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
