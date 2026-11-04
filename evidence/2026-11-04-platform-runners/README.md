# Cloud runner availability — 4 November 2026

Run 109 at `00cbd9e` passed seven jobs: planner/security/formatting, native Windows
receipts and UIA, disposable database safety, build/contracts/database/website
audit, Linux companion, Windows companion, and the unsigned installer check.
The Linux and Windows suites each ran 162 tests with only their allowed skips.

The eighth job (126690661832, `macos-latest`) was cancelled without acquiring a
runner. Its annotations report `The job was not acquired by Runner of type
hosted even after multiple attempts` and macOS ARM capacity constraints. This is
not a full green matrix and does not establish macOS proof for the current head.

The matrix now uses the platform labels specified by plan W6/W7: Linux,
`windows-2022`, `windows-2025`, `macos-15` (ARM64), and `macos-15-intel` (x64).
Both Mac architectures remain required, with fail-fast disabled. No test,
assertion, exact count or allowed-skip policy is relaxed. All labels are standard
hosted runners; no `large` or `xlarge` runner is requested. The repository is
public. No credential or deployment is added to validation.

The workflow must be registered on the implementation branch before GitHub can
execute the new matrix. Formatting has been checked with the repository's exact
Prettier version; new matrix execution remains unverified at registration.
Current product source is unchanged by this workflow-only repair.

Consumer Windows 10/11 and macOS permission/hardware checks remain blocked on A2.
Server or pre-authorised runner results never promote consumer requirements.
Readiness remains 20/100, conditions 19/42, requirements 79/266 and concepts 45/84.

References:
- [Run 109](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41859437960)
- [Official runner label and architecture list](https://github.com/actions/runner-images#available-images)
## 5 November follow-up (local date)

Run 123 at candidate c54ca8f completed all 166 Linux tests and reopened the
actual exported mesh with Khronos: 11,500 triangles, zero errors, warnings,
infos or hints. Windows 2022 also passed its complete 166-test suite.
Windows 2025 exposed D13's actual cause: stale parent PIDs pulled older system
services into the browser ownership graph. That repair is being qualified.

The Intel Mac runner was acquired, but its old Homebrew cask requested
LibreOffice 26.2.5 at an upstream URL that now returns HTTP 404. No Mac test ran.
The current official cask describes 26.8.2 with per-architecture SHA-256 hashes.
The runner now refreshes Homebrew metadata before installing its test engines.
Installation and the full Mac suite remain unverified until the new CI finishes.
This adds no customer dependency and does not skip any required case.