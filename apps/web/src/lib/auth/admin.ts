import { ApiError } from "../api/http";

export function assertCouponAdminSecret(request: Request): void {
  const secret = process.env.COUPON_ADMIN_SECRET;
  if (!secret) {
    throw new ApiError(
      503,
      "Coupon admin not configured",
      "COUPON_ADMIN_NOT_CONFIGURED",
    );
  }
  const header = request.headers.get("X-Admin-Secret");
  if (!header || header !== secret) {
    throw new ApiError(403, "Invalid admin secret", "FORBIDDEN");
  }
}
