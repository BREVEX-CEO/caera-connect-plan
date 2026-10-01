# OCADE Project Memory

## Current mission snapshot — 2026-09-29

Repository: `BREVEX-CEO/caera-connect-plan`.

Baseline main when the latest owner-authority plan was authored: `8e4828928d4bfac3edeb79a956b717e538a123d4`. Re-check before implementation.

The active mission is the unified `PLAN.md` **Phases 1–49**. A fresh clean clone starts at Phase 1; Phases 1–34 are revalidated/repaired rather than blindly rebuilt, then work continues through Phase 49.

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

The 2FA/TOTP enrollment defect (fresh codes rejected) was fixed on 2026-09-29: QR code, grouped key, no truncation of pasted codes (mfa journey).

Roles required: Primary Owner, Backup Owner, Admin, Support, Billing, Developer/Operations, Read-only + granular overrides.

Normal customer sees no privileged UI.

Canonical privileged surface: `admin.ocade.in` — built 2026-10-01: the site's account menu hands over a one-time sign-in; staff authority works only in that console session, which answers its own second factor (docs/OWNER_ADMIN_BACKEND.md).

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

The 2026-09-29 list (TOTP enrollment, removal during an action, fail-open execution control) is fixed and covered (mfa journey, `test_safety`, `jarvis-execution-control.test.ts`). The second attack audit (2026-10-01, `docs/IMPLEMENTATION_LEDGER.md`) is fixed; what it accepted is listed there.

## Release order (owner approval first; never before)

1. Deploy the Edge Functions (`ocade-intelligence`, `ocade-intelligence-service`, verify_jwt off) — they settle claimed permits themselves.
2. Deploy the Worker from the approved merge (creates `admin.ocade.in`; build with `VITE_WEB_PUSH_PUBLIC_KEY`, secret `WEB_PUSH_PRIVATE_KEY` from `~/.ocade-release/web-push.json`).
3. Apply `20261001090000`, `20261001092000`, `20261001094000`, `20261001095100` in that order (`091000`, `093000`, `095000`, `095200`, `096000`, `096100` are already applied).
4. Remove the legacy `user_roles` admin row (ToRemove.md); sign the Device Agent and the Android release with the owner's keys.

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

## Master-plan reset — 2026-09-29

The older Phase 1–34 roadmap has been restored into the active master plan and reconciled with the newer Phase 35–49 owner direction. The obsolete customer browser-add-on phase was rewritten as existing-browser autonomous control. The plan now intentionally covers the entire build, repair, hardening, admin, Android, Apple, real-PC, conversational JARVIS, cleanup and commercial-release sequence in one numbered Phase 1–49 mission.
