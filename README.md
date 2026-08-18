# OCADE

OCADE is the active product being developed under the **CAERA CADANE** brand. It is a local-first AI workspace with web, desktop and mobile source paths plus optional private synchronization.

OCADE is still pre-launch: a file, test, installer or deployment script in this repository is not by itself proof that the corresponding production service or store release is available. Public serving is controlled by an explicit readiness flag; there is no date/countdown timer that can launch an unready build or lock a ready one.

## What is in this repository

| Area | Implemented source | Readiness boundary |
| --- | --- | --- |
| Web | React/TanStack Start application, public demo, authenticated workspace and Cloudflare-oriented deployment | A build can pass while a hosted environment is misconfigured. Production URL, monitoring and launch approval remain separate gates. |
| Offline web | Service worker, cached shell and browser-local storage/model paths | The first delivery still needs a working connection. After the shell/model are successfully cached, offline reload and local inference are intended to work without network access. |
| Local AI | Desktop local runtime plus browser-local WebGPU/WASM paths | **AI inference is local-only.** If no local engine is available, OCADE refuses and offers local setup/retry actions. There is no Gemini, GPT/OpenAI, Lovable AI Gateway or other public cloud-model fallback. |
| Private Sync | Supabase auth, RLS-backed account/workspace data and optional synchronization | Supabase is a storage/auth boundary, not an AI inference provider. Users must be told which storage mode is active. |
| Desktop | Local Tauri/Rust companion, packaged browser host and packaged MediaPipe hand-control sidecar | Desktop source is retained for development, but public desktop downloads/releases are intentionally disabled for the current launch. Signing, clean-device tests, macOS notarization and update signing remain future release gates. |
| Mobile | Capacitor Android and iOS projects, mobile pairing and restricted control paths | Store signing, privacy declarations and device testing are still required before a store-release claim. |
| Billing | Historical subscription/allowance records and signed provider/webhook source remain intact | **Free launch mode is active.** Checkout, pricing, upgrades and paid entitlement gates are disabled. Historical billing data is retained for audit/history only. |

## Current launch mode

OCADE is currently configured as a **free launch** for every signed-in account. There is nothing to buy and no implemented feature is gated by a paid plan. Pricing, checkout, upgrade and billing surfaces are withdrawn, and the shared payment bootstrap refuses to initialize while free-launch mode is active.

Historical billing tables and signed webhook handling are not deleted because they may be needed for financial/audit history. A verified webhook returns success only after its database transition succeeds; persistence failures return an error so the payment provider can retry.

Public availability is controlled by `OCADE_LAUNCH_READY=true`. Historical date constants remain documentation only and do not participate in the runtime gate. Internal-host preview bypasses are disabled in production unless `OCADE_LAUNCH_PREVIEW=true` is explicitly configured.

## Product behavior

OCADE routes AI work only to supported on-device/browser engines or an approved local/paired device runtime. Features include document handling, conversation and project storage, browser/native control components, voice and vision modules, automations and cross-device controls. Availability depends on the platform, installed local model, hardware, privacy mode and configured non-AI services.

The browser engine starts on the smallest WebGPU tier, promotes at most one tier after measured acceptable performance, falls back to a verified WASM/CPU model when necessary, and stores managed model data in browser-local storage. Web Locks elect one same-origin model owner; follower tabs relay through BroadcastChannel instead of each loading another full copy.

Interrupted desktop local-model pulls retry automatically with bounded exponential backoff. Browser model downloads preserve partial bytes on transient HTTP/network failures and resume later. Published model digests are fail-closed: if a digest cannot be checked, OCADE refuses to execute those weights.

Capability labels are evidence-driven. A native shell does not by itself prove a Code terminal or automation worker is alive, a saved monitor does not prove anything is polling, and source code for an installer does not prove a signed download exists. Those capabilities stay `NOT_CONFIGURED` or `UNAVAILABLE` until their own runtime evidence exists.

Safety controls in source include confirmation and refusal paths, emergency-stop handling, account-scoped storage, signed native/bridge requests, attachment limits, privacy-mode routing and honest “unverified” outcomes. These controls must still be tested on the actual production target before a release claim.

The Windows companion source boots from bundled local files; it no longer depends on a developer server. Its optional camera preview and cursor control use a separately packaged MediaPipe process. Cursor control requires a visible two-step opt-in and can be stopped from the app, tray, or `Ctrl+Shift+F12`. Camera frames are processed locally and are not sent to the web application. This source statement is **not** a public installer-availability claim.

## Privacy model

OCADE separates AI execution from account/network services:

- **AI inference:** local-only. Prompts are never routed to Gemini, GPT/OpenAI, Lovable AI Gateway or another public cloud model.
- **Device/browser-local storage:** supported data stays on the user's device.
- **Private Sync:** selected account/workspace records may be stored in the configured Supabase project under row-level security.
- **Live network tools:** features such as explicitly requested web research may need network access, but that is a tool/network boundary, not a cloud-model fallback.

There is no advertising or third-party analytics tracker in the audited source. Essential local storage is used for authentication, preferences, security and offline operation. Future non-essential analytics must remain disabled until the required consent choice and documentation exist.

See the pre-launch, lawyer-review drafts:

- [Privacy notice](docs/legal/PRIVACY_NOTICE.md)
- [Terms of service](docs/legal/TERMS_OF_SERVICE.md)
- [DPDP progress](DPDP_PROGRESS.md)
- [Data-rights process](docs/legal/DATA_RIGHTS_PROCESS.md)
- [Breach runbook](BREACH_RUNBOOK.md)

## Development

```bash
npm ci
npm run typecheck
npm run test
npm run build
npm run deploy:check
# Internal Windows development only; no public desktop release is published.
npm run desktop:bundle:windows
```

`typecheck` and `build` regenerate the TanStack route tree first so a newly added file route cannot silently disappear from typed routing because a tracked generated file is stale.

Client authentication needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; server routes need their corresponding server-side bindings. Missing bindings leave public pages available but make authentication fail closed. Never commit service keys, access tokens or local `.env` files. Do not add public AI-provider API keys: OCADE has no supported server-side AI inference route.

## Release and public identity

The private repository is connected to Lovable. Do not rewrite published Git history. Work must remain on a reviewed branch until the owner explicitly approves a push or merge to `main`.

FICIA, MADEE and CANIA are reserved names for possible future products; they are not AI models and are not currently advertised as available.

The website must not publish unverified legal/company-registration claims. Search engines and third-party directories decide their own indexing and cannot be guaranteed to display any specific result.

## Licence

The repository is proprietary. See [LICENSE](LICENSE). Third-party packages, models and assets remain under their own terms; notices are recorded in [release/THIRD_PARTY_NOTICES.md](release/THIRD_PARTY_NOTICES.md).
