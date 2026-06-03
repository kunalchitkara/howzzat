import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { createInningsSchema } from "@/lib/validations";
import { createInnings } from "@/lib/services/matches";

export const runtime = "nodejs";

export const POST = withApi(async (request, { params }) => {
  const { matchId } = await params;
  const input = await parseJson(request, createInningsSchema);
  const innings = await createInnings(matchId, input);
  return json({ data: innings }, 201);
});
