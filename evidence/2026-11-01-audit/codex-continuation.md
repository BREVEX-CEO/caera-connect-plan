# Codex implementation checkpoint

Work only on `ocade/p00-p22-implementation`. No deployment, main merge, spending, provider calls, or personal-PC/product execution occurred.

## Independently reproduced baseline

- Baseline HEAD: `df705dea65aea0618becd2c82606514cb049da05`.
- [Cloud validation run 46](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41332959498): all five jobs PASS. Linux: 23 JS tests, database suite, build/protocol/no-hardcode/audits; Windows/macOS: 56 companion tests each with documented platform exclusions. These are cloud results, not consumer-hardware qualification.
- All 266 numbered requirements were read. `phases.md` is absent at baseline HEAD (404); do not infer it is a live authority.
- Historical audit remains 112/266 PASS (42.1%), 154 remaining (57.9%). This number is not a new independent certification. The complete requirement-by-requirement re-audit is unfinished.
- Historical commercial score remains 20/100 (80% remaining), conditions 21/42 PASS. Neither score is upgraded by these changes.
- [Safety reproduction](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41334482779), commit `d7d727f`: 12 adversarial subcases FAIL and one negative control PASS (Node reports 14 failures including the two failed parent suites). Both defects are confirmed, not inferred.

## Confirmed defects and candidate fixes

1. **High — URL provenance, requirements 46/48/53/62/170/207.** `unseenAddress` searched serialized observations for substrings without origin binding or successful receipt checks. A path from one origin authorized the same path on another; shorter prefixes, credential-bearing URLs, failed results and prose substrings also passed. Candidate compares complete normalized HTTPS URLs, scopes relative links to their observed source origin, requires successful browser observations and rejects credentials.
2. **High — incomplete provider turns, requirements 23/34/166/206/210.** `callPlanner` accepted tool-call events without a final response and silently truncated excess calls. Candidate requires one terminal online/tool-use response matching every proposed ID/name/argument; cancellation, altered proposals, extra/duplicate calls and post-terminal events fail closed. Existing provider doubles now emit the real terminal protocol.
3. Provider rate-limit refusal codes now use the saved-task busy message. No key rotation, quota workaround or alternative planner was added.

The safety suite uses randomized resource paths, synthetic responses and a runner-local HTTP server. No task-specific runtime journey or answer was added. The full cloud workflow now gates its expensive jobs behind source formatting plus the focused regressions. The temporary reproduction workflow is removed; its tests remain mandatory in both preflight and integration.

## Verification / continuation

Planner/contract preflight: 32/32 PASS on `cc682e4` in [run 48](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41335093972). Full matrix not yet qualified; do not mark broad requirements PASS yet.

**High — competing-file overwrite, requirements 68/70/171/206/210/211.** The same run reproduced a real-file race: `write_atomically` checked existence then called `os.replace`, overwriting a customer's destination created between those operations. The new `test_concurrent_customer_file_is_never_replaced` deterministically inserts that interleaving; the old code fails (Refused not raised). Candidate uses no-replace Windows rename / POSIX hard-link publication, retains ordinary permissions and cleans temporary files. Filesystems without the required atomic primitive fail rather than silently fall back to overwriting. The old #53 PASS evidence was incomplete and is invalidated by the red reproducer until the repair passes.

1. Inspect the newest JARVIS cloud validation run for this branch. The atomic-publication fix must pass the six standard-library sandbox tests and the full Linux/Windows/macOS, DB/browser/build and frozen installer matrix. If preflight formatting fails, take canonical formatting from its `OCADE_FORMAT:` JSON log records and commit those exact texts; rerun the required matrix.
2. Investigate actual failures; never rerun unchanged failures to hunt for green.
3. After the matrix passes, record exact SHA/run/test counts here, update the existing requirement audit and architecture evidence, then continue binding verification/anti-gaming and provider recovery.
4. The verifier's anonymous URL fetch and the browser request guard need SSRF/redirect/DNS review. This is an unverified source concern, not a claimed exploit or completed fix.
5. Continue the existing P00–P22/266 backlog. Dependency installation, updates, exact target grounding, platform qualification and the >=90% unseen-task gate remain incomplete. Architecture G12 and public launch remain NO-GO.

## Verified first safety milestone

