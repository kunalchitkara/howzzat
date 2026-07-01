import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@howzzat/db";
import { resetDatabase } from "@howzzat/db/testing";
import {
  EDGWARE_CC_ORG_SLUG,
  EDGWARE_U9_2026_SLUG,
  ensurePublicEdgwareU92026,
  isEdgwarePublicU92026,
} from "@howzzat/db/seed-edgware-u9-public";
import { ApiError } from "@/lib/api/http";
import { getTournamentBySlug } from "@/lib/services/tournaments";
import { getPublicTournamentInsights } from "@/lib/services/tournament-insights";

describe("public Edgware U9 2026 hub seed", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("identifies the canonical public hub slug pair", () => {
    expect(isEdgwarePublicU92026(EDGWARE_CC_ORG_SLUG, EDGWARE_U9_2026_SLUG)).toBe(
      true,
    );
    expect(isEdgwarePublicU92026("other-club", EDGWARE_U9_2026_SLUG)).toBe(false);
  });

  it("creates org, public tournament, and season fixtures on first access", async () => {
    await ensurePublicEdgwareU92026(prisma);

    const tournament = await prisma.tournament.findFirst({
      where: {
        slug: EDGWARE_U9_2026_SLUG,
        organization: { slug: EDGWARE_CC_ORG_SLUG },
      },
      include: {
        organization: true,
        matches: { orderBy: { matchNumber: "asc" } },
      },
    });

    expect(tournament?.isPublic).toBe(true);
    expect(tournament?.name).toBe("U9 Softball Summer 2026");
    expect(tournament?.matches).toHaveLength(7);
    expect(tournament?.matches.map((m) => m.slug)).toContain(
      "u9-edgware-harefield-20260607",
    );
    expect(tournament?.matches.find((m) => m.slug === "u9-hayes-edgware-20260531")).toMatchObject({
      homeScore: 281,
      awayScore: 230,
      marginText: "Hayes won by 51 runs",
    });
  });

  it("is idempotent when fixtures already exist", async () => {
    await ensurePublicEdgwareU92026(prisma);
    const before = await prisma.match.count();
    await ensurePublicEdgwareU92026(prisma);
    const after = await prisma.match.count();
    expect(after).toBe(before);
  });

  it("loads via tournament services after ensure-on-access", async () => {
    const tournament = await getTournamentBySlug(EDGWARE_CC_ORG_SLUG, EDGWARE_U9_2026_SLUG);
    expect(tournament.slug).toBe(EDGWARE_U9_2026_SLUG);
    expect(tournament.organization.slug).toBe(EDGWARE_CC_ORG_SLUG);
    expect(tournament.matches.length).toBeGreaterThanOrEqual(7);

    const insights = await getPublicTournamentInsights(
      EDGWARE_CC_ORG_SLUG,
      EDGWARE_U9_2026_SLUG,
    );
    expect(insights.fixtures.length).toBeGreaterThanOrEqual(7);
  });

  it("still 404s for unknown public tournaments", async () => {
    await expect(getTournamentBySlug("missing-club", "missing-t")).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
