# ANON — Phase 0–4 hardening ledger

Last reviewed: 2026-11-06

## Change-control and release rules

- Keep `main` unchanged until the owner explicitly approves the reviewed PR stack.
- Keep work on isolated branches; do not merge or deploy automatically.
- Preserve existing routes, features, data, and visual identity. No silent feature removal.
- Do not alter production Vercel/Railway settings, secrets, database files, or deployment state.
- Do not persist anonymous chat content without an explicit retention, deletion, and privacy design.
- CI is necessary, not sufficient. Live two-client, reconnect, and real-device checks remain release gates.
- Never describe a demo as live encryption or simulated players as real multiplayer.

## Current work prepared for review

These are draft, unmerged PRs. They are not live in production. The PRs are stacked; review and merge in dependency order, not by number alone.

| PR | Scope | Current result |
|---|---|---|
| #13 | Chat acknowledgements and offline queue handling | Adds pending/failed/uncertain delivery states and ack-aware queue draining |
| #14 | AI bot transparency and encryption-demo wording | Removes bot impersonation instructions; labels bots; clarifies demo-only crypto |
| #15 | This phase ledger | Baseline and completion gates |
| #16 | Public persistent-row statistics | Uses the existing database stats API instead of nonexistent `countAll` |
| #17 | Persistent profile blocking | Stores stable profile-to-profile blocks and restores them on reconnect |
| #18 | Report delivery acknowledgement | Reports are acknowledged only after SQLite save succeeds |
| #19 | Message idempotency | Public and room text retries reuse the original message ID and do not rebroadcast duplicates |
| #20 | AI provider and CSP transparency | Discloses external AI-provider message processing; corrects the CSP status |
| #21 | Local data wipe scope | Explains that wipe clears this browser/device, not server-side reports, blocks, or logs |
| #22 | Admin review persistence | Reports failed review writes and clarifies that current review labels do not enforce a live warning or shadow-ban |
| #23 | Updated phase ledger | Records current findings, risks, and outstanding exit gates |

## Verified architecture and risk findings

### Chat and delivery

- Socket.IO delivery is not automatically exactly-once. PR #13 adds acknowledgement-aware sending; PR #19 adds a client message ID and bounded, expiring server-side deduplication for public and private-room text messages.
- Idempotency records are in-memory, scoped by stable profile identity and destination, bounded to 20,000 entries, and expire after 24 hours. They protect retries while the server process is alive; they do not make chat history durable across server restarts.
- The offline queue now sends its stored item ID as the idempotency key. Integration coverage includes retry, conflicting payload rejection, slow-mode retry, and retry after reconnect.
- Real browser-to-browser tests for delayed/lost acknowledgements and offline recovery remain required.

### Identity and blocking

- The browser-held profile token is hashed server-side; the raw token is not persisted or exposed.
- PR #17 uses stable profile IDs for persistent blocks while retaining transient session IDs for live routing.
- The server resolves the target session and derives its profile ID; it does not trust a client-supplied target profile ID.
- Profile-based blocks load from the existing SQLite table on reconnect. Offline blocked users can still be unblocked.
- If a client cannot provide a stable profile token, its block is session-only and the UI discloses that limitation.
- AI bot participants receive deterministic profile IDs so existing block behavior remains compatible with bot users.
- The block regression test covers an offline target, reconnect, unblock, and bot participant compatibility.

### Reports, strikes, and administration

- Strike records are loaded from SQLite at startup and saved/removed through the existing database helpers.
- PR #18 makes report submission fail visibly if the SQLite insert fails; the client waits for the server acknowledgement.
- The admin report list reads persisted reports. PR #22 makes review updates return a real database outcome and makes the dashboard surface failures.
- Important limitation: the current admin review labels record an administrator decision only. They do not apply an actual live warning or profile-level shadow-ban. The UI now says so rather than implying enforcement.
- A retention policy for reports and persistent blocks still needs an explicit product/operator decision. Do not invent or silently add a retention period.

### Data and privacy

