# OCADE JARVIS Design System

## Design objective

OCADE should feel as easy to approach as Claude and ChatGPT, as visually strong as Grok, and uniquely OCADE through the JARVIS orb, graph, motion, and execution experience. The interface must look premium because it is calm, deliberate, fast, and coherent, not because it exposes many controls.

## Core design rule

- If a sentence, setting, card, button, menu, status, or option does not materially help the user make a decision or complete a task, remove it from the normal interface.
- Automatic safe defaults are preferred over forcing the user to choose.
- Advanced diagnostics remain available when useful, but they are not normal product chrome.
- Long explanations move to Help or contextual guidance.
- The interface should have one obvious primary action on most screens.

## Visual language

- The primary palette is black, white, charcoal, and silver.
- Blue is reserved mainly for active, enabled, listening, selected, linked, or other positive interactive states.
- Green is used for clear success states. Red is used for errors, destructive actions, and security-critical warnings.
- Normal product pages should look like polished software rather than a science-fiction HUD.
- The strongest futuristic treatment is reserved for JARVIS, especially the orb, graph, execution states, and voice states.
- Gradients and stronger glass effects belong mainly to the orb, JARVIS focus surfaces, or deliberate liquid-glass moments. The rest of the application should use clean surfaces and subtle depth.
- Corners are soft and rounded. Controls must not feel harsh, boxy, or cramped.
- Borders are faint and purposeful. Selected/active states may use stronger contrast.
- Shadows are restrained and should help depth rather than decoration.

## Reference influence

- Claude contributes calm spacing, restrained settings, concise controls, and clean reading.
- ChatGPT contributes polished chat mechanics, loading behavior, familiar conversation ergonomics, and progressive disclosure.
- Grok contributes compact power, dark premium presence, strong control density when necessary, and confidence without verbose explanation.
- OCADE contributes the distinctive silver-white 3D orb, cursor-reactive graph, real-data relationships, device/task execution, and a cohesive system-wide control language.
- The references are directional only. Do not copy proprietary assets, exact layouts, icons, or protected visual elements.

## Typography and spacing

- Use Inter or a platform-appropriate modern sans-serif for normal product text, with a system fallback.
- Use JetBrains Mono or an equivalent monospaced font only for code, diagnostics, IDs, and technical detail.
- Use an 8px spacing rhythm with 4, 8, 12, 16, 24, 32, 48, and 64px steps where practical.
- Suggested radii are 8px for compact controls, 12px for inputs/cards, 16px for major panels, 20px for large glass surfaces, and fully rounded pills only where the content genuinely behaves like a pill.
- Text hierarchy should be obvious without excessive size variation. Favor clean spacing over large decorative headings.

## Navigation

- Desktop navigation is compact, icon-first, and collapsible.
- The desktop sidebar may reveal labels on hover or expansion without permanently consuming large width.
- The permanent customer destinations should be limited to genuinely important surfaces. Chat, JARVIS, Library, account/settings access, and contextually useful history/navigation should remain easy to reach.
- Tasks are primarily represented inside JARVIS unless active usage proves a dedicated permanent destination is useful.
- There is no separate Code page in the current product direction.
- There is no required separate Projects page in the current product direction.
- History should not duplicate Conversations as a second JARVIS destination.
- Customer-facing Plugins are not shown merely because internal integrations exist.
- Mobile navigation should stay compact and may use a bottom navigation plus a simple More surface rather than reproducing the desktop sidebar.

## Chat

- Normal Chat is visually simple and reading-focused.
- The empty state may use a restrained greeting and dynamic suggestions, but suggestions disappear after the conversation begins.
- Assistant messages should read primarily as clean content rather than repetitive bubbles and avatars.
- User messages may use a subtle bubble/background treatment when it improves scanability.
- Message actions are mostly revealed on hover or through a compact menu.
- Copy and Retry are high-value message actions. Edit, read-aloud, and other actions remain contextual rather than permanently occupying space.
- Provider and model names stay hidden from ordinary users.

## Composer

- The composer is a soft rounded panel near the bottom of the conversation and may float slightly above the bottom edge.
- It starts compact and expands naturally as the user types.
- Attachment uses a simple plus or paperclip control.
- Voice is accessible without dominating the composer.
- Mode/model controls should appear only when they materially change behavior.
- JARVIS should infer execution intent from the user's request rather than requiring a separate "Work" button for normal tasks.
- The JARVIS orb may appear inside or adjacent to the composer in a compact form when that improves the product identity without adding clutter.

## JARVIS orb and graph

- The orb is a large premium silver-white 3D liquid-glass object with a restrained glow and depth.
- The UI donor ZIP under imports remains the motion/behavior reference for the orb and graph. Preserve the source archive untouched.
- Cursor reactivity, 3D presence, pan, zoom, semantic zoom, hover, focus, node inspection, and real relationship growth are core OCADE identity.
- Graph nodes and edges represent real conversations, memory, tasks, files, devices, apps, activities, workspaces, and relationships. Decorative motion must not pretend to be stored user knowledge.
- Default nodes are silver/white. Optional user color preferences may affect node categories or accenting while preserving accessibility.
- The orb reacts to cursor movement, listening, voice, thinking, task execution, graph activity, and completion.
- Reduced Motion provides an accessible semantic alternative rather than removing functionality.
- Selecting a node shows safe metadata and context, not an automatic full disclosure of private content.

## JARVIS idle and conversation states

