# OCADE Company and Product Authority

## Purpose

This document records the latest owner-approved company-scale product direction for OCADE. It is a forward-looking authority that extends the existing Chat and JARVIS work without deleting completed history. If an older document conflicts with this continuation, the newer owner-approved requirement in this document and PLAN.md takes precedence for the active mission.

## Product position

- OCADE is not only a chatbot. OCADE is intended to become a global AI operating product that combines high-quality conversation, practical work execution, browser control, software control, coding assistance, device control, tasks, files, voice, automation, account services, and company-grade administration.
- JARVIS is the principal execution differentiator. It should answer normal questions naturally and perform real work when the user asks it to act.
- OCADE should compete by being simpler to use while doing more useful work automatically. The product must not try to look powerful by exposing a wall of settings, technical switches, provider names, or internal implementation details.
- Reliability, security, accurate execution, clean interaction design, and low user effort are higher priorities than adding more visible features.
- The product should continuously remove duplicated systems, dead code, obsolete flows, unnecessary UI, redundant settings, and misleading options after replacements are proven.

## Product surfaces

- Chat remains a dedicated conversational surface.
- JARVIS remains a dedicated conversational and execution surface.
- A separate Code page is not required. JARVIS and Chat may write code directly, and JARVIS may use the user's selected IDE, terminal, repository, or development environment when the user asks it to act.
- A separate Projects page is not required unless a future requirement proves that a conversation, workspace, files, repositories, and Library cannot represent the needed project context cleanly.
- Tasks are primarily represented inside JARVIS rather than becoming another permanently visible top-level destination unless active user research proves a separate destination is materially useful.
- JARVIS has a clean Library experience for generated outputs, files, artifacts, and results.
- Co-work remains an optional operating mode that allows the user and JARVIS to work on the same computer with explicit arbitration, pause, takeover, and verification rules.
- Settings are shared where possible. JARVIS-specific device, permissions, app, and execution controls are grouped under a focused JARVIS and Devices area instead of duplicating global account settings.
- OCADE includes a first-party Help or Support experience on the OCADE domain. Help content explains setup, Chat, JARVIS, devices, mobile, billing, privacy, security, troubleshooting, and common recovery flows without bloating the normal product UI.

## Plans and usage

- One customer subscription plan grants access to both Chat and JARVIS according to the plan's separate or appropriately defined allowances. A user should not need to buy unrelated subscriptions merely to use both core product surfaces.
- The free plan keeps the owner-approved 28-use model where that usage authority applies, and usage remains account-wide rather than device-specific.
- Free users may see the exact remaining usage, for example "18 of 28 uses left", together with reset information when useful.
- Paid plans should prefer a clean plan name, percentage or progress bar, and only the reset or limit information necessary for the user to understand availability. Paid users should not be constantly shown upgrade marketing.
- Usage must be enforced server-side, shared across a user's signed-in devices, reconciled after failed or no-result work, and represented without exposing provider/model/vendor identities.
- The owner account may have unlimited product entitlement while internal cost and resource consumption remain measurable for operational visibility.

## Authentication and account behavior

- Google Sign-In is a primary login path and must be tested heavily across normal login, refresh, sign-out, reauthentication, multiple tabs, account switching, and error recovery.
- Email/password or other existing fallback sign-in may remain where useful. Authentication design must avoid unnecessary user friction while keeping privileged owner and staff paths strongly protected.
- User-facing account sessions should work effortlessly. Sensitive owner and staff actions may require stronger verification even when normal customer interaction does not.
- Sign-out must synchronously remove account-owned UI state, cached conversations, tasks, devices, usage, settings identity, and other private information before another identity can appear in the same session.
- OCADE must never expose customer or staff plaintext passwords, MFA secrets, raw authentication secrets, or full payment-card data to owner or staff tools. Recovery uses reset, revoke, invitation, session control, and supported provider flows instead of credential disclosure.

## Owner and company operations

