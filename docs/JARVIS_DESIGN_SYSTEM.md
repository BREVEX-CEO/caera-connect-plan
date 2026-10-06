# OCADE JARVIS Design System

## Product character

JARVIS combines calm conversation with visible execution power.

The interface should feel like a capable partner, not a dashboard full of implementation controls.

## Orb and graph

Use the OCADE silver-white round 3D orb/knowledge graph as the central identity.

Real data may create nodes/relationships for:

- conversations;
- JARVIS memory;
- tasks;
- devices;
- apps;
- projects/workspaces;
- meaningful work relationships.

Decorative motion must never pretend to be stored knowledge.

Support pan, zoom, semantic detail, hover/selection and reduced-motion alternatives.

## Conversation while working

Execution never removes conversational quality.

During a task, the user can type/speak naturally:

- “What are you doing?”
- “Use the other file.”
- “Wait.”
- “Continue.”
- “Stop.”

JARVIS answers from truthful current task state and updates/replans accordingly.

## Task state

Show concise current action/stage and truthful progress only when measurable.

Prominent controls:

- Stop;
- Take Over;
- Continue when paused.

Details/activity can expand when needed.

## Desktop device UX

Windows local product presence is tray-only.

Do not ship a required floating desktop JARVIS control.

The web JARVIS surface remains the rich task/conversation UI.

## Android bubble

Android is the floating mini-control platform.

Collapsed bubble is minimal.
Expanded bubble includes:

- chat;
- voice;
- task status/progress;
- STOP;
- Open OCADE.

Match the main OCADE visual language.

## Browser UX

The customer should understand “JARVIS is working in your browser”, not the underlying automation technology.

Take Over is obvious.

Human auth boundaries clearly ask the person to complete the protected step.

## Voice

Voice uses the orb.

Listening, speaking, paused and stopped states are visually distinct.

Hey OCADE setup explains that wake detection is local before activation.

## Owner/Staff consoles

Use OCADE visual language, strong information hierarchy and search.

Hide modules/actions the staff member lacks permission for rather than showing a wall of disabled controls.

Every button has loading/success/error/disabled states.

## Loading

Use skeleton/progressive hydration and stable layout.

Do not wipe user typing during hydration.

Do not let first-load lazy features bloat unrelated desktop/signed-out bundles.

## Themes

Dark/light both polished.

Use restrained glass outside JARVIS focal surfaces.

## QA

Material UI changes require screenshot/real visual verification across:

- desktop;
- tablet;
- 360/375 phone;
- dark/light;
- reduced motion;
- loading/error/empty/permission/limit states.

Visual bugs fail the phase.

## Final JARVIS simplification — 2026-10-06

The primary JARVIS composition is conversation, the real-data Orb and relationship threads, a concise current-task/status layer and persistent STOP/Take Over. The interface must not become a control dashboard for internal execution technologies.

Use a compact radius system instead of per-component shapes. Conversation surfaces, settings groups, task cards, dialogs and drawers should use soft rounded corners, while small actions may use pill or semi-circular geometry where it improves touchability and visual grouping. Rounded geometry must remain consistent across desktop and mobile rather than becoming decorative noise.

The Android bubble remains a distinct mobile affordance. In collapsed form it should be small and unobtrusive. In expanded form it should provide mini chat, voice, concise task progress, STOP and Open OCADE, with no technical setup controls or duplicate settings dashboard.

The Orb and donor-inspired strings/threads should be recreated only inside the current web renderer and only from genuine OCADE state. Keep the distinctive visual identity, but reject fake graph nodes, unbounded per-frame work, separate donor GUI architecture, duplicated theme systems and animation that obscures usability.

Rare controls belong under Advanced. Normal users should not see or choose APIs, scripts, browser-control engines, accessibility backends, vision methods, device transport or other implementation plumbing.

## Current execution authority — 2026-10-06

This document governs the JARVIS visual and interaction system, while `PLAN.md` is the single current execution roadmap. Older phase-range wording is historical context only. Newer Owner decisions in `PLAN.md` supersede older conflicting detail, and implementation must keep only the strongest proven path rather than preserving obsolete alternatives for compatibility.
