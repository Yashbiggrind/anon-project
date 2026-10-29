# ANON Threat Model (Initial Engineering Draft)

**Status:** Draft; not an independent audit  
**Reviewed code snapshot:** `anon-privacy-foundation-2026-10` draft branch on 2026-10-29  
**Scope:** Next.js browser client, Socket.IO/Express backend, SQLite-backed operational records, future AI integrations  
**Security claim status:** Live end-to-end encryption is **not established** by the inspected code.

## 1. Goals

1. Keep private message content unreadable to the server and hosting operators when E2EE is eventually implemented.
2. Avoid permanent cross-room identity correlation by default.
3. Minimise retained metadata and explain any necessary collection.
4. Preserve abuse prevention without silently turning anti-abuse signals into universal identity trackers.
5. Make security claims accurately reflect deployed and tested behaviour.

## 2. Current source observations

- The inspected `anon-server/index.js` public chat handler receives `content` in readable form and places it in a server-side message object.
- The direct-message helper serialises a message's `content` for recipients. The separate WebCrypto sample in the Trust page is not connected to these live message paths.
- The baseline main branch stores an HMAC-derived IP hash, session ID, connection/disconnection times and a shortened user-agent in a session table. This draft branch makes that persistent session log opt-in (`ANON_SESSION_LOGS=on`); with the default off, startup clears existing session rows from the active database and new session rows are not written. This does not remove external backups, hosting logs or anti-abuse strike records. When explicitly enabled, a 180-day purge setting applies.
- SQLite persists moderation reports and spam-strike records. This draft branch expires reviewed reports after 90 days and inactive strikes after 30 days once cooldown and shadow-ban deadlines have elapsed; unreviewed reports and active sanctions are retained. See `docs/DATA_FOOTPRINT_AUDIT.md` for the inventory and limitations.
- The client stores recent public/room messages in IndexedDB by default with a 24-hour content TTL. The draft branch adds Ephemeral History to clear this local message cache and offline queue and skip subsequent local message saves; this does not affect server-side handling or recipient copies.
- Session names are pseudonymous, but a no-login model alone does not guarantee network anonymity or message confidentiality.
- Private-room events in this draft branch use room-scoped aliases and opaque random member tokens instead of exposing global session IDs to room members. The server retains the mapping in ephemeral room memory so authorization and moderation can work. A departed member's alias may remain cached until the room object is removed; the maps are discarded when that room ends or is deleted. If an unexpected name cannot be mapped, room-system events now fail closed to a generic label rather than falling back to the global username. This reduces direct identifier reuse across rooms but does not prevent traffic/timing correlation, does not conceal server-side identity mapping while the room exists, and does not encrypt message content.
- Room invitations are kept in memory and expire after 10 minutes; accepting, declining or disconnecting removes them sooner. Invitee aliases/tokens are not minted for room-membership notices before the recipient joins.
- The draft branch adds a browser-only sensitive-text preflight (pattern-based) and a Quick Veil UI. These are client-side convenience safeguards, not a substitute for E2EE, and they can miss data or produce false positives.
- The browser-only preflight now also covers live Confession Wall posts and replies, in addition to public/room messages, DMs, edits, and image captions. It still does not inspect image pixels, and detection is heuristic. The first-visit note, Trust Layer labels, local-data preview UX and legal/privacy wording were updated during the 2026-10-29 source review.
- AI bot accounts are labelled with an `AI ·` prefix. External generation is disabled by default; when enabled, provider calls are limited to static bot-initiated openers. Bot replies to user messages use local scripted responses, and user-authored messages/custom room topics are not forwarded by the current bot code path. Static prompts still leave ANON when the operator enables external generation.
- Quick Veil visually covers the app and mutes app-managed sound, but it does not disconnect the socket, stop background messages, block operating-system notifications, or defend against external screen capture.

These are source-level observations. They do not verify current production behaviour, infrastructure logs, browser storage, backups or configuration.

## 3. Assets

- Private message plaintext and attachments
- Encryption keys, recovery material and device identities
- Room membership, contact relationships and timing metadata
- User reports, blocks and moderation records
- Confession submissions, replies and voting history
- AI prompts/context sent to external model providers
- Administrative credentials and deployment secrets

## 4. Adversaries and risks

