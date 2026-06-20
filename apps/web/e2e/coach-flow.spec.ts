import { test, expect } from "@playwright/test";
import { registerWithPassword, uniqueEmail } from "./helpers/auth";

test.describe("coach flow — signup to scheduled match", () => {
  test("password signup → org → tournament → schedule match", async ({ page }) => {
    const email = uniqueEmail("coach");
    const clubName = `Coach Club ${Date.now()}`;
    const tournamentName = `Coach Cup ${Date.now()}`;
    const homeTeam = "Coach Lions U9";
    const awayTeam = "Rival Tigers U9";

    await registerWithPassword(page, { email, name: "Coach E2E" });

    await page.getByRole("link", { name: "+ New club" }).click();
    await page.getByLabel("Club name").fill(clubName);
    await page.getByRole("button", { name: "Create organization" }).click();
    await expect(page.getByRole("heading", { name: clubName })).toBeVisible();

    await page.getByRole("link", { name: "Tournaments" }).click();
    await page.getByRole("link", { name: "+ New tournament" }).click();
    await page.getByLabel("Tournament name").fill(tournamentName);
    await page.getByRole("button", { name: "Create tournament" }).click();
    await expect(page.getByRole("link", { name: tournamentName })).toBeVisible();
    await page.getByRole("link", { name: tournamentName }).click();

    await page.getByLabel("Home team").fill(homeTeam);
    await page.getByLabel("Away team").fill(awayTeam);
    await page.getByLabel("Venue").fill("Main Ground");
    await page.getByLabel("Match date").fill("2026-06-28");
    await page.getByRole("button", { name: "Schedule match" }).click();

    await expect(page.getByText(`${homeTeam} vs ${awayTeam}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Main Ground")).toBeVisible();

    const scoreLink = page.getByRole("link", { name: "Score", exact: true }).first();
    await expect(scoreLink).toBeVisible();
    const href = await scoreLink.getAttribute("href");
    expect(href).toMatch(/^\/match\//);
    expect(href).not.toContain("undefined");
  });
});
