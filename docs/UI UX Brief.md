# UI UX Brief

## Purpose

This brief defines the intended OCADE experience, interaction priorities and screen-level product character. It complements `docs/DESIGN.md` rather than replacing it: this file explains what the experience should feel like and how users should understand it; `DESIGN.md` remains the detailed design-system/component/layout authority; `APP_FLOW.md` owns routing and journeys; `PRD.md` owns product scope.

The documentation is deliberately separated this way so design intent can be read quickly without copying the full component/token specification into multiple files.

## Product Experience Goal

OCADE should feel like one calm, premium AI workspace that can move naturally from asking to doing. Chat, Cowork and Code are not three disconnected applications. They share one shell, one account, one intelligence identity, one project/task/artifact context and one visual language.

The product should make advanced capability feel obvious rather than overwhelming. A new user should understand where to type and what OCADE can do within seconds. An expert user should still be able to reach agents, tools, permissions, projects, code, automation, browser/computer control and diagnostic detail through progressive disclosure instead of permanent dashboard clutter.

## Reference Products

Claude is the primary behavioral and information-architecture benchmark: narrow navigation, generous workspace, focused composer, restrained controls, sparse Projects/Artifacts/Tasks-style pages, clear Cowork progress and strong Code workflow clarity.

ChatGPT is a secondary benchmark for universal chat discoverability, composer polish, attachments/media, multimodal interaction and responsive/mobile familiarity.

OpenClaw is a secondary benchmark for transparent agent/computer-use behavior: clear observation, current action, autonomy boundaries, pause/takeover/stop, recovery and truthful execution state.

OCADE must remain independently branded and implemented. Do not copy proprietary source, text, icons, assets or pixel-for-pixel trade dress.

## Audience

The default experience must work for non-technical users who simply want to ask, create or delegate, while retaining depth for developers, founders, professionals, analysts, operators and teams. The UI should not require users to understand model vendors, database concepts, agent internals or native-host architecture.

Customer-facing model language is OCADE Intelligence / Offline Intelligence. Raw provider/model/runtime identifiers belong only in appropriate diagnostic/admin contexts.

## Information Architecture

The primary signed-in navigation is intentionally short:

- Chat
- Cowork
- Code
- Projects
- Tasks
- Artifacts
- Search
- Customize
- Settings

The old More/dashboard pattern is not a primary destination. Useful functionality is placed under the surface that owns it. Recent conversations/tasks can appear as restrained shortcuts without becoming a second navigation hierarchy.

The account/organization switcher and profile controls live at the bottom/account area. Global search/command access is available through Cmd/Ctrl+K as well as the Search destination.

## Entry Experience

A first unseen visitor sees the commercial landing page with one dominant Get started action and a secondary Sign in path. The page explains OCADE through a focused sequence rather than a feature wall: core Chat/Cowork/Code value, Offline Intelligence, browser/computer work, Projects/Tasks/Artifacts, privacy/security, plans, FAQ and final CTA.

Offline Intelligence may prepare quietly in the background during this first visit where browser capability permits; the visitor should not be blocked by a model-install onboarding step.

Returning authenticated users go straight to Chat. Returning previously-seen signed-out users go straight to Sign in. Successful authentication enters the intended authorized deep link or Chat. There is no onboarding wizard and no separate signed-in dashboard.

## Global Shell

Desktop uses a narrow dark-first left rail and a large uncluttered workspace. The shell should feel closer to a focused creative/productivity tool than an admin dashboard. Avoid large stacks of cards, permanent diagnostic panels and repeated headers.

One prominent New action is enough. Secondary actions appear contextually. The workspace should own most of the viewport. Right-side inspectors and lower panels are collapsible and appear only when their information is useful.

On mobile, preserve the same conceptual destinations with a compact drawer/bottom-compatible pattern, safe-area spacing and correct virtual-keyboard behavior. Do not create a separate mobile information architecture.

## Chat Experience

### Empty state

The empty Chat view centers a short greeting and generous composer. The composer is the visual anchor. Default visible actions are attachment, intelligence mode, voice where relevant and send. Web retrieval, tools, project/context and Incognito remain available but should not occupy equal visual weight.

### Active conversation

Conversation content has comfortable reading width and strong hierarchy. Tool activity, citations, file previews and generated artifacts appear inline only when useful. Message actions such as retry, branch, copy, share or regenerate should be contextual rather than permanently surrounding every message.

Streaming should feel stable: no layout jumping, repeated completion announcements or flashing progress. Stop/retry/failure states are explicit. Usage/provider/model failures explain what happened without exposing secrets or raw vendor plumbing.

### History and lifecycle

Recent chats are compact. Search handles older history. Rename/archive/trash/restore/export/share actions live in a clear conversation menu. Incognito is visibly distinct and explains that it will not persist.

