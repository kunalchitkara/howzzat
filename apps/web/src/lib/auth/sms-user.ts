import { prisma } from "@/lib/db";

function syntheticEmailForPhone(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return `phone+${digits}@users.howzzat.app`;
}

export async function findOrCreateUserByPhone(phoneE164: string, name?: string) {
  const existing = await prisma.user.findUnique({
    where: { phone: phoneE164 },
  });
  if (existing) {
    if (name?.trim() && !existing.name) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { name: name.trim() },
      });
    }
    return existing;
  }

  return prisma.user.create({
    data: {
      phone: phoneE164,
      phoneVerified: new Date(),
      email: syntheticEmailForPhone(phoneE164),
      name: name?.trim() || null,
    },
  });
}

export async function markPhoneVerified(userId: string, phoneE164: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      phone: phoneE164,
      phoneVerified: new Date(),
    },
  });
}
