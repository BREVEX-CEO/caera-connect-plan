# OCADE Project Rules

## Authority

Follow the latest owner request and `PLAN.md`.

Historical docs/audits are evidence, not permission to override newer authority.

## Donor

- Never modify/move/delete immutable donor source/ZIP.
- Inspect donor first for every JARVIS execution capability.
- Copy/adapt useful donor logic into active runtime.
- Target approximately 98% donor capability/logic reuse where safe.
- Do not ship donor GUI/provider-key/customer-plugin product paths.
- Production must not import directly from immutable source.

## JARVIS

- Online-only.
- No silent Offline fallback.
- Provider identities/keys hidden.
- Conversational during work.
- Verify before Done.
- Final purchases prohibited.

## Browser

- No customer browser add-on dependency.
- Existing authorized browser/profile first.
- CDP/semantic/accessibility before vision/coordinates.
- Never extract saved credentials.
- Human auth boundaries remain human.
- Re-observe after change.

## Device

- One action broker.
- Revalidate at dispatch.
- STOP locally cancels active work.
- User input pauses normal automation.
- Co-work uses one input owner at a time.
- Fail physical execution closed if safety-control state is unreadable.
- Removing a device stops active work before forgetting credentials.
- No unnecessary terminal popups.

## Files/apps

- Scoped folder/workspace by default.
- Explicit broader grants allowed.
- Trash default.
- Protect overwrites.
- Prefer direct APIs/files/document operations.
- Professional apps use native/accessibility/vision/coordinates hierarchy.

## Excel

Use formulas and structured operations intelligently; do not manually repeat work that a formula/fill/table can solve. Preserve workbook features and verify major results in real Excel.

## Voice

“OCADE” and “Hey OCADE” pre-wake processing is local. The wake model is bundled with the Device Agent and the Android app and verified against its signed manifest; nothing is downloaded after installation (owner direction 2026-10-02).

User can talk while JARVIS works.

## Android

Use legitimate Android APIs/permissions. Never bypass security prompts.

## Apple

Do not represent WebKit as physical Apple evidence.

## Admin

Server-side stable identities/roles only. No frontend email authorization.

Customers see no privileged UI.

2FA required for privileged work after current enrollment bug is fixed.

## Offline Chat model

A merge/deployment must not cause model redownload. Persist installed artifacts/ranges/release identity in stable storage and repair only what is missing/corrupt.

## Testing

After every meaningful change:
local test -> MCP/real UI -> root-cause fix -> exact retest -> adversarial -> broader regression.

One controller per surface.

Blocked evidence stays blocked.

Visual bugs are real bugs.

## Cleanup

Run Caveman/Ponytail after proof. Consult ToRemove.md. Preserve donor/audits/applied migrations.

## Reporting

Every phase includes commercial-launch readiness percentage and exact evidence.


## Current engineering rules — 2026-10-06

Prefer the smallest proven solution. Remove as much duplicate code, obsolete branching, hard-coded application knowledge, redundant polling, duplicated UI and unused dependency surface as safely possible. There is no numeric code-reduction quota and no reward for deleting useful capability.

New application support must flow through the universal execution engine. Do not introduce permanent app-name branches, stored coordinates or separate privileged controllers unless measured evidence proves that a specialized adapter is necessary for reliability, fidelity, safety, performance or platform integration.

Keep deterministic work local once a bounded plan is issued. Use events or callbacks instead of periodic polling when a trustworthy owner can signal completion. Keep model calls for reasoning, unfamiliar-software planning and recovery rather than ordinary deterministic sub-actions.

Every success claim requires an observable postcondition. Every STOP claim distinguishes requested cancellation from confirmed quiescence. Every permission, scope and platform-security boundary remains enforced even when doing so adds latency.

Customer interfaces should expose outcomes and policy choices, not internal execution mechanisms. Setup should be collapsed to the smallest truthful flow the platform permits.

## Current execution authority — 2026-10-06

This document governs engineering behavior and implementation constraints, while `PLAN.md` is the single current execution roadmap. Older phase-range wording is historical context only. Newer Owner decisions in `PLAN.md` supersede older conflicting detail.
