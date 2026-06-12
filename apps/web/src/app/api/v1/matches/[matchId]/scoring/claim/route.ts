import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { requireRequestUser } from "@/lib/auth/request";
import { claimMatchScoring } from "@/lib/services/scoring-lock";
import { getMatchScoringContext } from "@/lib/services/scoring";

export const runtime = "nodejs";

/** Claim exclusive scoring rights for this match (one coach at a time). */
export const POST = withApi(async (request, { params }) => {
  const user = await requireRequestUser(request);
  const { matchId } = await params;
  await claimMatchScoring(matchId, user);
  const context = await getMatchScoringContext(matchId, user);
  return json({ data: context });
});
