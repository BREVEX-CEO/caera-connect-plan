# OCADE Backend Schema Authority

## Live project

Production Supabase project: `sazhgaisyhkdbrooycdv`.

Always re-verify the project id before migrations or destructive cleanup.

## Protected account/auth data

Database cleanup must never delete or truncate the Supabase Auth account/session system.

Protected categories include:

- `auth.users`;
- `auth.identities`;
- `auth.sessions`;
- `auth.refresh_tokens`;
- MFA/auth-flow state;
- real profiles;
- real user roles/settings required by OCADE;
- real subscriptions/payment evidence;
- legal consent evidence;
- real customer conversations/messages/Library data unless explicitly deleted by the customer.

Do not edit `auth.users` to grant product access.

## Final application data domains

The target live schema should contain only tables/functions/policies required by these domains:

### Account and security

- profiles;
- user settings/preferences;
- user roles/admin state;
- notification preferences/history where required;
- MFA recovery/security state where required.

### Chat

- conversations;
- messages;
- any minimal attachment relationship metadata required by the canonical Chat/Library architecture.

### Library

- Library metadata;
- private Storage bucket/object policies;
- storage tombstone/reconciliation metadata only where required.

### Usage

- commercial usage windows;
- durable generation permits/idempotency;
- signed offline device keys/leases/allocations/events required for account-wide offline enforcement.

All tiers count successful logical requests rather than weighted work.

### Billing

- subscriptions;
- sanitized payment webhook/event evidence;
- invoices/receipts where required;
- entitlement grants;
- any retired financial history that must remain readable for audit but must not grant current access.

### Manual entitlement grants

A single canonical grant table/function must support:

- user id;
- tier;
- created by admin;
- reason;
- optional starts/ends;
- revoked state/actor/time.

The entitlement resolver combines paid subscription + manual grant + Free default.

### Legal

Keep append-only legal consent receipts where required.

## Retired schema/data

Remove objects used only by retired product families after source/dependency tracing.

Examples of categories expected to be removed if no final caller remains:

- old Cania data;
- old Madee data;
- old Ficia data;
- old messaging product tables;
- old Projects/Tasks/Automations product tables;
- old organization/team product tables;
- retired status/support article systems;
- obsolete launch-gate tables;
- obsolete provider preference/event tables;
- old browser/control product policy tables;
- stale test/compliance packs not used by final OCADE.

Do not delete a table simply because its row count is zero; remove it only after proving that final source, functions, policies and migrations no longer require it.

## Application logs and stale data

The owner wants the live project clean.

Clear stale development/launch/test rows only when proven not to be:

- account/auth evidence;
- payment/subscription evidence;
- legal consent evidence;
- security/audit evidence;
- customer content;
- current entitlement evidence.

Where an operational log remains useful, enforce bounded retention rather than indefinite accumulation.

Never wipe Supabase platform-managed Auth data/logs simply to make the project look empty.

## Auth provider configuration

Required Supabase Auth methods:

- Google;
- email OTP;
- phone OTP.

Phone OTP must have a real SMS provider configured before production is marked ready.

If credentials are required for the SMS provider, request only the exact missing credentials at that implementation boundary and store them in the correct secure Supabase/provider settings, never normal tables.

## Gemini Edge Function

One Edge Function: `ocade-intelligence`.

Exactly three secrets:

```text
GEMINI_API_KEY_PRIMARY
GEMINI_API_KEY_SECONDARY
GEMINI_API_KEY_TERTIARY
```

At the online-intelligence deployment phase, ask the owner for exactly three Gemini API keys as secrets. Add them securely through Supabase secret management where tooling permits. Never commit or echo the values.

## Storage

Library bucket must remain private and protected by RLS/policies.

Offline model artifacts do not live in Supabase Storage; they are delivered from private OCADE-controlled Cloudflare R2 and stored on-device through OPFS.

## Migration rules

- use versioned migrations for DDL;
- trace all callers before drops;
- include verification queries;
- use reversible migrations/rollback strategy where practical;
- regenerate TypeScript types after schema changes;
- run Supabase security and performance advisors;
- never apply a destructive migration before the compatible app version is ready.

## Access-grant operations

Hidden Admin must offer a safe user-access workflow rather than requiring SQL.

Admin flow:

```text
search user by email/id
→ inspect current entitlement
→ choose Free / Pro / Max
→ optional start/end
→ reason
→ grant
→ audit row created
```

Revocation must be equally simple and auditable.
