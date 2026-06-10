import { ApiError } from "@/lib/api/http";
import { getUserBySessionToken, parseSessionCookie, type AuthUser } from "./session";

export async function getRequestUser(request: Request): Promise<AuthUser | null> {
  const token = parseSessionCookie(request.headers.get("cookie"));
  return getUserBySessionToken(token);
}

export async function requireRequestUser(request: Request): Promise<AuthUser> {
  const user = await getRequestUser(request);
  if (!user) {
    throw new ApiError(401, "Sign in required", "UNAUTHORIZED");
  }
  return user;
}

export function userHasOrgRole(
  user: AuthUser,
  organizationId: string,
  roles: string[],
): boolean {
  return user.memberships.some(
    (m) => m.organizationId === organizationId && roles.includes(m.role),
  );
}

export function requireOrgRole(
  user: AuthUser,
  organizationId: string,
  roles: string[] = ["OWNER", "MANAGER", "COACH"],
) {
  if (!userHasOrgRole(user, organizationId, roles)) {
    throw new ApiError(403, "Insufficient permissions", "FORBIDDEN");
  }
}