- Public history, rooms, invites, DMs, confessions, votes, reactions, and message ownership remain in-memory with their existing bounded/TTL behavior. They have not been made durable by this work.
- Connection metadata is stored with a 180-day purge. This is a current implementation detail, not a claim of legal compliance.
- The data page scans localStorage and clears browser-local stores, IndexedDB message data, ANON cache entries, and the service-worker registration. It does not delete server-side reports, blocks, or connection logs. PR #21 makes this boundary explicit.
- The Trust Center now discloses that AI-generated replies may send the latest relevant public-chat or bot-room message to Pollinations, with OpenRouter as a fallback when configured. Operators can disable bot activity with `ENABLE_BOTS=false`.
- The WebCrypto card remains a browser-only demonstration; it is not live end-to-end encryption.
- The backend currently sends `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy`. A Content-Security-Policy is not configured. Do not mark CSP complete until a compatible policy is implemented and tested.

### Product capability truth

- The standalone `/confession` page is a local-only preview with a different expiry behavior from the shared Confession tab. The distinction is disclosed but still needs product/UX validation.
- `/borderland` remains a local React simulation with hardcoded simulated bot players; it is not real multiplayer.
- AI participants are visibly labeled and instructed not to claim to be human.

### Mobile UI code audit

- The main stylesheet is approximately 5,500 lines, contains 41 media-query blocks, and has a large number of `!important` declarations and layered responsive overrides.
- The final responsive layer explicitly defines mobile/tablet header containment, profile capsule sizing, three-column app navigation, single-column private/content layouts, and composer sizing.
- These rules should not be broadly consolidated without visual regression testing. The stylesheet is layered; deleting earlier overrides by static inspection risks reintroducing the header/profile escape issue.
- No real-device screenshot or browser-viewport interaction test has been completed in this work.

## Phase execution and exit gates

| Phase | Status | Verified progress | Remaining exit gates |
|---|---|---|---|
| 0 — Foundation | Partial | Baseline ledger, isolated branches, scoped PRs, no production changes | Confirm deployed production SHA and capture an actual production baseline |
| 1 — Reliability | Implementation prepared; manual QA pending | Acknowledgements, queue handling, idempotency, duplicate/conflict tests, reconnect tests | Two real clients; delayed/lost ack; queue recovery; room/DM regression; server restart behavior |
| 2 — Data and privacy | Partial | Stable profile blocks, report persistence acknowledgements, admin review persistence, local/server deletion boundaries | Explicit report/block retention policy; full export/deletion review; admin enforcement design; production DB backup/restore test |
| 3 — Mobile experience | Code audit only | Responsive CSS layers and main header/profile rules inspected | Real visual/interaction checks at 320, 360, 390, 430, 768, and 1024 CSS px across all routes; keyboard, overflow, dialogs, touch targets |
| 4 — Security and trust | Partial | Bot transparency, provider disclosure, demo encryption wording, CSP status corrected, CORS/admin/rate-limit code inspected | CSP implementation and compatibility tests; full authorization/input validation audit; actual moderation enforcement design; confession and Borderland capability decisions |

## Phase 3 device verification matrix

Test Chat, Private, Content, Confession, Trust, Borderland, Data, profile/avatar surfaces, room member lists, DMs, modals, and keyboard interactions at:

- 320 × 700
- 360 × 800
- 390 × 844
- 430 × 932
- 768 × 1024
- 1024 × 768

Record screenshots and verify no horizontal page overflow, header/profile escape, clipped primary actions, unusable composer, obscured dialogs, keyboard overlap, or undersized touch targets. Automated lint/build is not a substitute for this gate.

## Current non-goals

No live end-to-end encryption, no broad persistence of anonymous message content, no infrastructure migration, no dependency upgrade, no redesign of the black/crimson identity, and no removal of existing features.

## Completion standard

A phase is complete only when the implementation is reviewed, automated tests pass, relevant manual checks are recorded, known limitations are documented, and the owner approves the PR. Draft PRs and green builds alone do not satisfy completion. Production deployment requires separate approval.
