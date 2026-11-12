# ANON// — Engineering Status
Updated: 2026-11-12

This file describes the current source-code state and outstanding verification. Code being present is not the same as a successful production test.

## Release blockers

- [ ] **Backend availability:** the Railway production backend service was offline at the latest audit check. Its latest recorded deployment failed during a BuildKit connection error. A fresh successful deployment and health check are still required.
- [ ] **Durable database storage:** the Railway backend currently has no attached persistent volume. SQLite supports `ANON_DB_PATH`; attach a volume at `/data` and set `ANON_DB_PATH=/data/anon.db` before relying on reports, blocks, strikes, or connection metadata surviving redeploys.
- [ ] **Run CI on the audit branch:** backend integration tests and frontend lint/build have not yet been confirmed on this branch.
- [ ] **No end-to-end encryption:** live chat is processed in plaintext by the backend. The Trust-page WebCrypto panel is a standalone demonstration, not real chat encryption.

## Implemented in source — validation still required

- [x] Public `/api/stats` endpoint exists.
- [x] Exact-origin CORS checks and a handled-event allowlist/rate-limiting middleware are present.
- [x] SQLite tables cover reports, profile blocks, moderation strikes, and pseudonymized session metadata.
- [x] Public and room text-message retries use client IDs for deduplication; message ownership can survive reconnects when the stable local profile token is available.
- [x] Browser offline text queue and IndexedDB message cache have expiry limits.
- [x] Confession feed uses server-memory expiry (up to 7 days); the separate `/confession` page is a browser-local preview.
- [x] AI participants are labelled. Scheduled bot replies are limited to public chat and clearly marked AI-created rooms; ordinary user-created rooms are excluded.
- [x] AI-provider disclosure names the external processing boundary. Relevant text and limited context may be sent when a bot replies.
- [x] Admin dashboard includes token throttling, database-availability checks, response security headers, and spreadsheet-formula-safe CSV output.
- [x] Local data wipe is scoped to ANON-owned browser storage, the ANON IndexedDB database, ANON caches, and ANON's service worker. It does **not** erase server-side reports or retained connection metadata.

## Verification checklist

- [ ] `npm test --prefix anon-server`
- [ ] `npm run lint --prefix anon-app`
- [ ] `npm run build --prefix anon-app`
- [ ] Two-client manual checks: public chat, rooms, DMs, reconnects, image messages, message edits/deletes, blocks, and report review.
- [ ] Avatar checks: custom design persistence, old-message rendering, profile token recovery, and mobile layout.
- [ ] Privacy checks: AI-room label before joining, no bot entry into user-created rooms, local wipe, and cache/service-worker cleanup.
- [ ] Production checks after backend deployment: root health endpoint, Socket.IO connection, exact CORS origins, database readiness, and durable-volume persistence.

## Remaining product work

- [ ] Cross-device identity is not provided; the stable profile token is browser-local.
- [ ] Add production error monitoring and alerting.
- [ ] Review and simplify the large global stylesheet after mobile regression tests.
- [ ] Add automated frontend tests for avatar synchronization, data wipe, and responsive navigation.
- [ ] Consider push notifications, voice/video, link previews, and other optional features only after reliability and privacy checks.

