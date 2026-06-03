import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getRulesVersion } from "@/lib/services/rules";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { versionId } = await params;
  const version = await getRulesVersion(versionId);
  return json({ data: version });
});
