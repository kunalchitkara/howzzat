import { z } from "zod";
import { ApiError, json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { normalizeEmail } from "@/lib/auth/email-user";
import { hashPassword, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { createSession, sessionCookieValue } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(128),
  name: z.string().min(1).max(120).optional(),
});

export const POST = withApi(async (request) => {
  const input = await parseJson(request, bodySchema);
  const email = normalizeEmail(input.email);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.passwordHash) {
    throw new ApiError(409, "An account with this email already exists", "EMAIL_TAKEN");
  }

  const passwordHash = hashPassword(input.password);
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          emailVerified: existing.emailVerified ?? new Date(),
          name: input.name?.trim() || existing.name,
        },
      })
    : await prisma.user.create({
        data: {
          email,
          passwordHash,
          emailVerified: new Date(),
          name: input.name?.trim() || null,
        },
      });

  const { token, expiresAt } = await createSession(user.id);
  const response = json(
    {
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        sessionToken: token,
        expiresAt: expiresAt.toISOString(),
      },
    },
    201,
  );
  response.headers.set("Set-Cookie", sessionCookieValue(token));
  return response;
});