## Normal Cowork Experience

Normal Cowork is practical and outcome-oriented. The first screen resembles the same focused composer language as Chat rather than a command center full of panels.

After a mission begins, show:

- concise plan or current goal;
- the current verified step;
- meaningful approval requests;
- essential persistent controls: Pause, Take over and Stop;
- a collapsible Command Center inspector for device/browser connection, permissions, receipts and diagnostics.

The interface should make it clear whether OCADE is observing, acting, waiting for permission, recovering or complete. Do not show simulated progress. An action is presented as complete only after postcondition verification.

## Jarvis Cowork Experience

Jarvis is the expressive presentation of the same Cowork runtime. It uses a near-black canvas dominated by one original OCADE intelligence orb rather than a conventional dashboard.

### Orb direction

The orb combines fine network points/filaments with layered translucent liquid membranes. It should feel volumetric, computational and alive without copying a supplied reference asset. Light, depth and motion are restrained enough to remain premium.

### State behavior

- **Idle:** slow breathing, particle drift and subtle membrane movement.
- **Listening:** microphone amplitude/frequency drives expansion, compression, ripples and internal vibration.
- **Thinking:** internal energy/propagation increases without mimicking speaking.
- **Speaking:** synthesized audio drives a clearly different pulse pattern.
- **Working in browser:** directional movement indicates active external execution.
- **Working on computer:** a distinct execution pattern differentiates OS work from browser work.
- **Waiting for permission:** motion calms and the approval request becomes the focus.
- **Paused:** stable low-energy state.
- **Complete:** short resolved transition, not an endless celebration animation.
- **Error/recovery:** clear text/state treatment, never color alone.

Essential controls are voice/text fallback, scoped accent/theme, Pause, Take over, Stop and Return to Normal. Browser/computer observation can slide into a contextual split view while the orb remains the defining Jarvis surface.

Reduced-motion users receive a calm low-motion/static equivalent with the same state clarity. Heavy rendering is lazy-loaded so ordinary Cowork and first paint do not depend on it.

## Code Experience

Code should feel like an AI coding workspace, not a permanently exposed full IDE clone. Entry is sparse: recent sessions/repositories, environment/repository/branch context and a focused prompt composer.

When a coding session needs depth, expose progressively:

- collapsible file tree at left;
- editor/work surface at center;
- diff/agent/diagnostic inspector at right when needed;
- terminal at bottom when needed;
- compact Git branch/status/diff context.

AI changes are reviewable and reversible. Destructive Git/terminal/native operations are permission-gated. Terminal or CI output must be real, never decorative. Manual editing remains available when AI usage is exhausted.

## Projects Experience

Projects is a clean list/grid page with a large title, compact search/sort and one New project action. The empty state uses simple imagery/iconography, one concise explanation and one CTA.

Inside a project, Overview/Chats/Files/Tasks/Artifacts/Code/Memory/Activity may be organized as contextual sections/tabs. Avoid giant bordered placeholder panels. A Project is a context container, so UI should communicate relationships rather than copying content into project-specific duplicates.

## Tasks Experience

Tasks presents a readable compact list by default. Scheduled/recurring/monitoring work, action-required items and run history use the same task vocabulary. One New task action owns creation.

Advanced board/timeline/analytics modes are secondary. Executor requirements such as browser extension or Windows host are disclosed before execution. Approval, failure and recovery states should be visible without requiring the user to inspect logs.

## Artifacts Experience

Artifacts uses All/Yours/Shared-style filtering, search and one New artifact action. Cards emphasize preview and title; provenance, versions, integrity and originating conversation/task/project belong in a contextual inspector.

Opening an artifact should make preview/edit/export/restore/share/delete understandable without turning the page into a metadata dashboard.

## Search Experience

Search is global, authorized and fast. Cmd/Ctrl+K handles quick navigation/commands; the full Search page handles richer results. Results identify type and context clearly. No-results and error states are distinct: an error must never masquerade as an empty search.

## Customize Experience

Customize groups Skills, Connectors and Plugins with Discover/Yours views. Search/filter/sort remain compact. One Add/Connect action dominates capability setup. Unconfigured integrations are hidden or precisely marked unavailable instead of displayed as decorative disabled logos.

## Settings Experience

Settings owns specialist controls so the primary work surfaces remain uncluttered. Logical groups include Models, Devices, Permissions, Connections, Intelligence, Usage, Billing, Appearance, Voice, Notifications, Privacy, Security, Sessions, Data, Support and account deletion.

Offline Intelligence state must be truthful: installed/verified, downloading, paused, repairing, removed or unavailable. Remove Offline Intelligence is separate from account deletion. After deliberate removal, do not immediately reinstall automatically.

Usage clearly shows remaining/reset state. Reaching the AI limit disables new generation but leaves history, manual editing, Projects, Tasks, Artifacts, Settings and Billing usable.

