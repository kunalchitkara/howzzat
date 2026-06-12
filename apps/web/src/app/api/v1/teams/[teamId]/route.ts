import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { updateTeamSchema } from "@/lib/validations";
import { deleteTeam, getTeam, updateTeam } from "@/lib/services/teams";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { teamId } = await params;
  const team = await getTeam(teamId);
  return json({ data: team });
});

export const PATCH = withApi(async (request, { params }) => {
  const { teamId } = await params;
  const input = await parseJson(request, updateTeamSchema);
  const team = await updateTeam(teamId, input);
  return json({ data: team });
});

export const DELETE = withApi(async (_request, { params }) => {
  const { teamId } = await params;
  await deleteTeam(teamId);
  return json({ data: { deleted: true } });
});
