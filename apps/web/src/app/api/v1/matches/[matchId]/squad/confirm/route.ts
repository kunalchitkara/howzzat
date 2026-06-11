import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { confirmMatchSquads } from "@/lib/services/matches";
import { confirmSquadsSchema } from "@/lib/validations";

export const runtime = "nodejs";

export const POST = withApi(async (request, { params }) => {
  const { matchId } = await params;
  const input = await parseJson(request, confirmSquadsSchema);
  const match = await confirmMatchSquads(matchId, {
    totalOvers: input.totalOvers,
  });
  return json({
    data: {
      squadsConfirmedAt: match.squadsConfirmedAt,
      totalOvers: match.totalOvers,
    },
  });
});
