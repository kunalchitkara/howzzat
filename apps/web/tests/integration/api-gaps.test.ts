import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as loginRoute } from "@/app/api/v1/auth/login/route";
import { POST as createOrgRoute } from "@/app/api/v1/organizations/route";
import { POST as createTournamentRoute } from "@/app/api/v1/organizations/[orgId]/tournaments/route";
import { POST as createMatchRoute } from "@/app/api/v1/tournaments/[tournamentId]/matches/route";
import { POST as createInviteRoute } from "@/app/api/v1/tournaments/[tournamentId]/invites/route";
import { DELETE as deleteInviteRoute } from "@/app/api/v1/tournaments/[tournamentId]/invites/[inviteId]/route";
import { POST as demoU9Route } from "@/app/api/v1/demo/u9-match/route";
import { POST as recordDeliveryRoute } from "@/app/api/v1/deliveries/route";
import { POST as createInningsRoute } from "@/app/api/v1/matches/[matchId]/innings/route";
import { POST as addTournamentTeam } from "@/app/api/v1/tournaments/[tournamentId]/teams/route";
import { POST as createTeamRoute } from "@/app/api/v1/organizations/[orgId]/teams/route";
import { prisma } from "@howzzat/db";
import { resetDatabase, seedRulesProfile, seedTestFixtures } from "@howzzat/db/testing";
import { createInvite } from "@/lib/services/invites";
import { SESSION_COOKIE } from "@/lib/auth/session";
import {
  emptyParams,
  jsonRequest,
  params,
  readJson,
  readResponse,
} from "../helpers/request";

async function loginCookie(email: string, name?: string): Promise<string> {
  const res = await readResponse(
    await loginRoute(
      jsonRequest("POST", "/api/v1/auth/login", { email, name }),
      emptyParams(),
    ),
  );
  const match = res.cookies.join(";").match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return `${SESSION_COOKIE}=${match?.[1]}`;
}

describe("tenant isolation", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedRulesProfile(prisma);
  });

  it("user B cannot create tournament in user A org (403)", async () => {
    const ownerCookie = await loginCookie("owner-a@test.club", "Owner A");
    const outsiderCookie = await loginCookie("outsider-b@test.club", "Outsider B");

    const orgRes = await readJson(
      await createOrgRoute(
        jsonRequest("POST", "/api/v1/organizations", { name: "Club A" }, ownerCookie),
        emptyParams(),
      ),
    );
    const orgId = orgRes.body.data.id as string;

    const denied = await readJson(
      await createTournamentRoute(
        jsonRequest(
          "POST",
          `/api/v1/organizations/${orgId}/tournaments`,
          { name: "Stolen Cup", rulesTemplateBuiltinId: "u9-softball-london-v1" },
          outsiderCookie,
        ),
        params({ orgId }),
      ),
    );
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe("FORBIDDEN");
  });

  it("user B cannot schedule match in user A tournament (403)", async () => {
    const fixtures = await seedTestFixtures(prisma);
    const outsiderCookie = await loginCookie("outsider-b@test.club");

    const denied = await readJson(
      await createMatchRoute(
        jsonRequest(
          "POST",
          `/api/v1/tournaments/${fixtures.tournamentId}/matches`,
          {
            homeTeamId: fixtures.tournamentTeamAId,
            awayTeamId: fixtures.tournamentTeamBId,
          },
          outsiderCookie,
        ),
        params({ tournamentId: fixtures.tournamentId }),
      ),
    );
    expect(denied.status).toBe(403);
  });

  it("user B cannot create or delete invites on user A tournament (403)", async () => {
    const fixtures = await seedTestFixtures(prisma);
    const outsiderCookie = await loginCookie("outsider-b@test.club");
    const ownerCookie = await loginCookie("owner-a@test.club");
    await prisma.orgMembership.create({
      data: {
        organizationId: fixtures.orgId,
        userId: (
          await prisma.user.findUniqueOrThrow({ where: { email: "owner-a@test.club" } })
        ).id,
        role: "OWNER",
      },
    });

    const createDenied = await readJson(
      await createInviteRoute(
        jsonRequest(
          "POST",
          `/api/v1/tournaments/${fixtures.tournamentId}/invites`,
          { email: "spy@test.club", kind: "MANAGER" },
          outsiderCookie,
        ),
        params({ tournamentId: fixtures.tournamentId }),
      ),
    );
    expect(createDenied.status).toBe(403);

    const invite = await createInvite(fixtures.tournamentId, {
      email: "pending@test.club",
      kind: "MANAGER",
    });

    const deleteDenied = await readJson(
      await deleteInviteRoute(
        jsonRequest(
          "DELETE",
          `/api/v1/tournaments/${fixtures.tournamentId}/invites/${invite.id}`,
          undefined,
          outsiderCookie,
        ),
        params({ tournamentId: fixtures.tournamentId, inviteId: invite.id }),
      ),
    );
    expect(deleteDenied.status).toBe(403);

    const deleteOk = await readJson(
      await deleteInviteRoute(
        jsonRequest(
          "DELETE",
          `/api/v1/tournaments/${fixtures.tournamentId}/invites/${invite.id}`,
          undefined,
          ownerCookie,
        ),
        params({ tournamentId: fixtures.tournamentId, inviteId: invite.id }),
      ),
    );
    expect(deleteOk.status).toBe(200);
  });
});

