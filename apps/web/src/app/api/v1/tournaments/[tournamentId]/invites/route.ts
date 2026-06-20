import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { requireRequestUser } from "@/lib/auth/request";
import { createInviteSchema } from "@/lib/validations";
import { assertCanManageTournament } from "@/lib/services/tournament-access";
import { createInvite, listInvites } from "@/lib/services/invites";

export const runtime = "nodejs";

export const GET = withApi(async (request, { params }) => {
  const user = await requireRequestUser(request);
  const { tournamentId } = await params;
  await assertCanManageTournament(tournamentId, user);
  const invites = await listInvites(tournamentId);
  return json({ data: invites });
});

export const POST = withApi(async (request, { params }) => {
  const user = await requireRequestUser(request);
  const { tournamentId } = await params;
  await assertCanManageTournament(tournamentId, user);
  const input = await parseJson(request, createInviteSchema);
  const invite = await createInvite(tournamentId, input);
  return json({ data: invite }, 201);
});
