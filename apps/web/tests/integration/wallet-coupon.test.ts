import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createCouponRoute } from "@/app/api/v1/admin/coupons/route";
import { POST as redeemCouponRoute } from "@/app/api/v1/tournaments/[tournamentId]/wallet/redeem-coupon/route";
import { POST as loginRoute } from "@/app/api/v1/auth/login/route";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { prisma } from "@howzzat/db";
import { resetDatabase, seedTestFixtures } from "@howzzat/db/testing";
import {
  emptyParams,
  jsonRequest,
  params,
  readJson,
  readResponse,
} from "../helpers/request";

describe("wallet coupon API", () => {
  const adminSecret = "integration-coupon-admin";

  beforeEach(async () => {
    vi.stubEnv("COUPON_ADMIN_SECRET", adminSecret);
    await resetDatabase(prisma);
  });

  async function sessionCookie(): Promise<string> {
    const login = await readResponse(
      await loginRoute(
        jsonRequest("POST", "/api/v1/auth/login", {
          email: "coupon-manager@test.com",
          name: "Coupon Manager",
        }),
        emptyParams(),
      ),
    );
    expect(login.status).toBe(200);
    const match = login.cookies
      .join(";")
      .match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
    return `${SESSION_COOKIE}=${match?.[1]}`;
  }

  it("generates via admin API and redeems for tournament wallet credit", async () => {
    const fixtures = await seedTestFixtures(prisma);
    const cookie = await sessionCookie();
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "coupon-manager@test.com" },
    });
    await prisma.orgMembership.create({
      data: {
        organizationId: fixtures.orgId,
        userId: user.id,
        role: "OWNER",
      },
    });
    await prisma.tournamentManager.create({
      data: { tournamentId: fixtures.tournamentId, userId: user.id },
    });

    const created = await readJson(
      await createCouponRoute(
        new Request("http://localhost:3000/api/v1/admin/coupons", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Secret": adminSecret,
          },
          body: JSON.stringify({
            amountPence: 2500,
            note: "alpha tournament",
            code: "HOWZZAT-ALPHA-API1",
          }),
        }),
        emptyParams(),
      ),
    );
    expect(created.status).toBe(201);
    expect(created.body.data.code).toBe("HOWZZAT-ALPHA-API1");

    const redeemed = await readJson(
      await redeemCouponRoute(
        jsonRequest(
          "POST",
          `/api/v1/tournaments/${fixtures.tournamentId}/wallet/redeem-coupon`,
          { code: "howzzat-alpha-api1" },
          cookie,
        ),
        params({ tournamentId: fixtures.tournamentId }),
      ),
    );
    expect(redeemed.status).toBe(200);
    expect(redeemed.body.data.balancePence).toBe(2500);
    expect(redeemed.body.data.amountPence).toBe(2500);

    const tournament = await prisma.tournament.findUniqueOrThrow({
      where: { id: fixtures.tournamentId },
    });
    expect(tournament.balancePence).toBe(2500);

    const redemption = await prisma.walletCouponRedemption.findFirst({
      where: { tournamentId: fixtures.tournamentId },
    });
    expect(redemption?.userId).toBe(user.id);
  });

  it("rejects admin coupon creation without secret", async () => {
    const res = await readJson(
      await createCouponRoute(
        jsonRequest("POST", "/api/v1/admin/coupons", { amountPence: 1000 }),
        emptyParams(),
      ),
    );
    expect(res.status).toBe(403);
  });
});