`897675b5fb0dd02e05a1e66c4075f1e481f05dfc`: [cloud run 49](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41335250240), all six jobs PASS. 32 focused planner/contracts, six sandbox, 38 JS integration tests and all 57 discovered companion tests per platform (documented skips: Linux 3, Windows 3, macOS 2). Database, seven build/source gates, dependency audits, frozen-worker startup, reproducible bundle/installer, install/repair/uninstall PASS. Machine-readable summary: `codex-safety-897675b.json`. Cloud proof does not qualify consumer hardware, current real-Gemini accuracy or full 266 completion.

Three repaired defects: exact URL provenance; complete provider-turn requirement; output publication never replaces a competing destination. No performance improvement is claimed.

## Next red reproducer

- Fixed check IDs can collide in the independent worker's predicate dictionary and erase a failed check. The planner also settles predicates without checking that the dispatched checks equal the saved task checks. Missing required per-kind parameters and multiple goal proposals are accepted.
- In-place repair stages at a predictable `.ocade-<customer filename>`, overwriting and deleting an unrelated hidden file of that name. Same-second repair backups also collide.
- Added test-only reproducers: `tests/security/verification.test.ts` and three focused real-worker tests in `test_gateway.py`. Do not call these fixed until red reproduction, repair and the next full matrix pass.
- The database settlement function is service-role-only, SECURITY INVOKER with an empty search path. Its passed-ID set does not itself bind the latest verifier receipt or prevent duplicate outcome IDs; application/worker fixes are necessary, with additional database defense still to assess. No deployed migration was changed.
- Anonymous verifier URL fetching and browser DNS/redirect enforcement still need security review. Original-file compare-before-replace also has a residual concurrent-writer window; do not broaden the narrow output-publication guarantee to all in-place writes.

## Reproduced verifier and repair failures / candidate repair

[Run 50](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41336480756), `94d7428`: all previous 32 JS tests PASS; 12 new JS failures (parent-suite failures included), plus all three real-worker regressions FAIL/ERROR. The hidden staging file was actually deleted; the second backup raised `output_exists`; duplicate predicates were reported as observed success. No expensive platform jobs ran on this failing preflight.

Candidate: one shared typed task-check validator requires unique IDs and each kind's actual parameters; a terminal verifier receipt must match the exact saved contract; website/app checks cannot grant themselves access. The independent worker separately refuses duplicate IDs. Repair uses unique temporary files and backup identities, one bounded content snapshot for the SHA/edit/backup, preserving unrelated hidden files and every original version. The general original-file check/replace concurrency window remains an explicit separate limitation.

Next: inspect the candidate preflight, apply cloud canonical formatting if required, fix any type/test failures, then await the entire six-job matrix. Only then refresh the existing 266/84/readiness ledgers. The customer-intent interpretation/anti-gaming problem is still PARTIAL: validated model-proposed checks alone do not prove their semantic agreement with the user's request.

## URL validation and isolated restore drill candidate

Runs 51/52 exposed a formatter-log fidelity problem: a synthetic credential URL was masked by the remote log path. The fixture now constructs userinfo at runtime; no masked log text is accepted as a literal test URL. A malformed HTTPS value also reached an unchecked `new URL` refinement and threw `TypeError`; the shared schema now returns validation failure and rejects userinfo. Regression assertions remain strict.

New cloud-only recovery test: `tests/jarvis/db/restore.sh`, with independent schema/data/sequence fingerprints and restored RLS/privilege assertions. It creates three fresh databases only inside the current job's declared PostgreSQL-16 Docker service, replays migrations and synthetic authority fixtures, dumps/restores, and requires a truncated archive to fail. It rejects execution outside that exact disposable CI context and cleans up only databases it successfully created. No hosted project, production data, credentials, external storage bytes or production infrastructure is accessed or qualified. This is newly authorized by the mission's disposable-database scope; the earlier blanket "owner approval" reason is stale for this isolated test.

Next candidate includes the restore drill. Platform jobs now wait for Linux build/database qualification as well as safety preflight, avoiding expensive runs when a deterministic Linux gate fails. Do not award a backup gate before its actual result; hosted/PITR/storage and incident-response qualification remain separate.

## Disposable recovery evidence verified

Run 53 Linux job `124940966490` PASS on `b4515dd`: 53/53 JS integration tests, build/source/protocol/no-hardcode/database gates, and the actual isolated restore drill. Schema/data/sequence fingerprints match; restored service-only settlement, denied client writes and tenant RLS pass; a truncated archive is rejected. Detailed hashes and scope: `codex-restore-b4515dd.json`. Fixture restoration completed within one whole-second clock interval; this is not a production RTO claim.

