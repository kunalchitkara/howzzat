export function apiUrl(path: string): string {
  return `http://localhost:3000${path}`;
}

export function jsonRequest(
  method: string,
  path: string,
  body?: unknown,
): Request {
  return new Request(apiUrl(path), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
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
