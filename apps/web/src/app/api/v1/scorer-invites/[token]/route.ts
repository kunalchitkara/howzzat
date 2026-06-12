import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getMatchScorerInvite } from "@/lib/services/match-scorer-invites";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { token } = await params;
  const invite = await getMatchScorerInvite(token);
  const expired = invite.expiresAt != null && invite.expiresAt < new Date();
  return json({
    data: {
      token: invite.token,
      matchId: invite.matchId,
      email: invite.email,
      acceptedAt: invite.acceptedAt?.toISOString() ?? null,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      expired,
      matchTitle: `${invite.match.homeTeam.team.name} vs ${invite.match.awayTeam.team.name}`,
    },
  });
});
