import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getRequestUser } from "@/lib/auth/request";
import { getMatchScoringContext } from "@/lib/services/scoring";

export const runtime = "nodejs";

export const GET = withApi(async (request, { params }) => {
  const { matchId } = await params;
  const user = await getRequestUser(request);
  const context = await getMatchScoringContext(matchId, user);
  return json({ data: context });
});
