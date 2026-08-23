# OCADE Native Companion (Tauri + Rust)

> **STATUS: SOURCE-COMPLETE, RUNTIME-BLOCKED — NOT BUILT, NOT SIGNED, NOT RUNTIME-PROVEN.**
> Nothing in the web app treats computer control as available. Until a signed
> binary is produced and runtime-tested on the target OS, `UnavailableCompanion`
> remains the active adapter and every action throws. Do not mark any PC-control
> capability complete on the basis of this directory.

This companion is what makes OCADE's PC control, local-engine bridging and
PC Device Vault possible. The web app cannot control a computer; it talks to
this process over **secure local IPC** and the process enforces the safety rules
independently — it never trusts the caller.

## Why it exists

| Capability                                          | Why the browser can't do it                 |
| --------------------------------------------------- | ------------------------------------------- |
| Open approved apps / files, focus & arrange windows | No OS access from a web page                |
| Read approved screen / active window                | No screen capture without a native host     |
| Local engine bridging over HTTPS pages              | `http://localhost` is mixed-content blocked |
| PC Device Vault                                     | Needs OS keychain / secure storage          |
| OS-level emergency stop hotkey                      | Needs a global hotkey                       |

## Contract

The companion implements the TypeScript contract in
`src/lib/native/companion-bridge.ts`. The client that speaks it is
`src/lib/native/tauri-companion.ts`:

- `open_session()` → **host-minted** `{ sessionId, key }` (see below)
- `status()` → availability + version + `halted` + the exact capabilities
  discovered on the running operating system. An ordinary web build still uses
  `UnavailableCompanion`; only the built native process can report capabilities.
- `execute(request, action, confirmed)` → runs one classified action
- `cancel(request, runId)` → cancels an in-flight run
- `emergency_stop()` → halts everything immediately, even when the signed
  session is unhealthy

Actions and risk tiers mirror the TS side exactly (`read_only`, `low`,
`confirm`, `high`, `prohibited`).

### Session keys are minted by the host, never by the page

The web page is untrusted, so it must **not** choose its own key material — a
compromised page could otherwise forge a valid MAC for a session of its
choosing. `open_session` generates a 32-byte key and a 16-byte id from the OS
CSPRNG (`getrandom`), registers them with `IpcGuard`, and returns them once over
local IPC. The key is never persisted, logged, or written to the audit trail.

Every subsequent command that can enable, widen or mutate control carries a
signed envelope (`counter` + single-use `nonce` + `mac`) that the host verifies
before anything touches the machine. `cancel` is signed. Emergency stop is the
deliberate exception: halting is always reachable; clearing the stop is signed.

Reply structs are `#[serde(rename_all = "camelCase")]` so field names match the
TypeScript client exactly (`runId`, `sessionId`). Renaming a field on one side
without the other silently breaks the contract.

## Safety rules enforced in Rust (not just in the UI)

The host re-validates everything, so a compromised or buggy caller cannot widen
its own permissions:

1. **Protected input is refused outright.** Any `text.type` whose content looks
   like a password, OTP, CAPTCHA answer, card/CVV, IBAN, SSN, recovery code,
   seed phrase, or any 4+ digit run is rejected — even if the caller claims the
   user confirmed it. OCADE pauses and the user types it personally.
2. **Confirmation is mandatory** for `confirm`/`high` tiers; the host rejects
   unconfirmed requests.
3. **Allowlists.** Only applications and directories the user has explicitly
   approved can be opened. Paths are canonicalised before checking to defeat
   `..` traversal.
4. **Redaction.** Nothing matching the protected patterns is written to logs,
   audit records, or replay artifacts.
5. **Emergency stop** is always available and cannot be disabled by a caller.
6. **Signed arguments are rebound host-side.** A valid envelope cannot be
   paired with different sibling IPC arguments.
7. **HMAC-SHA-256** authenticates privileged requests. The dependency-free Rust
   and TypeScript implementations share pinned standard vectors.

