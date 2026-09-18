# OCADE UI/UX Brief

## Experience goal

OCADE must feel immediate, quiet, premium, and trustworthy. A customer should understand where to type, what mode is active, how much usage remains, whether Offline is ready, and how to recover from an error without reading technical documentation.

## Primary shell

Keep the left sidebar compact with New Chat, Chat, Library, Cowork placeholder, recent/search, and Account. Keep the main workspace centered and open. Do not add dashboard cards simply to fill empty space.

Signed-out visitors see the same clean shell. Pressing Send opens authentication rather than redirecting them to a separate marketing product.

## Chat

The empty state contains a small “Ask OCADE”/OCADE greeting and the composer. Suggested prompts, when present, remain subtle and secondary.

The composer is rounded and lightly glassed. It includes attachment `+`, multiline text, microphone, `Auto | Online | Offline`, optional Thinking, and Send/Stop. Text grows only to a sensible maximum. The selector remains compact and readable rather than looking like a model-debug control.

When there is no Internet, Online becomes disabled. Auto gets a subtle Offline indication/animation when it is actually routing locally. If Offline is not ready, the UI communicates Installing/Removed/Install Offline rather than failing only after Send.

User messages are compact. OCADE answers use open readable text with contextual controls. Copy/Edit/Delete/Regenerate/Retry/Stop/source controls appear only when useful and have touch/keyboard equivalents.

## Sidebar and history

Conversation history uses a bounded skeleton and then populated, empty, or error/Retry state. Group by useful periods and keep rows compact. Never leave “Loading chats…” indefinitely.

A small usage indicator belongs near the account area. Low allowance may add a small composer warning, not a blocking banner until exhaustion actually occurs.

## Settings

Use a compact modal/sheet with rounded corners and a clear left category list on desktop. On narrow screens, convert to a full-height/sheet navigation pattern rather than squeezing the desktop modal.

Categories are Account, Appearance, Notifications, Data Controls, Usage & Limits, Billing, and Advanced. Each row uses a concise label and at most one short supporting sentence unless a destructive/security flow genuinely needs more explanation.

Billing and Advanced must never show endless “Reading…” text. Use short skeletons then content, empty, or error/Retry.

## Offline Intelligence

Offline preparation stays in the background after sign-in and should not take over Chat. A compact status may appear in sidebar/account. Detailed progress appears only when the customer opens the relevant Settings surface.

Customer states are Preparing, Installing with percent/progress, Verifying, Ready, Repairing, Removed, and Install Offline. Do not expose runtime/model/vendor implementation names.

If the customer removed Offline, show a direct sentence such as “You removed OCADE Offline. Install it again to use OCADE without Internet.” Do not silently redownload it.

## Library and attachments

Library keeps a clean All/Images/Files filter, search, Add, and useful empty state. Attachment chips show filename/type/progress and only the actions that make sense: preview, remove, retry, reorder, or download.

Malicious/unsupported file failures use plain customer-safe wording and do not expose parser internals.

## Usage and Billing

Usage & Limits shows plan, remaining uses, current reset, weekly limit where applicable, a small progress meter, and one plain-language sentence explaining that one successful answer consumes one use.

Billing uses clear Free/Pro/Max cards with current plan highlighted. If real checkout is not configured, upgrade actions explain that billing setup is not available yet rather than pretending to charge.

## Visual tokens

Use near-black/charcoal backgrounds, neutral dark-grey glass surfaces, white primary text, soft-grey secondary text, thin low-contrast borders, and restrained accent for state/focus only.

Use consistent soft medium radii on composer, dialogs, menus, cards that truly need enclosure, and Settings. Avoid sharp corners, oversized pills, strong shadows, thick separators, saturated gradients, and heavy blur.

Use a semantic type scale with clear heading/body/label/caption/code roles, readable line height, and responsive sizing.

## Motion and cursor response

Use fast subtle hover/focus movement, panel transitions, streaming feedback, attachment progress, and small route-state transitions. Strong cursor-reactive/cinematic movement is not part of the current Chat mission. Respect reduced motion and never rely on motion alone to communicate state.

## Responsive and accessibility

Desktop, tablet, and phone retain the same core functionality. Navigation becomes a drawer on phone; Settings becomes a mobile sheet; composer controls remain reachable; attachment controls remain touch-safe; no horizontal overflow is allowed.

Use semantic elements, visible focus, keyboard navigation, screen-reader labels, adequate contrast, reduced-motion support, and minimum practical touch targets.

## Definition of polished

A surface is not polished if it contains an infinite loader, fake control, stale feature description, excessive empty panel, technical provider/model text, inconsistent corner/radius, clipped content, hidden mobile action, or error that forces the customer to guess what happened.

## Repository-wide completion rule

This document is subordinate to the active implementation authority in `PLAN.md` and the engineering rules in `CLAUDE.md`, `docs/RULES.md`, and `docs/TESTING.md`. Complete the active plan, fix root causes with regression coverage, then run the separate adversarial enterprise-grade AI-platform QA pass before calling the product complete. After correctness is proven, apply `/ponytail ultra`, `/caveman ultra`, YAGNI, and KISS to remove safely unnecessary code and reduce duplicate authorities and maintenance surface. GitHub Actions is optional; required verification must still run through trusted local or agent execution and the existing direct production authorities.
