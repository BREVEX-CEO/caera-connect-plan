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
