# OCADE Browser Companion (Manifest V3)

**Status: source only — not built, packaged or published.** Nothing in the OCADE
app reports browser control as working until this extension is loaded and
verified in a real browser.

## Why the permissions are shaped this way

| Choice                                | Reason                                                                                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `host_permissions: []`                | OCADE requests site access **per origin, at the moment you approve it**, via `optional_host_permissions`. It never ships with blanket access to every site. |
| `"incognito": "not_allowed"`          | OCADE must never act inside private windows. This is enforced by the browser, not just by our policy code.                                                  |
| `externally_connectable` limited      | Only the OCADE app origin (and localhost during development) may talk to the service worker. An arbitrary page cannot drive it.                             |
| `optional_permissions: ["downloads"]` | Downloads are requested only when a download is actually approved.                                                                                          |
| Strict `content_security_policy`      | No remote script, no framing.                                                                                                                               |

## Trust model

1. The user opens the extension popup and creates a six-digit, five-minute
   pairing code. The OCADE page exchanges that one-time code for a session
   token and verifies the returned runtime ID, extension name, version and
   Manifest version. Every later message must carry the token; see
   `validateRequest` in `src/lib/native/extension-protocol.ts`.
2. Every request is validated against a closed list of kinds. An unknown shape is
   **rejected, never coerced**.
3. Page content is treated as **untrusted data**, never as instructions
   (`src/lib/ocade-injection-guard.ts`).
4. The policy engine in `src/lib/native/browser-bridge.ts` decides what is
   permitted _before_ anything reaches the browser: per-site allow/deny lists,
   separate grants for reading and filling, confirmation for submits and
   uploads, and outright refusal for protected fields.

## What it will never do

- Read or fill passwords, OTPs, CAPTCHAs, CVV/card, IBAN, SSN or recovery codes.
  Protected fields are reported **by name only**, with no value.
- Capture those fields in a screenshot — `screenshotRedaction()` returns mask
  selectors that are applied _before_ capture.
- Act in a private/incognito window.
- Submit a consequential form without an explicit confirmation.

## Files

- `manifest.json` — MV3 manifest (this directory)
- `background.js` — service worker; validates every message, requests per-origin
  permission, performs bounded actions, selector healing, bounded dynamic-page
  waits, approved upload/drop/download handoffs, progress, stop/cancel, and
  injects collectors on demand
- `popup.html` / `popup.js` — user-presence pairing-code surface

There is deliberately **no persistent content script**. Nothing is injected into
any page until you approve that specific origin; the collectors
(`collectDom`, `collectA11y`, `maskProtected`) are injected per request via
`chrome.scripting.executeScript` and removed when the call ends. That is a
smaller attack surface than an always-present content script.

The protocol and summarisation logic live in
`src/lib/native/extension-protocol.ts` so they are unit-tested rather than
hidden inside the service worker. Bridge and representative local-app tests
cover navigation, semantic selector healing, form fill/submit, file handoff,
download, cancellation, emergency stop, injection isolation, and verified
receipts. The Phase 28 controlled web-lab suite executes the actual
`background.js` service worker and its registered message listeners against a
deterministic Chrome-API/DOM harness. It covers identity pairing, origin
prompts, top-level/open-shadow/same-origin-frame observation, cross-origin frame
boundaries, duplicate and hidden controls, stale selectors, protected fields,
masked capture, dynamic waits, upload, drag/drop, download, cancellation,
progress, emergency stop and session suspension. This is real source-runtime
execution, but it is not a claim that Chrome or Edge was loaded in this managed
session.

## Loading it for development

1. Build the app (`npm run build`).
2. Open `chrome://extensions`, enable Developer mode.
3. "Load unpacked" → select this `extension/` directory.
4. Open the extension, create a pairing code, then enter it in OCADE →
   Settings → Browser control.

## Remaining before this can be called working

- Real-browser verification of tab discovery, DOM/a11y reads and masked capture
  in both Chrome and Edge (load unpacked — see below)
- Store listing + signing (Chrome Web Store / Edge Add-ons)

The package itself is complete: `manifest.json`, `background.js` and
`icons/icon128.png` are all present, so it loads as-is.

Until that verification happens, the OCADE app continues to report browser
control as unavailable via `UnavailableBrowserBridge` — it never claims a
capability it has not proven.
