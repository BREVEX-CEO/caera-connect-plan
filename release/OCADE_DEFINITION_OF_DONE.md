# Definition of done — item-by-item status

Every one of the **79** items in specification §19, each with its real status and
the evidence for it. No item is marked done without something that can be re-run.

Generated 2026-07-28. Branch `feat/ocade-implementation`, HEAD `52cd6cf4cc`.
Gates at time of writing: typecheck 0 · 3171 tests / 211 files · lint 0 ·
build ✓ · 0 dead controls / 171 files · licences current · integration 181/181 · release 49/49.

**Legend** — `MET` evidence exists and re-runs · `CI` will be proven by a CI job
that has not yet run · `BLOCKED` needs a device, credential, licence or toolchain
· `POLICY` forbidden by this session's own rules.

---

## 19.1 Repository — 8 MET, 1 CI, 2 POLICY (11 items)

| Item | Status | Evidence |
|---|---|---|
| Required code is committed | **POLICY** | The session directive forbids committing. §19 cannot be satisfied without it — flagged below. |
| Required branch is pushed | **POLICY** | Same. |
| **No unclassified untracked source remains** | **MET** | `npm run untracked:classify` classifies all **579** untracked paths (§4.3 categories) — 0 unknown, 0 secrets. 2 test files carrying SYNTHETIC credential-shaped fixtures (a documented vendor example key and an obviously-fake placeholder — the literals are deliberately NOT reproduced here, so this document does not itself trip a secret scanner) are surfaced separately as `test-fixture` rather than waved through. Exits non-zero if anything ever needs a human. |
| No secrets are committed | **MET** | Secret-shape scans across SQL, workflows, extension, demo fixtures and the blocker ledger. |
| Full tests pass | **MET** | 3096 / 206 files. |
| Typecheck passes | **MET** | `tsc --noEmit` 0 errors. |
| Lint passes | **MET** | eslint 0 errors. |
| Production builds pass | **MET** | `vite build` exit 0. |
| Native builds pass where required | **CI** | `cargo check`, `fmt`, `clippy -D warnings` pass locally; linking needs MSVC → `rust` CI job. |
| Release ledgers match actual evidence | **MET** | Integration + release gates both *proven to fail* on overstatement. |
| Checkpoint and handoff are current | **MET** | Updated this session with verified numbers. |

## 19.2 Local model — 2 MET, 6 BLOCKED (8 items)

| Item | Status | Evidence |
|---|---|---|
| **Hardware detection works** | **MET (runtime)** | `npm run hardware:detect` measures the real machine. Verified here: i5-1135G7 / 8 cores, 15.65 GiB total & 7.36 GiB free, 110 GiB disk, integrated graphics correctly classified as NOT discrete → recommends the ~3B tier. GPU presence reports `unknown` rather than guessing, and unknown is treated as ABSENT. |
| **Resource limits work** | **MET** | `governResources` refuses over-memory and over-disk jobs; the detected snapshot feeds `recommendProfile`, which excludes a GPU-only profile on this machine rather than selecting it. |
| Model setup · hash verification · offline chat · health and recovery · provider fallback · licence obligations | BLOCKED | Needs a local runtime and model weights. `use-local-engine` is proven never to claim "ready" before a probe. |

> **Correction.** This section previously read "0 MET, 8 BLOCKED". Measuring RAM,
> CPU, disk and GPU needs no model weights, GPU or credentials — only
> DOWNLOADING and RUNNING a model does. Two items were therefore wrongly marked
> blocked, which is an inaccurate readiness claim in its own right.

## 19.3 Desktop — 2 CI, 6 BLOCKED (8 items)

| Item | Status |
|---|---|
| Tauri application runs | BLOCKED — needs MSVC toolchain |
| Native companion runs | BLOCKED — same |
| IPC is authenticated | **CI** — Rust safety assertions run in the `rust` job |
| Permissions are scoped | **CI** — `unapproved_app_is_refused`, `parent_traversal_is_rejected` |
| Real actions work in the supported set | BLOCKED — needs a running companion |
| Results independently verified | BLOCKED |
| Cancellation and emergency stop work | BLOCKED at runtime; refusal paths unit-proven |
| Restart recovery works | BLOCKED |

## 19.4 Browser — 7 BLOCKED (7 items)

Chrome · Edge · authenticated pairing · DOM-first control · protected fields ·
real workflows · restart recovery.

**All BLOCKED**: no browser profile here. Protocol parity between
`background.js` and `extension-protocol.ts` is pinned (18 kinds, version 1), the
package is proven bounded (MV3, no wildcard origins, no `eval`, token never
persisted), and emergency-stop exemptions are asserted as a *complete set*.
**Human action**: load `extension/` unpacked in Chrome and Edge.

## 19.5 Mobile and relay — 1 MET, 1 one-command, 1 partial, 3 BLOCKED (6 items)

