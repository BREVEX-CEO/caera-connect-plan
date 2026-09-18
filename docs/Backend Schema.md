# OCADE Backend Schema Authority

## Live authority

Production Supabase project: `sazhgaisyhkdbrooycdv`. Re-verify this id immediately before any migration or destructive operation.

The current live project is healthy and contains the active `ocade-intelligence` Edge Function plus the production Auth, public, and Storage schemas. Existing Auth users, identities, sessions, refresh tokens, and real customer/account evidence are protected and must not be cleared during cleanup.

## Protected data

Never delete or truncate real authentication records, customer conversations/messages, private Library data, payment/subscription evidence, entitlement evidence, legal consent, security/audit evidence required for incident/account history, or current settings simply because the owner wants the project clean.

Never edit `auth.users` to represent Free/Pro/Max access. Product access is resolved through the canonical entitlement authority and audited Admin grants.

## Current application domains

The reduced product needs schema for account/profile state, conversations/messages, private Library metadata/storage, usage windows/permits/events, signed offline usage state, entitlement/subscription/manual grants, legal/account deletion/export evidence where required, and minimal notification/security state actually used by the final UI.

The live project currently still contains objects from older product families, including recovery-code, financial, sharing, notification, and other historical systems. Their presence does not prove they should remain. Their emptiness does not prove they are safe to drop. Phase 11 traces every source/RPC/policy/function caller before removal.

The live `library` Storage bucket is private and remains the canonical customer-file bucket. Any older/unused bucket is removed only after proving that no customer object or current caller depends on it.

## Chat and usage contract

Saved Chat uses `conversations` and `messages` as the durable cloud authority. Disconnected pending turns may live temporarily in a client sync journal with stable idempotency keys, but reconciliation writes exactly once to the canonical tables.

Usage uses one account-wide commercial authority. Free receives 28 successful logical generations per 6h28m; Pro receives 140 per 6h28m and 700/week; Max receives 1,400 per 6h28m and 7,000/week. Failed logical generations consume zero. Internal retry/failover cannot create extra settlements.

The Edge Function and browser must call the exact current RPC signature used by the live schema. Any “could not verify your usage allowance” error is treated as a production contract defect and traced through RPC availability, permissions, argument names/types, RLS/security-definer behavior, generated types, and deployment parity.

## Entitlement and Admin contract

The permanent OCADE owner/admin is `caeracadane28@gmail.com` through the existing audited admin-role/grant system, not a hard-coded browser bypass. Hidden Admin may search a user, inspect current access, grant Free/Pro/Max with reason and optional duration, and revoke the grant. Normal users cannot reach or call privileged grant paths successfully.

## Auth contract

Supabase Auth methods for this mission are Google and six-digit email OTP. Phone OTP and its product/provider configuration are removed. Custom SMTP is already configured externally; the application must never claim that an OTP was sent unless Supabase accepted the request.

Account-enumeration resistance, OTP abuse controls, redirect validation, session integrity, and server/RLS authorization remain mandatory. The current Supabase advisor warning for leaked-password protection is documented but is not a launch blocker for the passwordless Google/email-OTP product on the current plan.

## Online intelligence contract

One active Edge Function: `ocade-intelligence`. Exactly three server-side secret slots are allowed:

```text
GEMINI_API_KEY_PRIMARY
GEMINI_API_KEY_SECONDARY
GEMINI_API_KEY_TERTIARY
```

The values are already configured by the owner and must never be requested in chat, committed, logged, returned to the browser, or stored in normal tables. `OCADE_ALLOWED_ORIGINS` is also configured server-side.

## Schema cleanup and advisor work

Run the Supabase security and performance advisors after schema changes. Current performance findings include auth-RLS initialization patterns, multiple permissive policies, and indexes that have not yet been observed as used. Investigate them against real callers/workload before changing anything; do not blindly delete an index or merge policies solely because an advisor reports it.

Retired recovery-code tables/functions are strong cleanup candidates because the product code removed that user flow, but they still require caller/policy/data verification before a migration drops them. Apply the same rule to every stale table, RPC, trigger, policy, index, bucket, and notification/payment artifact.

## Migration rules

Use versioned migrations for DDL, trace all callers before destructive changes, preserve real customer/auth/financial/legal/security evidence, include verification and rollback strategy where practical, regenerate TypeScript types after schema changes, and never deploy a destructive migration before the compatible application/Edge version is ready.

## Release proof

Final release evidence records the exact Git SHA, applied migration set, generated types state, active Edge Function version, private Library policy state, and successful real Chat/usage/Admin/Library smoke tests together.

## Repository-wide completion rule

This document is subordinate to the active implementation authority in `PLAN.md` and the engineering rules in `CLAUDE.md`, `docs/RULES.md`, and `docs/TESTING.md`. Complete the active plan, fix root causes with regression coverage, then run the separate adversarial enterprise-grade AI-platform QA pass before calling the product complete. After correctness is proven, apply `/ponytail ultra`, `/caveman ultra`, YAGNI, and KISS to remove safely unnecessary code and reduce duplicate authorities and maintenance surface. GitHub Actions is optional; required verification must still run through trusted local or agent execution and the existing direct production authorities.
