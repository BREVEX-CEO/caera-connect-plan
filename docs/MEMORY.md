# OCADE Execution Memory

## Recovery purpose

This file is the concise recovery checkpoint for the active Chat-first production mission. After context loss, Auto Continue, usage reset, crash, or new Claude session, read `PLAN.md`, `CLAUDE.md`, and this file before changing code. Do not restart completed work or revive superseded plans.

## Current source baseline at documentation rewrite

- Repository: `BREVEX-CEO/caera-connect-plan`.
- Verified starting `main`: `328f0ab97b385aeacc9db0461ec1ffd59e755c57`.
- Product version in `package.json`: `0.1.0`.
- Existing source was previously debloated from 45,226 to about 42,884 `src` LOC and from 221 to 214 source files; future Phase 13 measurements must re-measure the actual current tree rather than assuming those counts remain exact.
- The previous final verification reported 15/15 gates, 789 unit/database tests, and 11 browser journeys, but much of that browser evidence used a loopback Supabase stub. The new plan explicitly requires live production proof for the critical paths.

## Live Supabase baseline

- Production project: `sazhgaisyhkdbrooycdv`.
- The project is currently healthy.
- The active Edge Function is `ocade-intelligence`, version 6, with JWT verification enabled.
- The owner has already configured `GEMINI_API_KEY_PRIMARY`, `GEMINI_API_KEY_SECONDARY`, `GEMINI_API_KEY_TERTIARY`, and the required allowed-origin setting. Never ask the owner to paste those secret values into chat or source.
- Current active authentication methods for the product are Google and six-digit email OTP. Phone OTP is intentionally removed.
- The permanent owner/admin account is `caeracadane28@gmail.com` through the audited role/grant authority.
- The live private `library` Storage bucket remains required.
- The live schema still contains historical objects including recovery-code and other retired-family tables. Phase 11 must trace callers/data/policies before dropping anything; existing Auth users/sessions/customer/financial/legal/security evidence is protected.
- The current Supabase security advisor reports leaked-password protection disabled. This is not a blocker for the current Google/email-OTP passwordless flow on the owner’s current plan.
- Current performance-advisor findings include auth-RLS initialization patterns, multiple permissive policies, and indexes not yet observed as used. Investigate against real workloads before changing them.

## Private Offline release baseline

The owner has completed the private artifact preparation and upload.

```text
release id: ocr-2dc0ee44eb397906
byte length: 484220160
sha256: 2dc0ee44eb39790624623cf5e2a8cc21973c4839a67fed406dd3f9b2e6b7f800
private R2 bucket: ocade-private-models
private object: r/ocr-2dc0ee44eb397906/a
```

The artifact structure and full digest were verified, real Chromium WASM generation was proven by the owner, and the private R2 object length was verified. Remaining work is product/live delivery integration, real install/resume/repair/remove/reinstall proof, real WebGPU generation on capable hardware, forced WebGPU→WASM fallback proof, and final `ocade.in` Offline certification.

## Current known production problems

- Real Chat can display “OCADE could not verify your usage allowance. Nothing was sent and nothing was charged.” Treat this as the Phase 1 P0 contract/deployment bug.
- The repository contains newer intelligence work than the deployed Edge Function. Source, live function, database RPCs/types, and frontend must be reconciled before production parity is claimed.
- Billing can remain indefinitely on “Reading your allowance…”.
- Advanced can remain indefinitely on “Reading your sessions…”.
- Chat history can remain indefinitely on “Loading chats…”.
- Offline Intelligence can appear unavailable even though the owner-approved private release exists.
- Settings Notifications still describes recovery-code behavior even though the application recovery-code system was removed in the prior debloat.
- WebGPU is not yet accepted as real production proof. Capability detection is insufficient.

## Locked latest product decisions