The existing 266 ledger now preserves historical status in its own column and makes the independent review explicit. Unreviewed historical PASS entries are PARTIAL until each clause is requalified. Current verified lower bound: 71/266 (26.7%); remaining 73.3%. This is audit freshness, not evidence of a product regression from Claude's historical 112. The 42-condition commercial score and 84 concepts are separate; neither is silently promoted.

Native and installer jobs for run 53 remain in progress. Wait for them before changing runtime/packaging again. Next packaging investigation: the installer carries an unused Chromium headless-shell payload, while its runtime launches a visible browser. Qualify a real bundled-browser launch and measure payload parity/size before removing anything. No current optimization claim is made.

## Full verifier / restore milestone closed

All six jobs of [run 53](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41337661535) PASS on `b4515dd`. 47 focused JS, 53 JS integration, 6 sandbox, 3 focused real-worker regressions; 60 companion tests discovered per OS (platform exclusions Linux/Windows 3, macOS 2). Frozen 939-file bundle and installer rebuilds are identical; install/repair/uninstall pass. Full machine-readable proof: `codex-safety-b4515dd.json`.

## Readiness integrity and packaging candidate

Run 54 `5dc845f` reproduced seven invalid-score cases; in particular one empty milestone earned 10% despite zero passing conditions. The score validator now requires ten unique milestones, all 42 nonduplicated conditions, real in-repository evidence files and explicit non-PASS reasons. This strengthens score integrity; it does not prove every condition's substantive truth. The file-protection condition is downgraded from PASS to PARTIAL; backup restoration is PARTIAL after the isolated drill. The commercial milestone score remains 20%, with 20/42 passing conditions.

Packaging candidate uses the supported `--no-shell` Chromium install: only the unused headless shell may disappear, and a real same-SDK full-versus-lean file/hash comparison must prove all retained browser files identical. New frozen checks launch the actual bundled browser with empty PATH against a random isolated fixture, both before and after installation. Measurements and results are pending; no size/speed gain is claimed yet. All artifacts remain unsigned/private test builds, never published.

Next: inspect the newest preflight; canonical-format the new readiness script/tests if needed, preserve failures and wait for the full matrix. A real frozen-browser failure must be investigated rather than weakening the fixture. Continue bounded read-only batching, source-write concurrency, semantic acceptance binding and network/SSRF review afterward.

## Measured packaging milestone verified

[Run 56](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41341255804), source `52396a3ff5167407d7bd1a792f179508502a02f3`: all six jobs PASS. 58 focused JS, 64 JS integration, 60 discovered companion tests per OS (documented exclusions unchanged). Same-SDK browser payload: 604 -> 314 files, 752,827,379 -> 461,909,478 bytes; 290 files / 290,917,901 bytes (277.4 MiB, 38.6%) removed. All retained runtime files are byte-identical; only the unused headless shell was removed. Built bundle 649 files; installed tree 651 including uninstaller metadata. Installer 221,537,774 bytes. Both rebuilds are identical. The actual bundled browser reads a random isolated fixture with empty PATH before and after installation. No task-latency improvement is claimed. Full proof: `codex-packaging-52396a3.json`.

## Next failing recovery / URL baseline

- A write can share a planner batch with reads/other writes without proven dependencies. Proposed correction: batch only independent read operations; plan every mutation from the preceding observed result.
- A resumed task can re-propose an unknown write. Minimal durable STOP records (`{"status":"unknown"}`) fail full-receipt parsing and are discarded from planner history. Proposed correction: shared supervisor unknown-effect fence and preserve the raw durable unknown marker; authority returns the task to waiting before any provider call. Independent per-effect/cross-task resolution is still a separate missing capability.
- Browser evidence truncates addresses; same-origin link metadata drops hash fragments. The URL guard strips fragments and treats unknown SPA routes as home pages. Proposed correction: compare complete observed locations including fragments; preserve complete in-limit link/page addresses and explicitly omit over-limit ones.
- New controlled-browser test must execute exactly once with zero skips. Synthetic provider/DB unit tests are negative safety checks, not real customer acceptance.
- The core journal/recovery conditions are PARTIAL pending this work. Commercial score therefore falls from 20% to 10% (18/42 conditions PASS), rather than keeping an unsupported historical score. G12/public launch remain NO-GO.
- Further source risk for the next pass: generic native UI activation/keys/point clicks are currently labelled reversible writes although they can trigger external/destructive effects. Assess fail-closed risk classification and generate protocol updates through the canonical generator; do not hand-edit the generated file.


### Cloud reproduction 57 — recovery and exact addresses (2026-11-01 UTC)

