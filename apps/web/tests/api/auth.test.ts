import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as logout } from "@/app/api/v1/auth/logout/route";
import { GET as me } from "@/app/api/v1/auth/me/route";
import { POST as createOrg } from "@/app/api/v1/organizations/route";
import { POST as acceptInvite } from "@/app/api/v1/invites/[token]/accept/route";
import { GET as getInvite } from "@/app/api/v1/invites/[token]/route";
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

describe("Auth API", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedRulesProfile(prisma);
  });

  it("login sets session cookie and /me returns user", async () => {
    const loginRes = await readResponse(
      await login(
        jsonRequest("POST", "/api/v1/auth/login", {
          email: "coach@test.club",
          name: "Test Coach",
        }),
        emptyParams(),
      ),
    );
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.email).toBe("coach@test.club");
    const cookie = loginRes.cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    expect(cookie).toBeTruthy();

    const meRes = await readJson(
      await me(
        jsonRequest("GET", "/api/v1/auth/me", undefined, cookie),
        emptyParams(),
      ),
    );
    expect(meRes.status).toBe(200);
    expect(meRes.body.data?.email).toBe("coach@test.club");
  });

  it("logout clears session", async () => {
    const loginRes = await readResponse(
      await login(
        jsonRequest("POST", "/api/v1/auth/login", { email: "a@test.club" }),
        emptyParams(),
      ),
    );
    const cookie = loginRes.cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;

    const outRes = await readResponse(
      await logout(
        jsonRequest("POST", "/api/v1/auth/logout", undefined, cookie),
        emptyParams(),
      ),
    );
    expect(outRes.status).toBe(200);

    const meRes = await readJson(
      await me(jsonRequest("GET", "/api/v1/auth/me"), emptyParams()),
    );
    expect(meRes.body.data).toBeNull();
  });

  it("creating org while logged in adds OWNER membership", async () => {
    const loginRes = await readResponse(
      await login(
        jsonRequest("POST", "/api/v1/auth/login", { email: "owner@test.club" }),
        emptyParams(),
      ),
    );
    const cookie = loginRes.cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;

    const orgRes = await readJson(
      await createOrg(
        jsonRequest("POST", "/api/v1/organizations", { name: "Owned Club" }, cookie),
        emptyParams(),
      ),
    );
    expect(orgRes.status).toBe(201);

    const membership = await prisma.orgMembership.findFirst({
      where: { organizationId: orgRes.body.data.id, role: "OWNER" },
    });
    expect(membership).toBeTruthy();
  });

  it("accept invite grants org membership", async () => {
    const fixtures = await seedTestFixtures(prisma);
    const invite = await createInvite(fixtures.tournamentId, {
      email: "newcoach@test.club",
      role: "COACH",
    });

    const loginRes = await readResponse(
      await login(
        jsonRequest("POST", "/api/v1/auth/login", { email: "newcoach@test.club" }),
        emptyParams(),
      ),
    );
    const cookie = loginRes.cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;

    const preview = await readJson(
      await getInvite(
        jsonRequest("GET", `/api/v1/invites/${invite.token}`),
        params({ token: invite.token }),
      ),
    );
    expect(preview.status).toBe(200);

    const acceptRes = await readJson(
      await acceptInvite(
        jsonRequest("POST", `/api/v1/invites/${invite.token}/accept`, undefined, cookie),
        params({ token: invite.token }),
      ),
    );
    expect(acceptRes.status).toBe(200);

    const membership = await prisma.orgMembership.findFirst({
      where: { organizationId: fixtures.orgId, user: { email: "newcoach@test.club" } },
    });
    expect(membership?.role).toBe("COACH");
  });
});
