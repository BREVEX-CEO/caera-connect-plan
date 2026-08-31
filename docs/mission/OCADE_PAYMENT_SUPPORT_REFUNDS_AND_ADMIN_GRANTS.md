# OCADE Payment Support, Refunds, Fraud Controls, and Admin Grants

## Purpose
This document adds an operator-safe commercial support layer to `PLAN.md`.

It covers:
- payment fulfillment;
- payment reconciliation;
- fraud/abuse controls;
- support handling;
- refunds;
- disputes/chargebacks;
- manual Free/Pro/Max grants;
- approved custom entitlements;
- user lookup by user ID or email;
- auditability;
- recovery when a customer paid but access did not appear immediately.

It does NOT replace the canonical payment architecture in `PLAN.md`.

## Core Principle
OCADE separates:
1. provider money movement;
2. internal financial records;
3. commercial entitlement;
4. usage limits;
5. administrative grants.

These are related but not interchangeable.

A provider charge is not an entitlement by itself.
A browser redirect is not payment proof.
A manual admin grant is not a payment.
A refund request is not a completed refund.

## Canonical Commercial Flow

```text
Customer chooses Free/Pro/Max
  → server resolves authoritative catalogue
  → server creates checkout intent/idempotency key
  → exact amount/currency/cadence/tax/renewal terms shown
  → customer explicitly confirms
  → provider-hosted checkout
  → provider confirms payment server-side
      ├─ signed webhook
      └─ optional server reconciliation request from return page
  → both routes feed ONE idempotent event application authority
  → atomic commercial state update
  → entitlement becomes ACTIVE
  → usage authority changes
  → every device reconciles
```

### Important
The return page may speed up confirmation by asking OCADE's server to reconcile the provider transaction.

The browser must never say:
> "The redirect says paid, therefore grant Pro."

Instead:

```text
browser return
  → sends opaque checkout reference
  → OCADE server validates session/account binding
  → server queries/verifies provider state
  → server applies same canonical idempotent state transition
  → browser polls authoritative entitlement
```

Webhook and reconciliation are two delivery paths into one authority, not two entitlement systems.

## Required Records
Prefer names that fit the existing schema. Do not create duplicates if equivalent canonical tables already exist.

### `billing_checkout_intents`
Recommended fields:
- `id`
- `idempotency_key`
- `user_id`
- `organization_id`
- `catalog_version`
- `plan_id`
- `cadence`
- `currency`
- `expected_amount_minor`
- `provider`
- `provider_checkout_id`
- `status`
- `expires_at`
- `created_at`
- `completed_at`

Rules:
- Server creates it.
- Client cannot change price, plan, cadence, currency, or owner.
- Short-lived where appropriate.
- One completed intent cannot be fulfilled twice.

### `billing_events`
Immutable/auditable normalized provider events:
- internal event ID;
- provider;
- provider event ID;
- provider transaction/subscription ID;
- environment;
- raw event type;
- normalized event type;
- occurred-at time;
- received-at time;
- signature verification result;
- account/organization target;
- catalog version;
- amount/currency where relevant;
- processing result;
- idempotency result;
- error classification.

Do not store payment secrets or raw card/UPI credentials.

### `billing_ledger`
Financial record of money-related outcomes:
- charge;
- refund;
- partial refund;
- credit;
- dispute;
- chargeback;
- reversal;
- provider fee/tax metadata when legally/operationally appropriate.

The ledger is financial history, not the only entitlement authority.

### `commercial_entitlements`
Server-authoritative access state:
- `id`
- `user_id`
- `organization_id`
- `entitlement_catalog_id`
- `source`
- `source_reference`
- `status`
- `starts_at`
- `ends_at`
- `cancel_at_period_end`
- `created_at`
- `updated_at`

Possible sources:
- `provider_subscription`
- `provider_purchase`
- `admin_grant`
- `organization_contract`
- `migration`

Do not use arbitrary client-editable profile text as the entitlement authority.

### `admin_entitlement_grants`
Manual entitlement control:
- `grant_id`
- `target_user_id`
- `organization_id`
- `entitlement_catalog_id`
- `reason`
- `internal_note`
- `created_by`
- `created_at`
- `starts_at`
- `ends_at`
- `status`
- `revoked_by`
- `revoked_at`
- `revocation_reason`
- `ticket_id` or support reference
- optional approval metadata for high-risk grants

