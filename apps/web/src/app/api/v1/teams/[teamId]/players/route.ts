import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { createPlayerSchema } from "@/lib/validations";
import { addPlayerToTeam, listTeamPlayers } from "@/lib/services/teams";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { teamId } = await params;
  const players = await listTeamPlayers(teamId);
  return json({ data: players });
});

export const POST = withApi(async (request, { params }) => {
  const { teamId } = await params;
  const input = await parseJson(request, createPlayerSchema);
  const membership = await addPlayerToTeam(teamId, input);
  return json({ data: membership }, 201);
});
