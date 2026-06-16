import { defineConfig, devices } from "@playwright/test";

const DEMO_PORT = Number(process.env.DEMO_E2E_PORT ?? 3005);
const DEMO_BASE_URL = `http://localhost:${DEMO_PORT}`;

/** Demo presentation e2e — requires Next.js dev server on /demo. */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "demo-presentation.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL: DEMO_BASE_URL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm exec next dev --port ${DEMO_PORT}`,
    url: DEMO_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_APP_URL: DEMO_BASE_URL,
      NODE_ENV: "development",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
