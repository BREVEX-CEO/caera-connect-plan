# OCADE Decision Log

## OCADE JARVIS becomes an active product surface

### Date

2026-09-26.

### Status

Accepted.

### Decision

OCADE JARVIS is a current product surface at /ocade-jarvis while Chat remains a separate protected experience.

## Preserve the full JARVIS source and use it as the engine foundation

### Date

2026-09-26.

### Status

Accepted.

### Context

The uploaded ZIP already contains extensive JARVIS runtime functionality.

### Decision

Keep the uploaded ZIP untouched, keep an immutable extracted source snapshot, and create a working extracted runtime that preserves the original meaningful structure and functionality.

### Alternatives rejected

Selecting only a small subset of donor code was rejected because the owner considers most of the ZIP useful.

Dumping all Python directly into the React src tree was rejected because it would mix incompatible runtime/build concerns.

## Replace active GUI and manual provider-key entry

### Date

2026-09-26.

### Status

Accepted.

### Decision

The production working runtime replaces the old GUI with the new OCADE JARVIS web GUI and removes customer API-key entry/plaintext provider-key configuration.

The immutable original snapshot remains unchanged.

## JARVIS is Online-only

### Date

2026-09-26.

### Status

Accepted.

### Decision

JARVIS uses OCADE's approved server-side Online intelligence authority and does not use Chat Offline Intelligence.

## Browser control is the first deep control capability

### Date

2026-09-26.

### Status

Accepted.

### Decision

The first deep JARVIS control implementation is browser control using structured DOM/accessibility targeting, Playwright/browser tooling, authorized browser integration, visual understanding, and coordinates only as the last fallback.

### Consequences

Resize, zoom, responsive reflow, navigation, tab switches, and scroll-context changes invalidate stale coordinates and require a new observation.

## JARVIS usage is separate from Chat usage

### Date

2026-09-26.

### Status

Accepted.

### Decision

JARVIS uses separate plan allowances and may account for multiple resource-bearing internal steps.

Failed/no-result steps are reconciled rather than blindly charged.

## JARVIS reuses conversations but separates memory

### Date

2026-09-26.

### Status

Accepted.

### Decision

JARVIS reuses the existing OCADE conversation/message authority with a JARVIS surface discriminator, while JARVIS memory remains logically separate from Chat memory.

Detailed JARVIS activity is retained for 90 days.

## JARVIS UI uses a real growing orb/graph

### Date

2026-09-26.

### Status

Accepted.

### Decision

The central orb starts visually simple and grows real graph density from JARVIS conversations, memory, tasks, devices, and allowed-app relationships.

Node selection reveals safe metadata rather than automatically opening full private content.

The GUI remains minimal, professional, dark/light capable, and monochrome-first.

## Historical web-only architecture restriction

### Date

2026-09-26.

### Status

Superseded later on 2026-09-26.

### Decision

This restriction applied only until the owner explicitly started the deeper-device mission. The approved replacement is the Windows/macOS Device Agent and browser-extension roadmap in PLAN.md Phases 13–23 and docs/JARVIS_DEVICE_ROADMAP.md.

## JARVIS browser tasks run on a paired device, planned in the browser

### Date

2026-09-26.

### Status

Accepted.

### Decision

The planning loop runs in the signed-in browser tab and calls OCADE's existing Online boundary on a `jarvis` surface, one permit per model step.

Browser actions execute on a paired device running the working runtime (`jarvis-runtime/ocade_device.py`), which authenticates with a hashed device token, holds no provider key and makes no model call.

The Worker exposes only `/api/jarvis/pair` and `/api/jarvis/device`; every queued action is validated and permission-checked by server functions before a device can claim it.

A hosted automation browser is not part of this phase, and a task with no online device is refused rather than simulated.

## JARVIS usage is a separate pool in the one ledger

### Date

2026-09-26.

### Status

Accepted.

### Decision

JARVIS permits use the existing permit lifecycle with their own window kinds (`jarvis_session`, `jarvis_week`) and the same Free/Pro/Max numbers as Chat, so the two allowances never spend each other.

Every successful model step, including one that only calls a tool, costs one JARVIS use; a step that fails or produces nothing is released.

## Private-network addresses need the person's permission

### Date

2026-09-26.

### Status

Accepted.

### Decision

JARVIS may open public sites unless the person turns them off in Allowed Apps, but loopback, private-network and local addresses are refused until the person allows that exact address, so page content cannot steer a device into its own network.

## Deeper device mission is approved

### Date

2026-09-26.

### Status

Accepted.

### Decision

