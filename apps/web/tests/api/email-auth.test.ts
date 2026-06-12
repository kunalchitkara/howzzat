import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as sendEmail } from "@/app/api/v1/auth/email/send/route";
import { POST as verifyEmail } from "@/app/api/v1/auth/email/verify/route";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as loginPassword } from "@/app/api/v1/auth/login/password/route";
import { GET as me } from "@/app/api/v1/auth/me/route";
import { prisma } from "@howzzat/db";
import { resetDatabase } from "@howzzat/db/testing";
import { SESSION_COOKIE } from "@/lib/auth/session";
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

describe("Email OTP auth", () => {
  const prevResend = process.env.RESEND_API_KEY;
  const prevFrom = process.env.EMAIL_FROM;

  beforeEach(async () => {
    await resetDatabase(prisma);
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "Howzzat <onboarding@resend.dev>";
    mockSend.mockClear();
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = prevResend;
    process.env.EMAIL_FROM = prevFrom;
  });

  it("sends and verifies email OTP, creating a session", async () => {
    const sendRes = await readJson(
      await sendEmail(
        jsonRequest("POST", "/api/v1/auth/email/send", { email: "otp@test.club" }),
        emptyParams(),
      ),
    );
    expect(sendRes.status).toBe(200);
    expect(mockSend).toHaveBeenCalledOnce();

    const stored = await prisma.emailVerification.findFirst({
      where: { email: "otp@test.club" },
    });
    expect(stored).toBeTruthy();

    const codeMatch = mockSend.mock.calls[0]?.[0]?.text?.match(/\d{6}/);
    const code = codeMatch?.[0];
    expect(code).toBeTruthy();

    const verifyRes = await readResponse(
      await verifyEmail(
        jsonRequest("POST", "/api/v1/auth/email/verify", {
          email: "otp@test.club",
          code,
          name: "OTP User",
        }),
        emptyParams(),
      ),
    );
    expect(verifyRes.status).toBe(200);
    const cookie = verifyRes.cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    expect(cookie).toBeTruthy();

    const meRes = await readJson(
      await me(jsonRequest("GET", "/api/v1/auth/me", undefined, cookie), emptyParams()),
    );
    expect(meRes.body.data?.email).toBe("otp@test.club");
    expect(meRes.body.data?.name).toBe("OTP User");
  });

  it("rejects invalid email OTP", async () => {
    await sendEmail(
      jsonRequest("POST", "/api/v1/auth/email/send", { email: "bad@test.club" }),
      emptyParams(),
    );

    const verifyRes = await readJson(
      await verifyEmail(
        jsonRequest("POST", "/api/v1/auth/email/verify", {
          email: "bad@test.club",
          code: "000000",
        }),
        emptyParams(),
      ),
    );
    expect(verifyRes.status).toBe(400);
  });
});

describe("Password auth", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("registers and signs in with password", async () => {
    const regRes = await readResponse(
      await register(
        jsonRequest("POST", "/api/v1/auth/register", {
          email: "pass@test.club",
          password: "secret123",
          name: "Pass User",
        }),
        emptyParams(),
      ),
    );
    expect(regRes.status).toBe(201);
    const regCookie = regRes.cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    expect(regCookie).toBeTruthy();

    const loginRes = await readResponse(
      await loginPassword(
        jsonRequest("POST", "/api/v1/auth/login/password", {
          email: "pass@test.club",
          password: "secret123",
        }),
        emptyParams(),
      ),
    );
    expect(loginRes.status).toBe(200);

    const badLogin = await readJson(
      await loginPassword(
        jsonRequest("POST", "/api/v1/auth/login/password", {
          email: "pass@test.club",
          password: "wrong",
        }),
        emptyParams(),
      ),
    );
    expect(badLogin.status).toBe(401);
  });

  it("rejects duplicate registration", async () => {
    await register(
      jsonRequest("POST", "/api/v1/auth/register", {
        email: "dup@test.club",
        password: "secret123",
      }),
      emptyParams(),
    );

    const dupRes = await readJson(
      await register(
        jsonRequest("POST", "/api/v1/auth/register", {
          email: "dup@test.club",
          password: "otherpass",
        }),
        emptyParams(),
      ),
    );
    expect(dupRes.status).toBe(409);
  });
});
