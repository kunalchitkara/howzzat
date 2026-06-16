import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getPublicTournamentInsights } from "@/lib/services/tournament-insights";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { orgSlug, tournamentSlug } = await params;
  const insights = await getPublicTournamentInsights(orgSlug, tournamentSlug);
  return json({ data: insights });
});
