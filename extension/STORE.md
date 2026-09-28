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

## Current test and release discipline — 2026-09-28

- Extension build, package, install, authorization, owned-tab isolation, debugger attach/detach, disable/re-enable, browser restart, revoke, update, unrelated-tab protection, private-network defenses, and store-readiness must follow `docs/MCP_ORCHESTRATION_AND_AUTONOMOUS_FIX_LOOP.md`.
- Playwright Real Chrome is the primary browser actor and Chrome DevTools is the debugger/observer. Physical desktop automation must not fight Playwright for the same Chrome window.
- A packaging or lifecycle defect is fixed only after targeted retest, clean-profile/browser verification, adversarial checks, and the relevant broader browser regression are green.
