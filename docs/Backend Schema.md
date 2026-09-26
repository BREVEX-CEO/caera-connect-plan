# OCADE Backend Schema and Data Rules

## Authority

Supabase Auth and PostgreSQL remain the durable account/security authority.

JARVIS reuses approved OCADE authorities rather than creating a second account or conversation database.

## JARVIS conversations

JARVIS conversations reuse the existing conversation/message authority.

The schema must distinguish JARVIS from ordinary Chat through a safe surface/type discriminator or equivalent canonical mechanism.

RLS continues to scope every conversation/message to the owning account.

Normal Chat queries must not accidentally return JARVIS conversations unless explicitly requested.

JARVIS queries must not accidentally mix ordinary Chat history into JARVIS.

## JARVIS tasks

The first mission represents JARVIS task state using approved conversation/message authority plus minimal execution-state metadata rather than reviving the retired generic Tasks product.

A task requires durable identifiers for account, conversation, task/request identity, status, current step/progress, result reference, and timestamps where current schema cannot represent them safely.

Do not revive historical project/task/automation tables merely because they exist in migration history.

## JARVIS memory

JARVIS memory remains logically separate from Chat memory.

If current memory authority supports namespaces/surfaces, use a JARVIS namespace rather than creating an uncontrolled duplicate database.

Memory remains optional/account-controlled.

Temporary raw screenshots do not become long-term memory by default.

## JARVIS activity

Detailed JARVIS activity records customer-safe action events and security-relevant state.

Detailed activity uses a 90-day retention policy.

Important durable task results are not deleted merely because detailed logs expire.

Raw provider/internal logs are not customer Activity.

## JARVIS usage

JARVIS usage is a separate usage kind from Chat.

The server/database authority records successful resource-bearing internal JARVIS work according to approved plan rules.

Failed or no-result internal steps are reconciled rather than blindly finalized as customer usage.

The client never decides entitlement or usage count.

## Devices and permissions

Devices remain account-owned and revocable.

JARVIS capability permissions may use the current device authority or a minimal extension of it.

The permission model supports global JARVIS enable/disable plus granular Browser, Files, Screen, Microphone, Camera, Apps, Messaging, Devices, and future Computer Control permissions.

Device-sensitive permission state is scoped per device.

## Allowed Apps

Allowed Apps are account/device capability configuration, not a generic executable plugin store.

Any durable allowed-app record is owner-scoped and permission-checked.

The original generic plugin subsystem remains code-preserved but is not exposed as a customer product surface.

## Secret material

Provider/service-role credentials never enter customer tables.

If a future encrypted credential vault is implemented, it is a separate security subsystem with strong encryption/key management and explicit user control.

One-time authentication secrets remain ephemeral.

Payment card security codes are never stored.

## Visual/task data

Raw screenshots and visual frames are temporary by default.

Persist only structured task/memory information that has a documented user purpose.

Treat uploaded/extracted/observed content as untrusted.

## Security

Every user-owned table uses RLS plus explicit grants.

Privileged server functions pin search_path and verify auth/role/permission explicitly.

JARVIS action execution verifies account, context, permission, and device identity server-side/runtime-side rather than trusting browser claims.

Prompt or website content cannot grant new permissions.

## Migration discipline

Use forward-only migrations for live schema changes.

Do not edit applied migrations to make history cleaner.

Add verification SQL and rollback/provenance support consistent with current repository rules.


## Deeper-device schema requirements

The next device migration should extend existing JARVIS device/task authorities rather than create duplicate account or task systems.

Persist only the minimum durable state needed for:

- unique device public identity / server-verifiable credential material;
- credential rotation metadata and revocation state;
- protocol/agent/extension versions;
- device capability and permission state;
- active UI-control lease ownership;
- durable task checkpoints and resumability metadata;
- background/wake enablement;
- customer-safe new-device/security notifications;
- signed update/rollback state where server coordination is required.

Keep raw device secrets out of normal tables/logs. Keep RLS and server authorization aligned with existing account ownership. Device credentials must not authorize another account/device through identifier substitution.

Do not create mobile-native-app-specific schema merely to simulate capabilities that remain web/PWA-only.
