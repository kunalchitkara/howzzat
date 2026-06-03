import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getOrganization } from "@/lib/services/organizations";

export const runtime = "nodejs";

export const GET = withApi(async (_request, { params }) => {
  const { orgId } = await params;
  const organization = await getOrganization(orgId);
  return json({ data: organization });
});
