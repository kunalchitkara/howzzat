import { PrismaClient } from "@prisma/client";
import { ensurePublicEdgwareU92026 } from "./seed-edgware-u9-public.js";
import { seedRulesProfileTemplates } from "./seed-rules.js";

const prisma = new PrismaClient();

async function main() {
  await seedRulesProfileTemplates(prisma);

  const template = await prisma.rulesProfileTemplate.findUnique({
    where: { builtinId: "u9-softball-london-v1" },
    include: { versions: { where: { version: 1 } } },
  });
  const rulesVersion = template?.versions[0];
  if (!rulesVersion) return;

  const demoManager = await prisma.user.upsert({
    where: { email: "manager@edgware.local" },
    create: {
      email: "manager@edgware.local",
      name: "Demo Manager",
    },
    update: { name: "Demo Manager" },
  });

  await ensurePublicEdgwareU92026(prisma);

  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "edgware-cc" },
  });

  await prisma.orgMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: demoManager.id,
      },
    },
    create: {
      organizationId: org.id,
      userId: demoManager.id,
      role: "OWNER",
    },
    update: { role: "OWNER" },
  });

  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: {
      organizationId_slug: { organizationId: org.id, slug: "u9-2026" },
    },
  });

  const team = await prisma.team.findUniqueOrThrow({
    where: {
      organizationId_slug: { organizationId: org.id, slug: "u9-softball" },
    },
  });

  console.log("Seeded demo org: edgware-cc / tournament: u9-2026");

  const edgwareTt = await prisma.tournamentTeam.findUniqueOrThrow({
    where: {
      tournamentId_teamId: { tournamentId: tournament.id, teamId: team.id },
    },
  });

  const hayesTeam = await prisma.team.findUniqueOrThrow({
    where: {
      organizationId_slug: { organizationId: org.id, slug: "hayes-u9" },
    },
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

  const hayesTt = await prisma.tournamentTeam.findUniqueOrThrow({
    where: {
      tournamentId_teamId: { tournamentId: tournament.id, teamId: hayesTeam.id },
    },
  });

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
  for (const name of [
    "Ariyan",
    "Krish",
    "Veer",
    "Avyaan",
    "Qaim",
    "Kaiyan",
    "Aanya",
    "Taran",
  ]) {
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

  await prisma.match.update({
    where: { id: demoMatch.id },
    data: { squadsConfirmedAt: new Date() },
  });

  console.log(`Demo scoring match: ${demoMatch.id} (public slug: demo-score)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
