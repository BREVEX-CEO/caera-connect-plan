# OCADE UI Reference Checklist

Use this checklist when reviewing every production surface. Each item is a sentence-level requirement rather than a decorative suggestion.

## Global shell

- The sidebar is compact, aligned, consistently rounded where selected, and never wider than the content needs.
- Chat remains visually dominant while Library, Cowork placeholder, recent history, and Account remain easy to find without competing for attention.
- Desktop, tablet, and phone layouts are intentionally designed rather than a desktop canvas merely squeezed smaller.
- The interface uses near-black/charcoal, neutral grey/white, restrained glass, soft corners, subtle borders, and minimal visual noise.
- No customer-facing surface contains provider/model/runtime implementation names, raw stack traces, internal endpoint names, or debugging copy.

## Chat

- The empty Chat screen is simple and centered with a clean composer rather than a dashboard of cards.
- The composer provides attachment, text, microphone, `Auto | Online | Offline`, Thinking, and Send/Stop without a second permanent toolbar.
- Auto clearly but subtly indicates Offline routing when connectivity is absent, while Online becomes disabled instead of producing a predictable failure.
- The transcript supports readable Markdown, tables, links, code, attachments, citations, and contextual message actions without enclosing every answer in a heavy card.
- New Chat, title generation, rename, delete confirmation, search, grouped history, drafts, temporary chat, export, Edit, Regenerate, Retry, Stop, Copy, and duplicate-Send prevention all have clear states.

## Loading, empty, and error states

- Every async surface leaves loading within a bounded period and becomes success, empty, error/Retry, cancelled, or genuine progress.
- Chat history never remains on “Loading chats…”, Billing never remains on “Reading your allowance…”, and Advanced never remains on “Reading your sessions…”.
- Empty states explain what can be done next in one short sentence rather than filling the screen with instructional copy.
- Error messages tell the customer what happened at a useful level and what they can do next without exposing internals.

## Attachments and Library

- File upload supports picker, drag/drop, paste, progress, remove, retry, reorder, and preview/download where relevant.
- Dangerous, malformed, oversized, or unsupported files fail safely and visibly before they reach execution or privileged systems.
- Library uses All/Images/Files, Search, Add, and compact result rows/cards with private ownership enforced behind the UI.
- Answers based on files display useful source references where practical.

## Offline Intelligence

- First-sign-in preparation is visible but not blocking, and Online Chat remains usable while preparation runs.
- Offline state uses customer words such as Installing, Ready, Repairing, Removed, and Install Offline rather than backend/model terminology.
- Explicit Remove remains visible as the customer’s choice across refreshes, updates, restarts, and sign-in cycles.
- A compatible verified installation does not redownload after a normal OCADE deployment.
- Offline Chat continues smoothly without Internet when the runtime and cached shell are ready.

## Usage and Billing

- Sidebar usage, composer warnings, Usage & Limits, and Billing all read from the same account-wide commercial authority.
- Usage & Limits shows the exact reset state and what consumes one use without becoming an analytics dashboard.
- Billing shows clean Free/Pro/Max upgrade cards and never fakes payment availability.
- Exhaustion blocks generation only and leaves history, Library, Settings, Pricing, Billing, export, and account management usable.

## Settings

- Settings categories are Account, Appearance, Notifications, Data Controls, Usage & Limits, Billing, and Advanced.
- Stale phone OTP, recovery-code, dead notification, or removed-product descriptions are absent.
- Every switch/button has a real accessible handler and a truthful saved/error result.
- The modal/sheet uses the available viewport efficiently without huge empty panels or clipped content.

## Interaction quality

- Keyboard focus is visible, Enter/Shift+Enter behavior is predictable, and every hover-only action has a focus/touch equivalent.
- Motion is subtle and fast, reduced-motion is respected, and no animation is required to understand state.
- Buttons, menus, inputs, and dialogs use consistent radius, spacing, type hierarchy, and interaction feedback.
- The final browser sweep checks console errors, network failures, stale state, route transitions, refresh/deep links, mobile overflow, and accessibility in addition to screenshots.

## Repository-wide completion rule

This document is subordinate to the active implementation authority in `PLAN.md` and the engineering rules in `CLAUDE.md`, `docs/RULES.md`, and `docs/TESTING.md`. Complete the active plan, fix root causes with regression coverage, then run the separate adversarial enterprise-grade AI-platform QA pass before calling the product complete. After correctness is proven, apply YAGNI and KISS to remove safely unnecessary code and reduce duplicate authorities and maintenance surface. GitHub Actions is optional; required verification must still run through trusted local or agent execution and the existing direct production authorities.

## Active audit checks

- HTTP entry points redirect to canonical HTTPS before application HTML is served.
- Public navigation has no horizontal overflow at 360–375 px and all controls remain touch-reachable.
- Phone Settings uses a compact category pattern and lets labels/fields stack rather than wrap word by word.
- Help sends customers to Account for account deletion.
- Library/Cowork and other non-public/placeholder surfaces use appropriate noindex metadata.
- Offline copy distinguishes local inference from saved-data synchronization.
- Remove Offline never reports success until the intended model/runtime storage is actually absent.
- Admin grant UI makes MFA requirement, target account, tier, duration, reason, and final authoritative result clear.