## What is in this directory

| Path                              | Purpose                                                                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `safety/`                         | Dependency-free security core (guard, allowlist, redaction, IPC). Auditable and testable without the Tauri toolchain.                               |
| `tauri/src/main.rs`               | Host commands, durable allowlist/journal, cancellation, recovery, tray, global hotkeys, audit.                                                      |
| `tauri/src/platform.rs`           | Bounded Windows/macOS/Linux backends for screens, windows, apps, approved files and synthetic paste/copy.                                           |
| `tauri/capabilities/default.json` | Tauri v2 permissions. Narrow by design — no filesystem, shell, HTTP or process access; every OS action goes through the app's own audited commands. |
| `tauri/entitlements.plist`        | macOS hardened-runtime entitlements. No network, no camera/mic, no JIT.                                                                             |
| `tauri/icons/`                    | Generated application and tray icons (original artwork).                                                                                            |
| `ui/`                             | The overlay window (`frontendDist`). Dependency-free HTML/JS; shows real host state and an always-reachable stop.                                   |
| `../python-host/ocade_host/gesture/` | Local MediaPipe hand landmarks, One Euro smoothing and bounded mouse gestures. The packaged sidecar has no network listener.                    |

### Global hotkeys

| Shortcut                   | Action                                                                  |
| -------------------------- | ----------------------------------------------------------------------- |
| `Ctrl/Cmd + Shift + F12`   | Emergency stop — works with no focus, which is the point of a panic key |
| `Ctrl/Cmd + Shift + Space` | Show/hide the overlay                                                   |

## Build

```bash
# Windows: creates both local sidecars, then an unsigned NSIS test installer.
npm run desktop:bundle:windows
```

The build script creates an isolated Python environment when needed, installs
the pinned gesture dependencies, downloads the SHA-pinned hand model, packages
Python and the model into the sidecar, runs its self-test, and only then lets
Tauri build. End users do not install Python or Docker for gesture control.

The installed companion is deliberately local and does not load
`localhost:3000` or the public website. It is a safe native-control companion,
not a bundled copy of the full OCADE chat site.

> **macOS bundling needs one extra step.** `tauri.macos.conf.json` currently
> emits the signed `.app` but omits `dmg`, because a `.icns` cannot be produced
> in this environment. Before
> building on macOS, run `cargo tauri icon icons/icon.png` (it generates
> `icon.icns` plus the full set), then add `"dmg"` back to `bundle.targets` and
> `"icons/icon.icns"` to `bundle.icon`. Do not add them earlier — a config that
> points at a missing file fails the build with a misleading error.

Platform overlays keep incompatible bundle formats out of each build:
`tauri.windows.conf.json` selects MSI/NSIS, `tauri.linux.conf.json` selects
AppImage, and `tauri.macos.conf.json` selects the app bundle until DMG assets
exist. Then **sign** the artifact with a real code-signing certificate and run the
runtime verification checklist before flipping any availability flag:

- [ ] `cargo test -p caera-companion-safety` passes (needs a working linker)
- [ ] **MAC agreement gate — now automated on both sides.**
      `mac_matches_typescript_golden_vectors` in `safety/src/ipc.rs` and
      "MAC parity with the Rust host" in
      `src/lib/__tests__/companion-client.test.ts` assert the SAME golden table
      (empty body, all-zero key, all-ff key, ascending key, a full canonical
      envelope, and multi-byte UTF-8). Drift on either side turns one suite red.

      The TypeScript half runs today and passes. The Rust half **type-checks**
          (`cargo check --all-targets`) but has never been EXECUTED here, because
          the MSVC linker is unavailable. Running `cargo test` on a machine with a
          linker is the step that converts this from "compiles" to "verified" — do
          not treat the gate as satisfied until it has actually run.

          Never regenerate the vectors to make a failure pass: a change there is a
          wire-format break that both sides must adopt deliberately.

