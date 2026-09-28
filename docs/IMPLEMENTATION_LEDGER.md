# OCADE Implementation Ledger

The durable checkpoint for the current implementation mission. Every session reads this after `AGENTS.md`, `PLAN.md` and `docs/MEMORY.md`, continues from **Next step**, and updates it before any handoff, compaction or stop.

## Identity

- Branch: `jarvis/authority-repair`
- Base: `main` at `a7e4634b5bba766b18d2cfebf139273596e36439`
- Host used for this run: Windows 11 (physical), Node 24, Python 3.12. No WSL, Docker, macOS, Android or iOS hardware on this host.

## Baseline (before any change)

- `npm test`: 89/90 files, 938 passed, 1 failed, 1 skipped. The failure was a test defect: the preservation manifest is checked out with CRLF on Windows and was split on `\n`. Fixed in the test (the snapshot and ZIP were never touched).
- `jarvis-runtime` Python tests on Windows: 8 failures that also fail on the untouched baseline. They are Linux-only assumptions (autostart path, `.desktop` apps, update `.exe` layout). Tracked below as W-1..W-3.

## Error Audit 01 status

Evidence labels: LOCAL TEST (this host), REAL WINDOWS, REAL BROWSER, SOURCE-PROVEN, BLOCKED, UNTESTED.

| ID         | Status              | Evidence                                                           | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | ------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 023        | Fixed               | LOCAL TEST (Windows)                                               | One cancellation token per action; the agent keeps exchanging while an action runs (`running`), OCADE answers `cancel`; tray/mini STOP sets the token synchronously; web STOP and task stop/Take Over cancel `claimed` rows; late results are stored only as a stop acknowledgement; UI shows Stopping… until the device confirms. Extension: detach + halt on STOP/cancel.                                                                       |
| 037        | Fixed (fail closed) | LOCAL TEST (Windows)                                               | Terminal is offered only where bubblewrap confines it (Linux). Windows/macOS report it unavailable and refuse `run`. Linux bubblewrap run: BLOCKED on this host.                                                                                                                                                                                                                                                                                  |
| 051        | Fixed               | LOCAL TEST (Windows, symlink test skips without symlink privilege) | `mkstemp` exclusive random temp in the resolved parent, fsync, re-check, atomic replace.                                                                                                                                                                                                                                                                                                                                                          |
| 053        | Fixed               | LOCAL TEST (proxy, address classes)                                | Isolated browser: all traffic through `ocade_egress.EgressProxy` which resolves once, refuses any non-public address, and connects only to checked addresses (rebinding-safe). Own-browser (CDP) tabs: per-request check + response address check. Extension: `Fetch` request guard + `remoteIPAddress` response check (cannot resolve DNS itself; a rebinding response is detected and discarded, not prevented). Real Chrome run: UNTESTED yet. |
| 038        | Fixed               | LOCAL TEST (fake GUI)                                              | Type/keys/scroll require the current observation; typing re-checks window and user input every 40 chars; STOP ends typing.                                                                                                                                                                                                                                                                                                                        |
| 039        | Fixed               | LOCAL TEST                                                         | Pending journal written via temp + `os.replace`; damaged journal kept as `pending.damaged`.                                                                                                                                                                                                                                                                                                                                                       |
| 054        | Fixed               | typecheck; unit test pending                                       | Dispatch re-runs `refuseAction` and confirmation rules at claim time; refused rows are cancelled with a reason; one action per device at a time.                                                                                                                                                                                                                                                                                                  |
| 055        | Mitigated           | SOURCE                                                             | Raw shell only inside bubblewrap; unconfirmed commands get no network, no home, no inherited env. Regex remains a UI hint only. Confirmation is bound to the immutable server-written row.                                                                                                                                                                                                                                                        |
| 015, 033   | Fixed               | LOCAL TEST (Windows)                                               | `fileURLToPath` instead of `URL.pathname`; built-in deterministic ZIP writer (same SHA-256 on rebuild).                                                                                                                                                                                                                                                                                                                                           |
| 036        | Fixed               | SOURCE                                                             | `detachAll()` on STOP, disconnect, revoke (401/403/410) and when no task is open.                                                                                                                                                                                                                                                                                                                                                                 |
| all others | Open                | —                                                                  | Work through in PLAN.md Phase 25 order.                                                                                                                                                                                                                                                                                                                                                                                                           |

## Windows follow-ups found this run

- W-1 `test_agent::test_autostart_and_uninstall_leave_nothing_behind` fails on Windows (baseline too).
- W-2 `test_computer` workspace/apps tests assume Linux Trash/XDG.
- W-3 `test_update` assumes a POSIX executable layout.

## Next step

1. Add vitest coverage for `exchange` dispatch revalidation and cancel reply (054, 023 server side).
2. Continue Major findings: session/conversation ownership (004, 006, 009, 011, 013, 014).
3. Real Chrome run of JARVIS web + extension guard.
