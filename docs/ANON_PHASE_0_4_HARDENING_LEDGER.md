# ANON — Phase 0–4 hardening ledger

Last reviewed: 2026-11-06

## Safety and change-control rules

- Keep `main` unchanged until an owner-approved pull request is ready.
- Work on isolated branches and keep each change narrow enough to review and revert.
- Do not delete or silently replace existing features, routes, user data, or configuration.
- Do not change production Vercel/Railway settings, secrets, database files, or deployment state from this work.
- Do not introduce persistent storage for user content until the product's retention, deletion, and privacy behavior is explicitly defined.
- A green CI run is necessary but not sufficient: real two-client, reconnect, and mobile-device checks remain separate gates.
- Never describe a demo as live encryption or a simulated feature as real multiplayer.

## Current verified baseline

### Existing work awaiting owner review

- PR #13 (`fix/message-delivery-acknowledgements`) adds acknowledgement-aware public/private text sends and safer offline queue draining. It is one commit ahead of `main`; manual two-client and lost-ack tests are still required. A lost acknowledgement can still create duplicate delivery on a later retry because a client-generated idempotency key and server-side deduplication are not yet implemented.
- PR #14 (`fix/ai-bot-transparency`) is stacked on PR #13. It makes AI participants disclose their nature and clarifies that the Trust Center WebCrypto example is a demo, not encryption of live ANON messages. Merge order must be #13, then #14.
- An older privacy-foundation branch (`anon-privacy-foundation-2026-10`) contains a much broader 35-file change set, but its history is divergent from current `main` (155 commits ahead and 40 behind at review). It must not be merged wholesale or treated as a clean patch. Its useful changes require file-by-file review and selective porting.

### Backend findings verified on current main

- A stable anonymous `profileId` is derived from the browser-held profile token when present. The current block feature instead keys `session.blocked` by transient `sessionId`, so blocks do not naturally survive a reconnect.
- SQLite already has a `blocks` table, but the current `db.js` exports no block save/load/delete operations. The table is not currently wired into the block handlers.
- Reports are written through `db.saveReport`; moderation strike records are loaded from SQLite at startup and saved/removed through database helpers. These are materially different from the transient block map.
- Public history, rooms, invites, DMs, confessions, votes, reactions, and message ownership are in-memory with bounded/TTL behavior. Do not make them persistent by default: that would change privacy and retention semantics.
- Current `main` bot prompt still tells bots to conceal that they are AI and filters out direct AI disclosures. PR #14 contains the correction, but this trust issue remains in production until the ordered PRs are reviewed and merged.
- The standalone `/confession` page explicitly labels itself a local-only 24-hour preview, while the integrated Confession tab uses the shared backend feed. The distinction is disclosed in page copy, but the two experiences still need end-to-end product and mobile QA.
- The current `/borderland` implementation uses local React state and hardcoded simulated bot players; it is not real multiplayer. Do not market it as a live multiplayer experience until a real server-backed implementation exists.
- Current `main` bot prompt still tells bots to conceal that they are AI and filters out direct AI disclosures. PR #14 contains the correction, but this trust issue remains in production until the ordered PRs are reviewed and merged.
- The standalone `/confession` page explicitly labels itself a local-only 24-hour preview, while the integrated Confession tab uses the shared backend feed. The distinction is disclosed in page copy, but the two experiences still need end-to-end product and mobile QA.
- The current `/borderland` implementation uses local React state and hardcoded simulated bot players; it is not real multiplayer. Do not market it as a live multiplayer experience until a real server-backed implementation exists.
- `/api/stats` checks for `db.countAll`, but the current database module exports `getStats` and does not export `countAll`. The `persistent_rows` field therefore falls back to zero. Confirm the intended API contract before fixing it.
- Current main has persistent session metadata logging with a 180-day purge. The older privacy branch changes this to opt-in; that is a policy-sensitive change and needs explicit deployment/operator review before adoption.

## Phase execution

| Phase | Scope | Status | Exit gate |
|---|---|---|---|
| 0 | Baseline, branch isolation, inventory, change-control | In progress; this ledger records verified findings | Confirm current production deployment/repository SHA and capture baseline test results |
| 1 | Message acknowledgements, queue correctness, reconnect and duplicate handling | Partial: PR #13 | Add idempotency/deduplication; test accept/reject/timeout/late-ack/offline/reconnect with two clients |
| 2 | Blocks, reports, strikes, data lifecycle, export/deletion boundaries | Audit findings recorded; implementation not complete | Stable identity semantics; block persistence tests; admin report/strike lifecycle tests; documented retention policy |
| 3 | Mobile layout and interaction audit | Not yet device-verified | Test 320/360/390/430 px and tablet widths; navigation/profile containment; keyboard, overflow, dialogs, touch targets |
| 4 | Bot transparency, Trust Center claims, security and feature-truth audit | Partial: PR #14 covers bot disclosure and encryption-demo wording | Review CORS/admin/rate limits/input validation; verify Borderland capability; verify confession experiences; two-client security regression suite |

## Phase 2 design constraints

For block persistence, use the stable profile identity as the durable key only when the browser supplies a valid profile token. Keep transient session IDs for live socket routing. Preserve the existing block/unblock event contract during migration where possible, and return both stable identity and current online session identity only where needed by the UI. Add tests for reconnect, offline targets, unblock, mutual blocking, room messages, DMs, invitations, and legacy session-only records. Do not store raw profile tokens.

For reports and strikes, retain existing database-backed behavior and verify the admin read/review path before changing it. Do not delete unreviewed reports or active sanctions. Retention periods must be explicit and tested against active/unreviewed records.

## Phase 3 verification matrix

Run visual and interaction checks at 320, 360, 390, 430, 768, and 1024 CSS pixels. Check every primary tab, profile/avatar surfaces, chat composer, online/member lists, modals, room controls, confession, Trust, Borderland, and data/privacy screens. Verify no horizontal page overflow, no header/profile escape from its container, no hidden primary actions, and no unusably small touch targets. Automated build/lint cannot replace real-device verification.

## Phase 4 security and trust checklist

- AI participants are visibly disclosed and never instructed to impersonate humans.
- Encryption language accurately distinguishes HTTPS transport, local encrypted export, demo cryptography, and genuine end-to-end encryption.
- Verify production CORS allowlists, admin token handling, proxy trust, request-size limits, rate limits, and authorization on every administrative/destructive event.
- Verify all untrusted text and image payload boundaries.
- Verify privacy controls state what is local versus server-side and what cannot be deleted from the browser.
- Confirm Borderland's actual implementation before presenting it as multiplayer.
- Resolve the two confession experiences' different storage/expiry behavior or label their distinction clearly.

## Current non-goals

No live end-to-end encryption implementation, no broad persistence of anonymous chat content, no infrastructure migration, no dependency upgrade, no redesign of the black/crimson visual identity, and no feature removal is authorized by this ledger.

## Completion standard

A phase is complete only when its implementation is reviewed, automated tests pass, relevant manual checks are recorded, known limitations are documented, and the owner approves the pull request. A draft PR or a passing build alone does not satisfy completion.
