import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { requireRequestUser } from "@/lib/auth/request";
import { listOrganizationsForUser } from "@/lib/services/organizations";

export const runtime = "nodejs";

export const GET = withApi(async (request) => {
  const user = await requireRequestUser(request);
  const organizations = await listOrganizationsForUser(user.id);
  return json({ data: organizations });
});
