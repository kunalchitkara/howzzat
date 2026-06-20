import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { requireRequestUser } from "@/lib/auth/request";
import { assertCanManageTournament } from "@/lib/services/tournament-access";
import { deleteInvite } from "@/lib/services/invites";

export const runtime = "nodejs";

export const DELETE = withApi(async (request, { params }) => {
  const user = await requireRequestUser(request);
  const { tournamentId, inviteId } = await params;
  await assertCanManageTournament(tournamentId, user);
  const result = await deleteInvite(tournamentId, inviteId);
  return json({ data: result });
});
