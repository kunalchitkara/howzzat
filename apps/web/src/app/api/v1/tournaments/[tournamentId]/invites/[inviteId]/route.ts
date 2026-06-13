import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { deleteInvite } from "@/lib/services/invites";

export const runtime = "nodejs";

export const DELETE = withApi(async (_request, { params }) => {
  const { tournamentId, inviteId } = await params;
  const result = await deleteInvite(tournamentId, inviteId);
  return json({ data: result });
});
