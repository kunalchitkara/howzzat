import { describe, expect, it } from "vitest";
import {
  googleCallbackUriForOrigin,
  requestAppOrigin,
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

  it("prefers NEXT_PUBLIC_APP_URL for OAuth origin in production", () => {
    const prevEnv = process.env.NODE_ENV;
    const prevUrl = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.howzzat.uk";

    const request = new Request("https://howzzat-web.vercel.app/api/v1/auth/google", {
      headers: { host: "howzzat-web.vercel.app" },
    });
    expect(requestAppOrigin(request)).toBe("https://app.howzzat.uk");

    process.env.NODE_ENV = prevEnv;
    process.env.NEXT_PUBLIC_APP_URL = prevUrl;
  });

  it("rejects unsafe redirect paths", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("https://evil.com")).toBe("/dashboard");
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
  });
});
