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
