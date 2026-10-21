# Mobile capabilities: canonical location

This compatibility pointer preserves references in existing source comments, applied migrations and historical records. It contains no independent requirements. Read [Mobile capabilities](ARCHITECTURE.md) and [open work](../BLOCKED_TESTS.md) for current work order.

[Previous full document](https://github.com/BREVEX-CEO/caera-connect-plan/blob/f521e23529542d709a9627181341b0e904a8b0c3/docs/MOBILE_DEVICE_CONTROL.md) remains in Git for provenance. Do not revive superseded instructions from it.

## Outside phone harnesses — reviewed 21 October 2026

Read-only review of two public projects (web pages and GitHub API; nothing cloned, run, signed up for or billed):

- **[ShawnPana/phone-harness](https://github.com/ShawnPana/phone-harness)** — MIT. A Python CLI/agent skill: Android over adb (`screencap`, accessibility tree, `input`), iPhone through macOS iPhone Mirroring with Vision OCR and synthetic input, optional paid cloud phones (phone-harness.com, per-minute Android after an advertised free allowance). About 3.9k stars, releases 0.1.0 to 0.3.3rc1 (Aug–Oct 2026). Safety is prompt text only: no enforced permission scope, app allowlist or STOP; the agent runs any Python it writes; cloud mode sends screens to a server with no stated retention. **Learn from only** (the adb + accessibility-tree and mirroring + OCR routes); do not embed it, and never start its cloud phones without the owner's approval.
- **[PhoneHarness/PhoneHarness](https://github.com/PhoneHarness/PhoneHarness)** — no licence file (all rights reserved by default). A research benchmark for phone agents on an Android emulator (Pixel 6, API 33, Termux) that needs an OpenAI-compatible model endpoint; 12 commits, no releases. **Do not reuse code**; its idea of grading agents by real side effects matches OCADE's oracle approach.

Neither changes the plan above: OCADE's Android executor keeps its own scoped permissions, STOP and journal. An Android emulator could not be tried in this cloud session (no KVM); real-device and iOS runs stay BLOCKED.
