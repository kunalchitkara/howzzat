import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getTournamentBySlug } from "@/lib/services/tournaments";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { orgSlug, tournamentSlug } = await params;
  const tournament = await getTournamentBySlug(orgSlug, tournamentSlug);
  return json({ data: tournament });
});
