import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { addTournamentTeamSchema } from "@/lib/validations";
import { addTeamToTournament, addNamedTeamToTournament } from "@/lib/services/tournaments";

export const runtime = "nodejs";

export const POST = withApi(async (request, { params }) => {
  const { tournamentId } = await params;
  const input = await parseJson(request, addTournamentTeamSchema);
  const entry = input.teamId
    ? await addTeamToTournament(tournamentId, input.teamId, input.publicSlug)
    : await addNamedTeamToTournament(tournamentId, input.name!, input.publicSlug);
  return json({ data: entry }, 201);
});
