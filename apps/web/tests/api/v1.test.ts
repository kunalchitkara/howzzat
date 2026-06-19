import { beforeEach, describe, expect, it } from "vitest";
import { GET as listOrgs, POST as createOrg } from "@/app/api/v1/organizations/route";
import { GET as getOrg } from "@/app/api/v1/organizations/[orgId]/route";
import {
  GET as listTournaments,
  POST as createTournamentRoute,
} from "@/app/api/v1/organizations/[orgId]/tournaments/route";
import { POST as createTeamRoute } from "@/app/api/v1/organizations/[orgId]/teams/route";
import { POST as addTournamentTeam } from "@/app/api/v1/tournaments/[tournamentId]/teams/route";
import { POST as createMatchRoute } from "@/app/api/v1/tournaments/[tournamentId]/matches/route";
import { POST as createInningsRoute } from "@/app/api/v1/matches/[matchId]/innings/route";
import { POST as recordDeliveryRoute } from "@/app/api/v1/deliveries/route";
import { GET as getScorecard } from "@/app/api/v1/matches/[matchId]/scorecard/route";
import { GET as publicTournament } from "@/app/api/v1/public/orgs/[orgSlug]/tournaments/[tournamentSlug]/route";
import { GET as listProfiles } from "@/app/api/v1/rules/profiles/route";
import { prisma } from "@howzzat/db";
import { resetDatabase, seedRulesProfile } from "@howzzat/db/testing";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { SESSION_COOKIE } from "@/lib/auth/session";
import {
  emptyParams,
  jsonRequest,
  params,
  readJson,
  readResponse,
} from "../helpers/request";

