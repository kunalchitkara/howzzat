/**
 * One-off coach E2E QA walkthrough — screenshots to docs/qa-screenshots/coach-YYYY-MM-DD/
 * Run from apps/web: node scripts/coach-e2e-qa.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3005";
const DATE = "2026-06-19";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, `../../../docs/qa-screenshots/coach-${DATE}`);
const EMAIL = `coach-e2e-${DATE.replace(/-/g, "")}@local.club`;
const PASS = "CoachE2e2026!";
const NAME = "Coach E2E";
const ORG_NAME = `Coach FC ${DATE}`;
const TOURNAMENT_NAME = `Coach U9 ${DATE}`;

fs.mkdirSync(OUT, { recursive: true });

const meta = { email: EMAIL, screenshots: [], notes: [] };
let step = 0;

async function shot(page, name) {
  step += 1;
  const file = `${String(step).padStart(2, "0")}-${name}.png`;
  const full = path.join(OUT, file);
  await page.screenshot({ path: full, fullPage: true });
  meta.screenshots.push(file);
  console.log("saved", full);
}

async function rulesTemplateLabels(page) {
  return page.locator('select option').allTextContents();
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await shot(page, "homepage-unauthenticated");

  await page.goto(`${BASE}/login?redirect=/dashboard`, { waitUntil: "domcontentloaded" });
  await shot(page, "login-email-code-default");

  await page.getByRole("button", { name: "Password", exact: true }).click();
  await page.getByRole("button", { name: "Need an account? Create one" }).click();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Name (optional)").fill(NAME);
  await page.getByLabel("Password", { exact: true }).fill(PASS);
  await shot(page, "signup-password-form");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  await shot(page, "dashboard-post-signup");

  await page.getByRole("link", { name: /Create your first club|New club/i }).first().click();
  await page.waitForURL(/organizations\/new/);
  await shot(page, "create-organization-form");
  await page.getByLabel("Club name").fill(ORG_NAME);
  await page.getByRole("button", { name: "Create organization" }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20000 });
  await shot(page, "dashboard-after-org-created");

  await page.getByRole("link", { name: new RegExp(ORG_NAME) }).click();
  await page.waitForURL(/organizations\/[^/]+$/);
  await shot(page, "organization-hub");

  await page.getByRole("link", { name: "Tournaments" }).click();
  await page.waitForURL(/\/tournaments$/);
  await shot(page, "tournaments-empty-state");

  await page.getByRole("link", { name: /New tournament/i }).click();
  await page.waitForURL(/tournaments\/new/);
  const templates = await rulesTemplateLabels(page);
  meta.notes.push({ rulesTemplates: templates });
  const hasDemo = templates.some((t) => /demo/i.test(t));
  meta.notes.push({ demoTemplatesVisible: hasDemo });
  await shot(page, "create-tournament-form");

  await page.getByLabel("Tournament name").fill(TOURNAMENT_NAME);
  const selectedTemplate = await page.locator('select').first().inputValue();
  meta.notes.push({ defaultRulesTemplateValue: selectedTemplate });
  await page.getByRole("button", { name: "Create tournament" }).click();
  await page.waitForURL(/\/tournaments$/, { timeout: 20000 });
  await shot(page, "tournaments-list-after-create");

  await page.getByRole("link", { name: TOURNAMENT_NAME }).click();
  await page.waitForURL(/tournaments\/[^/]+$/);
  await shot(page, "tournament-dashboard-empty-fixtures");

  const homeTeam = "Coach Lions U9";
  const awayTeam = "Rival Tigers U9";
  await page.getByLabel("Home team").fill(homeTeam);
  await page.getByLabel("Away team").fill(awayTeam);
  await page.getByLabel("Venue").fill("Main Ground");
  await page.getByLabel("Match date").fill("2026-06-28");
  await shot(page, "schedule-match-filled");

  const t0 = Date.now();
  await page.getByRole("button", { name: "Schedule match" }).click();
  await page.waitForLoadState("networkidle");
  meta.notes.push({ scheduleMatchMs: Date.now() - t0 });

  await page.getByText(`${homeTeam} vs ${awayTeam}`).waitFor({ timeout: 15000 });
  await shot(page, "fixtures-with-match");

  const scoreLink = page.getByRole("link", { name: "Score", exact: true }).first();
  const href = await scoreLink.getAttribute("href");
  meta.notes.push({ matchScoreHref: href });
  const slugReadable = href ? !href.includes("undefined") && href.startsWith("/match/") : false;
  meta.notes.push({ slugUrlReadable: slugReadable });

  if (href) {
    await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
    await shot(page, "match-score-pad-pre-start");
  }

  meta.ok = true;
  console.log(JSON.stringify(meta, null, 2));
} catch (err) {
  await shot(page, "error-state").catch(() => {});
  meta.ok = false;
  meta.error = String(err);
  console.error(err);
  console.log(JSON.stringify(meta, null, 2));
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(OUT, "run-meta.json"), JSON.stringify(meta, null, 2));
  await browser.close();
}
