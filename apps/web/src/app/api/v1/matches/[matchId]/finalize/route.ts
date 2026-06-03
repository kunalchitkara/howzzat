import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { finalizeMatchInnings } from "@/lib/services/matches";

export const runtime = "nodejs";

export const POST = withApi(async (_request, { params }) => {
  const { matchId } = await params;
  const match = await finalizeMatchInnings(matchId);
  return json({ data: match });
});
