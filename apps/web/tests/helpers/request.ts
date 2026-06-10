export function apiUrl(path: string): string {
  return `http://localhost:3000${path}`;
}

export function jsonRequest(
  method: string,
  path: string,
  body?: unknown,
  cookie?: string,
): Request {
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  return new Request(apiUrl(path), {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function readResponse<T = unknown>(
  response: Response,
): Promise<{ status: number; body: T; cookies: string[] }> {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("Set-Cookie")].filter(Boolean) as string[];
  return {
    status: response.status,
    body: (await response.json()) as T,
    cookies: setCookies,
  };
}

export async function readJson<T = unknown>(
  response: Response,
): Promise<{ status: number; body: T }> {
  return {
    status: response.status,
    body: (await response.json()) as T,
  };
}

export function emptyParams<T extends Record<string, string>>(): {
  params: Promise<T>;
} {
  return { params: Promise.resolve({} as T) };
}

export function params<T extends Record<string, string>>(values: T): {
  params: Promise<T>;
} {
  return { params: Promise.resolve(values) };
}
