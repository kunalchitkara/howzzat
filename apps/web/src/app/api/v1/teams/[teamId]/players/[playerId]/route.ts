import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { requireRequestUser } from "@/lib/auth/request";
import { updatePlayerSchema } from "@/lib/validations";
import { assertCanManageTeam } from "@/lib/services/tournament-access";
import { updatePlayerOnTeam } from "@/lib/services/teams";

export const runtime = "nodejs";

export const PATCH = withApi(async (request, { params }) => {
  const user = await requireRequestUser(request);
  const { teamId, playerId } = await params;
  await assertCanManageTeam(teamId, user);
  const input = await parseJson(request, updatePlayerSchema);
  const membership = await updatePlayerOnTeam(teamId, playerId, input);
  return json({ data: membership });
});
