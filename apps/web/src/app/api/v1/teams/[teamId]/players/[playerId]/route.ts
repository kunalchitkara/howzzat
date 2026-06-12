import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { updatePlayerSchema } from "@/lib/validations";
import { updatePlayerOnTeam } from "@/lib/services/teams";

export const runtime = "nodejs";

export const PATCH = withApi(async (request, { params }) => {
  const { teamId, playerId } = await params;
  const input = await parseJson(request, updatePlayerSchema);
  const membership = await updatePlayerOnTeam(teamId, playerId, input);
  return json({ data: membership });
});
