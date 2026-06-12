import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { requireRequestUser } from "@/lib/auth/request";
import { listTournamentsForUser } from "@/lib/services/tournaments";

export const runtime = "nodejs";

export const GET = withApi(async (request) => {
  const user = await requireRequestUser(request);
  const tournaments = await listTournamentsForUser(user.id);
  return json({ data: tournaments });
});
