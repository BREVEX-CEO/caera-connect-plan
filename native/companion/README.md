# CAERA Native Companion (Tauri + Rust)

> **STATUS: SOURCE SCAFFOLD — NOT BUILT, NOT SIGNED, NOT RUNTIME-PROVEN.**
> Nothing in the web app treats computer control as available. Until a signed
> binary is produced and runtime-tested on the target OS, `UnavailableCompanion`
> remains the active adapter and every action throws. Do not mark any PC-control
> capability complete on the basis of this directory.

This companion is what makes OCADE's PC control, local-engine bridging and
PC Device Vault possible. The web app cannot control a computer; it talks to
this process over **secure local IPC** and the process enforces the safety rules
independently — it never trusts the caller.

## Why it exists

| Capability | Why the browser can't do it |
|---|---|
| Open approved apps / files, focus & arrange windows | No OS access from a web page |
| Read approved screen / active window | No screen capture without a native host |
| Local engine bridging over HTTPS pages | `http://localhost` is mixed-content blocked |
| PC Device Vault | Needs OS keychain / secure storage |
| OS-level emergency stop hotkey | Needs a global hotkey |

## Contract

The companion implements the TypeScript contract in
`src/lib/native/companion-bridge.ts`:

- `status()` → availability + version
- `execute(action, opts)` → runs one classified action
- `cancel(runId)` → cancels an in-flight run
- `emergency_stop()` → halts everything immediately

Actions and risk tiers mirror the TS side exactly (`read_only`, `low`,
`confirm`, `high`, `prohibited`).

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

## Build (must be done on the target OS, outside this repo's CI)

```bash
# Prerequisites: Rust stable, platform build tools, Tauri CLI
cd native/companion
cargo tauri build
```

Then **sign** the artifact with a real code-signing certificate and run the
runtime verification checklist before flipping any availability flag:

- [ ] Binary launches and reports `status().available == true`
- [ ] Protected-input refusal verified with a live attempt
- [ ] Allowlist enforced for both apps and file paths (incl. `..` traversal)
- [ ] Confirmation required for `confirm`/`high` actions
- [ ] `cancel()` stops an in-flight action
- [ ] `emergency_stop()` halts everything
- [ ] Audit records contain no protected data
- [ ] Signed installer verifies on a clean machine

Only after every box is ticked may the desktop build call
`setCompanionAdapter(...)` and expose PC control in the UI.
