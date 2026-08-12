# OCADE evidence tiers

Every capability placed on one of five rungs. A percentage hides the difference
between "code exists" and "a machine proved it"; this does not.

Updated 2026-07-28. Branch `feat/ocade-implementation`, HEAD `52cd6cf4cc`.
Evidence: typecheck 0 · 3055 tests / 203 files · lint 0 errors · build ✓ ·
integration gate 181/181 · release gate 49/49 · asset budget 211/250 assets.

## The rungs

| Rung | Means |
|---|---|
| **1. Source complete** | Code exists and type-checks. No machine has exercised it. |
| **2. CI / simulation verified** | Executed automatically against a real runtime or a faithful simulation on every push. |
| **3. One human action away** | All code, automation and scripts done. A single named human step (install, credential, device, approval) yields proof. |
| **4. Real runtime verified** | Observed working against the genuine target. |
| **5. Production ready** | Runtime verified *and* signed, deployed, monitored. |

---

## Rung 4 — real runtime verified (locally, this machine)

| Capability | Evidence |
|---|---|
| Generated-code sandbox isolation | Real worker spawned as a child process; path traversal (`../`, `..\`, absolute, mid-path), `require`/`process`/`import()`/`fetch`, `eval`, `Function`, frozen-surface mutation **all attempted for real and refused**. Log truncation and sleep clamping observed. |
| Performance budget gate | Proven to FAIL: a planted 600 KB asset produced a non-zero exit naming the budget, then passing restored. |
| Integration honesty gate | Proven to FAIL on an unevidenced runtime claim, dropped orphan, unearned classification, thin reason, missing path. |
| Release source gate | Proven to FAIL on overstated status, shrunken/resolved blockers, missing evidence, version drift, planted secret. |
| Web production build | `vite build` exit 0, 211 assets, 3489.3/3906.3 KiB. |

## Rung 2 — CI verified (runs automatically on every push)

| Capability | Evidence |
|---|---|
| Typecheck, lint, unit tests, build | `.github/workflows/ci.yml` → `web` job, windows-latest. |
| All four enforcing gates | Same job: performance budget, integration honesty, release source, stage-2 baseline. |
| Production dependency audit | `audit` job, `npm audit --omit=dev`. |
| **Rust safety core — the 10 assertions** | `rust` job on windows-latest (has MSVC), runs `cargo test --all-targets`. **This is the only place they execute** — see Rung 3 note below. `cargo fmt --check` and `cargo clippy -D warnings` verified locally and pass. |

## Rung 3 — one human action away from proof

Each row: everything codeable is done; the named step is all that remains.

| Capability | The single human action |
|---|---|
| Rust safety assertions (local) | Install VS Build Tools "Desktop development with C++", run cargo from the **x64 Native Tools prompt** (GNU `link.exe` from Git Bash otherwise shadows MSVC's linker). CI already covers this without any human step. |
| Supabase schema + RLS | Apply the 32 migrations via Lovable. All 32 have paired, **self-checking** rollback + verification SQL that raises on any gap. |
| Windows companion binary | Same MSVC install, then `cargo build --release` / `tauri build`. |
| Managed browser release matrix | Windows real-target parity and packaged supervision are verified. Build and sign the macOS/Linux companion sidecars and installers on their native runners. |
| Android runtime | Android SDK/JDK + a device or emulator. Native/TS bridge parity already pinned. |
| iOS runtime | macOS + Xcode + device. Same parity coverage. |

## Rung 1 — source complete, not yet machine-exercised

| Capability | Why it stops here |
|---|---|
| Voice input/output | Needs a microphone, speaker and a real speech engine. Redaction logic itself is unit-tested and wired into every speech surface. |
| Local model routing / offline chat | Needs a local runtime and model weights. |
| Live research fetch | Needs network egress and provider keys. |
| Vision / 3D render / solver | Needs a GPU and licensed applications. |
| Payments, entitlements | Needs provider sandbox credentials. |
| Installer / updater runtime | Decision, rollback and integrity logic unit-tested; producing and running an installer needs the toolchain and a clean machine. |

## Rung 5 — production ready

**Nothing.** No signing certificate, no deployment, no monitoring, no store
listing. Claiming otherwise would be the exact overstatement the release gate
exists to prevent.

---

## What changed this session

Five defects found and fixed, each proven by restoring the flaw and watching the
test fail:

1. **Relay replay** — `EncryptedMobileTransport.subscribe` passed a hard-coded
   `lastSequence: 0`; a captured `emergency.stop` was accepted **3 times**.
2. **Missing speech redaction** — no speech surface redacted anything; a spoken
   OTP reached caption, draft, model prompt and read-aloud.
3. **Device revocation bypass** — registration unconditionally cleared
   `revoked_at`, so a revoked device un-revoked itself on reconnect.
4. **Income-tax overcharge** — non-decremented slab remainder charged the final
   partial band at full width: ₹20,00,000 taxed **₹7,50,000 instead of ₹3,00,000**.
5. **Undiagnosable sandbox errors** — cross-realm `Error` failed `instanceof`, so
   every generated-code failure reported a generic message.

Plus a verification that verified nothing: a migration labelled "empty" was
actually `REVOKE EXECUTE ON FUNCTION public.enforce_pack_ga_gate()`. Had the
revoke failed, the check would still have reported success.
