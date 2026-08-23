# OCADE

OCADE is the active product being developed under the **CARCC CADANE** brand by
**HAANS ANTONI — CEO, Chairman and Founder**. It is a browser-first, local-first AI
workspace with web, desktop and mobile source paths plus optional private
synchronization.

**Chat generation runs on the user's own device.** OCADE contains no code that
can send a prompt, draft, conversation, attachment or reasoning request to
OpenAI, Google Gemini, Anthropic, the Lovable AI Gateway or any other public AI
service — the gateway, the server chat route and the provider SDK were removed,
and `src/lib/__tests__/no-cloud-inference.test.ts` fails the build if any of
them returns. The internet is still used, for downloading OCADE's own engine,
for Supabase authentication and synchronisation, and for looking up current
information; fetching a fact is not the same as handing over the user's
thinking, and OCADE only does the first.

Public launch is planned for **28 August 2026**. OCADE is still pre-launch: a
file, test, installer or deployment script in this repository is not by itself
proof that the corresponding production service or store release is available.

## What is in this repository

| Area               | Implemented source                                                                                        | Readiness boundary                                                                                                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web                | React/TanStack Start application, public demo, authenticated workspace and Cloudflare-oriented deployment | A build can pass while a hosted environment is misconfigured. Production URL, monitoring and launch approval remain separate gates.                                                                                                  |
| Offline web        | Service worker, cached root shell and browser-local storage/model paths                                   | A real Chrome online-then-offline reload is proven from a clean profile. A first visit still needs a network: a browser cannot load a site it has never seen, and OCADE's engine has to arrive once before it can answer offline. |
| Private sync       | Supabase auth, RLS-backed data paths and private storage. Not an AI provider.                             | Users must be told which mode is active. “Local-first” means generation is always on-device; it does not mean synchronised data never leaves it. Browser Only data never leaves.                                                  |
| Desktop            | Local Tauri/Rust companion, packaged browser host and packaged MediaPipe hand-control sidecar             | Desktop source is retained for development, but public desktop downloads/releases are intentionally disabled for the current launch. Signing, clean-device tests, macOS notarization and update signing remain future release gates. |
| Mobile             | Capacitor Android and iOS projects, mobile pairing and restricted control paths                           | Store signing, privacy declarations, billing compliance and device testing are still required before a store-release claim.                                                                                                          |
| Billing            | Historical subscription/allowance records and provider/webhook source remain intact                       | **Free launch mode is active.** Checkout, pricing, upgrades and paid entitlement gates are disabled. A provider token alone cannot re-enable checkout.                                                                               |

## Current launch mode

OCADE is currently configured as a **free launch** for every signed-in account.
There is nothing to buy and no implemented feature is gated by a paid plan.
Pricing, checkout, upgrade and billing surfaces are hidden, and the shared
Paddle bootstrap refuses to initialize while free-launch mode is active. This
is intentionally enforced below the UI so an old URL, admin surface or stale
button cannot start a payment merely because provider configuration still
exists.

Billing tables, signed webhook handling and historical provider code are not
deleted. They are financial/audit history and future integration source, not a
claim that live checkout is available now.

## Product behavior

OCADE runs its engine in the browser: WebGPU where the browser exposes a usable
adapter, and a WebAssembly runtime where it does not. A local Ollama runtime or
a paired desktop is used when one happens to be present, but the web product
does not require Ollama, Python or a native companion. Preparation starts by
itself on first visit — there is no Install or Setup button — and the weights
are stored in the browser, verified against a checksum, and resumed rather than
re-fetched after an interruption. Features include document handling,
conversation and project storage, browser/native control components, voice and
vision modules, automations and cross-device controls. Availability depends on
the platform, installed model, hardware, privacy mode and configured services.

Capability labels are evidence-driven. A native shell does not by itself prove
a Code terminal or automation worker is alive, a saved monitor does not prove
anything is polling, and source code for an installer does not prove a signed
download exists. Those capabilities stay `NOT_CONFIGURED` or `UNAVAILABLE`
until their own runtime evidence exists.

Safety controls in source include confirmation and refusal paths, emergency-stop
handling, account-scoped storage, signed native/bridge requests, attachment
limits, privacy-mode routing and honest “unverified” outcomes. These controls
must still be tested on the actual production target before a release claim.

The Windows companion source boots from bundled local files; it no longer
depends on a developer server. Its optional camera preview and cursor control
use a separately packaged MediaPipe process. Cursor control requires a visible
two-step opt-in and can be stopped from the app, tray, or `Ctrl+Shift+F12`.
Camera frames are processed locally and are not sent to the web application.
This source statement is **not** a public installer-availability claim.

## Privacy model

OCADE supports multiple storage and execution boundaries:

- **Device/browser-local:** supported data remains on the user’s device.
- **Private Sync:** selected account and workspace records are stored in the
  configured Supabase project under row-level security.
- **Private Sync is local-first:** a message is written to this device before
  any network call and synchronised in the background, so Chat keeps working
  with the connection down and nothing is lost when it drops.
- **No cloud inference in any mode.** There is no disclosed provider and no
  entitlement that enables one, because there is no remote engine to enable.

There is no advertising or third-party analytics tracker in the audited source.
Essential local storage is used for authentication, preferences, security and
offline operation. Future non-essential analytics must remain disabled until
the required consent choice and documentation exist.

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

`typecheck` and `build` regenerate the TanStack route tree first so a newly
added file route cannot silently disappear from typed routing because a tracked
generated file is stale.

Client authentication needs `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY`; server routes need their corresponding
server-side bindings. Missing bindings leave public pages available but make
authentication fail closed. Never commit service keys, access tokens or local
`.env` files.

## Release and public identity

The private repository is connected to Lovable. Do not rewrite published Git
history. Work must remain on a reviewed branch until the owner explicitly
approves a push or merge to `main`.

Official pre-launch identity:

- Brand/venture: **CARCC CADANE**
- Active product: **OCADE**
- Founder: **Haans Antoni**
- Formal leadership statement: **HAANS ANTONI — CEO, Chairman and Founder**
- Location: **Bengaluru, Karnataka, India**
- Founding record: **28 August 2026** (planned until that date; this does not
  claim that an incorporated entity already exists)
- Planned public launch date: **28 August 2026**
- FICIA, MADEE and CANIA: reserved names for possible future products; not AI
  models and not currently advertised as available

The website must not publish a CIN, GSTIN, registered office, trademark status,
launch completion or incorporated founding date until independently verified.
Search engines and third-party directories decide their own indexing and cannot
be guaranteed to display any specific result.

## Licence

The repository is proprietary. Copyright © 2026 Haans Antoni, operating under
the CARCC CADANE brand. See [LICENSE](LICENSE). Third-party packages, models and
assets remain under their own terms; notices are recorded in
[release/THIRD_PARTY_NOTICES.md](release/THIRD_PARTY_NOTICES.md).

## Audit status

`docs/OCADE-AUDIT-REPORT.md` records what has been executed and what remains
external. Windows PC control, the Chrome for Testing extension, installed Chrome
Stable/Edge parity, and local production-model text/vision paths now have live
evidence. Production CI, signing/store distribution, live Supabase apply,
mobile devices, and clean-machine release matrices remain externally blocked.
See `docs/WINDOWS-PROOF.md` and the ledgers under `release/`.
