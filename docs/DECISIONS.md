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
