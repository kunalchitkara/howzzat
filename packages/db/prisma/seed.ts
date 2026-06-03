import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();

const __dirname = dirname(fileURLToPath(import.meta.url));
const profilePath = join(
  __dirname,
  "../../rules-engine/profiles/u9-softball-london-v1.json",
);
const profileJson = readFileSync(profilePath, "utf-8");

async function main() {
  const template = await prisma.rulesProfileTemplate.upsert({
    where: { builtinId: "u9-softball-london-v1" },
    create: {
      builtinId: "u9-softball-london-v1",
      name: "U9 Softball (London)",
      description: "Pairs innings with 200 starting score — London junior leagues",
      isPublic: true,
    },
    update: {},
  });

  await prisma.rulesProfileVersion.upsert({
    where: {
      templateId_version: { templateId: template.id, version: 1 },
    },
    create: {
      templateId: template.id,
      version: 1,
      configJson: profileJson,
    },
    update: { configJson: profileJson },
  });

  console.log("Seeded u9-softball-london-v1 rules profile");

  const rulesVersion = await prisma.rulesProfileVersion.findFirst({
    where: { templateId: template.id, version: 1 },
  });
  if (!rulesVersion) return;

  const org = await prisma.organization.upsert({
    where: { slug: "edgware-cc" },
    create: {
      name: "Edgware Cricket Club",
      slug: "edgware-cc",
      description: "Demo organization for Howzzat development",
      homeGround: "Canons High School (HA8 6AN)",
    },
    update: {},
  });

  const team = await prisma.team.upsert({
    where: {
      organizationId_slug: { organizationId: org.id, slug: "u9-softball" },
    },
    create: {
      organizationId: org.id,
      name: "Edgware U9 Softball",
      slug: "u9-softball",
      ageGroup: "U9",
      homeGround: "Canons High School",
    },
    update: {},
  });

  const tournament = await prisma.tournament.upsert({
    where: {
      organizationId_slug: { organizationId: org.id, slug: "u9-2026" },
    },
    create: {
      organizationId: org.id,
      name: "U9 Softball Summer 2026",
      slug: "u9-2026",
      ageGroup: "U9",
      seasonLabel: "Summer 2026",
      rulesProfileVersionId: rulesVersion.id,
      isPublic: true,
      rulesBindings: {
        create: {
          rulesProfileVersionId: rulesVersion.id,
          notes: "Seed binding",
        },
      },
    },
    update: {},
  });

  await prisma.tournamentTeam.upsert({
    where: {
      tournamentId_teamId: { tournamentId: tournament.id, teamId: team.id },
    },
    create: {
      tournamentId: tournament.id,
      teamId: team.id,
      publicSlug: "edgware",
    },
    update: {},
  });

  const playerNames = ["Ariyan", "Krish", "Veer", "Avyaan", "Qaim", "Kaiyan", "Aanya", "Taran"];
  for (let i = 0; i < playerNames.length; i++) {
    const name = playerNames[i]!;
    const existing = await prisma.player.findFirst({
      where: { legalName: name },
    });
    const player =
      existing ??
      (await prisma.player.create({
        data: { legalName: name, displayName: name },
      }));

    await prisma.teamMembership.upsert({
      where: {
        teamId_playerId_seasonLabel: {
          teamId: team.id,
          playerId: player.id,
          seasonLabel: "2026",
        },
      },
      create: {
        teamId: team.id,
        playerId: player.id,
        shirtNumber: i + 1,
        seasonLabel: "2026",
      },
      update: {},
    });
  }

  console.log("Seeded demo org: edgware-cc / tournament: u9-2026");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
