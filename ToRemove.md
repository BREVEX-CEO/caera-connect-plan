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
