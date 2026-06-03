import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEST_DB_PATH } from "./constants";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function globalSetup() {
  const dbUrl = `file:${TEST_DB_PATH}`;
  process.env.DATABASE_URL = dbUrl;

  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  const dbPackage = path.join(__dirname, "../../../packages/db");

  // Fresh schema on isolated test DB (never use --force-reset; delete file instead)
  execSync("pnpm exec prisma db push --accept-data-loss", {
    cwd: dbPackage,
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
      // Prevent packages/db/.env from overriding test database URL
      DOTENV_CONFIG_PATH: "/dev/null",
    },
    stdio: "pipe",
  });

  return () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  };
}
