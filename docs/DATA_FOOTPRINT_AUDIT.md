# ANON Data-Footprint Audit

**Status:** Source-level engineering inventory; not a legal opinion or independent security audit.  
**Reviewed branch:** `anon-privacy-foundation-2026-10`  
**Last checked:** 2026-10-29

This document separates confirmed repository behaviour from deployment details that cannot be verified from source. “Not found in this review” does not prove that a hosting provider, browser, proxy, monitoring tool or backup system retains nothing.

## Executive result

ANON currently provides pseudonymous access and local convenience controls, but **live chat is not end-to-end encrypted**. The server handles readable text for public chat, private rooms and direct messages. The app can store local chat history in IndexedDB unless Ephemeral History is enabled. Session metadata logging is opt-in at the application database layer. Reports and anti-spam strikes are durable safety records, now subject to bounded retention when the record is resolved/inactive.

## Inventory by location

| Data | Location / path | Current lifetime or control | Privacy boundary |
|---|---|---|---|
| Public messages | Server in-memory `publicHistory` | TTL of about 24 hours and capped at 500 items; process restart clears it | Plaintext is visible to the server while handled; public content should be treated as public |
| Room messages | Server room state and Socket.IO event handlers | Room state and alias/member-token maps are in process memory and are discarded with the room/process | Private-room event payloads now use a room-specific alias and opaque room member token, not the global session ID. The server still keeps the mapping while the room exists and sees plaintext content; this is not E2EE and does not hide timing/network metadata. |
| Direct messages | In-memory `dmThreads` | Threads expire after about 1 hour idle; per-thread message count capped at 200 | Not E2EE; server receives readable content |
| Message ownership metadata | In-memory `messageOwners` | Around 24 hours | Server-side session/message relationship exists during the TTL |
| Confessions and replies | In-memory server map | Posts expire after 7 days; post count capped at 500; reply count capped at 50 | Content is visible to the server and the confession audience |
| Reactions | In-memory maps | About 1 hour | Interaction metadata exists transiently |
| Room invitations | In-memory `invites` map | Expire after 10 minutes; removed on accept, decline, or participant disconnect | Sender identity is room-scoped in room notices; non-member invitees are not assigned a room alias/token until they join |
| Session metadata | SQLite `sessions_log` | Off unless `ANON_SESSION_LOGS=on`; when on, configured code purges records older than 180 days | Uses keyed IP HMAC plus session ID, times, and shortened user-agent; HMAC identifiers can still be linkable |
| Moderation reports | SQLite `reports` plus an in-memory recent list | New retention policy deletes **reviewed** rows older than 90 days; unreviewed rows are deliberately preserved pending review | Report reason and target/reporter references may be sensitive; moderator access must be restricted |
| Anti-spam strikes | SQLite `strikes` plus in-memory strike map | New policy deletes entries older than 30 days only if cooldown and shadow-ban expiry times have passed | Internal spam identifiers remain pseudonymous/hashed, not automatically anonymous |
| Block relationships | SQLite `blocks` | No automatic expiry was identified in this review | Relationship metadata; retention/deletion policy still needs explicit design |
| Browser message history | IndexedDB via app message store | Normally local and time-limited; Ephemeral History clears it and skips subsequent saves while enabled | Does not remove recipient copies or server handling; selected image uploads are re-encoded locally to JPEG through canvas, stripping common embedded metadata while possibly losing transparency/animation; image pixels are not scanned by the text guard |
| Local export files | Downloaded JSON bundle | Plain bundle is readable; optional encrypted export uses browser WebCrypto AES-GCM with a PBKDF2-SHA-256-derived 256-bit key (600,000 iterations), random salt and IV | Passphrase never sent to ANON and is not recoverable if forgotten. Decryption produces a readable local JSON file. This does not protect live chats or server-held data. Treat exported files as sensitive. |
| Local Privacy Guard findings | In-browser only, during send/review interactions | Not persisted by the guard or sent as separate telemetry; text is sent normally only if the user proceeds | Covers public/room chat, DMs, edits, image captions, and live Confession posts/replies; heuristic only and image pixels are not scanned |
| Browser offline queue | Client-side queue | Cleared when Ephemeral History is enabled; sending while offline in ephemeral mode is blocked rather than queued | Other browser profiles/devices are unaffected |
| Local privacy settings | `localStorage` / browser storage | Local Privacy Guard and Ephemeral History preferences may persist in the browser | Clearing in-app storage does not erase browser-level history, synced profiles, OS backups or screenshots |
| AI/bot requests | `anon-server/bots.js` | External model generation is off unless `ENABLE_EXTERNAL_BOT_AI=on`; when enabled, only fixed bot-initiated opener prompts are forwarded. Replies to user messages use local scripted responses. User-written text and custom room topics are not included in provider requests by this code path. | Bot identities are visibly labelled `AI ·`. External providers still receive static prompts when explicitly enabled; provider logs/retention and outbound network metadata need operator review. Do not add user-context forwarding without explicit, per-user consent. |
| Hosting / network metadata | CDN, deployment platform, WAF, reverse proxy, logs, crash reporting, backups | Not fully observable from this repository | Operator configuration and provider retention terms must be reviewed separately |

## New retention behaviour in this branch

- Every six hours, the server invokes the data-layer retention operation (also on the first timer tick after startup).
- Reports are deleted only when they are reviewed and older than 90 days; unresolved reports are retained so they are not silently discarded before moderation.
- Strikes are deleted only when the record is older than 30 days and both cooldown and shadow-ban deadlines have expired.
- Purge logs contain counts only, not report text or identifiers.
- Session logs remain opt-in. When disabled, connection-write methods return without writing; startup removes rows from the active SQLite `sessions_log` table.
- These rules do not erase files from old backups, provider-side logs, exported copies, SQLite copies held elsewhere, recipients’ devices, or browser/OS backups. Retention also does not replace an operator's legal obligations or a future user-facing deletion workflow.

## Release gates still open

1. **Live E2EE:** use a maintained protocol/library with authenticated key establishment, key-change notices, membership rotation, and ciphertext-only server relay tests. Do not invent a cipher.
2. **Complete write-path inventory:** verify message edits/deletes, images, confessions, exports, admin views, notifications, bot context and errors for unexpected content persistence.
3. **Provider and infrastructure inventory:** document deployment logs, CDN/WAF, hosting, database backup schedules, analytics/telemetry and model providers using actual configuration and terms.
4. **User data export/deletion:** specify which data is removable, which safety/legal records may remain, and the actual backup expiry window; provide a receipt that states limits accurately.
5. **Residual identity correlation:** room-scoped aliases and opaque member tokens are now implemented for private-room events. Review linkability from presence, timing, network metadata and a participant's own actions; the server still keeps a room-local mapping while the room exists.
6. **Tests and independent review:** run the exact deployable build; test retention, access control, tampering, rate limits and key lifecycle; obtain independent security review before stronger promises.

## Safe language for product copy

Use: “ANON supports pseudonymous conversations and includes local privacy controls. Live chats are not yet end-to-end encrypted; the server can process message content. Session logging is off by default in this branch, while limited safety records may remain under stated retention rules.”

Do not use: “completely anonymous”, “untraceable”, “zero data”, “server cannot read your messages”, “deleted everywhere”, or “fully encrypted” unless those exact claims are proven for the deployed build and every relevant data path.
