# Mobile Maestro E2E

[Maestro](https://maestro.mobile.dev/) runs UI flows on the iOS Simulator against Expo Go or a dev build.

## Prerequisites

1. Install Maestro: `curl -Ls "https://get.maestro.mobile.dev" | bash`
2. Start the web API (default port **3005**):
   ```bash
   cd apps/web && pnpm dev --port 3005
   ```
3. Start Expo with local API:
   ```bash
   EXPO_PUBLIC_API_URL=http://localhost:3005 pnpm dev:mobile
   ```
4. Open the app on the **iOS Simulator** (press `i` in the Expo terminal).

## Run flows

From repo root:

```bash
pnpm test:mobile:e2e
```

Or manually:

```bash
maestro test apps/mobile/.maestro/demo-no-auth.yaml
maestro test apps/mobile/.maestro/squad-picker.yaml
```

## Flows

| File | Covers |
|------|--------|
| `demo-no-auth.yaml` | Home → 2-over demo → squads → toss → score a four |
| `squad-picker.yaml` | Roster add/remove before confirm |
| `scorer-invite.yaml` | Deep link `howzzat://score/invite/:token` (needs env vars) |

`scorer-invite.yaml` is optional in CI — set `MAESTRO_MATCH_ID` and `MAESTRO_INVITE_TOKEN` after creating an invite via API.

## CI note

Maestro is **not** required for `pnpm test:mobile`. API integration tests in `apps/web/tests/integration/mobile-phase2.test.ts` mirror the same flows without a simulator.
