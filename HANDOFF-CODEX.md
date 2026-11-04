# Handoff to the next coding agent (Codex) — 4 November 2026

Copy everything below the line into the new agent as its first message.

---

You are taking over OCADE (repository `BREVEX-CEO/caera-connect-plan`) as the **only** coding agent. Work cloud-first. Read this whole message before you change anything.

## 1. Exact starting point

- **Branch:** `ocade/p00-p22-implementation`. Work only on this branch. Never merge `main`.
- **HEAD at handoff:** the commit that adds this file (`docs: handoff ...`), whose parent is `2dced6b`. Run `git fetch origin ocade/p00-p22-implementation && git checkout ocade/p00-p22-implementation && git log --oneline -8`.
- **Read first, in this order:** `AGENTS.md` (thinking and coding rules), `plan.md` §0 (session start), §3 (status), §15 (package board), §16 (work packages), §17 (quality gates), Appendix D (defects). Appendix A has the 266 requirements and Appendix B the 84 concepts, each with a status and a destination package.
- **The concept denominator is 84.** It is checked by `npm run jarvis:traceability`. Do not change any count.

## 2. Progress at handoff (measured, not estimated)

| Measure                   | Value                                                                | How to recompute                                                   |
| ------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Commercial readiness      | **20/100** (2/10 milestones; 19/42 conditions PASS = 45.2%)          | `npm run readiness`                                                |
| Requirements PASS         | **79/266** (29.7%): 152 PARTIAL, 12 FAIL, 5 BLOCKED, 18 UNTESTED     | `grep -cE '^[0-9]+\. \`PASS\`' plan.md`                            |
| Concepts PASS             | **45/84** (53.6%): 38 PARTIAL, 1 FAIL                                | `node scripts/jarvis-traceability.mjs`                             |
| Live real-task success    | 27/36 (75%) on 1 Nov; E1 partial 7/8 at `a6a728f` on 4 Nov, gaming 0 | `evidence/2026-11-04-e1/README.md`                                 |
| Last full green CI matrix | run 86 (`d80ad29`)                                                   | GitHub Actions, workflow `JARVIS cloud validation (no deployment)` |

No 10% readiness milestone was crossed in the last session.

### Readiness milestones (`evidence/readiness/gates.json`; a milestone earns 10 only when all its conditions PASS and every cited evidence file exists)

| #   | Milestone                               | State                                                                                                                  | What it needs                                                                                                                          |
| --- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Repository and architecture baseline    | EARNED                                                                                                                 | keep green                                                                                                                             |
| M2  | Core Gateway and device authority       | EARNED                                                                                                                 | keep green                                                                                                                             |
| M3  | Installer and dependency readiness      | bundle_builds PARTIAL, clean_install BLOCKED, dependency_manager PARTIAL, upgrade_uninstall PARTIAL                    | W9; clean install needs consumer hardware (A2)                                                                                         |
| M4  | Computer and browser control            | web_targets PASS, web_safety PASS, windows_uia PARTIAL, macos_ax PARTIAL, linux_desktop FAIL, visual_grounding PARTIAL | W6/W7 runner proof. **linux_desktop conflicts with owner decision O1 (Linux optional): ask the owner; never change the gate yourself** |
| M5  | Gemini intelligence and grounding       | unseen_success FAIL, target_accuracy UNTESTED                                                                          | full E1 ≥90% first attempt on unseen tasks; measure target accuracy                                                                    |
| M6  | Independent verification and recovery   | no_gaming, file_protection, rich_verification PARTIAL                                                                  | full E1 with gaming audit 0; cite the verifier tests for the new check kinds                                                           |
| M7  | Customer-facing product                 | surface_audit, exact_approvals, onboarding PARTIAL                                                                     | W10                                                                                                                                    |
| M8  | Security, infrastructure and operations | secrets_isolation, backup_restore PARTIAL; provider_capacity BLOCKED                                                   | W11; provider capacity needs the owner's paid-capacity decision                                                                        |
| M9  | Platform and performance qualification  | platforms BLOCKED, latency PARTIAL                                                                                     | real hardware (A2); latency needs A1(b)                                                                                                |
| M10 | Final commercial release qualification  | acceptance BLOCKED, closed_beta BLOCKED                                                                                | owner actions after W13                                                                                                                |

**Honest ceiling:** without owner actions (A1, A2, paid capacity, the O1/linux_desktop decision, a closed beta), readiness cannot reach 100. In the cloud the reachable milestones are M1, M2, M5, M6, M7 and possibly M4 (after the O1 decision). That is at most 60/100. Report this; do not hide it.

## 3. Package board (W2–W13)

