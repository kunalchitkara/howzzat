import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { recordTossSchema } from "@/lib/validations";
import { recordToss } from "@/lib/services/matches";

export const runtime = "nodejs";

export const POST = withApi(async (request, { params }) => {
  const { matchId } = await params;
  const input = await parseJson(request, recordTossSchema);
  const result = await recordToss(matchId, input);
  return json({ data: result });
});
