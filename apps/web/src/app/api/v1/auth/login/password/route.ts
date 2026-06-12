import { z } from "zod";
import { ApiError, json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { normalizeEmail } from "@/lib/auth/email-user";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, sessionCookieValue } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export const POST = withApi(async (request) => {
  const input = await parseJson(request, bodySchema);
  const email = normalizeEmail(input.email);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
    throw new ApiError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

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