describe("API v1 integration", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedRulesProfile(prisma);
  });

  it("GET /organizations returns empty then created org", async () => {
    const empty = await readJson(await listOrgs(jsonRequest("GET", "/api/v1/organizations"), emptyParams()));
    expect(empty.status).toBe(200);
    expect(empty.body.data).toEqual([]);

    const created = await readJson(
      await createOrg(
        jsonRequest("POST", "/api/v1/organizations", {
          name: "API Test Club",
          slug: "api-test-club",
        }),
        emptyParams(),
      ),
    );
    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe("api-test-club");
  });

  it("returns 404 for unknown organization", async () => {
    const res = await readJson(
      await getOrg(
        jsonRequest("GET", "/api/v1/organizations/missing"),
        params({ orgId: "nonexistent-id" }),
      ),
    );
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ORG_NOT_FOUND");
  });

  it("returns validation error for bad JSON body", async () => {
    const res = await readJson(
      await createOrg(
        new Request("http://localhost/api/v1/organizations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "x" }),
        }),
        emptyParams(),
      ),
    );
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("GET /rules/profiles lists builtin template", async () => {
    const res = await readJson(
      await listProfiles(jsonRequest("GET", "/api/v1/rules/profiles"), emptyParams()),
    );
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(11);
    const builtinIds = res.body.data.map((t: { builtinId: string }) => t.builtinId);
    expect(builtinIds).toContain("u9-softball-london-v1");
    expect(builtinIds).toContain("mjca-u9-outdoor-v1");
    expect(builtinIds).toContain("mjca-u17-premier-v1");
  });

  it("full scoring flow via API routes", async () => {
    const loginRes = await readResponse(
      await login(
        jsonRequest("POST", "/api/v1/auth/login", {
          email: "scorer@flow.club",
          name: "Flow Scorer",
        }),
        emptyParams(),
      ),
    );
    const cookie = loginRes.cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;

    const orgRes = await readJson(
      await createOrg(
        jsonRequest(
          "POST",
          "/api/v1/organizations",
          { name: "Flow Club", slug: "flow-club" },
          cookie,
        ),
        emptyParams(),
      ),
    );
    const orgId = orgRes.body.data.id as string;

    const teamARes = await readJson(
      await createTeamRoute(
        jsonRequest("POST", `/api/v1/organizations/${orgId}/teams`, {
          name: "Home Team",
        }),
        params({ orgId }),
      ),
    );
    const teamBRes = await readJson(
      await createTeamRoute(
        jsonRequest("POST", `/api/v1/organizations/${orgId}/teams`, {
          name: "Away Team",
        }),
        params({ orgId }),
      ),
    );

    const tourRes = await readJson(
      await createTournamentRoute(
        jsonRequest("POST", `/api/v1/organizations/${orgId}/tournaments`, {
          name: "Flow Tournament",
          rulesTemplateBuiltinId: "u9-softball-london-v1",
        }),
        params({ orgId }),
      ),
    );
    const tournamentId = tourRes.body.data.id as string;

    const ttA = await readJson(
      await addTournamentTeam(
        jsonRequest("POST", `/api/v1/tournaments/${tournamentId}/teams`, {
          teamId: teamARes.body.data.id,
        }),
        params({ tournamentId }),
      ),
    );
    const ttB = await readJson(
      await addTournamentTeam(
        jsonRequest("POST", `/api/v1/tournaments/${tournamentId}/teams`, {
          teamId: teamBRes.body.data.id,
        }),
        params({ tournamentId }),
      ),
    );

    const { POST: addPlayer } = await import(
      "@/app/api/v1/teams/[teamId]/players/route"
    );
    const teamId = teamARes.body.data.id as string;
    const players: string[] = [];
    for (const name of ["P1", "P2", "P3", "P4"]) {
      const p = await readJson(
        await addPlayer(
          jsonRequest("POST", `/api/v1/teams/${teamId}/players`, {
            legalName: name,
          }),
          params({ teamId }),
        ),
      );
      players.push(p.body.data.player.id);
    }

    const matchRes = await readJson(
      await createMatchRoute(
        jsonRequest("POST", `/api/v1/tournaments/${tournamentId}/matches`, {
          homeTeamId: ttA.body.data.id,
          awayTeamId: ttB.body.data.id,
        }),
        params({ tournamentId }),
      ),
    );
    const matchId = matchRes.body.data.id as string;

    const inningsRes = await readJson(
      await createInningsRoute(
        jsonRequest(
          "POST",
          `/api/v1/matches/${matchId}/innings`,
          {
            battingTeamId: ttA.body.data.id,
            inningsNumber: 1,
          },
          cookie,
        ),
        params({ matchId }),
      ),
    );
    const inningsId = inningsRes.body.data.id as string;

    const deliveryRes = await readJson(
      await recordDeliveryRoute(
        jsonRequest(
          "POST",
          "/api/v1/deliveries",
          {
            inningsId,
            overNumber: 1,
            ballInOver: 1,
            runsOffBat: 4,
            strikerId: players[0],
            nonStrikerId: players[1],
            bowlerId: players[2],
          },
          cookie,
        ),
        emptyParams(),
      ),
    );
    expect(deliveryRes.status).toBe(201);
    expect(deliveryRes.body.data.innings.runs).toBe(204);

    const scorecardRes = await readJson(
      await getScorecard(
        jsonRequest("GET", `/api/v1/matches/${matchId}/scorecard`),
        params({ matchId }),
      ),
    );
    expect(scorecardRes.status).toBe(200);
    expect(scorecardRes.body.data.inningsScorecards[0].computed.batRuns).toBe(4);
  });

  it("GET public tournament by slug", async () => {
    const orgRes = await readJson(
      await createOrg(
        jsonRequest("POST", "/api/v1/organizations", {
          name: "Public Club",
          slug: "public-club",
        }),
        emptyParams(),
      ),
    );
    const orgId = orgRes.body.data.id as string;

    await readJson(
      await createTournamentRoute(
        jsonRequest("POST", `/api/v1/organizations/${orgId}/tournaments`, {
          name: "Public T",
          slug: "public-t",
          isPublic: true,
          rulesTemplateBuiltinId: "u9-softball-london-v1",
        }),
        params({ orgId }),
      ),
    );

    const res = await readJson(
      await publicTournament(
        jsonRequest("GET", "/api/v1/public/orgs/public-club/tournaments/public-t"),
        params({ orgSlug: "public-club", tournamentSlug: "public-t" }),
      ),
    );
    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe("public-t");
  });
});
