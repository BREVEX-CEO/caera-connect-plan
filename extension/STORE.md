# OCADE JARVIS extension — Chrome Web Store submission

Build the upload with `node extension/build.mjs --zip` (produces
`dist/ocade-jarvis-extension.zip` for https://ocade.in). Publishing needs the
owner's Chrome Web Store developer account; nothing here can publish it.

## Single purpose

Let OCADE JARVIS carry out browser tasks the signed-in person asks for, in
tabs the extension opens in their own Chrome, with their own sign-ins.

## Permissions and why

| Permission                | Why                                                                                                                                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `debugger`                | Read and operate only the tabs this extension opened for a JARVIS task (page structure, clicks, typing, screenshots for the live view). Chrome shows its "is debugging this browser" bar while it works. It never attaches to any other tab. |
| `storage`                 | Remember which tabs are JARVIS's and this browser's connection status.                                                                                                                                                                       |
| `alarms`                  | Check with OCADE every 30 seconds for work while idle.                                                                                                                                                                                       |
| host `https://ocade.in/*` | Talk to OCADE, and only OCADE.                                                                                                                                                                                                               |

No remote code is loaded: the page-reading script ships in the package.

## Data use

- The browser's own P-256 key is created in the browser and cannot be exported;
  OCADE stores only the public half. Disconnect removes it on both sides.
- Page content JARVIS reads is sent to the person's OCADE account only while a
  task they started is running, to plan the next step. It is not sold, not used
  for advertising, and not used to train models.
- JARVIS never reads saved passwords, never enters payment card details, never
  completes a purchase, and hands CAPTCHA, one-time codes and passkeys to the
  person.

## Listing copy

- **Name:** OCADE JARVIS
- **Short description (manifest):** Lets OCADE JARVIS work in tabs it opens in this browser, only when you ask it to and only where you allow it.
- **Category:** Productivity
- **Long description:** OCADE JARVIS is the part of OCADE that does things for you. With this extension, JARVIS can carry out browser tasks you ask for in your own Chrome — using your own sign-ins — in tabs it opens itself. You see every step, can take over at any moment, and one STOP ends everything. JARVIS never reads other tabs, never touches saved passwords or payment details, never completes a purchase, and hands CAPTCHA, one-time codes and passkeys to you. Connecting needs your OCADE account and your explicit consent in the extension.
- **Homepage:** https://ocade.in/ocade-jarvis
- **Support:** https://ocade.in/help
- **Privacy policy:** https://ocade.in/privacy#jarvis

## Privacy practices answers (must match behavior and the policy)

- **Data collected:** Web browsing activity and website content — only for tabs this extension opened for a task the person started (page text and structure, URL, title, screenshots for the live view).
- **Purpose:** Functionality of the single purpose above. Not sold, not transferred for unrelated purposes, not used for creditworthiness or lending, not used for advertising, not used to train models.
- **Prominent disclosure and consent:** the popup shows the categories, purpose and destination before Connect, and Connect stays disabled until "I agree" is ticked.
- **Remote code:** none. The page-reading script ships in the package.

## Reviewer instructions

1. Install the package and open the popup. Read the disclosure, tick "I agree", press "Connect this browser".
2. A tab opens at ocade.in; sign in with the reviewer test account (provided in the dashboard's reviewer notes by the owner), compare the fingerprint, and approve the browser.
3. In OCADE JARVIS, ask: "Open example.com and tell me the page title." JARVIS opens its own tab, reads it, and answers. Chrome shows its debugging bar only on that tab.
4. Press STOP in the popup or on the website: the tab is released at once. "Disconnect this browser" removes the connection on both sides.

## Required assets still to capture

- 1280×800 screenshots: the popup with its disclosure; a JARVIS task running in its own tab; the Devices panel showing the browser. Captured from the release build during visual QA, never mocked.
- 440×280 promotional tile.

## Current test and release discipline — 2026-09-28

- Extension build, package, install, authorization, owned-tab isolation, debugger attach/detach, disable/re-enable, browser restart, revoke, update, unrelated-tab protection, private-network defenses, and store-readiness must follow `docs/MCP_ORCHESTRATION_AND_AUTONOMOUS_FIX_LOOP.md`.
- Playwright Real Chrome is the primary browser actor and Chrome DevTools is the debugger/observer. Physical desktop automation must not fight Playwright for the same Chrome window.
- A packaging or lifecycle defect is fixed only after targeted retest, clean-profile/browser verification, adversarial checks, and the relevant broader browser regression are green.
