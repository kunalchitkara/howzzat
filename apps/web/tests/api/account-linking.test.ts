import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as sendEmail } from "@/app/api/v1/auth/email/send/route";
import { POST as verifyEmail } from "@/app/api/v1/auth/email/verify/route";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as loginPassword } from "@/app/api/v1/auth/login/password/route";
import { POST as googleToken } from "@/app/api/v1/auth/google/token/route";
import { ApiError } from "@/lib/api/http";
import { signInWithGoogleProfile } from "@/lib/auth/google";
import { prisma } from "@howzzat/db";
import { resetDatabase } from "@howzzat/db/testing";
import {
  emptyParams,
  jsonRequest,
  readJson,
  readResponse,
} from "../helpers/request";

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({ data: { id: "email_1" }, error: null }),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

const { mockVerifyGoogleIdToken } = vi.hoisted(() => ({
  mockVerifyGoogleIdToken: vi.fn(),
}));

vi.mock("@/lib/auth/google", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/google")>();
  return {
    ...actual,
    verifyGoogleIdToken: mockVerifyGoogleIdToken,
  };
});

function googleProfile(overrides: {
  sub?: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
}) {
  return {
    sub: overrides.sub ?? "google-sub-1",
    email: overrides.email,
    name: overrides.name,
    emailVerified: overrides.emailVerified ?? true,
  };
}

async function verifyEmailOtp(email: string, name?: string) {
  await sendEmail(
    jsonRequest("POST", "/api/v1/auth/email/send", { email }),
    emptyParams(),
  );
  const codeMatch = mockSend.mock.calls.at(-1)?.[0]?.text?.match(/\d{6}/);
  const code = codeMatch?.[0];
  expect(code).toBeTruthy();
  return readResponse(
    await verifyEmail(
      jsonRequest("POST", "/api/v1/auth/email/verify", { email, code, name }),
      emptyParams(),
    ),
  );
}

describe("Account linking by email", () => {
  const prevResend = process.env.RESEND_API_KEY;
  const prevFrom = process.env.EMAIL_FROM;

  beforeEach(async () => {
    await resetDatabase(prisma);
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "Howzzat <onboarding@resend.dev>";
    mockSend.mockClear();
    mockVerifyGoogleIdToken.mockReset();
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = prevResend;
    process.env.EMAIL_FROM = prevFrom;
  });

  it("links Google to an existing password user with the same email", async () => {
    const regRes = await readResponse(
      await register(
        jsonRequest("POST", "/api/v1/auth/register", {
          email: "merge@test.club",
          password: "secret123",
          name: "Pass User",
        }),
        emptyParams(),
      ),
    );
    expect(regRes.status).toBe(201);
    const passwordUserId = regRes.body.data.user.id;

    const googleUser = await signInWithGoogleProfile(
      googleProfile({ email: "merge@test.club", sub: "google-sub-pass" }),
    );
    expect(googleUser.id).toBe(passwordUserId);

    const account = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: "google-sub-pass",
        },
      },
    });
    expect(account?.userId).toBe(passwordUserId);
    expect(await prisma.user.count()).toBe(1);
  });

  it("links email OTP to an existing Google user with the same email", async () => {
    const googleUser = await signInWithGoogleProfile(
      googleProfile({ email: "google-first@test.club", sub: "google-sub-first" }),
    );

    const otpRes = await verifyEmailOtp("google-first@test.club", "OTP Name");
    expect(otpRes.status).toBe(200);
    expect(otpRes.body.data.user.id).toBe(googleUser.id);
    expect(await prisma.user.count()).toBe(1);
  });

  it("lets a Google-only user set a password on the same account", async () => {
    const googleUser = await signInWithGoogleProfile(
      googleProfile({ email: "google-only@test.club", sub: "google-sub-only" }),
    );

    const regRes = await readResponse(
      await register(
        jsonRequest("POST", "/api/v1/auth/register", {
          email: "google-only@test.club",
          password: "secret123",
        }),
        emptyParams(),
      ),
    );
    expect(regRes.status).toBe(201);
    expect(regRes.body.data.user.id).toBe(googleUser.id);

    const loginRes = await readResponse(
      await loginPassword(
        jsonRequest("POST", "/api/v1/auth/login/password", {
          email: "google-only@test.club",
          password: "secret123",
        }),
        emptyParams(),
      ),
    );
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.id).toBe(googleUser.id);
  });

  it("normalizes email casing across providers", async () => {
    await signInWithGoogleProfile(
      googleProfile({ email: "Mixed.Case@Test.Club", sub: "google-sub-case" }),
    );

    const otpRes = await verifyEmailOtp("mixed.case@test.club");
    expect(otpRes.status).toBe(200);
    expect(otpRes.body.data.user.email).toBe("mixed.case@test.club");
    expect(await prisma.user.count()).toBe(1);
  });

  it("does not merge different emails", async () => {
    await signInWithGoogleProfile(
      googleProfile({ email: "one@test.club", sub: "google-sub-one" }),
    );
    await signInWithGoogleProfile(
      googleProfile({ email: "two@test.club", sub: "google-sub-two" }),
    );
    expect(await prisma.user.count()).toBe(2);
  });

  it("reuses the same user when Google sub is already linked", async () => {
    const first = await signInWithGoogleProfile(
      googleProfile({ email: "repeat@test.club", sub: "google-sub-repeat", name: "First" }),
    );
    const second = await signInWithGoogleProfile(
      googleProfile({ email: "repeat@test.club", sub: "google-sub-repeat", name: "Second" }),
    );
    expect(second.id).toBe(first.id);
    expect(second.name).toBe("First");
    expect(await prisma.user.count()).toBe(1);
  });

  it("rejects unverified Google sign-in when email already belongs to another user", async () => {
    await register(
      jsonRequest("POST", "/api/v1/auth/register", {
        email: "taken@test.club",
        password: "secret123",
      }),
      emptyParams(),
    );

    await expect(
      signInWithGoogleProfile(
        googleProfile({
          email: "taken@test.club",
          sub: "google-sub-unverified",
          emailVerified: false,
        }),
      ),
    ).rejects.toBeInstanceOf(ApiError);
    expect(await prisma.user.count()).toBe(1);
    expect(
      await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: "google-sub-unverified",
          },
        },
      }),
    ).toBeNull();
  });

  it("allows unverified Google sign-in when email is unused", async () => {
    const user = await signInWithGoogleProfile(
      googleProfile({
        email: "new-google@test.club",
        sub: "google-sub-new",
        emailVerified: false,
      }),
    );
    expect(user.emailVerified).toBeNull();
    expect(await prisma.user.count()).toBe(1);
  });

  it("exchanges Google token for session on an existing email user", async () => {
    const otpRes = await verifyEmailOtp("token@test.club");
    const otpUserId = otpRes.body.data.user.id;

    mockVerifyGoogleIdToken.mockResolvedValue(
      googleProfile({ email: "token@test.club", sub: "google-sub-token" }),
    );

    const tokenRes = await readJson(
      await googleToken(
        jsonRequest("POST", "/api/v1/auth/google/token", { idToken: "fake-token" }),
        emptyParams(),
      ),
    );
    expect(tokenRes.status).toBe(200);
    expect(tokenRes.body.data.user.id).toBe(otpUserId);
    expect(await prisma.user.count()).toBe(1);
  });
});