- Source `f3fadc4110a116b336612332fcabe390f2b9e345`; [run 41344044167](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41344044167).
- Focused JavaScript: 68 tests including parent suites, 59 passed / 9 failed. Seven adversarial cases failed plus their two parent suites: unobserved/different SPA routes; read→write, write→read, two writes; unknown write replanning; discarded minimal durable unknown marker. Independent-read batching and unknown-read recovery passed as controls.
- Required real Chromium/MCP address case ran (not skipped) and failed all three subcases: truncated page address, truncated link/missing fragment, and a misleading prefix for an over-limit link. Real-worker verifier/filesystem controls still passed (3 tests). TypeScript and readiness-contract checks passed. Source formatting failed separately; exact cloud formatting was collected. Dependent full jobs were intentionally gated off, not counted as passing.
- Candidate fix: preserve hashes and exact bounded observed addresses; explicitly omit over-limit URLs; batch only read-only operations; share an unresolved-effect fence between planner and authority, preserving raw durable unknown status without inventing receipt evidence. Unknown writes return the task to waiting before provider/queue/settlement calls. This is a conservative stop, not a completed effect-resolution experience or a database-level queue invariant. Read-only failures remain recoverable.
- Readiness stays **NO-GO / 10%** with journal and crash recovery PARTIAL; no customer replay, live Gemini accuracy, hosted deployment, or customer data was used.


### Qualified recovery/address source — run 58 (2026-11-01 UTC)

- Source `83f3142236e5d413e6f7520a7196632b3e4e0c62`, tree `501e455d98b83a557d22205eea730f5cf8699b8c`; [run 41344591917](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41344591917): **all six jobs PASS**.
- 68/68 focused JS; 74/74 Linux integration JS; six sandbox cases, three focused real-worker tests, one required real Chromium address case (zero skips). Companion: 61 discovered each on Linux/Windows/macOS, with only the explicit 3/3/2 platform exclusions.
- Frozen bundle 649 files; installed bundle 651 files / 676,797,728 bytes; installer 221,513,814 bytes, SHA256 `AEC097AC848FC8ADC55A668026A8927996AA1C181A9B065CAEA5AB6EE86355E0`. Both independent rebuild comparisons: zero differences. Bundled-browser nonce fixture passed before and after installation; install/diagnose/repair/uninstall preserved synthetic user files.
- Green exit codes do not mean empty error logs: the frozen web-worker smoke emits Python Proactor/subprocess closed-pipe destructor tracebacks, and one fixture HTTP keepalive connection reset. Log-bound follow-up is open; no clean-shutdown claim.
- [Machine-readable qualification](codex-recovery-83f3142.json). Disposable restore, build/type/lint/format/protocol/secret/hardcode guards, desktop/phone surface crawl and dependency audits passed.
- **Technical audited lower bound 71/266 PASS (26.7%), 195 not PASS (73.3%); commercial 10/100%, 90% remaining; conditions 18 PASS / 16 PARTIAL / 2 FAIL / 5 BLOCKED / 1 UNTESTED. Architecture: 42 PASS / 40 PARTIAL / 1 FAIL / 1 BLOCKED. NO-GO.** Historical 112/266 and live Gemini 27/36 are not fresh evidence.

### Next regression candidate — exact requests and typed workbook verification

