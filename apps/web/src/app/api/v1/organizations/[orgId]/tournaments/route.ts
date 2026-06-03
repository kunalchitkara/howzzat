import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { createTournamentSchema } from "@/lib/validations";
import {
  createTournament,
  listTournaments,
} from "@/lib/services/tournaments";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { orgId } = await params;
  const tournaments = await listTournaments(orgId);
  return json({ data: tournaments });
});

export const POST = withApi(async (request, { params }) => {
  const { orgId } = await params;
  const input = await parseJson(request, createTournamentSchema);
  const tournament = await createTournament(orgId, input);
  return json({ data: tournament }, 201);
});
