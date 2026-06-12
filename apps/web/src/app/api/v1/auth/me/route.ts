import { z } from "zod";
import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getUserProfile, serializeMeUser } from "@/lib/auth/profile";
import { getRequestUser, requireRequestUser } from "@/lib/auth/request";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const GET = withApi(async (request) => {
  const user = await getRequestUser(request);
  if (!user) return json({ data: null });

  const full = await getUserProfile(user.id);
  if (!full) return json({ data: null });
  return json({ data: serializeMeUser(full) });
});

export const PATCH = withApi(async (request) => {
  const user = await requireRequestUser(request);
  const input = await parseJson(request, patchSchema);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name: input.name },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      emailVerified: true,
      accounts: { select: { provider: true } },
      memberships: {
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
    },
  });

  return json({ data: serializeMeUser(updated) });
});
