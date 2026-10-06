# OCADE Mobile and Device Control Authority

## Shared principle

OCADE-owned runtimes execute customer work. MCPs, Playwright, Appium, Mobile MCP and Physical Computer Use are development/test instrumentation only.

## Action authority

Every action is bound to account, device, task, request, permission, confirmation and cancellation state and is revalidated at dispatch.

Preferred order:
direct/native -> structured/app integration -> accessibility -> vision -> fresh coordinates.

STOP is locally enforceable. Success requires observing the real result.

## Windows

Use a small OCADE Device Agent with one tray identity.

No floating desktop mini-control is part of the final Windows product.

Tray provides simple status plus Open OCADE, STOP, Pause/Resume where meaningful and Exit.

The agent autostarts after setup as a lightweight dormant supervisor, discovers installed apps, supports multi-monitor/DPI-safe control and updates safely with health check/rollback.

User input pauses normal automation. Co-work deliberately alternates control.

## macOS

Use the same product concept with a trusted menu-bar/Device Agent, native scripting/accessibility, direct files, browser control, vision and fresh coordinates.

Respect TCC permissions. Public distribution requires signing/notarization. Native claims require real Mac evidence.

## Android installed OCADE

Installation begins from `ocade.in` and should feel like one OCADE product.

Customer wording is “Install OCADE”; avoid unnecessary implementation jargon. Where Android requires native components for overlay/accessibility/background capability, use them legitimately and let Android show its required system prompts.

The floating bubble:

- may appear over other apps when granted;
- snaps/restores safely;
- expands to chat, voice, task/progress, STOP and Open full JARVIS;
- does not expose technical implementation details;
- does not hide permission problems.

Control hierarchy:
intents/native APIs -> accessibility structure -> vision -> fresh coordinates.

Messaging/call/contact/media/file actions verify targets and obey confirmation rules. Final payment execution remains blocked. Banking/security authentication remains human.

Android permissions persist until revoked; OCADE never bypasses OS-owned security screens.

## Android storage and Offline Chat model

JARVIS itself is Online-only.

Chat Offline Intelligence remains separate. Its local model must survive normal deployments/merges/version updates without unnecessary redownload.

Where browser OPFS owns the model, deployment changes must preserve the installed artifact unless the release identity actually changes or integrity repair is required.

On Android installed OCADE, use stable app/site-owned storage as appropriate so ordinary history clearing does not trigger avoidable model loss when the underlying data remains. If the user explicitly clears site/app data or removes OCADE, the platform may delete local data and OCADE must not pretend otherwise.

## iPhone and iPad

Remain PWA/Home Screen first.

Use Apple-supported Siri/Shortcuts, notifications, share flows and Remote PC. Do not claim unrestricted Android-style overlay/cross-app control.

JARVIS voice may be launched through Apple-supported triggers; do not claim permanent third-party always-listening behavior that iOS does not grant.

WebKit compatibility is required but is not physical proof.

## Voice and wake

Hey OCADE is supported where the platform permits local wake detection.

On Windows/macOS/Android where supported:

- user enables wake once;
- OCADE downloads/verifies the small local model once;
- pre-wake audio stays local;
- model is retained across normal restarts/updates;
- Online voice begins after detection.

Do not bypass locked-screen/device security.

## Remote PC

A signed-in phone/tablet can instruct a paired PC, view truthful task status and STOP it.

If one eligible PC is Ready, select it automatically. If multiple are plausible, ask and remember the user's safe preference.

## Testing

Android:
local tests -> Pixel emulator/device -> Appium -> reset/release -> Mobile MCP -> Chrome/DevTools/Playwright web/PWA diagnostics -> adversarial regression.

Apple:
WebKit now; real iPhone/iPad/macOS through legitimate hardware/remote device when available. Paid reservation needs owner approval. If unavailable, mark only physical evidence BLOCKED.

Windows/macOS:
real OS/device evidence required for native claims.

Never convert emulation into real-device evidence.

## Master Phase 1–49 authority

Implementation order, phase entry/exit gates, donor reuse, per-function completeness, MCP evidence and commercial-launch readiness reporting are governed by the unified `PLAN.md` Phase 1–49 roadmap. On a fresh clone Claude begins at Phase 1, preserves current working behavior, repairs gaps proven by current evidence, and continues sequentially through Phase 49. This document supplies domain-specific requirements and does not replace a phase gate.

---

# Owner mobile UX authority — 2026-10-06

This section supersedes older customer-facing setup complexity.

## One-button setup

The primary Android setup action is **Set up OCADE**.

One tap starts a guided state machine that:

1. verifies compatible Android/web/account state;
2. pairs the device when needed;
3. requests only capabilities required by the supported feature set;
4. opens Android-owned settings/prompts one at a time only where Android requires direct user action;
5. returns automatically to OCADE after each step when the platform permits;
6. verifies the permission/result rather than assuming success;
7. ends at **Ready** or names the single unresolved permission/action.

Do not show separate technical setup buttons for pairing, service, accessibility backend, overlay backend, wake backend or internal transport.

Normal post-setup controls: status, Wake, STOP, Remove device and the floating bubble.

## Floating bubble

Collapsed: small clean OCADE control.

Expanded: mini chat, voice, concise current task/progress, STOP and Open OCADE. Keep it fast and uncluttered; no settings dashboard inside the bubble.

## Distribution and updates

The PWA remains the zero-install baseline. Deep Android control may use the official OCADE-signed APK distributed from the official site.

Native updates require the same app identity/signing authority and increasing version code. Use a signed OCADE release manifest and verify hash/signature before handing an update to Android. Preserve pairing/settings across compatible updates. A Git merge alone is not an app update.

Never bypass Android install/update/security confirmation. Do not tell customers to disable Play Protect.

Do not show a generic OCADE "unsupported" message when the device is actually compatible. Detect the precise missing permission/version/capability and give one clear action.

Platform-owned "unsafe/unverified/restricted setting" warnings cannot be suppressed by OCADE. Reduce legitimate friction through developer verification/registration as required, stable release signing, official HTTPS distribution, transparent permission purpose, no downloaded executable code, minimal permissions and visible user control. Re-check current Android distribution rules before each commercial release.

When a device security mode blocks outside-store installation or accessibility control, keep the PWA/Remote-PC route usable and explain the limitation truthfully.

