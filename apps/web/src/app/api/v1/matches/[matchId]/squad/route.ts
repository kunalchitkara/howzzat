import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { setMatchSquadSchema } from "@/lib/validations";
import { setMatchSquad } from "@/lib/services/matches";

export const runtime = "nodejs";

export const POST = withApi(async (request, { params }) => {
  const { matchId } = await params;
  const input = await parseJson(request, setMatchSquadSchema);
  const match = await setMatchSquad(matchId, input);
  return json({ data: match });
});
