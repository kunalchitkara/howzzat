import { useEffect, useState } from "react";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import Constants from "expo-constants";
import { apiFetch } from "./api";
import { getSessionToken, setSessionToken } from "./session";

WebBrowser.maybeCompleteAuthSession();

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

type GoogleExtra = {
  googleWebClientId?: string;
  googleIosClientId?: string;
  googleAndroidClientId?: string;
};

function readGoogleExtra(): GoogleExtra {
  return (Constants.expoConfig?.extra ?? {}) as GoogleExtra;
}

export function useGoogleSignIn() {
  const extra = readGoogleExtra();
  const redirectUri = makeRedirectUri({ scheme: "howzzat" });
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: extra.googleIosClientId,
    androidClientId: extra.googleAndroidClientId,
    webClientId: extra.googleWebClientId,
    redirectUri,
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken =
      response.authentication?.idToken ??
      response.params?.id_token ??
      null;
    if (!idToken) {
      setError("Google did not return an ID token");
      return;
    }
    setBusy(true);
    setError(null);
    void apiFetch<{
      user: AuthUser;
      sessionToken: string;
    }>("/api/v1/auth/google/token", {
      method: "POST",
      body: JSON.stringify({ idToken }),
      skipAuth: true,
    })
      .then(async (data) => {
        await setSessionToken(data.sessionToken);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Sign-in failed");
      })
      .finally(() => setBusy(false));
  }, [response]);

  return {
    ready: Boolean(request),
    busy,
    error,
    signIn: () => {
      setError(null);
      return promptAsync();
    },
  };
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const data = await apiFetch<AuthUser | null>("/api/v1/auth/me");
  return data;
}

export async function signOut(): Promise<void> {
  const token = await getSessionToken();
  if (token) {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // Clear local session even if network fails.
    }
  }
  await setSessionToken(null);
}
