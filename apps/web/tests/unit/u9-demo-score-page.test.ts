import { beforeEach, describe, expect, it, vi } from "vitest";

const { resetOrCreateU9DemoMatchMock, findFirstMatchMock } = vi.hoisted(() => ({
  resetOrCreateU9DemoMatchMock: vi.fn(),
  findFirstMatchMock: vi.fn(),
}));

vi.mock("@/lib/demo/u9-demo", () => ({
  resetOrCreateU9DemoMatch: resetOrCreateU9DemoMatchMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    match: {
      findFirst: findFirstMatchMock,
    },
  },
}));

import U9DemoScorePage from "@/app/demo/u9-score/page";

describe("U9 demo score page redirect", () => {
  beforeEach(() => {
    resetOrCreateU9DemoMatchMock.mockReset();
    findFirstMatchMock.mockReset();
  });

  it("redirects to freshly reset demo match scorer", async () => {
    resetOrCreateU9DemoMatchMock.mockResolvedValue({
      matchSlug: "u9-fresh",
    });
    findFirstMatchMock.mockResolvedValue(null);

    await expect(U9DemoScorePage()).rejects.toMatchObject({
      digest: expect.stringContaining("/match/u9-fresh/score"),
    });
    expect(findFirstMatchMock).not.toHaveBeenCalled();
  });

  it("falls back to existing u9-live match when reset fails", async () => {
    resetOrCreateU9DemoMatchMock.mockRejectedValue(new Error("reset failed"));
    findFirstMatchMock.mockResolvedValue({
      id: "match-id-1",
      slug: "u9-existing",
    });

    await expect(U9DemoScorePage()).rejects.toMatchObject({
      digest: expect.stringContaining("/match/u9-existing/score"),
    });
  });

  it("redirects to demo page when no fallback match exists", async () => {
    resetOrCreateU9DemoMatchMock.mockRejectedValue(new Error("reset failed"));
    findFirstMatchMock.mockResolvedValue(null);

    await expect(U9DemoScorePage()).rejects.toMatchObject({
      digest: expect.stringContaining("/demo?demoStatus=u9-unavailable"),
    });
  });
});