describe("demo reset guard (integration)", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedRulesProfile(prisma);
  });

  it("returns 403 in production when DEMO_RESET_SECRET is set and header missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_RESET_SECRET", "prod-secret");
    vi.stubEnv("ALLOW_DEMO_RESET", "");

    const res = await readJson(
      await demoU9Route(
        jsonRequest("POST", "/api/v1/demo/u9-match"),
        emptyParams(),
      ),
    );
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("DEMO_RESET_FORBIDDEN");

    vi.unstubAllEnvs();
  });
});

describe("delivery idempotency (API)", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedRulesProfile(prisma);
  });

  it("POST /deliveries deduplicates on clientDeliveryId", async () => {
    const cookie = await loginCookie("scorer@test.club", "Scorer");
    const orgRes = await readJson(
      await createOrgRoute(
        jsonRequest("POST", "/api/v1/organizations", { name: "Idem Club" }, cookie),
        emptyParams(),
      ),
    );
    const orgId = orgRes.body.data.id as string;

    const teamA = await readJson(
      await createTeamRoute(
        jsonRequest("POST", `/api/v1/organizations/${orgId}/teams`, { name: "Home" }, cookie),
        params({ orgId }),
      ),
    );
    const teamB = await readJson(
      await createTeamRoute(
        jsonRequest("POST", `/api/v1/organizations/${orgId}/teams`, { name: "Away" }, cookie),
        params({ orgId }),
      ),
    );

    const tourRes = await readJson(
      await createTournamentRoute(
        jsonRequest(
          "POST",
          `/api/v1/organizations/${orgId}/tournaments`,
          { name: "Idem Cup", rulesTemplateBuiltinId: "u9-softball-london-v1" },
          cookie,
        ),
        params({ orgId }),
      ),
    );
    const tournamentId = tourRes.body.data.id as string;

    const ttA = await readJson(
      await addTournamentTeam(
        jsonRequest("POST", `/api/v1/tournaments/${tournamentId}/teams`, {
          teamId: teamA.body.data.id,
        }),
        params({ tournamentId }),
      ),
    );
    const ttB = await readJson(
      await addTournamentTeam(
        jsonRequest("POST", `/api/v1/tournaments/${tournamentId}/teams`, {
          teamId: teamB.body.data.id,
        }),
        params({ tournamentId }),
      ),
    );

    const matchRes = await readJson(
      await createMatchRoute(
        jsonRequest(
          "POST",
          `/api/v1/tournaments/${tournamentId}/matches`,
          { homeTeamId: ttA.body.data.id, awayTeamId: ttB.body.data.id },
          cookie,
        ),
        params({ tournamentId }),
      ),
    );
    const matchId = matchRes.body.data.id as string;

    const { POST: addPlayer } = await import("@/app/api/v1/teams/[teamId]/players/route");
    const players: string[] = [];
    for (const name of ["P1", "P2", "P3"]) {
      const p = await readJson(
        await addPlayer(
          jsonRequest("POST", `/api/v1/teams/${teamA.body.data.id}/players`, {
            legalName: name,
          }),
          params({ teamId: teamA.body.data.id }),
        ),
      );
      players.push(p.body.data.player.id);
    }

    const inningsRes = await readJson(
      await createInningsRoute(
        jsonRequest(
          "POST",
          `/api/v1/matches/${matchId}/innings`,
          { battingTeamId: ttA.body.data.id, inningsNumber: 1 },
          cookie,
        ),
        params({ matchId }),
      ),
    );
    const inningsId = inningsRes.body.data.id as string;
    const clientDeliveryId = "11111111-1111-4111-8111-111111111111";

    const payload = {
      inningsId,
      clientDeliveryId,
      overNumber: 1,
      ballInOver: 1,
      runsOffBat: 4,
      strikerId: players[0],
      nonStrikerId: players[1],
      bowlerId: players[2],
    };

    const first = await readJson(
      await recordDeliveryRoute(
        jsonRequest("POST", "/api/v1/deliveries", payload, cookie),
        emptyParams(),
      ),
    );
    expect(first.status).toBe(201);

    const second = await readJson(
      await recordDeliveryRoute(
        jsonRequest("POST", "/api/v1/deliveries", payload, cookie),
        emptyParams(),
      ),
    );
    expect(second.status).toBe(201);
    expect(second.body.data.deliveryId).toBe(first.body.data.deliveryId);

    const count = await prisma.delivery.count({ where: { inningsId } });
    expect(count).toBe(1);
  });
});
