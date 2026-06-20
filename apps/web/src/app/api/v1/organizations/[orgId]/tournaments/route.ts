import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { requireRequestUser } from "@/lib/auth/request";
import { createTournamentSchema } from "@/lib/validations";
import { assertCanManageOrg } from "@/lib/services/tournament-access";
import {
  createTournament,
  listTournaments,
} from "@/lib/services/tournaments";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { orgId } = await params;
  const tournaments = await listTournaments(orgId);
  return json({ data: tournaments });
});

export const POST = withApi(async (request, { params }) => {
  const user = await requireRequestUser(request);
  const { orgId } = await params;
  await assertCanManageOrg(orgId, user);
  const input = await parseJson(request, createTournamentSchema);
  const tournament = await createTournament(orgId, input);
  return json({ data: tournament }, 201);
});
