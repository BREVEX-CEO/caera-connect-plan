# OCADE Project Memory

## Current mission snapshot — 2026-09-29

Repository: `BREVEX-CEO/caera-connect-plan`.

Baseline main when the latest owner-authority plan was authored: `8e4828928d4bfac3edeb79a956b717e538a123d4`. Re-check before implementation.

The active mission is `PLAN.md` Phases 35–49.

## Product

CARCC is the company. OCADE is the product.

Chat and JARVIS remain separate.

JARVIS is Online-only.

Offline Chat remains supported separately and its installed model must not redownload merely because code is merged/deployed.

## JARVIS donor

Immutable source lives under `imports/ocade-jarvis/source-original/`.

Active runtime lives under `jarvis-runtime/`.

Owner wants approximately 98% donor capability/logic reuse where safe:
- copy/adapt donor implementation into active runtime;
- rename/wire cleanly;
- do not cut/move/modify donor;
- remove old GUI/provider-key/customer-plugin behavior from active product;
- preserve useful browser/computer/files/voice/wake/dev/remote logic.

## Browser

No OCADE customer browser add-on.

Use existing authorized Chrome/browser profile first.

Testing/development uses Playwright CDP and Chrome DevTools where available, plus compatibility browsers.

Product runtime may use CDP/structured browser/accessibility/vision/PyAutoGUI hierarchy.

## Windows

Trusted Device Agent + one tray.

No required floating Windows mini-control.

STOP locally cancels active work.

User input pauses normal automation.

Excel/files/VS Code/multi-app real-world acceptance tests are mandatory.

## Android

Android SDK/emulator/ADB/Appium environment was manually set up by the owner.

Android installed OCADE should expose floating bubble, voice, task status/STOP and supported local control.

Appium first, Mobile MCP second independently.

## Apple

WebKit compatibility is available but not physical proof.

Seek legitimate real Apple environment. Paid allocation requires owner approval.

## Owner/Staff

Primary Owner account exists and can sign in.

Current OCADE 2FA/TOTP enrollment has repeatedly rejected fresh authenticator codes and is tracked as a bug for Claude to reproduce/fix.

Roles required: Primary Owner, Backup Owner, Admin, Support, Billing, Developer/Operations, Read-only + granular overrides.

Normal customer sees no privileged UI.

Canonical privileged surface: `admin.ocade.in`.

## Manual setup status

Done:
- Inno Setup installed.
- Android Studio/Pixel emulator/ADB installed.
- Appium package + UiAutomator2 driver installed.
- Android/JAVA environment setup was being completed.
- Chrome remote debugging enabled.

Deferred/skipped:
- Sentry project/DSN.
- payment provider/tax/legal provider decisions.
- paid Supabase leaked-password protection.
- public browser-store account/work.
- public code-signing identity until final release.

## Current known risks to reproduce

1. TOTP enrollment failure.
2. Device removal during active action may not synchronously cancel/join the local action before returning NotEnrolled.
3. Device execution safety-control database read currently risks fail-open semantics unless repaired.
4. Moderate development-only undici/Wrangler issue remains an upstream/local-tooling concern from prior report; re-check current dependency state rather than assuming historical status.

## Testing posture

Use MCPs during coding, not only at the end.

Real evidence:
- existing Chrome/CDP + DevTools;
- browser compatibility matrix;
- Physical Computer Use;
- Android Appium + Mobile MCP;
- Supabase;
- Cloudflare;
- GitHub;
- Filesystem where healthy.

After each phase report commercial-launch readiness percentage.

Historical audits and ledger entries remain evidence; newer owner authority wins on current direction.
