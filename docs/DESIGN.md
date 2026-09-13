# OCADE Design System

## Design principle

Maximum usable workspace, minimum visual noise.

OCADE should look like a modern AI workspace rather than a dashboard, game UI or cinematic assistant.

## Foundations

### Color

Use a near-black/charcoal background with neutral grey surfaces and white/soft-grey text.

Keep accent use restrained. Avoid broad saturated gradient fields.

### Glass

Medium glassmorphism is the main surface treatment for interactive containers:

- sidebar;
- composer;
- dialogs;
- settings;
- pricing cards;
- menus;
- attachment surfaces;
- Offline progress.

Glass should use:

- semi-transparent neutral fill;
- moderate backdrop blur;
- thin low-contrast border;
- restrained highlight;
- little or no heavy shadow.

### Radius

Use small/medium radii consistently. Avoid both sharp enterprise-box styling and oversized pill-everything styling.

### Typography

Use simple, readable UI typography with clear hierarchy and no robotic/movie-title treatment.

## Layout

### Desktop

- fixed/steady left sidebar;
- centered Chat workspace;
- generous negative space;
- composer visually anchored near the main content area;
- recent chats compact rather than card-heavy;
- Account/usage at bottom-left.

### Tablet

- preserve Chat as primary workspace;
- narrower drawer/sidebar behavior;
- settings may become a wider sheet/modal;
- controls keep touch-friendly targets.

### Phone

- chat-first;
- sidebar becomes drawer;
- settings becomes full-height/sheet;
- composer remains fully usable with attachments/mic/send;
- no horizontal overflow.

## Chat

Message text should be easy to scan.

User prompts may use a compact bubble/treatment. OCADE answers should favor readable prose rather than excessive cards.

Answer controls appear contextually:

- Copy;
- Regenerate;
- Retry;
- Delete where applicable.

Edit belongs on the user prompt.

## Composer

The composer is a primary glass surface.

Required controls:

- attachment `+`;
- microphone;
- Auto/OCADE/Offline selector;
- Send/Stop.

Attachment chips appear inside/above the composer without forcing a second permanent toolbar.

## Usage meter

Small and informative, not dashboard-like.

Example:

```text
18 of 28 left · 2h 14m
```

Add a thin progress indicator and Upgrade when relevant.

## Pricing

Three clean tier cards with weekly/monthly toggle.

Current plan is obvious. Upgrade actions are clear. Avoid a huge feature-comparison wall unless a future requirement needs it.

## Offline status

Background preparation should not take over the whole product.

Compact status near Account/sidebar. Detailed progress only after click.

Intentional uninstall state is explicit and persistent:

> You uninstalled OCADE Offline. Get it back to use OCADE without internet.

## Motion

Use subtle purposeful motion only:

- hover/focus easing;
- panel/dialog transitions;
- streaming state;
- progress state;
- small Offline preparation animation.

No infinite decorative orbit/scene.

## Accessibility

- visible focus states;
- adequate contrast;
- semantic controls;
- keyboard support;
- screen-reader labels;
- `prefers-reduced-motion` honored;
- readable type scale;
- touch targets appropriate for phone/tablet.

## Reference policy

`docs/design-references/grok/` and owner-supplied repair screenshots define layout/density direction.

Do not copy proprietary logos/assets or attempt a pixel-identical trade-dress clone. Preserve OCADE identity.
