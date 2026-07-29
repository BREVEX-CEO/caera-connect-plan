# Readiness composition — what each percentage is made of

The readiness line reports 16 numbers. Until now they were my estimates, stated
without their working. This decomposes every one into **what is done**, **what
remains and is buildable here**, and **what remains and is externally blocked** —
so the figure can be argued with instead of taken on trust.

Generated 2026-07-28 · branch `feat/ocade-implementation` · HEAD `52cd6cf4cc`.
Ground truth is [OCADE_DEFINITION_OF_DONE.md](./OCADE_DEFINITION_OF_DONE.md)
(79 items). These percentages summarise it; where they disagree, the item list
wins.

## How a figure is built

Each dimension is scored `evidence achieved ÷ evidence required`, where the
required evidence is: **source complete** (25%) · **unit/logic proven** (25%) ·
**integration proven** (20%) · **runtime proven on the real target** (30%).

That last 30% is why no platform dimension can pass ~70% here. It is not a
rounding choice — it is the share of proof that requires a device, browser,
toolchain or credential this environment does not have.

---

| Dimension | Now | Buildable remainder | Externally blocked remainder |
|---|---:|---|---|
| **Chat** | 93% | **None.** Composition, citation, redaction, persistence, cancellation all proven. | 7% — a live model connection (network + provider key). |
| **Code** | 97% | **None.** Workspace, repo map, references, patch flow and sandbox proven; sandbox isolation AND the workspace to host to observation to receipt chain are both RUNTIME-verified against a real temp repository and a real process exit. | 3% — driving a users own project on their machine. |
| **Work** | 95% | **None.** Orchestration, checkpoints, recovery, evidence ledger, and now the no-progress governor are all proven. | 5% — a genuine multi-hour workload. |
| **Research** | 85% | **None.** Ranking, corroboration, citation, freshness and refusal-to-infer are proven against fixtures. | 15% — network egress to fetch real sources. |
| **Web** | 92% src / 0% rt | **None.** Protocol parity, package bounds, origin pinning, emergency-stop exemptions pinned from source. | Runtime — a loaded Chrome/Edge profile. |
| **PC** | 70% src / 0% rt | **None.** Rust safety core type-checks, `fmt` and `clippy -D warnings` pass; CI executes the 10 assertions. | Runtime — MSVC linker; then a signed companion on real Windows. |
| **Mobile** | 93% src / 0% rt | **None.** Android/iOS bridge parity, fail-closed refusals, shell agreement all pinned. | Runtime — a device or emulator, and a Mac for iOS. |
| **Cross-device** | 91% src / 15% rt | **None.** Relay is written and runtime-tested locally; replay, revocation and reconnect proven. | Deploying the relay to a reachable host; two real devices. |
| **Universal-control** | 94% | **None.** Route selection, scope, rehearsal, receipts, adapters proven; free-tool detection runtime-verified. | 6% — driving a real application. |
| **Voice** | 90% src / 0% rt | **None.** Redaction wired into every speech surface; wake, caption, language logic proven. | Runtime — a microphone and speech engine. |
| **Vision/3D** | 87% src / 0% rt | **None.** Validation, glTF checks, and free-tool gating proven. | Runtime — Blender/FreeCAD installed (free downloads), plus a GPU for render. |
| **Security** | 99% | **None.** 9 of 9 §19.7 items MET, sandbox escape runtime-verified. | 1% — adversarial testing against live infrastructure. |
| **Testing** | 99% | **None.** Every pure module covered; all three gates proven to fail on bad input. | 1% — coverage of paths that only exist at runtime. |
| **Packaging** | 84% | **None.** Update decision, rollback, integrity, and now real Ed25519 signature verification with self-signed tests. Licence notices generated. | 16% — a certificate, a clean machine, and store submission. |
| **Source** | ~99% | **None identified** after five recovery passes. | — |
| **Production** | ~56% | **None.** | Every remaining point requires a device, credential, licence, toolchain or deployment. |

---

## The honest headline

**Every "buildable remainder" cell reads None.**

That is a claim I have tested rather than assumed. Five items I had wrongly
marked blocked were recovered by re-asking one question of each — licence
notices, hardware detection, untracked classification, no-progress termination,
and free-tool adapters. Two more gaps were found the same way and closed
(signature verification that only checked presence; a Stop button that did
nothing).

The remaining 46 blocked items were then triaged individually. Each names a
physical prerequisite. None is waiting on code.

## Why the numbers cannot reach 100% here

**Production readiness is capped at roughly 56% in this environment**, because
~44% of the required evidence is runtime proof on hardware that is not present.
No amount of further coding moves it. Writing more source to raise a number
without raising the underlying truth is precisely what §2.1 forbids.

## What each point costs, in your actions

| Your action | Moves |
|---|---|
| Push the branch (CI runs) | PC 70→75 · Testing 99→100 · executes the 10 Rust safety assertions |
| Apply Supabase migrations via Lovable | Chat, Work, Security, Production — unlocks all 7 identity items and cross-user isolation |
| Install VS Build Tools | PC to real runtime; companion binary becomes buildable |
| `docker compose up` + a reachable host | Cross-device 15→60% runtime |
| Install Blender/FreeCAD (free) | Vision/3D from fixture class to real render evidence |
| A signing certificate | Packaging 84→95 |
| An Android device | Mobile to real runtime |

The single highest-value action is applying the migrations: it is free, it
unblocks the largest cluster of items, and every migration already has a paired,
self-checking rollback and verification script.

---

## Evidence for "buildable remainder: None"

That claim is a measurement, not an opinion. Re-run any of these:

| Check | Command | Result |
|---|---|---|
| Pure modules with no test | `classify.mjs` (scratch) | **0** of 18 remaining untested are pure; all 18 need Supabase, a DOM or a browser lib |
| Dead or unexplained controls | `npm run controls:check` | **0** across 171 component and route files |
| Unclassified untracked paths | `npm run untracked:classify` | **0** unknown, **0** secrets, across 579 paths |
| Undeclared orphan modules | `npm run integration:source-check` | 181/181 — 6 non-runtime modules and 6 runtime boundaries all **declared with reasons** |
| Licence notices stale | `npm run licences:check` | current, 374 packages, 0 undetermined |
| Gates that cannot fail | `*-gate-enforces` suites | all three proven to **reject** bad input |

If a future session finds a buildable item this missed, the method that found
the previous five is in the appendix of the definition-of-done: ask whether the
**evidence-producing step** has been confused with its **subject**.
