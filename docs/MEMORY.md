# OCADE Project Memory

## Current status

- Company identity: **CARCC**.
- Product identity: **OCADE**.
- The approved tagline is **Command the Next Era.**
- Current `main` entering this documentation change: `6c40e68f9d242e6c27f55af18b30d875518f98ed`.
- The previous 15-finding audit was implemented on that tree; the reported verification was 15/15 gates, 927 tests and 312 browser checks.
- Supabase migrations from that mission were applied and the Online Intelligence function was reported at version 8.
- Cloudflare build settings were corrected to use `npx wrangler deploy --config wrangler.json`; production redeploy/live smoke still needs authoritative confirmation after that setting change.
- `PLAN.md` is intentionally not modified by this product-documentation update.

## Recently completed

- Audit/root-cause repair for HTTPS, device authority/cap races, admin MFA/search, Chat request races, regenerate atomicity, Offline uninstall truth, mobile polish and related hidden defects.
- Additional adversarial fixes included Library upload bounds/type authority, account-deletion compliance record, server-time regenerate boundary and local HTTPS-loop handling.

## Currently in progress

The product authorities are being reset to the owner's final current-scope decisions:
- CARCC → OCADE branding;
- website-only Chat-first mission;
- Auto | Online | Offline;
- provider/model identity hidden from customer/client surfaces;
- OPFS-only Offline model storage/download;
- no live Paddle/paid checkout;
- no current Projects/Tasks/Automations/Monitors/Organizations/Code/native-app product;
- mobile-first parity;
- clean ChatGPT/Grok-like UI.

## Known implementation gaps created by the new decisions

Documentation is authoritative about the desired product, but current source may still need follow-up implementation to:
- remove remaining CADANE strings/package identity;
- remove current Paddle-specific runtime/webhook code safely;
- add password auth alongside Google/email OTP;
- migrate any model metadata/checkpoints that still live outside OPFS into the one OPFS model authority;
- implement encrypted restart-safe pending offline conversation journal;
- simplify permanent conversation deletion if current Trash/restore code still exists;
- replace old side-conversation machinery with highlight → Ask OCADE where applicable;
- align notification behavior with the new preference decision;
- implement/enable Status and editable Help Center only when their real backend flow is ready.

Do not call these complete merely because the docs say they are required.

## Important context

The owner is a non-coder/vibe coder and expects agents to make technical decisions independently. Ask only for genuine owner-only credentials, billing/legal/business choices, destructive approval or unavailable physical-device interaction.

GitHub Actions is optional because paid Actions cannot be relied on. Red/unavailable Actions are not an application failure.

## Product facts

- Current surfaces: Chat, Library, Settings, Pricing, auth, public/legal pages, hidden Admin. Cowork is only a reserved placeholder.
- Free 28/6h28m; Pro 140/6h28m + 700/week; Max 1,400/6h28m + 7,000/week.
- Offline device cap: two per kind under current policy.
- Current paid prices remain the approved 8/28 anchors, but paid checkout is closed.
- Temporary Chat persists nothing.
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
- company: CARCC;
- product: OCADE;
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
