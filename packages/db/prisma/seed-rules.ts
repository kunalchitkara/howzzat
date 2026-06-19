import type { PrismaClient } from "@prisma/client";
import { listBuiltinProfiles } from "@howzzat/rules-engine";

const DEMO_TOURNAMENT_SLUGS = ["ios-demo", "u9-demo"] as const;

/** Coach tournaments must not stay bound to demo-only rules profiles. */
async function rebindMisassignedDemoTournaments(prisma: PrismaClient) {
  const mjcaVersion = await prisma.rulesProfileVersion.findFirst({
    where: { template: { builtinId: "mjca-u9-outdoor-v1" }, version: 1 },
  });
  if (!mjcaVersion) return;

  const misassigned = await prisma.tournament.findMany({
    where: {
      slug: { notIn: [...DEMO_TOURNAMENT_SLUGS] },
      rulesProfileVersion: {
        template: { builtinId: { startsWith: "demo-" } },
      },
    },
    include: { rulesProfileVersion: { include: { template: true } } },
  });

  for (const tournament of misassigned) {
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { rulesProfileVersionId: mjcaVersion.id },
    });
    await prisma.match.updateMany({
      where: {
        tournamentId: tournament.id,
        squadsConfirmedAt: null,
        innings: { none: {} },
      },
      data: { rulesVersionId: mjcaVersion.id },
    });
    console.log(
      `Rebound tournament ${tournament.slug} from ${tournament.rulesProfileVersion.template.builtinId} to mjca-u9-outdoor-v1`,
    );
  }
}

export async function seedRulesProfileTemplates(prisma: PrismaClient) {
  const profiles = listBuiltinProfiles().sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  for (const profile of profiles) {
    const json = JSON.stringify(profile);
    const isPublic = !profile.id.startsWith("demo-");
    const template = await prisma.rulesProfileTemplate.upsert({
      where: { builtinId: profile.id },
      create: {
        builtinId: profile.id,
        name: profile.name,
        description: profile.description,
        isPublic,
      },
      update: {
        name: profile.name,
        description: profile.description,
        isPublic,
      },
    });

    await prisma.rulesProfileVersion.upsert({
      where: {
        templateId_version: { templateId: template.id, version: 1 },
      },
      create: {
        templateId: template.id,
        version: 1,
        configJson: json,
      },
      update: { configJson: json },
    });

    console.log(`Seeded rules profile: ${profile.id}`);
  }

  await rebindMisassignedDemoTournaments(prisma);
}
