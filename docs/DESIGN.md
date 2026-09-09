# Design System and Interaction Specification

## Design intent

This document is OCADE's detailed visual, component, layout and interaction authority. `docs/UI UX Brief.md` owns the concise experience and information-architecture intent; this file turns that intent into concrete design-system and surface rules without creating a second product brief.

OCADE should feel like a premium, calm, highly capable AI workspace rather than a crowded dashboard. The product must expose enormous capability through progressive disclosure: the user sees only the controls necessary for the current job while deeper tools appear contextually. The overall experience should be immediately familiar to a user of modern AI workspaces without becoming a visual copy of any one product.

Claude, ChatGPT and OpenClaw are the reference applications. Claude is the dominant structural benchmark for the signed-in shell, sparse workspace composition, Projects/Artifacts/Scheduled/Customize organization and the calm Chat/Cowork/Code interaction economy. ChatGPT is a reference for approachable general-user conversation, search/history discoverability and multimodal ergonomics. OpenClaw is a reference for autonomous-agent/control presentation where it improves OCADE. Target roughly 95% alignment with the best interaction structure, density, control hierarchy and workflow clarity of the references while retaining original OCADE components, wording, assets and visual identity. Do not copy proprietary source, protected assets, exact product copy, icons or literal pixel-for-pixel trade dress.

## Personality

OCADE is serious, modern, intelligent and restrained. It should not look like a sci-fi movie interface, crypto dashboard, generic enterprise admin panel or a collection of AI-generated cards. Normal product surfaces are calm. Jarvis mode is the one intentionally expressive, immersive surface.

The design hierarchy is reliability first, clarity second, speed third and visual spectacle last. Decorative surfaces must never hide status, permission or failure information.

## Core palette

The foundational palette is black, silver/neutral grey and white. Dark mode is the primary visual expression, with a complete light appearance supported. Ordinary product surfaces should use subtle neutral elevation differences, thin borders and typography rather than heavy shadows or saturated backgrounds.

Semantic color is narrowly permitted. Red may indicate danger, destructive actions or genuine errors. Green may indicate verified success. Neither color can be the only carrier of meaning; icon, text, shape or border state must accompany it. Jarvis may use user-selected luminous accent colors inside the orb/voice visualization, but those accents are scoped to Jarvis and should not leak into the general shell.

## Typography

Use the strongest current OCADE UI font if it already performs well; otherwise converge on one neutral modern sans-serif for ordinary product text and one highly legible monospace family for Code, terminal, diffs and technical values. Avoid using many font families. Typography must create hierarchy through size, weight and spacing rather than decorative type effects.

Large page titles should be confident but not oversized. Body copy should be compact and readable. Meta labels, timestamps and secondary explanations use lower contrast but remain WCAG-readable. Code/terminal content uses a true monospace with strong differentiation between punctuation and similar glyphs.

## Shape, borders and depth

Use Claude-like soft rounded rectangles for composer fields, contextual cards, dialogs and controls. More rounded Apple-like treatment may be used for compact pills, voice controls or Jarvis overlays where it improves ergonomics. Avoid rounding every large section into an isolated card.

Prefer subtle one-pixel borders, neutral layer differences and hover/focus treatment over heavy shadows. Large empty bordered rectangles are discouraged. If a region contains no meaningful information it should usually disappear or become a deliberate empty state rather than remain as a blank panel.

## Spacing and density

The workspace should use generous breathing room without creating giant unused zones. A page can feel sparse because only necessary elements are present, not because content is pushed into a tiny corner of a huge canvas. Align titles, primary actions and content rails to a consistent content grid. Reuse a small spacing scale across every surface.

Avoid toolbars with many same-weight buttons. One primary action per state should be obvious. Secondary actions belong in menus, command search, right-click/context menus, drawers or contextual inspectors.

## Shared shell

The signed-in shell is a narrow dark left rail separated from the workspace by a thin border. The top region contains OCADE branding, a small workspace/mode control when useful and one strong New action. Below that is a short primary destination list. A restrained recent conversations/tasks section follows rather than a second navigation tree. Account, organization and utility controls stay near the bottom.

Primary destinations are Chat, Cowork, Code, Projects, Tasks, Artifacts, Search, Customize and Settings. Search also opens through Cmd/Ctrl+K. The previous large More dashboard must not survive. Its useful content is redistributed into Tasks, Artifacts, Customize and Settings.

The main workspace owns nearly all remaining width. Contextual right panels are closed by default and appear only when the current task benefits from them, such as Artifact details, Cowork Command Center or Code diff/diagnostics. Panels should collapse cleanly without causing horizontal overflow.

## Chat

The empty Chat view uses a centered greeting/composer composition in the useful content region, not a top-heavy dashboard. A thin usage status strip may sit immediately above the composer. The default composer is one generous rounded field with the prompt area as the dominant element. Directly visible core controls are attachment, intelligence mode, voice when applicable and send. Web retrieval, project selection, tools, incognito and other advanced choices are contextually available instead of permanently occupying a toolbar.

Below the composer, a few useful suggestions may appear when context justifies them, but do not create a large catalogue of prompts. Recent conversations belong in the shell/sidebar and search.

