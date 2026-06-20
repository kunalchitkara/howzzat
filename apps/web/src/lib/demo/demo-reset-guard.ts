import { ApiError } from "@/lib/api/http";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const rateLimitByIp = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(request: Request): void {
  const ip = clientIp(request);
  const now = Date.now();
  const entry = rateLimitByIp.get(ip);

  if (!entry || now >= entry.resetAt) {
    rateLimitByIp.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return;
  }

  if (entry.count >= RATE_LIMIT) {
    throw new ApiError(
      429,
      "Demo reset rate limit exceeded (5 per hour)",
      "DEMO_RESET_RATE_LIMIT",
    );
  }

  entry.count += 1;
}

/** Gate demo reset endpoints in production; no friction in local dev. */
export function assertDemoResetAllowed(request: Request): void {
  if (process.env.NODE_ENV !== "production") return;

  if (process.env.ALLOW_DEMO_RESET === "true") return;

  const secret = process.env.DEMO_RESET_SECRET;
  const provided = request.headers.get("x-demo-reset-secret");
  if (secret) {
    if (provided === secret) return;
    throw new ApiError(
      403,
      "Demo reset requires a valid X-Demo-Reset-Secret header",
      "DEMO_RESET_FORBIDDEN",
    );
  }

  checkRateLimit(request);
}
