# OCADE Backend Schema and Data Rules

## Authorities

Supabase Auth and PostgreSQL remain the durable identity/data/security authority.

Do not create duplicate account, role, usage, conversation, device or task systems when an approved authority already exists.

## JARVIS conversations and tasks

Chat and JARVIS remain logically separate.

JARVIS conversations use a clear canonical discriminator so ordinary Chat queries cannot accidentally mix JARVIS state.

JARVIS tasks require durable:
- owner account;
- conversation;
- task/request identity;
- target device;
- status;
- checkpoint;
- action/idempotency state;
- result;
- timestamps.

Detailed activity remains customer-safe; raw internal provider/tool traces are not customer Activity.

## JARVIS Online-only rule

No schema or fallback route may silently route JARVIS to Chat Offline Intelligence.

If Online capacity is unavailable, persist safe task/checkpoint state and surface bounded unavailable state.

## Device identity

Each device has unique revocable cryptographic identity.

Persist only safe verification material server-side.

Support:
- credential rotation;
- revocation;
- device kind/platform;
- software/protocol version;
- capabilities;
- permission state;
- last health/seen metadata needed for product behavior.

Never use account passwords as device credentials.

## Action broker state

Persist minimum state required for:
- dispatch-time revalidation;
- idempotent claim;
- retry authority;
- cancellation;
- active control lease;
- checkpoint/resume;
- late-result rejection;
- verified result settlement.

Removing a device must cancel open task/activity authority before credentials become unusable.

## Safety controls

Physical execution controls are server-authoritative.

Unreadable safety-control state must not be treated as allowed execution.

Use forward migrations to retire obsolete browser-bridge control/device state after replacement proof. Never edit old applied migrations.

## Owner/Staff roles

The role model must support:
- primary_owner;
- backup_owner;
- admin;
- support;
- billing;
- developer_operations;
- read_only;
- normal customer/user state;
- granular permission overrides.

Legacy `admin | moderator | user` representation must be migrated carefully rather than merely relabeled in frontend code.

Role grants bind stable user UUIDs, not email strings.

Store staff invite/status, role assignment, permission override, 2FA/assurance-related operational state, privileged session revocation state and audit.

## Audit

Privileged mutations append records including relevant:
- actor;
- role;
- target;
- action;
- old/new state;
- reason;
- time;
- session/device context.

History is append-only.

## Conversation support access

Customer conversations remain private.

Temporary support access requires a scoped case/grant with:
- named staff identity;
- target account/conversation;
- reason;
- issuer;
- start;
- expiry/revoke;
- audit.

No broad staff conversation read policy.

## Usage/entitlement

Owner unlimited product access is an entitlement, not disabled metering.

Usage adjustments and plan/complimentary grants append auditable changes rather than rewriting event history.

## Files/screenshots

Raw screen frames are transient by default.

Persist only structured result/evidence with documented purpose.

## Offline Chat model metadata

The browser/local model authority must persist:
- release identity;
- completed byte/range state;
- integrity metadata;
- explicit removed/tombstone state where needed.

Deployment/source changes do not imply model release changes.

Do not redownload a complete valid installed artifact merely because the app was redeployed.

## Security

Every user-owned table uses RLS plus explicit grants.

Privileged functions pin search_path and verify caller role/permission.

Prompt/page/tool content cannot alter authorization.

One-time auth secrets remain ephemeral.

No provider keys, raw payment secrets, CVV/CVC or plaintext passwords/MFA secrets in customer/admin tables.
