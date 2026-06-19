import type { PrismaClient } from "@prisma/client";
import { listBuiltinProfiles } from "@howzzat/rules-engine";

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
}
