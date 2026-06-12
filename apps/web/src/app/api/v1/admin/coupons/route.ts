import { z } from "zod";
import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { assertCouponAdminSecret } from "@/lib/auth/admin";
import { createWalletCoupon } from "@/lib/services/wallet-coupons";

export const runtime = "nodejs";

const bodySchema = z.object({
  amountPence: z.number().int().positive(),
  maxRedemptions: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
  code: z.string().min(8).max(64).optional(),
});

export const POST = withApi(async (request) => {
  assertCouponAdminSecret(request);

  const body = await parseJson(request, bodySchema);
  const coupon = await createWalletCoupon({
    amountPence: body.amountPence,
    maxRedemptions: body.maxRedemptions,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    note: body.note ?? null,
    code: body.code,
  });

  return json({ data: coupon }, 201);
});
