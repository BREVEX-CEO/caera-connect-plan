# OCADE Design System

## Design outcome

OCADE should feel like a polished premium AI product with maximum usable workspace and minimum visual noise. The current Chat-first mission must remove the unfinished/developer-dashboard feeling visible in permanent loaders, large empty panels, sharp boxes, and controls that describe capabilities that no longer exist.

## Visual foundation

Use a near-black/charcoal background with neutral dark-grey surfaces and white/soft-grey text. Use accent color sparingly for state and focus rather than filling the interface with gradients.

Use restrained medium glassmorphism on high-value interactive surfaces such as the composer, Settings/dialogs, menus, attachment trays, Offline progress, and upgrade cards. Glass uses a semi-transparent neutral fill, moderate blur, thin low-contrast border, subtle highlight, and little or no heavy shadow.

Corners are consistently soft and rounded. Avoid both sharp enterprise rectangles and oversized pill-everything styling.

Typography is simple, readable, and semantic. Headings, body, labels, captions, and code each have clear hierarchy, consistent line height, and responsive behavior. Do not use movie-title/robotic treatment.

## Shell and navigation

Desktop keeps a steady compact left sidebar with New Chat, Chat, Library, Cowork placeholder, recent/search, and Account. The Chat workspace remains centered and open rather than boxed into a dashboard.

Tablet keeps the same product but narrows/collapses navigation. Phone turns the sidebar into a drawer and Settings into an appropriate full-height/sheet view. No horizontal overflow is permitted.

## Chat

The empty Chat state uses a small OCADE heading/greeting, a few subtle optional suggestions, and the composer. Do not fill the screen with marketing cards.

User prompts may use a compact bubble/treatment. OCADE answers favor open readable prose. Message actions stay contextual until hover/tap where possible. Generated text, tables, links, code, source references, and attachment chips must remain easy to scan.

The composer is the primary glass surface. It contains attachment `+`, growing text input, microphone, `Auto | Online | Offline`, optional Thinking, and Send/Stop. Attachment progress/chips belong inside or immediately above the composer rather than creating a second permanent toolbar.

When Auto switches to Offline because connectivity is absent, use a subtle state/animation that communicates the route change without turning the composer into a status dashboard. When Online is unavailable, disable it clearly rather than allowing a predictable failure.

## Settings

Settings contains Account, Appearance, Notifications, Data Controls, Usage & Limits, Billing, and Advanced in a compact responsive modal/sheet. Avoid huge blank areas. Rows use concise labels and one short supporting sentence only where it helps.

Every data-loading surface uses a bounded skeleton/progress state and then success, empty, or error/Retry. Permanent “Reading your allowance…”, “Reading your sessions…”, or “Loading chats…” is visually and functionally unacceptable.

Offline Intelligence uses clear customer states such as Preparing, Installing, Verifying, Ready, Repairing, Removed, and Install Offline. Do not expose model/runtime implementation terminology.

Usage & Limits shows a small meter and exact reset state without becoming an analytics dashboard. Billing uses clean Free/Pro/Max cards and honest checkout availability.

## Library and attachments

Library keeps All, Images, Files, Search, and Add with a useful empty state. Upload/drop states provide visible progress and recovery. File cards/chips are compact; technical parser/security details appear only as short customer-safe errors when needed.

## Motion

Motion is subtle, fast, and purposeful: hover/focus easing, panel transitions, streaming, attachment progress, Auto→Offline indication, and Offline installation progress. Respect `prefers-reduced-motion` and never depend on animation to convey the only meaning.

## Accessibility

Use semantic controls, visible focus, sufficient contrast, keyboard support, screen-reader labels, touch-friendly hit targets, reduced-motion support, and responsive text. Hover-only actions gain an equivalent tap/focus path on touch/keyboard devices.

## Reference policy

Owner-supplied screenshots and the existing Grok-like references guide density, spacing, hierarchy, and simplicity. They are references, not assets to clone pixel-for-pixel. Preserve OCADE branding and original implementation.

## Repository-wide completion rule

This document is subordinate to the active implementation authority in `PLAN.md` and the engineering rules in `CLAUDE.md`, `docs/RULES.md`, and `docs/TESTING.md`. Complete the active plan, fix root causes with regression coverage, then run the separate adversarial enterprise-grade AI-platform QA pass before calling the product complete. After correctness is proven, apply YAGNI and KISS to remove safely unnecessary code and reduce duplicate authorities and maintenance surface. GitHub Actions is optional; required verification must still run through trusted local or agent execution and the existing direct production authorities.
