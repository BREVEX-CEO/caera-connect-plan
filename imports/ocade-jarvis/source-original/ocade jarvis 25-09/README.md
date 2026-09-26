# OCADE JARVIS — Source Package

**Company:** CARCC  
**Product:** OCADE  
**Component:** OCADE JARVIS  
**Status:** Original JARVIS source package for preservation, audit, adaptation, and integration into OCADE.

## What this project is

OCADE JARVIS is a local AI-assistant and computer-automation runtime intended to become the execution foundation for the OCADE JARVIS product surface.

The supplied source contains Python modules for computer control, browser/web automation, files, screen processing, voice interaction, reminders, system utilities, development tasks, memory, remote-control concepts, hotkeys, wake-word behavior, confirmations, undo support, and an existing desktop interface.

The original source is being preserved as donor/runtime source. Production OCADE JARVIS may wrap, adapt, secure, or replace individual implementations while keeping this original package unchanged for provenance.

## Major capability families present in the source

### Computer and operating-system control

- Mouse and keyboard automation.
- Application launching.
- Desktop and window operations.
- Volume, brightness, Wi-Fi, shortcuts, and computer settings.
- System and hardware monitoring.
- Confirmation gates for selected irreversible actions.
- Undo support for reversible actions where implemented.

### Browser and web automation

- Browser control and navigation.
- Web search and research-style lookup.
- YouTube control.
- Flight lookup.
- Browser-driven automation foundations that may be expanded with Playwright / Playwright MCP in OCADE JARVIS.

### Files and content

- File browsing and management.
- File reading, writing, moving, renaming, copying, and Trash-oriented deletion behavior.
- Local file processing for common document and media formats where dependencies are available.
- Screen capture and screen-processing capabilities.

### AI, voice, and interaction

- Gemini-based AI / LLM modules.
- Real-time voice and audio handling.
- Speech-to-text and text-to-speech support.
- Push-to-talk and hotkey behavior.
- Wake-word support.
- Audio-device selection.
- Voice/avatar/lip-sync related modules.
- Typed-task and voice-task foundations.

### Agentic and developer capabilities

- High-level task/action routing.
- Development/code helper modules.
- Project-building and code-running concepts.
- Proactive/background monitoring concepts.
- Reminders and scheduled actions.

### Remote/device concepts

- FastAPI-based phone/remote dashboard.
- Pairing/session concepts.
- Remote command and file interaction foundations.

## Approved OCADE JARVIS product direction

OCADE JARVIS is an official OCADE product surface beside Chat.

The target product direction is:

- JARVIS is **Online-only** initially.
- JARVIS uses OCADE's approved server-side Gemini intelligence authority.
- Customers never paste provider API keys into the product.
- Chat and JARVIS are separate experiences and use separate plan allowances.
- Browser automation is a primary capability.
- Playwright / Playwright MCP should be integrated where appropriate.
- Browser control may combine structured DOM/accessibility control, browser tooling, visual understanding, and coordinate fallback.
- Users may choose between an isolated automation browser and explicitly authorized real-browser control.
- Windows and macOS are first desktop targets.
- Android deeper automation is prioritized before deep iOS automation.
- JARVIS may operate user-approved applications, including development tools, creative software, CAD/CAE/engineering software, browsers, and other allowed applications.
- Smart autonomy is the default; Autonomous mode may be enabled under explicit permission policies.
- Final purchase/payment actions are not performed by JARVIS.
- Voice must support interrupt, pause, continue, and end.
- The final GUI should be minimal, professional, black/white-first, and centered around a live configurable orb/graph rather than a cluttered sci-fi dashboard.
- Devices and allowed applications should be visible and permission-controlled.
- Generic arbitrary user-executable plugins are not the final product model; CARCC-controlled tools/capabilities are preferred.

## Integration policy

This original source package must be preserved before production adaptation.

Recommended workflow:

1. Keep the original ZIP unchanged.
2. Extract an immutable original-source snapshot.
3. Inventory every source module and entry point.
4. Identify what is implemented, partial, environment-dependent, placeholder-only, or README-only.
5. Map all security-sensitive actions.
6. Compare the source with current OCADE architecture.
7. Reuse or wrap proven modules.
8. Replace unsafe or duplicate production behavior without deleting the preserved original.
9. Integrate JARVIS incrementally with tests.

Do not blindly copy Python runtime files into the React web `src/` directory.

## Security notes

Before production use, security-sensitive capabilities such as desktop control, browser sessions, files, arbitrary code execution, camera, microphone, messaging, remote control, and operating-system settings must be placed behind explicit permission, device-authentication, action-logging, confirmation, and session-control boundaries.

The final OCADE JARVIS product must not expose provider API keys, service-role keys, customer credentials, saved passwords, private tokens, or other secrets to browser code or public source.

## Source preservation

The original source package is intentionally preserved.

Cleanup and Ponytail/YAGNI/KISS work may be applied aggressively to **new production integration code** after behavior and replacement are proven, but the original donor/source snapshot should not be silently deleted or rewritten.

## Ownership

OCADE JARVIS is proprietary CARCC/OCADE source material. See `LICENSE` for the source-code licence.

Third-party libraries, APIs, models, protocols, and assets remain governed by their own licences and terms.
