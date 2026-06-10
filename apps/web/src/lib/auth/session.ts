import { prisma } from "@/lib/db";
import { randomToken } from "@/lib/api/slug";

export const SESSION_COOKIE = "howzzat_session";
const SESSION_DAYS = 30;

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  memberships: {
    role: string;
    organizationId: string;
    organization: { id: string; name: string; slug: string };
  }[];
};

export async function findOrCreateUser(email: string, name?: string) {
  const normalized = email.toLowerCase().trim();
  return prisma.user.upsert({
    where: { email: normalized },
    create: { email: normalized, name: name?.trim() || null },
    update: name?.trim() ? { name: name.trim() } : {},
  });
}

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);
  await prisma.session.create({
    data: { userId, token, expiresAt },
  });
  return { token, expiresAt };
}

export async function deleteSession(token: string) {
  await prisma.session.deleteMany({ where: { token } });
}

export async function getUserBySessionToken(
  token: string | undefined | null,
): Promise<AuthUser | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          memberships: {
            include: {
              organization: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    return null;
  }
  return session.user;
}

export function sessionCookieValue(token: string): string {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function parseSessionCookie(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]*)`));
  return match?.[1];
}
