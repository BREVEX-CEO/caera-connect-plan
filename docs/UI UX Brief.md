# OCADE UI UX Brief

## Experience goal

OCADE should feel almost empty until the user needs something.

The sole visual benchmark is the supplied Grok-style reference set under `docs/design-references/grok/`: narrow left sidebar, large clean workspace, compact controls, minimal copy and compact settings. Use the reference for structure/density/behavior, not proprietary logos, copy or pixel-for-pixel trade dress.

The former Stitch/Jarvis 3D reference is removed. Cowork and Jarvis use the same simplified OCADE visual language.

OCADE remains independently branded.

## Visual character

- near-black background;
- white/soft-grey text;
- subtle neutral borders;
- light glassmorphism only: slight transparency, soft blur, tiny highlight, almost no shadow;
- small/medium corner radius;
- very few cards;
- one primary action per decision;
- short labels and one-line errors;
- generous empty space;
- subtle hover/cursor response and fast transitions;
- no neon walls, giant gradients or continuous decorative motion.

## Desktop shell

Left:

```text
OCADE
+ New chat
Chat
Library
Cowork
Recent chats
...
Account
```

Top bar may contain back/forward and chat search. The workspace takes most of the viewport.

Settings opens as a compact centered panel from Account.

## Mobile

Use a Chat-first drawer pattern. The composer remains reachable above the virtual keyboard. Preserve safe-area insets and touch targets. Do not invent a different mobile product.

## Chat

Chat is `/`.

Empty state:

```text
Ask OCADE
```

Composer default controls:

- attachment `+`;
- microphone;
- send.

Intelligence is automatic. A compact optional selector may show only:

- Auto
- OCADE
- Offline

Never show the internal offline model name, provider names, file hashes, GGUF, WebGPU/WASM or runtime plumbing in normal UI.

Do not show prompt suggestion chips by default. Do not show duplicate chat search or duplicate sidebars. Contextual actions appear on hover/menu.

Failures are concise. A request that produced no answer must not be rendered as a fake response/artifact with Export/Save buttons.

## Library

```text
Library
All | Images | Files
Search
```

Use a simple grid/list with preview and title. Technical provenance stays behind Details if needed.

## Cowork

Normal mode should look related to Chat, not like an engineering command center.

Before run: one composer and recent work.

During run: concise goal, short verified checklist, meaningful approvals, Pause/Take over/Stop. Detailed receipts are secondary.

## Jarvis

Jarvis lives inside Cowork. It is voice-first/hands-free over the same runtime.

Remove the old giant moon/solar-system scene. Use a small original OCADE audio/orb indicator in or near the composer. Microphone/listening state must be obvious and controllable. Do not introduce a separate cinematic/3D design system.

## Settings

Compact categories:

- Account
- Appearance
- Notifications
- Data Controls
- Billing
- Advanced

Advanced hides diagnostics/native/runtime detail.

Data Controls keeps delete-all conversations, delete uploaded files/images, export and Offline Intelligence controls.

## Motion

Use subtle hover luminance, 1–2 px movement at most, soft focus and short transitions. Respect reduced motion. No cursor trails or large always-running 3D animation.

## Loading and state

Use skeletons where layout is known. Empty states contain one concise explanation/action. Toast only for transient confirmation. Preserve distinct offline, reconnecting, auth-expired, usage-exhausted and permission-denied states.

## Reference checklist

`docs/UI_REFERENCE_CHECKLIST.md` is guidance, not a reason to add unnecessary UI.

Use when relevant: dark/light handling, mobile menu, shortcuts, hover/focus, scrollbar polish, copy, skeletons, sticky shell, skip-to-content, OpenGraph, empty states, toasts, password visibility.

Conditional: cookie consent only when optional cookies require it; FAQ accordion only in Help; back-to-top only on long Help/legal pages.
