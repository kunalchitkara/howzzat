import { describe, expect, it } from "vitest";
import {
  buildScoringLockInfo,
  isPublicDemoMatch,
  scorerDisplayName,
} from "@/lib/services/scoring-lock";
import type { AuthUser } from "@/lib/auth/session";

const coach: AuthUser = {
  id: "coach-a",
  email: "a@club.com",
  name: "Coach A",
  memberships: [
    {
      role: "COACH",
      organizationId: "org-1",
      organization: { id: "org-1", name: "Club", slug: "club" },
    },
  ],
};

const otherCoach: AuthUser = {
  id: "coach-b",
  email: "b@club.com",
  name: "Coach B",
  memberships: [
    {
      role: "COACH",
      organizationId: "org-1",
      organization: { id: "org-1", name: "Club", slug: "club" },
    },
  ],
};

function mockMatch(overrides: Record<string, unknown> = {}) {
  return {
    publicSlug: null,
    scoringClaimedAt: null,
    scoringUser: null,
    tournament: { organizationId: "org-1" },
    ...overrides,
  } as Parameters<typeof buildScoringLockInfo>[0];
}

describe("scoring lock", () => {
  it("detects public demo slugs", () => {
    expect(isPublicDemoMatch({ publicSlug: "u9-live" })).toBe(true);
    expect(isPublicDemoMatch({ publicSlug: "ios-live" })).toBe(true);
    expect(isPublicDemoMatch({ publicSlug: null })).toBe(false);
  });

  it("allows unauthenticated scoring on demo matches", () => {
    const info = buildScoringLockInfo(
      mockMatch({ publicSlug: "ios-live" }),
      null,
    );
    expect(info.canScore).toBe(true);
    expect(info.requiresAuth).toBe(false);
  });

  it("requires auth on non-demo matches", () => {
    const info = buildScoringLockInfo(mockMatch(), null);
    expect(info.canScore).toBe(false);
    expect(info.requiresAuth).toBe(true);
  });

  it("blocks second coach when lock is held", () => {
    const info = buildScoringLockInfo(
      mockMatch({
        scoringUserId: "coach-a",
        scoringUser: { id: "coach-a", name: "Coach A", email: "a@club.com" },
      }),
      otherCoach,
    );
    expect(info.lockedByOther).toBe(true);
    expect(info.canScore).toBe(false);
    expect(info.holderName).toBe("Coach A");
  });

  it("allows signed-in users on demo matches without club role (read path)", () => {
    const guest: AuthUser = {
      id: "guest-1",
      email: "parent@example.com",
      name: "Parent",
      memberships: [],
    };
    const info = buildScoringLockInfo(
      mockMatch({ publicSlug: "ios-live" }),
      guest,
    );
    expect(info.canScore).toBe(true);
    expect(info.requiresAuth).toBe(false);
  });

  it("allows holder to continue scoring", () => {
    const info = buildScoringLockInfo(
      mockMatch({
        scoringUserId: "coach-a",
        scoringUser: { id: "coach-a", name: "Coach A", email: "a@club.com" },
      }),
      coach,
    );
    expect(info.isHolder).toBe(true);
    expect(info.canScore).toBe(true);
    expect(info.lockedByOther).toBe(false);
  });

  it("formats scorer display name", () => {
    expect(scorerDisplayName({ name: "Alex", email: "a@x.com" })).toBe("Alex");
    expect(scorerDisplayName({ name: null, email: "a@x.com" })).toBe("a@x.com");
  });
});