During a conversation, assistant/user messages should prioritize readable content width, code/artifact rendering and citations rather than heavy chat bubbles. Streaming should have a subtle but clear active state. Stop/retry/regenerate/branch/share actions appear at the relevant message or contextual menu instead of all at once. Provider names such as Gemini or raw local model names must not appear in normal Chat UI; use OCADE Intelligence, Online Intelligence and Offline Intelligence.

## Cowork Normal mode

Normal Cowork should look like the professional work version of Chat, not a separate complex control dashboard. The entry state is a centered or lower-centered outcome composer with concise contextual suggestions and a clear mode label. Once a mission begins, the central surface shows the mission goal, concise plan, current verified step and result/progress timeline. Do not fill the screen with dozens of control chips.

While executing, Pause, Take over and Stop are the only actions that remain continuously prominent. Approvals appear exactly when a meaningful/risky side effect requires them. The Command Center is a collapsible right inspector that can show browser/device connection, active executor, permission state, current action, receipts and diagnostics. The inspector should not occupy the main Cowork canvas when nothing requires it.

If browser/Windows automation is unavailable, show a compact setup state with exact reason and one useful action such as Check again/Set up, rather than multiple diagnostic cards competing for attention.

## Cowork Jarvis mode

Jarvis is a separate presentation inside Cowork but uses the identical task/agent/permission/runtime underneath. Switching between Normal and Jarvis never duplicates the mission or changes usage accounting.

The Jarvis canvas is near-black and intentionally minimal. One large central OCADE orb dominates the view. The orb is original and combines two visual concepts: a dense neural-network cloud made from thousands of fine points, short lines, filaments and luminous internal connections; and translucent circular liquid membranes/ribbons that fold, flow and wrap around a central core. The result should feel like a living liquid-glass intelligence rather than a static sphere or copied reference asset.

The orb has continuous state-driven motion. Idle is slow breathing, subtle rotation, particle drift and low-amplitude fluid deformation so the interface never looks frozen. Listening reads real microphone amplitude/frequency information and reacts proportionally: quiet speech creates small ripples and particle movement, normal speech creates stronger expansion/deformation, and bass/loud energy produces a controlled stronger shake/pulse without becoming visually unstable. Speaking uses synthesized-audio energy but a visibly different motion signature from Listening. Thinking increases internal network propagation and core activity. Browser execution and computer execution use separate directional/structural motion patterns so users can distinguish acting from thinking.

Jarvis state labels remain simple: Listening, Thinking, Speaking, Working in browser, Working on computer, Waiting for permission, Paused, Complete and Error. Text/iconography must communicate state even if color is disabled. User-selectable orb accent themes are allowed, but the default remains black/silver/white. Theme selection should not expose a complicated color editor; use a small curated control.

Only a small set of controls remain visible: voice/text input, optional theme control, Pause, Take over, Stop and Return to Normal. When browser/computer observation is needed, open a contextual side/split panel that can show the controlled environment without permanently shrinking the orb. Permission overlays temporarily take focus and then disappear after resolution.

Jarvis rendering must support reduced-motion/transparency preferences and a safe static/CSS fallback. Heavy Three.js/WebGPU/audio visualizer code is lazy-loaded only when Jarvis opens and must not slow ordinary Chat/Cowork first paint.

## Code

Code uses the same shell but changes the workspace to a professional coding-agent surface. The empty/session-entry view is sparse: a welcome line, compact list of recent coding sessions, repository/environment/branch context chips and a focused prompt composer near the lower central area. Do not show an entire IDE chrome before a repository/session is opened.

Once working, the deeper layout combines the best useful concepts from Claude Code, VS Code, Cursor and the donor without becoming crowded. A collapsible file tree is on the left of the work area, the editor/work surface is central, a contextual diff/agent/diagnostics inspector opens on the right when needed, and a collapsible terminal lives at the bottom. Users can hide panels to return to a conversation-first view.

Git defaults to simple branch/status/diff visibility. Advanced Git actions live in contextual menus. Diffs emphasize additions/deletions and reviewability without relying only on red/green. AI edits must be reviewable before destructive application according to permission policy. Terminal state, tests, diagnostics and preview verification must clearly separate running, passed, failed and cancelled states.

## Projects

Projects should closely follow the sparse reference structure. The page title sits near the upper-left of the workspace content grid. Search/sort and one New project action align to the upper-right. With no projects, center a small original line illustration, a short explanation and one New project button. Do not show a permanent new-project form and a giant blank details panel when there are no projects.

With projects, present clean cards/list rows with title, useful counts/recent activity and subtle metadata. Opening a project creates a coherent workspace with restrained navigation for Overview, Chats, Files, Tasks, Artifacts, Code, Memory and Activity. These subviews should share layout and component patterns with their global equivalents.

## Tasks

Tasks adopts the sparse scheduled-work reference rather than a dashboard-heavy Kanban as the default. A large Tasks/Scheduled heading and one-line explanation appear at the top, followed by small search/sort and one New task action. The default content is a compact readable list of tasks/runs with status and next trigger. If empty, use a simple original clock/work illustration and one short message.

