# OCADE JARVIS — Source Intake

**Company:** CARCC  
**Product:** OCADE  
**New product surface:** OCADE JARVIS  
**Status:** Donor/runtime source intake for the new JARVIS mission  
**Original source package:** upload the JARVIS ZIP into this directory before extraction or integration.

> This directory is intentionally separated from the current OCADE web source. The original JARVIS source must be preserved intact first, audited second, and only then adapted and wired into OCADE.

## What this source is

The supplied JARVIS ZIP is a Python desktop-assistant codebase with a real runtime structure rather than a design-only mockup. Its current source tree contains:

- `main.py` as the main runtime entry point.
- `ui.py` for the existing desktop HUD/interface.
- `actions/` for executable skills and computer-facing capabilities.
- `core/` for Gemini/LLM handling, voice, audio, confirmations, undo, hotkeys, wake word, avatar logic, skill loading, and runtime support.
- `dashboard/` for the current phone/remote dashboard.
- `memory/` for the current local configuration and memory implementation.
- `plugins/` with the plugin loader/template structure.
- `requirements.txt` and `setup.py` for the Python runtime dependencies and setup.

The ZIP currently contains 65 entries and already includes its own Python dependency file. Do not replace or rewrite the original dependency file during intake.

## Capabilities present in the source

The source contains implementations or dedicated modules for the following capability families:

### Computer and operating-system control

- Mouse and keyboard automation.
- Application launching.
- Desktop and window operations.
- Volume, brightness, Wi-Fi, shortcuts, and computer settings.
- System/hardware monitoring.
- Confirmation gates for selected irreversible operations.
- Undo support for reversible operations where implemented.

### Browser and web automation

- Browser control and navigation.
- Web search and grounded/research-style lookup paths.
- YouTube control.
- Flight lookup.
- Browser-driven interaction concepts that can be expanded with Playwright.

### Files and content

- File browsing and management.
- File reading, writing, moving, renaming, copying, and Trash-oriented deletion behavior.
- Local file processing for common document/media formats where dependencies are available.
- Screen capture and screen-processing capabilities.

### AI, voice, and interaction

- Gemini-based AI/LLM modules.
- Real-time voice/audio handling.
- Speech-to-text and text-to-speech support.
- Push-to-talk/hotkey behavior.
- Wake-word support.
- Audio device selection.
- Voice/avatar/lip-sync related modules.
- Typed task and voice-task foundations.

### Agentic and developer capabilities

- High-level task/action routing.
- Development/code helper modules.
- A development agent capable of creating/modifying/running project work.
- Proactive/background-monitoring concepts.
- Reminders and scheduled actions.

### Remote/device concepts

- A FastAPI-based phone/remote dashboard.
- Pairing/session concepts for remote control.
- Remote command/file interaction foundations.

## Important source facts

The intake source is valuable and must be preserved, but source presence is not the same as production verification.

- The ZIP does **not** currently contain a project-level proprietary `LICENSE`; this intake directory adds one for the proprietary OCADE JARVIS source mission.
- The original README describes more plugin examples than are physically present in the ZIP. The supplied `plugins/` directory currently contains the loader/template structure rather than all of those advertised plugin implementations.
- The current source includes local Gemini/API configuration concepts. The final OCADE JARVIS product must not ask customers to paste provider API keys; OCADE's approved server-side intelligence authority will be used instead.
- The current source contains its own local memory/configuration concepts. Final OCADE JARVIS account memory must be reconciled with OCADE's existing account/Supabase memory authority rather than creating a second customer-memory product.
- The existing GUI is donor/reference code. The final JARVIS web UI will be redesigned and wired to OCADE rather than simply exposing the old HUD unchanged.
- Generic user-installable executable plugins are not part of the approved final product direction. CARCC-controlled tools/capabilities will replace the public arbitrary-plugin model where needed.
- Security-sensitive capabilities such as desktop control, code execution, browser sessions, remote control, files, camera, microphone, messaging, and system settings require an explicit permission model and auditable action boundaries before production use.

