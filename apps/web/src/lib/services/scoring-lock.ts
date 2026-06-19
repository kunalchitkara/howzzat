import type { AuthUser } from "@/lib/auth/session";
import { userHasOrgRole } from "@/lib/auth/request";
import { ApiError } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { canUserScoreMatch } from "./tournament-access";
import { getMatch } from "./matches";

export const SCORING_ROLES = ["OWNER", "MANAGER", "SCORER"] as const;

const DEMO_SLUGS = new Set(["u9-live", "ios-live"]);

export function isPublicDemoMatch(match: { publicSlug: string | null }): boolean {
  return match.publicSlug != null && DEMO_SLUGS.has(match.publicSlug);
}

export function scorerDisplayName(user: {
  name: string | null;
  email: string;
}): string {
  return user.name?.trim() || user.email;
}

export interface ScoringLockInfo {
  /** Match is not a public demo — sign-in required before scoring. */
  requiresAuth: boolean;
  /** Viewer is not signed in (show sign-in prompt). */
  needsSignIn: boolean;
  canScore: boolean;
  lockedByOther: boolean;
  isHolder: boolean;
  holderUserId: string | null;
  holderName: string | null;
  claimedAt: string | null;
}

export function buildScoringLockInfo(
  match: Awaited<ReturnType<typeof getMatch>>,
  user: AuthUser | null,
  authorizedToScore = false,
): ScoringLockInfo {
  const demo = isPublicDemoMatch(match);
  const orgId = match.tournament.organizationId;
  const holder = match.scoringUser;

  if (!user) {
    return {
      requiresAuth: !demo,
      needsSignIn: !demo,
      canScore: demo,
      lockedByOther: false,
      isHolder: false,
      holderUserId: holder?.id ?? null,
      holderName: holder ? scorerDisplayName(holder) : null,
      claimedAt: match.scoringClaimedAt?.toISOString() ?? null,
    };
  }

  const isCoach =
    userHasOrgRole(user, orgId, [...SCORING_ROLES]) || authorizedToScore;
  if (!isCoach && !demo) {
    return {
      requiresAuth: true,
      needsSignIn: false,
      canScore: false,
      lockedByOther: false,
      isHolder: false,
      holderUserId: holder?.id ?? null,
      holderName: holder ? scorerDisplayName(holder) : null,
      claimedAt: match.scoringClaimedAt?.toISOString() ?? null,
    };
  }

  const isHolder = !holder || holder.id === user.id;
  const lockedByOther = Boolean(holder && holder.id !== user.id);

  return {
    requiresAuth: !demo,
    needsSignIn: false,
    canScore: isHolder,
    lockedByOther,
    isHolder: isHolder && Boolean(holder),
    holderUserId: holder?.id ?? null,
    holderName: holder ? scorerDisplayName(holder) : null,
    claimedAt: match.scoringClaimedAt?.toISOString() ?? null,
  };
}

export async function claimMatchScoring(
  matchId: string,
  user: AuthUser,
): Promise<Awaited<ReturnType<typeof getMatch>>> {
  const match = await getMatch(matchId);
  const orgId = match.tournament.organizationId;

  const authorized =
    isPublicDemoMatch(match) ||
    userHasOrgRole(user, orgId, [...SCORING_ROLES]) ||
    (await canUserScoreMatch(matchId, user.id));
  if (!authorized) {
    throw new ApiError(
      403,
      "Only club managers can score this match",
      "FORBIDDEN",
    );
  }

  if (match.scoringUserId && match.scoringUserId !== user.id) {
    const holder =
      match.scoringUser ??
      (await prisma.user.findUnique({ where: { id: match.scoringUserId } }));
    const name = holder ? scorerDisplayName(holder) : "Another manager";
    throw new ApiError(
      409,
      `${name} is already scoring this match`,
      "SCORING_LOCKED",
    );
  }

  await prisma.match.update({
    where: { id: match.id },
    data: {
      scoringUserId: user.id,
      scoringClaimedAt: new Date(),
    },
  });

  return getMatch(match.id);
}

/** Enforce exclusive scoring lock before mutating match state. */
export async function assertCanMutateScoring(
  matchId: string,
  user: AuthUser | null,
): Promise<void> {
  const match = await getMatch(matchId);
  const demo = isPublicDemoMatch(match);

  if (!user) {
    if (demo) return;
    throw new ApiError(401, "Sign in required to score", "UNAUTHORIZED");
  }

  const orgId = match.tournament.organizationId;
  const authorized =
    demo ||
    userHasOrgRole(user, orgId, [...SCORING_ROLES]) ||
    (await canUserScoreMatch(matchId, user.id));
  if (!authorized) {
    throw new ApiError(
      403,
      "Only club managers can score this match",
      "FORBIDDEN",
    );
  }

  if (match.scoringUserId && match.scoringUserId !== user.id) {
    const holder =
      match.scoringUser ??
      (await prisma.user.findUnique({ where: { id: match.scoringUserId } }));
    const name = holder ? scorerDisplayName(holder) : "Another manager";
    throw new ApiError(
      409,
      `${name} is already scoring this match`,
      "SCORING_LOCKED",
    );
  }

  await prisma.match.update({
    where: { id: match.id },
    data: {
      scoringUserId: user.id,
      scoringClaimedAt: new Date(),
    },
  });
}
