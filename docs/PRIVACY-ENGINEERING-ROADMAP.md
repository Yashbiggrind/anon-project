# ANON Privacy Engineering Roadmap

This roadmap records planned work. A box checked in documentation is not proof that a feature is implemented or secure.

## P0 — Security truth and auditability

- [x] Correct Trust page copy so a local WebCrypto sample is not presented as live E2EE.
- [x] Add Privacy Control Room showing source-review findings and uncertainty.
- [x] Add an initial threat model and explicit E2EE release gates.
- [ ] Verify the exact deployed production commit and environment.
- [ ] Finish auditing all Socket.IO event handlers, message store, edit/delete flows, attachments, notifications, telemetry and crash logs.
- [x] Add a source-level UI audit in `docs/UX_AUDIT_2026-10.md` and improve typography, responsive navigation, focus states and reduced-motion support across the main experience.
- [ ] Inventory infrastructure logs, backups, database copies and AI-provider data flows.

## P1 — Real private-message encryption

- [x] Document the E2EE architecture decision gates and Matrix-vs-custom-relay trade-off in `docs/ADR-001-e2ee-architecture.md`; no protocol is selected yet.
- [ ] Choose a maintained, reviewed E2EE protocol/library after a current compatibility/security review.
- [ ] Define peer/device identity keys, authenticated key agreement, key-change events and room membership transitions.
- [ ] Encrypt DMs and private-room payloads client-side; server relays ciphertext only.
- [ ] Encrypt attachments and ensure thumbnails/previews do not leak plaintext.
- [ ] Add cryptographic test vectors, wrong-key/tamper/replay tests, membership-rotation tests and cross-device tests.
- [ ] Review browser local history, notification contents, exports and backup flows.
- [ ] Independent security review before public E2EE claims.

## P1 — Minimise metadata and improve user controls

- [x] Make persistent connection/session logging opt-in (`ANON_SESSION_LOGS=on`); clear active-database session rows when disabled by default.
- [x] Document the purpose and source-observed retention of stored fields in `docs/DATA_FOOTPRINT_AUDIT.md`, including reports, strikes and IP-derived abuse keys; deployment/provider retention remains to be verified.
- [x] Add application-level purge rules for reviewed reports (90 days) and inactive/expired strikes (30 days), with regression tests.
- [ ] Verify scheduled purge execution in production and document backup/hosting-provider retention separately.
- [ ] Restrict moderator access and log access to sensitive operational records.
- [x] Add a browser-local data bundle export for localStorage, retained IndexedDB messages and the offline queue, with warnings about sensitive contents and its local-only scope.
- [ ] Add an accountless server-side data request/deletion workflow with a plain-language explanation of unavoidable legal/security retention.
- [ ] Ensure deletion controls cover all relevant persistence layers and return receipts that do not overpromise.
- [x] Use ephemeral room-scoped aliases and opaque member tokens in private-room event payloads; remaining timing/network correlation and server-side mapping still need review.
- [x] Apply the same room-local alias rule to reply metadata and add a Socket.IO regression test against global-name leakage.
- [x] Expire unanswered invitations after 10 minutes and avoid generating room aliases/tokens for non-member invitees.

## P2 — Privacy experience

- [x] Add Ephemeral History mode that clears IndexedDB chat history and offline queue, then skips later local message history saves.
- [x] Add browser-only Local Privacy Guard with heuristic detection and editable redactions across public/room chat, DMs, edits, image captions, and live Confession posts/replies (image pixels are not inspected).
- [x] Add Quick Veil to cover the app screen and mute app sound; document that the network session remains active.
- [ ] Add key fingerprints / verification codes and key-change warnings.
- [ ] Add encrypted local storage and user-controlled encrypted backups after careful recovery design.
- [ ] Make expiry semantics explicit; explain screenshot and recipient-copy limits.
- [ ] Redesign reports and moderation to preserve E2EE while limiting abuse.
- [ ] Optional Tor/onion availability after threat modelling, operational testing and safety review.

## P2 — AI with explicit privacy boundaries

- [x] Clearly label current AI bot accounts and stop instructing them to impersonate humans.
- [x] Disable external model calls by default; when explicitly enabled, use only static bot-initiated opener prompts and never forward user-written messages/custom room topics through this bot path.
- [x] Clearly identify AI participants with the `AI ·` prefix in server-side public/room identities and document provider controls.
- [ ] Obtain explicit consent before sending message content to an external AI provider.
- [ ] Send only the selected conversation/context; never include hidden IDs or unrelated rooms by default.
- [ ] Disclose provider retention and data handling.
- [ ] Explore an on-device Privacy Shield; do not send content off-device if advertised as local.
- [ ] Test prompt injection, unsafe suggestions, hallucinated safety claims and model data leakage.

## P3 — Differentiators (experiments, not current capabilities)

- [x] Add per-room aliases and opaque member tokens to private-room events and controls; continue reviewing residual linkability risks.
- [ ] Privacy-bounded reputation credentials, potentially using zero-knowledge techniques after expert review.
- [ ] Anonymous interest matching with one-time matchmaking tokens.
- [ ] Local AI Privacy Shield.
- [ ] Privacy-bounded AI rooms/bots.
- [ ] Expiry receipts tied to real deletion operations.
- [ ] Public privacy evidence page, versioned threat model, release verification and responsible disclosure.

## Definition of done for any privacy feature

1. Code is integrated into the actual user-facing path, not just a demo.
2. Threat model and data flows are updated.
3. Tests cover success, failure, replay/tampering where relevant, and edge cases.
4. Privacy copy matches behaviour.
5. Production configuration and logs are checked.
6. Security-sensitive features receive independent review before high-assurance claims.
