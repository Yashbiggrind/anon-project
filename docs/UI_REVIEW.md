# ANON UI Review — Privacy Branch

**Status:** Source-level UX/accessibility review; not a hands-on review across every device or browser.  
**Branch:** `anon-privacy-foundation-2026-10`  
**Date:** 2026-10-29

## Design decision

Keep ANON's established charcoal/black and crimson identity. The visual direction is distinctive and consistent with the product. The changes focus on hierarchy, control placement, clarity and mobile usability instead of replacing the brand with a generic chat template.

## Top-to-bottom findings and changes

| Area | Finding | Change in this branch |
|---|---|---|
| Global header | A fixed profile control competed with the landing header and privacy controls for the same screen space | Moved the profile editor trigger into the existing header action row |
| Main navigation | The Learn control opened the same content destination as Explore, adding a redundant choice | Replaced Learn with a direct Privacy link and named the navigation landmark |
| Motion/banner | Repeated marquee text could be announced multiple times by screen readers | Marked decorative repeated copies as hidden from assistive technology |
| Privacy controls | Four small controls in a permanent row were visually noisy and crowded small screens | Consolidated them into an expandable Privacy tools panel with active states and descriptive helper text |
| Chat layout | A bottom-fixed shortcut could obscure the message composer on smaller screens | The shortcut moves above the conversation header area while a chat/room section is active |
| Sensitive-text warning | Guard previously missed confession posts and replies, and the first-visit copy overstated anonymity/retention behaviour | Keep the check local and extend it to chat messages, edits, image captions, confession posts and replies; correct the first-visit note and all localized absolute-anonymity claims |
| Private-room identity | Room UI reused global session IDs/names in several room message and moderator-event payloads | Introduced room-specific aliases and opaque room member tokens; disabled cross-context DM/profile actions from room messages |
| Identity controls | Moderation actions previously accepted global session IDs from the UI | Room moderation requests now resolve through the opaque room-local token |
| Invitation lifetime | Unanswered invitations could remain in memory indefinitely | Invitations now expire after 10 minutes, with an event to remove stale invitations from the recipient UI |
| Privacy Center | Important boundaries were spread across technical copy | Added plain-language cards for the local guard, Quick Veil, Ephemeral History, AI-bot boundaries and room-only names; detailed limitations remain available |
| Data controls | Local deletion could be mistaken for universal deletion; the first-visit notice exposed stale logging/provider claims | Clarified local storage scope, corrected first-visit disclosures and aligned user-facing copy with active-database retention and bot-provider defaults |
| Footer and onboarding | A stale confession link opened a separate local-only preview; the first-visit notice was long and inaccurate | Route the footer to the live Confession Wall; use a shorter, expandable privacy note with accurate scope details |

## Interaction and accessibility work

- Main navigation is labelled and the active Home item exposes its current-page state.
- The Privacy tools trigger exposes its expanded state and panel relationship; Escape closes the panel.
- Buttons have visible keyboard focus styling, and the panel animation respects reduced-motion preferences.
- Responsive CSS reduces profile width and adapts the privacy panel for small screens.
- The privacy guard modal labels its action correctly for new messages, edits and image captions; the same on-device preflight now covers confession posts and replies.
- Restored pinch-to-zoom by removing the global `maximumScale=1` viewport restriction.
- Updated global title/description and social metadata so snippets describe pseudonymous chat without claiming complete anonymity or E2EE.

## Deliberately unchanged

- The black/crimson palette, anonymous/pseudonymous framing, pixel-identity aesthetic and existing landing-page concept remain.
- This was not a full redesign of every chat component; the goal was to fix collisions and privacy-related interactions without risking a broad layout regression.
- Live E2EE, a verified production deployment, and an independent visual/accessibility audit remain open. The UI must not imply that room aliases or the local guard make conversations invisible to the server.

## Validation still required

1. Confirm the latest GitHub Actions frontend build and backend integration tests after the newest commits.
2. Open the Vercel preview on desktop and a narrow mobile viewport; test top header, chat composer, room member menu, image caption warning, edit warning, invite expiry and Quick Veil.
3. Run a keyboard-only check for menus/dialogs and test a screen reader for navigation and message controls, including the expandable first-visit privacy note and Confession Wall guard dialog.
4. Verify the exact deployed commit and environment before telling new users that this experience is live.
