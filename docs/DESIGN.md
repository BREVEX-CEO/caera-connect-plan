# OCADE Design System

## Design philosophy

OCADE should feel calm, premium, direct, and technically powerful without looking like a game, hacker console, or science-fiction movie interface.

The JARVIS design combines modern conversational-AI clarity with a distinctive central orb and real neural graph.

## Visual direction

- Use black, white, charcoal, and neutral grey as the default system.
- Allow a user-customizable orb/accent color without making the UI depend on a bright palette.
- Use restrained glass morphism only where it improves depth or focus.
- Keep shadows soft and minimal.
- Keep controls visually quiet until relevant.
- Avoid card-wall dashboards, noisy neon effects, and decorative telemetry.

## JARVIS orb

- The orb is the central visual anchor.
- A new/empty JARVIS history starts with a visually simple orb.
- Real history causes the graph to gain meaningful nodes, threads, clusters, and density.
- The graph represents conversations, JARVIS memory, tasks, devices, and allowed-app relationships.
- Neural threads feel organic and precise rather than random.
- The orb/graph respond subtly to cursor movement.
- Users can pan and zoom.
- Semantic zoom reveals more metadata progressively.
- Selecting a node shows safe metadata rather than immediately opening full private content.
- The orb dims to a background aura when conversation text needs foreground priority.
- Reduced-motion users receive a restrained equivalent state.

## Voice visualization

- Voice uses the same orb rather than a separate product.
- The orb may pulse, rotate, expand, ripple, or change thread intensity based on live audio.
- User and JARVIS speech use one coherent professional visual language.
- Voice controls remain explicit and do not depend on hidden orb gestures.

## Layout

### Desktop

- Use a compact icon-first left sidebar.
- Allow the sidebar to expand/collapse.
- Keep the orb centered.
- Keep the composer near the bottom.
- Allow a collapsible browser-control panel.
- Keep Stop and Take Over obvious during automation.

### Tablet

- Collapse navigation when required.
- Preserve orb, chat, voice, task, Stop, and Take Over capability.
- Avoid fixed panels that force horizontal scrolling.

### Phone

- Use a compact drawer/navigation pattern.
- Keep graph controls touch-operable.
- Use full-width conversation/composer layouts.
- Keep task controls reachable.
- Support 360–375 px without horizontal overflow.

## JARVIS navigation

The initial sections are Conversations, History, Tasks, Activity/Logs, Allowed Apps, and Devices.

The customer-facing Plugins section is removed.

Permissions use a focused drawer/modal.

## Composer

The JARVIS composer includes text input, Send/Stop state, voice control, attachment entry where supported, permissions, and task/device context when useful.

The composer never exposes provider names, model names, runtime names, or infrastructure.

## Themes

Dark and light themes ship together.

Monochrome is the default.

User-selected orb/accent colors may alter the orb shader and restrained accent tokens while preserving accessibility.

## Accessibility

- Every important control is keyboard accessible.
- Focus indicators remain visible.
- The graph has an accessible semantic representation for critical information.
- Color is not the only state indicator.
- Reduced motion is respected.
- Contrast remains sufficient in both themes.
- Important automation controls are never hover-only.

## Do not

- Do not turn JARVIS into a cluttered dashboard.
- Do not use random graph nodes unrelated to real data.
- Do not expose secrets or implementation vocabulary.
- Do not use tiny unreadable technical text as decoration.
- Do not copy the reference image literally when a cleaner OCADE solution is better.

## JARVIS deeper-device design direction

The latest primary reference is `imports/UI OCADE JARVIS.zip`, used as a donor/reference rather than a standalone shipped application.

The core visual is a round 3D aura/knowledge orb with real graph relationships. Keep the surrounding UI quiet, monochrome-first and content-focused.

Primary navigation is Conversations, Tasks, Activity, Allowed Apps and Devices.

Desktop device control may add a small optional movable round OCADE mini-control with compact rounded status/chat/progress UI. It should appear during active work by default and may be pinned by the user.

Mobile web/PWA gets a matching compact launcher inside OCADE, not a fake OS-wide overlay.

Every control state—Stop, Take Over, paused by user input, permission required, offline checkpoint, background mode and remote controller—must be visually distinct without exposing technical provider/runtime terminology.

## Latest product design authority — 2026-09-28

`docs/JARVIS_DESIGN_SYSTEM.md` is the detailed current design authority and supersedes older conflicting UI details.

- OCADE should appear calm, premium, and minimal. Power should come from automatic behavior and execution capability, not from many visible options.
- Use black, white, charcoal, and silver as the primary visual language. Use blue mainly for enabled/active states, green for success, and red for destructive/error.
- Keep soft rounded corners, generous spacing, restrained borders/shadows, theme-aware thin scrollbars, skeleton loading, progressive hydration, and subtle 150–200ms interface motion.
- Reserve stronger liquid-glass/futuristic effects for JARVIS and the orb rather than applying translucent cards everywhere.
- Preserve and reproduce the useful 3D orb, graph, cursor-reactive behavior, semantic zoom, pan/zoom, real-data node growth, voice reaction, and task reaction from the UI donor reference without copying fake/prototype data.
- Remove redundant pages, settings, cards, descriptions, repeated avatars, fake metrics, and decorative controls.
- Settings should use a small set of clear categories, auto-save, short explanations, and Claude-like blue enabled states where appropriate.
- Free usage can show exact counts. Paid usage should prefer plan name plus a clean progress bar/percentage.
- Task UI shows current stage, truthful progress, Stop and Take Over, while details remain collapsed until requested.
- The Help experience contains long explanations so the normal product can remain concise.
