import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = Number(process.env.E2E_PORT ?? 3099);
const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
const E2E_DB_PATH = path.join(__dirname, ".e2e-db.db");
const E2E_COUPON_ADMIN_SECRET = "e2e-coupon-admin";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  timeout: 120_000,
  use: {
    baseURL: E2E_BASE_URL,
    trace: "on-first-retry",
  },
  globalSetup: "./e2e/global-setup.ts",
  webServer: {
    command: `pnpm exec next dev --port ${E2E_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      DATABASE_URL: `file:${E2E_DB_PATH}`,
      NEXT_PUBLIC_APP_URL: E2E_BASE_URL,
      COUPON_ADMIN_SECRET: E2E_COUPON_ADMIN_SECRET,
      NODE_ENV: "development",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
