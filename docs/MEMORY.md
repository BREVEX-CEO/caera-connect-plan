# OCADE Project Memory

## Current status

- The company identity is **CARCC**. The product identity is **OCADE**. The approved tagline is **Command the Next Era.**
- Production runs `main`: `/api/health` reports the deployed Git `commit`. Worker `ocade-web` deployment `5c447810-7c15-4dce-8610-58517a343960` served `eeae0a28` on 2026-09-25.
- Supabase migrations `20260923100000` (Trash, payment tables, side threads) and `20260925140000` (orphan enums) are applied live. Edge Function `ocade-intelligence` v9 accepts Chat only.
- Gates: `npm run verify:full` (15 gates) plus `node scripts/e2e/harness.mjs` (11 browser journeys against the local build and Supabase stub). `npm audit`: 0 vulnerabilities.
- Deploy: the `Cloudflare production deployment` workflow or `npm run deploy:web` with Cloudflare credentials; agent sessions cannot reach the Cloudflare API.

## Completed in this mission

- Build/test gates green; entitlement comes from audited grants only; dead limits, Cowork, Trash/restore, side-thread columns and closed payment schema retired.
- Chat: delivery is the first visible token (no free answers on chat switch); a partly read answer is kept with its own chat.
- Offline: unsynced turns kept in an encrypted restart-safe journal and uploaded exactly once; one serialized generation slot that disposes the runtime after any unfinished generation (no cross-chat text); context sized to device memory with a packed transcript; OPFS `versions/pointers.json` is the only install authority (localStorage keys migrated once and cleared); cleanup no longer deletes that manifest.
- Security: no browser role can write `user_roles`, TRUNCATE, or write grants/usage/tombstones; permits accept Chat only.
- Deletion: account deletion checks every step before removing the sign-in identity; Library tombstones are acknowledged only after Storage confirms.
- UX: `Auto | Online | Offline`, password sign-in behind "Use a password instead", highlight → Ask OCADE, Archive/Unarchive, truthful no-network banner, device rows distinguished by when added, Upgrade in the account menu, corrected social image and small brand mark.

## Open items needing the owner

- Paid checkout: on hold by owner choice. Upgrade stays truthful and non-charging; no payment provider is built.
- Supabase leaked-password protection (F14) is unavailable on the current plan.
- Offline answer quality (F18/F21/F22): format steering and JSON grammar are unit-tested; a real-device evaluation with the installed model is still needed.
- Research "busy": the request matches the provider's documented grounding format; the cause of earlier 429s needs provider quota evidence.
- Two accounts still hold a duplicate device place created on 2026-08-24, before registration was keyed to one install id; neither has been active since. Remove the older one in Settings if wanted.
- Agent sessions cannot delete remote branches; delete any non-`main` branch in GitHub's Branches page.

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

Offline unsynced turns survive restart in an AES-GCM encrypted IndexedDB journal (`src/lib/chat/unsynced-turns.ts`, non-extractable per-account key, deleted at sign-out) and upload exactly once through the server `clientKey` dedupe.

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
