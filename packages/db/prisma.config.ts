/**
 * Prisma 7 migration stub (Prisma 6.19+ early-access pattern).
 *
 * Current setup still uses `schema.prisma` datasource + CLI env (`packages/db/.env`).
 * When upgrading to Prisma 7:
 *   1. Move connection URL here (or keep env-driven via `env("DATABASE_URL")`)
 *   2. Run `pnpm db:generate` from packages/db
 *   3. Remove duplicate url from schema.prisma per Prisma 7 docs
 *
 * See docs/architecture.md — Database / Prisma section.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  earlyAccess: true,
  schema: path.join(root, "prisma", "schema.prisma"),
});
