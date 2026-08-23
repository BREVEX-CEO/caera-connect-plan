# Proving OCADE on a real Windows PC

The Windows harness executed on 23 August 2026. The current tracked evidence is
`release/OCADE_WINDOWS_PROOF_EVIDENCE.json`: **10/10 stages passed** on Windows
10.0.19044 with Node 24.16.0, Chrome Stable 151 and Chrome for Testing 151.

## Earlier blocker and current status

Three routes were tried and all three are closed in the audit environment:

| Route                           | Result                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Actions `windows-latest` | No runner is ever assigned. Every job — Windows, macOS, and now Linux too — is marked failed 2–3 seconds after it is created, with no runner id and no steps. On 19 Aug the Linux jobs still ran for 4–10 minutes while Windows and macOS died instantly, so this is an account-level Actions billing or spending-limit block, not a workflow error. |
| A local Windows VM              | No `/dev/kvm`, no `vmx`/`svm` CPU flags, no qemu installed.                                                                                                                                                                                                                                                                                          |
| Downloading a Windows image     | `software-download.microsoft.com` and `dl.microsoft.com` are both blocked by the network policy.                                                                                                                                                                                                                                                     |

Those routes remain relevant to hosted CI, but no longer block local Windows
proof. Chrome Stable is installed and executed for managed-host Chrome/Edge
parity. Chrome for Testing is installed and executes the unpacked-extension E2E.
This split is required because official Chrome branded builds 137+ no longer
honour command-line unpacked-extension loading; Chrome for Testing and Chromium
remain the supported automation targets.

## Running it

On a Windows PC with the repository checked out, Node 22 and Python 3.12:

```
npm ci
npm run windows:prove
```

The runner **refuses to run on anything but Windows**. A proof that quietly
degrades on the wrong platform is worse than no proof, so on Linux or macOS it
exits non-zero and says why rather than reporting a partial pass.

It writes `release/OCADE_WINDOWS_PROOF_EVIDENCE.json` recording the Windows
build, Node version, both browser paths and versions, and every stage outcome.

## What it actually exercises

1. **The sidecar protocol** — startup, framing, reply correlation on every
   request, survival of a malformed line. (This part also runs on Linux, and
   does, in CI.)
2. **The full Python suite with the Windows paths executing** rather than
   skipping — window placement, per-platform voice, the two perception paths.
   These skip by name on Linux; here they run.
3. **Real PC control** — launches and focuses Notepad and verifies which window
   is genuinely in front, types and reads the text back _out of_ the window,
   moves the real pointer and checks where it landed, reads the accessibility
   tree, captures real pixels, runs the OCR engine built into Windows,
   exercises the STOP latch, and requires refusals for a six-digit code and for
   a field named Password.
4. **Cowork and installed browsers** — the extension E2E runs 69 scenarios in
   Chrome for Testing, including login hand-off, stale-checkpoint resume and a
   STOP latch surviving a service-worker recycle. The managed host separately
   drives installed Chrome Stable and Edge through CDP for protected-field,
   observed DOM mutation, upload, download, tabs, cancellation and stop parity.

If Chrome Stable or an extension-capable Chrome for Testing/Chromium is absent,
the corresponding stage is a **failure**, not a skip.

## Unblocking CI instead

If you would rather it ran automatically, the workflow is already committed at
`.github/workflows/windows-proof.yml` and passes `actionlint`. It needs runner
minutes: raise or clear the Actions spending limit under the account's
**Settings → Billing → Plans and usage**, then re-run the workflow. Windows
runners bill at 2× Linux, which is why they were the first to stop.

## What this page does not claim

This is proof on one Windows machine, not a signed clean-machine distribution
matrix. It does not prove macOS/Linux packaging, mobile devices, store review,
signed extension upgrade, or every licensed desktop application. Those remain
separate externally blocked release requirements.