- `/` opens Chat immediately. Signed-out visitors may inspect it, but Send requires sign-in.
- New Chat does not create an empty DB conversation. The first accepted/persisted Send creates the durable conversation.
- The selector is `Auto | Online | Offline`. Auto routes Online when connected/healthy and Offline when disconnected/ready. Online is disabled without Internet. Manual Offline sends zero provider traffic.
- Offline preparation begins automatically after successful sign-in unless the user explicitly removed it. Explicit Remove suppresses all automatic redownload until explicit Install Offline.
- Offline conversations synchronize to Supabase exactly once after reconnection using the minimum safe pending journal/idempotency needed to preserve unsynchronized work.
- Usage is one successful logical request = one use across Online and Offline. Free = 28/6h28m; Pro = 140/6h28m + 700/week; Max = 1,400/6h28m + 7,000/week.
- Chat includes the full interaction/attachment/dictation/temporary/export contract in `PRD.md` and `PLAN.md`.
- Settings categories are Account, Appearance, Notifications, Data Controls, Usage & Limits, Billing, and Advanced.
- UI remains near-black, clean, rounded, minimally glassed, responsive, and free of developer-dashboard clutter or permanent loaders.
- Web research is added through the existing Chat authority after core Chat is stable.
- Cowork remains frozen until this plan is complete.
- Production payment-provider onboarding remains owner-deferred and may not block this non-payment mission.

## This session's environment blockers

These are environment facts, not product findings, and they bound what
"proven" can mean for the work recorded below.

- Outbound HTTPS to `ocade.in` and to `sazhgaisyhkdbrooycdv.supabase.co` is
  refused by this session's network policy (proxy answers 403 to CONNECT). No
  live production HTTP journey, and no live REST call, can be run from here.
- The live Supabase **database** is reachable through the Supabase MCP tools, so
  live schema, RPC signatures, grants and live SQL execution are real evidence.
- Cloudflare is readable through its MCP tools (worker list, bundled code) but
  there is no token or upload path, so the frontend Worker cannot be deployed
  from this session. `npm run deploy:web` needs `CLOUDFLARE_API_TOKEN`.
- Consequence: browser proof here uses the real production build served by
  `wrangler dev` against the loopback Supabase stub. That is real product code
  in a real browser; it is not proof about the hosted project.

## Phase 1 — the allowance failure, root-caused and reproduced

The live database was cleared as a suspect first. Every RPC the ledger calls
exists in `sazhgaisyhkdbrooycdv` with a matching signature, granted to
`service_role` alone, and `ocade_acquire_generation_permit` was executed live
against the owner account: it granted a permit and the probe was released
again, leaving no residue.

The cause is one missing Worker binding. With `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` present but `SUPABASE_SERVICE_ROLE_KEY` absent,
`supabaseAdmin` throws on first use and every server function that needs it
fails at once. Reproduced in a real browser against the production build by
serving it without that one variable — all four reported defects appeared
together:

- Send → “OCADE could not verify your usage allowance.” and the typed question
  was discarded with it;
- Billing → the allowance read failed;
- Advanced → the sessions read failed and rendered nothing at all;
- Data Controls → “Offline Intelligence is not available in this version of
  OCADE yet.”, although the approved artifact exists.

The release gate could not see any of it: it asked only about the two public
values the browser also holds. That is why a dead deployment went green.

### Fixed in this phase

- `/api/health` reports `configuration.supabaseServer` — presence only, never a
  value — and `scripts/deploy.mjs` refuses a deployment whose health says the
  server secret is absent.
- A refused send returns the question and its attachments to the composer.
  `useChat.send` now answers whether the request was accepted.
- Billing, Advanced and the chat sidebar end in success, empty, or an error
  with Retry. One `Pending` component in `components/settings/rows.tsx` owns
  that shape; `UsageSection`'s duplicate `Row` was deleted.
- `docs/TRD.md` names the pinned online model again, which restores the
  documents-and-code agreement test Phase 0 broke.

Proven: 793 unit/database tests, all 11 browser journeys, and a before/after
browser run of the exact reproduction above.

