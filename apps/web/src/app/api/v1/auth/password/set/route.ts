import { z } from "zod";
import { ApiError, json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getUserProfile, serializeMeUser } from "@/lib/auth/profile";
import { hashPassword, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { requireRequestUser } from "@/lib/auth/request";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const bodySchema = z.object({
  password: z.string().min(PASSWORD_MIN_LENGTH).max(128),
});

export const POST = withApi(async (request) => {
  const user = await requireRequestUser(request);
  const input = await parseJson(request, bodySchema);

  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (existing?.passwordHash) {
    throw new ApiError(
      409,
      "Password is already set. Use change password instead.",
      "PASSWORD_ALREADY_SET",
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(input.password) },
  });

  const full = await getUserProfile(user.id);
  if (!full) {
    throw new ApiError(500, "Could not load user profile", "INTERNAL_ERROR");
  }
  return json({ data: serializeMeUser(full) });
});
