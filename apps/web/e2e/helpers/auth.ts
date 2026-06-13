import type { Page } from "@playwright/test";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.howzzat.test`;
}

/** Register via Password tab and land on dashboard (or redirect target). */
export async function registerWithPassword(
  page: Page,
  {
    email,
    password = "e2epass123",
    name,
    redirectTo = "/dashboard",
  }: {
    email: string;
    password?: string;
    name?: string;
    redirectTo?: string;
  },
) {
  await page.goto(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  await page.getByRole("button", { name: "Password" }).click();
  await page.getByRole("button", { name: "Need an account? Create one" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  if (name) {
    await page.getByLabel("Name (optional)").fill(name);
  }
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(`**${redirectTo}**`);
}

export async function signInWithPassword(
  page: Page,
  {
    email,
    password = "e2epass123",
    redirectTo = "/dashboard",
  }: {
    email: string;
    password?: string;
    redirectTo?: string;
  },
) {
  await page.goto(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  await page.getByRole("button", { name: "Password" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`**${redirectTo}**`);
}
