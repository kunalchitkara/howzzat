#!/usr/bin/env node
/**
 * Generates self-contained E2E QA HTML reports with base64-embedded screenshots.
 * Run: node docs/reports/generate-qa-reports.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

function embedImage(relativePath) {
  const full = join(ROOT, relativePath);
  const buf = readFileSync(full);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function severityClass(sev) {
  const s = sev.toLowerCase();
  if (s.includes("critical")) return "sev-critical";
  if (s.includes("high")) return "sev-high";
  if (s.includes("medium")) return "sev-medium";
  if (s.includes("low")) return "sev-low";
  return "sev-info";
}

function statusClass(status) {
  const s = status.toLowerCase();
  if (s.includes("fixed")) return "status-fixed";
  if (s.includes("open")) return "status-open";
  return "status-na";
}

function metaTable(rows) {
  return `<table class="meta-table"><tbody>${rows
    .map(
      ([k, v]) =>
        `<tr><th>${esc(k)}</th><td>${v.includes("<") ? v : esc(v)}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}

function bugTable(bugs) {
  return `<div class="table-wrap"><table class="bug-table">
    <thead><tr>
      <th>ID</th><th>Severity</th><th>Screen</th><th>Description</th>
      <th>Steps to reproduce</th><th>Suggested fix</th><th>Status</th>
    </tr></thead>
    <tbody>${bugs
      .map(
        (b) => `<tr>
      <td><code>${esc(b.id)}</code></td>
      <td><span class="badge ${severityClass(b.severity)}">${esc(b.severity)}</span></td>
      <td>${esc(b.screen)}</td>
      <td>${esc(b.description)}</td>
      <td>${esc(b.repro)}</td>
      <td>${esc(b.fix)}</td>
      <td><span class="badge ${statusClass(b.status)}">${esc(b.status)}</span></td>
    </tr>`,
      )
      .join("")}</tbody></table></div>`;
}

function dataTable(headers, rows) {
  return `<div class="table-wrap"><table class="data-table">
    <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows
      .map(
        (r) =>
          `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`,
      )
      .join("")}</tbody></table></div>`;
}

function screenshot(imgSrc, caption) {
  if (!imgSrc) return `<p class="screenshot-missing"><em>Screenshot not captured — ${esc(caption)}</em></p>`;
  return `<figure class="screenshot">
    <img src="${imgSrc}" alt="${esc(caption)}" loading="lazy" />
    <figcaption>${esc(caption)}</figcaption>
  </figure>`;
}

function stepSection(step, imgSrc, extraImages = []) {
  const bullets = step.bullets
    ? `<ul>${step.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`
    : "";
  const extra = step.extra || "";
  const also = extraImages
    .map(([src, cap]) => screenshot(src, cap))
    .join("");
  return `<section class="walkthrough-step" id="step-${step.num}">
    <h3>${step.num}. ${esc(step.title)}</h3>
    ${step.url ? `<p class="step-url"><strong>URL:</strong> <code>${esc(step.url)}</code></p>` : ""}
    ${step.screenshotFile ? `<p class="step-screenshot-ref"><strong>Screenshot:</strong> <code>${esc(step.screenshotFile)}</code></p>` : ""}
    ${extra}
    ${bullets}
    ${screenshot(imgSrc, step.caption || step.title)}
    ${also}
  </section>`;
}

const CSS = `
:root {
  --navy: #0a1628;
  --navy-light: #132035;
  --blue: #3b82f6;
  --blue-light: #60a5fa;
  --text: #1e293b;
  --text-muted: #64748b;
  --border: #e2e8f0;
  --bg: #f8fafc;
  --white: #ffffff;
  --critical: #dc2626;
  --high: #ea580c;
  --medium: #d97706;
  --low: #65a30d;
  --info: #64748b;
  --fixed: #059669;
  --open: #6366f1;
}
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: var(--text);
  background: var(--bg);
}
header.report-header {
  background: linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%);
  color: var(--white);
  padding: 2.5rem 1.5rem 2rem;
  border-bottom: 4px solid var(--blue);
}
header.report-header .brand {
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--blue-light);
  margin-bottom: 0.5rem;
}
header.report-header h1 {
  margin: 0 0 0.75rem;
  font-size: clamp(1.5rem, 4vw, 2.25rem);
  font-weight: 700;
  line-height: 1.2;
}
header.report-header .subtitle {
  margin: 0;
  font-size: 1.05rem;
  opacity: 0.9;
  max-width: 48rem;
}
main {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}
section.content-block {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.75rem;
  margin-bottom: 1.75rem;
  box-shadow: 0 1px 3px rgba(10, 22, 40, 0.06);
}
section.content-block h2 {
  margin: 0 0 1.25rem;
  font-size: 1.35rem;
  color: var(--navy);
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--blue);
}
section.content-block h3 {
  margin: 1.5rem 0 0.75rem;
  font-size: 1.1rem;
  color: var(--navy);
}
section.content-block h3:first-child { margin-top: 0; }
p { margin: 0 0 1rem; }
ul, ol { margin: 0 0 1rem; padding-left: 1.5rem; }
li { margin-bottom: 0.35rem; }
code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.875em;
  background: #f1f5f9;
  padding: 0.15em 0.4em;
  border-radius: 4px;
  word-break: break-all;
}
.meta-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}
.meta-table th {
  text-align: left;
  padding: 0.5rem 1rem 0.5rem 0;
  color: var(--text-muted);
  font-weight: 600;
  width: 11rem;
  vertical-align: top;
}
.meta-table td { padding: 0.5rem 0; }
.summary-highlights {
  display: grid;
  gap: 0.75rem;
  margin: 1rem 0;
}
.summary-highlights .highlight {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: #eff6ff;
  border-left: 4px solid var(--blue);
  font-size: 0.95rem;
}
.summary-highlights .highlight.fixed {
  background: #ecfdf5;
  border-left-color: var(--fixed);
}
.table-wrap { overflow-x: auto; margin: 1rem 0; -webkit-overflow-scrolling: touch; }
table.bug-table, table.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
table.bug-table th, table.data-table th {
  background: var(--navy);
  color: var(--white);
  padding: 0.65rem 0.75rem;
  text-align: left;
  font-weight: 600;
  white-space: nowrap;
}
table.bug-table td, table.data-table td {
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
table.bug-table tbody tr:nth-child(even),
table.data-table tbody tr:nth-child(even) { background: #f8fafc; }
.badge {
  display: inline-block;
  padding: 0.2em 0.55em;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}
.sev-critical { background: #fee2e2; color: var(--critical); }
.sev-high { background: #ffedd5; color: var(--high); }
.sev-medium { background: #fef3c7; color: var(--medium); }
.sev-low { background: #ecfccb; color: var(--low); }
.sev-info { background: #f1f5f9; color: var(--info); }
.status-fixed { background: #d1fae5; color: var(--fixed); }
.status-open { background: #e0e7ff; color: var(--open); }
.status-na { background: #f1f5f9; color: var(--info); }
.walkthrough-step {
  margin-bottom: 2.5rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--border);
}
.walkthrough-step:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.step-url, .step-screenshot-ref { font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem; }
figure.screenshot {
  margin: 1.25rem 0 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: #f1f5f9;
}
figure.screenshot img {
  display: block;
  width: 100%;
  height: auto;
}
figure.screenshot figcaption {
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
  color: var(--text-muted);
  background: var(--white);
  border-top: 1px solid var(--border);
}
.screenshot-missing {
  padding: 1rem;
  background: #fef3c7;
  border-radius: 8px;
  font-size: 0.9rem;
}
.callout {
  padding: 1rem 1.25rem;
  border-radius: 8px;
  margin: 1rem 0;
  font-size: 0.95rem;
}
.callout-info { background: #eff6ff; border-left: 4px solid var(--blue); }
.callout-warn { background: #fef3c7; border-left: 4px solid var(--medium); }
.callout-success { background: #ecfdf5; border-left: 4px solid var(--fixed); }
.auth-table { font-size: 0.875rem; }
pre.code-block {
  background: var(--navy);
  color: #e2e8f0;
  padding: 1rem 1.25rem;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.85rem;
  line-height: 1.5;
  margin: 1rem 0;
}
pre.code-block code { background: none; padding: 0; color: inherit; word-break: normal; }
.fix-list { list-style: none; padding-left: 0; }
.fix-list li {
  padding: 0.5rem 0 0.5rem 1.75rem;
  position: relative;
}
.fix-list li::before {
  content: "✓";
  position: absolute;
  left: 0;
  color: var(--fixed);
  font-weight: bold;
}
footer.report-footer {
  text-align: center;
  padding: 2rem 1.5rem;
  color: var(--text-muted);
  font-size: 0.85rem;
  border-top: 1px solid var(--border);
}
nav.toc ol { padding-left: 1.25rem; }
nav.toc a { color: var(--blue); text-decoration: none; }
nav.toc a:hover { text-decoration: underline; }
.comparison-table td:first-child { font-weight: 600; }
.comparison-pass { color: var(--fixed); font-weight: 600; }
@media (max-width: 640px) {
  main { padding: 1.25rem 1rem 3rem; }
  section.content-block { padding: 1.25rem; }
}
@media print {
  body { background: white; font-size: 11pt; }
  header.report-header {
    background: var(--navy) !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    padding: 1.5rem;
  }
  main { max-width: 100%; padding: 0; }
  section.content-block {
    box-shadow: none;
    border: none;
    border-radius: 0;
    page-break-inside: avoid;
    margin-bottom: 1rem;
    padding: 0 0 1rem;
    border-bottom: 1px solid #ccc;
  }
  .walkthrough-step { page-break-inside: avoid; }
  figure.screenshot { page-break-inside: avoid; max-height: 85vh; }
  figure.screenshot img { max-height: 75vh; object-fit: contain; }
  .table-wrap { overflow: visible; }
  table.bug-table { font-size: 8pt; }
  table.bug-table th { background: var(--navy) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  a { color: inherit; text-decoration: none; }
  nav.toc { display: none; }
}
`;

function buildReport({ title, subtitle, meta, summaryHtml, bodySections, footerNote }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)} — Howzzat QA</title>
  <style>${CSS}</style>
</head>
<body>
  <header class="report-header">
    <div class="brand">Howzzat</div>
    <h1>${esc(title)}</h1>
    <p class="subtitle">${subtitle}</p>
  </header>
  <main>
    <section class="content-block">
      <h2>Report metadata</h2>
      ${metaTable(meta)}
    </section>
    ${summaryHtml}
    ${bodySections}
  </main>
  <footer class="report-footer">
    ${footerNote}<br />
    Generated ${new Date().toISOString().slice(0, 10)} · Self-contained HTML with embedded screenshots
  </footer>
</body>
</html>`;
}

// ─── Scoring report ─────────────────────────────────────────────────────────

const scoringDir = "docs/qa-screenshots/2026-06-19";
const scoringImages = {};
let scoringImageCount = 0;
for (const f of [
  "01-homepage.png", "02-dashboard-logged-in.png", "03-org-page.png",
  "04-tournament-page.png", "05-schedule-form-with-fixture.png",
  "06-match-scorecard.png", "07-match-score-toss-fixed.png",
  "09-scoring-step.png", "13-demo-page.png",
]) {
  scoringImages[f] = embedImage(join(scoringDir, f).replace(/\\/g, "/"));
  scoringImageCount++;
}

const scoringSteps = [
  { num: 1, title: "Homepage (logged-out UI)", url: "/", screenshotFile: "01-homepage.png", caption: "Homepage — logged-out hero",
    bullets: ["Hero shows <strong>Sign in</strong> and <strong>Club dashboard</strong> buttons.", "Rules profiles list renders correctly.", "Next.js dev overlay showed <strong>“1 Issue”</strong> badge (dev-only)."],
    extra: `<div class="callout callout-info"><strong>Note:</strong> Even with an active session cookie, the homepage still renders the logged-out hero (Sign in visible). Dashboard correctly shows the user as logged in — see step 2.</div>` },
  { num: 2, title: "Login / session state", url: "/login → redirected to /dashboard (existing session)", screenshotFile: "02-dashboard-logged-in.png", caption: "Dashboard with active session",
    bullets: ["Browser already had a valid session for <strong>Kunal Chitkara</strong>.", "Dashboard header: Account + Sign out.", "ECC club listed as <strong>OWNER</strong> (2 teams → 4 teams after test data).", "No dev bypass needed; session cookie <code>howzzat_session</code> was present."] },
  { num: 3, title: "Dashboard → organization", url: "/dashboard/organizations/cmqakxdv30002hkwtxa83pdos", screenshotFile: "03-org-page.png", caption: "ECC organization page",
    bullets: ["ECC org page: Teams, Tournaments, View public tournament links.", "<strong>Bug:</strong> <code>/dashboard/organizations/ecc</code> (slug) returns <strong>404</strong> — only internal id works."] },
  { num: 4, title: "Tournament page (fixtures + schedule form)", url: "/dashboard/organizations/cmqakxdv30002hkwtxa83pdos/tournaments/cmqakyxrw000ehkwt2n174i4r", screenshotFile: "04-tournament-page.png", caption: "Tournament page (initial)",
    bullets: ["Tournament <strong>Test ECC U9</strong>, MJCA U9 Outdoor rules, wallet <strong>£25.00</strong>.", "<strong>Schedule match</strong> form includes <strong>Match date</strong> field (defaults to today)."],
    extra: `<p>After creating U9 ECC vs Test Hayes U9 fixture:</p><ul><li>Fixture list shows <strong>LIVE</strong> match with Scorecard + Score links.</li><li><strong>Teams in tournament (3)</strong> but <strong>Test Hayes U9 appears twice</strong> (duplicate team entries).</li><li>Schedule form pre-selects <strong>Test Hayes U9</strong> for both Home and Away (confusing).</li></ul>`,
    alsoShow: ["05-schedule-form-with-fixture.png"] },
  { num: 5, title: "Match scorecard (public)", url: "/match/u9-ecc-test-hayes-20260619", screenshotFile: "06-match-scorecard.png", caption: "Public live scorecard",
    bullets: ["Live scorecard banner, Summary/Commentary tabs.", "Pairs scoring: <strong>200/0</strong> base score displayed.", "<strong>Open scorer →</strong> link present."] },
  { num: 6, title: "Match score page — sign-in banner investigation", url: "/match/u9-ecc-test-hayes-20260619/score", screenshotFile: "07-match-score-toss-fixed.png", caption: "Scorer toss step (post auth fix)",
    extra: `<p><strong>Before fix (reproduced via API + code):</strong></p><ul><li>Yellow <strong>“Sign in to score”</strong> banner shown despite logged-in ECC owner.</li><li>Toss UI hidden (<code>canScore: false</code>) because <code>requiresAuth: true</code>.</li><li>Auto <strong>scoring/claim</strong> POST returned <strong>500 Internal server error</strong>.</li></ul><p><strong>After fix:</strong></p><ul><li>No sign-in banner for logged-in club owner.</li><li>Toss step visible; toss saved successfully.</li><li>Claim endpoint succeeds.</li></ul>` },
  { num: 7, title: "Toss step", screenshotFile: "07-match-score-toss-fixed.png", caption: "Toss step — U9 ECC won toss, elected Bat",
    bullets: ["Selected <strong>U9 ECC</strong> won toss, elected <strong>Bat</strong>.", "<strong>Save toss &amp; pick lineups</strong> advanced to lineups.", "Toss summary line: “U9 ECC won the toss · elected to bat”.", "<strong>Pre-fix:</strong> toss POST also 500'd (same slug/id bug as claim)."] },
  { num: 8, title: "Lineups step", caption: "Lineups step (see scoring step for post-confirm state)",
    bullets: ["Roster shows 3 U9 ECC players (Veer, Taran, Avyaan).", "Quick-add text fields for both sides.", "Rules require <strong>6–10 players per side</strong> — confirm button stays disabled until minimum met.", "Opponent side has no roster until quick-add."],
    extra: `<p class="screenshot-missing"><em>Screenshot captured in flow; see step 9 for post-confirm state.</em></p>` },
  { num: 9, title: "Scoring step", url: "/match/u9-ecc-test-hayes-20260619/score (after squads confirmed)", screenshotFile: "09-scoring-step.png", caption: "Live scoring pad",
    bullets: ["Step 3 <strong>Score</strong> active.", "Innings 1: <strong>200-0</strong>, 0.0/16 ov (pairs base 200).", "Batsman/bowler pickers, run pad (0–6), extras, wicket.", "Bowler must be picked before first ball (expected)."] },
  { num: 10, title: "Finalize / result", caption: "Not completed end-to-end",
    bullets: ["Not completed end-to-end (would require full innings + wallet charge).", "Public scorecard and tournament hub show LIVE state."],
    extra: `<p class="screenshot-missing"><em>End-to-end finalize not completed during QA walkthrough.</em></p>` },
  { num: 11, title: "Public tournament insights hub", url: "/orgs/ecc/tournaments/test-ecc-u9", caption: "Public tournament hub (capture timed out)",
    bullets: ["Overview, Fixtures, Leaders, Players tabs.", "<strong>Live now</strong> card for U9 ECC vs Test Hayes U9.", "Standings / season insights sections render.", "<strong>Bug:</strong> <code>/t/test-ecc-u9</code> returns 404 — public URL pattern is <code>/orgs/{orgSlug}/tournaments/{tournamentSlug}</code>."],
    extra: `<p class="screenshot-missing"><em>Screenshot capture timed out; page verified via browser snapshot.</em></p>` },
  { num: 12, title: "Demo page", url: "/demo", screenshotFile: "13-demo-page.png", caption: "Demo presentation page",
    bullets: ["Presentation-style demo (slide 1/20).", "Keyboard navigation hints."] },
];

const scoringBugs = [
  { id: "B1", severity: "Critical", screen: "Match score /score", description: "“Sign in to score” shown for logged-in club owner", repro: "Sign in as ECC owner → open non-demo match score URL", fix: "Use needsSignIn for banner; keep requiresAuth for API semantics", status: "Fixed" },
  { id: "B2", severity: "Critical", screen: "Match score /score", description: "Claim/toss/mutations 500 when URL uses slug", repro: "Open /match/u9-ecc-…/score → page loads → claim or save toss", fix: "Use match.id from getMatch() for all Prisma writes", status: "Fixed" },
  { id: "B3", severity: "Medium", screen: "Homepage /", description: "Shows “Sign in” while session active", repro: "Log in → visit /", fix: "Server-render auth state in homepage hero (read session cookie)", status: "Fixed" },
  { id: "B4", severity: "Medium", screen: "Org dashboard", description: "/dashboard/organizations/ecc → 404", repro: "Navigate by org slug instead of id", fix: "Support slug in route or redirect", status: "Fixed" },
  { id: "B5", severity: "Medium", screen: "Tournament page", description: "Duplicate Test Hayes U9 in teams list", repro: "Add opponent via quick-add twice / UI + API race", fix: "Dedupe tournament teams by name; idempotent add", status: "Fixed" },
  { id: "B6", severity: "Low", screen: "Tournament schedule form", description: "Home & Away both default to same opponent team", repro: "Open schedule form after adding Hayes", fix: "Reset away dropdown when home changes", status: "Fixed" },
  { id: "B7", severity: "Low", screen: "Tournament page", description: "Next.js dev “N Issues” overlay", repro: "Run dev server, visit tournament page", fix: "Investigate console/hydration warnings", status: "Open (dev-only)" },
  { id: "B8", severity: "Low", screen: "Lineups", description: "Confirm disabled — roster below old 6+ minimum", repro: "Open lineups for U9 with small roster", fix: "Clearer lineup blockers; U9 min 4 in MJCA profile", status: "Fixed" },
  { id: "B9", severity: "Low", screen: "Public URLs", description: "/t/{slug} 404", repro: "Visit /t/test-ecc-u9", fix: "Redirect to /orgs/{org}/tournaments/{slug}", status: "Fixed" },
  { id: "B10", severity: "Low", screen: "Dashboard club link", description: "Click on list item intercepted", repro: "Click ECC card body on dashboard", fix: "Make entire card clickable or fix z-index", status: "Open" },
  { id: "B11", severity: "Info", screen: "Screenshot tooling", description: "Full-page screenshots intermittently timeout", repro: "browser_take_screenshot with fullPage: true", fix: "Retry without fullPage (workaround used)", status: "N/A" },
];

const scoringWalkthrough = `<section class="content-block">
  <h2>Walkthrough</h2>
  ${scoringSteps.map((s) => {
    const skipMain = s.num === 7;
    const main = !skipMain && s.screenshotFile ? scoringImages[s.screenshotFile] : null;
    const also = (s.alsoShow || []).map((f) => [scoringImages[f], f.replace(/^\d+-/, "").replace(/-/g, " ")]);
    return stepSection(s, main, also);
  }).join("")}
</section>`;

const scoringAuth = `<section class="content-block">
  <h2>Auth bug analysis: sign-in banner</h2>
  <h3>Symptom</h3>
  <p>Logged-in club owner (ECC OWNER) sees yellow banner on <code>/match/{slug}/score</code>:</p>
  <div class="callout callout-warn"><strong>Sign in to score</strong> — Club managers must sign in before scoring.</div>
  <h3>Root cause</h3>
  <p><code>buildScoringLockInfo()</code> in <code>scoring-lock.ts</code> overloaded <code>requiresAuth</code>:</p>
  ${dataTable(
    ["User state", "Demo match", "Old requiresAuth", "Old canScore", "UI result"],
    [
      ["Not signed in", "No", "true", "false", "Sign-in banner ✓"],
      ["Signed in, club manager", "No", "true", "true", "Sign-in banner ✗"],
      ["Signed in, no role", "No", "true", "false", "Sign-in banner (misleading)"],
    ],
  )}
  <p><code>ScorePad.tsx</code> rendered the banner when <code>ctx.scoringLock.requiresAuth</code> was true. For authenticated managers on real (non-demo) matches, <code>requiresAuth</code> meant “this match type requires authentication in general”, <strong>not</strong> “you need to sign in now”. Demo matches (<code>u9-live</code>, <code>ios-live</code>) correctly set <code>requiresAuth: false</code>.</p>
  <h3>Fix applied</h3>
  <ul class="fix-list">
    <li>Added <strong>needsSignIn</strong> to <code>ScoringLockInfo</code> — <code>true</code> only when <code>user === null</code> on non-demo matches.</li>
    <li>Updated <code>ScorePad.tsx</code> (and mobile scorer) to show the banner on <strong>needsSignIn</strong>, not <code>requiresAuth</code>.</li>
    <li>Claim auto-POST guard uses <code>needsSignIn</code> instead of <code>requiresAuth</code>.</li>
  </ul>
  <h3>Secondary bug (also fixed)</h3>
  <p><code>claimMatchScoring()</code> and <code>recordToss()</code> (and other match mutations) called:</p>
  <pre class="code-block"><code>await prisma.match.update({ where: { id: matchId } })</code></pre>
  <p>where <code>matchId</code> was the <strong>URL slug</strong> (<code>u9-ecc-test-hayes-20260619</code>), not the cuid. <code>getMatch()</code> resolves slug → record, but updates used the raw param → <strong>P2025 record not found</strong> → 500 on claim and toss.</p>
  <div class="callout callout-success"><strong>Fix:</strong> normalize to <code>match.id</code> after <code>getMatch()</code> in <code>scoring-lock.ts</code> and <code>matches.ts</code> mutation helpers.</div>
  <h3>Files changed</h3>
  <ul>
    <li><code>apps/web/src/lib/services/scoring-lock.ts</code></li>
    <li><code>apps/web/src/lib/services/matches.ts</code></li>
    <li><code>apps/web/src/lib/scoring/types.ts</code></li>
    <li><code>apps/web/src/components/scoring/ScorePad.tsx</code></li>
    <li><code>apps/mobile/app/match/[id]/score.tsx</code></li>
    <li><code>apps/mobile/lib/api.ts</code></li>
    <li><code>apps/web/tests/unit/scoring-lock.test.ts</code></li>
  </ul>
</section>`;

const scoringHtml = buildReport({
  title: "E2E QA Walkthrough — Howzzat Web",
  subtitle: "Manager → tournament → score flow for Test ECC U9 vs Test Hayes U9",
  meta: [
    ["Date", "2026-06-19"],
    ["Environment", "<code>http://localhost:3005</code> (local dev, <code>pnpm dev:web</code>)"],
    ["Tester", "Automated browser walkthrough + code review"],
    ["User", "Kunal Chitkara (ECC club OWNER)"],
    ["Primary match", "U9 ECC vs Test Hayes U9 — slug <code>u9-ecc-test-hayes-20260619</code>"],
    ["Screenshots", `${scoringImageCount} embedded in this report`],
  ],
  summaryHtml: `<section class="content-block">
    <h2>Executive summary</h2>
    <p>Walked the manager → tournament → score flow for <strong>Test ECC U9 vs Test Hayes U9</strong>. Critical auth banner and slug mutation bugs are fixed. This re-run also verified homepage session, org slug routes, tournament dedupe/schedule defaults, public <code>/t/{token}</code> redirect, and U9 lineup minimum (4 players).</p>
    <div class="summary-highlights">
      <div class="highlight fixed"><strong>All critical/high bugs resolved</strong> — auth banner + slug mutations</div>
      <div class="highlight fixed"><strong>Medium bugs fixed:</strong> B3 homepage session, B4 org slug, B5 duplicate teams</div>
      <div class="highlight fixed"><strong>Also fixed:</strong> B6 schedule defaults, B8 lineup hints + U9 min 4, B9 public token redirect</div>
      <div class="highlight"><strong>Deferred (low/dev):</strong> B7 dev overlay, B10 dashboard card click</div>
      <div class="highlight"><strong>Screenshots captured:</strong> 8 embedded</div>
      <div class="highlight"><strong>Bugs logged:</strong> 11 — 8 fixed, 2 open (low/dev), 1 N/A</div>
    </div>
  </section>
  <nav class="content-block toc">
    <h2>Contents</h2>
    <ol>
      <li><a href="#step-1">Walkthrough (12 steps)</a></li>
      <li><a href="#auth">Auth bug analysis</a></li>
      <li>Bug list</li>
      <li>Test data &amp; verification</li>
    </ol>
  </nav>
  ${scoringWalkthrough.replace('id="step-6"', 'id="step-6"')}
  ${scoringAuth.replace("<h2>Auth", '<h2 id="auth">Auth')}
  <section class="content-block">
    <h2>Bug list</h2>
    ${bugTable(scoringBugs)}
  </section>
  <section class="content-block">
    <h2>Test data created</h2>
    ${dataTable(["Entity", "Id / slug"], [
      ["Match", "cmql3gser0003rpn60zue2wu8 / u9-ecc-test-hayes-20260619"],
      ["Opponent team", "Test Hayes U9 (cmql3g2xq0001rphen950uevx)"],
      ["Tournament", "Test ECC U9 (cmqakyxrw000ehkwt2n174i4r)"],
    ])}
    <h3>Verification commands</h3>
    <pre class="code-block"><code># Unit tests for scoring lock
cd apps/web &amp;&amp; pnpm exec vitest run tests/unit/scoring-lock.test.ts

# Open scorer (logged in)
open http://localhost:3005/match/u9-ecc-test-hayes-20260619/score

# Public tournament hub
open http://localhost:3005/orgs/ecc/tournaments/test-ecc-u9</code></pre>
  </section>`,
  bodySections: "",
  footerNote: "Howzzat E2E Scoring QA Report · 2026-06-19",
});

writeFileSync(join(__dirname, "e2e-scoring-qa-report.html"), scoringHtml);
console.log(`Wrote e2e-scoring-qa-report.html (${scoringImageCount} images)`);

// ─── Coach report ───────────────────────────────────────────────────────────

const coachDir = "docs/qa-screenshots/coach-2026-06-19";
const coachImages = {};
let coachImageCount = 0;
for (const f of [
  "01-homepage-unauthenticated.png", "02-login-password-default.png",
  "03-signup-password-form.png", "04-dashboard-post-signup.png",
  "05-create-organization-form.png", "06-dashboard-after-org-created.png",
  "07-organization-hub.png", "08-tournaments-empty-state.png",
  "09-create-tournament-form.png", "10-tournaments-list-after-create.png",
  "11-tournament-dashboard-empty-fixtures.png", "12-schedule-match-filled.png",
  "13-fixtures-with-match.png", "14-match-score-pad-pre-start.png",
  "15-score-page-loaded.png",
]) {
  coachImages[f] = embedImage(join(coachDir, f).replace(/\\/g, "/"));
  coachImageCount++;
}

const coachSteps = [
  { num: 1, title: "Landing / homepage (unauthenticated)", url: "/", screenshotFile: "01-homepage-unauthenticated.png", caption: "Homepage — logged-out hero",
    bullets: ["Hero: <strong>Sign in</strong> + <strong>Club dashboard</strong> (dashboard link works only when already signed in).", "Marketing lists all built-in rules profiles, including <strong>Demo</strong> entries — fine for homepage, but coaches should not see demo templates in the tournament form (they do not; see step 6).", "Homepage always renders logged-out hero even if a session cookie exists (see bug C3)."] },
  { num: 2, title: "Sign up", url: "/login?redirect=/dashboard", caption: "Login and sign-up flow",
    extra: `<p><strong>Path used:</strong> <strong>Password</strong> tab (default when email OTP unavailable) → <strong>Need an account? Create one</strong> → email + name + password → <strong>Create account</strong>.</p>
    ${dataTable(["Method", "Result"], [
      ["Email code", "Fails without RESEND_API_KEY / EMAIL_FROM or DEV_EMAIL_BYPASS_*"],
      ["Password", "Works — lands on dashboard (default tab when OTP unavailable)"],
      ["Google", "Uses app origin default http://localhost:3005 when env unset"],
    ])}
    <p><strong>Dev bypass (optional):</strong> add to <code>apps/web/.env.local</code>:</p>
    <pre class="code-block"><code>DEV_EMAIL_BYPASS_EMAIL="dev@local.club"
DEV_EMAIL_BYPASS_CODE="123456"</code></pre>
    <div class="callout callout-success"><strong>Fix applied:</strong> login page defaults to <strong>Password</strong> tab when email OTP is not configured.</div>
    ${screenshot(coachImages["02-login-password-default.png"], "Login — Password tab (default when OTP unavailable)")}
    ${screenshot(coachImages["03-signup-password-form.png"], "Password registration form")}` },
  { num: 3, title: "Post-signup dashboard (empty state)", url: "/dashboard", screenshotFile: "04-dashboard-post-signup.png", caption: "Empty dashboard after sign-up",
    bullets: ["Clear empty state: “You are not part of any club yet…”", "CTAs: <strong>Create your first club</strong> and <strong>+ New club</strong>.", "Header shows coach name, Account, Sign out."] },
  { num: 4, title: "Create organization (club)", url: "/dashboard/organizations/new", caption: "Create club flow",
    bullets: ["Single field: <strong>Club name</strong> (<code>Coach FC 2026-06-19</code>).", "Submit <strong>Create organization</strong> → redirects to <code>/dashboard</code> (not the new org hub — extra click; see UX notes).", "Dashboard now lists the club: <strong>0 teams · 0 tournaments · OWNER</strong>."],
    extra: `${screenshot(coachImages["05-create-organization-form.png"], "New club form")}${screenshot(coachImages["06-dashboard-after-org-created.png"], "Dashboard with new club card")}` },
  { num: 5, title: "Organization hub", url: "/dashboard/organizations/{orgId}", screenshotFile: "07-organization-hub.png", caption: "Org hub — Teams / Tournaments tiles",
    bullets: ["Two tiles: <strong>Teams</strong> (0 squads), <strong>Tournaments</strong> (0 competitions).", "Straightforward next step: open <strong>Tournaments</strong>."] },
  { num: 6, title: "Create tournament", url: "/tournaments (empty) → /tournaments/new", caption: "Create tournament flow",
    bullets: ["Empty tournaments copy: “No tournaments yet.” + <strong>Create tournament</strong>.", "Form defaults: Age group <strong>U9</strong>, Season <strong>Summer 2026</strong>, Rules template <strong>MJCA U9 Outdoor (suggested)</strong> with pairs/200/−5 summary + MJCA rules link.", "Rules dropdown groups: U9, Boys &amp; senior, Girls, Other — <strong>no Demo templates</strong> (correct for coaches).", "Optional <strong>Customize rules</strong> checkbox (left unchecked).", "<strong>Create tournament</strong> → tournaments list; new row shows MJCA rules label."],
    extra: `${screenshot(coachImages["08-tournaments-empty-state.png"], "Tournaments list empty")}${screenshot(coachImages["09-create-tournament-form.png"], "New tournament (MJCA U9 default)")}${screenshot(coachImages["10-tournaments-list-after-create.png"], "Tournaments list with one row")}` },
  { num: 7, title: "Tournament dashboard (wallet, invites, fixtures)", url: "/dashboard/organizations/{orgId}/tournaments/{tournamentId}", screenshotFile: "11-tournament-dashboard-empty-fixtures.png", caption: "Tournament page before first fixture",
    extra: dataTable(["Section", "State", "Notes"], [
      ["Tournament wallet", "£0.00", "Copy explains per-player charge at finalize; Manage wallet link"],
      ["Fixtures (0)", "Empty + schedule form", "Team names only — no invite required"],
      ["Teams in tournament (0)", "Optional add-by-name", "Not required for scheduling"],
      ["Manager invites", "Empty form", "Optional; not on critical path"],
    ]) },
  { num: 8, title: "Schedule match", screenshotFile: "12-schedule-match-filled.png", caption: "Schedule match form filled",
    bullets: ["<strong>Home team:</strong> <code>Coach Lions U9</code> (free text)", "<strong>Away team:</strong> <code>Rival Tigers U9</code> (placeholder: “Opponent (name only is fine)”)", "<strong>Venue:</strong> <code>Main Ground</code>", "<strong>Match date:</strong> <code>2026-06-28</code> (date picker; defaults to today)", "<strong>Schedule match</strong> — ~27 ms API round-trip in test", "No org teams, roster, or manager invites were needed."] },
  { num: 9, title: "Match in fixtures + slug URL", screenshotFile: "13-fixtures-with-match.png", caption: "Fixture listed with Score links",
    bullets: ["Fixture list: <strong>Coach Lions U9 vs Rival Tigers U9</strong> — <code>SCHEDULED · 2026-06-28 · Main Ground</code>", "<strong>Scorecard</strong> + <strong>Score</strong> links use readable slug:", "<code>/match/u9-ext-coach-lions-u9-6e754604-ext-rival-tigers-u9-1375a5b9-20260628</code>", "<strong>Teams in tournament (2)</strong> auto-created from typed names."] },
  { num: 10, title: "Optional — wallet top-up / coupon", url: "/dashboard/organizations/{orgId}/tournaments/{tournamentId}/wallet", screenshotFile: "15-wallet-page.png", caption: "Tournament wallet + coupon",
    bullets: ["Balance <strong>£0.00</strong>; top-up buttons £10 / £20 / £50 (Stripe test mode hint).", "<strong>Redeem coupon</strong> form present.", "Wallet not required to <strong>schedule</strong> a match; billing applies at finalize."] },
  { num: 11, title: "Optional — scorer entry (post-schedule)", url: "/match/{slug}/score", caption: "Scorer entry after scheduling",
    bullets: ["Immediate navigation can flash <strong>“Loading scorer…”</strong> for several seconds; full UI loads with <strong>Record the toss</strong> step.", "Club owner sees toss UI (no erroneous “Sign in to score” banner — see manager walkthrough fix).", "Confirms product intent: <strong>overs/lineups at match start</strong>, not at schedule time."],
    extra: `${screenshot(coachImages["14-match-score-pad-pre-start.png"], "Scorer loading state (early)")}${screenshot(coachImages["15-score-page-loaded.png"], "Toss step — scorer ready")}` },
];

const coachBugs = [
  { id: "C1", severity: "High", screen: "/login", description: "Default Email code tab; Send code fails when Resend/bypass unset", repro: "Open login → Send code", fix: "Default to Password when OTP unavailable; document bypass in .env.local", status: "Fixed (default tab)" },
  { id: "C2", severity: "Medium", screen: "/login dev hint", description: "Google redirect URI shows localhost:3000 while dev uses 3005", repro: "Open login → read yellow dev box", fix: "Default app origin to localhost:3005 when env unset", status: "Fixed" },
  { id: "C3", severity: "Medium", screen: "/", description: "Homepage hero always shows Sign in even with active session", repro: "Sign in → visit /", fix: "SSR session check on homepage hero", status: "Fixed" },
  { id: "C4", severity: "Low", screen: "Create org", description: "After create, lands on dashboard root not org hub", repro: "Create club → observe redirect", fix: "Redirect to /dashboard/organizations/{id}", status: "Open" },
  { id: "C5", severity: "Low", screen: "Tournament dashboard", description: "Manager invites section prominent; coaches may think invites are required", repro: "Open new tournament page", fix: "Collapse invites behind “Advanced” or add “optional” label", status: "Open (deferred)" },
  { id: "C6", severity: "Low", screen: "Homepage", description: "Demo rules profiles listed in public marketing", repro: "Visit /", fix: "Separate “Try demos” from coach-facing copy", status: "Open (deferred)" },
  { id: "C7", severity: "Low", screen: "Scorer /score", description: "Loading scorer… persists several seconds on first paint", repro: "Click Score immediately after schedule", fix: "Skeleton with step hint; prefetch match context", status: "Open (deferred)" },
  { id: "C8", severity: "Info", screen: "Dev tooling", description: "Next.js “1 Issue” badge on several pages", repro: "Any dashboard page in dev", fix: "Inspect hydration/console warnings", status: "Open (dev-only)" },
];

const coachHtml = buildReport({
  title: "E2E QA Walkthrough — Coach Persona",
  subtitle: "Zero → scheduled match: new coach sign-up through fixture creation",
  meta: [
    ["Date", "2026-06-19"],
    ["Environment", "<code>http://localhost:3005</code> (local dev, <code>pnpm dev --port 3005</code> from <code>apps/web</code>)"],
    ["Tester", "Automated Playwright walkthrough + browser review"],
    ["Persona", "New coach — <strong>Coach E2E</strong> (<code>coach-e2e-20260619@local.club</code>)"],
    ["Screenshots", `${coachImageCount} embedded in this report`],
    ["Related", "Manager/scorer flow: e2e-scoring-qa-report.html"],
  ],
  summaryHtml: `<section class="content-block">
    <h2>Executive summary</h2>
    <p>Walked a <strong>brand-new coach</strong> from homepage → password sign-up → create club → create U9 tournament → schedule a fixture using <strong>team names only</strong>. Password path completes without blockers; login defaults to Password when email OTP is unavailable.</p>
    <div class="summary-highlights">
      <div class="highlight fixed"><strong>All critical/high bugs resolved</strong> — password sign-up path unblocked (C1)</div>
      <div class="highlight fixed"><strong>Medium fixes:</strong> C2 OAuth default port 3005, C3 homepage session</div>
      <div class="highlight"><strong>Deferred (low):</strong> C4 post-create redirect, C5 invites prominence, C6 demo marketing, C7 scorer loading</div>
      <div class="highlight"><strong>Screenshots captured:</strong> 15 embedded</div>
      <div class="highlight"><strong>Bugs logged:</strong> 8 — 3 fixed, 4 deferred, 1 dev-only</div>
    </div>
  </section>
  <section class="content-block">
    <h2>Product intent comparison</h2>
    <div class="table-wrap"><table class="data-table comparison-table">
      <thead><tr><th>Intent</th><th>Result</th></tr></thead>
      <tbody>
        <tr><td>No invites required to schedule</td><td class="comparison-pass">Pass — fixture created with typed team names only</td></tr>
        <tr><td>Team names only (opponent need not exist in org)</td><td class="comparison-pass">Pass — away team created as external tournament team</td></tr>
        <tr><td>Rules chosen at tournament level</td><td class="comparison-pass">Pass — MJCA U9 Outdoor default; demo templates hidden in form</td></tr>
        <tr><td>Overs / players at match start</td><td class="comparison-pass">Pass — schedule form has no overs/lineup fields; scorer starts at toss</td></tr>
        <tr><td>Readable public slug URLs</td><td class="comparison-pass">Pass — age-group + team tokens + date</td></tr>
      </tbody>
    </table></div>
  </section>
  <section class="content-block">
    <h2>Coach journey (step-by-step)</h2>
    ${coachSteps.map((s) => {
      if ([2, 4, 6, 11].includes(s.num)) return stepSection(s, null);
      return stepSection(s, s.screenshotFile ? coachImages[s.screenshotFile] : null);
    }).join("")}
  </section>
  <section class="content-block">
    <h2>Bug list</h2>
    ${bugTable(coachBugs)}
  </section>
  <section class="content-block">
    <h2>UX friction notes</h2>
    <ol>
      <li><strong>Sign-up path unclear locally</strong> — Email code is the most visible tab but does not work out of the box; coaches must discover the Password tab (mitigated by C1 fix).</li>
      <li><strong>Extra navigation after club create</strong> — Redirect to dashboard instead of the new org page adds one click before tournaments.</li>
      <li><strong>Tournament page density</strong> — Wallet + schedule form + optional team add + manager invites on one long page; invites look mandatory but are not.</li>
      <li><strong>Schedule form resets date to today</strong> after submit (expected) while fixture list shows the chosen date — fine, but away/home fields retain previous values.</li>
      <li><strong>Google OAuth</strong> — Misconfigured port in dev will fail silently after Google redirect unless Console URI matches.</li>
    </ol>
    <h3>Top 3 issues</h3>
    <ol>
      <li><strong>Email code default on login (C1)</strong> — New coaches hit a dead-end on the default tab when Resend/bypass is unset; use Password or configure bypass. <strong>Fixed:</strong> default tab switches to Password when OTP is unavailable.</li>
      <li><strong>Google OAuth port mismatch (C2)</strong> — Dev hint and OAuth callback use <code>localhost:3000</code> from <code>NEXT_PUBLIC_APP_URL</code>; Google sign-in fails on port 3005 until env is corrected.</li>
      <li><strong>Post-create navigation (C4)</strong> — Creating a club returns to the dashboard list instead of the new org hub, adding friction before the first tournament.</li>
    </ol>
  </section>
  <section class="content-block">
    <h2>Test data created</h2>
    ${dataTable(["Entity", "Value"], [
      ["User", "coach-e2e-20260619@local.club / CoachE2e2026!"],
      ["Organization", "Coach FC 2026-06-19 · slug coach-fc-2026-06-19 · id cmql4nryh0007rpb85gonfz5e"],
      ["Tournament", "Coach U9 2026-06-19 · id cmql4nssd000brpb817xvoiod"],
      ["Match slug", "u9-ext-coach-lions-u9-6e754604-ext-rival-tigers-u9-1375a5b9-20260628"],
      ["Teams", "Coach Lions U9, Rival Tigers U9 (auto-created at schedule)"],
    ])}
    <h3>Re-run commands</h3>
    <pre class="code-block"><code># Dev server
cd apps/web &amp;&amp; pnpm dev --port 3005

# Automated coach walkthrough + screenshots
node apps/web/scripts/coach-e2e-qa.mjs

# Manual entry points
open http://localhost:3005/login
open http://localhost:3005/dashboard/organizations/new</code></pre>
  </section>`,
  bodySections: "",
  footerNote: "Howzzat E2E Coach QA Report · 2026-06-19",
});

writeFileSync(join(__dirname, "e2e-coach-qa-report.html"), coachHtml);
console.log(`Wrote e2e-coach-qa-report.html (${coachImageCount} images)`);

// ─── Index ──────────────────────────────────────────────────────────────────

const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Howzzat QA Reports</title>
  <style>${CSS}
  .report-cards { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
  .report-card {
    display: block;
    padding: 1.5rem;
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: 12px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .report-card:hover {
    border-color: var(--blue);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  }
  .report-card h2 { margin: 0 0 0.5rem; font-size: 1.15rem; color: var(--navy); border: none; padding: 0; }
  .report-card p { margin: 0; font-size: 0.9rem; color: var(--text-muted); }
  .report-card .meta { margin-top: 1rem; font-size: 0.8rem; color: var(--blue); font-weight: 600; }
  </style>
</head>
<body>
  <header class="report-header">
    <div class="brand">Howzzat</div>
    <h1>E2E QA Reports</h1>
    <p class="subtitle">Self-contained HTML walkthrough reports with embedded screenshots · 2026-06-19</p>
  </header>
  <main>
    <section class="content-block">
      <h2>Available reports</h2>
      <div class="report-cards">
        <a class="report-card" href="e2e-scoring-qa-report.html">
          <h2>Scoring / Manager flow</h2>
          <p>Manager → tournament → score flow for Test ECC U9 vs Test Hayes U9. Auth banner + slug mutation bugs fixed.</p>
          <div class="meta">8 screenshots · 11 bugs (8 fixed, 2 low open)</div>
        </a>
        <a class="report-card" href="e2e-coach-qa-report.html">
          <h2>Coach persona (zero → match)</h2>
          <p>New coach sign-up through club, tournament, and scheduled fixture using team names only.</p>
          <div class="meta">15 screenshots · 8 bugs (3 fixed, 4 deferred)</div>
        </a>
      </div>
    </section>
    <section class="content-block">
      <h2>Export to PDF</h2>
      <p>Open any report in your browser, then use <strong>File → Print</strong> (or <kbd>⌘P</kbd> / <kbd>Ctrl+P</kbd>) and choose <strong>Save as PDF</strong>. Reports include print-optimized CSS.</p>
    </section>
  </main>
  <footer class="report-footer">Howzzat QA Reports Index</footer>
</body>
</html>`;

writeFileSync(join(__dirname, "index.html"), indexHtml);
console.log("Wrote index.html");
console.log(`Total embedded images: ${scoringImageCount + coachImageCount}`);
