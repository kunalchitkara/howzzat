import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const E2E_DB_PATH = path.join(__dirname, "../.e2e-db.db");
const dbPackage = path.join(__dirname, "../../../packages/db");

export default async function globalSetup() {
  const dbUrl = `file:${E2E_DB_PATH}`;
  process.env.DATABASE_URL = dbUrl;

  if (fs.existsSync(E2E_DB_PATH)) {
    fs.unlinkSync(E2E_DB_PATH);
  }

  execSync("pnpm exec prisma db push --accept-data-loss", {
    cwd: dbPackage,
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
      DOTENV_CONFIG_PATH: "/dev/null",
    },
    stdio: "pipe",
  });

  const { prisma } = await import("@howzzat/db");
  const { seedRulesProfile } = await import("@howzzat/db/testing");
  await seedRulesProfile(prisma);
  await prisma.$disconnect();
}
