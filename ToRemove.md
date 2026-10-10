# OCADE retirement manifest

This is a proof-gated retirement list, not another implementation plan or deployment runbook. [PLAN](PLAN.md) orders work; [Testing](docs/TESTING.md) owns release operations. Baseline: f521e23529542d709a9627181341b0e904a8b0c3. No product code was removed during the documentation mission.

## Required proof before every removal

Trace all callers and security roles → identify canonical replacement → record working behaviour and cost → prove replacement on normal/failure/STOP/restart/fidelity cases → remove → rerun targeted and broader evidence → independent adversarial/real-user checks. Record active LOC/modules/dependencies/package size and relevant latency before/after. No percentage quota. Revert a cleanup that loses valid functionality.

| Candidate                                                              | Replacement / owning PLAN package                           | Deletion gate                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Model-owned completed transition in src/jarvis/agent.ts                | P01 receipt-gated task settlement                           | All terminal paths require contract proof; false finish tests fail closed              |
| Preflight-only semantic cancellation/stale coordinate reuse            | P02 final-point checks and observation generations          | STOP race and real platform drift tests pass                                           |
| Rotation exchange that consumes commands; memory-only Android results  | P03 handshake and durable journal                           | Lost reply/crash/replay tests preserve every effect                                    |
| Office failure reported unchanged after mutation                       | P04 effect/recovery metadata                                | Real partial-save/readback failures represented truthfully                             |
| Coarse duplicate staff permission authority                            | P05 database predicate                                      | Direct Data API and route tests agree, concurrent owner transfer safe                  |
| Silent partial export/deletion success                                 | P06 durable reconciliation                                  | All classes counted; unknown counts never complete                                     |
| Network-first offline activation, destructive ciphertext error cleanup | P07 local-first verified manifest and quarantine            | Cold offline restart, corrupt bytes and cross-tab key tests                            |
| Repeated cloud round-trip for each deterministic segment step          | P08 local bounded segment                                   | Old-agent compatibility and full safety parity before retiring old path                |
| Independent polling/connection owners                                  | P09 shared authenticated events plus bounded recovery fetch | Loss/reconnect/order tests; never remove all fallback polling                          |
| Giant app-name/menu maps and reusable coordinates                      | P10 live capability discovery and sanitised recipes         | Unfamiliar app/version drift tests, safe refusal                                       |
| Duplicate browser/installer/privileged action authorities              | P11 existing signed companion/broker                        | Installed lifecycle, existing/managed browser parity; no cookie copying                |
| Post-install wake download paths and overlapping audio owners          | P11/P12 bundled signed wake and one session owner           | Signature, update, microphone/recovery and real wake proof                             |
| Duplicate Android setup/settings, dead controls, hidden errors         | P13/P15 guided flow and canonical settings                  | Every control mapped; denied permission and async failure handled                      |
| Always-mounted expensive Orb/graph and redundant UI trees              | P15 lazy shared responsive surfaces                         | Keyboard/mobile/reduced-motion and measured performance parity                         |
| Redundant task summaries/unbounded context                             | P16 durable compact checkpoint                              | Goal/permission survives compression and restart                                       |
| App-specific adapters                                                  | P17 generic broker only where it proves parity              | KEEP Office and other measured fidelity/safety advantages until equivalent replacement |
| Source-string tests/unused helpers/dependencies                        | P19/P22 stronger behaviour proof or confirmed no callers    | Never remove unique negative/security/platform evidence                                |
| Retired checkout controls or resurrected payment schema                | P20 authoritative new commerce implementation               | Approved provider and settlement proof; preserve required financial history            |

## Protected material

Keep immutable imports/source-original/ZIP, applied migrations, licences/notices, signing/update/wake verification, account isolation, task journals, backups, accessibility and unique historical findings. Developer MCP/test tools may remain useful even though customers never install them. Do not deep-index/upload all customer files for convenience. Sanitised recipes must not retain cookies, credentials, raw private screenshots or unrelated contents.

## Historical cleanup

