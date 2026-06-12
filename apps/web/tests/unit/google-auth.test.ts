import { describe, expect, it } from "vitest";
import {
  googleCallbackUriForOrigin,
  OAUTH_REDIRECT_COOKIE,
  OAUTH_STATE_COOKIE,
  parseCookie,
  safeRedirectPath,
} from "@/lib/auth/oauth-state";
import { googleRedirectUri } from "@/lib/auth/google";

describe("google oauth helpers", () => {
  it("builds callback redirect URI from app URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(googleRedirectUri()).toBe(
      "http://localhost:3000/api/v1/auth/google/callback",
    );
  });

  it("parses oauth cookies", () => {
    const header = `${OAUTH_STATE_COOKIE}=abc123; ${OAUTH_REDIRECT_COOKIE}=${encodeURIComponent("/invite/xyz")}`;
    expect(parseCookie(header, OAUTH_STATE_COOKIE)).toBe("abc123");
    expect(parseCookie(header, OAUTH_REDIRECT_COOKIE)).toBe("/invite/xyz");
  });

  it("builds callback URI from request origin", () => {
    expect(googleCallbackUriForOrigin("http://localhost:3000")).toBe(
      "http://localhost:3000/api/v1/auth/google/callback",
    );
  });

  it("rejects unsafe redirect paths", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("https://evil.com")).toBe("/dashboard");
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
  });
});
