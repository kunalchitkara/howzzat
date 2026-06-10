import type { PrismaClient } from "@prisma/client";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const profilesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../rules-engine/profiles",
);

type ProfileSeed = {
  id: string;
  name: string;
  description: string;
};

function loadProfileFiles(): { profile: ProfileSeed; json: string }[] {
  return readdirSync(profilesDir)
    .filter((f) => f.endsWith(".json"))
    .map((file) => {
      const json = readFileSync(join(profilesDir, file), "utf-8");
      const profile = JSON.parse(json) as ProfileSeed;
      return { profile, json };
    })
    .sort((a, b) => a.profile.name.localeCompare(b.profile.name));
}

export async function seedRulesProfileTemplates(prisma: PrismaClient) {
  for (const { profile, json } of loadProfileFiles()) {
    const template = await prisma.rulesProfileTemplate.upsert({
      where: { builtinId: profile.id },
      create: {
        builtinId: profile.id,
        name: profile.name,
        description: profile.description,
        isPublic: true,
      },
      update: {
        name: profile.name,
        description: profile.description,
        isPublic: true,
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
