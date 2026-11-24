# OCADE completion checklist (persistent, resumable)

Started 23 November 2026 from branch `ocade/p00-p22-implementation` at `01ef8ce`. Every row is
checked against code and tests at the stated commit, never against an earlier completion claim.
Update a row in the same commit as the work it describes.

**States:** DONE (code + reachable caller + automated test, local gate green) · VERIFIED (DONE and
the hosted CI jobs passed on the same SHA) · PARTIAL (some of the contract is coded; the gap is
named) · MISSING · BROKEN · BLOCKED (needs something this repository cannot provide; the blocker
is named). DONE is not RUNTIME VERIFIED in the plan's sense: no row here claims qualification on
real hardware, real models or staging.

## 1. Requirement families

| Family (plan part)                           | State                                                                        | Evidence (code · test)                                                                                                                                                                 | Gap / blocker                                                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 266-ID ledger (Appendix A/E)                 | DONE for CODE rows                                                           | Appendix E: 140 CODE rows BUILDS, 20 STANDING, 5 QUALIFICATION-ONLY with harness BUILDS                                                                                                | Runtime PASS needs Stage 6 qualification (BLOCKED, §4)                                                                                         |
| 84 architecture concepts (Part 6, App. B)    | PARTIAL                                                                      | `npm run jarvis:traceability`: 44 PASS, 39 PARTIAL, 1 FAIL                                                                                                                             | PARTIAL rows mostly need real-device or real-model evidence                                                                                    |
| Launch readiness gates                       | PARTIAL                                                                      | `npm run readiness`: 1/10 milestones, 17/42 conditions PASS                                                                                                                            | Milestones 3–10 need hardware, signing, staging, models                                                                                        |
| 72-entry integration ledger (14A)            | PARTIAL (code present per 21 Nov batches; not re-audited this session)       | plan Appendix E batch notes; `tests/security/*`, `device-agent/windows/tests/*`                                                                                                        | Qualification BLOCKED (§4)                                                                                                                     |
| 14B website, BYOK, offline, settings         | PARTIAL (code and tests present; gates green)                                | `byok-*.test.ts`, `offline-*.test.ts`, `verify:full`                                                                                                                                   | Real-browser/GPU offline qualification BLOCKED                                                                                                 |
| 14B.4 34 UX principles                       | PARTIAL                                                                      | `tests/web/accessibility_audit.py` (axe WCAG 2.2 AA, reflow, focus), surface audit in CI                                                                                               | Per-route, per-principle evidence ledger not complete; signed-in audit needs a local Supabase stack                                            |
| 14C/14D/14E/14F                              | DONE in code for listed items; PARTIAL overall                               | plan Appendix E batches of 17–22 Nov                                                                                                                                                   | Native continuous capture qualified only on hosted runners; solo-vs-team benchmark BLOCKED                                                     |
| R12-01..R12-12 (Part 27.2)                   | PARTIAL (code and tests present; contract-by-contract re-audit not finished) | migrations `20261121140000`…`20261122212000`; `smart-approvals`, `generated-form`, `purpose-binding`, `timeline` tests                                                                 | R12-12 phone/desktop handoff: revisioned redirects only; R12-07 discovery presentation basic                                                   |
| Four packages / eight products (27.3)        | PARTIAL                                                                      | `src/lib/jarvis/packages.ts` (narrowing rules), `BusinessWorkspace`, `packages.test.ts`                                                                                                | Read-only skills over JARVIS-folder files; no connector-backed data (no bookkeeping/ATS/bank connector exists — BLOCKED on owner integrations) |
| T12-01 LifeOS                                | DONE                                                                         | `LifeOS.tsx`, `lifeos.functions.ts`, migration `20261122213000`; `lifeos.test.ts`                                                                                                      | Manual entry only; connected-source ingestion needs connectors                                                                                 |
| T12-02 Outcome Autopilot                     | DONE (this session)                                                          | schedules with stop conditions: migration `20261123090000` (end date, run count, enforced in claim/finish), `Schedules.tsx` Stop control; `schedules.test.sql` Outcome Autopilot block | Quiet hours and per-goal spend ceiling not separate (spend uses per-person budgets)                                                            |
| T12-03 Problem Radar                         | DONE (this session)                                                          | `problem-radar.ts` deterministic rules, `ProblemRadar.tsx` in LifeOS; `problem-radar.test.ts`                                                                                          | Covers own records only (by design); connector monitoring needs connectors                                                                     |
| T12-04 Business-in-a-Box                     | PARTIAL                                                                      | `BusinessWorkspace` in `JarvisWorkspace.tsx`; `business-workspace.test.ts`                                                                                                             | Drafts from one folder; no accounting/CRM connectors                                                                                           |
| T12-05 Opportunity Engine                    | PARTIAL                                                                      | `OpportunityEngine.tsx`, `opportunity-engine.ts`                                                                                                                                       | Person-supplied listings only; no listing discovery source                                                                                     |
| T12-06 Work Simulation                       | DONE                                                                         | rehearsal mode `20261121180000`, `20261122212000`; rehearsal tests                                                                                                                     | Office/app-native previews limited to file copies                                                                                              |
| T12-07 Proof Passport                        | DONE                                                                         | `proof-passport.ts`; tests                                                                                                                                                             | Unsigned manifest (no signing key provisioned)                                                                                                 |
| T12-08/T12-09/T12-10/T12-11/T12-12           | PARTIAL (code present per 21 Nov batch 2; not re-audited this session)       | Appendix E 21 Nov batch 2                                                                                                                                                              | T12-09 Knowledge Vault = Library + private memory; no separate encrypted export format                                                         |
| Security register (Stage 2)                  | PARTIAL                                                                      | `docs/OCADE_THREAT_TRIAGE.md`: 138 FIXED, 34 PARTIAL, 2 OPEN, 11 OWNER, 7 N/A                                                                                                          | OPEN: MALWARE-02 (no AV engine), MODEL-08 (needs Stage 5 runs); VERIFY-07 PARTIAL (Linux flake run done)                                       |
| Debloat (Stage 3)                            | DONE for prior pass                                                          | `docs/DEBLOAT_REPORT.md`                                                                                                                                                               | Re-run after this batch: nothing new to remove                                                                                                 |
| CI GREEN on one SHA (Stage 4)                | see §3                                                                       |                                                                                                                                                                                        |                                                                                                                                                |
| Benchmarks single vs multi agent (Stage 5)   | BLOCKED                                                                      | harness `live_eval.py`, `test_eval_audit.py`                                                                                                                                           | Needs staging deployment approval and real-model capacity (readiness: staging Gemini rate-limits after 30–60 calls)                            |
| Windows/macOS cloud-computer tests (Stage 6) | BLOCKED                                                                      | hosted runner ladders only                                                                                                                                                             | No consumer Windows/macOS machine attached to this session                                                                                     |

