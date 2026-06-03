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

  const edgwareTt = await prisma.tournamentTeam.findUnique({
    where: {
      tournamentId_teamId: { tournamentId: tournament.id, teamId: team.id },
    },
  });

  const hayesTeam = await prisma.team.upsert({
    where: {
      organizationId_slug: { organizationId: org.id, slug: "hayes-u9" },
    },
    create: {
      organizationId: org.id,
      name: "Hayes U9",
      slug: "hayes-u9",
      ageGroup: "U9",
    },
    update: {},
  });

  const hayesNames = [
    "Sahib",
    "Ekamvir",
    "Gurfateh",
    "Elijah",
    "Rudransh",
    "Arnav",
    "Harshan",
    "Sehaj",
  ];
  const hayesPlayerIds: string[] = [];
  for (let i = 0; i < hayesNames.length; i++) {
    const name = hayesNames[i]!;
    const existing = await prisma.player.findFirst({
      where: { legalName: name },
    });
    const player =
      existing ??
      (await prisma.player.create({
        data: { legalName: name, displayName: name },
      }));
    hayesPlayerIds.push(player.id);
    await prisma.teamMembership.upsert({
      where: {
        teamId_playerId_seasonLabel: {
          teamId: hayesTeam.id,
          playerId: player.id,
          seasonLabel: "2026",
        },
      },
      create: {
        teamId: hayesTeam.id,
        playerId: player.id,
        shirtNumber: i + 1,
        seasonLabel: "2026",
      },
      update: {},
    });
  }

  const hayesTt = await prisma.tournamentTeam.upsert({
    where: {
      tournamentId_teamId: { tournamentId: tournament.id, teamId: hayesTeam.id },
    },
    create: {
      tournamentId: tournament.id,
      teamId: hayesTeam.id,
      publicSlug: "hayes",
    },
    update: {},
  });

  if (edgwareTt && hayesTt) {
    const existingMatch = await prisma.match.findFirst({
      where: { tournamentId: tournament.id, publicSlug: "demo-score" },
    });

    const demoMatch =
      existingMatch ??
      (await prisma.match.create({
        data: {
          tournamentId: tournament.id,
          homeTeamId: hayesTt.id,
          awayTeamId: edgwareTt.id,
          matchNumber: 99,
          venue: "Canons High School (demo)",
          playersPerSide: 8,
          publicSlug: "demo-score",
          rulesVersionId: rulesVersion.id,
        },
      }));

    const edgwarePlayerIds: string[] = [];
    for (const name of playerNames) {
      const p = await prisma.player.findFirst({ where: { legalName: name } });
      if (p) edgwarePlayerIds.push(p.id);
    }

    await prisma.matchSquadPlayer.deleteMany({ where: { matchId: demoMatch.id } });
    await prisma.matchSquadPlayer.createMany({
      data: [
        ...hayesPlayerIds.map((playerId) => ({
          matchId: demoMatch.id,
          playerId,
          teamId: hayesTeam.id,
        })),
        ...edgwarePlayerIds.map((playerId) => ({
          matchId: demoMatch.id,
          playerId,
          teamId: team.id,
        })),
      ],
    });

    console.log(`Demo scoring match: ${demoMatch.id} (public slug: demo-score)`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
