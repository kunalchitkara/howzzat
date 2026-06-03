import { HOWZZAT_API_VERSION } from "@howzzat/shared";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    service: "howzzat",
    version: HOWZZAT_API_VERSION,
    api: "/api/v1",
    endpoints: {
      organizations: "/api/v1/organizations",
      rulesProfiles: "/api/v1/rules/profiles",
      deliveries: "/api/v1/deliveries",
      publicTournament: "/api/v1/public/orgs/{orgSlug}/tournaments/{tournamentSlug}",
    },
    database: process.env.DATABASE_URL ? "configured" : "not configured",
  });
}
