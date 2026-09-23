# OCADE Project Memory

## Current status

- The company identity is **CARCC**. The product identity is **OCADE**. The approved tagline is **Command the Next Era.**
- Branch `claude/cool-allen-rlxvkm` (2026-09-23) implements the PLAN.md F01–F35 review on top of `main` `e0880f3`.
- Verified on that exact tree: `verify:full` 15/15 gates, 84 test files / 867 tests, 11 browser journeys / 313 checks against the local build and Supabase stub.
- Supabase migration `close_client_write_paths` (repo `20260923090000`) is applied live and verified.
- Supabase migration `20260923100000_retire_trash_payments_and_side_threads` is **not applied yet**. Apply it only after the Worker built from this branch is live, because the old Worker still reads `deleted_at` and the retired message columns.
- The live Worker was last seen at deployment `987d6324-3878-4811-a179-dfb143337941`; `/api/health` gains a `commit` field once this branch deploys.

## Completed in this mission

- Build/test gates green; entitlement comes from audited grants only; dead limits, Cowork, Trash/restore, side-thread columns and closed payment schema retired.
- Chat: delivery is the first visible token (no free answers on chat switch); a partly read answer is kept with its own chat.
- Offline: one serialized generation slot that disposes the runtime after any unfinished generation (no cross-chat text); context sized to device memory with a packed transcript; OPFS `versions/pointers.json` is the only install authority (localStorage keys migrated once and cleared); cleanup no longer deletes that manifest.
- Security: no browser role can write `user_roles`, TRUNCATE, or write grants/usage/tombstones; permits accept Chat only.
- Deletion: account deletion checks every step before removing the sign-in identity; Library tombstones are acknowledged only after Storage confirms.
- UX: `Auto | Online | Offline`, password sign-in behind "Use a password instead", highlight → Ask OCADE, Archive/Unarchive, truthful no-network banner, device rows distinguished by when added, Upgrade in the account menu, corrected social image and small brand mark.

## Open items needing the owner

- Paid checkout: PLAN.md asks for a real checkout, but no payment provider or credentials exist. Choose a provider and supply credentials; until then Upgrade truthfully says paid plans are not open.
- Cloudflare zone "Always Use HTTPS" (F24) and Supabase leaked-password protection (F14) are dashboard settings.
- Two live accounts each hold two active device places for one browser (F04). Settings now shows when each was added so the owner can remove the older one.
- Offline answer quality (F18/F21/F22) needs a real-device evaluation with the installed model.
- A restart-safe encrypted journal for unsynced Offline turns is still not implemented (turns are held in the open tab).
- Branch deletion: all non-main branches were reviewed; none carries unmerged current-product value.

## Important context

The owner is a non-coder/vibe coder and expects agents to make technical decisions independently. Ask only for genuine owner-only credentials, billing/legal/business choices, destructive approval or unavailable physical-device interaction.

GitHub Actions is optional because paid Actions cannot be relied on. Red/unavailable Actions are not an application failure.

## Product facts

- Current surfaces: Chat, Library, Settings, Pricing, auth, public/legal pages, hidden Admin.
- Free 28/6h28m; Pro 140/6h28m + 700/week; Max 1,400/6h28m + 7,000/week.
- Offline device cap: two per kind under current policy.
- Current paid prices remain the approved 8/28 anchors, but paid checkout is closed.
- Ensure that Temporary Chat persists nothing.
- Manual Offline sends zero Online-provider traffic and refuses images.
- Explicit Offline Remove is permanent until explicit Install.
- Normal website updates must never redownload the same verified Offline release.

## Storage decisions

Offline model bytes/chunks/checkpoints/model metadata/pointers/runtime model assets: **OPFS only**.

No IndexedDB/Cache Storage/localStorage model copy.

The user-uninstalled preference is separate non-model state so it survives deleting the model.

Offline unsynced account work that must survive restart should use encrypted local storage/journal and exactly-once reconciliation.

## Branding

Remove current **CARCC CADANE**, **CADANE**, and old package branding. Use:

- Use CARCC as the company name.
- Use OCADE as the product name.
- Use “OCADE by CARCC” as the formal attribution where company ownership context is useful.

Founder/About remains publicly discoverable but secondary to the product.

## Session handoff

At the beginning of a new/resumed/context-compacted Claude session:

1. run `/ponytail ultra`;
2. run `/caveman ultra`;
3. read `AGENTS.md`;
4. read the current task and `PLAN.md`;
5. read this file;
6. read only the relevant canonical docs.

Do not revive removed products from historical migrations. Do not rewrite `PLAN.md` without an explicit owner request. Prove implementation separately from documentation.
