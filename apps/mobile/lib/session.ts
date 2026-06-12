import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "howzzat_session";

export async function getSessionToken(): Promise<string | null> {
  return AsyncStorage.getItem(SESSION_KEY);
}

export async function setSessionToken(token: string | null): Promise<void> {
  if (token) await AsyncStorage.setItem(SESSION_KEY, token);
  else await AsyncStorage.removeItem(SESSION_KEY);
}

export function sessionCookieHeader(token: string): string {
  return `howzzat_session=${token}`;
}
