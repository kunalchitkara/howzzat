import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { requireRequestUser } from "@/lib/auth/request";
import { acceptInvite } from "@/lib/services/invites";

export const runtime = "nodejs";

export const POST = withApi(async (request, { params }) => {
  const user = await requireRequestUser(request);
  const { token } = await params;
  const invite = await acceptInvite(token, user.id);
  return json({ data: invite });
});
