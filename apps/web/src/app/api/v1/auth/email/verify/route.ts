import { z } from "zod";
import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { findOrCreateUserByEmail } from "@/lib/auth/email-user";
import { createSession, sessionCookieValue } from "@/lib/auth/session";
import { checkEmailVerification } from "@/lib/auth/resend-verify";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
  name: z.string().min(1).max(120).optional(),
});

export const POST = withApi(async (request) => {
  const input = await parseJson(request, bodySchema);
  await checkEmailVerification(input.email, input.code);

  const user = await findOrCreateUserByEmail(input.email, input.name);
  const { token, expiresAt } = await createSession(user.id);

  const response = json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      sessionToken: token,
      expiresAt: expiresAt.toISOString(),
    },
  });
  response.headers.set("Set-Cookie", sessionCookieValue(token));
  return response;
});
