# E2E QA Walkthrough — Coach persona (zero → scheduled match)

| Field | Value |
|-------|-------|
| **Date** | 2026-06-19 |
| **Environment** | `http://localhost:3005` (local dev, `pnpm dev --port 3005` from `apps/web`) |
| **Tester** | Automated Playwright walkthrough + browser review |
| **Persona** | New coach — **Coach E2E** (`coach-e2e-20260619@local.club`) |
| **Screenshots** | `docs/qa-screenshots/coach-2026-06-19/` (16 files) |
| **Related** | Manager/scorer flow: [`e2e-qa-walkthrough.md`](./e2e-qa-walkthrough.md) |

---

## Executive summary

Walked a **brand-new coach** from homepage → password sign-up → create club → create U9 tournament → schedule a fixture using **team names only** (no invites, no org squads). The happy path completes in ~6 seconds of UI time; match slug URLs are readable and the scorer opens at the toss step for the club owner.

**Blockers to scheduled match:** none on the password path.  
**Top friction:** Google OAuth dev hint still env-dependent (`NEXT_PUBLIC_APP_URL`); post-create org redirect still lands on dashboard (C4).  
**Rules template picker:** MJCA templates only in tournament form (no demo profiles); default **MJCA U9 Outdoor (suggested)**.  
**Screenshots captured:** 15 (fresh 2026-06-19 re-run)  
**Bugs logged:** 8 (1 high fixed; 1 medium fixed; 2 low deferred; 4 low/info deferred)

---

## Coach journey (step-by-step)

### 1. Landing / homepage (unauthenticated)

**URL:** `/`  
**Screenshot:** `01-homepage-unauthenticated.png`

- Hero: **Sign in** + **Club dashboard** (dashboard link works only when already signed in).
- Marketing lists all built-in rules profiles, including **Demo** entries — fine for homepage, but coaches should not see demo templates in the tournament form (they do not; see step 6).
- Homepage always renders logged-out hero even if a session cookie exists (see bug C3).

---

### 2. Sign up

**URL:** `/login?redirect=/dashboard`  
**Screenshots:** `02-login-email-code-default.png`, `03-signup-password-form.png`

**Path used:** **Password** tab → **Need an account? Create one** → email + name + password → **Create account**.

| Method | Result |
|--------|--------|
| **Email code** (default tab before fix) | **Fails** — `EMAIL_NOT_CONFIGURED` (no `RESEND_API_KEY` / `EMAIL_FROM`, no `DEV_EMAIL_BYPASS_*` in `.env.local`) |
| **Password** | **Works** — lands on dashboard |
| **Google** | Not tested; dev hint shows redirect URI on **port 3000** (env mismatch) |

**Dev bypass (optional):** add to `apps/web/.env.local`:

```env
DEV_EMAIL_BYPASS_EMAIL="dev@local.club"
DEV_EMAIL_BYPASS_CODE="123456"
```

**Fix applied:** login page now defaults to **Password** tab when email OTP is not configured (`apps/web/src/app/login/page.tsx`).

---

### 3. Post-signup dashboard (empty state)

**URL:** `/dashboard`  
**Screenshot:** `04-dashboard-post-signup.png`

- Clear empty state: *“You are not part of any club yet…”*
- CTAs: **Create your first club** and **+ New club**.
- Header shows coach name, Account, Sign out.

---

### 4. Create organization (club)

**URL:** `/dashboard/organizations/new`  
**Screenshots:** `05-create-organization-form.png`, `06-dashboard-after-org-created.png`

- Single field: **Club name** (`Coach FC 2026-06-19`).
- Submit **Create organization** → redirects to **`/dashboard`** (not the new org hub — extra click; see UX notes).
- Dashboard now lists the club: **0 teams · 0 tournaments · OWNER**.

---

### 5. Organization hub

**URL:** `/dashboard/organizations/{orgId}`  
**Screenshot:** `07-organization-hub.png`

- Two tiles: **Teams** (0 squads), **Tournaments** (0 competitions).
- Straightforward next step: open **Tournaments**.

---

### 6. Create tournament

**URLs:** `/tournaments` (empty) → `/tournaments/new`  
**Screenshots:** `08-tournaments-empty-state.png`, `09-create-tournament-form.png`, `10-tournaments-list-after-create.png`