## Organizations and Admin Experience

Organization/account switching is compact and predictable. Member/invite/group/seat/policy/audit screens may use tables when structured comparison is useful, but consumer-facing workspace pages should not inherit admin-table density.

Platform Admin and support interfaces are operational, least-privilege and explicit about scope. Sensitive actions show target account/organization, reason, impact and verification requirements before commit.

## Billing Experience

Billing must communicate plan, cadence, currency, renewal/cancellation terms and authoritative status clearly. Payment success, failure and pending states are views over server-confirmed state, not entitlement triggers.

Refunds, disputes and manual grants are clearly distinct. An Admin grant should never look like a payment transaction.

## Visual Language

OCADE is dark-first with supported light appearance. Ordinary UI uses black/near-black, silver, white and neutral greys. Semantic red is for real danger/error and verified green for success where useful. Jarvis may use user-selected luminous accents scoped to the orb/related glass surfaces.

Use soft rounded rectangles, subtle borders/luminance layering and very restrained shadows. Avoid heavy card frames, neon gradients across ordinary pages, excessive pills and decorative status badges.

Typography follows the existing repository type system. Inter is the default interface face. Instrument Serif may appear sparingly in brand/display moments. Code/terminal uses the existing monospace authority/platform stack. Do not add a new font dependency solely for visual novelty.

## Interaction Rules

One primary action per local decision point. Secondary actions use neutral buttons, text/icon controls or menus. Icon-only controls require labels/tooltips and accessible touch targets. Destructive actions use explicit language and proportional confirmation.

Dialogs are for short focused decisions, approvals, connection setup and confirmation. Long workflows belong on pages/inspectors. Focus must enter, remain within and return from modal content correctly.

Lists are preferred for normal user records. Tables are used where comparing structured columns genuinely helps, especially Admin/billing/audit contexts. Growing lists use pagination or incremental loading rather than rendering everything at once.

## Loading, Empty and Error States

Every major surface intentionally supports Loading, Empty, No results, Error, Success, Permission denied, Offline, Reconnecting, Session expired and Recovery. Public routing additionally requires intentional 404, 403, 500 and Maintenance states. Billing requires Payment success, Payment failed and Payment pending.

Loading states reserve space and avoid layout shifts. Empty states explain purpose and offer one next action. Errors state what failed, what remains safe/preserved and what recovery is possible. Provider/network/permission/session/usage/host/model failures should not collapse into one generic message.

## Responsive and Mobile Requirements

Production proof covers 320, 375, 768, 1024, 1440 and 1920 pixel widths as defined by the plan/testing authority. Touch targets are approximately 44×44 where practical for primary controls, safe-area insets are respected, virtual keyboards do not obscure composers and side inspectors become mobile sheets/full-height surfaces.

Deep links, OAuth return, browser back behavior and session recovery must remain correct on mobile. Host/extension-required actions show truthful availability rather than pretending local phone/tablet execution exists.

## Accessibility Requirements

Target WCAG AA. All controls are keyboard reachable with visible focus. Screen readers receive semantic headings/landmarks and useful names for icon-only controls. Streaming/task/approval/error completion uses restrained live announcements. UI remains usable at 200% zoom. Color is never the only status signal. Motion and voice always have text/reduced-motion equivalents.

## Performance Experience

The UI should feel fast because first paint loads only the shell/current route essentials. Code editor, PDF tooling, Jarvis/Three.js, local model runtimes and native/media features are lazy-loaded. Images use appropriate responsive/lazy strategies. Avoid repeated startup requests, unnecessary rerenders, giant eager bundles and persistent GPU animation outside explicit Jarvis/visual contexts.

## Copy and Content Tone

Copy is concise, calm and specific. Use OCADE terminology consistently. Avoid internal architecture jargon in normal customer UI. Never say something is secure, verified, connected, complete, paid, refunded, installed or controlled unless the corresponding authority has actually proven that state.

## Do

- Keep Chat, Cowork and Code visibly related.
- Make the composer/task goal the main focus.
- Prefer progressive disclosure over dashboards.
- Show real execution state and meaningful approvals.
- Preserve clear mobile/accessibility/reduced-motion behavior.
- Use OCADE's own branding, components and copy.
- Keep both this experiential brief and `DESIGN.md`; use cross-references instead of duplicated design-system detail.

## Do Not

- Do not pixel-copy Claude, ChatGPT or OpenClaw.
- Do not bring back the old More/dashboard clutter.
- Do not expose every backend capability as a permanent button.
- Do not show fake disabled controls for future features.
- Do not make Jarvis a second Cowork engine.
- Do not make model vendor names the normal customer experience.
- Do not animate large page layouts continuously or sacrifice accessibility/performance for novelty.
- Do not use decorative success states where postconditions have not been verified.
