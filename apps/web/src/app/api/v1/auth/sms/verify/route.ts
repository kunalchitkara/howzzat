import { z } from "zod";
import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { normalizeUkPhone } from "@/lib/auth/phone";
import { findOrCreateUserByPhone } from "@/lib/auth/sms-user";
import { createSession, sessionCookieValue } from "@/lib/auth/session";
import { checkSmsVerification } from "@/lib/auth/twilio-verify";

export const runtime = "nodejs";

const bodySchema = z.object({
  phone: z.string().min(10).max(20),
  code: z.string().regex(/^\d{4,8}$/),
  name: z.string().min(1).max(120).optional(),
});

export const POST = withApi(async (request) => {
  const input = await parseJson(request, bodySchema);
  const e164 = normalizeUkPhone(input.phone);
  await checkSmsVerification(e164, input.code);

  const user = await findOrCreateUserByPhone(e164, input.name);
  const { token, expiresAt } = await createSession(user.id);

  const response = json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
      },
      sessionToken: token,
      expiresAt: expiresAt.toISOString(),
    },
  });
  response.headers.set("Set-Cookie", sessionCookieValue(token));
  return response;
});