This is the safe mechanism for giving Pro/Max/custom access without payment.

### `billing_admin_actions`
Audited operator queue for:
- `GRANT_ENTITLEMENT`
- `REVOKE_GRANT`
- `ISSUE_REFUND`
- `RETRY_RECONCILIATION`
- `REPROCESS_PROVIDER_EVENT`
- `SUSPEND_BILLING_ACCESS`
- `RESTORE_AFTER_DISPUTE`
- other explicitly approved actions

Fields:
- action ID;
- action type;
- target user/organization;
- target transaction/subscription/grant;
- requested by;
- requested at;
- reason;
- structured parameters;
- idempotency key;
- status;
- processing timestamps;
- result reference;
- safe error message.

Never store provider API secrets in action metadata.

## User Lookup for Support

### Preferred
Use immutable Supabase Auth user ID.

Example operator flow:

```text
User reports billing problem
→ search account by email in authorized admin/support view
→ resolve exactly one auth user
→ display immutable user ID
→ operator confirms identity/account context
→ all mutations target user ID, not email
```

Email is a lookup convenience, not authorization and not the durable foreign key.

Handle:
- no match;
- changed email;
- deleted account;
- organization-owned billing;
- test/sandbox account.

## Manual Free → Pro Without Payment
This is allowed as an administrative entitlement grant.

### Correct flow

```text
Admin searches user by user ID or email
→ system resolves immutable user ID
→ admin chooses approved entitlement:
     Pro weekly
     Pro monthly
     Max weekly
     Max monthly
     approved internal/custom entitlement
→ choose duration/expiry if required
→ enter required reason
→ recent reauthentication + MFA/AAL2
→ server validates admin permission
→ create admin_entitlement_grant
→ atomically refresh effective entitlement
→ commercial usage authority updates
→ devices receive entitlement change
→ audit event recorded
```

### Example

Input:
```text
Target email: customer@example.com
Grant: Pro monthly
Duration: 30 days
Reason: Support goodwill credit
```

Server behavior:
```text
1. Resolve email → auth user UUID.
2. Verify operator authorization.
3. Verify recent reauthentication/AAL2.
4. Resolve `pro_monthly` from the server catalogue.
5. Create a new `admin_grant` record.
6. Recalculate effective entitlement.
7. Invalidate/refresh commercial claims.
8. Notify the user if policy requires.
9. Record immutable audit evidence.
```

### Do NOT
- change arbitrary `profiles.plan_tier = 'pro'` as the only source of truth;
- invent a Stripe/Paddle/PayPal transaction;
- write a fake $0 charge;
- mark the user as "paid";
- allow the browser to submit arbitrary custom plan text;
- let the grant survive forever unless that was explicitly intended;
- let provider webhooks accidentally delete a valid admin grant.

## Approved Custom Plans
Custom plans should not be free-form strings interpreted by application code.

Use an authoritative catalog.

Example:

```text
custom_founder_pro
custom_partner_max
enterprise_contract_2026_001
support_credit_pro_30d
```

Each catalog entry defines:
- internal ID;
- display name if customer-visible;
- base capability set;
- commercial usage policy;
- device policy;
- organization/seat policy;
- start/end rules;
- whether renewable;
- whether provider-purchasable;
- whether admin-grant-only;
- audit classification;
- active/retired state.

Never accept a custom plan ID that does not exist in the approved server catalogue.

## Entitlement Precedence
Define one deterministic precedence policy.

Recommended:

```text
security suspension
  > legal/account restriction
  > active organization contract
  > active explicit admin grant
  > active verified provider entitlement
  > Free
```

Rules:
- A payment failure must not silently revoke an unrelated active admin grant.
- Revoking an admin grant must not cancel a real paid subscription.
- Refunding a provider payment updates the provider-sourced entitlement, not unrelated grants.
- Account suspension can override access regardless of payment/grant according to policy.
- Every effective-entitlement decision must be explainable from authoritative rows.

## Refund Support System

### Customer-facing flow
Provide a clear support/billing route:

