import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getTeam, listTeamPlayers } from "@/lib/services/teams";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { teamId } = await params;
  const team = await getTeam(teamId);
  return json({ data: team });
});