The web/browser mission remains preserved and the next active mission is the approved deeper-device roadmap in `docs/JARVIS_DEVICE_ROADMAP.md` and PLAN.md Phases 13–23.

The trusted desktop execution path is a one-time OCADE Device Agent for Windows 10/11 and modern macOS, with one tiny tray/menu-bar presence, signed public releases, automatic updates, rollback, secure per-device credentials and a shared versioned protocol.

Same-account devices enroll automatically without user-managed tokens or QR steps. Each device still receives a unique revocable cryptographic identity and triggers a new-device notification.

The latest primary visual/code reference is `imports/UI OCADE JARVIS.zip`. It is preserved untouched and used as a donor/reference rather than shipped as a standalone prototype.

Production JARVIS navigation is Conversations, Tasks, Activity, Allowed Apps and Devices. History is not a separate duplicate surface.

JARVIS starts text-only. Microphone permission is requested only when Voice is first used. Optional PC `Hey OCADE` wake detection stays local and Background/Wake Mode is explicit.

A Chrome extension is allowed when required for authorized real-browser control and should be prepared for Chrome Web Store publication. It uses minimal permissions and never exposes provider/model/vendor identity.

One task at a time owns mouse/keyboard/UI control. Safe non-conflicting background tasks may run in parallel under bounded resources.

Mobile remains website/PWA-first with Add to Home Screen and a dedicated Remote PC surface. No mandatory Android/iOS native companion is part of the approved roadmap, and unsupported OS-wide cross-app control is never faked.

Online intelligence continues through the OCADE server authority with exactly three configured capacity/key slots. Slot-local failover is allowed; key cycling must not be used to evade a project-wide/provider-wide quota. If all Online capacity is unavailable, JARVIS enters a customer-safe timeout/unavailable state without exposing provider details.

## Owner-approved decisions — 2026-09-28

- OCADE is being developed as a global AI operating product, not only a chatbot.
- JARVIS is the main execution differentiator and should control browsers, files, development tools, common desktop applications, professional software, and supported mobile actions through one safe hierarchy.
- There is no separate Code page in the current direction. Code is produced in conversation or executed in the user's selected development environment.
- A dedicated Projects page is not currently required. Conversations, files, repositories, workspaces, and Library should satisfy the project-context need first.
- JARVIS tasks are primarily embedded in JARVIS. Co-work is an optional control mode rather than a separate product.
- The design target is Claude-like calm/minimal structure, ChatGPT-like polish, Grok-like compact power, and an original OCADE orb/graph identity.
- The primary palette is black, white, charcoal, and silver; blue indicates enabled/active state, green success, and red destructive/error.
- The product should remove choices when OCADE can make a safe predictable default. Long explanations belong in Help.
- Free-tier usage shows exact remaining uses; paid plans primarily show plan name and a percentage/bar.
- One subscription provides Chat and JARVIS access according to plan allowances.
- OCADE must provide a secure owner/admin backend on the OCADE domain with roles, usage/plan controls, payments/refunds, support, staff, security, incidents, and system health.
- Owner/staff plaintext passwords, MFA secrets, raw tokens, full payment-card data, and provider secrets are never exposed by the dashboard.
- Android receives an OCADE-owned companion with a guided direct-install flow and optional floating mini JARVIS, subject to Android's required permission/security prompts.
- iPhone/iPad remain PWA/web-first with Apple-supported shortcuts/control surfaces and Remote PC; unsupported OS-wide cross-app control is not faked.
- The mandatory zero-extra-cost testing path excludes paid/trial-only BrowserStack dependence.
- The test team uses each MCP/tool for its strongest evidence and does not allow multiple controllers to fight over the same UI.
- The release target is no known Critical or Major release blocker and no reproducible hidden blocker within tested scope, not an unverifiable claim of zero bugs or unhackability.

## MCP orchestration and autonomous verification linkage — 2026-09-28

- Current implementation and verification governed by this document must also follow `docs/MCP_ORCHESTRATION_AND_AUTONOMOUS_FIX_LOOP.md`.
- When multiple MCPs can touch the same surface, one tool acts and the others observe or verify sequentially so browsers, devices, files, and operating-system state are not corrupted by competing automation.
- Long runs must checkpoint durable progress before context compaction, rate limits, restart, or handoff. Resumed work continues from the next unfinished item instead of repeating completed work.
- A failure is not closed by a code change alone. Reproduce it, fix the root cause, run targeted and nearby integration tests, verify with the strongest available real browser/device/physical evidence, attempt to break the fix, and then run the broader regression slice.
- If one MCP or environment is unavailable, mark only that evidence class blocked and continue every independent test. Never treat blocked or emulated evidence as a real-device pass.
