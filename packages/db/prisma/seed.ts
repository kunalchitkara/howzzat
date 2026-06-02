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
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