- [ ] Binary launches and reports `status().available == true`
- [ ] `open_session` returns a 32-byte key; the page never supplies one
- [ ] A replayed envelope (same counter/nonce) is rejected
- [ ] Protected-input refusal verified with a live attempt
- [ ] Allowlist enforced for both apps and file paths (incl. `..` traversal)
- [ ] Confirmation required for `confirm`/`high` actions
- [ ] `cancel()` stops an in-flight action
- [ ] `emergency_stop()` halts everything
- [ ] Emergency-stop hotkey fires while another application has focus
- [ ] Overlay toggle hotkey shows _and_ hides the window
- [ ] Tray "Emergency stop" halts the same way the hotkey does
- [ ] Overlay reflects `action-started` / `action-finished` / `emergency-stop`
- [ ] A latched stop blocks new actions until explicitly reset
- [ ] Audit records contain no protected data
- [ ] Signed installer verifies on a clean machine

The source keeps one cancellation token per live run and kills bounded child
processes on cancel, timeout, tray stop, hotkey stop, or IPC emergency stop. A
crash-recovered `Started` journal record becomes an explicit terminal failure
and is never replayed, avoiding duplicate unknown side effects.

Only after every box is ticked may the desktop build call
`setCompanionAdapter(...)` and expose PC control in the UI.

## Install, update and rollback

### Installers

`cargo tauri build` produces `msi` + `nsis` (Windows) and `appimage` (Linux).
`dmg` is added on macOS once `.icns` exists — see the note above. Every artifact
must be signed before distribution: `bundle.windows.certificateThumbprint` and
`bundle.macOS.signingIdentity` are both `null` here on purpose, because no
signing certificate exists in this repository and a placeholder would produce an
artifact that _looks_ signed and is not.

### Updates — disabled until a real key exists

`plugins.updater.active` is **`false`**, and this is deliberate.

The updater host plugin is wired: `tauri-plugin-updater` is a dependency and is
registered in `main.rs`. The overlay is deliberately **not** granted
`updater:default` while the updater is inactive, so untrusted webview code
cannot call an unfinished release channel. There is no signing keypair:
`pubkey` is still the literal placeholder
`REPLACE_WITH_SIGNING_PUBLIC_KEY`. Shipping with `active: true` and a
placeholder key means every update check fails signature verification at
runtime, which looks like a broken product rather than an unconfigured one.

To enable, at release time:

```bash
# 1. Generate the keypair. The PRIVATE key never enters this repository.
cargo tauri signer generate -w ~/.tauri/caera-companion.key

# 2. Put the PUBLIC key in tauri.conf.json -> plugins.updater.pubkey
# 3. Set plugins.updater.active to true
# 4. Set bundle.createUpdaterArtifacts to true
# 5. Add `updater:default` only when the signed updater is enabled
# 6. On macOS, allow outbound network client access in entitlements.plist
# 7. Sign the build (private key supplied via environment, never committed):
#    TAURI_SIGNING_PRIVATE_KEY=... cargo tauri build
```

An update is only applied when its signature verifies against `pubkey`, so a
compromised update endpoint cannot push a payload on its own.

### Rollback

Updates are versioned and the installer is non-destructive, so rollback is
"install the previous signed artifact":

1. Publish the previous version's bundle at the update endpoint (the updater
   compares versions, so serving an older version to a client that already has a
   newer one will **not** downgrade it automatically).
2. For a forced downgrade, uninstall and install the previous signed installer.
   User data is unaffected: the companion stores no conversation data, and the
   session key is per-window and never persisted.
3. If a bad build shipped, revoking the endpoint is enough to stop propagation —
   clients that never fetched it are unaffected, and clients that did can be
   downgraded by (2).

Because the companion holds no durable user data, there is no update migration
to reverse — which is why rollback is this simple, and why it should stay that
way.
