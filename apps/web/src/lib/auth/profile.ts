import { prisma } from "@/lib/db";
import type { AuthUser } from "./session";

const GOOGLE_PROVIDER = "google";

export type AccountProfile = {
  hasPassword: boolean;
  hasGoogle: boolean;
  emailVerified: boolean;
  steps: {
    name: boolean;
    email: boolean;
    password: boolean;
    google: boolean;
  };
};

export function buildAccountProfile(user: {
  name: string | null;
  passwordHash: string | null;
  emailVerified: Date | null;
  accounts: { provider: string }[];
}): AccountProfile {
  const hasGoogle = user.accounts.some((a) => a.provider === GOOGLE_PROVIDER);
  const emailVerified = user.emailVerified != null;
  return {
    hasPassword: user.passwordHash != null,
    hasGoogle,
    emailVerified,
    steps: {
      name: Boolean(user.name?.trim()),
      email: emailVerified,
      password: user.passwordHash != null,
      google: hasGoogle,
    },
  };
}

export async function getUserProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
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
}

export function serializeMeUser(
  user: NonNullable<Awaited<ReturnType<typeof getUserProfile>>>,
) {
  const profile = buildAccountProfile(user);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    memberships: user.memberships.map((m) => ({
      role: m.role,
      organizationId: m.organizationId,
      organization: m.organization,
    })),
    profile,
  };
}

export function serializeAuthUser(user: AuthUser, profile: AccountProfile) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    memberships: user.memberships,
    profile,
  };
}