- The idle JARVIS screen is dominated by the orb plus the composer, with very little explanatory text.
- When conversation becomes the primary activity, the orb can shrink, fade, or recede into the background while remaining visually connected to the session.
- Voice interaction may expand or strengthen orb motion.
- During execution, the orb may become a compact status indicator while the current action and progress become more important.
- Technical action IDs, protocol versions, raw logs, and internal diagnostics remain hidden unless the user deliberately opens advanced diagnostics.

## Task and execution UI

- Active work shows one compact progress surface with current action, stage, Stop, and Take Over when relevant.
- Detailed steps and full activity history open only when requested.
- Completed task cards collapse automatically after the result is clear.
- Progress percentages are shown only when there is a reliable measurable denominator.
- When accurate percentage is impossible, use truthful stage language rather than invented progress.
- Professional default stages may include "Working", "Checking", "Finishing", and "Done".
- A more playful personality may occasionally use language such as "Cooking" or "Slaying" when user preference and task context make it appropriate, but formal/business work should remain professional.
- Completion may use a short satisfying animation without becoming distracting.

## Loading

- Skeleton loading is preferred to generic full-screen spinners where practical.
- Skeletons should match the final layout closely enough to avoid jarring layout shifts.
- Conversation history, settings, dashboards, tables, and cards should progressively hydrate inside a stable application shell.
- JARVIS task work should use meaningful execution/status animation rather than a generic spinner.
- Navigation should feel immediate by keeping stable chrome and progressively loading data.

## Motion and scroll behavior

- Standard interface transitions should generally stay around 150–200ms.
- Page transitions are subtle.
- Orb/graph motion may be richer than normal UI motion.
- Reduced Motion follows operating-system/user preferences.
- Scrollbars are thin, theme-aware, and unobtrusive. They may become more visible on hover or active scrolling rather than being visually heavy.

## Settings

- Settings use a calm category layout similar in spirit to Claude: clear categories, short rows, restrained descriptions, simple toggles, and segmented controls where two or three options exist.
- Top-level categories should remain limited. A recommended grouping is General, Account, Privacy & Security, Billing & Usage, JARVIS & Devices, and Personalization.
- Memory can live inside Personalization or the most semantically appropriate existing section rather than forcing another top-level destination.
- Allowed Apps belongs under JARVIS & Devices.
- Search may be provided to find settings without expanding the navigation.
- Most settings save automatically and show a simple enabled state, including a Claude-like blue enabled treatment where appropriate.
- Settings should not repeatedly ask the user to save.
- Dangerous or destructive actions are separated at the bottom and use concise confirmation.
- Every settings surface must remain usable on phone without becoming an endless wall of text.

## Usage UI

- Free users see an exact remaining-use representation and reset information because the limit is small and concrete.
- Paid users primarily see their plan name and a clean usage percentage/bar. Exact raw internal charges should not dominate normal UI.
- Upgrade prompts should be contextual, especially near a limit or inside billing/settings, rather than occupying the interface permanently.
- When free usage reaches zero, use a clean locked composer or equivalent state with reset time and a clear optional upgrade action rather than a disruptive full-screen sales wall.

## Owner/admin UI

- The owner dashboard uses the same OCADE design language and supports dark/light themes where useful.
- It may be denser than the customer application because operational work requires more information, but it must still be calm, searchable, and organized.
- The dashboard home should show only the most useful operational metrics, such as revenue, paying users, AI/JARVIS cost, failed payments, active devices/tasks, and prioritized security/system incidents.
- Alerts should be presented as a prioritized list rather than turning every signal into a card.
- Customer lookup supports search and filter. Opening a customer should present a clean CRM-style profile with plan, usage, billing, devices, support, and authorized account actions.
- Technical IDs stay hidden until requested.
- Sensitive and destructive actions use concise confirmation and offer Undo where the underlying operation is safely reversible.

## Help and support UI

- Help is a first-party OCADE experience and should feel like part of the product family.
- Search is the main discovery mechanism.
- Categories cover Getting Started, Chat, JARVIS, Devices, Mobile, Billing, Privacy & Security, and Troubleshooting.
- Errors should link directly to relevant help when a useful article exists.
- Important setup flows use short step-by-step visual guides rather than long walls of text.
- Developer/operator documentation is separated from normal customer help.

## Final quality bar

- OCADE should look expensive because every visible element has a reason to exist.
- The product should minimize choice stress by choosing safe defaults automatically.
- Clean UI must never be achieved by hiding important safety state, permissions, Stop/Take Over controls, billing facts, or error recovery.
- The design implementation is not complete until desktop, tablet, phone, dark/light, keyboard, reduced-motion, loading, empty, error, permission, active-task, and low-usage states are tested.

## MCP orchestration and autonomous verification linkage — 2026-09-28

- Current implementation and verification governed by this document must also follow `docs/MCP_ORCHESTRATION_AND_AUTONOMOUS_FIX_LOOP.md`.
- When multiple MCPs can touch the same surface, one tool acts and the others observe or verify sequentially so browsers, devices, files, and operating-system state are not corrupted by competing automation.
- Long runs must checkpoint durable progress before context compaction, rate limits, restart, or handoff. Resumed work continues from the next unfinished item instead of repeating completed work.
- A failure is not closed by a code change alone. Reproduce it, fix the root cause, run targeted and nearby integration tests, verify with the strongest available real browser/device/physical evidence, attempt to break the fix, and then run the broader regression slice.
- If one MCP or environment is unavailable, mark only that evidence class blocked and continue every independent test. Never treat blocked or emulated evidence as a real-device pass.
