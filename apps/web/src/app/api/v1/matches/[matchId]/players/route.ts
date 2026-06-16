import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { addMatchPlayerSchema } from "@/lib/validations";
import { addMatchPlayer } from "@/lib/services/matches";

export const runtime = "nodejs";

export const POST = withApi(async (request, { params }) => {
  const { matchId } = await params;
  const input = await parseJson(request, addMatchPlayerSchema);
  const match = await addMatchPlayer(matchId, input);
  return json({ data: match }, 201);
});
