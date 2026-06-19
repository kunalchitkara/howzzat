import { test, expect } from "@playwright/test";
import { E2E_COUPON_ADMIN_SECRET } from "./constants";
import { registerWithPassword, signInWithPassword, uniqueEmail } from "./helpers/auth";

test.describe("manager happy path", () => {
  test("org → teams → tournament → match → invite → wallet coupon", async ({
    page,
    browser,
    request,
  }) => {
    const ownerEmail = uniqueEmail("owner");
    const managerEmail = uniqueEmail("manager");
    const clubName = `E2E Club ${Date.now()}`;
    const tournamentName = `E2E Cup ${Date.now()}`;
    const couponCode = `HOWZZAT-E2E-${Date.now()}`;

    await registerWithPassword(page, {
      email: ownerEmail,
      name: "E2E Owner",
    });

    await page.getByRole("link", { name: "+ New club" }).click();
    await page.getByLabel("Club name").fill(clubName);
    await page.getByRole("button", { name: "Create organization" }).click();
    await expect(page.getByRole("heading", { name: clubName })).toBeVisible();
    await page.getByRole("link", { name: "Teams" }).click();
    await page.getByLabel("Team name").fill("U9 Lions");
    await page.getByRole("button", { name: "Add team" }).click();
    await expect(page.getByRole("link", { name: "U9 Lions" })).toBeVisible();

    await page.getByLabel("Team name").fill("U9 Tigers");
    await page.getByRole("button", { name: "Add team" }).click();
    await expect(page.getByRole("link", { name: "U9 Tigers" })).toBeVisible();

    await page.getByRole("link", { name: `← ${clubName}` }).click();
    await page.getByRole("link", { name: "Tournaments" }).click();
    await page.getByRole("link", { name: "+ New tournament" }).click();
    await page.getByLabel("Tournament name").fill(tournamentName);
    await page.getByRole("button", { name: "Create tournament" }).click();
    await expect(page.getByRole("link", { name: tournamentName })).toBeVisible();
    await page.getByRole("link", { name: tournamentName }).click();

    await page.getByLabel("Team").selectOption({ label: "U9 Lions" });
    await page.getByRole("button", { name: "Add to tournament" }).click();
    await expect(page.getByText("U9 Lions").first()).toBeVisible();

    await page.getByLabel("Team").selectOption({ label: "U9 Tigers" });
    await page.getByRole("button", { name: "Add to tournament" }).click();
    await expect(page.getByText("Teams in tournament (2)")).toBeVisible();
    await expect(
      page.getByText("Create teams in your organization first, then add them to this tournament."),
    ).toBeVisible();

    await page.getByRole("link", { name: "← Tournaments" }).click();
    await page.getByRole("link", { name: "Teams" }).click();
    await page.getByRole("link", { name: "U9 Lions" }).click();
    await page.getByLabel("Player name").fill("Jamie");
    await page.getByLabel("Shirt number").fill("7");
    await page.getByRole("button", { name: "Add player" }).click();
    await expect(page.getByText("Jamie")).toBeVisible();

    await page.getByRole("link", { name: "← Teams" }).click();
    await page.getByRole("link", { name: `← ${clubName}` }).click();
    await page.getByRole("link", { name: "Tournaments" }).click();
    await page.getByRole("link", { name: tournamentName }).click();

    await page.getByLabel("Home team").selectOption({ label: "U9 Lions" });
    await page.getByLabel("Away team").selectOption({ label: "U9 Tigers" });
    await page.getByLabel("Venue").fill("Main Ground");
    await page.getByRole("button", { name: "Schedule match" }).click();
    await expect(page.getByText("U9 Lions vs U9 Tigers")).toBeVisible();
    await expect(page.getByText("Main Ground")).toBeVisible();

    await page.getByLabel("Manager email").fill(managerEmail);
    await page.getByRole("button", { name: "Send invite" }).click();
    const inviteLink = page.getByRole("link", { name: /\/invite\// });
    await expect(inviteLink).toBeVisible();
    const inviteHref = await inviteLink.getAttribute("href");
    expect(inviteHref).toMatch(/\/invite\//);

    const managerContext = await browser.newContext();
    const managerPage = await managerContext.newPage();
    await registerWithPassword(managerPage, {
      email: managerEmail,
      name: "E2E Manager",
      redirectTo: inviteHref!,
    });
    await managerPage.getByRole("button", { name: "Accept invite" }).click();
    await managerPage.waitForURL("**/dashboard**");
    await expect(managerPage.getByRole("heading", { name: "Your clubs" })).toBeVisible();
    await managerContext.close();

    const couponRes = await request.post("/api/v1/admin/coupons", {
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": E2E_COUPON_ADMIN_SECRET,
      },
      data: { amountPence: 2500, code: couponCode },
    });
    expect(couponRes.ok()).toBeTruthy();

    const walletHref = page.url().replace(/\/$/, "") + "/wallet";
    await page.goto(walletHref);
    await page.getByLabel("Coupon code").fill(couponCode);
    await page.getByRole("button", { name: "Redeem coupon" }).click();
    await expect(page.getByText("£25.00")).toBeVisible();

    await signInWithPassword(page, { email: ownerEmail });
    await expect(page.getByRole("heading", { name: "Your clubs" })).toBeVisible();
  });
});
