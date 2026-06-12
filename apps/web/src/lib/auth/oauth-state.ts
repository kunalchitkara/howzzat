import { randomToken } from "@/lib/api/slug";

export const OAUTH_STATE_COOKIE = "howzzat_oauth_state";
export const OAUTH_REDIRECT_COOKIE = "howzzat_oauth_redirect";
export const OAUTH_CALLBACK_URI_COOKIE = "howzzat_oauth_callback_uri";

const OAUTH_COOKIE_MAX_AGE = 10 * 60; // 10 minutes

function cookieBase(name: string, value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function createOAuthState(): string {
  return randomToken();
}

export function oauthStateCookie(state: string): string {
  return cookieBase(OAUTH_STATE_COOKIE, state, OAUTH_COOKIE_MAX_AGE);
}

export function oauthRedirectCookie(redirectTo: string): string {
  return cookieBase(OAUTH_REDIRECT_COOKIE, redirectTo, OAUTH_COOKIE_MAX_AGE);
}

export function oauthCallbackUriCookie(callbackUri: string): string {
  return cookieBase(OAUTH_CALLBACK_URI_COOKIE, callbackUri, OAUTH_COOKIE_MAX_AGE);
}

export function clearOAuthCookies(): string[] {
  return [
    `${OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    `${OAUTH_REDIRECT_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    `${OAUTH_CALLBACK_URI_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  ];
}

export function googleCallbackUriForOrigin(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/v1/auth/google/callback`;
}

/** Prefer NEXT_PUBLIC_APP_URL in production so OAuth matches Google Console. */
export function requestAppOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured && process.env.NODE_ENV === "production") {
    return configured;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
    const host = forwardedHost.split(",")[0].trim();
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

export function parseCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  if (!match?.[1]) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function safeRedirectPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}
