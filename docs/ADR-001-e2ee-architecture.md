# ADR-001: Architecture decision required before live E2EE

- **Status:** Proposed investigation; no live E2EE implementation approved
- **Date:** 2026-10-28
- **Context:** ANON uses a custom Socket.IO/Express relay. Public chat, private-room messages and DMs currently reach server handlers as readable content.
- **Decision:** Do not add a home-grown cryptographic protocol or describe the app as E2EE. Run a bounded architecture spike and make a documented choice before changing live message transport.

## Requirements

1. Browser-first support compatible with the current Next.js app and modern browsers.
2. Authenticated peer/device identity and visible key-change detection, not encryption alone.
3. Private one-to-one chat plus group rooms, with membership-change handling and key rotation.
4. Ciphertext-only relay: no plaintext in backend handlers, logs, queues, reports, bot context, analytics or crash reporting by default.
5. Encrypted attachments, deliberate local-history handling, and honest expiry semantics.
6. Anonymous/pseudonymous onboarding without requiring users to publish a real-world identity.
7. Abuse reporting that is explicit about what a user chooses to disclose; server-side moderation must not silently receive decrypted private content.
8. Cross-device/recovery behaviour documented before users rely on it.
9. Automated test vectors for valid messages, wrong keys, tampering, replay, key changes, room membership changes and offline/reconnect scenarios.
10. Independent security review before public high-assurance claims.

## Candidate A — Adopt the Matrix client/server protocol and SDK

The official `matrix-js-sdk` repository documents browser and Node.js support and E2EE backed by WebAssembly bindings to the Rust Matrix crypto implementation. It initializes encryption via `initRustCrypto()`; the crypto store normally uses IndexedDB in browsers. The separate official `@matrix-org/matrix-sdk-crypto-wasm` project describes an OlmMachine that handles Matrix E2EE state.

Sources checked 2026-10-28:
- https://github.com/matrix-org/matrix-js-sdk
- https://matrix-org.github.io/matrix-sdk-crypto-wasm/

**Advantages:** an established protocol, existing implementations, and a defined model for rooms, devices, key management and verification.

**Cost / incompatibility:** this is not a drop-in encryption module for the current Socket.IO event handlers. ANON would need a Matrix homeserver/protocol integration, changes to room and message state, identity/device onboarding, event synchronization and storage design. Matrix servers and hosting may also add a different metadata and account model, which must be evaluated against ANON's anonymity goals.

## Candidate B — Keep the custom Socket.IO transport and integrate a maintained protocol/library

**Advantages:** preserves the current UX and low-friction pseudonymous session model.

**Cost / risk:** the engineering team must prove the library supports the needed browser runtime and group use case, then implement authenticated identity/key distribution, verification, membership rotation, recovery, attachments, delivery and storage semantics around it. A cryptographic primitive by itself is not a complete, reviewed messaging protocol. There is currently no approved library/protocol choice for this path.

## Required spike before choosing

- Create a disposable branch and a two-client browser proof of concept; do not migrate live messages or release it as secure.
- Compare current browser compatibility, maintenance status, licence, audit history, group protocol support, device verification UX, key recovery, IndexedDB behaviour and bundle/deployment constraints.
- Write a metadata threat model covering relay-visible room membership, timing, IP/network metadata and abuse reporting.
- Verify via tests that a test relay receives ciphertext only and cannot decrypt it without participant keys.
- Validate the choice with an experienced application-cryptography reviewer.

## Explicit non-goals

- No custom AES/key-exchange design assembled directly from WebCrypto primitives.
- No room secret derived solely from a human-readable room code.
- No assertion that ephemeral messages prevent screenshots or recipient copying.
- No E2EE badge, sales claim or reassurance wording until the exact live public/room/DM/attachment paths have passed review.

## Exit criteria

A named protocol/library is selected with a recorded rationale; the compatible deployment architecture is approved; a browser proof of concept passes the ciphertext-only and key-verification tests; and the threat model, migration plan and review owner are documented.
