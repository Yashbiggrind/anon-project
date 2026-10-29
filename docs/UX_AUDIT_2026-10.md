# ANON UI review — October 2026

**Scope:** source-level top-to-bottom review of the primary Next.js routes and shared styles on `anon-privacy-foundation-2026-10`. This is not a screenshot-based usability study or a review of the live production deployment.

## Design direction

Keep ANON's black/crimson identity, editorial display headings, pixel avatars, and the three-door home experience. Those elements are distinctive. The aim is to make it feel more professional by improving hierarchy, readability, mobile behaviour and interaction feedback—not by flattening it into a generic SaaS dashboard.

## Pass by surface

### 1. Home / first entry

**Keep:** ANON wordmark, dark red atmosphere, hero copy, room/activity doors, language selector, profile shortcut and privacy controls.

**Improved:** body copy in the hero and privacy notice now uses a readable system font while labels retain the mono style; door descriptions and spacing are calmer; focus-visible outlines are consistent; responsive nav hides its scrollbar without disabling horizontal navigation; reduced-motion preferences now suppress more decorative animation. The home identity copy already says pseudonymous rather than promising complete anonymity, and notes that live chats are not yet E2EE.

**Still review in a real browser:** check the fixed profile shortcut against the top navigation at 320px, 375px, 768px and desktop widths; check keyboard order, RTL translations, browser zoom and light/dark OS preference.

### 2. Public chat and private rooms

**Keep:** live connection state, message composer, reactions, profile/avatar controls, room management and persistent privacy shortcut.

**Improved:** shared typography/interaction polish applies to the main screen. The backend already uses per-room aliases and opaque room member tokens for private-room messages. This review found a privacy edge case: client-controlled reply metadata could keep a global display name even though the parent message was room-scoped. Reply metadata is now mapped through the room alias resolver, with a real Socket.IO regression test.

**Important boundary:** these aliases reduce direct cross-room identifier exposure; they do not hide network metadata or encrypt message content from the server. The server still sees plaintext chat.

### 3. Privacy Control Room

**Keep:** simple feature cards first, deeper source details in expandable sections. Do not front-load the page with scary warning boxes.

**Improved:** body typography and spacing stay readable while small technical labels retain the ANON look. Claims still distinguish local controls from server behaviour, and the live E2EE gap remains visible.

### 4. Local data controls

**Improved:** the previous JSON action exported only a localStorage summary, not the actual local message history. It now downloads a clearly labelled local-data bundle containing readable localStorage entries, unexpired IndexedDB message history after TTL cleanup, and the current offline queue. Users can also create a passphrase-encrypted local bundle and decrypt it later in the browser. The interface explains that unencrypted/decrypted files may contain private text and must be kept private. The CSV remains a storage-report export and omits value previews unless the user explicitly reveals them.

**Boundary:** this is a client/browser export, not a server-side account export. It does not include hosting logs, server abuse records, other devices, backups or recipients' copies. The local wipe action cannot erase those records either.

### 5. Trust Layer

**Keep:** clear status labels for current branch features versus demos and planned items.

**Improved:** long card descriptions use regular readable body typography. The local WebCrypto sample remains labelled as a local demo; sample encryption is not live message protection. Configuration examples and future Tor support are not presented as production deployment.

### 6. Confession preview

**Improved:** body text now uses a readable system font and the title no longer promises absolute disappearance. The page clearly says that it is a local-only preview whose posts age out of the active local list after 24 hours; it is not the shared live Confession Wall.

**Boundary:** the preview's timer/filtered list is not a guarantee of secure physical deletion from browser storage, backups or screenshots.

### 7. Legal documents

**Improved:** section body text and subtitles now use more readable typography and line spacing; display headings and technical navigation keep the brand style.

**Still required:** the policy, terms and rules need an appropriate legal review for the actual operator, jurisdiction, contact details, hosting providers and retention practices. Visual polish does not validate legal completeness.

## Cross-cutting principles applied

- Keep the original visual character; avoid unnecessary redesign churn.
- Use sans-serif typography for long human-readable text and mono styling for labels, metadata and code.
- Maintain visible keyboard focus and reduced-motion support.
- Make export/deletion scope explicit; never imply that a browser control deletes provider-side or recipient-held copies.
- Do not use an encryption badge or “completely anonymous” claim before live protocol and deployment verification.

## Known release gaps

1. Live end-to-end encryption for public chat/private rooms/DMs and attachments remains unimplemented; the server still receives readable content.
2. Accountless server-side export/deletion requests require an identity-and-retention design. The current export and wipe controls are browser-local only.
3. Infrastructure logs, backups, provider data flows and production environment settings need operator-side verification.
4. This is a source-level review; final responsive visual QA must be performed against the deployed preview on real viewport sizes and with keyboard/screen-reader checks.
