import { z } from "zod";

const baseSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  DATABASE_AUTH_TOKEN: z.string().optional(),
});

/** Validates required production env at startup. Dev/test uses SQLite without Turso token. */
export function validateEnv(): void {
  const parsed = baseSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    throw new Error(`Invalid environment: ${msg}`);
  }

  if (process.env.NODE_ENV !== "production") return;

  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("libsql://")) {
    throw new Error(
      "Production DATABASE_URL must be a libsql:// Turso URL (see root .env.example)",
    );
  }
  if (!process.env.DATABASE_AUTH_TOKEN) {
    throw new Error("DATABASE_AUTH_TOKEN is required in production");
  }
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    throw new Error("NEXT_PUBLIC_APP_URL is required in production");
  }
}
