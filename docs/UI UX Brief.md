# OCADE UI/UX Design Brief

## Aesthetic

Dark-mode-first, minimal, premium and calm. Interaction density should feel closer to leading conversational AI products than to a dashboard SaaS. Use the repository's Grok reference screenshots in `docs/design-references/grok/` as interaction/layout references, not as a license to copy branding.

The product should feel simple even when the implementation is complex.

## Brand hierarchy

- Use **CARCC** as the company name.
- Use **OCADE** as the product name.
- Use **Command the Next Era.** as the approved tagline.

Normal product chrome leads with OCADE. CARCC appears where company ownership/about/legal context is useful. Never show CARCC CADANE/CADANE as current branding.

## Color

- Use near-black or charcoal backgrounds.
- Use a neutral white and grey foreground hierarchy.
- Use restrained accents only when they communicate state or action.
- Avoid a bright dashboard-style palette.
- Glass effects are medium/subtle, not cinematic.

## Typography

Use the existing repository fonts/tokens. Prioritize readability, compact labels and clear hierarchy. Avoid decorative movie-title typography.

## Layout

### Desktop
- Keep a stable left navigation on desktop.
- Center the Chat workspace at a comfortable reading width.
- Anchor the composer naturally near the bottom of the Chat workspace.
- Settings as a focused panel/dialog, not a separate dashboard.

### Tablet
- Collapse navigation on tablet when the available width requires it.
- Keep the same core functionality available on tablet layouts.

### Phone
- Use drawer navigation on phones.
- Use full-width content and composer layouts on phones.
- Settings category selector becomes compact; fields may stack.
- 360–375 px must have no horizontal overflow.
- Touch targets must remain reachable and readable.

## Components

### Buttons
Use native accessible semantics. Primary actions are obvious; secondary/destructive controls are quiet until needed.

### Forms
Visible labels or accessible names. Clear validation. Never compress labels word-by-word beside fixed controls on small screens.

### Cards
Use only when grouping genuinely benefits comprehension. Avoid card walls.

### Navigation
Current product navigation emphasizes Chat and Library. Cowork may appear only as a clearly reserved placeholder. Do not surface unused future modules.

### Modals and dialogs
Use for confirmation/focused settings. Escape/click-away behavior must be predictable. Destructive actions require clear confirmation.

### Tables
Use only where structured comparison/admin data genuinely needs them. Responsive fallbacks required.

## Chat patterns

- Empty Chat is calm, not marketing-heavy.
- Composer: attachment, text, Auto/Online/Offline, Thinking/Research when applicable, microphone, Send/Stop.
- Keep user and assistant message actions compact.
- Highlighting text may surface **Ask OCADE**.
- Helpful / Not helpful feedback is discreet.
- Citations/sources are readable and attached to the answer they support.

## Offline UX

Never show OPFS, GGUF, WebGPU, WASM, R2, provider names or model names.

Customer language:
- Show **Preparing Offline** while the Offline setup is being prepared.
- Show **Downloading** while model data is being transferred.
- Show **Verifying** while integrity checks are running.
- Show **Ready** only after Offline Intelligence is usable.
- Show **Repair** when the existing installation needs safe repair.
- Show **Removed** only after local model removal is verified.
- Show **Install Offline** as the clear action when Offline Intelligence is not installed.

On mobile data, explain that installation uses a large download and offer Continue/Cancel. Do not permanently block cellular/hotspot.

If Offline was explicitly removed, later sign-in and choosing Offline should make reinstall easy without forcing the user to hunt through Settings.

## Loading, empty and error states

Every async view has bounded states:
- Show a skeleton or progress state while work is active.
- Show a success state when the operation completes.
- Show an empty state when no content exists.
- Show an error state with Retry when recovery is possible.
- Show a cancelled state when the user cancels an operation.

No endless spinner.

## Accessibility

- Make every important interaction usable with the keyboard.
- Keep focus indicators visible.
- Give interactive controls accessible names.
- Maintain sufficient contrast in dark and light modes.
- Respect reduced-motion preferences.
- High contrast supported where current settings expose it.
- Do not make important controls hover-only.

## Do not

- Do not expose technical implementation terminology.
- Do not show provider, model or vendor identity.
- Do not build dashboard-style card walls.
- Add orange/red-heavy branding unless required for semantic warning/destructive state.
- Create new current-scope modules not approved in PRD.
- Use horizontal page scrolling on mobile.
