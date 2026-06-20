import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { requireRequestUser } from "@/lib/auth/request";
import { updateTeamSchema } from "@/lib/validations";
import { assertCanManageTeam } from "@/lib/services/tournament-access";
import { deleteTeam, getTeam, updateTeam } from "@/lib/services/teams";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { teamId } = await params;
  const team = await getTeam(teamId);
  return json({ data: team });
});

export const PATCH = withApi(async (request, { params }) => {
  const user = await requireRequestUser(request);
  const { teamId } = await params;
  await assertCanManageTeam(teamId, user);
  const input = await parseJson(request, updateTeamSchema);
  const team = await updateTeam(teamId, input);
  return json({ data: team });
});

export const DELETE = withApi(async (request, { params }) => {
  const user = await requireRequestUser(request);
  const { teamId } = await params;
  await assertCanManageTeam(teamId, user);
  await deleteTeam(teamId);
  return json({ data: { deleted: true } });
});
