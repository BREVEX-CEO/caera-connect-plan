# OCADE Decision Log

## CARCC → OCADE brand architecture

### Date
2026-09-19

### Status
Active

### Context
The former combined CARCC CADANE identity no longer represents the desired company/product relationship.

### Decision
**CARCC is the company. OCADE is the product.** Use the relationship the same way a technology company owns a distinct AI product. Remove current CADANE branding.

### Consequences
Product UI leads with OCADE. CARCC appears in company/about/legal attribution.

## Current mission is website-only and Chat-first

### Date
2026-09-19

### Status
Active

### Decision
Current required product is Chat + Library + Settings + Offline Intelligence + usage + Pricing/auth/public/legal surfaces. Cowork may remain only as a reserved placeholder.

Do not build Code, Projects, Tasks, Automations, Monitors, Organizations, native apps, public sharing or other future products until a new explicit mission.

## Provider/model identity stays private

### Date
2026-09-19

### Status
Active

### Decision
Customers see Auto/Online/Offline and OCADE capability language. Provider/model/vendor/runtime identities do not appear in ordinary UI, public documentation, client diagnostics or bundle-visible customer surfaces.

Where real identity is technically unavoidable, keep it in tightly scoped server-only deployment/secret configuration.

## OPFS is the only Offline model store

### Date
2026-09-19

### Status
Active

### Decision
Offline model bytes, chunks/ranges, checkpoints, verification/model metadata, active pointers and runtime model assets live only in OPFS.

### Alternatives rejected
IndexedDB model copies, Cache Storage model copies, localStorage model metadata/bytes and library-internal duplicate model caches.

### Consequence
Explicit uninstall preference remains separate non-model product state so deleting OPFS model data does not erase the user's “do not reinstall” choice.

## Offline installation behavior

### Date
2026-09-19

### Status
Active

### Decision
Begin preparation automatically after first sign-in unless the user explicitly removed Offline. Keep Online usable during install. Allow Wi-Fi/hotspot/cellular with a cellular warning and explicit continue. Site deploys do not redownload an unchanged verified release.

After explicit Remove, never auto-reinstall. Later sign-in and selecting Offline provide an easy Install/Cancel path.

## Offline has no image mode

### Date
2026-09-19

### Status
Active

### Decision
Manual Offline does not accept/upload/read images and makes zero Online provider requests.

## Chat deletion is permanent

### Date
2026-09-19

### Status
Active

### Decision
Use one permanent Delete with explicit confirmation rather than maintaining separate user-facing Archive/Trash/restore deletion authorities. Archive, if retained, is only organization—not deletion.

## Highlight → Ask OCADE

### Date
2026-09-19

### Status
Active

### Decision
Selected text can be sent to Ask OCADE using current conversation context. Do not create a separately persisted side-conversation product for this interaction.

## Memory behavior

### Date
2026-09-19

### Status
Active

### Decision
Memory may run automatically and quietly only after account-level enablement. The user can disable/clear it in Data Controls. Temporary Chat never enters memory.

## Usage

### Date
2026-09-19

### Status
Active

### Decision
One successful logical answer = one use across every device and Auto/Online/Offline. Failures = zero. Account-anchored limits:
- Free 28/6h28m;
- Pro 140/6h28m + 700/week;
- Max 1,400/6h28m + 7,000/week.

Offline device cap remains two per kind under the current policy.

## Pricing and payment

### Date
2026-09-19

### Status
Active

### Decision
Keep Free/Pro/Max, weekly/monthly catalogue and current approved price anchors/numeric signature. Paid checkout is closed now. Remove Paddle as a current runtime/product dependency; Upgrade states that paid plans are not open.

## Authentication

### Date
2026-09-19

### Status
Active

### Decision
Target methods are Google, six-digit email OTP and password. MFA optional for ordinary use and required for privileged/admin actions.

## Notifications

### Date
2026-09-19

### Status
Active

### Decision
In-app first, account-synced preferences and quiet hours. Customer notification preferences may control delivery categories; retain security/audit records separately where product/legal requirements require evidence.

## Data authority

### Date
2026-09-19

### Status
Active

### Decision
Supabase remains canonical for durable signed-in account data. Offline model storage is OPFS-only. Disconnected account work that must survive restart uses an encrypted reconciliation journal, not plaintext durable chat storage.

## UI

### Date
2026-09-19

### Status
Active

### Decision
Dark, minimal, premium, restrained glass, ChatGPT/Grok-like conversational simplicity. Same core functionality on desktop/tablet/phone. Normal users see no infrastructure jargon.

## Agent execution

### Date
2026-09-19

### Status
Active

### Decision
Every new/resumed/context-compacted Claude session begins by running `/ponytail ultra` and `/caveman ultra` before proceeding. YAGNI/KISS and one-authority design apply throughout; there is no required end-of-plan Ponytail ritual.
