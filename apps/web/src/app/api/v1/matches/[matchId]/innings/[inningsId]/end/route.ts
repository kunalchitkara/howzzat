import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { endInningsEarly } from "@/lib/services/matches";

export const runtime = "nodejs";

export const POST = withApi(async (_request, { params }) => {
  const { matchId, inningsId } = await params;
  const innings = await endInningsEarly(matchId, inningsId);
  return json({ data: innings });
});
