import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import {
  clearSessionCookie,
  deleteSession,
  parseSessionCookie,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export const POST = withApi(async (request) => {
  const token = parseSessionCookie(request.headers.get("cookie"));
  if (token) await deleteSession(token);
  const response = json({ data: { ok: true } });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
});
