import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { GET as me } from "@/app/api/v1/auth/me/route";
import { GET as listOrgs, POST as createOrg } from "@/app/api/v1/organizations/route";
import {
  POST as createTournamentRoute,
} from "@/app/api/v1/organizations/[orgId]/tournaments/route";
import { POST as createTeamRoute } from "@/app/api/v1/organizations/[orgId]/teams/route";
import { POST as addTournamentTeam } from "@/app/api/v1/tournaments/[tournamentId]/teams/route";
import { POST as createMatchRoute } from "@/app/api/v1/tournaments/[tournamentId]/matches/route";
import { POST as createInviteRoute } from "@/app/api/v1/tournaments/[tournamentId]/invites/route";
import { POST as acceptInviteRoute } from "@/app/api/v1/invites/[token]/accept/route";
import { GET as getInvite } from "@/app/api/v1/invites/[token]/route";
import { POST as addPlayer } from "@/app/api/v1/teams/[teamId]/players/route";
import { prisma } from "@howzzat/db";
import { resetDatabase, seedRulesProfile } from "@howzzat/db/testing";
import { SESSION_COOKIE } from "@/lib/auth/session";
import {
  emptyParams,
  jsonRequest,
  params,
  readJson,
  readResponse,
} from "../helpers/request";

/** Phase 1 happy path: auth → org → tournament → team → player → invite → accept → match */
describe("Phase 1 e2e", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedRulesProfile(prisma);
  });

  it("owner flow through invite accept and match creation", async () => {
    const ownerLogin = await readResponse(
      await login(
        jsonRequest("POST", "/api/v1/auth/login", {
          email: "owner@phase1.club",
          name: "Phase Owner",
        }),
        emptyParams(),
      ),
    );
    expect(ownerLogin.status).toBe(200);
    const ownerCookie = ownerLogin.cookies.find((c) =>
      c.startsWith(`${SESSION_COOKIE}=`),
    )!;

    const orgRes = await readJson(
      await createOrg(
        jsonRequest(
          "POST",
          "/api/v1/organizations",
          { name: "Phase 1 CC", slug: "phase-1-cc" },
          ownerCookie,
        ),
        emptyParams(),
      ),
    );
    expect(orgRes.status).toBe(201);
    const orgId = orgRes.body.data.id as string;

    const teamRes = await readJson(
      await createTeamRoute(
        jsonRequest("POST", `/api/v1/organizations/${orgId}/teams`, {
          name: "U9 Lions",
          ageGroup: "U9",
        }),
        params({ orgId }),
      ),
    );
    expect(teamRes.status).toBe(201);
    const teamId = teamRes.body.data.id as string;

    const tourRes = await readJson(
      await createTournamentRoute(
        jsonRequest("POST", `/api/v1/organizations/${orgId}/tournaments`, {
          name: "Summer League",
          rulesTemplateBuiltinId: "u9-softball-london-v1",
        }),
        params({ orgId }),
      ),
    );
    expect(tourRes.status).toBe(201);
    const tournamentId = tourRes.body.data.id as string;

    const awayRes = await readJson(
      await createTeamRoute(
        jsonRequest("POST", `/api/v1/organizations/${orgId}/teams`, {
          name: "U9 Tigers",
        }),
        params({ orgId }),
      ),
    );
    const ttHome = await readJson(
      await addTournamentTeam(
        jsonRequest("POST", `/api/v1/tournaments/${tournamentId}/teams`, {
          teamId,
        }),
        params({ tournamentId }),
      ),
    );
    const ttAway = await readJson(
      await addTournamentTeam(
        jsonRequest("POST", `/api/v1/tournaments/${tournamentId}/teams`, {
          teamId: awayRes.body.data.id,
        }),
        params({ tournamentId }),
      ),
    );

    const playerRes = await readJson(
      await addPlayer(
        jsonRequest("POST", `/api/v1/teams/${teamId}/players`, {
          legalName: "Jamie",
          shirtNumber: 7,
        }),
        params({ teamId }),
      ),
    );
    expect(playerRes.status).toBe(201);

    const inviteRes = await readJson(
      await createInviteRoute(
        jsonRequest("POST", `/api/v1/tournaments/${tournamentId}/invites`, {
          email: "coach@phase1.club",
          kind: "ORG_COACH",
          role: "COACH",
        }),
        params({ tournamentId }),
      ),
    );
    expect(inviteRes.status).toBe(201);
    const token = inviteRes.body.data.token as string;

    const preview = await readJson(
      await getInvite(
        jsonRequest("GET", `/api/v1/invites/${token}`),
        params({ token }),
      ),
    );
    expect(preview.status).toBe(200);
    expect(preview.body.data.email).toBe("coach@phase1.club");

    const coachLogin = await readResponse(
      await login(
        jsonRequest("POST", "/api/v1/auth/login", {
          email: "coach@phase1.club",
          name: "Phase Coach",
        }),
        emptyParams(),
      ),
    );
    const coachCookie = coachLogin.cookies.find((c) =>
      c.startsWith(`${SESSION_COOKIE}=`),
    )!;

    const acceptRes = await readJson(
      await acceptInviteRoute(
        jsonRequest("POST", `/api/v1/invites/${token}/accept`, undefined, coachCookie),
        params({ token }),
      ),
    );
    expect(acceptRes.status).toBe(200);

    const membership = await prisma.orgMembership.findFirst({
      where: { organizationId: orgId, user: { email: "coach@phase1.club" } },
    });
    expect(membership?.role).toBe("COACH");

    const coachOrgs = await readJson(
      await listOrgs(jsonRequest("GET", "/api/v1/organizations", undefined, coachCookie), emptyParams()),
    );
    expect(coachOrgs.body.data).toHaveLength(1);
    expect(coachOrgs.body.data[0].id).toBe(orgId);

    const matchRes = await readJson(
      await createMatchRoute(
        jsonRequest("POST", `/api/v1/tournaments/${tournamentId}/matches`, {
          homeTeamId: ttHome.body.data.id,
          awayTeamId: ttAway.body.data.id,
          venue: "Main Ground",
        }),
        params({ tournamentId }),
      ),
    );
    expect(matchRes.status).toBe(201);
    expect(matchRes.body.data.venue).toBe("Main Ground");

    const coachMe = await readJson(
      await me(jsonRequest("GET", "/api/v1/auth/me", undefined, coachCookie), emptyParams()),
    );
    expect(coachMe.body.data?.email).toBe("coach@phase1.club");
  });

  it("rejects invite accept when signed in with a different email", async () => {
    const ownerLogin = await readResponse(
      await login(
        jsonRequest("POST", "/api/v1/auth/login", { email: "owner@phase1.club" }),
        emptyParams(),
      ),
    );
    const ownerCookie = ownerLogin.cookies.find((c) =>
      c.startsWith(`${SESSION_COOKIE}=`),
    )!;

    const orgRes = await readJson(
      await createOrg(
        jsonRequest("POST", "/api/v1/organizations", { name: "Club" }, ownerCookie),
        emptyParams(),
      ),
    );
    const orgId = orgRes.body.data.id as string;

    const tourRes = await readJson(
      await createTournamentRoute(
        jsonRequest("POST", `/api/v1/organizations/${orgId}/tournaments`, {
          name: "Test Cup",
          rulesTemplateBuiltinId: "u9-softball-london-v1",
        }),
        params({ orgId }),
      ),
    );
    const tournamentId = tourRes.body.data.id as string;

    const inviteRes = await readJson(
      await createInviteRoute(
        jsonRequest("POST", `/api/v1/tournaments/${tournamentId}/invites`, {
          email: "coach@phase1.club",
          kind: "ORG_COACH",
          role: "COACH",
        }),
        params({ tournamentId }),
      ),
    );
    const token = inviteRes.body.data.token as string;

    const wrongLogin = await readResponse(
      await login(
        jsonRequest("POST", "/api/v1/auth/login", { email: "other@phase1.club" }),
        emptyParams(),
      ),
    );
    const wrongCookie = wrongLogin.cookies.find((c) =>
      c.startsWith(`${SESSION_COOKIE}=`),
    )!;

    const acceptRes = await readJson(
      await acceptInviteRoute(
        jsonRequest("POST", `/api/v1/invites/${token}/accept`, undefined, wrongCookie),
        params({ token }),
      ),
    );
    expect(acceptRes.status).toBe(403);
    expect(acceptRes.body.code).toBe("INVITE_EMAIL_MISMATCH");
  });
});