```text
Billing
→ purchase/invoice
→ Get help / Request refund
→ show applicable policy
→ collect reason
→ show request received
→ operator/provider processing
→ show pending/approved/rejected/completed truthfully
```

Do not promise a refund before policy/provider approval.

### Operator flow

```text
Refund request
→ identify authoritative transaction
→ verify refund eligibility/policy
→ choose full or allowed partial refund
→ recent reauth + MFA/AAL2
→ create idempotent ISSUE_REFUND admin action
→ server calls provider refund API
→ persist provider refund ID
→ wait for/verify provider result
→ update billing ledger
→ update provider-sourced entitlement according to policy
→ notify customer
→ preserve audit evidence
```

### Refund states
Use explicit states such as:
- `requested`
- `under_review`
- `submitted_to_provider`
- `pending_provider`
- `approved`
- `completed`
- `partially_refunded`
- `rejected`
- `failed_retryable`
- `failed_final`

Never label `requested` or `submitted_to_provider` as `refunded`.

## Partial Refund Policy
The plan requires an explicit partial-refund entitlement rule.

Choose and version one policy, for example:
- partial refund does not change entitlement unless amount crosses a documented threshold; or
- entitlement is shortened proportionally; or
- operator selects an explicit post-refund entitlement.

Do not improvise per request.

Persist:
- policy version;
- original amount;
- refunded amount;
- resulting entitlement;
- reason;
- operator/provider references.

## Disputes and Chargebacks
Provider events may indicate:
- dispute opened;
- chargeback warning;
- chargeback;
- dispute won;
- dispute lost;
- reversal.

Rules:
- Provider event must be verified.
- Apply idempotently.
- Do not reopen terminal state from a stale event.
- Suspension/entitlement behavior must be explicit and versioned.
- A later valid reversal may restore only the entitlement affected by that provider transaction.
- Never touch unrelated admin grants unless policy explicitly requires it.

## Fraud and Payment-Abuse Controls
No architecture guarantees zero fraud. OCADE should minimize risk through layers.

### Checkout
- authenticated account required for paid account plans;
- server-side catalogue;
- signed/opaque checkout intent;
- short expiry;
- plan/amount/currency/cadence bound to intent;
- sandbox/live isolation;
- provider risk controls where available;
- velocity/rate limits;
- no client-controlled discount authority;
- no secret payment data in OCADE.

### Webhook
- raw-body provider signature verification;
- timestamp tolerance where provider protocol requires;
- unique provider event ID;
- persistent replay protection;
- duplicate handling;
- out-of-order handling;
- environment check;
- known product/price mapping;
- target account binding;
- atomic event + entitlement update.

### Reconciliation
- server-to-provider verification;
- same idempotent application path as webhook;
- background retry for pending states;
- customer-safe polling;
- no browser trust.

### Admin
- strict server/RLS authorization;
- recent reauthentication;
- MFA/AAL2 for high-risk actions;
- action idempotency;
- immutable audit;
- reason required;
- optional dual approval for very high-value refunds/custom enterprise grants;
- no raw provider secrets in tables.

### Monitoring
Track:
- repeated failed checkouts;
- repeated refund requests;
- unusual entitlement churn;
- webhook verification failures;
- replay attempts;
- impossible environment/catalogue combinations;
- high-rate admin actions;
- chargeback ratio;
- refund ratio.

Do not automatically accuse users of fraud from one heuristic.

## "Paid but Still Free" Recovery
This must be treated as a priority support case.

```text
Customer says payment succeeded
→ look up authoritative checkout intent
→ inspect provider transaction server-side
→ inspect webhook/event ledger
→ inspect entitlement row
→ if provider confirms paid and entitlement missing:
     run idempotent reconciliation
     apply entitlement
     record incident/support evidence
→ if provider does not confirm:
     keep access unchanged
     explain pending/failed state truthfully
```

Do not manually fake a payment just to make the UI green.

If a manual goodwill grant is appropriate while payment is investigated:
- issue a separate `admin_grant`;
- give it a clear reason and expiry;
- do not merge it with the unresolved payment record.

## Cancellation
- Cancellation must be easy to find.
- Show confirmation.
- Show exact effective date.
- Preserve already-paid access until policy/provider period end unless law/provider terms require otherwise.
- Provider confirmation updates canonical state.
- Do not dark-pattern the user.
- Do not silently renew after confirmed cancellation-at-period-end.

