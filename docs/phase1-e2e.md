# Phase 1 — manual e2e script (local dev)

Default dev port: **3005** (`pnpm dev:web` or `cd apps/web && pnpm dev --port 3005`).

Set `BASE=http://localhost:3005` for the commands below.

## Prerequisites

1. Database migrated: `pnpm db:migrate` (from repo root).
2. `apps/web/.env.local` with at least `DATABASE_URL` (see `apps/web/.env.example`).
3. For **Google OAuth**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`, and in Google Cloud Console (Web client):
   - Authorized JavaScript origin: `http://localhost:3005`
   - Authorized redirect URI: `http://localhost:3005/api/v1/auth/google/callback`  
   Production checklist: see `docs/cloudflare-setup.md` §9 (`https://app.howzzat.uk/...`).
4. For **Email OTP** (recommended): `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `Howzzat <onboarding@resend.dev>` for dev).  
   **Dev bypass** (no Resend): set `DEV_EMAIL_BYPASS_EMAIL` and `DEV_EMAIL_BYPASS_CODE` in `.env.local`.
5. For **Email + password**: no extra services — register via API or login UI **Password** tab.
6. For **Google OAuth**: see step 3 above.
7. **SMS OTP** (optional, deprioritized): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`.  
   Shown on login only when `TWILIO_VERIFY_SERVICE_SID` is set.  
   **Dev bypass**: `DEV_SMS_BYPASS_PHONE` and `DEV_SMS_BYPASS_CODE`.

## 1. Sign in

### Option A — password (no external services)

```bash
BASE=http://localhost:3005

curl -s -c /tmp/howzzat-cookies.txt -X POST "$BASE/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"manager@local.club","password":"localpass123","name":"Local Manager"}' | jq .

curl -s -b /tmp/howzzat-cookies.txt "$BASE/api/v1/auth/me" | jq .
```

