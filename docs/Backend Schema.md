# OCADE Backend Schema

## Authority

This document defines the logical final backend. Supabase migrations and generated types are the physical schema authority during implementation.

Do not recreate the database blindly. Migrate from the live project safely, remove retired objects only after dependency tracing and verify source/live schema effect.

## Required logical domains

### Identity and security

Keep only structures needed for:

- user/profile identity;
- roles/hidden Admin where required;
- session/device/security records;
- MFA/recent assurance where required for dangerous actions;
- legal acceptance/audit facts that must remain durable.

### Chat

Need durable concepts for:

- conversation;
- message;
- archive/trash/deleted state;
- share/export only if retained by final Chat;
- message feedback/citations only if final UI/runtime still uses them.

### Library

Need:

- library item metadata;
- owner/account scope;
- type: file/image/generated output;
- private Storage object reference where applicable;
- origin metadata where needed for recovery/audit;
- created/updated/deleted state.

No separate customer Artifacts store after consolidation.

### Settings and notifications

Keep account-scoped preferences for:

- appearance;
- notification preferences;
- privacy/data choices;
- deliberate Offline Intelligence removal preference if account-scoped behavior needs it;
- other final Settings values.

### Usage and entitlements

Keep the existing secure concepts required for:

- plan/tier;
- 388-minute usage window;
- successful-request counter;
- server generation permits;
- signed offline entitlement/usage reconciliation;
- idempotency/concurrency protection;
- authoritative reset state.

One account across multiple devices shares capacity.

### Billing

Keep the single canonical subscription/entitlement authority plus required payment/refund/dispute/Admin-grant audit state. Do not reintroduce overlapping subscription tables.

### Cowork/Jarvis

During `PLAN.md`, preserve only minimal schema seams proven necessary for future integration.

During `PLAN2.md`, add/retain only durable Cowork state actually required by the OCADE JARVIS runtime. Internal step/task concepts must not automatically recreate the old standalone Tasks product.

### Hidden organizations/Admin

Keep only what is still required by real authorization, billing, support or tenant boundaries. Hide from normal customer navigation.

## Retired domains

Remove tables/functions/policies/types dedicated only to retired standalone:

- Projects;
- Tasks;
- Artifacts;
- Code/coding workspace;
- old device/control dashboards;
- obsolete donor/legacy runtime state.

Removal requires:

1. caller/search proof;
2. reversible migration or explicit safe rollback plan;
3. data disposition decision;
4. verification query;
5. regenerated types;
6. RLS/grant verification.

## RLS

Every customer table is fail-closed and owner/tenant scoped. Elevated functions validate `auth.uid()`/role/assurance explicitly and expose only necessary columns/actions.

## Server secrets

These are **not database columns**:

```text
GEMINI_API_KEY_PRIMARY
GEMINI_API_KEY_SECONDARY
GEMINI_API_KEY_TERTIARY
```

Store them as Supabase Edge Function/server secrets. Never return them through RPC, API, logs or generated types.

## Current live project

The last verified live project before this redesign was project ref `sazhgaisyhkdbrooycdv`. Re-verify before applying any migration because this document records intent, not live-state proof.
