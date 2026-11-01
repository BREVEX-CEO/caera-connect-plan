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

Candidate fixes are awaiting cloud results; do not mark their requirements PASS yet. The old #53 PASS evidence was incomplete and is invalidated by the red reproducer until the repair passes.

1. Inspect the newest JARVIS cloud validation run for this branch. If preflight formatting fails, take canonical formatting from its `OCADE_FORMAT:` JSON log records and commit those exact texts; rerun the required matrix.
2. Investigate actual failures; never rerun unchanged failures to hunt for green.
3. After the matrix passes, record exact SHA/run/test counts here, update the existing requirement audit and architecture evidence, then continue binding verification/anti-gaming and provider recovery.
4. The verifier's anonymous URL fetch and the browser request guard need SSRF/redirect/DNS review. This is an unverified source concern, not a claimed exploit or completed fix.
5. Continue the existing P00–P22/266 backlog. Dependency installation, updates, exact target grounding, platform qualification and the >=90% unseen-task gate remain incomplete. Architecture G12 and public launch remain NO-GO.
