# OCADE JARVIS UI/UX Brief

## Aesthetic

OCADE JARVIS should feel ultra-clean, professional, executive, minimal, and calm.

The reference direction is modern conversational-AI clarity combined with a distinctive central orb and real neural graph.

The UI must avoid chaotic sci-fi, hacker, gaming, neon-dashboard, or movie-interface styling.

## Central orb and graph

The main workspace uses a live 3D orb as its focal point.

A new JARVIS history begins with a visually simple orb rather than a fully populated artificial network.

As real JARVIS conversations, memory, tasks, devices, and allowed-app relationships accumulate, thin neural threads and nodes grow outward and become denser.

The graph behaves like a floating 3D knowledge/task graph with cursor-reactive motion, pan, zoom, hover, selection, and semantic zoom.

The graph is data-driven. Random decorative relationships must not pretend to be user memory.

Selecting a graph structure shows safe information about what data category and stored metadata it represents without automatically opening the full private content.

When conversation text occupies the center, the orb and graph dim smoothly into a background aura.

The user can deliberately return the orb to full visual focus.

## Voice

Voice uses the same orb.

The orb becomes an ambient audio visualizer that pulses, rotates, expands, and ripples smoothly in response to speech.

Use one coherent visual language for user and JARVIS speech.

Show explicit Interrupt, Pause, Continue, and End controls.

Do not make ordinary orb clicks secretly interrupt speech.

## Navigation

The left sidebar is compact/icon-first by default and expands/collapses when needed.

The active sections are Conversations, History, Tasks, Activity/Logs, Allowed Apps, and Devices.

Do not show a customer Plugins section.

Permissions open in a drawer/modal.

## Conversation behavior

The orb remains the primary idle state.

Conversation content overlays/occupies the workspace when needed and automatically reduces orb emphasis for readability.

Normal questions feel conversational.

Active work shows concise task state without turning the page into a dashboard wall.

## Browser-control experience

Active browser work may show a collapsible live panel.

Stop and Take Over remain visible and understandable.

Permission requests explain the exact capability being requested.

The UI remains stable when browser panels, sidebars, screen sizes, or window dimensions change.

## Composer

The bottom composer includes prompt input, Send/Stop, microphone, attachment where supported, permissions, and relevant task/device context.

The composer stays ergonomic on desktop and mobile.

## Color and themes

Monochrome black/white/charcoal is the default.

Dark and light themes are both supported.

Users may optionally customize the orb/accent color.

Color customization preserves contrast and accessibility.

## Glass and depth

Use restrained glass morphism for focused overlays, node inspectors, and permission/task panels.

Do not cover the interface in translucent cards.

## Responsive behavior

Desktop keeps the full orb workspace and compact sidebar.

Tablet collapses non-essential chrome while preserving capability.

Phone uses drawer-style navigation and touch-friendly graph controls.

The product must not horizontally overflow at 360–375 px.

## Accessibility

Respect reduced motion.

Provide keyboard support and visible focus.

Provide non-visual/semantic access to important graph information.

Keep Stop and Take Over reachable without hover.

Do not use color alone to communicate status.

## Forbidden design patterns

Do not use a dense hacker console.

Do not use decorative fake code as background.

Do not use an always-maximal graph for an empty account.

Do not expose provider, runtime, model, storage-engine, or infrastructure terminology.

Do not make the UI look like a game.


## Latest UI reference

`imports/UI OCADE JARVIS.zip` is now the primary visual/code reference. Preserve it untouched and reuse useful patterns/components inside production `src/jarvis/`; do not ship its prototype scaffolding or fake data.

Production left navigation is exactly:

- Conversations
- Tasks
- Activity
- Allowed Apps
- Devices

Do not duplicate Conversations with History. Do not show Plugins. Settings reuses OCADE Settings.

The orb is a true round 3D aura/knowledge ball. It may have ambient decorative motion, but stored nodes/relationships come only from real conversations, JARVIS memory, tasks, apps, devices, projects and work relationships.

Category differentiation is primarily shape, node size, structure and restrained accent use. Keep the product monochrome-first.

Double-click enters Orb Focus until the user exits. Nonessential controls may fade after approximately eight seconds without ending focus.

The conversation style may combine clean ChatGPT/Grok-like reading with restrained floating elements where they improve the JARVIS identity. Remove repetitive avatars.

Desktop mini-control is an optional movable round OCADE control. Default visibility is active-task-only; users may pin it while device control is enabled. It opens a compact rounded mini-chat/status surface with progress, Stop/Continue and Open OCADE.

JARVIS opens text-only. Voice controls appear near the orb while Voice is active. If spoken output is muted, voice commands still work and responses remain text.

Mobile web/PWA uses a clean compact round launcher within the OCADE surface. Do not visually imply an OS-wide overlay when the platform does not support one.
