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

## Current UX direction — 2026-10-06

The product should expose fewer decisions and make the next useful action obvious. The main JARVIS view should prioritize conversation, the real-data Orb, current task state and STOP/Take Over rather than permanent tool or permission dashboards.

Use soft rounded surfaces consistently, including the composer, task cards, dialogs, mobile sheets and compact pill-style actions where appropriate. Keep spacing generous enough for touch without wasting screen area. Secondary controls should appear progressively or under Advanced rather than compete with the main task.

Android setup is one **Set up OCADE** action. The setup flow automatically performs everything OCADE is allowed to perform and asks the person only when Android itself requires a permission or security decision. After setup, normal mobile control remains status, Wake, STOP, Remove device and the clean floating bubble.

Every error should state what happened, whether work stopped or is still pending, and the one useful next action. Do not expose provider names, internal control engines, infrastructure names or technical permission plumbing to ordinary customers.

## Current execution authority — 2026-10-06

This document governs user experience, information hierarchy and setup simplicity, while `PLAN.md` is the single current execution roadmap. Older phase-range wording is historical context only. Newer Owner decisions in `PLAN.md` supersede older conflicting detail.
