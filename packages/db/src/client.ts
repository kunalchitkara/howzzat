import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function resolveSqliteUrl(): void {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) return;
  const rel = url.slice("file:".length);
  if (rel.startsWith("/")) return;

  const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const candidates = [
    resolve(process.cwd(), rel),
    resolve(pkgRoot, "prisma", "dev.db"),
    resolve(process.cwd(), "packages/db/prisma/dev.db"),
  ];
  for (const abs of candidates) {
    if (existsSync(abs)) {
      process.env.DATABASE_URL = `file:${abs}`;
      return;
    }
  }
}

export function createPrismaClient(): PrismaClient {
  resolveSqliteUrl();
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