| Package                                  | State                   | Done                                                                                                                                                                                                                                         | Remaining                                                                                                                               |
| ---------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| W2 Measurement and pickup speed          | BLOCKED (code complete) | Realtime nudge; receipt carries the next step; worker prewarm; device-key cache. Idle pickup p95 502 ms synthetic, 0.5–0.8 s live                                                                                                            | Unaccounted time ≤10% (live 35%, from ~210 ms per DB round trip in the agent container). Needs A1(b) to measure the production topology |
| W3 Capability surface                    | DONE (code)             | `fs.manage`, `job.*`, shell choice, `system.diagnose`, mechanism fallback                                                                                                                                                                    | —                                                                                                                                       |
| W4 Accuracy engine → E1                  | IN PROGRESS             | Shortlist recall: tuning 100%, held-out 97.1%; busy planner resumes itself (D10); failure categories, gaming audit, 16 task generators; tables as rows; one goal retry (`2dced6b`)                                                           | **Full E1: 48 paced tasks at current HEAD**; held-out recall ≥98% without tuning on the held-out set; D9 (≥90% first attempt)           |
| W5 Deliverables and visual fallback → E2 | IN PROGRESS             | In-place docx/xlsx/pptx edits, new decks, `image.edit`, OTIO beside every film; verifier kinds `script_runnable`, `workbook_formula`, `document_headings`, `local_service_answers`, `command_succeeds`; click matched to the inspected image | glTF export (D19); E2                                                                                                                   |
| W6 Windows 10/11                         | IN PROGRESS             | Hung/elevated windows refused; DPI v2; stale-image click refusal                                                                                                                                                                             | AutoSetFocus off; packaged (UWP) apps; Windows 10 vs 11 runner coverage                                                                 |
| W7 macOS                                 | IN PROGRESS             | Accessibility and Screen Recording detection with graceful degradation                                                                                                                                                                       | AXObserver events; `.app` bundle; D16                                                                                                   |
| W8 Browser and web → E3                  | IN PROGRESS             | Browser and profile discovery (req 139, Linux-verified); file-picker clicks reported; permission prompts reported, never answered; other open tabs listed in every observation                                                               | D11; Windows/macOS profile paths on real machines; E3 (needs A1; Linux-only if A1 is pending, recorded as such)                         |
| W9 Install, dependencies, updates        | NOT STARTED             | —                                                                                                                                                                                                                                            | Requirements 97–120, 185–190                                                                                                            |
| W10 Customer product                     | NOT STARTED             | —                                                                                                                                                                                                                                            | Requirements 146–160, 221                                                                                                               |
| W11 Security, privacy, operations        | NOT STARTED             | Rollbacks for the 12 recent migrations (D21) already proven                                                                                                                                                                                  | Requirements 161–182 subset (see board)                                                                                                 |
| W12 Proof-based debloat                  | NOT STARTED             | —                                                                                                                                                                                                                                            | Needs A3 for PR cleanup                                                                                                                 |
| W13 Full cloud qualification → E4        | NOT STARTED             | —                                                                                                                                                                                                                                            | Needs A1                                                                                                                                |

## 4. Open defects (Appendix D)

- **HIGH:** D8 partial (unaccounted time), D9 (first-attempt success < 90%), D16 (macOS Screen Recording on consumer Macs, unverified). Mitigated: D4 (SSRF/redirect hops), D10 (shared free planner busy).
- **MEDIUM:** D11 (Windows web ladder `KeyError 'page'` once, cause unknown), D19 partial (glTF/3D), D13 mitigated.
- **LOW:** D15 (stale Dependabot PRs; needs A3).

## 5. Failed or unverified tests at handoff

- **No known failing test locally.** Locally green at `2dced6b`: planner safety (116 tests), `tests/jarvis/*.test.ts` (26 pass, 1 CI-only skip), web suites under Xvfb, `test_fs_ops`, `test_agent`, typecheck, format, protocol check.
- **CI runs 89–91 failed** only because `tests.test_verify_web` grew to 8 cases while the workflow required exactly 7. Fixed in `c9e6b0e`. Runs 92–95 were cancelled by newer pushes. **The run on the handoff HEAD is the first CI check of `c9e6b0e`…`2dced6b`. Check it first.**
- **Not verified live:** the goal retry (`2dced6b`), permission prompts, the tab list and profile discovery on Windows/macOS.

## 6. Supabase staging status

