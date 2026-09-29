# OCADE Technical Requirements Document

## Runtime layout

- React/TypeScript web product under `src/`.
- JARVIS UI under `src/jarvis/`.
- active Python/device runtime under `jarvis-runtime/`.
- immutable donor under `imports/ocade-jarvis/source-original/`.
- Cloudflare deployed web authority.
- Supabase Auth/PostgreSQL authority.

## Donor integration requirements

Production must not import from the immutable donor.

Copy/adapt useful donor logic into active runtime and preserve donor snapshot unchanged.

Target approximately 98% donor capability/logic reuse where safe.

Do not carry forward:
- old donor GUI;
- donor provider-key entry/config;
- donor generic customer plugin product;
- duplicate phone dashboard UI;
- insecure/duplicate authorities.

Create/maintain a donor capability ledger.

## Intelligence

JARVIS is Online-only.

Provider keys are server-side.

No provider/model/vendor identity in customer UI.

If all Online capacity is unavailable, JARVIS enters a bounded unavailable/locked state and never silently switches to Offline.

## Browser technical requirements

No OCADE customer browser add-on dependency.

Support existing Chrome/profile first using CDP/DevTools/Playwright where available.

Support additional installed/default browsers where feasible.

Fallback hierarchy: semantic browser/accessibility -> OS accessibility -> vision -> PyAutoGUI fresh coordinates.

Human auth boundaries pause.

Existing browser credential stores are not extracted.

## Computer-control requirements

One action broker.

All actions have cancellation tokens.

STOP is local/synchronous.

Task-owned process trees can be terminated.

Foreground window/state verified before input.

Multi-monitor and DPI-aware.

Input guard detects physical user control.

Co-work uses explicit lease ownership.

No unnecessary visible terminal windows.

## Files

Canonical path/scope validation protects against traversal, symlink/junction escape and unsafe temporary paths.

User-granted workspace/folder is default scope.

Trash/Recycling is default delete.

Undo supported where reliable.

## Office/document requirements

Excel:
- structural workbook inspection;
- formulas/ranges/tables;
- smart fill/structured operations;
- formatting/charts/filters when requested;
- preserve unrelated formatting/formulas/macros;
- real Excel verification for major tasks.

Word/PowerPoint: hybrid direct manipulation + app verification.

PDF: direct extraction/search before visual fallback.

## Developer requirements

Filesystem + terminal/Git + tests first; VS Code UI where useful.

Risky remote/destructive Git operations require stronger authorization.

## Voice/wake

Voice works during execution.

Wake model downloaded/verified once when enabled; pre-wake audio local.

## Android

Support OCADE installed experience, floating bubble, supported deep app control and Remote PC.

Use Android APIs/intents/accessibility legitimately and never bypass security prompts.

## Apple

WebKit compatibility required.

iPhone/iPad PWA/Apple-supported features.

macOS Device Agent supported only with real platform proof.

## Auth/admin

Stable UUID-based Owner/Staff roles.

No frontend email authorization.

Fix TOTP enrollment.

Privileged mutations use appropriate strong auth and audit.

## Safety-critical requirements

- device removal mid-action cancels local execution before authority is forgotten;
- backend safety-control read failure stops physical execution;
- late results cannot resurrect cancelled work;
- task/account/device ownership revalidated at dispatch/settlement;
- final purchases blocked;
- prompt injection cannot expand authority.

## Offline Chat model persistence

Deployment/source code updates must not trigger model redownload.

Use stable release identity, OPFS/storage persistence, immediate completed-range persistence, resumable repair and explicit Remove semantics.

## Testing

Every phase requires local + applicable MCP/real evidence.

Use existing Chrome/CDP + DevTools, browser compatibility matrix, Physical Computer Use, Appium, Mobile MCP, Filesystem, Supabase, Cloudflare and GitHub as appropriate.

Report commercial-launch readiness percentage after each phase.


## Master Phase 1–49 authority

Implementation order, phase gates, donor reuse, per-function completeness, MCP evidence and commercial-launch readiness reporting follow the unified `PLAN.md` Phase 1–49 roadmap. On a fresh clone Claude begins at Phase 1, preserves working behavior, repairs evidence-backed gaps, and continues through Phase 49.
