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

## Current docs intentionally avoid a desktop-wrapper architecture

### Date

2026-09-26.

### Status

Accepted.

### Decision

Current documentation focuses on the web-controlled mission and does not name or plan a desktop-wrapper technology before the owner starts that later mission.

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
