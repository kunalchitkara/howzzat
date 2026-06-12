import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getRequestUser } from "@/lib/auth/request";
import { createInningsSchema } from "@/lib/validations";
import { createInnings } from "@/lib/services/matches";
import { assertCanMutateScoring } from "@/lib/services/scoring-lock";

export const runtime = "nodejs";

export const POST = withApi(async (request, { params }) => {
  const { matchId } = await params;
  const user = await getRequestUser(request);
  await assertCanMutateScoring(matchId, user);
  const input = await parseJson(request, createInningsSchema);
  const innings = await createInnings(matchId, input);
  return json({ data: innings }, 201);
});
