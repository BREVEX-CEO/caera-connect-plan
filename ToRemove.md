# OCADE ToRemove and Reroute Register

## Purpose

This file records active code that should be removed, replaced, disabled, rerouted, or preserved during the current OCADE JARVIS mission.

JARVIS itself is **not** a removal target. The owner has explicitly reintroduced OCADE JARVIS as a current product mission.

The original JARVIS ZIP and immutable extracted source are permanent preservation targets and must never be deleted by cleanup tooling.

## Current JARVIS removal and replacement targets

- The old JARVIS desktop/HUD GUI must be removed from the active production path after the new /ocade-jarvis web GUI works, while the original GUI remains preserved in source-original.
- Customer-facing provider/API-key entry must be removed from the active JARVIS product.
- Active plaintext provider-key configuration files must be removed from the working production runtime after the approved OCADE Online intelligence path is connected.
- Any duplicate JARVIS provider client that bypasses OCADE's approved server-side intelligence authority must be rerouted or retired in the working runtime.
- Old branding or GUI terminology that conflicts with OCADE JARVIS must be removed from the active working runtime while remaining untouched in the preserved original snapshot.
- Any temporary integration adapter that becomes unreachable after direct routing is proven should be removed from production code.
- Any duplicate browser-control authority introduced during integration must be consolidated after tests prove the surviving path.

## Preserve but keep unused

- The original generic plugin subsystem must remain preserved and may remain in the working runtime unused, but it must not be exposed as a customer-installable plugin platform.
- The original FastAPI phone dashboard must remain preserved but must not be exposed as the final customer remote-control architecture.
- Existing PyAutoGUI, desktop-control, file-control, application-control, screen, and related modules must remain preserved for later wiring even when the first web mission cannot yet execute every capability.
- Original GUI files, API-key-entry files, and legacy configuration remain untouched in the immutable original snapshot even when removed from the active production runtime.

## JARVIS is no longer obsolete

Do not remove active JARVIS work because older documents treated browser/computer control or JARVIS as future-only.

Do not remove the /ocade-jarvis route, src/jarvis web UI, jarvis-runtime working engine, Playwright/Playwright-MCP integration, JARVIS voice/task code, JARVIS usage accounting, Allowed Apps, Devices, Activity, permissions, tests, or data needed to distinguish JARVIS conversations.

## Still-retired product families

Historical Cowork, Projects, old generic Tasks product, Artifacts as a separate product, Automations, Monitors, Organizations, public-share links, retired Trash/restore, and retired payment-provider runtime remain outside the current product unless a later owner decision explicitly reintroduces them.

The new JARVIS Task concept is not permission to revive the retired generic Tasks product.

## Cleanup method

For every removal candidate, first identify the caller, replacement, test, and data/security dependency.

Remove active code only after the replacement is working and covered by regression tests.

Never rewrite applied production migration history to make the repository look cleaner.

Use forward migrations for live schema changes.

Ponytail Ultra may aggressively simplify working production JARVIS integration after proof, but it must never touch the uploaded ZIP or immutable source-original snapshot.

## 2026-09-28 cleanup continuation

This section records categories that should be removed or consolidated only after current replacements are proven.

- Remove duplicate or obsolete JARVIS navigation such as a separate History destination when Conversations already owns that concern.
- Remove any active customer-facing Code or Projects surface that duplicates conversation/JARVIS/Library capability unless current implementation evidence proves a unique required workflow.
- Remove placeholder/fake JARVIS nodes, metrics, alerts, replies, activity, decorative browser controls, duplicate theme controls, and prototype scaffolding that are not backed by real product state.
- Remove dead/duplicate execution authorities after the single action broker and supported executors are proven.
- Remove duplicate settings and low-value choice surfaces after automatic safe defaults and Help documentation cover the user need.
- Remove provider/model/vendor/key references from ordinary customer UI, errors, logs, exports, and bundles.
- Remove retired donor dependencies/modules from active packaging only after import/runtime/package tests prove they are not required. Never remove them from immutable donor/source snapshots.
- Remove BrowserStack or other paid/trial-only mandatory testing configuration from the required zero-extra-cost testing path.
- Remove unprofessional, stale, temporary, misleading, or duplicate filenames/folders by renaming or consolidating them during the final repo-structure pass. Preserve Git history and update imports/tests atomically.
- Remove dead code and duplicate files only after dependency/import/search/runtime evidence proves they are unused.
- Remove stale platform claims that present WebKit emulation as real iPhone/macOS proof.
- Remove admin/customer paths that expose unnecessary technical IDs, stack traces, raw local paths, passwords, MFA secrets, full card data, provider secrets, or internal infrastructure names.
- Remove unnecessary long explanations from normal product UI after equivalent Help/support content exists.
- Remove redundant upgrade marketing from paid plans and keep free-plan upgrade prompts contextual.

Ponytail may perform these removals only after the replacement is proven and without compromising UI quality, performance, security, accessibility, or device-control capability. Caveman may simplify architecture and ownership before or alongside Ponytail, but neither tool may touch immutable imports.

## MCP/test-tool cleanup rules — 2026-09-28

- Remove paid/trial-only MCPs from the mandatory zero-extra-cost testing path.
- Remove duplicate MCPs only when their evidence class is genuinely redundant and an equivalent free tool has proven coverage.
- Do not remove an independent verifier merely because another tool can perform similar actions; independent verification is valuable when it is sequential and non-conflicting.
- Remove stale MCP configuration, unused launch scripts, duplicate test harnesses, and obsolete environment instructions after proving the active toolchain.
- Remove flaky tests only when replaced by stronger deterministic coverage; do not delete a failing test merely to make the suite green.
- After MCP/tool cleanup, rerun tool health checks and the affected regression matrix.
