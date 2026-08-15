# OCADE

OCADE is the active product being developed under the **CAERA CADANE** brand by
**Haans Antoni, Founder, Chairman & CEO**. It is a local-first AI workspace with
web, desktop and mobile source paths plus optional private synchronization and
cloud-assisted features.

Public launch is planned for **28 August 2026**. OCADE is still pre-launch: a
file, test, installer or deployment script in this repository is not by itself
proof that the corresponding production service or store release is available.

## What is in this repository

| Area               | Implemented source                                                                                        | Readiness boundary                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Web                | React/TanStack Start application, public demo, authenticated workspace and Cloudflare-oriented deployment | A build can pass while a hosted environment is misconfigured. Production URL, monitoring and launch approval remain separate gates.         |
| Offline web        | Service worker, offline page and browser-local storage/model paths                                        | The shell must first be visited and cached. Sign-in, sync, live web, payment and cloud model features still require a network.              |
| Cloud/private sync | Supabase auth, RLS-backed data paths, private storage and optional AI gateways                            | Users must be told which mode is active. “Local-first” does not mean all data always remains on-device.                                     |
| Desktop            | Tauri/Rust companion and native Windows/Python components                                                 | Windows/macOS signing, installer startup proof, notarization and production update flows are release gates, not implied by source presence. |
| Mobile             | Capacitor Android and iOS projects, mobile pairing and restricted control paths                           | Store signing, privacy declarations, billing compliance and device testing are still required.                                              |
| Entitlements       | Demo state, subscription/allowance logic, two desktop plus two mobile device limits                       | The repository does not yet prove a live payment checkout or store-billing integration.                                                     |

## Product behavior

OCADE can route work to supported on-device/browser engines, a native companion,
or an explicitly permitted cloud path. Features include document handling,
conversation and project storage, browser/native control components, voice and
vision modules, automations and cross-device controls. Availability depends on
the platform, installed model, hardware, privacy mode and configured services.

Safety controls in source include confirmation and refusal paths, emergency-stop
handling, account-scoped storage, signed native/bridge requests, attachment
limits, privacy-mode routing and honest “unverified” outcomes. These controls
must still be tested on the actual production target before a release claim.

## Privacy model

OCADE supports multiple storage and execution boundaries:

- **Device/browser-local:** supported data remains on the user’s device.
- **Private Sync:** selected account and workspace records are stored in the
  configured Supabase project under row-level security.
- **Cloud-assisted:** a disclosed provider may receive the minimum necessary
  prompt or request only when the user’s mode and entitlement permit it.

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
```

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

- Brand/venture: **CAERA CADANE**
- Active product: **OCADE**
- Founder: **Haans Antoni**
- Public roles: **Founder, Chairman & CEO**
- Location: **Bengaluru, Karnataka, India**
- Planned public launch date: **28 August 2026**
- FICIA, MADEE and CANIA: reserved names for possible future products; not AI
  models and not currently advertised as available

The website must not publish a CIN, GSTIN, registered office, trademark status,
launch completion or incorporated founding date until independently verified.
Search engines and third-party directories decide their own indexing and cannot
be guaranteed to display any specific result.

## Licence

The repository is proprietary. Copyright © 2026 Haans Antoni, operating under
the CAERA CADANE brand. See [LICENSE](LICENSE). Third-party packages, models and
assets remain under their own terms; notices are recorded in
[release/THIRD_PARTY_NOTICES.md](release/THIRD_PARTY_NOTICES.md).
