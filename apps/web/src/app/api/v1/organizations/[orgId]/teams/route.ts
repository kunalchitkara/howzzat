import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { requireRequestUser } from "@/lib/auth/request";
import { createTeamSchema } from "@/lib/validations";
import { assertCanManageOrg } from "@/lib/services/tournament-access";
import { createTeam, listTeams } from "@/lib/services/teams";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { orgId } = await params;
  const teams = await listTeams(orgId);
  return json({ data: teams });
});

export const POST = withApi(async (request, { params }) => {
  const user = await requireRequestUser(request);
  const { orgId } = await params;
  await assertCanManageOrg(orgId, user);
  const input = await parseJson(request, createTeamSchema);
  const team = await createTeam(orgId, input);
  return json({ data: team }, 201);
});
