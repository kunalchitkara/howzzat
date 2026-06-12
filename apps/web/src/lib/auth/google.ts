import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/db";

const GOOGLE_PROVIDER = "google";

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export function googleRedirectUri(): string {
  return `${appOrigin()}/api/v1/auth/google/callback`;
}

export function getGoogleOAuthClient(redirectUri = googleRedirectUri()): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  }
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

export function buildGoogleAuthUrl(state: string, redirectUri?: string): string {
  const uri = redirectUri ?? googleRedirectUri();
  const client = getGoogleOAuthClient(uri);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["openid", "email", "profile"],
    state,
    redirect_uri: uri,
  });
}

export async function exchangeGoogleCode(code: string, redirectUri?: string) {
  const client = getGoogleOAuthClient(redirectUri ?? googleRedirectUri());
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) {
    throw new Error("Google did not return an ID token");
  }
  return verifyGoogleIdToken(tokens.id_token);
}

export async function verifyGoogleIdToken(idToken: string) {
  const audiences = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
  ].filter((id): id is string => Boolean(id));

  if (audiences.length === 0) {
    throw new Error("At least one Google client ID must be configured");
  }

  const client = getGoogleOAuthClient();
  for (const audience of audiences) {
    try {
      const ticket = await client.verifyIdToken({ idToken, audience });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        continue;
      }
      return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name ?? undefined,
        emailVerified: payload.email_verified === true,
        picture: payload.picture ?? undefined,
      };
    } catch {
      // Try next audience (web vs iOS vs Android client IDs).
    }
  }
  throw new Error("Invalid Google ID token");
}

export async function signInWithGoogleProfile(profile: {
  sub: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
}) {
  const email = profile.email.toLowerCase().trim();

  const linked = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: GOOGLE_PROVIDER,
        providerAccountId: profile.sub,
      },
    },
    include: { user: true },
  });
  if (linked) return linked.user;

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: profile.name?.trim() || null,
        emailVerified: profile.emailVerified ? new Date() : null,
      },
    });
  } else {
    const updates: { name?: string; emailVerified?: Date } = {};
    if (profile.name?.trim() && !user.name) updates.name = profile.name.trim();
    if (profile.emailVerified && !user.emailVerified) {
      updates.emailVerified = new Date();
    }
    if (Object.keys(updates).length > 0) {
      user = await prisma.user.update({ where: { id: user.id }, data: updates });
    }
  }

  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: GOOGLE_PROVIDER,
        providerAccountId: profile.sub,
      },
    },
    create: {
      userId: user.id,
      type: "oauth",
      provider: GOOGLE_PROVIDER,
      providerAccountId: profile.sub,
    },
    update: { userId: user.id },
  });

  return user;
}
