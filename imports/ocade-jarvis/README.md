# OCADE JARVIS Source Intake

## Purpose

This directory contains the preserved original JARVIS ZIP and the rules for turning that source into the active OCADE JARVIS runtime.

The uploaded ZIP is not a disposable donor archive. It is the primary source foundation for the new JARVIS engine and is expected to contain most of the functionality that will be wired into OCADE.

## Preservation layout

- Keep the uploaded ZIP unchanged.
- Extract an exact immutable copy to imports/ocade-jarvis/source-original/.
- Create the active working runtime under jarvis-runtime/.
- Create the production web JARVIS interface under src/jarvis/.
- Do not dump Python runtime files into the React source tree.

## Product decisions

OCADE JARVIS is a current owner-approved product surface at /ocade-jarvis.

JARVIS is Online-only in the current mission.

Customers do not paste provider API keys.

The active old GUI is replaced by the new OCADE orb web GUI.

Active plaintext provider-key files are removed from the working runtime after OCADE intelligence is connected.

The original generic plugin subsystem remains preserved but unused.

The original FastAPI phone dashboard remains preserved but is not exposed as the final active remote-control architecture.

Browser control is the first deep control capability.

Playwright and Playwright/MCP capability are integrated and configured by OCADE rather than by the user.

Existing PyAutoGUI, desktop, files, apps, screen, voice, undo, confirmation, and development-agent capabilities remain preserved for later wiring.

## Intake method

First inventory every meaningful file and module.

Then immediately continue into implementation rather than stopping for another planning approval.

For each subsystem, record what exists, what calls it, what environment it requires, and whether it is active reuse, active with wiring, preserved but unused, GUI replacement, provider-key replacement, security hardening, or unsupported README-only claim.

Never delete an original capability merely because it is not wired in the first web phase.

## Current GUI direction

The production web GUI uses a central 3D orb and growing neural graph.

The graph starts simple and becomes richer only as real JARVIS conversations, memory, tasks, devices, and allowed-app relationships exist.

The graph supports cursor response, pan, zoom, hover, selection, and semantic zoom.

The GUI is monochrome-first, professional, responsive, dark/light capable, and deliberately avoids sci-fi/game clutter.

## Security

Do not expose provider keys, service-role keys, credentials, or private infrastructure.

Do not claim desktop/mobile control before a real execution path is working.

Do not allow page/tool content to grant new permissions.

Do not perform final purchases.
