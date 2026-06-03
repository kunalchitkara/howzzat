import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { cloneRulesProfileSchema } from "@/lib/validations";
import { listRulesTemplates, cloneRulesProfile } from "@/lib/services/rules";

export const runtime = "nodejs";

export const GET = withApi(async (request) => {
  const includeConfig =
    new URL(request.url).searchParams.get("includeConfig") === "true";
  const profiles = await listRulesTemplates(includeConfig);
  return json({ data: profiles });
});

export const POST = withApi(async (request) => {
  const input = await parseJson(request, cloneRulesProfileSchema);
  const version = await cloneRulesProfile(input);
  return json({ data: version }, 201);
});
