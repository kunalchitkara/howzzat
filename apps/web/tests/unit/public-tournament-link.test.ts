import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@howzzat/db";
import { resetDatabase } from "@howzzat/db/testing";
import { ApiError } from "@/lib/api/http";
import {
  publicTournamentHubPath,
  tournamentHomeUrl,
} from "@/lib/services/tournament-access";
import {
  createTournament,
  getTournamentByPublicToken,
} from "@/lib/services/tournaments";
import { createOrganization } from "@/lib/services/organizations";
import { seedRulesProfile } from "@howzzat/db/testing";
import PublicTournamentTokenPage from "@/app/t/[token]/page";

describe("public tournament share links", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it("builds canonical hub path and magic-link URL", () => {
    expect(publicTournamentHubPath("ecc", "test-ecc-u9")).toBe(
      "/orgs/ecc/tournaments/test-ecc-u9",
    );
    expect(tournamentHomeUrl("abc123", "http://localhost:3005")).toBe(
      "http://localhost:3005/t/abc123",
    );
  });

  it("resolves tournament by publicToken", async () => {
    const org = await createOrganization({ name: "ECC", slug: "ecc" });
    const { version } = await seedRulesProfile(prisma);
    const tournament = await createTournament(org.id, {
      name: "Test ECC U9",
      slug: "test-ecc-u9",
      rulesProfileVersionId: version.id,
      isPublic: true,
    });

    expect(tournament.publicToken).toBeTruthy();

    const loaded = await getTournamentByPublicToken(tournament.publicToken!);
    expect(loaded.id).toBe(tournament.id);
    expect(loaded.organization.slug).toBe("ecc");
    expect(loaded.slug).toBe("test-ecc-u9");
  });

  it("404s for unknown or private tournament tokens", async () => {
    await expect(getTournamentByPublicToken("missing-token")).rejects.toBeInstanceOf(
      ApiError,
    );

    const org = await createOrganization({ name: "Private Club", slug: "private" });
    const { version } = await seedRulesProfile(prisma);
    const tournament = await createTournament(org.id, {
      name: "Private T",
      slug: "private-t",
      rulesProfileVersionId: version.id,
      isPublic: false,
    });

    await expect(
      getTournamentByPublicToken(tournament.publicToken!),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("redirects /t/{publicToken} to org slug hub", async () => {
    const org = await createOrganization({ name: "ECC", slug: "ecc" });
    const { version } = await seedRulesProfile(prisma);
    const tournament = await createTournament(org.id, {
      name: "Test ECC U9",
      slug: "test-ecc-u9",
      rulesProfileVersionId: version.id,
      isPublic: true,
    });

    await expect(
      PublicTournamentTokenPage({
        params: Promise.resolve({ token: tournament.publicToken! }),
      }),
    ).rejects.toMatchObject({
      digest: expect.stringMatching(/NEXT_REDIRECT;/),
    });
  });
});
