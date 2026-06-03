import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { createMatchSchema } from "@/lib/validations";
import { createMatch, listMatches } from "@/lib/services/matches";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { tournamentId } = await params;
  const matches = await listMatches(tournamentId);
  return json({ data: matches });
});

export const POST = withApi(async (request, { params }) => {
  const { tournamentId } = await params;
  const input = await parseJson(request, createMatchSchema);
  const match = await createMatch(tournamentId, input);
  return json({ data: match }, 201);
});
