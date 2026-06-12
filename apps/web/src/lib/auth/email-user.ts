import { prisma } from "@/lib/db";

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export async function findOrCreateUserByEmail(email: string, name?: string) {
  const normalized = normalizeEmail(email);
  const existing = await prisma.user.findUnique({
    where: { email: normalized },
  });
  if (existing) {
    const data: { name?: string; emailVerified: Date } = {
      emailVerified: new Date(),
    };
    if (name?.trim() && !existing.name) {
      data.name = name.trim();
    }
    return prisma.user.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.user.create({
    data: {
      email: normalized,
      name: name?.trim() || null,
      emailVerified: new Date(),
    },
  });
}
