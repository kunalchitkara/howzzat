import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getRequestUser } from "@/lib/auth/request";

export const runtime = "nodejs";

export const GET = withApi(async (request) => {
  const user = await getRequestUser(request);
  if (!user) return json({ data: null });
  return json({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      memberships: user.memberships.map((m) => ({
        role: m.role,
        organizationId: m.organizationId,
        organization: m.organization,
      })),
    },
  });
});
