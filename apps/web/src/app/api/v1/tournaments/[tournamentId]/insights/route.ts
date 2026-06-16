import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getTournamentInsights } from "@/lib/services/tournament-insights";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { tournamentId } = await params;
  const insights = await getTournamentInsights(tournamentId);
  return json({ data: insights });
});