- **Staging:** project `auyapercxxptziyngycx`. **Production `sazhgaisyhkdbrooycdv` must never be touched.**
- Every migration in `supabase/migrations/` up to `20261104130150_verifier_reruns_a_confirmed_command.sql` is applied to staging and recorded in `supabase_migrations.schema_migrations`. Each function body was verified by comparing `md5(prosrc)` with a local replay database.
- Rollbacks exist in `supabase/rollback/` for the 12 migrations after `20261030`. `tests/jarvis/db/rollback-roundtrip.sh` proves each one (part of `npm run test:jarvis-db`).
- **How to apply a new migration safely:** create it with `supabase migration new <name>` (the CLI can hang after it writes the file: kill that one process by pid, never with `pkill -f`). Write SQL without `DROP` (use `CREATE OR REPLACE`; a `DROP` triggers an interactive confirmation in the Supabase MCP `apply_migration`). Apply the file contents with `execute_sql`, insert the version into `supabase_migrations.schema_migrations`, then compare `md5(prosrc)` with a local replay. Add the rollback file and extend the DB tests in the same commit. Update `src/integrations/supabase/types.ts` by hand for new columns or functions (CI runs `supabase:types-check`).
- Credentials come from the environment only: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OCADE_LIVE_EMAIL` (staging). The publishable key is public. Never print, commit or rotate a secret. Never rotate Gemini keys on a 429.

## 7. Why development has been slow (root causes, with fixes you must apply)

1. **Pushes cancel in-flight CI.** The workflow uses a concurrency group, so each push cancels the running matrix (runs 88, 92 and 93 were cancelled). A full matrix takes 15–25 minutes, so frequent pushes left long stretches without a green signal. **Fix:** run the local gate (below) before pushing; batch related commits; push at most once per finished workstream slice; wait for the matrix result before the next push when you need the signal.
2. **Exact test counts are pinned in the workflow** (`result.testsRun == N` in `.github/workflows/jarvis-cloud-validation.yml`). Adding one test to a pinned module turned CI red for three runs. **Fix:** whenever you add or remove a test in a module named in a pinned step, update that count in the same commit. Before pushing, run `grep -n "testsRun ==" .github/workflows/jarvis-cloud-validation.yml` and recount. Do not remove the pins: they stop silent skips.
3. **No single local command mirrors CI.** **Fix (do this first, small):** add one script, for example `scripts/ci-local.sh`, that runs the Linux steps of the "Planner safety", "Portable build" and "Python MCP" jobs in order, and use it before every push.
4. **Live evaluations are slow and fragile.** Each task takes 1–3 minutes plus 45 s pacing for the free model quota, so 48 tasks take about 2.5 hours. The shared free planner returns "busy" after a burst (D10). The agent container adds about 210 ms per database round trip (35% unaccounted time). **Fix:** start an evaluation in the background with `nohup`, write results into the repository worktree, keep coding meanwhile, and record partial results honestly if you stop.
5. **The environment resets between sessions.** Postgres, Python packages and the Playwright browser must be set up again. **Fix:** use the bootstrap commands in §9.
6. **Large files fill the context.** `plan.md` (~1,600 lines), `planner.server.ts` and `authority.server.ts` are large. **Fix:** read by line range (`grep -n`, then `sed -n 'a,bp'`); never read them whole.
7. **Many remaining conditions are blocked on owner-only actions** (A1, A2, hardware, paid capacity). Coding cannot pass them. **Fix:** finish all cloud-reachable work first, then report the exact owner action for each blocked condition.
8. **Milestones are all-or-nothing.** Real progress (19/42 conditions) shows as 20/100. Report conditions and milestones separately; never merge them.

## 8. What to do, in order

Apply the loop in `AGENTS.md`: Understand → Locate → Reproduce → Design → Implement → Check → Simplify → Prove → Commit. One coherent, verified change per commit.

1. **CI first.** Open the latest run of `JARVIS cloud validation (no deployment)` on this branch. If any job is red, find the failing step (the "Formatting evidence for failed remote candidates" output only appears after a failure; it is not the cause), reproduce it locally and fix the root cause. Never skip, weaken or quarantine a test.
2. **Add `scripts/ci-local.sh`** (root cause 3). Keep it short.
3. **W4 → E1 (highest value; it moves M5 and M6).** Run the full E1 at the current HEAD: seeds 22–24 × 16 tasks (see §9). For each failure, classify it with the harness category, find the root cause, add a regression test, fix it, and re-run that task family. Acceptance: ≥90% first-attempt success on unseen tasks, gaming audit 0, held-out shortlist recall ≥98% (never tune on the held-out set). Record results in `evidence/2026-11-0X-e1/`, plan.md §3, the W4 row and Appendix D (D9).
4. **Readiness update.** When E1 and CI are green, update only the conditions the evidence supports in `evidence/readiness/gates.json` (cite existing files only), run `npm run readiness`, and report any 10% step.
5. **W5:** glTF export (D19 residual) with an independent verifier check; then E2.
6. **W8:** D11 root cause on the Windows runner; E3 (Linux-only, recorded as such, until A1).
7. **W6/W7 runner-provable items:** UI Automation without AutoSetFocus, packaged (UWP) apps, AXObserver events, a macOS `.app` bundle. Prove each on the GitHub Windows/macOS runners. Runner results never establish consumer-platform PASS (plan.md §17 G-Requirement).
8. **W9 → W13** in board order, cloud-reachable parts only: dependency manager and update channel without paid infrastructure; the customer UI; security, privacy and operations items; proof-based debloat; full cloud qualification. Stop at each owner-only gate and record it.

After every finished slice: update `plan.md` (§3, §15, Appendices A–D) in the same commit as the evidence, push, and confirm CI.

## 9. Commands

```bash
# bootstrap (Linux container)
npm ci --no-audit --no-fund
python3 -m pip install -r device-agent/windows/requirements.txt
python3 -m pip install reportlab==4.5.1 opentimelineio==0.17.0   # test-only
service postgresql start && su postgres -c "createuser -s root"  # local disposable DB

