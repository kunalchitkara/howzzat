/**
 * Manager/scoring E2E QA — screenshots to docs/qa-screenshots/YYYY-MM-DD/
 * Run from repo root: node apps/web/scripts/scoring-e2e-qa.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3005";
const DATE = "2026-06-19";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, `../../../docs/qa-screenshots/${DATE}`);
const STAMP = Date.now();
const EMAIL = `scoring-e2e-${STAMP}@local.club`;
const PASS = "ScoringE2e2026!";
const CLUB = `Scoring FC ${DATE}`;
const TOURNAMENT = `Scoring U9 ${DATE}`;

fs.mkdirSync(OUT, { recursive: true });

async function waitForDashboard(page, timeout = 20000) {
  await page.waitForURL(
    (url) => {
      const p = new URL(url).pathname;
      return p === "/dashboard" || p.startsWith("/dashboard/");
    },
    { timeout },
  );
}

const meta = { email: EMAIL, screenshots: [], notes: [] };

async function shot(page, file, name = file) {
  const full = path.join(OUT, file);
  await page.screenshot({ path: full, fullPage: false });
  meta.screenshots.push(file);
  console.log("saved", full, name);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
let orgIdFromApi = null;
page.on("response", async (res) => {
  if (
    res.url().includes("/api/v1/organizations") &&
    res.request().method() === "POST" &&
    res.ok()
  ) {
    const json = await res.json().catch(() => null);
    if (json?.id) orgIdFromApi = json.id;
  }
});

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await shot(page, "01-homepage.png", "homepage logged-in after fix");

  await page.goto(`${BASE}/login?redirect=/dashboard`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASS);
  await page.getByRole("button", { name: "Need an account? Create one" }).click();
  await page.getByLabel("Name (optional)").fill("Scoring E2E");
  await page.getByRole("button", { name: "Create account" }).click();
  await waitForDashboard(page);
  await page.waitForLoadState("networkidle");

  await page.goto(BASE, { waitUntil: "networkidle" });
  await shot(page, "01-homepage.png", "homepage with session");

  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await shot(page, "02-dashboard-logged-in.png");

  await page.goto(`${BASE}/dashboard/organizations/new`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Club name").fill(CLUB);
  await page.getByRole("button", { name: "Create organization" }).click();
  await page.waitForURL(/\/dashboard(\/organizations\/[^/]+)?$/, { timeout: 20000 });
  if (!orgIdFromApi) {
    await page.getByRole("link", { name: new RegExp(CLUB) }).waitFor({ timeout: 10000 });
    orgIdFromApi = (
      await page.getByRole("link", { name: new RegExp(CLUB) }).getAttribute("href")
    )?.split("/").pop();
  }
  if (!orgIdFromApi) throw new Error("Could not resolve organization id after create");
  const orgBase = `${BASE}/dashboard/organizations/${orgIdFromApi}`;

  await page.goto(orgBase, { waitUntil: "domcontentloaded" });
  await shot(page, "03-org-page.png");

  await page.goto(`${orgBase}/tournaments/new`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Tournament name").fill(TOURNAMENT);
  await page.getByRole("button", { name: "Create tournament" }).click();
  await page.waitForURL(/\/tournaments(\/?$|\/)/);
  await page.getByRole("link", { name: TOURNAMENT }).click();
  await shot(page, "04-tournament-page.png");

  await page.getByLabel("Home team").fill("Scoring Lions U9");
  await page.getByLabel("Away team").fill("Rival Cubs U9");
  await page.getByLabel("Match date").fill("2026-06-28");
  await page.getByRole("button", { name: "Schedule match" }).click();
  await page.getByText("Scoring Lions U9 vs Rival Cubs U9").waitFor({ timeout: 15000 });
  await shot(page, "05-schedule-form-with-fixture.png");

  const scoreHref = await page
    .getByRole("link", { name: "Score", exact: true })
    .first()
    .getAttribute("href");
  const scorecardHref = await page
    .getByRole("link", { name: "Scorecard", exact: true })
    .first()
    .getAttribute("href");
  meta.notes.push({ scoreHref, scorecardHref });

  if (scorecardHref) {
    await page.goto(`${BASE}${scorecardHref}`, { waitUntil: "networkidle" });
    const commentaryTab = page.getByRole("button", { name: "Commentary" });
    if (await commentaryTab.isVisible().catch(() => false)) {
      await commentaryTab.click();
    }
    await shot(page, "06-match-scorecard.png");
  }

  if (scoreHref) {
    await page.goto(`${BASE}${scoreHref}`, { waitUntil: "networkidle" });
    await page.getByText("Record the toss").waitFor({ timeout: 20000 });
    await shot(page, "07-match-score-toss-fixed.png");
  }

  await page.goto(`${BASE}/demo`, { waitUntil: "domcontentloaded" });
  await shot(page, "13-demo-page.png");

  meta.ok = true;
  console.log(JSON.stringify(meta, null, 2));
} catch (err) {
  await shot(page, "error-state.png").catch(() => {});
  meta.ok = false;
  meta.error = String(err);
  console.error(err);
  console.log(JSON.stringify(meta, null, 2));
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(OUT, "run-meta.json"), JSON.stringify(meta, null, 2));
  await browser.close();
}
