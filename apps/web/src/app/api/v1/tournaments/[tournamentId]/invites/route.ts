import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { createInviteSchema } from "@/lib/validations";
import { createInvite, listInvites } from "@/lib/services/invites";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { tournamentId } = await params;
  const invites = await listInvites(tournamentId);
  return json({ data: invites });
});

export const POST = withApi(async (request, { params }) => {
  const { tournamentId } = await params;
  const input = await parseJson(request, createInviteSchema);
  const invite = await createInvite(tournamentId, input);
  return json({ data: invite }, 201);
});
