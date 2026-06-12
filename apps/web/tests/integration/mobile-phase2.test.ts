import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as createIosDemo } from "@/app/api/v1/demo/ios-match/route";
import { POST as setSquadRoute } from "@/app/api/v1/matches/[matchId]/squad/route";
import { POST as confirmSquadsRoute } from "@/app/api/v1/matches/[matchId]/squad/confirm/route";
import { POST as claimScoringRoute } from "@/app/api/v1/matches/[matchId]/scoring/claim/route";
import { GET as getScoring } from "@/app/api/v1/matches/[matchId]/scoring/route";
import { GET as getScorerInvite } from "@/app/api/v1/scorer-invites/[token]/route";
import { POST as acceptScorerInviteRoute } from "@/app/api/v1/scorer-invites/[token]/accept/route";
import { createMatchScorerInvite } from "@/lib/services/match-scorer-invites";
import { createMatch } from "@/lib/services/matches";
import { prisma } from "@howzzat/db";
import { resetDatabase, seedTestFixtures } from "@howzzat/db/testing";
import { SESSION_COOKIE } from "@/lib/auth/session";
import {
  emptyParams,
  jsonRequest,
  params,
  readJson,
  readResponse,
} from "../helpers/request";

/** Mobile Phase 2: squad picker API, auth scoring, scorer invite deep links. */
describe("mobile Phase 2 API", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("squad save + confirm with roster edits (mobile squad picker)", async () => {
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
    const homeTeamId = scoring0.body.data.homeTeam.teamId as string;
    const awayTeamId = scoring0.body.data.awayTeam.teamId as string;
    const homeRoster = scoring0.body.data.rosters.home as { id: string }[];
    const awayRoster = scoring0.body.data.rosters.away as { id: string }[];

    const newHome = [homeRoster[2]!.id, homeRoster[4]!.id];
    const newAway = [awayRoster[1]!.id, awayRoster[3]!.id];

    expect(
      (
        await readJson(
          await setSquadRoute(
            jsonRequest("POST", `/api/v1/matches/${matchId}/squad`, {
              teamId: homeTeamId,
              playerIds: newHome,
              captainId: newHome[0],
            }),
            params({ matchId }),
          ),
        )
      ).status,
    ).toBe(200);

    expect(
      (
        await readJson(
          await setSquadRoute(
            jsonRequest("POST", `/api/v1/matches/${matchId}/squad`, {
              teamId: awayTeamId,
              playerIds: newAway,
              captainId: newAway[0],
            }),
            params({ matchId }),
          ),
        )
      ).status,
    ).toBe(200);

    const confirmRes = await readJson(
      await confirmSquadsRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/squad/confirm`, {
          totalOvers: 2,
        }),
        params({ matchId }),
      ),
    );
    expect(confirmRes.status).toBe(200);

    const scoring1 = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    expect(scoring1.body.data.squadsConfirmed).toBe(true);
    expect(scoring1.body.data.squads.home.map((p: { id: string }) => p.id)).toEqual(
      newHome,
    );
    expect(scoring1.body.data.squads.home[0]?.isCaptain).toBe(true);
    expect(scoring1.body.data.matchTotalOvers).toBe(2);
  });

  it("signed-in org coach can claim scoring on a non-demo match", async () => {
    const fixtures = await seedTestFixtures(prisma);

    const coachLogin = await readResponse(
      await login(
        jsonRequest("POST", "/api/v1/auth/login", {
          email: "coach@mobile.club",
          name: "Coach",
        }),
        emptyParams(),
      ),
    );
    const coachCookie = coachLogin.cookies.find((c) =>
      c.startsWith(`${SESSION_COOKIE}=`),
    )!;
    const coachUser = await prisma.user.findFirstOrThrow({
      where: { email: "coach@mobile.club" },
    });

    await prisma.orgMembership.create({
      data: {
        organizationId: fixtures.orgId,
        userId: coachUser.id,
        role: "MANAGER",
      },
    });

    const match = await createMatch(fixtures.tournamentId, {
      homeTeamId: fixtures.tournamentTeamAId,
      awayTeamId: fixtures.tournamentTeamBId,
      playersPerSide: 4,
    });
    const matchId = match.id;

    const unauth = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`),
        params({ matchId }),
      ),
    );
    expect(unauth.body.data.scoringLock).toMatchObject({
      requiresAuth: true,
      canScore: false,
    });

    const authed = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scoring`, undefined, coachCookie),
        params({ matchId }),
      ),
    );
    expect(authed.body.data.scoringLock).toMatchObject({
      requiresAuth: true,
      canScore: true,
      lockedByOther: false,
    });

    const claim = await readJson(
      await claimScoringRoute(
        jsonRequest("POST", `/api/v1/matches/${matchId}/scoring/claim`, undefined, coachCookie),
        params({ matchId }),
      ),
    );
    expect(claim.status).toBe(200);
    expect(claim.body.data.scoringLock.isHolder).toBe(true);
  });

  it("scorer invite preview, accept, and scoring access", async () => {
    const fixtures = await seedTestFixtures(prisma);

    const owner = await prisma.user.create({
      data: { email: "mgr@mobile.club", name: "Manager" },
    });
    await prisma.orgMembership.create({
      data: { organizationId: fixtures.orgId, userId: owner.id, role: "OWNER" },
    });
    await prisma.tournamentManager.create({
      data: { tournamentId: fixtures.tournamentId, userId: owner.id },
    });

    const match = await prisma.match.create({
      data: {
        tournamentId: fixtures.tournamentId,
        homeTeamId: fixtures.tournamentTeamAId,
        awayTeamId: fixtures.tournamentTeamBId,
        matchNumber: 1,
        playersPerSide: 4,
        status: "SCHEDULED",
      },
    });

    const invite = await createMatchScorerInvite(
      match.id,
      owner.id,
      { email: "guest@scorer.club" },
      "http://localhost:3005",
    );

    const preview = await readJson(
      await getScorerInvite(
        jsonRequest("GET", `/api/v1/scorer-invites/${invite.token}`),
        params({ token: invite.token }),
      ),
    );
    expect(preview.status).toBe(200);
    expect(preview.body.data.matchId).toBe(match.id);
    expect(preview.body.data.matchTitle).toContain("Team");

    const guestLogin = await readResponse(
      await login(
        jsonRequest("POST", "/api/v1/auth/login", {
          email: "guest@scorer.club",
          name: "Guest Scorer",
        }),
        emptyParams(),
      ),
    );
    const guestCookie = guestLogin.cookies.find((c) =>
      c.startsWith(`${SESSION_COOKIE}=`),
    )!;

    const accept = await readJson(
      await acceptScorerInviteRoute(
        jsonRequest(
          "POST",
          `/api/v1/scorer-invites/${invite.token}/accept`,
          undefined,
          guestCookie,
        ),
        params({ token: invite.token }),
      ),
    );
    expect(accept.status).toBe(200);
    expect(accept.body.data.matchId).toBe(match.id);

    const scoring = await readJson(
      await getScoring(
        jsonRequest("GET", `/api/v1/matches/${match.id}/scoring`, undefined, guestCookie),
        params({ matchId: match.id }),
      ),
    );
    expect(scoring.body.data.scoringLock).toMatchObject({
      requiresAuth: true,
      canScore: true,
    });
  });
});
