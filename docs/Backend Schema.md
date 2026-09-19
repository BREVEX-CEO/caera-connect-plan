# OCADE Backend Schema

## Scope

This document describes the current OCADE website data authority. Old migrations may contain historical product experiments; historical schema does not create a current product requirement.

## Authentication

Supabase Auth is canonical. Product target methods are Google, email OTP and password. MFA/strong assurance gates privileged actions.

Never accept a request-supplied user id as ownership proof.

## Current account tables

Generated types currently include these current-product groups:

### Identity/account
- The `profiles` table stores the account profile record.
- The `user_roles` table stores authorized account roles.
- The `user_settings` table stores synchronized account settings.
- The `user_private_records` table stores private account records that require restricted access.
- Legal and security audit records are retained only where the current product or applicable requirements need them.

### Chat
- The `ocade_conversations` table stores owned conversation records.
- The `ocade_messages` table stores messages that belong to an owned conversation.

Messages belong to an owned conversation. Client keys/idempotency prevent duplicate offline/retry insertion. Citations/reactions belong with the message where implemented.

### Library
- The `ocade_library_items` table stores private Library item records.
- Storage deletion or tombstone records are used only where safe cleanup requires them.

Library objects are private to the owning account unless a future explicitly approved sharing product changes that rule.

### Commercial usage and entitlement
- The `ocade_commercial_usage` table stores authoritative account usage state.
- The `ocade_generation_permits` table stores logical generation permits and settlement state.
- The `ocade_entitlement_grants` table stores audited temporary entitlement grants.
- Offline usage allocation, lease and event tables enforce account-wide Offline usage.
- The `devices` table stores registered device records.
- The `browser_grants` table stores browser-level device authorization state.

The browser may read only what it needs. Security-sensitive device/grant state changes use narrow RPCs rather than generic direct UPDATE.

### Notifications
- The `ocade_notification_preferences` table stores synchronized notification preferences.
- The `ocade_notifications` table stores in-app notification history.

### Current legacy commercial records

The generated schema still contains subscription/invoice/payment-event tables from previous payment work. Paid checkout is now closed and Paddle is not a current product. Do not build new behavior on provider-specific payment tables. Retire obsolete provider-specific runtime/code through an owner-approved safe cleanup that preserves evidence required by law/audit.

## Roles

- An ordinary authenticated user may access only their own account data.
- An admin or owner may perform hidden privileged operations only through audited server or RPC authorities.
- The service role is server-only and must never be exposed to the client.
- Anonymous users may access only explicitly public data and routes.

## RLS principles

- Enable row-level security on every user-owned table.
- Prefer one clear policy per role/command rather than overlapping permissive policy sprawl.
- Treat explicit grants and row-level security as separate required controls.
- Parent/child ownership must be validated; a foreign key alone is not authorization.
- Security-definer functions use pinned search paths and explicit auth checks.

## Device/offline authority

An account currently allows the approved Offline-device cap (two per kind under current policy). Registration and revocation are transactional server functions.

Offline model data itself is **not database content**. It stays in browser OPFS on the device.

## OPFS model storage

Only OPFS may contain:
- Store model bytes in OPFS only.
- Store model range chunks and partials in OPFS only.
- Store model download checkpoints in OPFS only.
- Store model verification metadata in OPFS only.
- Store active and previous release pointers in OPFS only.
- Store runtime-owned model files and assets in OPFS only.

No model byte/chunk copy in IndexedDB, Cache Storage, localStorage or cloud account storage.

The explicit “user removed Offline” preference is not model data and must survive model deletion.

## Account memory

If memory is enabled, it is account-owned, controllable and clearable. Do not create a second uncontrolled hidden profile store. Memory must not ingest Temporary Chat.

## File storage

Cloud Library content is private account content. Validate ownership and detected file type. Temporary Chat files are not written to Library unless explicitly saved.

## API/RPC boundaries

Critical RPC classes:
- Use RPCs to acquire, finalize and release generation permits.
- Use an RPC to read authoritative commercial usage.
- Use RPCs to allocate, reconcile and return Offline usage.
- Use RPCs to register and revoke browser devices.
- Use RPCs to grant and revoke entitlements.
- Use RPCs to list and revoke account sessions.
- Use RPCs to read and save notification preferences and notification state.
- atomic Chat mutation such as regenerate truncation where required.

## Admin grants

Admin grants:
- Resolve the target account on the server side before applying a grant.
- Require an admin or owner role plus strong authentication for grants.
- Prevent self-granting whenever policy forbids it.
- Require every grant to specify the tier, duration and reason.
- Ensure that every admin grant is auditable and expiring.

## Data deletion

Account/conversation/Library deletion must be real, bounded and auditable where required. Current conversation product uses permanent Delete after confirmation rather than a separate user-facing Trash lifecycle.

## Historical schema rule

Do not surface Projects, Tasks, Automations, Monitors, Organizations, public shares or other retired product schema merely because an old migration mentions them. If obsolete live objects still exist, remove them only through safe migrations after confirming no current caller/data-retention requirement.
