import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { requireRequestUser } from "@/lib/auth/request";
import { acceptMatchScorerInvite } from "@/lib/services/match-scorer-invites";

export const runtime = "nodejs";

export const POST = withApi(async (request, { params }) => {
  const user = await requireRequestUser(request);
  const { token } = await params;
  const invite = await acceptMatchScorerInvite(token, user.id);
  return json({
    data: {
      matchId: invite.matchId,
      acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    },
  });
});
