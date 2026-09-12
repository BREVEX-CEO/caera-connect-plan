# OCADE UI/UX Brief

## Goal

OCADE should feel fast, calm, premium and focused on the current task. The interface is chat-first, not dashboard-first.

Use the Grok reference images under `docs/design-references/grok/` and the owner-provided repair screenshots as structural/density references only. Keep OCADE branding, copy and implementation original.

## Visual language

- near-black/charcoal base;
- clean white/grey typography;
- medium glassmorphism on high-value surfaces;
- subtle blur/transparency;
- thin neutral borders;
- restrained highlights;
- minimal shadow;
- small/medium radii;
- no giant gradients;
- no cinematic 3D scene;
- no neon-heavy styling;
- no cluttered card grids.

## Where glass belongs

Use medium glass treatment on:

- sidebar;
- composer;
- settings modal/sheet;
- dialogs;
- pricing cards;
- menus/dropdowns;
- attachment previews;
- Offline preparation/progress panel.

Do not turn every content block into a glass card.

## Motion

Allowed motion:

- smooth panel open/close;
- subtle hover movement;
- short opacity/blur transitions;
- gentle streaming indicator;
- model download/progress movement;
- small Offline preparation animation.

Respect `prefers-reduced-motion` and remove unnecessary motion when requested.

## Main shell

Desktop sidebar:

- OCADE brand;
- New chat;
- Chat;
- Library;
- Cowork placeholder;
- recent chats;
- compact usage meter near Account;
- Account at bottom.

Pricing should be reachable from Upgrade/Billing and public navigation where appropriate, but should not clutter the primary Chat sidebar.

Mobile/tablet use a compact drawer/sheet while preserving the same information hierarchy.

## Chat empty state

Centered, spacious, minimal:

```text
Ask OCADE
[ composer ]
```

No suggestion-chip wall.

Composer includes attachment, microphone, Send/Stop and compact Auto/OCADE/Offline selector.

## Usage

Near Account/sidebar show a compact meter, for example:

```text
18 of 28 left · 2h 14m
```

Low allowance may show subtly near Send with Upgrade.

Billing shows the full allowance/session/week details.

## Offline preparation

Installation runs without blocking normal online Chat.

Show compact status:

```text
Preparing OCADE Offline · 43%
```

Clicking opens a glass progress panel with percentage, speed/status and Pause/Resume/Cancel.

If intentionally uninstalled:

> You uninstalled OCADE Offline. Get it back to use OCADE without internet.

Show **Install Offline**.

## Pricing

`/pricing` contains clean Free/Pro/Max glass cards with:

- weekly/monthly switch;
- regional currency + manual selector;
- concise allowance summary;
- Upgrade/Current plan action;
- no overlong comparison matrix.

## Settings

Desktop: compact centered modal.

Mobile: sheet/full-height layout.

Categories:

- Account
- Appearance
- Notifications
- Data Controls
- Billing
- Advanced

## Attachments

Before Send:

- thumbnail/file chip;
- upload state;
- remove;
- reorder;
- retry failed upload.

After Send:

- preview where supported;
- download;
- clear file metadata.

## Accessibility

- WCAG AA intent;
- visible focus;
- keyboard navigation;
- semantic controls;
- screen-reader labels;
- reduced-motion support;
- no information conveyed by color alone;
- no sideways overflow at phone/tablet widths.

## Responsive quality bar

Desktop, tablet and phone each require deliberate spacing/controls. Do not merely shrink the desktop layout.