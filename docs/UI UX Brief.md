# OCADE UI/UX Brief

## Core experience

Keep customer navigation intentionally small:

- Chat;
- JARVIS;
- Library;
- Account/Settings;
- Help/Support.

Complex execution happens through conversation, not extra product pages.

## JARVIS idle

Orb-focused, clean and calm.

## JARVIS conversation

Reading-focused with orb dimmed into background.

## Active task

Current action/progress, Stop, Take Over and concise status become primary.

The user can continue chatting/voice while execution runs.

## Browser task

Show clear control state without exposing automation internals.

Use existing user browser/profile when appropriate.

Take Over pauses automation and Continue resumes from fresh state.

## Windows

Device Agent is represented by one tray identity. No required floating desktop mini-control.

## Android

Floating bubble is supported where Android permissions allow it.

It is intentionally compact and opens the full OCADE/JARVIS UI for complex work.

## iPhone/iPad

PWA/Home Screen UI stays native-feeling and does not pretend to provide unsupported Android-style system overlay.

## Owner/Staff

Account menu conditionally shows Owner Console or Staff Console based on server-authorized role.

Customers never see those entries.

## Settings

Few clear categories, safe defaults, auto-save where appropriate, advanced diagnostics hidden from normal use.

## Error UX

Explain:

- what happened;
- whether work stopped;
- what the user can do.

Do not expose stack traces/provider/infrastructure.

## Responsive/accessibility

No overflow at 360/375.
Keyboard accessible.
Reduced motion.
Visible focus.
Touch-friendly.
Stable mobile keyboard/composer behavior.

## Master Phase 1–49 authority

Implementation order, phase gates, donor reuse, per-function completeness, MCP evidence and commercial-launch readiness reporting follow the unified `PLAN.md` Phase 1–49 roadmap. On a fresh clone Claude begins at Phase 1, preserves working behavior, repairs evidence-backed gaps, and continues through Phase 49.