- OCADE must have a secure owner/admin application on the OCADE domain, with `admin.ocade.in` as the preferred canonical domain. A staff subdomain may redirect to or reuse the same secured application if that simplifies architecture without weakening isolation.
- The normal customer application must not reveal owner/admin controls based only on hidden frontend UI. Privileged access is enforced server-side with explicit roles and permissions.
- The bootstrap main-owner identity is the owner's approved account, but production authorization must use durable server-side owner roles rather than treating an email string in client code as the security boundary.
- The owner may manage users, plans, usage adjustments, resets, complimentary access, subscriptions, refunds, payment records, support, devices, sessions, staff, roles, incidents, system health, and company operations.
- Usage, plan, billing, refund, and support corrections are appended as auditable adjustments. Historical financial and entitlement events are not silently rewritten.
- The owner may disable or recover accounts, revoke sessions, remove devices, grant access, reset supported limits, and help with recovery through controlled actions and audit trails.
- Customer conversation content is not a casual staff browsing surface. If the owner has a legitimate support, security, or legal reason to access content, the action must be explicit, logged, scoped, and protected. Staff access is more restricted and should not inherit owner-only visibility by default.
- OCADE supports a separate emergency or backup owner identity through a secure break-glass process rather than sharing the same password or MFA secret.

## Staff operations

- Staff access uses individual identities, not shared credentials.
- Initial roles should cover Owner, Admin, Support, Billing, Developer or Operations, and Read-only responsibilities.
- Per-person permission overrides may be added where they materially improve least-privilege access.
- Staff accounts use MFA and audited sessions. The owner can revoke staff access and sessions immediately.
- Support staff receive only the customer/account information necessary for support. Billing staff receive billing information necessary for payments and refunds. Developer/Operations staff receive system health, deployment, diagnostics, and technical metadata necessary for operations.
- Staff must never receive complete payment-card numbers, customer passwords, staff passwords, MFA secrets, provider secrets, or other raw credentials.
- Sensitive staff actions require an audit entry and may require a reason, stronger reauthentication, or owner approval depending on impact.

## Global commerce

- The payment architecture must use a compliant payment provider or Merchant of Record approach rather than storing raw card data in OCADE.
- Checkout should support local currency where practical, use billing-country confirmation, display applicable taxes and total cost clearly, support invoices/receipts, and preserve original transaction currency alongside a base reporting currency.
- Country detection may make a suggestion, but pricing or entitlement decisions must not trust VPN/IP information alone. Billing/payment-country and anti-abuse signals should be used to prevent manipulation.
- Local pricing should remain commercially sensible. The existing "28" price-ending preference may be used where it does not create confusing or unreasonable local pricing.
- Tax collection must be controlled by current legal/accounting requirements and payment-provider capabilities. The application must not hardcode an unverified tax threshold as legal truth.
- Refunds, partial refunds, payment retries, failed-payment grace periods, cancellation, invoices, disputes, local payment methods, and tax IDs should be supported through provider-backed flows where applicable.
- Cancellation must be understandable and not intentionally obstructive. Users should receive clear warnings and know when access ends.

## Customer support and documentation

- OCADE should provide searchable first-party help documentation with short visual guides for important setup and troubleshooting flows.
- Product surfaces show concise errors with the next useful action, such as Retry, Reconnect, Grant permission, Fix automatically, or Open Help.
- Long explanations belong in Help rather than the main UI.
- Safe diagnostics may be attached to support or incident flows, but secrets, raw passwords, full local paths, unnecessary personal data, and provider secrets must not be uploaded.
- Terms, Privacy, Acceptable Use, Refund/Cancellation, device-control disclosures, and other required policies remain available on the OCADE site in a clean readable format and are integrated into account/checkout consent where required.

## Engineering quality

- The active codebase should become substantially leaner and easier for a real developer to understand.
- File and folder names must describe actual responsibilities. Avoid vague names such as generic error files, temporary names, or duplicated feature folders when a clearer professional structure is possible.
- Dead, obsolete, duplicate, experimental, and replaced production code should be removed only after the replacement is proven and ToRemove.md has been followed.
- Immutable donor/source archives are never cleaned, reformatted, or rewritten by Ponytail/Caveman passes.
- Large files should be split when responsibilities are genuinely separate. Tiny one-function files should not be created merely to inflate modularity.
- Security invariants and non-obvious architecture decisions deserve comments. Obvious syntax does not need commentary noise.
- The final repo structure must receive a dedicated folder/file/duplication audit before release.

## Evidence and release principle

- OCADE must not claim that software is mathematically bug-free, unhackable, or guaranteed never to show an operating-system security warning.
- The engineering target is no known Critical or Major release blocker, no reproducible hidden blocker in the tested scope, aggressive adversarial testing, clean code, reliable recovery, and explicit reporting of remaining blocked evidence.
- Product release evidence must distinguish source inspection, unit/integration tests, emulation, real browser tests, real Windows tests, real Android tests, real macOS tests, real iPhone/iPad tests, live deployment checks, and blocked/unavailable hardware evidence.
