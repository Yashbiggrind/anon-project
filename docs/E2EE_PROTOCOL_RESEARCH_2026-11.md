# ANON E2EE Protocol Research — 2026-11-03

**Status:** Research and spike recommendation only. No production protocol has been selected or approved.
**Repository branch reviewed:** `anon-privacy-foundation-2026-10`
**Related decision:** [ADR-001: Architecture decision required before live E2EE](ADR-001-e2ee-architecture.md)

## Executive decision

Do not implement a custom encryption protocol and do not add an E2EE badge yet.

**Recommended next experiment: a disposable two-client Matrix SDK proof of concept.** Matrix is the strongest first candidate to test because its maintained JavaScript SDK already integrates a Rust-based browser crypto implementation through WebAssembly and manages Matrix messaging, device state and room synchronization. This is not a drop-in encryption library for ANON's current Socket.IO events. It would require evaluating a Matrix homeserver and a migration/bridge boundary.

Keep the decision open until the proof of concept demonstrates that it can preserve ANON's low-friction pseudonymous onboarding, room behaviour, device verification, recovery and operational cost.

## Candidate assessment

### A. Matrix protocol + matrix-js-sdk + self-hosted Synapse

**Why it is the first POC candidate**

- The official `matrix-js-sdk` is a JavaScript/TypeScript client SDK for browsers and Node.js.
- Its E2EE implementation uses WebAssembly bindings to the Rust `matrix-sdk-crypto` implementation. The SDK documents `initRustCrypto()` and a browser IndexedDB crypto store.
- The SDK is a complete Matrix Client-Server client: authentication, sync, room state and E2EE. This reduces how much of the messaging protocol ANON would have to invent and maintain.
- The package is actively released; exact stable version, Node/browser compatibility, advisories and lockfile must be checked and pinned during the spike.

**Main compatibility cost**

Matrix is an application protocol and homeserver architecture, not an encrypt/decrypt wrapper around the current Socket.IO relay. A real migration needs Matrix room membership, device identities, event sync, encrypted media, local crypto storage, account lifecycle and server operations. The existing Socket.IO app can remain for public chat during a staged experiment, but private DMs/rooms would need an explicit protocol boundary.

**Pseudonymous onboarding**

Do not build the product around Matrix.org guest accounts. Matrix.org announced disabling guest accounts; guest accounts are a legacy, limited feature and are not a reliable general-purpose onboarding contract.

For a self-hosted Synapse experiment, compare:
1. short-lived, server-provisioned standard Matrix accounts with random pseudonymous IDs and strong random credentials; and
2. guest access only if its room limitations and client support satisfy the required product flow.

Synapse documents that guest accounts require guest access to be enabled and are limited to rooms accessible to anonymous users. It also warns that public registration without verification creates a spam vector. If a server-side provisioning API is tested, keep its shared secret exclusively on the backend, never in the browser, and rate-limit account issuance. This is a design hypothesis, not an approved production identity model.

**Privacy trade-off**

A self-hosted homeserver gives ANON control over the service, but does not make metadata disappear. The homeserver can still observe network/IP information, account/device identifiers, room membership and event timing. Matrix E2EE can protect message content from the homeserver; it does not make users uncorrelatable or hide every piece of metadata.

### B. MLS (RFC 9420) + OpenMLS on the existing relay

**Why it is interesting**

RFC 9420 is an IETF Standards Track protocol for asynchronous group key establishment with forward secrecy and post-compromise security, intended for groups from two to thousands of clients. It is conceptually relevant to ANON's private rooms.

**Why it is not the immediate implementation choice**

MLS is a protocol building block, not a complete chat service. RFC 9420 assumes an Authentication Service and a Delivery Service. ANON would still need to build and test credential authentication, key-package publication, group creation/join, membership changes, persistence, event ordering, device verification, recovery, encrypted attachments and all client lifecycle behaviour.

The official OpenMLS repository currently lists `wasm32-unknown-unknown` as **unsupported, but built on CI (not tested)**. That is not enough confidence for a production browser chat. Do not select OpenMLS for production until the browser target is officially supported or a separately maintained, independently reviewed browser implementation is identified and validated.

MLS also does not hide all group metadata. RFC 9420 describes observable fields that can reveal group IDs, epoch changes, message frequency and group membership, depending on delivery-service design.

### C. Signal libsignal

Do not choose the public `libsignal` repository as ANON's drop-in library. Signal's own README says use outside Signal is unsupported and that APIs/implementations can change without notice. Do not depend on an unsupported integration for a privacy-critical production feature.

## Comparison

