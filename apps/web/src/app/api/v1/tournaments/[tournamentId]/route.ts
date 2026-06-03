import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getTournament } from "@/lib/services/tournaments";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { tournamentId } = await params;
  const tournament = await getTournament(tournamentId);
  return json({ data: tournament });
});