- Source audit found mismatched budgets: composer 8000; server-function validator 1000; authority collapses whitespace and slices to 200; the journal title constraint is 200. This can discard the actual outcome, filename spacing or code indentation and can collapse distinct requests to one title. Candidate tests require exact 8000-character request preservation, nonempty/bounded rejection before DB/model, real built-page handoff/consumption on desktop and phone, and full service-only PostgreSQL lifecycle storage.
- Source audit also found that Python bool-is-int and string coercion can satisfy numeric workbook checks. A real workbook/MCP regression has four negative cases and three positive controls. Acceptance semantics remain independent of this scalar-type correction.
- The test-only candidate changes no runtime implementation. Focused red tests remain mandatory. To reproduce DB and built-UI failures despite a focused red, the Linux job temporarily runs after a failed preflight; Windows/macOS/installer remain gated off. Restore normal gating in the fix.
- The pinned Supabase CLI `2.122.0` generates the new objective-constraint migration in an **unlinked runner temporary directory**, emitting its exact filename/content. No hosted project, secret, schema, production data or personal computer is used. Official basis: [migration new](https://supabase.com/docs/reference/cli/supabase-migration-new), [pinned release](https://github.com/supabase/cli/releases/tag/v2.122.0).
- Prepared fix after actual red: one 8000-character request schema, exact internal whitespace, shared UI/server validation, complete journal constraint via the CLI-generated new migration; the bubble reuses the existing one-time memory handoff; exact numeric/string workbook verification without boolean/text coercion.
- Required continuation: inspect red logs and capture CLI-created migration; publish the complete fix; run focused + affected DB/UI + full cloud matrix. Investigate the frozen-worker shutdown separately; preserve all remaining release blocks.


### Run 59 — confirmed JS/scalar failures; DB/UI harness corrections required

Source `2c885d50024d92b4855adf353828ea2c7539847a`, [run 41346110582](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41346110582). Focused JS: 75 total / 68 PASS / 7 FAIL (six request cases plus parent). Linux JS integration: 81 total / 74 PASS / 7 FAIL. Real-workbook verifier returned true for all four incorrect boolean/text/numeric negative cases; three valid controls passed. The existing exact-address case ran and passed, while still emitting a real subprocess/Event-loop-is-closed shutdown traceback.

The DB request regression did **not** yet reach the old 200-character constraint: fixture setup attempted Auth writes as service_role and was correctly denied. Correct the test to create only its synthetic Auth/conversation fixtures as the database owner, then explicitly drop to service_role before the real enrollment/task lifecycle. Do not grant service_role new Auth privileges. The restore drill also reached this fixture error because it replays DB regressions.

The website regression also lacked a valid observation: verify:full stopped at formatting in the new JS test and ToRemove, so no build artifact existed and Wrangler could not serve. Apply the JS formatting and build on demand when .output/server/index.mjs is absent; preserve the failing standard format gate. Add ToRemove to cloud formatting evidence, then rerun the real browser cases. No DB/UI PASS or intended negative result is claimed from this run.

The pinned CLI successfully generated `supabase/migrations/20261101201849_preserve_complete_jarvis_objectives.sql` with the proposed bounded 8000-character constraint, in an unlinked runner temp directory. Its exact generated filename/content is captured and will be committed atomically with the runtime fix after red evidence. Existing migrations remain untouched.

Shutdown root cause: the real web worker starts a long-lived Playwright driver/context without a registered MCP server lifetime or failed-launch cleanup. New required real-browser lifecycle test first requires the actual registered lifetime, then will prove real page/context/driver release and cleanup after a failed executable launch. The test-only retry retains old runtime so this missing owner is an actual red. Docs checked against the pinned [MCP Python SDK 2.3.0 server lifetime](https://github.com/modelcontextprotocol/python-sdk/blob/v2.3.0/src/mcp/server/mcpserver/server.py). The MCP transport remains the process-tree/deadline owner; no second runtime or blanket exception suppression is planned.


### Run 60 — corrected DB/UI reproductions and lifecycle regression are genuinely red

Source `7f3188d99116dafcabefa77361e75a78b80f12d1`; [run 41346868376](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41346868376). The corrected synthetic setup now reaches the real **jarvis_tasks_title_check** 200-character rejection, both in the DB contract runner and restore replay. The built site served normally (12 desktop + 12 phone surfaces audited); all four new handoff value assertions failed on lost indentation/spacing or the 8000-character request being dropped. Required MCP/browser cases: address PASS, registered lifetime FAIL, zero skips. JS remains 75 total / 68 PASS / 7 FAIL focused, 81 total / 74 PASS / 7 FAIL integration; all four incorrect workbook scalar cases falsely passed, while three positive controls passed. Formatting is isolated to an extra blank line in ToRemove and exact canonical content is captured. [Machine-readable red evidence](codex-request-red-7f3188d.json).

### Complete candidate fix under cloud qualification

- One shared **8000-character** request schema across composer, server function and authority; reject empty/oversize input before DB/provider, normalize only surrounding whitespace, preserve the complete accepted request and exact internal code/filename whitespace. Query handoff preserves text and is consumed once. The signed-in bubble reuses the existing in-memory handoff instead of putting long/private request text into navigation URLs; this signed-in bubble path still needs authenticated workflow qualification.
- The new title-constraint migration uses the exact CLI-generated filename/content above. Existing migrations are untouched. Apply only to disposable runner DBs; no hosted/staging/production schema deployment.
- Workbook equality compares numeric values only with real numeric cells, string values only with strings; booleans never prove numeric checks. Existing numeric tolerance stays unchanged. This closes scalar false positives, not the still-open semantic acceptance/anti-gaming problem.
- The web worker registers the MCP SDK's real lifespan, closes all pages/context and stops the Playwright driver on shutdown, and releases partial startup state on failure/cancellation. Persistent profile data is retained. The existing MCP transport owns process-tree containment and shutdown bounds; no second runtime is added.
- Frozen-worker qualification now captures each real worker's stderr and **fails** on destructor/traceback diagnostics after transport closure, before printing success. The fixture handles only browser-abandoned speculative socket connections; the actual nonce HTTP request and DOM assertions remain mandatory.
- Restore normal preflight gating before expensive jobs; keep both required real-browser cases with a discovered-count guard of two and no skips. Correct the earlier counter expression that still expected one after adding the second case. Apply the cloud formatter's exact ToRemove text.
- Qualification pending for this candidate. Retain **71/266 audited PASS / 26.7%, commercial 10%, NO-GO** until actual results are recorded. The current qualified runtime remains source `83f3142` / run 58; test-only reds are not releasable heads.


### Qualified full-request, scalar and lifecycle milestone — run 61

Source `02ebc90d60051648c26cab5d9ae441581c8e689a`, tree `1ee86626f456abb09ee18c3726e74ea46e81a71c`; [run 41347623794](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41347623794): **all six jobs PASS**. 75/75 focused JS, 81/81 integration JS, six sandbox, four focused real-worker and two required real-browser cases (no skips). All four real built desktop/phone request handoff cases PASS. Real PostgreSQL service-only lifecycle preserves 8000 characters and rejects empty/over-limit requests; migration/restore replay and privilege/corrupt-archive controls PASS.

Companion suites discover 63 tests per OS, with only declared 3/3/2 exclusions. Log occurrence counts for destructor/closed-loop/closed-pipe diagnostics are zero on all three OSes, compared with the earlier source's Linux/Windows shutdown errors. This is a targeted cleanup result, not a soak or latency benchmark. The frozen/installed checks now enforce clean stderr for normal worker calls and pass. Frozen bundle 649 files / 672,136,296 bytes; installed 651 / 676,799,340; unsigned installer 221,515,842 bytes, SHA256 `9F8C4A6C3E2C21DDE650B08F45D793546BCB8EAAF92C54408FD40E2C7697EB81`. Bundle/installer rebuilds have zero differences; installation/repair/uninstall preserve unrelated synthetic user files. [Machine-readable evidence](codex-request-02ebc90.json).

Main was re-read and remains `e53725a25a48508b990135b93c0a6bfa555bb87e`; this session writes only the implementation branch. No hosted schema deployment, personal-PC product test, live provider call, spending, production/customer-data change, merge or payment/signing work occurred.

### Next confirmation-boundary adversarial candidate

Source review found that `exactEffect` clips JSON-serialized approval arguments to 4000 characters, despite valid commands/edits exceeding that after serialization. A customer can therefore approve a prefix while the suffix executes. New regressions compare full validated argument length/hash for commands, rewrites and edits, without executing any command or touching customer files.

Opaque native and page callbacks can also commit external changes: `apps.launch`, `ui.invoke`, `ui.set_value`, `ui.send_keys`, `ui.click_point`, `web.fill`, `web.select`, `web.download` are currently labeled reversible_write. New typed-intent/shared-worker-protocol tests require external_effect for these generic interactions; read/new-output controls remain unchanged. This is an adversarial policy-contract audit, not live native side-effect/customer proof. It does not solve all site scripts, irreversible actions, dependency trust or semantic acceptance.

The next commit adds tests only and downgrades unproven #151/exact-approval status. A failure-only **cloud generation** step edits the candidate risk declarations temporarily, runs the existing canonical protocol generator and prints the exact candidate source/protocol. It restores both branch files in finally before other gates; there is no runtime/test-ID shortcut and no fabricated green. Capture these real generator outputs; publish the complete source/protocol pair and untruncated approval fix; remove the one-time generation step; run focused, affected integration and the full matrix. Never hand-edit generated protocol.json.

Architecture #55 is now PARTIAL: a waiting fence and retained unknown marker do not implement independent effect resolution. **Current conservative audit: 70/266 PASS (26.3%), 159 PARTIAL, 14 FAIL, 5 BLOCKED, 18 UNTESTED; 196/266 (73.7%) not PASS. Commercial 10/100%, 90% remaining; conditions 17 PASS / 17 PARTIAL / 2 FAIL / 5 BLOCKED / 1 UNTESTED. Architecture 41 PASS / 41 PARTIAL / 1 FAIL / 1 BLOCKED. NO-GO.** This is a retraction of insufficient proof, not a claim that historical software disappeared.

The signed-in bubble handoff and full authenticated customer pipeline remain unqualified; no real-Gemini success-rate remeasurement is claimed. Continue semantic acceptance/anti-gaming, original-file/directory races, verifier web transport, effect resolution, provider recovery, dependencies/updater and representative hardware work after these critical boundaries.


### Confirmation red — run 62

Source `20f3f468b641f6bd2b73a627ea0e7bd895a76e25`; [run 41349211612](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41349211612). **89 JS tests: 76 PASS / 13 FAIL**, comprising eleven adversarial subcases plus two failing parents. All three complete-argument cases (command/replace/edit) lose characters; all eight opaque interaction declarations fail the conservative external-effect boundary. Read/new-output controls PASS. Existing four real-worker checks and two required browser cases PASS; TypeScript PASS. Formatting failure is isolated to the new test and the exact cloud formatter output is captured. The full matrix was intentionally gated off on this expected red.

The failure-only cloud candidate step successfully generated the exact updated typed contract and Python protocol with the canonical generator; both branch files were restored before later gates. The next complete candidate commits that generated source/protocol pair together, removes the 4000-character approval clipping, applies the actual formatter output, and removes the one-time generation step. All eight interactions now enter the existing one-use confirmation queue through external_effect; no new consent authority, application special case or model brain is added. File reads and new-output controls preserve their established risk declarations.

Qualification pending; do not label the new branch head release-ready. Conservative #151/exact-dialog status remains PARTIAL until the complete authenticated UI/consent path is qualified. Existing typed-intent tests cover policy metadata; they are not a real external transaction/customer claim. No operation or provider limit was bypassed.


### Run 63 — approval logic passes; installed fixture cleanup does not

Source `43c50ed87178bc6474a0464d5324689a707e86f9`; [run 41349526739](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41349526739): **five jobs PASS, Windows installer FAIL**. 89/89 focused JS and 95/95 integration JS; four MCP-worker checks, two browser cases, four built handoff cases, DB/restore and all three 63-test companion suites passed. Protocol drift check and both independent bundle/installer byte-rebuild comparisons passed.

The installed real browser did make the required nonce HTTP request/read and workers completed without destructor diagnostics. The checker then failed deleting its own temporary profile: WinError 32 on `Default/Sessions_Encrypted/Tabs_...`. The install/repair/uninstall lifecycle was not completed and this is **not** a fully qualified source. The original file-lock owner was not captured, so do not assert that it was a surviving Chromium process or an antivirus scanner. Last fully qualified source remains `02ebc90` / run 61.

Windows process termination is asynchronous and completion requires waiting on a retained process handle; a parent/transport return alone is insufficient proof that descendants and file I/O are quiescent. Basis: [TerminateProcess](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-terminateprocess), [WaitForSingleObject](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-waitforsingleobject), plus pinned MCP SDK 2.3.0 stdio shutdown implementation. This explains the missing qualification barrier; it does not identify the original lock owner.

### Candidate: explicit fixture process quiescence before profile cleanup

- Capture stable SYNCHRONIZE handles while the fixture browser is live, for processes whose command lines contain the exact isolated profile plus their descendants/ancestors up to the checker. Print only counts/PIDs and measured wait duration, never command lines or secrets. Wait at most five seconds after SDK closure; surviving processes remain a fatal test error. Close every native handle. Do not terminate unrelated processes or change product permissions.
- Validate the resolved temporary directory is a direct child of the OS temp directory with the explicitly owned `ocade-frozen-` prefix before recursive cleanup. Only after normal completion/owned-process quiescence may Windows sharing errors 32/33 receive bounded cleanup attempts (five seconds total). All other errors and persistent locks still fail; `ignore_cleanup_errors` is not enabled. Emit actual removal/retry evidence.
- Add a **required native Windows regression** that starts its own disposable child holding a real file, proves that waiting times out and deletion is denied while it is alive, then releases it and proves native handle signaling/file deletion. Linux/macOS explicitly report this Windows-only test as skipped; Windows must execute it. No fake browser success, provider call, customer data, personal PC or production deployment.
- Re-run the full mandatory matrix. Keep #151/exact-dialog and all prior release blockers PARTIAL; approval correctness has only partial full-matrix qualification until the installer succeeds. Current audited lower bound stays 70/266 (26.3%), commercial 10%, **NO-GO**.


### Qualified approval/quiescence milestone — run 64 (recorded 2 November client date)

Source `654af50c5ebce7affc872227abfdb826f63ea5f6`, tree `5e7bbada7246f088c76a0f391d7c8a145796dad4`; [run 41352301838](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41352301838): **all six jobs PASS**. 89 focused JS and 95 integration JS PASS, six sandbox/four focused MCP/two required browser cases, four built handoff cases, real DB/restore and 64 companion tests per OS (explicit skips Linux 4, Windows 3, macOS 3). Native Windows held-file/process wait regression ran and passed.

Frozen and installed browser checks independently retained 12 and 13 owned process handles, observed all signaled before success, removed their fixture directories, and needed **zero** sharing retries in this run. The original run-63 lock owner remains unknown; no scanner/Chrome attribution is inferred. Strict worker stderr, 649-file bundle and installer byte-identical rebuilds, and installation/diagnosis/repair/uninstall passed. Installed bundle: 651 files / 676,799,332 bytes. Installer 221,551,373 bytes, SHA256 `430C8C93B3D0DE1BAFD9B8403EB7978976F88A048F74DB14D9BC491B9E61402A`. [Machine-readable evidence](codex-approval-654af50.json).

The user's latest instruction is to continue until the 100% target genuinely works. All prior branch/main/production/spending/personal-PC and architecture-first boundaries remain in force. Continue autonomous engineering; no scheduled continuation has been created. Current audit stays 70/266 PASS (26.3%), commercial 10%, architecture 41/84 PASS, **NO-GO**; green component tests do not close unqualified requirements.

### Next adversarial candidate — truthful partial effects and native dispatch/readback

- A same-path DOCX/PDF request can pass both per-path prechecks, publish a DOCX, then refuse the second output. New real-MCP test requires distinct resolved destinations to be rejected before publication.
- Gateway currently reports a refused write as not_applied with maybeChanged=true; supervisor ignores that contradictory effect signal. A real browser download fixture will witness one actual HTTP request, create an independently owned competing destination during that request, verify its bytes survive, and require unknown rather than not_applied after publication is refused. A pure precondition refusal must accurately report maybeChanged=false. New planner/authority cases cover contradictory and minimal durable records before any provider/queue call.
- Windows invocation currently catches errors around both the mutation and its readback, then tries another pattern; a failed provider can therefore trigger multiple mutations under one approval. The long-value matcher compares only 200-character previews, and per-call CoInitialize is not balanced. Windows-only deliberately failing provider/real COM-thread regressions cover single dispatch, complete value comparison and balanced native setup. These are isolated negative contracts; real native app/lease tests remain required and unchanged.
- Add a short **Windows native safety preflight** (three new cases + the real process/file-holder case; exact count four, no skips), before expensive build/matrix jobs. Linux/macOS explicitly exclude these Windows API cases; Windows must execute them. This avoids spending a full installer/native matrix on a known native contract failure.
- First reproduce the failures on this test-only candidate. Then implement the smallest shared refusal/effect tracking fix, preserve uncertainty through Gateway/journal/authority/planner, preflight output aliasing, stop native mutation fallback after dispatch, compare full values, and balance COM. Keep the single generated protocol/gateway/brain and all permissions/STOP guards; do not invent timestamps or proof.


### Run 65 — effect/receipt red evidence and one incomplete fake corrected

Source `9dd15c9cf64edc03521e1f6ae962998d3ed36fb3`; [run 41369723137](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41369723137). JS 93 total / 88 PASS / 5 FAIL (four new uncertainty cases plus parent). Real MCP: 6 tests, aliased document destination failure reproduces actual premature publication. Required real browser: 3 tests, download race genuinely witnesses one network effect/preserves competing bytes but receives not_applied instead of unknown. Windows safety: full-value false positive and unbalanced real COM initialization fail; process quiescence control passes.

The Windows invoke fake lacked is_enabled(), so that case errored before the intended dispatch and is **not yet proof** of pattern fallthrough. Add the missing true enabled property to this deliberately failing provider; production enabled checks remain. The pure-path test used ../outside and stopped at Gateway schema validation; strengthen it to a valid-shaped OCADE output/../outside.txt so it reaches the actual worker's path refusal. Keep the assertions and every security guard. Apply actual cloud formatting to the new recovery test/workflow, then rerun old production code before integrating fixes.

Three specialized sub-agents are now working in parallel under the user's explicit request: worker effects/gateway, native control, server recovery. Only root updates implementation refs; proposal trees have no ref changes. Independent cross-review follows before the full mandatory seven-job matrix (new short Windows safety preflight included). No source/runtime claim follows from an incomplete fixture.
