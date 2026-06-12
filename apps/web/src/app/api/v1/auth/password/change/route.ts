import { z } from "zod";
import { ApiError, json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getUserProfile, serializeMeUser } from "@/lib/auth/profile";
import { hashPassword, PASSWORD_MIN_LENGTH, verifyPassword } from "@/lib/auth/password";
import { requireRequestUser } from "@/lib/auth/request";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(128),
});

export const POST = withApi(async (request) => {
  const user = await requireRequestUser(request);
  const input = await parseJson(request, bodySchema);

  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!existing?.passwordHash) {
    throw new ApiError(400, "No password set yet", "PASSWORD_NOT_SET");
  }
  if (!verifyPassword(input.currentPassword, existing.passwordHash)) {
    throw new ApiError(401, "Current password is incorrect", "INVALID_PASSWORD");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(input.newPassword) },
  });

  const full = await getUserProfile(user.id);
  if (!full) {
    throw new ApiError(500, "Could not load user profile", "INTERNAL_ERROR");
  }
  return json({ data: serializeMeUser(full) });
});