## 2. This session's changes

| Change                                                        | Requirement | Proof                                                         |
| ------------------------------------------------------------- | ----------- | ------------------------------------------------------------- |
| Schedules end by date or run count, enforced in the database  | T12-02      | `tests/jarvis/db/schedules.test.sql`, 57 rollbacks round-trip |
| Problem Radar over own LifeOS, schedules, watches, computers  | T12-03      | `tests/security/problem-radar.test.ts` (5)                    |
| Library names NFC-composed, control/format characters removed | UPLOAD-08   | `library-intake.test.ts` UPLOAD-08                            |
| Install-script allowlist gate in `verify:full`                | SUPPLY-05   | `npm run audit:install-scripts`                               |
| Refused staff/support changes logged with actor               | ADMIN-08    | `admin-refusal-log.test.ts`                                   |

## 3. Gates

Local before push: `verify:full` 8/8; TypeScript security and JARVIS suites green (one test needs
Python Playwright on PATH); companion suite 340 OK with 17 platform skips; database suite with 57
rollbacks; signed-in local-stack browser audits (`evidence/2026-11-23-radar-autopilot/`).

Hosted on `2185730`: CI, macOS bundle, static security and JARVIS cloud validation (dispatched,
full matrix) green except one windows-2022 companion job that hung in asyncio's Proactor loop
close after `test_fs_ops.Diagnostics` (a known intermittent hang first recorded 20 Nov; root
cause not found without a Windows machine). Final-SHA runs are listed in the session report.

## 4. Blockers that need the owner

- **Staging schema:** staging lacks 17 branch migrations; Stage 5 benchmarks (single vs team,
  `jarvis-staging-evaluation.yml` campaign `benchmark`) would test the new authority code against
  an old schema. Applying migrations to the shared staging project needs the owner's go-ahead.
- **Stage 6:** no consumer Windows 10/11 or macOS machine is attached; hosted runners are not
  customer machines.
- **Windows-2022 teardown hang:** needs a Windows machine to reproduce. Recurred on dispatched run
  [45238233189](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/45238233189) at
  `5f366b8` (23 Nov), at the same place as on 20 Nov: right after
  `test_fs_ops.Diagnostics.test_processes_environment_and_refusals` (which runs `tasklist` and
  `wevtutil` inside the office worker), the SDK logs that the worker PID is "still alive after the
  kill escalation" while psutil already reports that PID gone, and `anyio.run` then never returns
  from `IocpProactor.close` (`windows_events.py` `_poll`). So the worker exited but asyncio never
  observed its exit, and the proactor waits forever for that pending wait. windows-2025, macOS and
  Linux passed the same suite. Not fixed: forcing the proactor closed without proof risks freeing
  live overlapped buffers.
