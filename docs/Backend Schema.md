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

- ordinary authenticated user: own account data only;
- admin/owner: hidden privileged operations through audited server/RPC authorities;
- service role: server-only, never client;
- anonymous: only explicitly public data/routes.

## RLS principles

- Enable RLS on user-owned tables.
- Prefer one clear policy per role/command rather than overlapping permissive policy sprawl.
- Grants and RLS both matter.
- Parent/child ownership must be validated; a foreign key alone is not authorization.
- Security-definer functions use pinned search paths and explicit auth checks.

## Device/offline authority

An account currently allows the approved Offline-device cap (two per kind under current policy). Registration and revocation are transactional server functions.

Offline model data itself is **not database content**. It stays in browser OPFS on the device.

## OPFS model storage

Only OPFS may contain:
- model bytes;
- range chunks/partials;
- download checkpoints;
- model verification metadata;
- active/previous release pointers;
- runtime-owned model files/assets.

No model byte/chunk copy in IndexedDB, Cache Storage, localStorage or cloud account storage.

The explicit “user removed Offline” preference is not model data and must survive model deletion.

## Account memory

If memory is enabled, it is account-owned, controllable and clearable. Do not create a second uncontrolled hidden profile store. Memory must not ingest Temporary Chat.

## File storage

Cloud Library content is private account content. Validate ownership and detected file type. Temporary Chat files are not written to Library unless explicitly saved.

## API/RPC boundaries

Critical RPC classes:
- generation permit acquire/finalize/release;
- read commercial usage;
- Offline usage allocate/reconcile/return;
- browser device register/revoke;
- entitlement grant/revoke;
- account session list/revoke;
- notification preference/save/read;
- atomic Chat mutation such as regenerate truncation where required.

## Admin grants

Admin grants:
- target an account resolved server-side;
- require admin/owner role and strong auth;
- cannot self-grant when policy forbids it;
- specify tier, duration and reason;
- are auditable and expiring.

## Data deletion

Account/conversation/Library deletion must be real, bounded and auditable where required. Current conversation product uses permanent Delete after confirmation rather than a separate user-facing Trash lifecycle.

## Historical schema rule

Do not surface Projects, Tasks, Automations, Monitors, Organizations, public shares or other retired product schema merely because an old migration mentions them. If obsolete live objects still exist, remove them only through safe migrations after confirming no current caller/data-retention requirement.
