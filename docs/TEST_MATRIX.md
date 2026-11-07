# OCADE test matrix (version 1, 7 November 2026)

The permanent list of what is tested where (requirements 194, 195). Each row names the job or
test that covers it; `tests/security/test-matrix.test.ts` fails if a named file or job
disappears. "Qualification" rows need the real environment and are run only when the owner
directs (plan.md §19).

## Dimensions

| Dimension                                 | Values                                                                       | Where                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Operating system                          | Linux (CI), Windows Server 2022 and 2025, macOS 15 (Apple Silicon and Intel) | `companion-cross-platform` job matrix in `.github/workflows/jarvis-cloud-validation.yml`            |
| Consumer Windows 10 and 11, physical Macs | Qualification                                                                | `device-agent/windows/packaging/test_install.ps1`, `device-agent/windows/packaging/check_frozen.py` |
| CPU architecture                          | x64 (Windows, Linux, Intel Mac), arm64 (Apple Silicon)                       | `companion-cross-platform`; executable headers in `device-agent/windows/tests/test_jobs.py`         |
| Browser engine                            | Chromium (bundled actor browser), Chromium, Firefox and WebKit (website)     | `device-agent/windows/tests/test_web.py`, `tests/web/surface_audit.py`                              |
| Display scaling and monitors              | per-monitor DPI v2 code paths; real setups are qualification                 | `device-agent/windows/tests/test_windows_ui.py`                                                     |
| Permission level                          | standard grants, revoked grants, owner pause, elevated targets refused       | `tests/jarvis/db/authority.test.sql`, `tests/jarvis/db/held-claim-revocation.test.sql`              |
| Installation                              | fresh install, repair, uninstall keeping files, signed update and rollback   | `device-agent/windows/packaging/test_install.ps1`, `device-agent/windows/tests/test_agent.py`       |

## Kinds of test

| Kind                                   | Where                                                                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Unit and contract                      | `tests/jarvis/contracts.test.ts`, `tests/security/*.test.ts`                                                                       |
| Protocol                               | `npm run jarvis:protocol-check`                                                                                                    |
| Integration (real gateway and workers) | `device-agent/windows/tests/test_gateway.py`                                                                                       |
| Database and authority                 | `tests/jarvis/db/run.sh`                                                                                                           |
| Security                               | `tests/security/injection.test.ts`, `tests/jarvis/db/injection-privilege.test.sql`, `device-agent/windows/tests/test_injection.py` |
| Accessibility                          | `tests/web/surface_audit.py`                                                                                                       |
| Browser automation                     | `device-agent/windows/tests/test_web.py`, `device-agent/windows/tests/test_verify_web.py`                                          |
| Desktop UI                             | `device-agent/windows/tests/test_windows_ui.py`, `device-agent/windows/tests/test_mac_ui.py`                                       |
| Packaging and installer                | `device-agent/windows/packaging/check_frozen.py`, `device-agent/windows/packaging/test_install.ps1`                                |
| Performance and stability              | `tests/security/timing.test.ts`, `device-agent/windows/tests/stability.py`                                                         |
| Disaster recovery                      | `tests/jarvis/db/restore.sh`, `tests/jarvis/db/rollback-roundtrip.sh`                                                              |
| Fault injection                        | `device-agent/windows/tests/test_agent_recovery.py`, `tests/security/recovery.test.ts`                                             |
| Live evaluation (owner-directed)       | `tests/jarvis/live_eval.py`, `.github/workflows/jarvis-staging-evaluation.yml`                                                     |
