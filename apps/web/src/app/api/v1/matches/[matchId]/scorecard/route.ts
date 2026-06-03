import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { buildMatchScorecardFromRaw } from "@/lib/scorecard/build-from-match";
import { getMatchScorecard } from "@/lib/services/matches";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { matchId } = await params;
  const scorecard = await getMatchScorecard(matchId);
  const view = await buildMatchScorecardFromRaw(scorecard);
  return json({ data: { ...scorecard, view } });
});
