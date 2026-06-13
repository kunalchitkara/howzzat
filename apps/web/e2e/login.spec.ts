import { test, expect } from "@playwright/test";
import { registerWithPassword, uniqueEmail } from "./helpers/auth";

test.describe("login smoke", () => {
  test("password register reaches dashboard", async ({ page }) => {
    const email = uniqueEmail("login");
    await registerWithPassword(page, { email, name: "E2E Login User" });

    await expect(page.getByRole("heading", { name: "Your clubs" })).toBeVisible();
    await expect(page.getByRole("link", { name: "+ New club" })).toBeVisible();
    await expect(page.getByText("E2E Login User")).toBeVisible();
  });
});
