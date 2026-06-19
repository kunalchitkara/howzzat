import type { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getU9ProfileJson(): string {
  return readFileSync(
    join(__dirname, "../../rules-engine/profiles/u9-softball-london-v1.json"),
    "utf-8",
  );
}

/** Delete all rows in FK-safe order (for test isolation). */
export async function resetDatabase(prisma: PrismaClient) {
  await prisma.walletCouponRedemption.deleteMany();
  await prisma.walletCoupon.deleteMany();
  await prisma.walletTopUp.deleteMany();
  await prisma.usageLedger.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.innings.deleteMany();
  await prisma.matchSquadPlayer.deleteMany();
  await prisma.playerMatchStats.deleteMany();
  await prisma.match.deleteMany();
  await prisma.tournamentTeam.deleteMany();
  await prisma.matchScorerInvite.deleteMany();
  await prisma.tournamentInvite.deleteMany();
  await prisma.tournamentManager.deleteMany();
  await prisma.tournamentRulesBinding.deleteMany();
  await prisma.ruleChangeRequest.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.teamMembership.deleteMany();
  await prisma.team.deleteMany();
  await prisma.orgMembership.deleteMany();
  await prisma.session.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rulesProfileVersion.deleteMany();
  await prisma.rulesProfileTemplate.deleteMany();
  await prisma.player.deleteMany();
}

async function seedAllRulesProfiles(prisma: PrismaClient) {
  const { listBuiltinProfiles } = await import("@howzzat/rules-engine");
  const results = [];
  for (const profile of listBuiltinProfiles()) {
    const json = JSON.stringify(profile);
    const isPublic = !profile.id.startsWith("demo-");
    const template = await prisma.rulesProfileTemplate.create({
      data: {
        builtinId: profile.id,
        name: profile.name,
        description: profile.description,
        isPublic,
      },
    });
    const version = await prisma.rulesProfileVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        configJson: json,
        label: "v1",
      },
    });
    results.push({ template, version });
  }
  const u9 = results.find((r) => r.template.builtinId === "mjca-u9-outdoor-v1");
  return u9 ?? results[0]!;
}

export async function seedRulesProfile(prisma: PrismaClient) {
  return seedAllRulesProfiles(prisma);
}

export interface TestFixtureIds {
  orgId: string;
  teamAId: string;
  teamBId: string;
  tournamentTeamAId: string;
  tournamentTeamBId: string;
  tournamentId: string;
  rulesVersionId: string;
  playerIds: string[];
}

/** Minimal org + 2 teams + tournament + 4 players for integration tests. */
export async function seedTestFixtures(
  prisma: PrismaClient,
): Promise<TestFixtureIds> {
  let version = await prisma.rulesProfileVersion.findFirst({
    where: { template: { builtinId: "u9-softball-london-v1" } },
  });
  if (!version) {
    const seeded = await seedRulesProfile(prisma);
    version = seeded.version;
  }

  const org = await prisma.organization.create({
    data: { name: "Test Club", slug: "test-club" },
  });

  const teamA = await prisma.team.create({
    data: { organizationId: org.id, name: "Team A", slug: "team-a" },
  });
  const teamB = await prisma.team.create({
    data: { organizationId: org.id, name: "Team B", slug: "team-b" },
  });

  const tournament = await prisma.tournament.create({
    data: {
      organizationId: org.id,
      name: "Test Tournament",
      slug: "test-tournament",
      ageGroup: "U9",
      rulesProfileVersionId: version.id,
      isPublic: true,
      rulesBindings: {
        create: { rulesProfileVersionId: version.id },
      },
    },
  });

  const ttA = await prisma.tournamentTeam.create({
    data: {
      tournamentId: tournament.id,
      teamId: teamA.id,
      publicSlug: "team-a",
    },
  });
  const ttB = await prisma.tournamentTeam.create({
    data: {
      tournamentId: tournament.id,
      teamId: teamB.id,
      publicSlug: "team-b",
    },
  });

  const playerIds: string[] = [];
  for (const name of ["Alice", "Bob", "Charlie", "Diana"]) {
    const player = await prisma.player.create({
      data: { legalName: name },
    });
    playerIds.push(player.id);
    await prisma.teamMembership.create({
      data: {
        teamId: teamA.id,
        playerId: player.id,
        seasonLabel: "2026",
      },
    });
  }

  return {
    orgId: org.id,
    teamAId: teamA.id,
    teamBId: teamB.id,
    tournamentTeamAId: ttA.id,
    tournamentTeamBId: ttB.id,
    tournamentId: tournament.id,
    rulesVersionId: version.id,
    playerIds,
  };
}
