# OCADE Owner, Admin, Staff, and Operations Backend

## Purpose

This document defines the operational backend required to run OCADE as a company without requiring the owner to use Supabase dashboards for normal business operations.

## Access boundary

- The preferred canonical owner/admin surface is `admin.ocade.in`.
- A staff subdomain may redirect to or share the same secured application if that reduces duplication.
- Admin authorization is server-enforced. Hiding a menu item or checking an email in frontend JavaScript is never sufficient authorization.
- The initial main owner identity is bootstrapped through the approved owner account, then represented through durable role/permission records.
- The owner has unrestricted product entitlement but internal usage/cost remains tracked.
- A separate emergency backup owner identity should exist with a documented break-glass process.

## Roles

- Owner has the highest operational authority.
- Admin may receive broad delegated operational rights but cannot silently grant itself Owner.
- Support may manage support-oriented account actions without receiving billing secrets, credentials, or unrelated private content.
- Billing may manage subscriptions, invoices, refunds, payment metadata, and financial support without receiving customer passwords or conversation content.
- Developer/Operations may inspect service health, errors, deployments, feature status, and technical diagnostics without receiving full card data or passwords.
- Read-only may inspect approved operational information without mutation rights.
- Custom per-person permissions may be added on top of roles where they improve least privilege.

## Authentication and staff security

- Owner and staff accounts use individual identities.
- MFA is required for staff and owner privileged access.
- The owner does not need to know staff passwords. Staff set or recover their own credentials through an invite/reset flow.
- No user, staff, or owner password is stored or displayed in plaintext.
- Privileged sessions can be revoked immediately.
- Unknown or high-risk staff sessions may require additional verification.
- Sensitive actions may require recent reauthentication and a recorded reason.
- Staff cannot raise their own role or permissions.
- Every meaningful staff mutation is written to an append-only operational audit trail.

## Dashboard

- The home dashboard should show concise operational metrics and prioritized incidents rather than a wall of cards.
- Useful metrics include revenue, active paid customers, AI/JARVIS cost, failed payments, current subscriptions, active devices/tasks, support pressure, and security/system incidents.
- The dashboard supports a compact chart view for revenue/usage trends without overwhelming the screen.
- System health summarizes OCADE web, authentication, intelligence, JARVIS device execution, payment webhooks, Supabase/Cloudflare boundaries, background processing, and monitored error groups.

## Customer management

- Owner/admin may search customers by email, stable user ID, payment/customer reference, transaction/invoice reference, or other approved identifiers.
- A customer profile shows plan, entitlement, usage, reset state, payments, invoices, refunds, devices, sessions, support history, security events, and approved account actions.
- Owner may grant usage, add an auditable usage adjustment, reset a supported allowance window, change a plan, grant complimentary access, disable an account, recover access, revoke sessions, remove devices, or initiate supported account deletion.
- Financial and entitlement histories are not rewritten. Corrections append new adjustment/refund/reversal events.
- Account deletion follows applicable retention/legal requirements and must not bypass obligations merely because the UI offers a delete button.

## Conversation and privacy access

- Customer conversations are private by default and are not a normal dashboard browsing surface.
- If the owner has a legitimate support, security, abuse, or legal reason to inspect conversation content, the access path must be explicit, strongly authorized, reason-logged, and auditable.
- Staff do not automatically inherit conversation visibility. Any future staff support-content access requires a separately approved scoped permission.
- Raw provider prompts, system secrets, hidden provider identities, and credential material are never shown merely because a privileged user opens an account.

## Usage and entitlement controls

- Owner may grant usage or plan access, but each grant records who performed it, why, the old entitlement, the new entitlement, and the timestamp.
- Manual usage changes use adjustment entries rather than editing or deleting prior usage events.
- Owner unlimited access is represented as a privileged entitlement rather than by disabling server-side accounting.
- Limits, reset times, current plan, and entitlement sources are visible to owner/support based on permission.

## Payment operations

- Owner and authorized Billing staff may see provider customer references, invoice/payment status, amount, currency, card brand/last-four where the provider lawfully exposes it, refund status, dispute status, and subscription status.
- Full card numbers, CVV/CVC, bank credentials, payment authentication secrets, and raw processor secrets are never stored or displayed.
- Refund, partial refund, subscription change, cancellation, payment-method update handoff, dunning, and dispute actions should use provider-supported APIs/workflows.
- The admin application should receive verified webhook-driven payment state rather than depending on staff to refresh the payment processor manually.

## Support operations

- Support tickets may link to customer, plan, payment, device, task, and safe diagnostic context.
- Internal notes remain internal.
- Customer-visible support history may show important resolutions and account actions without exposing internal security notes.
- Repeated JARVIS/device/browser failures may attach redacted diagnostics and stable incident/error codes.
- Support should be able to trigger safe recovery actions such as resend verification, revoke session, re-pair device, refresh entitlement, or issue a recovery link where supported.

## Security controls

- Provide a global emergency kill switch for unsafe JARVIS device execution while leaving account access and ordinary Chat available if appropriate.
- Provide feature-level kill switches for browser extension, Device Agent command claims, mobile companion control, voice/wake, and other high-risk execution paths.
- Every kill switch is server-authoritative, visible in audit history, and reversible only by appropriately privileged identities.
- Owner/admin access must be protected against IDOR, privilege escalation, stale-session leakage, cross-account reads, CSRF where relevant, unsafe service-role exposure, and frontend-only authorization.

## MCP orchestration and autonomous verification linkage — 2026-09-28

- Current implementation and verification governed by this document must also follow `docs/MCP_ORCHESTRATION_AND_AUTONOMOUS_FIX_LOOP.md`.
- When multiple MCPs can touch the same surface, one tool acts and the others observe or verify sequentially so browsers, devices, files, and operating-system state are not corrupted by competing automation.
- Long runs must checkpoint durable progress before context compaction, rate limits, restart, or handoff. Resumed work continues from the next unfinished item instead of repeating completed work.
- A failure is not closed by a code change alone. Reproduce it, fix the root cause, run targeted and nearby integration tests, verify with the strongest available real browser/device/physical evidence, attempt to break the fix, and then run the broader regression slice.
- If one MCP or environment is unavailable, mark only that evidence class blocked and continue every independent test. Never treat blocked or emulated evidence as a real-device pass.