## Production configuration — what is verified and what is not

The owner reports `SUPABASE_SERVICE_ROLE_KEY`, the `OCADE_LEASE_SIGNING_*`
secrets and the `OCADE_MODELS` → `ocade-private-models` binding as configured
and deployed. What this session can actually confirm:

- **Confirmed.** The R2 bucket `ocade-private-models` exists (APAC, Standard),
  created `2026-09-16T08:40:42Z`. Whether it still holds the object
  `r/ocr-2dc0ee44eb397906/a` at 484,220,160 bytes is **not** confirmable from
  here — Cloudflare's tools in this session expose buckets, not objects — and
  the bucket's creation date is newer than the upload recorded above, so the
  object must be re-verified before Offline is called done.
- **Confirmed, and a problem.** The deployed Worker bundle contains neither
  `supabaseServer` nor `Your chats could not be loaded`, so **production is
  running a build from before Phase 1 and Phase 2**. The secrets may well be
  set; the code that uses them correctly, and the health fields that would
  prove they are set, are not deployed yet.
- **Not confirmable.** Worker secret presence cannot be read from this session
  at all. Once the current build is deployed it is one request:
  `curl -s https://ocade.in/api/health` returns `configuration` with
  `supabasePublic`, `supabaseServer`, `modelDelivery` and `offlineLeases`.

`/api/health` reports all four now — presence only, never a value — and
`scripts/deploy.mjs` refuses a deployment that is missing any of them, naming
the ones that are missing. Proven both ways: served without the server secret
it reports `supabaseServer: false`; served with every binding present it
reports all four `true`.

Presence is not correctness. A wrong lease key pair still fails
`loadOfflineLeaseSigningAuthority`'s own sign-and-verify probe at issue time,
which is the right place for it. The health answer is the question a release
gate can ask from outside.

## Phase 2 — no wait without an ending, no control without a truth

Every remaining indefinite wait was found and ended, and each one failed the
same way: a read that threw left the screen exactly as it was.

- Library and Admin showed "Nothing here yet" when the read had failed, so an
  unreachable library was indistinguishable from an empty one. Both use
  `Pending` now.
- Opening a conversation emptied the transcript on failure, which read as a
  conversation nobody had written in. `useChat` reports `messagesFailed` and
  the transcript offers Retry. The read is also guarded against a slower answer
  for a conversation the person has already navigated away from.
- `/auth/challenge` set an error the spinner branch never rendered, so it span
  forever, on a screen somebody reaches while trying to get in.
- `/reset-password` set `ready` only after its first `await`, so a throw there
  left "Checking your reset link…" permanently.

Stale copy for systems that no longer exist is gone: the "Account and recovery"
notification category no longer promises recovery codes, three OAuth failure
hints no longer send people to phone sign-in, and Account no longer falls back
to a phone number. Both are now asserted by tests.

`scripts/check-dead-controls.mjs` gained rule 5b, `unbounded-wait`: a file that
shows a waiting message must also contain an ending for it — an alert region,
`Pending`, a `failed` state, or a stated `bounded-state:` reason. Verified to
fire against the original defect's exact shape.

Still open for Phase 14: the deployed `ocade-intelligence` is version 6 and is
materially older than this tree — its `edge-handler.ts` caps a request at 1 MiB
where the repository caps it at 24 MiB, so attachments cannot work online until
it is redeployed. It must be deployed together with the matching frontend, not
before it, and the frontend deploy is blocked in this session.

## Checkpoint discipline

Implementation work uses one isolated completion branch from the latest `origin/main`. After each phase passes its gate, update this file with the exact completed state, create a descriptive checkpoint commit, push the branch, and verify the remote SHA. Never merge an incomplete phase to `main`.

The final release fast-forwards `main` without force only after the complete plan passes together on the reconciled tree. Record final Git SHA, deployed frontend, Edge version/source, migration state, Offline release, live-versus-simulated proof, cleanup measurements, and genuine owner-only blockers.