Browser: [http://localhost:3005/login](http://localhost:3005/login) → **Password** tab.

### Option B — email OTP (Resend or dev bypass)

```bash
curl -s -X POST "$BASE/api/v1/auth/email/send" \
  -H 'Content-Type: application/json' \
  -d '{"email":"manager@local.club"}' | jq .

# Use code from email (or DEV_EMAIL_BYPASS_CODE)
curl -s -c /tmp/howzzat-cookies.txt -X POST "$BASE/api/v1/auth/email/verify" \
  -H 'Content-Type: application/json' \
  -d '{"email":"manager@local.club","code":"123456","name":"Local Manager"}' | jq .
```

### Option C — dev-only passwordless (automated tests)

`POST /api/v1/auth/login` with `{ email, name? }` still works when `NODE_ENV` is not `production`.

## 2. Create organization

```bash
curl -s -b /tmp/howzzat-cookies.txt -X POST "$BASE/api/v1/organizations" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Local CC","slug":"local-cc"}' | jq .
```

Save `ORG_ID` from response. Dashboard: [http://localhost:3005/dashboard/organizations/new](http://localhost:3005/dashboard/organizations/new)

## 3. Create teams

```bash
ORG_ID=<from step 2>

curl -s -b /tmp/howzzat-cookies.txt -X POST "$BASE/api/v1/organizations/$ORG_ID/teams" \
  -H 'Content-Type: application/json' \
  -d '{"name":"U9 Lions","ageGroup":"U9"}' | jq .

curl -s -b /tmp/howzzat-cookies.txt -X POST "$BASE/api/v1/organizations/$ORG_ID/teams" \
  -H 'Content-Type: application/json' \
  -d '{"name":"U9 Tigers"}' | jq .
```

Save `TEAM_A_ID`, `TEAM_B_ID`. Dashboard: `/dashboard/organizations/$ORG_ID/teams`

## 4. Create tournament

```bash
curl -s -b /tmp/howzzat-cookies.txt -X POST "$BASE/api/v1/organizations/$ORG_ID/tournaments" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Summer 2026","rulesTemplateBuiltinId":"u9-softball-london-v1"}' | jq .
```

Save `TOURNAMENT_ID`. Dashboard: `/dashboard/organizations/$ORG_ID/tournaments/new`

## 5. Register teams + add player

```bash
TOURNAMENT_ID=<from step 4>

curl -s -b /tmp/howzzat-cookies.txt -X POST "$BASE/api/v1/tournaments/$TOURNAMENT_ID/teams" \
  -H 'Content-Type: application/json' \
  -d "{\"teamId\":\"$TEAM_A_ID\"}" | jq .

curl -s -b /tmp/howzzat-cookies.txt -X POST "$BASE/api/v1/tournaments/$TOURNAMENT_ID/teams" \
  -H 'Content-Type: application/json' \
  -d "{\"teamId\":\"$TEAM_B_ID\"}" | jq .

curl -s -b /tmp/howzzat-cookies.txt -X POST "$BASE/api/v1/teams/$TEAM_A_ID/players" \
  -H 'Content-Type: application/json' \
  -d '{"legalName":"Jamie","shirtNumber":7}' | jq .
```

Save `TT_HOME_ID`, `TT_AWAY_ID` from tournament team responses.

## 6. Invite tournament manager

```bash
curl -s -b /tmp/howzzat-cookies.txt -X POST "$BASE/api/v1/tournaments/$TOURNAMENT_ID/invites" \
  -H 'Content-Type: application/json' \
  -d '{"email":"manager@local.club","kind":"MANAGER"}' | jq .
```

Save `TOKEN`. Open invite: `http://localhost:3005/invite/$TOKEN`

Dashboard: tournament page → **Manager invites** section.

For club-wide access instead, use `{"kind":"ORG_MANAGER","role":"MANAGER"}` or `"role":"SCORER"`.

## 7. Manager accepts invite

```bash
curl -s -c /tmp/howzzat-manager.txt -X POST "$BASE/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"email":"manager@local.club","password":"managerpass123","name":"Local Manager"}' | jq .

curl -s -b /tmp/howzzat-manager.txt -X POST "$BASE/api/v1/invites/$TOKEN/accept" | jq .
```

Tournament-manager invites add a `TournamentManager` row (no org membership). Org invites add `OrgMembership`. Dashboard: [http://localhost:3005/dashboard](http://localhost:3005/dashboard)

## 8. Schedule match

```bash
curl -s -b /tmp/howzzat-cookies.txt -X POST "$BASE/api/v1/tournaments/$TOURNAMENT_ID/matches" \
  -H 'Content-Type: application/json' \
  -d "{\"homeTeamId\":\"$TT_HOME_ID\",\"awayTeamId\":\"$TT_AWAY_ID\",\"venue\":\"Main Ground\"}" | jq .
```

Save `MATCH_ID`. Score: `http://localhost:3005/match/$MATCH_ID/score`

## 9. Tournament wallet & coupon (dashboard UI)

After creating a tournament (`TOURNAMENT_ID`, `ORG_ID`):

1. Open tournament dashboard:  
   `http://localhost:3005/dashboard/organizations/$ORG_ID/tournaments/$TOURNAMENT_ID`  
   Confirm **Tournament wallet** shows balance (starts at £0.00) and **Manage wallet →** link.
2. Open wallet page:  
   `http://localhost:3005/dashboard/organizations/$ORG_ID/tournaments/$TOURNAMENT_ID/wallet`  
   Redeem a coupon or use Stripe test card `4242 4242 4242 4242`.
3. Generate a coupon (admin):

```bash
curl -s -X POST "$BASE/api/v1/admin/coupons" \
  -H 'Content-Type: application/json' \
  -H "X-Admin-Secret: $COUPON_ADMIN_SECRET" \
  -d '{"amountPence":2500,"code":"HOWZZAT-ALPHA-E2E1"}' | jq .
```

4. Redeem via API (manager cookie from step 1):

```bash
curl -s -b /tmp/howzzat-cookies.txt -X POST \
  "$BASE/api/v1/tournaments/$TOURNAMENT_ID/wallet/redeem-coupon" \
  -H 'Content-Type: application/json' \
  -d '{"code":"HOWZZAT-ALPHA-E2E1"}' | jq .
```

Expect `balancePence: 2500`. In the wallet UI, enter the same code and confirm balance updates.

## 10. Logout

```bash
curl -s -b /tmp/howzzat-cookies.txt -X POST "$BASE/api/v1/auth/logout" | jq .
curl -s -b /tmp/howzzat-cookies.txt "$BASE/api/v1/auth/me" | jq .
```

## Production environment variables

| Variable | Required for | Notes |
|----------|--------------|-------|
| `GOOGLE_CLIENT_ID` | Google OAuth (web) | OAuth 2.0 Web client |
| `GOOGLE_CLIENT_SECRET` | Google OAuth (web) | Server-side only |
| `GOOGLE_IOS_CLIENT_ID` | Mobile Google sign-in | iOS OAuth client |
| `GOOGLE_ANDROID_CLIENT_ID` | Mobile Google sign-in | Android OAuth client |
| `NEXT_PUBLIC_APP_URL` | OAuth redirects | e.g. `https://app.howzzat.uk` |
| `TWILIO_ACCOUNT_SID` | SMS OTP | Live Account SID |
| `TWILIO_AUTH_TOKEN` | SMS OTP | Auth token |
| `TWILIO_VERIFY_SERVICE_SID` | SMS OTP | Verify service SID |
| `DATABASE_URL` | All | Turso `libsql://…` in production |
| `DATABASE_AUTH_TOKEN` | All (Turso) | Turso auth token |
| `COUPON_ADMIN_SECRET` | Wallet coupons (Phase 6) | `X-Admin-Secret` header |

`DEV_EMAIL_BYPASS_*` and `DEV_SMS_BYPASS_*` — **local dev only**; do not set in production.

## Automated tests

### API integration (Vitest)

```bash
pnpm test:api
```

Phase 1 happy path: `apps/web/tests/api/phase1-e2e.test.ts`  
Wallet coupons (API): `apps/web/tests/integration/wallet-coupon.test.ts`

### Browser e2e (Playwright)

Starts Next.js on port **3099** with an isolated SQLite DB (`apps/web/.e2e-db.db`).

```bash
pnpm test:e2e
```

First run installs Chromium:

```bash
cd apps/web && pnpm exec playwright install chromium
```

Specs:

- `apps/web/e2e/login.spec.ts` — password register + dashboard smoke
- `apps/web/e2e/manager-flow.spec.ts` — org → teams → tournament → fixture → invite → wallet coupon

Optional: run against an already-running dev server on another port:

```bash
E2E_PORT=3005 pnpm test:e2e
```
