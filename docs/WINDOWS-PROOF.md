# Proving OCADE on a real Windows PC

Everything in this repository that needs Windows has a harness written for it.
None of those harnesses has executed, and the final report marks every
Windows-specific claim UNPROVEN because of it.

That is not caution. It is the literal state of the evidence, and this page
exists so it can stop being the state of the evidence.

## Why it has not run here

Three routes were tried and all three are closed in the audit environment:

| Route                           | Result                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Actions `windows-latest` | No runner is ever assigned. Every job — Windows, macOS, and now Linux too — is marked failed 2–3 seconds after it is created, with no runner id and no steps. On 19 Aug the Linux jobs still ran for 4–10 minutes while Windows and macOS died instantly, so this is an account-level Actions billing or spending-limit block, not a workflow error. |
| A local Windows VM              | No `/dev/kvm`, no `vmx`/`svm` CPU flags, no qemu installed.                                                                                                                                                                                                                                                                                          |
| Downloading a Windows image     | `software-download.microsoft.com` and `dl.microsoft.com` are both blocked by the network policy.                                                                                                                                                                                                                                                     |

Real Chrome Stable is unavailable for the same kind of reason: `dl.google.com`
is blocked, so only the bundled Chromium is present, and Chromium is not the
thing the requirement names.

## Running it

On a Windows PC with the repository checked out, Node 22 and Python 3.12:

```
npm ci
npm run windows:prove
```

The runner **refuses to run on anything but Windows**. A proof that quietly
degrades on the wrong platform is worse than no proof, so on Linux or macOS it
exits non-zero and says why rather than reporting a partial pass.

It writes `windows-proof-evidence.json` recording the Windows build, the Node
version, the Chrome path and version it found, and the outcome of every stage.

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
4. **Cowork against real Chrome Stable** — the extension E2E (45 scenarios,
   including the login hand-off, the stale-checkpoint resume and the STOP
   latch surviving a service-worker recycle) and Chrome/Edge CDP parity.

If Chrome Stable is not installed, the Cowork stages are recorded as
**failures**, not skipped. A missing browser must not look like a pass.

## Unblocking CI instead

If you would rather it ran automatically, the workflow is already committed at
`.github/workflows/windows-proof.yml` and passes `actionlint`. It needs runner
minutes: raise or clear the Actions spending limit under the account's
**Settings → Billing → Plans and usage**, then re-run the workflow. Windows
runners bill at 2× Linux, which is why they were the first to stop.

## What this page does not claim

That the harnesses pass. They have never run. Their protocol driver and their
refusal behaviour are executed on Linux and are covered by tests; the
Windows-specific API calls — real pointer, real typing, OCR, window focus — are
not, and nothing here should be read as saying otherwise until
`windows-proof-evidence.json` exists and says so.