Previous completed cleanup records (browser donor reduction, stale installer artefact, integrated owner console and test-helper retirement) remain in the [baseline version](https://github.com/BREVEX-CEO/caera-connect-plan/blob/f521e23529542d709a9627181341b0e904a8b0c3/ToRemove.md). Those records are dated claims, not fresh verification. In particular, old console migrations are immutable history and must be replayed in chronological order on a fresh database, never applied after the later consolidated authority out of order. Current release operations belong only to Testing.


## October 10 documentation disposition and cleanup gate

**KEEP** established minimum active authorities: PLAN, AGENTS, CLAUDE loader, PRD, Architecture, Design System, Security, Testing, Decisions, dated research, ToRemove and source audit checkpoints. They have different responsibilities and documented existing references; do not delete a file merely to reduce Markdown count or falsify cleanup statistics. **DELETE or merge later only with individually verified reference map, unique-clause relocation, caller/consumer parity, backup in Git and changed-file regression.** Preserve donor ZIP/source-original, existing signed manifests, applied migrations, critical recovery journals and audit evidence. Product code cleanup, Ponytail Ultra or dependency retirement remain future independently tested P22 implementation; documentation-only stage cannot perform them. No additional Markdown deletion is proven safe from the current uploaded handoff alone.


## Proof-gated source-specific retirement inventory — 10 October detailed plan

No code deletion is authorised by this documentation update. Every candidate requires preserved caller/integration parity, a verified replacement, actual performance evidence and reversible cleanup.


No product removal is authorised in this documentation stage.

| Source and mechanism | Disposition | Required parity/removal gate |
|---|---|---|
| `scripts/wake/__pycache__/make_data.cpython-312.pyc` — 11,020-byte generated cache | Remove after provenance/package check | Source training entrypoint and shipped model unchanged; restore exact Git blob if necessary |
| `JarvisBubble` and `JarvisWorkspace` query cadence/options | Merge options into existing account-owned state authority | Preserve workspace housekeeping and bubble `maintain:false`; measure navigation request counts |
| Bubble `ask` and workspace `send` duplicated turn lifecycle | Merge lifecycle through existing run owner | Account switch/late-finally/admission/settlement/handoff tests; retain different presentations |
| `useJarvisVoice` state-only async callbacks | Replace with generation-owned lifecycle | Late microphone/recogniser/TTS completion cannot revive old work |
| Voice analyser `sample` continuous/unowned RAF | Replace with one cancellable meter | No frames after End/hidden state; no extra capture |
| `stopEverywhere` fixed one-second ACK sleep loop | Merge waits with existing `actionChanged` | Lost events, pre-registration completion, offline device and missing ACK stay truthful |
| `Orb.tick` idle auto-rotation/RAF | Remove idle loop; retain requested graph | Zero hidden/idle frames; keyboard/list/zoom/pan/account parity |
| `graph.ts` 60-per-category display cap | Replace with 60-total visible cap | No semantic record deletion; complete list remains reachable |
| `DeviceCommand.cowork` GUI takeover exemption | Remove exemption; retain wire decoding | Physical input wins during paste/typing/API handoff; safe independent work still works |
| `BrowserPanel` frame polling | Keep until equivalent frame-change transport exists | It serves viewing, not planner observation; hidden panel makes no requests |
| Planner ownership heartbeat | Keep legacy purpose until lease migration passes | It is not presentation polling; never confuse 60 seconds with v2 admission lease |
| Public function validators plus shared task authority | Keep | They are validation/auth boundaries and delegated enforcement, not redundant engines |
| v1 protocol/signature bytes | Keep compatibility | Retire only after authenticated migration/support cutoff and cross-language proof |
| Immutable donor ZIP/snapshot | Keep provenance; exclude unsafe donor stack from shipping | Original hashes and built-package/SBOM checks |
| `clsx`, `tailwind-merge`, `lightningcss`, `nitro`, PGlite, fake-indexeddb, playwright-core | Keep established callers | No unused dependency is established by the targeted trace |

Do not claim savings until measuring request count, timers/listeners, retained objects, idle CPU and packaged bytes before/after.
