import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { requireRequestUser } from "@/lib/auth/request";
import { createPlayerSchema } from "@/lib/validations";
import { assertCanManageTeam } from "@/lib/services/tournament-access";
import { addPlayerToTeam, listTeamPlayers } from "@/lib/services/teams";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { teamId } = await params;
  const players = await listTeamPlayers(teamId);
  return json({ data: players });
});

export const POST = withApi(async (request, { params }) => {
  const user = await requireRequestUser(request);
  const { teamId } = await params;
  await assertCanManageTeam(teamId, user);
  const input = await parseJson(request, createPlayerSchema);
  const membership = await addPlayerToTeam(teamId, input);
  return json({ data: membership }, 201);
});
