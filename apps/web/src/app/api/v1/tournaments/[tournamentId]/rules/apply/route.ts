import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { ruleChangeSchema } from "@/lib/validations";
import { applyTournamentRuleChange } from "@/lib/services/rule-changes";

export const runtime = "nodejs";

export const POST = withApi(async (request, { params }) => {
  const { tournamentId } = await params;
  const input = await parseJson(request, ruleChangeSchema);
  const result = await applyTournamentRuleChange(tournamentId, input);
  return json({ data: result });
});