# local gate (mirror of CI; run before every push)
npm run typecheck && npm run format:check && npm run jarvis:protocol-check && npm run readiness
node --experimental-strip-types --no-warnings --test tests/security/*.test.ts tests/jarvis/contracts.test.ts
node --experimental-strip-types --no-warnings --test tests/jarvis/*.test.ts
npm run test:jarvis-db
(cd device-agent/windows && xvfb-run -a python3 -m unittest discover -s tests -t .)
node scripts/jarvis-traceability.mjs

# live E1 on staging (background; from a clean worktree of the commit under test)
git worktree add /tmp/ocade-wt-$(git rev-parse --short HEAD) HEAD
# then, inside that worktree, for seed in 22 23 24:
#   OCADE_BROWSER_EXECUTABLE=<chromium path> SUPABASE_PUBLISHABLE_KEY=<public key> \
#   xvfb-run -a -s "-ac -screen 0 1280x1024x24" \
#   python3 tests/jarvis/live_eval.py --seed $seed --out evidence/<date>-e1/s$seed --pause 45
```

Notes: the live harness runs the companion as a separate user (`ocadelive`), so the worktree must be readable (`chmod o+rX`) and Xvfb needs `-ac`. Symlink `node_modules` into the worktree instead of reinstalling.

## 10. Engineering rules (binding)

- KISS and YAGNI: the smallest complete change in the existing owner. No speculative abstractions, no rewrites of working code. A third repetition, not a second, justifies an abstraction.
- Fix root causes in the shared path; write a failing test first for every bug; check the real effect independently (a file, a database row, a response body). Exit code 0 is not proof.
- Never hardcode anything to pass a test. Never fabricate a PASS, a result or an evidence file. Never change a requirement, concept or condition count.
- Keep security: validate untrusted input at trust boundaries; site and app binding; no cookie or password extraction; the person completes MFA, CAPTCHA and permission prompts; CI stays secrets-free with no scheduled automations.
- Fixed owner decisions: Windows and macOS mandatory, Linux optional (O1); free `gemini-3.5-flash-lite` (O2); no paid infrastructure (O3); one coding agent (O4); cloud-first (O5); no hardcoding (O8); CI secrets-free (O12).

## 11. Approvals you do NOT have

No production deployment. No merge to `main`. No spending money or paid services. No secret changes or key rotation. No testing on the owner's personal PC until all cloud qualification passes and readiness is 100. No destructive actions on staging data that is not yours. Ask the owner only for these; otherwise resolve failures yourself.

## 12. Owner-only blockers (report them; do not work around them)

- **A1:** live tasks on the Windows/macOS runners: (a) a protected Actions environment with staging secrets used only by an isolated server step, or (b) a free staging deployment of the web Worker. Needed for W2 unaccounted-time proof, E3 and W13.
- **A2:** real-PC validation on Windows 10, Windows 11 and macOS (after W13).
- **A3:** close the stale Dependabot PRs for the deleted `/jarvis-runtime` (D15, W12).
- **Paid model capacity decision** (M8 provider_capacity).
- **O1 versus M4 linux_desktop:** decide whether the optional Linux desktop condition counts toward readiness.
- **Consumer hardware and a closed beta** (M3 clean_install, M9, M10).

## 13. Reporting

Report every 10-point readiness step with the commit, the CI run and the evidence files. In each report give: readiness (milestones and conditions separately), requirements PASS/266, concepts PASS/84, what changed, what remains, and blockers. Say plainly when something is unverified. Do not stop after a progress report; continue with the next dependency-ready task until only owner-blocked work remains, then report the exact owner action needed.
