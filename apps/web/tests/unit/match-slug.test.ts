import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@howzzat/db";
import { resetDatabase, seedTestFixtures } from "@howzzat/db/testing";
import {
  allocateUniqueMatchSlug,
  buildMatchSlug,
  formatMatchDate,
  normalizeAgeGroup,
  teamMatchSlug,
} from "@/lib/match-slug";
import { createMatch } from "@/lib/services/matches";
import { GET as getMatchRoute } from "@/app/api/v1/matches/[matchId]/route";
import { jsonRequest, params, readJson } from "../helpers/request";

describe("match slug helpers", () => {
  it("builds slug from age group, teams, and date", () => {
    const date = new Date("2026-06-04T12:00:00Z");
    expect(
      buildMatchSlug({
        ageGroup: "U9",
        homeTeam: {
          publicSlug: "edgware",
          team: { slug: "edgware-u9", name: "Edgware U9" },
        },
        awayTeam: {
          publicSlug: "hayes",
          team: { slug: "hayes", name: "Hayes" },
        },
        scheduledAt: date,
      }),
    ).toBe("u9-edgware-hayes-20260604");
  });

  it("normalizes age group and strips team age suffixes", () => {
    expect(normalizeAgeGroup("U11")).toBe("u11");
    expect(normalizeAgeGroup(null)).toBe("open");
    expect(
      teamMatchSlug({
        publicSlug: null,
        team: { slug: "edgware-u9", name: "Edgware U9" },
      }),
    ).toBe("edgware");
  });

  it("formats dates as YYYYMMDD in UTC", () => {
    expect(formatMatchDate(new Date("2026-06-04T23:30:00Z"))).toBe("20260604");
  });
});

describe("match slug allocation", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("appends numeric suffix on collision", async () => {
    const fx = await seedTestFixtures(prisma);
    const base = buildMatchSlug({
      ageGroup: "U9",
      homeTeam: {
        publicSlug: "team-a",
        team: { slug: "team-a", name: "Team A" },
      },
      awayTeam: {
        publicSlug: "team-b",
        team: { slug: "team-b", name: "Team B" },
      },
      scheduledAt: new Date("2026-06-04T10:00:00.000Z"),
    });
    await prisma.match.create({
      data: {
        tournamentId: fx.tournamentId,
        homeTeamId: fx.tournamentTeamAId,
        awayTeamId: fx.tournamentTeamBId,
        slug: base,
      },
    });
    const unique = await allocateUniqueMatchSlug(prisma, base);
    expect(unique).toBe(`${base}-2`);
  });
});

describe("match slug API", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("creates match with slug and resolves GET by slug or id", async () => {
    const fx = await seedTestFixtures(prisma);
    const match = await createMatch(fx.tournamentId, {
      homeTeamId: fx.tournamentTeamAId,
      awayTeamId: fx.tournamentTeamBId,
      scheduledAt: "2026-06-04T10:00:00.000Z",
    });

    expect(match.slug).toMatch(/^u9-team-a-team-b-20260604/);

    const bySlug = await readJson(
      await getMatchRoute(
        jsonRequest("GET", `/api/v1/matches/${match.slug}`),
        params({ matchId: match.slug! }),
      ),
    );
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.data.id).toBe(match.id);

    const byId = await readJson(
      await getMatchRoute(
        jsonRequest("GET", `/api/v1/matches/${match.id}`),
        params({ matchId: match.id }),
      ),
    );
    expect(byId.status).toBe(200);
    expect(byId.body.data.slug).toBe(match.slug);
  });

  it("enforces unique slugs for same teams on the same day", async () => {
    const fx = await seedTestFixtures(prisma);
    const input = {
      homeTeamId: fx.tournamentTeamAId,
      awayTeamId: fx.tournamentTeamBId,
      scheduledAt: "2026-06-04T10:00:00.000Z",
    };
    const first = await createMatch(fx.tournamentId, input);
    const second = await createMatch(fx.tournamentId, input);

    expect(first.slug).toMatch(/^u9-team-a-team-b-20260604$/);
    expect(second.slug).toBe(`${first.slug}-2`);
  });
});
