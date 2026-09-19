# OCADE Design System

## Design philosophy

OCADE is conversational first: simple on the surface, powerful underneath. The interface should reduce decisions, not advertise architecture.

## Visual direction

- Keep the visual direction dark, premium and minimal.
- Use a near-black or charcoal foundation.
- Use a neutral white and grey hierarchy for text and surfaces.
- Use restrained, medium-strength glassmorphism.
- Use soft rounded geometry.
- Keep borders and shadows minimal.
- Use subtle motion only when it has a clear purpose.

Reference interaction/layout screenshots exist under `docs/design-references/grok/`. Use them as inspiration together with the owner requirement for ChatGPT/Grok-like simplicity. Do not copy another company's brand assets.

## Brand

CARCC is the company. OCADE is the product.

Product UI says OCADE. About/legal/company attribution may say CARCC. The former CARCC CADANE/CADANE identity is retired.

Tagline: **Command the Next Era.**

## Typography

Use existing Inter UI font and JetBrains Mono for code where appropriate. Keep headings compact; body text readable; technical/code text clearly differentiated.

## Spacing

Use the existing Tailwind/token scale. Prefer consistent small-to-medium gaps over dense dashboard packing or oversized marketing whitespace inside the app.

## Border radius

Use existing rounded-md/lg/2xl patterns consistently. Conversation bubbles, composer, dialogs and glass panels may be more rounded than ordinary rows.

## Shadows

Subtle only. Glass/border contrast should carry most separation.

## Layout

- On desktop, use a sidebar with a focused central workspace.
- On tablet, use collapsible navigation.
- On phones, use a drawer with a full-width workspace.
- Reading/composer widths remain comfortable.
- No horizontal overflow at 360–375 px.

## Responsive breakpoints

Use existing Tailwind breakpoints unless evidence proves a missing case. Mobile behavior is a first-class design, not a scaled desktop screenshot.

## Component patterns

### Navigation
Only current product surfaces. Avoid exposing dormant/future modules.

### Composer
Clear input, attachment, mode selection, optional reasoning/research, microphone and Send/Stop. State changes should not cause large layout jumps.

### Settings
Compact category navigation; rows stack on small screens.

### Library
Simple filters/search/list/grid only where useful. Generated and uploaded files belong to one Library concept.

### Admin
Role-gated, information-dense enough for operations but still follows product typography/spacing.

## Buttons

Native button semantics, clear focus, concise labels. Destructive actions use semantic destructive styling sparingly.

## Forms

Accessible label, validation and error association. Do not rely on placeholder alone.

## Loading states

Skeleton or real progress when measurable. Permanent Loading/Reading is forbidden.

## Empty states

State what is empty and the next useful action. Do not invent fake data.

## Error states

Short, customer-safe explanation + Retry/recovery. Never expose provider/model/runtime/database internals.

## Animations

Subtle and interruptible. Honor reduced motion.

## Accessibility

WCAG-conscious contrast, keyboard navigation, focus visibility, semantic HTML, screen-reader labels, touch-friendly targets.

## Do not

- Do not use CADANE branding.
- Do not show provider, model, vendor or runtime names in the normal UI.
- Do not show OPFS, GGUF, WebGPU, WASM, R2 or Supabase terminology in the normal UI.
- Do not build card-wall dashboards.
- Do not show unsupported or fake controls.
- Do not show Projects, Tasks, Automations, Organizations or Code surfaces in the current scope.