| Item | Status | Evidence |
|---|---|---|
| Android physical-device flow | BLOCKED | `android` CI job prepared, never run |
| iOS flow | BLOCKED | `ios` CI job prepared, never run |
| LAN mode | BLOCKED | needs two devices |
| Remote staging relay | **ONE COMMAND AWAY** | `relay/server.mjs` + `docker compose up --build`. The relay is spawned and driven over real HTTP by 14 tests: peer delivery with no echo to sender, ciphertext preserved byte for byte, non-envelopes and plaintext-bearing bodies refused, a third listener refused (409), honest `no_peer_connected`, and no replay to a late joiner. **Human step**: deploy the container to a reachable host. |
| Pairing/expiry/revocation/reconnect/idempotency/emergency stop | partial | revocation **MET** (durable across reconnect, 6 tests); others source-proven |
| **No duplicate mutation after reconnect** | **MET** | Replay watermark + serialised intake; proven by restoring the flaw — a captured `emergency.stop` was accepted 3× before the fix |

## 19.6 Identity and business — 1 MET, 7 BLOCKED (8 items)

| Item | Status | Evidence |
|---|---|---|
| Authentication works | **MET** (gate logic) | 24 tests: never calls `next()` without verified claims; identity taken from `claims.sub`, never the request |
| Trial rules · server-authoritative usage · signed entitlements · plan gating · test payments · cancellation/renewal/refund/expiry | BLOCKED | needs a live database and payment sandbox credentials |
| Cross-user isolation passes | BLOCKED | needs the database; RLS verification SQL is written and self-checking |

## 19.7 Security — 9 MET (9 items)

| Item | Status | Evidence |
|---|---|---|
| Protected inputs are blocked | **MET** | task-scope refuses OTP typing with `escalate:false`; content keystrokes never recorded |
| Prompt injection is contained | **MET** | identity-override, credential exfiltration, silent-action, zero-width |
| Replay is blocked | **MET** | receive-path watermark; concurrent duplicate rejected |
| Wrong scope is blocked | **MET** | capability, expiry, traversal, outside-folder |
| **Sandbox escape tests pass** | **MET (runtime)** | real worker spawned; traversal, `require`, `process`, `import()`, `fetch`, `eval`, `Function` all attempted and refused |
| Secret leakage tests pass | **MET** | sandbox redaction end-to-end; speech redaction across every surface |
| Revoked devices cannot mutate | **MET** | revocation survives reconnect |
| Expired sessions cannot mutate | **MET** | expiry refusal |
| Evidence cannot be silently forged | **MET** | artifact re-hash detects tampering |

## 19.8 Reliability — 1 MET, 7 BLOCKED (8 items)

| Item | Status | Evidence |
|---|---|---|
| **No-progress loops terminate** | **MET** | `skills/progress-monitor.ts`, wired into the work orchestrator loop. Catches all four runaway modes: nothing completes, the same state repeats (a cycle), the iteration ceiling, and the wall clock. Deterministic — a four-hour runaway is reproduced in milliseconds rather than waited for. 18 tests, including that a task which IS progressing is never halted, and that a halt is FINAL (ignoring it buys no further iterations). Partial work survives: it exits through the existing `blocked` checkpoint path. |
| Multi-hour task · checkpoint recovery · process restart · network reconnect · provider fallback · partial outputs · bounded memory | BLOCKED | Each needs a long-running real workload. Logic is unit-tested (recovery graph, evidence ledger, resource governor refusing over-budget jobs). |

## 19.9 Packaging — 1 MET, 7 BLOCKED (8 items)

| Item | Status | Evidence |
|---|---|---|
| **Licence notices are included** | **MET** | `release/THIRD_PARTY_NOTICES.md` — 374 production packages, 16 licence types, **0 undetermined**. Generated from the installed tree, never hand-maintained; `npm run licences:check` fails CI if stale. **2 flagged for review**: `lightningcss` (MPL-2.0) and `jszip` (MIT OR GPL-3.0-or-later). |
| Clean-machine install · upgrade · rollback · uninstall · crash reporting · repair · private beta | BLOCKED | Needs a toolchain, signing certificate and a clean machine. Decision logic is complete and tested (40 tests: update apply/skip/refuse, rollback target selection, staged-apply state machine, artifact integrity). |

> **Correction.** This section previously read "0 MET, 8 BLOCKED". Licence
> notices were never externally blocked — the data is in the dependency tree
> already on disk, and no installer or certificate is involved. An item wrongly
> marked blocked is an inaccurate readiness claim, which the specification
> treats as a defect in its own right, so it is corrected here rather than
> quietly amended.

## 19.10 Honest application coverage — 3 MET, 3 BLOCKED (6 items)

