import { randomBytes } from "node:crypto";
import { ApiError } from "../api/http";
import { prisma } from "../db";
import { assertCanTopUpWallet } from "./wallet-stripe";
import type { AuthUser } from "../auth/session";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_CODE_PREFIX = "HOWZZAT-ALPHA";

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

export function generateCouponCode(prefix = DEFAULT_CODE_PREFIX): string {
  let suffix = "";
  const bytes = randomBytes(4);
  for (let i = 0; i < 4; i++) {
    suffix += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return `${prefix}-${suffix}`;
}

export interface CreateWalletCouponInput {
  amountPence: number;
  maxRedemptions?: number;
  expiresAt?: Date | null;
  note?: string | null;
  code?: string;
  createdByUserId?: string | null;
}

export async function createWalletCoupon(input: CreateWalletCouponInput) {
  const {
    amountPence,
    maxRedemptions = 1,
    expiresAt = null,
    note = null,
    createdByUserId = null,
  } = input;

  if (amountPence <= 0) {
    throw new ApiError(400, "Amount must be positive", "INVALID_AMOUNT");
  }
  if (maxRedemptions < 1) {
    throw new ApiError(
      400,
      "maxRedemptions must be at least 1",
      "INVALID_MAX_REDEMPTIONS",
    );
  }

  const code = normalizeCouponCode(input.code ?? generateCouponCode());

  return prisma.walletCoupon.create({
    data: {
      code,
      amountPence,
      maxRedemptions,
      expiresAt,
      note,
      createdByUserId,
    },
  });
}

function assertCouponRedeemable(coupon: {
  redemptionCount: number;
  maxRedemptions: number;
  expiresAt: Date | null;
}): void {
  if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
    throw new ApiError(400, "Coupon has expired", "COUPON_EXPIRED");
  }
  if (coupon.redemptionCount >= coupon.maxRedemptions) {
    throw new ApiError(
      400,
      "Coupon has reached its redemption limit",
      "COUPON_EXHAUSTED",
    );
  }
}

export async function redeemWalletCoupon(
  tournamentId: string,
  rawCode: string,
  user: AuthUser,
) {
  await assertCanTopUpWallet(tournamentId, user);

  const code = normalizeCouponCode(rawCode);
  const coupon = await prisma.walletCoupon.findUnique({ where: { code } });
  if (!coupon) {
    throw new ApiError(400, "Invalid coupon code", "COUPON_INVALID");
  }

  assertCouponRedeemable(coupon);

  const existing = await prisma.walletCouponRedemption.findUnique({
    where: {
      couponId_tournamentId: { couponId: coupon.id, tournamentId },
    },
  });
  if (existing) {
    throw new ApiError(
      400,
      "This coupon was already redeemed for this tournament",
      "COUPON_ALREADY_REDEEMED",
    );
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const fresh = await tx.walletCoupon.findUniqueOrThrow({
      where: { id: coupon.id },
    });
    assertCouponRedeemable(fresh);

    const topUp = await tx.walletTopUp.create({
      data: {
        tournamentId,
        amountPence: fresh.amountPence,
        paidByUserId: user.id,
        status: "COMPLETED",
        completedAt: now,
      },
    });

    const redemption = await tx.walletCouponRedemption.create({
      data: {
        couponId: fresh.id,
        tournamentId,
        userId: user.id,
        amountPence: fresh.amountPence,
      },
    });

    await tx.walletCoupon.update({
      where: { id: fresh.id },
      data: { redemptionCount: { increment: 1 } },
    });

    const tournament = await tx.tournament.update({
      where: { id: tournamentId },
      data: { balancePence: { increment: fresh.amountPence } },
    });

    return { coupon: fresh, redemption, topUp, tournament };
  });
}
