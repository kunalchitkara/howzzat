import { test, expect } from "@playwright/test";
import { registerWithPassword, uniqueEmail } from "./helpers/auth";

const PUBLIC_ROUTES = ["/", "/demo", "/api/health"] as const;

test.describe("smoke — public pages", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`GET ${route} does not 500`, async ({ request }) => {
      const response = await request.get(route);
      expect(response.status(), await response.text()).toBeLessThan(500);
    });
  }

  test("GET /demo renders presentation", async ({ page }) => {
    const response = await page.goto("/demo");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("body")).not.toContainText("Application error");
  });
});

test.describe("smoke — authenticated dashboard", () => {
  test("dashboard, org, tournament, and match pages load", async ({ page, request }) => {
    const email = uniqueEmail("smoke");
    const clubName = `Smoke Club ${Date.now()}`;
    const tournamentName = `Smoke Cup ${Date.now()}`;

    await registerWithPassword(page, { email, name: "Smoke Tester" });

    const dashboardResponse = await page.goto("/dashboard");
    expect(dashboardResponse?.status()).toBeLessThan(500);
    await expect(page.locator("body")).not.toContainText("Application error");

    await page.getByRole("link", { name: "+ New club" }).click();
    await page.getByLabel("Club name").fill(clubName);
    await page.getByRole("button", { name: "Create organization" }).click();
    await expect(page.getByRole("heading", { name: clubName })).toBeVisible();

    const orgUrl = page.url();
    expect(orgUrl).toMatch(/\/dashboard\/organizations\//);

    await page.getByRole("link", { name: "Teams" }).click();
    await expect(page.locator("body")).not.toContainText("Application error");

    await page.getByRole("link", { name: `← ${clubName}` }).click();
    await page.getByRole("link", { name: "Tournaments" }).click();
    await expect(page.locator("body")).not.toContainText("Application error");

    await page.getByRole("link", { name: "+ New tournament" }).click();
    await page.getByLabel("Tournament name").fill(tournamentName);
    await page.getByRole("button", { name: "Create tournament" }).click();
    await expect(page.getByRole("link", { name: tournamentName })).toBeVisible();

    await page.getByRole("link", { name: tournamentName }).click();
    await expect(page.locator("body")).not.toContainText("Application error");

    const tournamentUrl = page.url();
    expect(tournamentUrl).toMatch(/\/tournaments\//);

    const demoReset = await request.post("/api/v1/demo/u9-match");
    expect(demoReset.status()).toBeLessThan(500);
    const demoBody = (await demoReset.json()) as {
      data?: { matchId?: string; slug?: string };
    };
    const matchSlug = demoBody.data?.slug ?? demoBody.data?.matchId;
    expect(matchSlug).toBeTruthy();

    const scorecardResponse = await page.goto(`/match/${matchSlug}`);
    expect(scorecardResponse?.status()).toBeLessThan(500);
    await expect(page.locator("body")).not.toContainText("Application error");

    const scoreResponse = await page.goto(`/match/${matchSlug}/score`);
    expect(scoreResponse?.status()).toBeLessThan(500);
    await expect(page.locator("body")).not.toContainText("Application error");
  });
});
