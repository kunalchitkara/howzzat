import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@howzzat/db";
import { resetDatabase, seedTestFixtures } from "@howzzat/db/testing";
import { ApiError } from "@/lib/api/http";
import {
  createWalletCoupon,
  generateCouponCode,
  normalizeCouponCode,
  redeemWalletCoupon,
} from "@/lib/services/wallet-coupons";
import type { AuthUser } from "@/lib/auth/session";

describe("wallet coupon helpers", () => {
  it("normalizes codes to uppercase", () => {
    expect(normalizeCouponCode(" howzzat-alpha-ab12 ")).toBe("HOWZZAT-ALPHA-AB12");
  });

  it("generates human-readable codes", () => {
    const code = generateCouponCode();
    expect(code).toMatch(/^HOWZZAT-ALPHA-[A-Z2-9]{4}$/);
  });
});

describe("wallet coupon service", () => {
  const adminSecret = "test-coupon-admin-secret";

  beforeEach(async () => {
    vi.stubEnv("COUPON_ADMIN_SECRET", adminSecret);
    await resetDatabase(prisma);
  });

  async function managerUser(
    tournamentId: string,
    orgId: string,
  ): Promise<AuthUser> {
    const user = await prisma.user.create({
      data: { email: "manager@test.com", name: "Manager" },
    });
    await prisma.orgMembership.create({
      data: { organizationId: orgId, userId: user.id, role: "OWNER" },
    });
    await prisma.tournamentManager.create({
      data: { tournamentId, userId: user.id, role: "OWNER" },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      memberships: [{ organizationId: orgId, role: "OWNER" }],
    };
  }

  it("creates and redeems a coupon", async () => {
    const fixtures = await seedTestFixtures(prisma);
    const user = await managerUser(fixtures.tournamentId, fixtures.orgId);

    const coupon = await createWalletCoupon({
      amountPence: 2000,
      maxRedemptions: 2,
      note: "beta tester",
      code: "HOWZZAT-ALPHA-TEST",
    });

    const result = await redeemWalletCoupon(
      fixtures.tournamentId,
      coupon.code,
      user,
    );

    expect(result.tournament.balancePence).toBe(2000);
    expect(result.redemption.amountPence).toBe(2000);
    expect(result.topUp.status).toBe("COMPLETED");

    const updated = await prisma.walletCoupon.findUniqueOrThrow({
      where: { id: coupon.id },
    });
    expect(updated.redemptionCount).toBe(1);
  });

  it("rejects duplicate redemption on same tournament", async () => {
    const fixtures = await seedTestFixtures(prisma);
    const user = await managerUser(fixtures.tournamentId, fixtures.orgId);

    await createWalletCoupon({
      amountPence: 1000,
      maxRedemptions: 5,
      code: "HOWZZAT-ALPHA-DUP",
    });

    await redeemWalletCoupon(fixtures.tournamentId, "howzzat-alpha-dup", user);

    await expect(
      redeemWalletCoupon(fixtures.tournamentId, "HOWZZAT-ALPHA-DUP", user),
    ).rejects.toMatchObject({
      code: "COUPON_ALREADY_REDEEMED",
    });
  });

  it("rejects expired coupons", async () => {
    const fixtures = await seedTestFixtures(prisma);
    const user = await managerUser(fixtures.tournamentId, fixtures.orgId);

    await createWalletCoupon({
      amountPence: 1000,
      code: "HOWZZAT-ALPHA-OLD",
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(
      redeemWalletCoupon(fixtures.tournamentId, "HOWZZAT-ALPHA-OLD", user),
    ).rejects.toMatchObject({ code: "COUPON_EXPIRED" });
  });

  it("rejects invalid codes", async () => {
    const fixtures = await seedTestFixtures(prisma);
    const user = await managerUser(fixtures.tournamentId, fixtures.orgId);

    await expect(
      redeemWalletCoupon(fixtures.tournamentId, "NO-SUCH-CODE", user),
    ).rejects.toMatchObject({ code: "COUPON_INVALID" });
  });

  it("rejects redemption when global cap reached", async () => {
    const fixtures = await seedTestFixtures(prisma);
    const user = await managerUser(fixtures.tournamentId, fixtures.orgId);

    const org2 = await prisma.organization.create({
      data: { name: "Other Club", slug: "other-club" },
    });
    const version = await prisma.rulesProfileVersion.findFirstOrThrow();
    const tournament2 = await prisma.tournament.create({
      data: {
        organizationId: org2.id,
        name: "Other",
        slug: "other",
        rulesProfileVersionId: version.id,
        rulesBindings: { create: { rulesProfileVersionId: version.id } },
      },
    });
    await prisma.tournamentManager.create({
      data: { tournamentId: tournament2.id, userId: user.id },
    });
    await prisma.orgMembership.create({
      data: { organizationId: org2.id, userId: user.id, role: "OWNER" },
    });

    await createWalletCoupon({
      amountPence: 500,
      maxRedemptions: 1,
      code: "HOWZZAT-ALPHA-ONCE",
    });

    await redeemWalletCoupon(fixtures.tournamentId, "HOWZZAT-ALPHA-ONCE", user);

    await expect(
      redeemWalletCoupon(tournament2.id, "HOWZZAT-ALPHA-ONCE", user),
    ).rejects.toMatchObject({ code: "COUPON_EXHAUSTED" });
  });

  it("blocks non-managers from redeeming", async () => {
    const fixtures = await seedTestFixtures(prisma);
    const outsider = await prisma.user.create({
      data: { email: "outsider@test.com" },
    });
    const user: AuthUser = {
      id: outsider.id,
      email: outsider.email,
      name: null,
      memberships: [],
    };

    await createWalletCoupon({ amountPence: 1000, code: "HOWZZAT-ALPHA-NOPE" });

    await expect(
      redeemWalletCoupon(fixtures.tournamentId, "HOWZZAT-ALPHA-NOPE", user),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
