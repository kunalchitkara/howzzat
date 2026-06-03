import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getMatchScoringContext } from "@/lib/services/scoring";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { matchId } = await params;
  const context = await getMatchScoringContext(matchId);
  return json({ data: context });
});
