import { HOWZZAT_API_VERSION } from "@howzzat/shared";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    service: "howzzat",
    version: HOWZZAT_API_VERSION,
    database: process.env.DATABASE_URL ? "configured" : "not configured",
  });
}