| Criterion | Matrix JS SDK + homeserver | MLS + OpenMLS | Signal libsignal |
|---|---|---|---|
| Browser E2EE foundation | Existing Rust/WASM integration documented by SDK | OpenMLS WASM target is built but not tested | TypeScript wrapper exists, but external use unsupported |
| DMs and group rooms | Existing Matrix protocol and room model | MLS covers group key establishment; application services still required | Protocol components, but no supported ANON integration contract |
| Fit with current Socket.IO server | Low; major protocol integration | Conceptually higher, but substantial application protocol work | Not recommended |
| Pseudonymous onboarding | Needs a self-hosted account-lifecycle design | ANON must design authentication/credentials | Not recommended |
| Key/device verification | Matrix device and cross-signing model to validate in POC | Application must supply authentication and verification UX | Unsupported external use |
| Recommendation | **First POC candidate; not yet selected** | Revisit when browser implementation is test-supported | Reject for this project |

## Required two-client proof of concept

Create a separate branch or isolated demo. Do not change the live message transport while researching.

### Stage 1 — Environment and basic encrypted room

- Run a disposable self-hosted Matrix homeserver with a supported database and documented backup/retention settings.
- Create two independent browser profiles/devices with separate pseudonymous identities.
- Initialize the SDK crypto store in IndexedDB and verify only one active client instance uses a given crypto database.
- Create/join a private room and exchange messages in both directions.
- Inspect homeserver events, application logs and network payloads: message bodies must be ciphertext, not readable text.
- Confirm the SDK's key/device verification flow can be completed by two ordinary users without exposing real-world identity details.

### Stage 2 — Lifecycle and hostile cases

- Reject or visibly warn on unverified/new device keys; show key-change notices.
- Add/remove a room member and verify the previous member cannot decrypt messages sent after removal.
- Test wrong-key, tampering, replay, duplicate delivery, out-of-order events, offline reconnect and browser reload.
- Test a second device and recovery/backup. Document what is lost when browser data is cleared.
- Test encrypted image/file upload, thumbnail/preview generation, download and cache behaviour.
- Verify that push notifications, analytics, error logs, crash reports, exports and local message history do not accidentally expose plaintext.
- Verify that the server cannot decrypt test messages, while a participant can.
- Record timing, room membership, IP and other metadata still visible to the homeserver.

### Stage 3 — Product and operational fit

- Confirm account issuance does not require email or phone number and cannot be abused as an unbounded anonymous-account endpoint.
- Measure initial bundle size, crypto initialization time, memory use and performance on lower-end phones/laptops.
- Test room creation/invites, reconnect and the ANON UI against the current three-door navigation and profile flow.
- Cost and operate the homeserver, database, media storage, upgrades, monitoring, incident response and backups.
- Have the architecture and threat model reviewed by an application-cryptography specialist before any migration or security claim.

## ANON-specific migration boundary

- Keep public chat explicitly labelled as public and plaintext unless it receives a separate, deliberate security design.
- Do not send private plaintext into the existing Socket.IO server, bot providers, moderation queues, analytics, logs or crash reporting.
- Do not allow current AI bots to read encrypted private rooms. A future AI integration requires a separate, explicit user-consent design and must clearly state what is decrypted and where it is sent.
- Treat encrypted DMs and private rooms as a staged migration only after the POC passes. Do not silently mix encrypted and plaintext messages in the same UI.
- Attachments, reply previews, search, notifications, exports, local history, deletion/expiry and abuse reports are part of the encryption boundary; encrypting only the text body is insufficient.
- E2EE does not hide IP addresses, room membership, message timing or all traffic patterns; it cannot stop screenshots or recipients copying content.
- Preserve blocking, reporting, safety escalation and age-appropriate abuse protections. Redesign reports so users consciously choose what content to disclose; do not silently decrypt private messages for moderators.

## Recommended work order

1. Keep PR #12 draft-only while functional review and operator-side deployment checks remain open.
2. Fix and verify the actual Railway backend deployment separately from the protocol experiment.
3. Implement the disposable Matrix SDK two-client spike and publish its test results.
4. Make a documented protocol decision only after the spike and independent review.
5. Separately design the accountless server-side data request/deletion workflow and verify backup retention.
6. Only then plan a staged migration of DMs and private rooms.

## Sources reviewed (2026-11-03)

- Matrix JavaScript SDK README: https://github.com/matrix-org/matrix-js-sdk
- Matrix JavaScript SDK releases: https://github.com/matrix-org/matrix-js-sdk/releases
- Matrix JavaScript SDK package record: https://www.npmjs.com/package/matrix-js-sdk
- Matrix.org authentication/guest account announcement: https://matrix.org/blog/2025/01/06/authentication-changes/
- Synapse configuration reference (registration and guest access): https://github.com/matrix-org/synapse/blob/develop/docs/usage/configuration/config_documentation.md
- Matrix security/privacy overview: https://matrixdocs.github.io/docs/security/overview
- IETF RFC 9420: https://www.rfc-editor.org/rfc/rfc9420
- OpenMLS supported-platform matrix: https://github.com/openmls/openmls
- Signal libsignal support statement: https://github.com/signalapp/libsignal

## Release status

**No live E2EE is implemented or approved by this research note.** This document records an evidence-based next experiment, not a security certification, completed implementation or permission to advertise ANON as end-to-end encrypted.
