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

## Active mission phase

Phase 0 is the documentation/current-truth rewrite. This phase is complete only when every root/docs Markdown authority in the repository has been rewritten to the same current decisions and committed together without changing product code.

After Phase 0, Phase 1 immediately reproduces and fixes the real usage-allowance/Chat Send failure, verifies the exact live Supabase RPC contract, deploys the matching current Edge Function, and proves one real production Chat answer with exactly one use and durable persistence.

## Checkpoint discipline

Implementation work uses one isolated completion branch from the latest `origin/main`. After each phase passes its gate, update this file with the exact completed state, create a descriptive checkpoint commit, push the branch, and verify the remote SHA. Never merge an incomplete phase to `main`.

The final release fast-forwards `main` without force only after the complete plan passes together on the reconciled tree. Record final Git SHA, deployed frontend, Edge version/source, migration state, Offline release, live-versus-simulated proof, cleanup measurements, and genuine owner-only blockers.
