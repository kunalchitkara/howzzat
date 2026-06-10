import Constants from "expo-constants";

const DEFAULT_API = "http://localhost:3005";

/** API base URL from app.json extra.apiUrl. */
export function getApiBase(): string {
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  const url = extra?.apiUrl?.trim();
  return (url ?? DEFAULT_API).replace(/\/$/, "");
}
