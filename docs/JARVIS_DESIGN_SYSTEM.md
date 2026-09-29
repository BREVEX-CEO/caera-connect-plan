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