| Threat | Risk | Required mitigation |
|---|---|---|
| Malicious or compromised server operator | Reads private message content before E2EE | Client-side encryption; reviewed protocol; ciphertext-only relay tests |
| Network observer or hostile Wi-Fi | Traffic analysis or IP exposure | HTTPS/WSS, metadata minimisation; consider optional Tor support; do not promise IP hiding without testing |
| Correlation across rooms | Pseudonyms, timing or persistent IDs link separate activities | Per-room aliases, minimum stable IDs, short retention and documented abuse trade-offs |
| Malicious group member | Screenshots, copying, impersonation, key-change attacks | Key verification, identity-change notifications, membership rotation, honest expiry messaging |
| Compromised browser / malicious extension | Reads plaintext while the client is open | Strong CSP/dependency hygiene; explain endpoint compromise limits; audited builds |
| AI provider or prompt logging | Message content leaves ANON's boundary | Explicit consent, minimal context, provider disclosure, retention controls, local inference where feasible |
| Spam, bots and harassment | Abuse against anonymous users | Rate limits, block/report, room controls, transparent moderation and privacy-preserving abuse design |
| Infrastructure/backup retention | Deleted records survive in logs or backups | Retention inventory, tested purge jobs, documented backup lifecycle and deletion receipts with limitations |

## 5. Proposed architecture boundaries

### Public spaces
Public posts should be labeled as public before sending. Server-side moderation may be needed, so do not imply the same confidentiality guarantee as private chats. Collect only the metadata required for safety and operation.

### Private chats and rooms
Use a maintained, reviewed E2EE protocol or library. Do not design a proprietary cipher. Keys should be generated and held on client devices; key agreement must authenticate peers; membership changes need key rotation. Never derive the only room secret from a short human-readable room code without a reviewed protocol. Server event handlers, logs, queues, crash reports and AI integrations must never receive decrypted content as part of normal transport.

### AI
Bots must be clearly marked. Give the model only the messages explicitly in scope; require affirmative consent before external providers receive content; disclose provider and retention settings. An on-device shield should remain local if advertised as local.

### Metadata and operations
Inventory IPs, session IDs, user-agent values, room IDs, timestamps, logs, reports, abuse hashes, analytics, CDN/WAF records and backups. Set a purpose and retention period for every field. Hashing an identifier does not automatically make it anonymous. Meet applicable legal obligations while avoiding unrelated permanent records.

### Browser-only convenience protections
The Local Privacy Guard scans new/edited message text and image captions in the client using a small set of patterns, shows category labels and offers user-reviewed substitutions. It does not send its findings to the server itself, but the message is sent normally if the user chooses to send it. It does not inspect image pixels and cannot detect every kind of sensitive information. Quick Veil is an on-screen shoulder-surfing aid; the chat connection remains active while veiled.

## 6. Release blockers before advertising E2EE

- [ ] Choose and document a maintained, independently reviewed protocol/library.
- [ ] Define identity keys, device keys, authentication and key-change behaviour.
- [ ] Implement encrypted send/receive for DMs and private rooms, including attachments.
- [ ] Confirm server, logs, queues and metrics see ciphertext rather than plaintext.
- [ ] Add test vectors, tampering tests, wrong-key tests, replay tests and room membership change tests.
- [ ] Review local history, notifications, exports and backups for plaintext exposure.
- [ ] Create key verification UI and safe recovery behaviour.
- [ ] Define moderation/report flows for encrypted content.
- [ ] Run dependency, threat-model and privacy review.
- [ ] Obtain independent security review before making broad public claims.
- [ ] Test the exact production build and hosting configuration.

## 7. Product roadmap after the security foundation

1. Privacy Control Room with clear source-based statuses and plain-language data flow.
2. Per-room aliases with carefully bounded abuse-prevention mechanisms.
3. Key verification, encrypted local storage/backups, and accurate expiry receipts.
4. On-device AI Privacy Shield.
5. Consent-based, conversation-scoped AI bots.
6. Optional anonymous interest matching and privacy-bounded reputation credentials.
7. Public threat model, release verification, security contact and responsible-disclosure process.

## 8. Out of scope / limitations

E2EE does not hide all metadata by itself, and cannot stop recipients from taking screenshots or copying content. A compromised endpoint can reveal plaintext. Tor support, if added, needs separate threat modelling and deployment testing. No single dashboard or test suite can prove absolute anonymity.
