import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { requireRequestUser } from "@/lib/auth/request";
import { createMatchSchema } from "@/lib/validations";
import { assertCanManageTournament } from "@/lib/services/tournament-access";
import { createMatch, listMatches } from "@/lib/services/matches";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { tournamentId } = await params;
  const matches = await listMatches(tournamentId);
  return json({ data: matches });
});

export const POST = withApi(async (request, { params }) => {
  const user = await requireRequestUser(request);
  const { tournamentId } = await params;
  await assertCanManageTournament(tournamentId, user);
  const input = await parseJson(request, createMatchSchema);
  const match = await createMatch(tournamentId, input);
  return json({ data: match }, 201);
});
