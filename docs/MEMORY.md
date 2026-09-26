# OCADE Project Memory

## Current status

OCADE's established Chat product is protected and the new active mission is **OCADE JARVIS**.

The canonical JARVIS route will be **/ocade-jarvis**.

The original JARVIS ZIP is stored under imports/ocade-jarvis/ with README, LICENSE, and preservation-specific CLAUDE instructions.

The current main documentation now treats JARVIS as active rather than future/obsolete work.

## Current JARVIS decision

The original ZIP is the main JARVIS engine foundation rather than a small donor sample.

The uploaded ZIP remains untouched.

An immutable extracted copy will live under imports/ocade-jarvis/source-original/.

A working extracted runtime will live under jarvis-runtime/.

The new OCADE web GUI will live under src/jarvis/.

The old active JARVIS GUI and manual provider-key entry are replacement targets in the working runtime.

The original plugin system remains preserved but unused.

The original FastAPI phone dashboard remains preserved but is not exposed as the final remote-control product.

## Product decisions

JARVIS is Online-only.

JARVIS uses OCADE's existing approved server-side Online intelligence authority.

JARVIS and Chat have separate usage allowances.

Signed-out users may view JARVIS, but execution requires sign-in.

Normal questions receive normal answers and explicit work requests become JARVIS tasks.

JARVIS voice supports Interrupt, Pause, Continue, and End.

The default wake phrase is Hey OCADE where supported.

Browser control is the first deep automation capability.

Playwright/Playwright-MCP capability is integrated and automatically configured.

The browser design supports isolated automation and an authorized real-browser path.

The system re-observes after resize/zoom/layout changes instead of trusting stale coordinates.

Purchases remain prohibited.

## GUI decisions

The GUI uses a clean central 3D orb and real neural graph.

The graph starts simple and grows as JARVIS conversations, memory, tasks, devices, and allowed-app relationships grow.

The graph supports cursor reaction, pan, zoom, hover, selection, and semantic zoom.

Selecting a node shows safe metadata about represented data without automatically opening private underlying content.

The interface supports dark/light themes and optional custom orb accents.

The sidebar is compact by default and expands when needed.

Initial sections are Conversations, History, Tasks, Activity/Logs, Allowed Apps, and Devices.

## Data decisions

JARVIS reuses the existing conversation/message authority with a JARVIS surface discriminator.

JARVIS memory remains logically separate from Chat memory.

Detailed JARVIS activity logs retain for 90 days.

Raw screenshots/visual frames are temporary by default.

Temporary JARVIS tasks are not part of the first mission.

## Important constraints

The JARVIS mission must not break existing Chat, Library, Settings, authentication, Offline Intelligence, usage, public/legal, or Admin behavior.

Do not mention a desktop-wrapper implementation until the web mission is complete.

Do not claim deeper computer/mobile control until genuinely implemented and tested.

## Next steps

Extract and inventory the ZIP, create the working runtime, build the new orb GUI, route /ocade-jarvis, remove active API-key entry, connect Online intelligence, implement JARVIS usage and voice, then build and harden the first real browser-control path.

After the browser-controlled web mission is stable, prepare later deeper computer/mobile phases.

## Session handoff

Every fresh Claude session runs /ponytail ultra and /caveman ultra first, then reads AGENTS.md, PLAN.md, this file, and JARVIS preservation instructions.
