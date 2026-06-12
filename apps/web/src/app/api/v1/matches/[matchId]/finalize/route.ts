import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getRequestUser } from "@/lib/auth/request";
import { finalizeMatchInnings } from "@/lib/services/matches";
import { assertCanMutateScoring } from "@/lib/services/scoring-lock";

export const runtime = "nodejs";

export const POST = withApi(async (request, { params }) => {
  const { matchId } = await params;
  const user = await getRequestUser(request);
  await assertCanMutateScoring(matchId, user);
  const match = await finalizeMatchInnings(matchId);
  return json({ data: match });
});
