import { NextResponse } from "next/server";
import { withApi } from "@/lib/api/handler";
import { buildGoogleAuthUrl } from "@/lib/auth/google";
import {
  createOAuthState,
  googleCallbackUriForOrigin,
  requestAppOrigin,
  oauthCallbackUriCookie,
  oauthLinkUserCookie,
  oauthRedirectCookie,
  oauthStateCookie,
  safeRedirectPath,
} from "@/lib/auth/oauth-state";
import { requireRequestUser } from "@/lib/auth/request";

export const runtime = "nodejs";

export const GET = withApi(async (request) => {
  const requestUrl = new URL(request.url);
  const redirectTo = safeRedirectPath(requestUrl.searchParams.get("redirect"));
  const linkMode = requestUrl.searchParams.get("link") === "1";
  const callbackUri = googleCallbackUriForOrigin(requestAppOrigin(request));
  const state = createOAuthState();
  const url = buildGoogleAuthUrl(state, callbackUri);

  const response = NextResponse.redirect(url);
  response.headers.append("Set-Cookie", oauthStateCookie(state));
  response.headers.append("Set-Cookie", oauthRedirectCookie(redirectTo));
  response.headers.append("Set-Cookie", oauthCallbackUriCookie(callbackUri));
  if (linkMode) {
    const user = await requireRequestUser(request);
    response.headers.append("Set-Cookie", oauthLinkUserCookie(user.id));
  }
  return response;
});
