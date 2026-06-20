import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/http";
import { assertDemoResetAllowed } from "@/lib/demo/demo-reset-guard";

function request(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/v1/demo/u9-match", {
    method: "POST",
    headers,
  });
}

describe("assertDemoResetAllowed", () => {
  const env = process.env;

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEMO_RESET", "");
    vi.stubEnv("DEMO_RESET_SECRET", "");
  });

  afterEach(() => {
    process.env = env;
    vi.unstubAllEnvs();
  });

  it("allows in non-production without credentials", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => assertDemoResetAllowed(request())).not.toThrow();
  });

  it("allows when ALLOW_DEMO_RESET is true", () => {
    vi.stubEnv("ALLOW_DEMO_RESET", "true");
    expect(() => assertDemoResetAllowed(request())).not.toThrow();
  });

  it("allows with matching X-Demo-Reset-Secret", () => {
    vi.stubEnv("DEMO_RESET_SECRET", "test-secret");
    expect(() =>
      assertDemoResetAllowed(request({ "x-demo-reset-secret": "test-secret" })),
    ).not.toThrow();
  });

  it("rejects wrong secret when DEMO_RESET_SECRET is set", () => {
    vi.stubEnv("DEMO_RESET_SECRET", "test-secret");
    expect(() => assertDemoResetAllowed(request())).toThrow(ApiError);
  });

  it("rate limits when no secret is configured", () => {
    for (let i = 0; i < 5; i++) {
      assertDemoResetAllowed(request({ "x-forwarded-for": "203.0.113.1" }));
    }
    expect(() =>
      assertDemoResetAllowed(request({ "x-forwarded-for": "203.0.113.1" })),
    ).toThrow(ApiError);
  });
});
