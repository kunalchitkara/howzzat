export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = await res.json();
  if (!res.ok) {
    const message =
      body?.error?.message ?? body?.error ?? body?.message ?? "Request failed";
    throw new Error(typeof message === "string" ? message : "Request failed");
  }
  return body.data as T;
}
