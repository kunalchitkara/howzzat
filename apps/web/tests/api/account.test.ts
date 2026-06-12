import { beforeEach, describe, expect, it } from "vitest";
import { GET as me, PATCH as patchMe } from "@/app/api/v1/auth/me/route";
import { POST as setPassword } from "@/app/api/v1/auth/password/set/route";
import { POST as changePassword } from "@/app/api/v1/auth/password/change/route";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as loginPassword } from "@/app/api/v1/auth/login/password/route";
import { linkGoogleProfileToUser, signInWithGoogleProfile } from "@/lib/auth/google";
import { prisma } from "@howzzat/db";
import { resetDatabase } from "@howzzat/db/testing";
import { SESSION_COOKIE } from "@/lib/auth/session";
import {
  emptyParams,
  jsonRequest,
  readJson,
  readResponse,
} from "../helpers/request";

async function registerAndCookie(email: string, password = "secret123", name = "Test User") {
  const res = await readResponse(
    await register(
      jsonRequest("POST", "/api/v1/auth/register", { email, password, name }),
      emptyParams(),
    ),
  );
  const cookie = res.cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;
  return { cookie, userId: res.body.data.user.id as string };
}

describe("Account API", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("GET /me returns profile completion steps", async () => {
    const { cookie } = await registerAndCookie("profile@test.club");

    const meRes = await readJson(
      await me(jsonRequest("GET", "/api/v1/auth/me", undefined, cookie), emptyParams()),
    );
    expect(meRes.status).toBe(200);
    expect(meRes.body.data?.email).toBe("profile@test.club");
    expect(meRes.body.data?.profile).toMatchObject({
      hasPassword: true,
      hasGoogle: false,
      emailVerified: true,
      steps: {
        name: true,
        email: true,
        password: true,
        google: false,
      },
    });
  });

  it("PATCH /me updates display name", async () => {
    const { cookie } = await registerAndCookie("rename@test.club", "secret123", "Old");

    const patchRes = await readJson(
      await patchMe(
        jsonRequest("PATCH", "/api/v1/auth/me", { name: "New Name" }, cookie),
        emptyParams(),
      ),
    );
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data?.name).toBe("New Name");
    expect(patchRes.body.data?.profile.steps.name).toBe(true);
  });

  it("POST /password/set adds password to Google-only user", async () => {
    const googleUser = await signInWithGoogleProfile({
      sub: "google-sub-account",
      email: "google-account@test.club",
      emailVerified: true,
    });
    const session = await prisma.session.create({
      data: {
        userId: googleUser.id,
        token: "account-test-token",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    const cookie = `${SESSION_COOKIE}=${session.token}`;

    const meBefore = await readJson(
      await me(jsonRequest("GET", "/api/v1/auth/me", undefined, cookie), emptyParams()),
    );
    expect(meBefore.body.data?.profile.hasPassword).toBe(false);

    const setRes = await readJson(
      await setPassword(
        jsonRequest("POST", "/api/v1/auth/password/set", { password: "newpass12" }, cookie),
        emptyParams(),
      ),
    );
    expect(setRes.status).toBe(200);
    expect(setRes.body.data?.profile.hasPassword).toBe(true);

    const loginRes = await readResponse(
      await loginPassword(
        jsonRequest("POST", "/api/v1/auth/login/password", {
          email: "google-account@test.club",
          password: "newpass12",
        }),
        emptyParams(),
      ),
    );
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.id).toBe(googleUser.id);
  });

  it("POST /password/set rejects when password already exists", async () => {
    const { cookie } = await registerAndCookie("haspass@test.club");

    const setRes = await readJson(
      await setPassword(
        jsonRequest("POST", "/api/v1/auth/password/set", { password: "another12" }, cookie),
        emptyParams(),
      ),
    );
    expect(setRes.status).toBe(409);
  });

  it("POST /password/change updates password", async () => {
    const { cookie } = await registerAndCookie("changepass@test.club");

    const changeRes = await readJson(
      await changePassword(
        jsonRequest(
          "POST",
          "/api/v1/auth/password/change",
          { currentPassword: "secret123", newPassword: "updated12" },
          cookie,
        ),
        emptyParams(),
      ),
    );
    expect(changeRes.status).toBe(200);

    const badLogin = await readJson(
      await loginPassword(
        jsonRequest("POST", "/api/v1/auth/login/password", {
          email: "changepass@test.club",
          password: "secret123",
        }),
        emptyParams(),
      ),
    );
    expect(badLogin.status).toBe(401);

    const goodLogin = await readResponse(
      await loginPassword(
        jsonRequest("POST", "/api/v1/auth/login/password", {
          email: "changepass@test.club",
          password: "updated12",
        }),
        emptyParams(),
      ),
    );
    expect(goodLogin.status).toBe(200);
  });

  it("linkGoogleProfileToUser links Google to signed-in user", async () => {
    const { userId } = await registerAndCookie("linkme@test.club");

    const updated = await linkGoogleProfileToUser(userId, {
      sub: "google-sub-link",
      email: "linkme@test.club",
      emailVerified: true,
    });
    expect(updated.id).toBe(userId);

    const account = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: "google-sub-link",
        },
      },
    });
    expect(account?.userId).toBe(userId);
    expect(await prisma.user.count()).toBe(1);
  });

  it("linkGoogleProfileToUser rejects mismatched email", async () => {
    const { userId } = await registerAndCookie("mismatch@test.club");

    await expect(
      linkGoogleProfileToUser(userId, {
        sub: "google-sub-mismatch",
        email: "other@test.club",
        emailVerified: true,
      }),
    ).rejects.toMatchObject({ code: "GOOGLE_EMAIL_MISMATCH" });
  });
});
