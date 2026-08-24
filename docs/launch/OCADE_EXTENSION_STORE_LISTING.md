# OCADE Cowork extension store listing

Status: package and listing are source-complete and locally verified. Store submission, review, store-issued identity, and production installation remain external.

## Listing copy

**Name:** OCADE Cowork

**Short description:** Let OCADE read and act in browser tabs you approve, with Pause, Stop, Take over, and protected-field handoff.

**Detailed description:**

OCADE Cowork connects the OCADE website to the browser tabs you explicitly approve. It can inspect visible page controls, open and switch tabs, navigate, click, type ordinary text, scroll, and control supported media. Every mutating action is followed by a fresh observation so OCADE can report whether the page actually changed.

No website is approved at installation. Use the extension popup while viewing a site to grant that origin. A page cannot approve itself or widen OCADE's scope. Pause temporarily blocks work, Stop remains latched across extension service-worker restarts, and Take over hands the tab to you before OCADE re-observes it.

OCADE refuses to type passwords, PINs, CVVs, CAPTCHAs, recovery codes, or one-time codes. Those fields are handed back to you. Instruction-shaped text found inside a page is treated as untrusted content and removed from the observation sent to the planner.

## Permission justification

- `activeTab`: lets a deliberate popup interaction refer to the current tab without permanent website access.
- `tabs`: lists, opens, switches, navigates, and closes tabs while withholding details for out-of-scope origins.
- `scripting`: injects the local content bridge only into origins approved by the user.
- `storage`: persists approved origins and safety-control state; Stop must survive an MV3 service-worker restart.
- Optional `http://*/*` and `https://*/*`: requested one origin at a time from the extension popup. They are optional so a fresh installation has no standing host access.

## Public URLs

- Product: `https://ocade.in/products/ocade`
- Privacy: `https://ocade.in/privacy`
- Terms: `https://ocade.in/terms`
- Support: `https://ocade.in/support`

## Submission evidence

- `npm run extension:check`: MV3, permission, remote-code, origin-channel, and safety-invariant gate.
- `npm run extension:e2e`: 69 real-Chromium scenarios covering scope, observe-act-observe verification, protected-field handoff, injection stripping, Pause/Stop/Take over, MV3 restart persistence, media, and the website adapter.
- `npm run extension:package`: deterministic ZIP creation, allowlisted entries, byte-for-byte extraction verification, SHA-256 receipt.

## External store work

Developer-account ownership, store declarations, privacy questionnaire answers, screenshots/promotional tiles, upload, review, publication, and a store-installed Chrome/Edge runtime receipt must be completed in the owner accounts. Store acceptance is not inferred from the local package.
