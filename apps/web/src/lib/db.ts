import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient, prisma as localPrisma } from "@howzzat/db";

function createTursoClient(): typeof localPrisma {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  if (!url?.startsWith("libsql://")) {
    throw new Error("DATABASE_URL must be a libsql:// URL for Turso");
  }
  if (!authToken) {
    throw new Error("DATABASE_AUTH_TOKEN is required for Turso");
  }

  const adapter = new PrismaLibSQL({ url, authToken });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  }) as typeof localPrisma;
}

export const prisma: typeof localPrisma = process.env.DATABASE_URL?.startsWith("libsql://")
  ? createTursoClient()
  : localPrisma;
