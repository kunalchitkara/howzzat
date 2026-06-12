import { z } from "zod";
import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { requireRequestUser } from "@/lib/auth/request";
import { redeemWalletCoupon } from "@/lib/services/wallet-coupons";

export const runtime = "nodejs";

const bodySchema = z.object({
  code: z.string().min(4).max(64),
});

export const POST = withApi(async (request, { params }) => {
  const { tournamentId } = await params;
  const user = await requireRequestUser(request);
  const { code } = await parseJson(request, bodySchema);

  const result = await redeemWalletCoupon(tournamentId, code, user);

  return json({
    data: {
      redemption: result.redemption,
      balancePence: result.tournament.balancePence,
      amountPence: result.coupon.amountPence,
    },
  });
});
