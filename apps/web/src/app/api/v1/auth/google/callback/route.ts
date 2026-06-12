import { NextResponse } from "next/server";
import { withApi } from "@/lib/api/handler";
import { exchangeGoogleCode, signInWithGoogleProfile } from "@/lib/auth/google";
import {
  clearOAuthCookies,
  OAUTH_CALLBACK_URI_COOKIE,
  OAUTH_REDIRECT_COOKIE,
  OAUTH_STATE_COOKIE,
  parseCookie,
  safeRedirectPath,
} from "@/lib/auth/oauth-state";
import { createSession, sessionCookieValue } from "@/lib/auth/session";

export const runtime = "nodejs";

export const GET = withApi(async (request) => {
  const url = new URL(request.url);
  const cookieHeader = request.headers.get("cookie");
  const expectedState = parseCookie(cookieHeader, OAUTH_STATE_COOKIE);
  const redirectTo = safeRedirectPath(
    parseCookie(cookieHeader, OAUTH_REDIRECT_COOKIE),
  );

  const error = url.searchParams.get("error");
  if (error) {
    const response = NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error)}`, url.origin),
    );
    for (const cleared of clearOAuthCookies()) {
      response.headers.append("Set-Cookie", cleared);
    }
    return response;
  }

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!code || !state || !expectedState || state !== expectedState) {
    const response = NextResponse.redirect(
      new URL("/login?error=oauth_state", url.origin),
    );
    for (const cleared of clearOAuthCookies()) {
      response.headers.append("Set-Cookie", cleared);
    }
    return response;
  }

  const callbackUri = parseCookie(cookieHeader, OAUTH_CALLBACK_URI_COOKIE);
  const profile = await exchangeGoogleCode(code, callbackUri);
  const user = await signInWithGoogleProfile(profile);
  const { token } = await createSession(user.id);

  const response = NextResponse.redirect(new URL(redirectTo, url.origin));
  response.headers.set("Set-Cookie", sessionCookieValue(token));
  for (const cleared of clearOAuthCookies()) {
    response.headers.append("Set-Cookie", cleared);
  }
  return response;
});
