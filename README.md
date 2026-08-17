# OCADE

OCADE is the active product being developed under the **CAERA CADANE** brand. It is a **local-only AI workspace** with web, desktop and mobile source paths, computer-control components, browser-local inference, and optional account/private-sync services.

## Non-negotiable AI boundary

**OCADE does not route AI prompts to Gemini, GPT/OpenAI, Lovable AI, or any other public cloud model.** The active Chat path has no cloud-model fallback and no server-side AI-provider key. If no local engine is ready, OCADE says so and offers local setup/retry actions instead of silently transferring the request elsewhere.

This is an AI-inference boundary, not a claim that every feature is network-free. Authentication, optional Supabase Private Sync, live web research, remote-device communication, software/model downloads and other explicitly networked tools can still require a connection. Those paths are not allowed to become an AI-model fallback.

## Local model system

### Desktop

The fixed desktop engine is **Qwen2.5 3B**, Q4_K_M GGUF, served through the local runtime. Interrupted model pulls automatically retry up to five attempts with exponential backoff. The same pull is reissued so the runtime can reuse completed blobs and resume missing data rather than deliberately discarding progress.

### Browser

Browser inference stays on-device:

- **WebGPU default:** Qwen2.5 0.5B Instruct.
- **WebGPU promoted tier:** Qwen2.5 1.5B Instruct, offered only after this device has completed a real generation within the configured latency ceiling.
- **WASM compatibility fallback:** Qwen2.5 0.5B for browsers/devices that cannot use WebGPU.
- WebGPU model data is stored through **IndexedDB**.
- Browser engines run in workers rather than on the UI thread.

### Multiple tabs

Same-origin browser tabs coordinate through the **Web Locks API** and **BroadcastChannel**. One tab owns the browser model engine; follower tabs relay requests and token streams to that leader instead of loading another full model copy. If the browser cannot provide the required coordination primitives, OCADE refuses browser inference rather than weakening the single-engine invariant.

A real three-tab evidence runner is committed in `scripts/local-only-browser-evidence.mjs`. It sends one real message from each of three tabs and only writes PASS evidence if exactly one leader/model instance is observed. The same runner then disables the browser context's network, reloads, and sends another message to test the second-visit offline path. **Do not describe those runtime checks as passed unless the workflow has actually executed them successfully.**

## Offline behavior

The service worker aggressively retains the application shell and same-origin runtime/model assets after successful delivery. First-load cache fills use bounded retry; when connectivity returns after a partial/flaky first visit, the application asks the service worker to retry the incomplete shell cache.

There is one unavoidable website limitation and the UI states it explicitly: **the very first website visit needs enough working connectivity to receive the page and local model files.** No website can execute before its initial bytes have reached the browser. After the application shell and local model are successfully stored, subsequent visits are designed to work with the network disabled for local AI/chat behavior.

## Storage and privacy

Authenticated OCADE Chat now keeps chat message bodies in account-scoped browser-local storage and performs generation through the local Brain adapters. The old `/api/ocade/chat` cloud-generation route is retired and returns a fail-closed `410` response for stale clients.

Other product data has separate storage/network boundaries:

- **Browser/device local:** local chat bodies, browser model data, preferences and supported local artifacts.
- **PC/native paths:** local companion/runtime/device-control state where supported.
- **Private Sync:** selected non-AI account/workspace records may use the configured Supabase project under row-level security.
- **Live network tools:** web research or remote-device actions use the network only when the user invokes functionality that inherently requires it.

Local-only AI must not be weakened merely because a non-AI network service is configured.

## What is in this repository

| Area | Implemented source | Boundary |
| --- | --- | --- |
| Web | React/TanStack application, authenticated workspace, service worker | First delivery needs a network; later local behavior depends on a complete cache/model store. |
| Local AI | Desktop local runtime plus WebGPU/WASM browser engines | No public cloud-model fallback. Missing local engine is an explicit refusal. |
| Multi-tab browser AI | Web Locks leader + BroadcastChannel relay | One model owner; followers relay. Runtime proof must come from the real browser evidence run. |
| Private Sync | Supabase auth/RLS-backed account and selected workspace paths | Networked storage/auth, **not** an AI provider. |
| Desktop | Tauri/Rust/native companion and local control components | Public desktop releases remain separately gated by signing/device/release proof. |
| Mobile | Capacitor Android/iOS source, pairing/restricted control paths | Store/device/native-model proof remains separate. |
| Billing | Historical records/provider webhook source | Free-launch mode remains active; checkout/paywall behavior is separate from AI routing. |

## Control + Work

Chat and action execution remain separate. Control + Work can use local/native/browser/device-control components with explicit approval, STOP/pause/takeover boundaries and verification paths. A sentence typed into ordinary Chat is not permission to operate the computer.

## Capability truthfulness

A source file does not prove a production capability is alive. OCADE capability surfaces distinguish configured source from measured runtime availability. A saved monitor does not prove a runner is polling; a native shell does not prove a Code command host is connected; a browser-model test script does not prove three-tab/offline behavior until it actually executes.

## Verification

Local-only hardening includes:

- `scripts/check-local-only-ai.mjs` — rejects public cloud-AI keys/endpoints/model IDs from production source and requires the local-only controls.
- `src/lib/engine/__tests__/resolve-local-only.test.ts` — verifies local selection and fail-closed behavior.
- `src/lib/local/__tests__/model-lifecycle-retry.test.ts` — verifies automatic bounded model-download retry behavior.
- `scripts/local-only-browser-evidence.mjs` — real three-tab/single-model plus network-disabled second-visit evidence runner.
- `.github/workflows/ocade-local-only.yml` — source/unit/type/build gate followed by the real-browser evidence job.

At the time this branch was prepared, GitHub Actions was prevented from starting jobs by the repository account's Actions billing/spending state. Therefore the committed runtime evidence runner is **not** a substitute for an observed PASS.

## Development

```bash
npm ci
node scripts/check-local-only-ai.mjs
npm run typecheck
npm run test
npm run build
```

Authentication/private-sync development still needs the relevant Supabase deployment values. **There are no Gemini/OpenAI/Lovable chat API keys in the OCADE AI configuration.** Never commit service keys, access tokens or local `.env` files.

## Release status

OCADE remains pre-launch. Source, tests, installers and deployment workflows must not be described as production-proven until their required target evidence has actually executed successfully.

## Licence

The repository is proprietary. Third-party packages, local model weights and assets remain under their own licences; notices belong in `release/THIRD_PARTY_NOTICES.md`.
