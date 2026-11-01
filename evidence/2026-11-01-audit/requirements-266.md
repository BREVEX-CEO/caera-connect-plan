# 266-requirement audit (plan.md section 1)

Each numbered requirement is classified on its own. PASS means fully met with evidence on this branch; PARTIAL means some of it is done; FAIL means not done; BLOCKED means it cannot proceed without hardware, approval or capacity; UNTESTED means nothing has verified it.

**Totals:** PASS 112, PARTIAL 116, FAIL 14, BLOCKED 6, UNTESTED 18 (of 266).

| # | Status | Evidence |
|---|---|---|
| 1 | PASS | continued from branch state |
| 2 | PASS | only ocade/p00-p22-implementation; no main/deploy/spend/PC |
| 3 | PARTIAL | goal in progress: NO-GO |
| 4 | PASS | ~40 code commits this session |
| 5 | PASS | architecture preserved |
| 6 | PASS | no rewrites |
| 7 | PASS | read plan/AGENTS/CLAUDE/ledger before edits |
| 8 | PASS | CI logs, staging, git history inspected |
| 9 | PASS | no unrelated reverts |
| 10 | PARTIAL | gates.json + 84-concept ledger; no full surface inventory |
| 11 | PASS | gates.json, ledger use the five states |
| 12 | PASS | evidence READMEs separate defects/risks |
| 13 | PARTIAL | critical frozen-worker bug fixed; provider capacity, DPI, consumer Windows open |
| 14 | PASS | no zero-bug claim |
| 15 | PASS | P0 grounding/verification/safety first |
| 16 | PASS | small commits each with tests |
| 17 | PASS | cloud only; no PC |
| 18 | PASS | free GitHub runners, staging only |
| 19 | PASS | visibility unchanged |
| 20 | PASS | no prod secrets/data touched |
| 21 | PASS | one DB task authority |
| 22 | PASS | Gemini only planner |
| 23 | PARTIAL | model unchanged; free-tier rate limit hit, not resolved |
| 24 | PASS | no-hardcode guard; random-name app/fixture tests |
| 25 | PASS | no app/file/selector special cases added |
| 26 | PASS | oracles test-only (live_eval.py) |
| 27 | PASS | receipts from real workers only |
| 28 | PARTIAL | order in planner prompt; not enforced |
| 29 | PARTIAL | model chooses; no measured mechanism cost |
| 30 | FAIL | no automatic mechanism fallback |
| 31 | PARTIAL | checks+steps durable; no milestones/uncertainty model |
| 32 | PASS | task state in DB, not model context |
| 33 | PARTIAL | turn-by-turn with read batches; no explicit horizon |
| 34 | PARTIAL | ops typed by role; verifier separate; planning/execution share planStep |
| 35 | PASS | intent ids, task, target, grants, deadline, receipt |
| 36 | PASS | journal + idempotency tests |
| 37 | PASS | observed/not_applied/unknown/refused/cancelled + verifier |
| 38 | PASS | journal; kill-and-restart test (test_agent) |
| 39 | PASS | interrupted writes reported unknown, never re-run |
| 40 | PASS | STOP/Take Over/revoke DB+agent tests; re-observe after takeover |
| 41 | PASS | STOP ends process tree (test_shell) |
| 42 | PASS | single gateway, no per-tool services |
| 43 | PASS | one Zod contract -> protocol.json |
| 44 | PARTIAL | protocol v1 checked, update_required refusal; no negotiation |
| 45 | PARTIAL | refusal exists; no upgrade instructions UI |
| 46 | PARTIAL | row context + seen-link guard added; r1c still failed; not re-run |
| 47 | PASS | no python.org/version special case |
| 48 | PARTIAL | web observation tokens, window leases; no unified layer for files |
| 49 | PASS | per-observation selector tokens |
| 50 | PARTIAL | label/href/row/selector; no headings/bounds for web |
| 51 | PARTIAL | row text only |
| 52 | PASS | stale selectors refused; lease rechecks; look-again after Take Over |
| 53 | PASS | unseenAddress guard + test |
| 54 | PARTIAL | rule in prompt; seed 12/13 web_fact PASS; not enforced |
| 55 | PARTIAL | rows as text; no structured table read |
| 56 | PARTIAL | prompt only |
| 57 | PARTIAL | UIA/AX/DOM first, image second |
| 58 | UNTESTED | DPI/zoom/multi-monitor untested |
| 59 | PARTIAL | window leases verified on Windows Server runner only |
| 60 | PARTIAL | window image + boxes; no loop control specific |
| 61 | FAIL | no image matching/confidence |
| 62 | PARTIAL | duplicates, stale, popups, redirects, forged tested; overlays/dynamic tables not |
| 63 | PARTIAL | stall guard; no wrong-click detection |
| 64 | PASS | only generic prompt rules added |
| 65 | UNTESTED | release_pick generator built; not run (quota) |
| 66 | PASS | settlement only by verifier predicates |
| 67 | PARTIAL | checks immutable but model-authored; no authoritative rules |
| 68 | PARTIAL | instruction + case/folder fixes; no enforcement; untested live |
| 69 | PARTIAL | measured notes; ask path; no structural separation |
| 70 | PARTIAL | sha, content, file_parses; no app behaviour |
| 71 | PARTIAL | recalculated cell values; formulas/ranges not checked |
| 72 | PARTIAL | docx text, PDF renders; formatting not |
| 73 | PARTIAL | size/scene binding; no perceptual check |
| 74 | PARTIAL | duration, codecs, loudness, black/silence measured; requested edits not |
| 75 | PARTIAL | file_parses; program not re-run by design |
| 76 | PARTIAL | web_text_contains + file checks |
| 77 | PARTIAL | verify returns measured per check |
| 78 | PARTIAL | receipts carry evidence; no redaction policy test |
| 79 | PASS | separate verifier worker; oracles never shown |
| 80 | PARTIAL | gaming regression via prompt only |
| 81 | PARTIAL | verified-first design |
| 82 | PARTIAL | total, model, active, pause, confirm wait; not per-tool startup |
| 83 | PARTIAL | batch history fix, stall guard; repeated reads cut |
| 84 | PASS | read batches |
| 85 | PASS | external effects run alone |
| 86 | PARTIAL | validators cached; no file-hash cache |
| 87 | PARTIAL | bounded observations; no incremental diffs |
| 88 | PASS | workers stay up per gateway session |
| 89 | PASS | repeat/pair/triple stall guard |
| 90 | PARTIAL | bounded by stall guard/budget; not per error category |
| 91 | PARTIAL | history budget fix |
| 92 | PARTIAL | no parallel execution |
| 93 | PASS | native ops preferred |
| 94 | PARTIAL | some measured (35.7->15.8 s web suite) |
| 95 | PASS | no security removed |
| 96 | PARTIAL | median 39 s, p95 79.7 s, 6 calls; no p99/tokens/resources |
| 97 | PARTIAL | system.inspect + confirmed install + re-inspect |
| 98 | PARTIAL | Windows bundle self-contained; no macOS/Linux package |
| 99 | PARTIAL | bundled vs task deps distinct; no manifest |
| 100 | PARTIAL | PATH/App Paths/file version |
| 101 | PARTIAL | ffmpeg/office/browser engines |
| 102 | PASS | only needed runtimes bundled |
| 103 | PARTIAL | OS/arch/disk; no network/scope |
| 104 | UNTESTED | x64 only; ARM64 not built |
| 105 | PARTIAL | prompt prefers package managers |
| 106 | FAIL | no version/hash/licence resolution |
| 107 | PARTIAL | commands shown exactly and confirmed |
| 108 | PARTIAL | exact command shown; no structured package details |
| 109 | PASS | per-user, unelevated install |
| 110 | UNTESTED | UAC/policy detection untested |
| 111 | FAIL | no DLL/dylib diagnosis |
| 112 | PARTIAL | diagnose covers paths/workspace/server |
| 113 | UNTESTED | AV/SmartScreen untested |
| 114 | PARTIAL | diagnose messages |
| 115 | FAIL | installs not journaled/resumable |
| 116 | PARTIAL | re-inspect location only |
| 117 | FAIL | no auto-resume after dependency install |
| 118 | PARTIAL | task saved on failure |
| 119 | FAIL | no clean-machine dependency tests |
| 120 | PARTIAL | CI runners only |
| 121 | BLOCKED | no consumer Windows 10/11 machine |
| 122 | PARTIAL | install/repair/uninstall on Windows Server runner; pairing+task from installed app not |
| 123 | PASS | frozen workers + browser bundle verified; lifecycle diagnose |
| 124 | PARTIAL | no Python/Node needed; Windows PowerShell 5 used for shell |
| 125 | PARTIAL | UIA on runner; COM untested |
| 126 | PARTIAL | foreground, interference, wrong window, minimized, closed on runner; elevated/inaccessible not |
| 127 | UNTESTED | DPI/monitors untested |
| 128 | UNTESTED | standard user/UAC/OneDrive/Unicode untested |
| 129 | UNTESTED | sleep/lock/network untested |
| 130 | PASS | process-tree STOP tests on Windows CI |
| 131 | PARTIAL | mac_worker: MAC-001..012 pass on GitHub macOS runner (CI run 45); consumer Mac untested |
| 132 | PARTIAL | AX trust check/refusal; no onboarding UI |
| 133 | BLOCKED | no Intel Mac / consumer Apple hardware |
| 134 | PARTIAL | no Linux desktop control; excluded and not offered |
| 135 | UNTESTED | Linux packaging untested |
| 136 | PASS | one contract, platform bridges |
| 137 | PASS | desktop engine, browser_unavailable |
| 138 | PASS | no OS claimed fully supported |
| 139 | FAIL | no installed-browser/profile discovery (dedicated profile only) |
| 140 | PARTIAL | bound to own profile/tab/site |
| 141 | PASS | DOM/Playwright structured ops |
| 142 | PARTIAL | popups/downloads/redirects/sign-in; file pickers/prompts not |
| 143 | PASS | sign-in handed to person; no bypass |
| 144 | PARTIAL | generic ops; random-named app tests |
| 145 | PASS | random app names, files, fixtures |
| 146 | PARTIAL | public + signed-in pages audited; admin/usage not exercised |
| 147 | PARTIAL | pages/links/a11y; not every control |
| 148 | PARTIAL | pair/grant/consent/task start via website; completion blocked by quota |
| 149 | PARTIAL | last seen shown; states not tested |
| 150 | PARTIAL | live steps/timing; truthful pause fix |
| 151 | PASS | exact effect shown (test) |
| 152 | PARTIAL | STOP/Take Over/Resume exist; UI test partial |
| 153 | PARTIAL | artifacts listed; download/preview UI untested |
| 154 | PASS | offline chat separate |
| 155 | UNTESTED | voice disabled in JARVIS |
| 156 | PARTIAL | desktop+phone viewport audit in Chromium only |
| 157 | UNTESTED | Android not touched |
| 158 | UNTESTED | iOS not tested |
| 159 | PARTIAL | Enter-to-send, a11y basics; perf not measured |
| 160 | PARTIAL | no dead controls found by audit; not exhaustive |
| 161 | PARTIAL | DB authority tests; staff/owner not audited |
| 162 | PASS | forged/revoked/cross-account/duplicate DB+e2e tests |
| 163 | PARTIAL | forward migrations on disposable DB; no rollback |
| 164 | PARTIAL | idempotent queue; no backpressure tests |
| 165 | PARTIAL | allowance windows exist |
| 166 | PARTIAL | busy/outage handled truthfully; capacity insufficient |
| 167 | PASS | sanitized worker env, SAFE harness env, root-only .dev.vars, SHELL-003 |
| 168 | UNTESTED | headers/CSP/CSRF not audited |
| 169 | PARTIAL | path traversal, injection text, forged args tested; XSS/SQLi/SSRF not |
| 170 | PARTIAL | MCP pinning incl scripts; DPAPI same-user residual risk |
| 171 | PASS | workspace sandbox, sha-guarded edits, originals kept |
| 172 | BLOCKED | restore drill needs owner approval |
| 173 | PASS | no new infrastructure |
| 174 | PASS | MFA untouched |
| 175 | PARTIAL | account isolation DB-tested; traces not audited |
| 176 | PARTIAL | no secrets in evidence (checked); no redaction test |
| 177 | PARTIAL | diagnose; no crash reports/metrics |
| 178 | PASS | ocade_agent diagnose + test + installed run |
| 179 | UNTESTED | export/deletion untested |
| 180 | PARTIAL | terms/privacy pages exist; not reviewed |
| 181 | FAIL | no release notes/runbooks |
| 182 | UNTESTED | redistribution licences not reviewed |
| 183 | PASS | payments excluded |
| 184 | PASS | signing excluded |
| 185 | PARTIAL | Windows x64 installer byte-identical; other platforms none |
| 186 | PASS | every frozen worker starts; installed diagnose |
| 187 | PARTIAL | install/repair/uninstall keep files; upgrade/rollback untested |
| 188 | FAIL | no update mechanism |
| 189 | UNTESTED | no updater |
| 190 | PARTIAL | clean CI VMs only |
| 191 | UNTESTED | no soak tests |
| 192 | UNTESTED | constrained machines untested |
| 193 | PARTIAL | provider outage -> waiting; device network loss partial |
| 194 | PARTIAL | CI matrix Linux/macOS/Windows x64; no DPI/ARM/permission matrix |
| 195 | PARTIAL | unit/protocol/DB/e2e/browser/desktop/packaging/installer; no perf/DR/a11y suite |
| 196 | PASS | run_required guard + e2e guard, CI green |
| 197 | PASS | oracles hidden |
| 198 | PASS | randomized generators |
| 199 | PASS | real Gemini runs |
| 200 | PARTIAL | files/docs/code/browser/PC; no live image/video |
| 201 | PARTIAL | synthetic representative tasks |
| 202 | PARTIAL | first-attempt, elapsed, calls; no intervention rate |
| 203 | PASS | treated as checkpoint |
| 204 | PASS | fresh seeds, single attempt |
| 205 | FAIL | 27/36 = 75% first attempt |
| 206 | PARTIAL | critical installed-worker bug fixed; zero unauthorized actions observed; provider gate open |
| 207 | PARTIAL | most retested; Python download still failing |
| 208 | PASS | Python 3.12 runs and CI |
| 209 | PARTIAL | Server runners only |
| 210 | PARTIAL | kill/STOP/takeover; network-loss/update not |
| 211 | PARTIAL | oracles check values; unrelated-file changes not checked |
| 212 | PARTIAL | security/provenance partial |
| 213 | PASS | no tests deleted or weakened |
| 214 | PASS | scripts/launch-readiness.mjs + gates.json |
| 215 | PASS | scripts/launch-readiness.mjs + gates.json |
| 216 | PASS | scripts/launch-readiness.mjs + gates.json |
| 217 | FAIL | installer readiness milestone not earned |
| 218 | PARTIAL | control milestone partial |
| 219 | FAIL | grounding milestone 75% < 90% |
| 220 | PARTIAL | verification milestone partial |
| 221 | PARTIAL | customer product partial |
| 222 | BLOCKED | backup drill, provider capacity |
| 223 | BLOCKED | platform hardware |
| 224 | BLOCKED | depends on 1-9 |
| 225 | PASS | scripts/launch-readiness.mjs + gates.json |
| 226 | PASS | scripts/launch-readiness.mjs + gates.json |
| 227 | PASS | scripts/launch-readiness.mjs + gates.json |
| 228 | PASS | scripts/launch-readiness.mjs + gates.json |
| 229 | PASS | scripts/launch-readiness.mjs + gates.json |
| 230 | PASS | scripts/launch-readiness.mjs + gates.json |
| 231 | PASS | scripts/launch-readiness.mjs + gates.json |
| 232 | PARTIAL | milestone reports given in chat |
| 233 | PASS | scripts/launch-readiness.mjs + gates.json |
| 234 | PASS | scripts/launch-readiness.mjs + gates.json |
| 235 | PASS | baseline computed |
| 236 | PASS | compared |
| 237 | PARTIAL | gates.json + ledger; not a full severity backlog |
| 238 | PARTIAL | issues in commits/evidence, not one register |
| 239 | PASS | grounding/verification first |
| 240 | PASS | root-cause fixes |
| 241 | PASS | focused then full tests |
| 242 | PASS | measured before changing |
| 243 | PARTIAL | dead imports removed; ToRemove.md not executed |
| 244 | PASS | no line-count targets |
| 245 | PASS | no hardcoded apps |
| 246 | PASS | tests separate from runtime |
| 247 | PARTIAL | some runs cancelled by pushes |
| 248 | PASS | fixed from logs |
| 249 | PASS | cloud first |
| 250 | PASS | commits with tests, no merge |
| 251 | PASS | approvals only where real |
| 252 | PASS | approval items listed |
| 253 | PASS | no unnecessary asks |
| 254 | PASS | in report |
| 255 | PARTIAL | status in chat |
| 256 | PASS | this report |
| 257 | PASS | no completion claims |
| 258 | PASS | no safety traded |
| 259 | FAIL | no head-to-head benchmark run |
| 260 | PASS | verified work focus |
| 261 | PASS | no unrelated features |
| 262 | PASS | continued past green CI |
| 263 | PASS | blocked items recorded |
| 264 | PARTIAL | in progress |
| 265 | PASS | NO-GO |
| 266 | PASS | no hardcoding/faking |
