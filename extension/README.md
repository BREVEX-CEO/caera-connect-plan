# OCADE Cowork — browser extension

The OCADE website is the interface. This extension is the part that can
actually touch the browser: it opens and switches tabs, reads the page, clicks,
types, scrolls and navigates — inside the sites you approve, and nowhere else.

## Install (unpacked)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Choose **Load unpacked** and select this `extension/` folder.
3. Open a site you want OCADE to work on, click the OCADE Cowork icon, and
   press **Approve this site**. Chrome will ask you to confirm host access —
   that confirmation is what actually grants it.

Nothing is approved by default, so a freshly installed extension can do
nothing at all until you say where.

## What it will not do

- **It never types a password, one-time code, CVV, PIN, CAPTCHA or recovery
  code.** It stops, hands the tab back to you and waits for you to press
  Resume. This is a refusal, not a preference — see `isProtectedField` in
  `src/protocol.js`.
- **It never acts outside the sites you approved.** Scope is compared by
  origin, so `https://evil.example/#bank.example` is not your bank, and a
  different scheme or port is a different site.
- **A page cannot approve itself.** Scope changes are accepted only from the
  extension's own popup; a message from a content script is refused.
- **Page text is data.** Instruction-shaped text found in a page is stripped
  and counted before it reaches the model. It can describe the screen; it
  cannot set a new goal or ask for more access.

## Pause, Stop, Take over

All three live in the popup and are always available, including mid-run.
**Stop** is a latch: nothing but you clears it. It is persisted to
`chrome.storage.session`, because MV3 recycles an idle service worker and a
latch kept only in memory would come back running with it.

## Every change is verified

A command that changes the page observes it, acts, observes it again, and
reports what actually moved. A click that hit nothing comes back
`verified: false` with the evidence, rather than as a success — the call
returning is not proof that anything happened.

## Checks

```
npm run extension:check   # manifest, permissions and safety-invariant gate
npm run extension:e2e     # 28 scenarios against real Chromium
```

`extension:e2e` loads the extension into a real browser, serves a real site
over HTTP, and drives the executor. It builds a fixture whose manifest declares
host access to the loopback test server rather than requesting it, because
`chrome.permissions.request` opens a native Chrome dialog that headless
Chromium cannot accept. Everything OCADE decides is the real code; the one
thing not covered there is Chrome's own permission prompt.

## Proving it on Windows with real Chrome

The extension E2E in `tests/cowork-e2e.mjs` runs against whatever browser
`OCADE_BROWSER_PATH` points at. To run it — and the rest of the Windows proof —
against real Chrome Stable on a Windows PC:

```
npm run windows:prove
```

See `docs/WINDOWS-PROOF.md` for what it covers and why it has not run in the
audit environment.