## Invoices and Receipts
Provide:
- billing history;
- provider invoice/receipt links;
- amount;
- currency;
- tax where applicable;
- plan/cadence;
- payment date;
- status;
- refund status.

Do not generate a fake tax invoice if the merchant-of-record/provider is the legal invoice issuer.

## Support Permissions
Suggested roles:
- Support: read billing summary, create support case, request reconciliation.
- Billing Support: above + request refund within policy.
- Billing Admin: issue/refuse refunds, grant/revoke approved entitlements.
- Organization Billing Admin: manage only own organization's seats/billing.
- Super Admin: exceptional actions, tightly audited.

Use least privilege.

## Admin UI
Use existing OCADE admin authorities.

Recommended operator surfaces:
- Accounts;
- Billing;
- Payment events;
- Entitlements;
- Admin grants;
- Refund requests;
- Disputes;
- Support tickets;
- Audit log.

Every mutation shows:
- target account;
- current state;
- requested new state;
- reason;
- consequences;
- confirmation;
- result;
- audit reference.

High-risk actions require typed confirmation where appropriate.

## Supabase Dashboard Fallback
If a polished admin screen is not yet available, authorized operators may use Supabase Dashboard for diagnosis.

However:
- do not casually edit entitlement/profile rows directly;
- prefer calling an audited RPC/Edge Function/admin action;
- table edits that bypass policy/audit are not the canonical operating method;
- service-role secrets never go in browser code;
- every manual commercial mutation must leave an audit trail.

## Suggested Safe Admin RPCs
Names are illustrative; adapt to existing conventions.

```text
admin_grant_entitlement(...)
admin_revoke_entitlement_grant(...)
admin_request_refund(...)
admin_retry_payment_reconciliation(...)
admin_suspend_commercial_access(...)
admin_restore_commercial_access(...)
```

Each must:
- authenticate operator;
- authorize role;
- require recent reauthentication/AAL2 where applicable;
- validate target;
- validate catalogue/policy;
- use idempotency;
- perform one transaction where possible;
- write audit evidence;
- return a typed result;
- never expose provider secrets.

## Required Tests

### Admin grants
- grant Pro to Free user;
- grant Max to Free user;
- grant approved custom entitlement;
- lookup by email resolves immutable user ID;
- unknown email;
- duplicate grant request;
- expiry;
- revoke;
- provider payment coexists with grant;
- provider failure does not erase grant;
- ordinary user cannot self-grant;
- other-organization admin cannot grant;
- audit record exists;
- entitlement propagates across devices;
- no model redownload.

### Payments
- successful subscription;
- pending webhook;
- reconciliation success;
- duplicate webhook;
- replay;
- stale event;
- out-of-order event;
- wrong environment;
- wrong catalogue item;
- client price tampering;
- client plan tampering;
- renewal;
- upgrade;
- downgrade;
- cancellation;
- failed payment;
- expiry;
- cross-device update;
- provider outage;
- no-charge gate.

### Refunds
- full refund;
- partial refund;
- duplicate refund request;
- provider pending;
- provider failure/retry;
- rejected request;
- dispute;
- chargeback;
- reversal;
- stale refund event;
- refund does not revoke unrelated grant;
- audit and customer state match provider truth.

### Security
- ordinary user denied admin RPC;
- support role cannot perform billing-admin action;
- expired reauth denied;
- AAL1 denied where AAL2 required;
- RLS cross-user denial;
- RLS cross-organization denial;
- service secrets absent from client bundle/logs.

## Final Commercial Gate
Do not enable live charging until all `PLAN.md` payment conditions pass, including:
- sandbox checkout;
- real provider-specific webhook verification;
- catalogue/price match;
- tax configuration;
- legal entity/production credentials;
- no-charge safety;
- controlled real low-value payment;
- entitlement activation;
- cancellation;
- refund;
- browser proof;
- cross-device entitlement proof.

A production payment system is complete only when:
1. money state is authoritative;
2. access state is authoritative;
3. the two reconcile automatically;
4. failures are recoverable;
5. manual grants are safe and audited;
6. refunds/disputes are truthful and idempotent;
7. users can understand what they bought and what happens next.