| Item | Status |
|---|---|
| Every advertised application has runtime evidence | **MET** — none is advertised as verified; the honesty gate fails on an unevidenced claim |
| Unsupported applications not advertised as verified | **MET** — same gate |
| Unknown applications labelled learning/unverified | **MET** — CANIA providers cannot claim `connected`; no provider does |
| Creative exports checked · CAD outputs checked · engineering from real solver only | BLOCKED | needs licensed applications and a GPU; `engineering-workflow` already separates `completed_verified` from `completed_controlled` and gates conclusions on a live installed app |

---

## Totals

**26 MET · 3 CI · 1 one-command · 1 partial · 46 BLOCKED · 2 POLICY** (79 items).

> **Correction — this document had three errors of its own.** It claimed 70
> items; the specification actually lists **79** (counted from its own bullets).
> The §19.1 header called an item BLOCKED that is CI, and the §19.7 header read
> "7 MET, 2 BLOCKED" while every one of its 9 items was already MET. An
> inaccurate readiness claim is a defect the specification names explicitly, and
> these were mine, so they are corrected here rather than quietly restated.

Every BLOCKED item names its prerequisite in
[OCADE_EVIDENCE_TIERS.md](./OCADE_EVIDENCE_TIERS.md). None is blocked on code
that could be written here.

## The conflict worth stating plainly

§19.1 requires committed and pushed code. This session is explicitly forbidden
to commit or push. **§19 therefore cannot be fully satisfied by any session
operating under these rules** — not because the work is missing, but because the
final step belongs to the owner.

Nothing above is marked done on the strength of source alone. The 46 blocked
items are blocked on a device, credential, licence or toolchain — not on
unwritten code.

---

# Appendix — triage of all 46 blocked items

Four items previously marked blocked turned out to be merely unautomated
(licence notices, hardware detection, untracked classification, no-progress
termination). That justified re-testing every remaining one against a single
question:

> Does this need a device, credential, licence or toolchain that does not exist
> here — or is it just work nobody has done?

**Result: 46 genuinely blocked, 0 further recoveries.** Each row names the
physical thing that is missing. None is waiting on code.

| # | Items | What is physically missing | Could any part be built here? |
|---|---|---|---|
| §19.2 (6) | model setup, hash verification, offline chat, health & recovery, provider fallback, model licence obligations | **Model weights and a local inference runtime.** | No. Hash verification logic already exists and is tested (`verifyStagedArtifact`); verifying a model needs the file. Model licence obligations need the chosen models, which cannot be selected without benchmarking them. |
| §19.3 (6) | Tauri runs, companion runs, real actions in supported apps, independent verification, cancellation/emergency stop at runtime, restart recovery | **MSVC C++ build tools**, absent — and GNU `link.exe` shadows the linker even once installed. | No. The crate type-checks, `fmt` and `clippy -D warnings` pass; only LINKING is impossible. CI covers it with zero human steps. |
| §19.4 (7) | Chrome, Edge, authenticated pairing, DOM control, protected fields, real workflows, restart recovery | **A running Chrome/Edge profile.** | No. The worker cannot be imported (needs `chrome` at import time) and does not export `validate`. Protocol parity and package bounds are already pinned from source. |
| §19.5 (3) | Android device flow, iOS flow, LAN mode | **An Android device/emulator, a Mac with Xcode, and two devices on one network.** | No. CI jobs are written for both; LAN needs two real endpoints. |
| §19.6 (7) | trial rules, server-authoritative usage, signed entitlements, plan gating, test payments, cancellation/renewal/refund/expiry, cross-user isolation | **A live Postgres with the migrations applied, and payment-sandbox credentials.** | No. The logic *is* the query and its row-level security; a mock would assert that the mock behaves like the mock. RLS verification SQL is written and self-checking, ready to run the moment the database exists. |
| §19.8 (7) | multi-hour task, checkpoint recovery, process restart, network reconnect, provider fallback, partial outputs, bounded memory | **A long-running real workload on real infrastructure.** | Partly already done — the *detection* logic was recovered as `progress-monitor`. What remains is observing real behaviour over hours, which cannot be simulated honestly. |
| §19.9 (7) | clean-machine install, upgrade, rollback, uninstall, crash reporting, repair, private beta | **A toolchain, a signing certificate and a clean machine.** | No. Update/rollback/integrity *decision* logic is complete and tested (40 tests). Producing and running an installer needs the machine. |
| §19.10 (3) | creative exports checked, CAD outputs checked, engineering from real solver | **Licensed creative/CAD applications and a GPU.** | No — and fabricating any of these outputs is explicitly forbidden. `engineering-workflow` already refuses to call a fixture run an engineering conclusion. |

## The pattern in the four that were recovered

Each had its *evidence-producing step* confused with its *subject*:

- licence notices — the data was in the dependency tree, not behind an installer;
- hardware detection — measuring a machine needs no model weights;
- untracked classification — classifying files needs no toolchain;
- no-progress termination — the detector is pure logic; only observing a real
  four-hour run is not.

The 46 above do not share that shape. Each names a physical prerequisite, and
for each, the code that *can* exist already does.
