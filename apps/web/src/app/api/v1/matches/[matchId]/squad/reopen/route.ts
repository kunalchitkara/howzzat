import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { reopenMatchSquads } from "@/lib/services/matches";

export const runtime = "nodejs";

export const POST = withApi(async (_request, { params }) => {
  const { matchId } = await params;
  const match = await reopenMatchSquads(matchId);
  return json({ data: { squadsConfirmedAt: match.squadsConfirmedAt } });
});