## Approved OCADE JARVIS direction

OCADE JARVIS is now an owner-approved current mission and a separate product surface beside OCADE Chat.

The target experience is:

- OCADE Chat remains its own product experience.
- OCADE JARVIS gets its own JARVIS conversation/task experience and its own plan usage allowance.
- JARVIS is **Online-only** for the initial product and uses OCADE's approved server-side Gemini intelligence boundary.
- Customers never paste a Gemini/provider API key into JARVIS.
- Browser automation should combine structured browser control, Playwright/Playwright MCP where appropriate, browser context/DOM/accessibility information, visual understanding, and coordinate fallback.
- The initial product prioritizes controlling browser-based work from the OCADE website.
- Windows and macOS are the first desktop targets.
- Android deeper automation is prioritized before deep iOS automation; iOS must use supported Apple automation paths rather than fabricated capabilities.
- JARVIS may control user-approved applications and workflows, including coding environments, creative software, CAD/CAE/engineering tools, browsers, and other explicitly permitted applications.
- The user can choose between an isolated automation browser and an explicitly authorized real logged-in browser.
- Smart autonomy is the default. Autonomous mode may be enabled, while high-impact actions remain subject to the final permission/confirmation policy.
- Purchases/final payment actions are not performed by JARVIS.
- Voice is first-class and must support interruption, pause, continue, and end controls.
- The final UI is clean, professional, black/white-first, minimal, and centered around a live configurable orb/graph rather than a cluttered sci-fi dashboard.
- The orb/graph may represent conversations, memories, tasks, devices, and allowed apps; selecting graph nodes should open the real associated object.
- JARVIS should expose a visible Stop/Take Over/permissions model during automation.
- Users should be able to see and control registered desktop/mobile devices and allowed applications from OCADE.

## Intake and extraction rules

1. Upload the original ZIP into this directory.
2. Keep the uploaded ZIP unchanged.
3. Extract it into a clearly named immutable source-preservation directory such as:
   `imports/ocade-jarvis/source-original/`
4. Preserve the original file names, README, requirements, setup files, assets, modules, and folder structure.
5. Produce an inventory of every original file/module and what it actually does before integration.
6. Distinguish:
   - implemented and verified code,
   - implemented but environment-dependent code,
   - placeholders/templates,
   - README claims with no matching source module,
   - duplicate authorities that must later be reconciled with OCADE.
7. Do not directly dump the Python runtime into the React `src/` tree.
8. Design the production integration only after the original source is fully mapped.
9. Adapt or wrap proven original modules into the final OCADE JARVIS architecture while retaining the untouched source snapshot for provenance.

## Preservation policy

The uploaded ZIP and its extracted original-source snapshot are **source evidence and donor code**.

They are not Ponytail deletion targets.

Ponytail Ultra may:

- identify duplication,
- identify dead or unsafe patterns,
- recommend replacement,
- simplify newly adapted production code,
- consolidate OCADE integration code,
- remove obsolete code from the new production JARVIS implementation after proof.

Ponytail Ultra must **not** delete, rewrite, "clean up", rename, or silently alter the original uploaded ZIP or the immutable extracted source snapshot.

If an original implementation is unsafe or obsolete, preserve it in the original snapshot and implement the safe replacement in production code.

## Near-term workflow

The next JARVIS implementation phase should:

1. preserve/extract and inventory the ZIP;
2. compare the ZIP against the approved JARVIS product requirements;
3. map what already exists versus what must be built;
4. define browser-control and device-control architecture;
5. define the JARVIS usage/account/permission model;
6. define the new clean JARVIS web UI;
7. connect OCADE's server-side intelligence and Supabase authorities;
8. integrate capabilities incrementally with tests;
9. keep existing OCADE Chat behavior isolated and regression-protected.

Do not begin destructive refactoring of the original source during intake.