- Empty tournaments copy: *“No tournaments yet.”* + **Create tournament**.
- Form defaults:
  - Age group: **U9**
  - Season: **Summer 2026**
  - Rules template: **MJCA U9 Outdoor (suggested)** with pairs/200/−5 summary + MJCA rules link
- Rules dropdown groups: U9, Boys & senior, Girls, Other — **no Demo templates** (correct for coaches).
- Optional **Customize rules** checkbox (left unchecked).
- **Create tournament** → tournaments list; new row shows MJCA rules label.

---

### 7. Tournament dashboard (wallet, invites, fixtures)

**URL:** `/dashboard/organizations/{orgId}/tournaments/{tournamentId}`  
**Screenshot:** `11-tournament-dashboard-empty-fixtures.png`

| Section | State | Notes |
|---------|-------|-------|
| **Tournament wallet** | £0.00 | Copy explains per-player charge at finalize; **Manage wallet** link |
| **Fixtures (0)** | Empty + schedule form | Team names only — no invite required |
| **Teams in tournament (0)** | Optional add-by-name | Not required for scheduling |
| **Manager invites** | Empty form | Optional; not on critical path |

---

### 8. Schedule match

**Screenshot:** `12-schedule-match-filled.png`

- **Home team:** `Coach Lions U9` (free text)
- **Away team:** `Rival Tigers U9` (placeholder: *“Opponent (name only is fine)”*)
- **Venue:** `Main Ground`
- **Match date:** `2026-06-28` (date picker; defaults to today)
- **Schedule match** — ~27 ms API round-trip in test

No org teams, roster, or manager invites were needed.

---

### 9. Match in fixtures + slug URL

**Screenshot:** `13-fixtures-with-match.png`

- Fixture list: **Coach Lions U9 vs Rival Tigers U9** — `SCHEDULED · 2026-06-28 · Main Ground`
- **Scorecard** + **Score** links use readable slug:

  `/match/u9-ext-coach-lions-u9-6e754604-ext-rival-tigers-u9-1375a5b9-20260628`

- **Teams in tournament (2)** auto-created from typed names.

---

### 10. Optional — wallet top-up / coupon

**URL:** `/dashboard/organizations/{orgId}/tournaments/{tournamentId}/wallet`  
**Screenshot:** `15-wallet-page.png`

- Balance **£0.00**; top-up buttons £10 / £20 / £50 (Stripe test mode hint).
- **Redeem coupon** form present.
- Wallet not required to **schedule** a match; billing applies at finalize.

---

### 11. Optional — scorer entry (post-schedule)

**URLs:** `/match/{slug}/score`  
**Screenshots:** `14-match-score-pad-pre-start.png` (early capture), `16-score-page-loaded.png` (after load)

- Immediate navigation can flash **“Loading scorer…”** for several seconds; full UI loads with **Record the toss** step.
- Club owner sees toss UI (no erroneous “Sign in to score” banner — see manager walkthrough fix).
- Confirms product intent: **overs/lineups at match start**, not at schedule time.

---

## Product intent comparison

| Intent | Result |
|--------|--------|
| No invites required to schedule | **Pass** — fixture created with typed team names only |
| Team names only (opponent need not exist in org) | **Pass** — away team created as external tournament team |
| Rules chosen at tournament level | **Pass** — MJCA U9 Outdoor default; demo templates hidden in form |
| Overs / players at match start | **Pass** — schedule form has no overs/lineup fields; scorer starts at toss |
| Readable public slug URLs | **Pass** — age-group + team tokens + date |

---

## Bug list

