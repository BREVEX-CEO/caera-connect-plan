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
