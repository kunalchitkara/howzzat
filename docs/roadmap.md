# Howzzat roadmap

Product phases and deferred work. See also the summary table in [README](../README.md#roadmap).

## Phase 2 — Mobile scorer (deferred epic)

**Status:** Deferred — web ScorePad covers primary scoring; mobile has demo flow and Phase 2 API tests only.

### Scope when resumed

| Item | Description |
|------|-------------|
| **Offline delivery queue** | Persist `clientDeliveryId` outbox in AsyncStorage; flush on reconnect (mirror web `use-match-scoring-sync`) |
| **Native auth** | Email OTP / password screens (today: Google + web fallback) |
| **Rule changes BACKFILL** | Mobile UI to preview/apply mid-tournament rule changes via `/api/v1/tournaments/:id/rules/*` |
| **Scorer invite deep links** | Polish `howzzat://score/invite/{token}` flow end-to-end on device |
| **Maestro E2E** | Expand `apps/mobile/scripts/run-maestro-if-available.mjs` flows beyond bundle smoke |

### Out of scope for Phase 2 epic

- Full feature parity with web tournament dashboard
- Wallet / billing UI on mobile
- Public spectator views in the app

### References

- API coverage: `apps/web/tests/integration/mobile-phase2.test.ts`
- Architecture notes: [architecture.md](./architecture.md)
- Demo: `POST /api/v1/demo/ios-match` + `pnpm dev:mobile`
