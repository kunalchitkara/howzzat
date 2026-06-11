function formatZodDetails(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const fieldErrors = (details as { fieldErrors?: Record<string, string[]> })
    .fieldErrors;
  if (!fieldErrors) return null;
  const parts = Object.entries(fieldErrors).flatMap(([field, msgs]) =>
    (msgs ?? []).map((m) => `${field}: ${m}`),
  );
  return parts.length > 0 ? parts.join("; ") : null;
}

/** Extract a human-readable message from Howzzat API error JSON. */
export function parseApiErrorMessage(body: unknown): string {
  if (!body || typeof body !== "object") return "Request failed";
  const record = body as Record<string, unknown>;
  const err = record.error;
  const zodHint = formatZodDetails(record.details);
  if (typeof err === "string") {
    return zodHint && err === "Validation failed" ? `${err} — ${zodHint}` : err;
  }
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  if (typeof record.message === "string") return record.message;
  return "Request failed";
}

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
    throw new Error(parseApiErrorMessage(body));
  }
  return body.data as T;
}
