import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { updateMatchSchema } from "@/lib/validations";
import { cancelOrDeleteMatch, getMatch, updateMatch } from "@/lib/services/matches";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { matchId } = await params;
  const match = await getMatch(matchId);
  return json({ data: match });
});

export const PATCH = withApi(async (request, { params }) => {
  const { matchId } = await params;
  const input = await parseJson(request, updateMatchSchema);
  const match = await updateMatch(matchId, input);
  return json({ data: match });
});

export const DELETE = withApi(async (_request, { params }) => {
  const { matchId } = await params;
  const result = await cancelOrDeleteMatch(matchId);
  return json({ data: result });
});
