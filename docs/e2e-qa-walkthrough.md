# E2E QA Walkthrough — Howzzat Web

| Field | Value |
|-------|-------|
| **Date** | 2026-06-19 |
| **Environment** | `http://localhost:3005` (local dev, `pnpm dev:web`) |
| **Tester** | Automated browser walkthrough + code review |
| **User** | Kunal Chitkara (ECC club OWNER) |
| **Primary match** | U9 ECC vs Test Hayes U9 — slug `u9-ecc-test-hayes-20260619` |
| **Screenshots** | `docs/qa-screenshots/2026-06-19/` (9 files) |

---

## Executive summary

Walked the manager → tournament → score flow for **Test ECC U9 vs Test Hayes U9**. The reported **“Sign in to score” banner while logged in** was reproduced in code review and fixed. A second **critical** bug was found: **all match mutations via public slug URLs returned 500** because Prisma updates used the slug instead of the internal match id.

**Auth bug fixed:** yes (see [Auth bug analysis](#auth-bug-analysis-sign-in-banner)).  
**Slug mutation bug fixed:** yes (claim + toss + other match writes).  
**Medium bugs fixed this session:** homepage session (B3), org slug routes (B4), duplicate teams (B5), schedule defaults (B6), public `/t/{token}` (B9), lineup hints + U9 min 4 (B8).  
**Screenshots captured:** 8 (fresh 2026-06-19 re-run)  
**Bugs logged:** 11 (2 critical fixed; 6 medium/low fixed; 3 low/info deferred)

---

## Walkthrough

### 1. Homepage (logged-out UI)

**URL:** `/`  
**Screenshot:** `01-homepage.png`

- Hero shows **Sign in** and **Club dashboard** buttons.
- Rules profiles list renders correctly.
- Next.js dev overlay showed **“1 Issue”** badge (dev-only).

**Note:** Even with an active session cookie, the homepage still renders the logged-out hero (Sign in visible). Dashboard correctly shows the user as logged in — see step 2.

---

### 2. Login / session state

**URL:** `/login` → redirected to `/dashboard` (existing session)  
**Screenshot:** `02-dashboard-logged-in.png`

- Browser already had a valid session for **Kunal Chitkara**.
- Dashboard header: Account + Sign out.
- ECC club listed as **OWNER** (2 teams → 4 teams after test data).

No dev bypass needed; session cookie `howzzat_session` was present.

---

### 3. Dashboard → organization

**URL:** `/dashboard/organizations/cmqakxdv30002hkwtxa83pdos`  
**Screenshot:** `03-org-page.png`

- ECC org page: Teams, Tournaments, View public tournament links.
- **Bug:** `/dashboard/organizations/ecc` (slug) returns **404** — only internal id works.

---

### 4. Tournament page (fixtures + schedule form)

**URL:** `/dashboard/organizations/cmqakxdv30002hkwtxa83pdos/tournaments/cmqakyxrw000ehkwt2n174i4r`  
**Screenshots:** `04-tournament-page.png`, `05-schedule-form-with-fixture.png`

- Tournament **Test ECC U9**, MJCA U9 Outdoor rules, wallet **£25.00**.
- **Schedule match** form includes **Match date** field (defaults to today).
- After creating U9 ECC vs Test Hayes U9 fixture:
  - Fixture list shows **LIVE** match with Scorecard + Score links.
  - **Teams in tournament (3)** but **Test Hayes U9 appears twice** (duplicate team entries).
  - Schedule form pre-selects **Test Hayes U9** for both Home and Away (confusing).

---

### 5. Match scorecard (public)

**URL:** `/match/u9-ecc-test-hayes-20260619`  
**Screenshot:** `06-match-scorecard.png`

- Live scorecard banner, Summary/Commentary tabs.
- Pairs scoring: **200/0** base score displayed.
- **Open scorer →** link present.

---

### 6. Match score page — sign-in banner investigation

**URL:** `/match/u9-ecc-test-hayes-20260619/score`  
**Screenshot:** `07-match-score-toss-fixed.png` (after fix)

**Before fix (reproduced via API + code):**
- Yellow **“Sign in to score”** banner shown despite logged-in ECC owner.
- Toss UI hidden (`canScore: false`) because `requiresAuth: true`.
- Auto **scoring/claim** POST returned **500 Internal server error**.

**After fix:**
- No sign-in banner for logged-in club owner.
- Toss step visible; toss saved successfully.
- Claim endpoint succeeds.

---

### 7. Toss step

**Screenshot:** `07-match-score-toss-fixed.png`

- Selected **U9 ECC** won toss, elected **Bat**.
- **Save toss & pick lineups** advanced to lineups.
- Toss summary line: “U9 ECC won the toss · elected to bat”.

**Pre-fix:** toss POST also 500’d (same slug/id bug as claim).

---

### 8. Lineups step

**Screenshot:** (captured in flow; see `09-scoring-step.png` for post-confirm state)

- Roster shows 3 U9 ECC players (Veer, Taran, Avyaan).
- Quick-add text fields for both sides.
- Rules require **6–10 players per side** — confirm button stays disabled until minimum met.
- Opponent side has no roster until quick-add.

---

### 9. Scoring step

**URL:** `/match/u9-ecc-test-hayes-20260619/score` (after squads confirmed)  
**Screenshot:** `09-scoring-step.png`

- Step 3 **Score** active.
- Innings 1: **200-0**, 0.0/16 ov (pairs base 200).
- Batsman/bowler pickers, run pad (0–6), extras, wicket.
- Bowler must be picked before first ball (expected).

---

### 10. Finalize / result

Not completed end-to-end (would require full innings + wallet charge). Public scorecard and tournament hub show LIVE state.

---

### 11. Public tournament insights hub

**URL:** `/orgs/ecc/tournaments/test-ecc-u9`  
**Screenshot:** (capture timed out; page verified via snapshot)

- Overview, Fixtures, Leaders, Players tabs.
- **Live now** card for U9 ECC vs Test Hayes U9.
- Standings / season insights sections render.
- **Bug:** `/t/test-ecc-u9` returns 404 — public URL pattern is `/orgs/{orgSlug}/tournaments/{tournamentSlug}`.

---

### 12. Demo page

**URL:** `/demo`  
**Screenshot:** `13-demo-page.png`

- Presentation-style demo (slide 1/20).
- Keyboard navigation hints.

---

## Auth bug analysis: sign-in banner

### Symptom

Logged-in club owner (ECC OWNER) sees yellow banner on `/match/{slug}/score`:

> **Sign in to score** — Club managers must sign in before scoring.

### Root cause

`buildScoringLockInfo()` in `scoring-lock.ts` overloaded **`requiresAuth`**:

| User state | Demo match | Old `requiresAuth` | Old `canScore` | UI result |
|------------|------------|--------------------|----------------|-----------|
| Not signed in | No | `true` | `false` | Sign-in banner ✓ |
| Signed in, club manager | No | **`true`** | `true` | **Sign-in banner ✗** |
| Signed in, no role | No | `true` | `false` | Sign-in banner (misleading — should say “no permission”) |

`ScorePad.tsx` rendered the banner when `ctx.scoringLock.requiresAuth` was true:

```tsx
{ctx.scoringLock.requiresAuth && (
  <div className="sp-scoring-lock">
    <strong>Sign in to score</strong>
```

For authenticated managers on real (non-demo) matches, `requiresAuth` was `true` meaning “this match type requires authentication in general”, **not** “you need to sign in now”.

Demo matches (`u9-live`, `ios-live`) correctly set `requiresAuth: false`.

### Fix applied

1. Added **`needsSignIn`** to `ScoringLockInfo` — `true` only when `user === null` on non-demo matches.
2. Updated `ScorePad.tsx` (and mobile scorer) to show the banner on **`needsSignIn`**, not `requiresAuth`.
3. Claim auto-POST guard uses `needsSignIn` instead of `requiresAuth`.

### Secondary bug (also fixed)

`claimMatchScoring()` and `recordToss()` (and other match mutations) called:

```ts
await prisma.match.update({ where: { id: matchId } })
```

where `matchId` was the **URL slug** (`u9-ecc-test-hayes-20260619`), not the cuid. `getMatch()` resolves slug → record, but updates used the raw param → **P2025 record not found** → 500 “Internal server error” on claim and toss.

**Fix:** normalize to `match.id` after `getMatch()` in `scoring-lock.ts` and `matches.ts` mutation helpers.

### Files changed

- `apps/web/src/lib/services/scoring-lock.ts`
- `apps/web/src/lib/services/matches.ts`
- `apps/web/src/lib/scoring/types.ts`
- `apps/web/src/components/scoring/ScorePad.tsx`
- `apps/mobile/app/match/[id]/score.tsx`
- `apps/mobile/lib/api.ts`
- `apps/web/tests/unit/scoring-lock.test.ts`

---

## Bug list

| ID | Severity | Screen | Description | Steps to reproduce | Suggested fix | Status |
|----|----------|--------|-------------|-------------------|---------------|--------|
| B1 | **Critical** | Match score `/score` | “Sign in to score” shown for logged-in club owner | Sign in as ECC owner → open non-demo match score URL | Use `needsSignIn` for banner; keep `requiresAuth` for API semantics | **Fixed** |
| B2 | **Critical** | Match score `/score` | Claim/toss/mutations 500 when URL uses slug | Open `/match/u9-ecc-…/score` → page loads → claim or save toss | Use `match.id` from `getMatch()` for all Prisma writes | **Fixed** |
| B3 | Medium | Homepage `/` | Shows “Sign in” while session active | Log in → visit `/` | Server-render auth state in homepage hero (read session cookie) | **Fixed** |
| B4 | Medium | Org dashboard | `/dashboard/organizations/ecc` → 404 | Navigate by org slug instead of id | Support slug in route or redirect | **Fixed** |
| B5 | Medium | Tournament page | Duplicate **Test Hayes U9** in teams list | Add opponent via quick-add twice / UI + API race | Dedupe tournament teams by name; idempotent add | **Fixed** |
| B6 | Low | Tournament schedule form | Home & Away both default to same opponent team | Open schedule form after adding Hayes | Reset away dropdown when home changes | **Fixed** |
| B7 | Low | Tournament page | Next.js dev **“N Issues”** overlay | Run dev server, visit tournament page | Investigate console/hydration warnings | **Wontfix** (dev-only) |
| B8 | Low | Lineups | Confirm disabled — only 3 roster players, rules need 6+ | Open lineups for U9 ECC with small roster | Clearer “need N more players” CTA; U9 min 4 in MJCA profile | **Fixed** |
| B9 | Low | Public URLs | `/t/{slug}` 404 | Visit `/t/test-ecc-u9` | Redirect or document `/orgs/{org}/tournaments/{slug}` | **Fixed** |
| B10 | Low | Dashboard club link | Click on list item `<li>` intercepted | Click ECC card body on dashboard | Make entire card clickable or fix z-index | **Fixed** |
| B11 | Info | Screenshot tooling | Full-page screenshots intermittently timeout | `browser_take_screenshot` with `fullPage: true` | Retry without fullPage (workaround used) | N/A |

---

## Test data created

| Entity | Id / slug |
|--------|-----------|
| Match | `cmql3gser0003rpn60zue2wu8` / `u9-ecc-test-hayes-20260619` |
| Opponent team | Test Hayes U9 (`cmql3g2xq0001rphen950uevx`) |
| Tournament | Test ECC U9 (`cmqakyxrw000ehkwt2n174i4r`) |

---

## Verification commands

```bash
# Unit tests for scoring lock
cd apps/web && pnpm exec vitest run tests/unit/scoring-lock.test.ts

# Open scorer (logged in)
open http://localhost:3005/match/u9-ecc-test-hayes-20260619/score

# Public tournament hub
open http://localhost:3005/orgs/ecc/tournaments/test-ecc-u9
```

---

## Screenshot index

| File | Screen |
|------|--------|
| `01-homepage.png` | Homepage (logged-out hero) |
| `02-dashboard-logged-in.png` | Dashboard with session |
| `03-org-page.png` | ECC organization page |
| `04-tournament-page.png` | Tournament page (initial) |
| `05-schedule-form-with-fixture.png` | Tournament + fixture + schedule form |
| `06-match-scorecard.png` | Public live scorecard |
| `07-match-score-toss-fixed.png` | Scorer toss step (post auth fix) |
| `09-scoring-step.png` | Live scoring pad |
| `13-demo-page.png` | `/demo` presentation |