| ID | Severity | Screen | Description | Repro | Suggested fix | Status |
|----|----------|--------|-------------|-------|---------------|--------|
| C1 | **High** | `/login` | Default **Email code** tab; Send code fails when Resend/bypass unset | Open login → Send code | Default to Password when OTP unavailable; document bypass in `.env.local` | **Fixed** (default tab) |
| C2 | **Medium** | `/login` dev hint | Google redirect URI shows `localhost:3000` while dev uses **3005** | Open login → read yellow dev box | Set `NEXT_PUBLIC_APP_URL=http://localhost:3005` in `.env.local` | **Fixed** (code default 3005) |
| C3 | Medium | `/` | Homepage hero always shows **Sign in** even with active session | Sign in → visit `/` | SSR session check on homepage hero | **Fixed** |
| C4 | Low | Create org | After create, lands on dashboard root not org hub | Create club → observe redirect | Redirect to `/dashboard/organizations/{id}` | **Fixed** |
| C5 | Low | Tournament dashboard | **Manager invites** section prominent; coaches may think invites are required | Open new tournament page | Collapse invites behind “Advanced” or add “optional” label | **Fixed** |
| C6 | Low | Homepage | **Demo** rules profiles listed in public marketing | Visit `/` | Separate “Try demos” from coach-facing copy | **Fixed** |
| C7 | Low | Scorer `/score` | **Loading scorer…** persists several seconds on first paint | Click Score immediately after schedule | Skeleton with step hint; prefetch match context | **Fixed** |
| C8 | Info | Dev tooling | Next.js **“1 Issue”** badge on several pages | Any dashboard page in dev | Inspect hydration/console warnings | **Wontfix** (dev-only) |

---

## UX friction notes

1. **Sign-up path unclear locally** — Email code is the most visible tab but does not work out of the box; coaches must discover the Password tab (mitigated by C1 fix).
2. **Extra navigation after club create** — Redirect to dashboard instead of the new org page adds one click before tournaments.
3. **Tournament page density** — Wallet + schedule form + optional team add + manager invites on one long page; invites look mandatory but are not.
4. **Schedule form resets date to today** after submit (expected) while fixture list shows the chosen date — fine, but away/home fields retain previous values.
5. **Google OAuth** — Misconfigured port in dev will fail silently after Google redirect unless Console URI matches.

---

## Test data created

| Entity | Value |
|--------|-------|
| User | `coach-e2e-20260619@local.club` / `CoachE2e2026!` |
| Organization | Coach FC 2026-06-19 · slug `coach-fc-2026-06-19` · id `cmql4nryh0007rpb85gonfz5e` |
| Tournament | Coach U9 2026-06-19 · id `cmql4nssd000brpb817xvoiod` |
| Match slug | `u9-ext-coach-lions-u9-6e754604-ext-rival-tigers-u9-1375a5b9-20260628` |
| Teams | Coach Lions U9, Rival Tigers U9 (auto-created at schedule) |

---

## Screenshot index

| File | Screen |
|------|--------|
| `01-homepage-unauthenticated.png` | Homepage (logged-out hero) |
| `02-login-email-code-default.png` | Login — Email code tab (pre-fix default) |
| `03-signup-password-form.png` | Password registration form |
| `04-dashboard-post-signup.png` | Empty dashboard after sign-up |
| `05-create-organization-form.png` | New club form |
| `06-dashboard-after-org-created.png` | Dashboard with new club card |
| `07-organization-hub.png` | Org hub (Teams / Tournaments tiles) |
| `08-tournaments-empty-state.png` | Tournaments list empty |
| `09-create-tournament-form.png` | New tournament (MJCA U9 default) |
| `10-tournaments-list-after-create.png` | Tournaments list with one row |
| `11-tournament-dashboard-empty-fixtures.png` | Tournament page before first fixture |
| `12-schedule-match-filled.png` | Schedule match form filled |
| `13-fixtures-with-match.png` | Fixture listed with Score links |
| `14-match-score-pad-pre-start.png` | Scorer loading state (early) |
| `15-wallet-page.png` | Tournament wallet + coupon |
| `16-score-page-loaded.png` | Toss step (scorer ready) |

---

## Re-run commands

```bash
# Dev server
cd apps/web && pnpm dev --port 3005

# Automated coach walkthrough + screenshots
node apps/web/scripts/coach-e2e-qa.mjs

# Manual entry points
open http://localhost:3005/login
open http://localhost:3005/dashboard/organizations/new
```

---

## Top 3 issues

1. **Email code default on login (C1)** — New coaches hit a dead-end on the default tab when Resend/bypass is unset; use Password or configure bypass. **Fixed:** default tab switches to Password when OTP is unavailable.
2. **Google OAuth port mismatch (C2)** — Dev hint and OAuth callback use `localhost:3000` from `NEXT_PUBLIC_APP_URL`; Google sign-in fails on port 3005 until env is corrected.
3. **Post-create navigation (C4)** — Creating a club returns to the dashboard list instead of the new org hub, adding friction before the first tournament.