Helpful task examples/templates may appear lower on the page in a two-column or responsive list with small icons and schedule text. Board, timeline, analytics and other advanced views remain optional secondary tabs rather than the first thing every user sees.

## Artifacts

Artifacts uses a large heading, a compact tab/filter strip such as All/Yours/Shared with you, search and one New artifact action. The primary library is preview-led cards with an image/preview region and compact title/metadata footer. The layout should feel like a content library, not a database table.

Grid/list toggle is permitted. Provenance, source project, versions, integrity and detailed metadata should live in a contextual inspector or details view instead of crowding every card. Empty state uses one illustration/short message and a clear explanation of how artifacts are created.

## Customize

Customize uses a minimal tab row for Skills, Connectors and Plugins followed by Discover/Yours. Search, filter/sort and one Add action are right-aligned and visually quiet. A single featured capability may use a larger card; normal capabilities appear in a clean responsive grid with title, short description, provider/origin if appropriate and one Add/Manage affordance. Never show an integration as available merely because an icon/card exists.

## Search

Global Cmd/Ctrl+K search is fast, keyboard-first and context aware. The overlay supports both navigation commands and authorized content results. The dedicated Search page is for deeper results/filters, not a duplicate navigation menu. Results highlight useful snippets and canonical destinations while avoiding huge result cards.

## Settings

Settings absorbs technical destinations that previously cluttered navigation: Models/Offline Intelligence, Devices, Permissions, Connections, Intelligence, Usage, Billing, Appearance, Voice, Notifications, Privacy, Security, Sessions, Data, Support and account deletion. Use a narrow settings sub-navigation and focused detail pane rather than a grid of dozens of cards. Dangerous actions stay in a clearly separated Danger area.

## Landing page

The first-visit landing page is commercial but restrained. Use a strong OCADE hero, concise explanation and two actions: Get started as primary and Sign in as secondary. The page should then move through purposeful sections for What OCADE does, Chat/Cowork/Code, Offline Intelligence, browser/computer control, Projects/Tasks/Artifacts, privacy/security, plans, FAQ, final CTA and legal footer.

Do not overload the hero with technical model names, storage implementation or twenty feature badges. Offline Intelligence may begin in the background but its progress should be a small non-blocking status, not a full-screen installer.

## Light mode

Light mode is complete rather than an inverted afterthought. Preserve hierarchy through neutral whites/greys, borders and typography. Semantic red/green and Jarvis accent logic remain scoped. Avoid pure-white flashes during dark-mode bootstrap by setting the correct initial background before React hydration.

## Motion

Ordinary product transitions are subtle and fast: drawers/panels, hover/focus, route state and composer expansion should feel polished but never delay input. Jarvis is the only high-motion surface. All animation must obey reduced-motion preferences and cannot be required to understand state.

## Empty, loading, error and recovery states

Every major surface has a deliberate empty state that explains what can be done next with one primary action. Loading uses stable skeleton/progress treatment that does not shift layout unpredictably. Error messages state the actual problem and useful recovery action. Session expiry preserves recoverable form/input state when safe. Offline states distinguish “app shell available” from “Supabase unavailable” and “online intelligence unavailable.”

No production page should render a blank giant panel simply because a query returned no rows.

## Responsive behavior

Required widths include 320, 375, 768, 1024, 1440 and 1920 CSS pixels. On mobile the primary rail becomes a compact accessible navigation surface while retaining Chat/Cowork/Code/Projects/Tasks/Artifacts/Search/Customize/Settings. The composer must remain usable above the virtual keyboard, safe-area insets are respected and modal/drawer controls stay reachable with touch targets at least 44×44.

Code may simplify panel layout on narrow devices while preserving session/task visibility and safe read-only/manual actions. Cowork browser/computer observation may become a full-height sheet. Jarvis orb adapts to available viewport without clipping essential controls.

## Accessibility

Target WCAG AA. All controls require accessible names, visible keyboard focus and sensible tab order. Dialogs trap and return focus correctly. Streaming, task state, permission prompts, usage lock and errors need screen-reader announcements that do not spam. Red/green states require icon/text alternatives. Support 200% zoom and platform text scaling without horizontal page overflow. Reduced-motion/transparency modes must still present complete state.

## UI anti-patterns to remove

Do not retain the old “More” dashboard, giant diagnostic panels, duplicate page headers, dozens of equally prominent buttons, permanent empty detail panes, fake controls, raw model/provider lists, developer-only status text in customer UI, repeated navigation links or inconsistent feature-local cards. Do not add a second design system for Jarvis or Code. Every surface should derive from the same OCADE tokens/components and then specialize only where the task truly requires it.

## Visual completion standard

The final visual route matrix must prove every public/auth/signed-in/settings/organization/admin route in dark and light modes at representative widths. Every visible control is audited for reachability. Screenshot/chroma checks should catch accidental product-color drift, overflow, white flash, dead controls and inconsistent layout. The visual target is a product that a Claude/ChatGPT user understands immediately, an OpenClaw-style autonomy user trusts, and an OCADE customer recognizes as a distinct premium product.
