# Evaluation oracle credential isolation (D27)

The Python evaluation helper dropped from the root server user to `ocadelive`
without clearing its environment. The independently launched port-conflict
fixture inherited the same environment. A model-repaired program rerun by the
oracle could therefore read the staging server credential. The Node companion
launcher already used a filtered environment; that did not protect these
Python subprocesses.

The completed E1 used the affected helper. No actual credential was read or
printed in this investigation, and no exfiltration was observed. Those facts
cannot establish that the credential was inaccessible. Treat the staging
credential as exposed to the evaluation programs and replace/revoke it before
another credentialed evaluation. Production was never used.

## Reproduction and repair

- Tests-only candidate `f2de6e3650ca484bae491db14c075665d690b700`,
  [run 41915577409](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41915577409),
  Linux job 126874225059, fails the actual root-to-user canary assertion:
  `True is not false : the oracle inherited a server credential canary`.
  The job later timed out during setup; the preceding assertion is the
  reproduction, not evidence of an otherwise successful job.
- Minimal repair `3e25c629f0293e1535821c8a46599afcbfd0f61c`,
  [run 41969374857](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41969374857),
  Linux preflight job 127053792299 passes all 122 Node subtests, including
  the isolated Python canary. Its wrapper requires exactly one Python test,
  zero skips and success. Formatting and readiness checks pass. The checkout
  SHA is verified in the job log; workflow dispatch metadata alone is not proof.

The canary uses a synthetic value only. An ordinary runner starts a root
Python helper with sudo; that helper invokes the real `run_as_user`; the child
writes only its effective UID and a boolean indicating credential presence.
The UID must equal the original ordinary runner's UID and the boolean must be
false. No credential value is written. The same bounded positive environment
filter now protects the oracle, the fixture, tar and chown subprocesses before
privilege changes. The trusted root authority process retains its server
credentials intentionally.

## Remaining gate

The agent has no authorization to rotate secrets. The owner must replace/revoke
only the affected staging credential and save its replacement as environment
secret `SUPABASE_SERVICE_ROLE_KEY` in the existing GitHub environment also named
`SUPABASE_SERVICE_ROLE_KEY`. Do not paste it into chat. This is a newly discovered
isolation defect, not a missing-secret configuration issue. No new live E1/UI
run is permitted until that owner action is confirmed. D27 remains open until
replacement and the credentialed isolation smoke are verified. No readiness,
requirement or architecture PASS is earned by this repair alone.

## Owner replacement response

On 5 November the owner reported "staging replaced". GitHub's write-only secret
metadata still reports `updated_at: 2026-11-04T14:27:23Z` for the environment
secret; the other staging environment has no secrets. Secret values were not
retrieved. Revocation is owner-confirmed, not independently verified. The
protected `isolation` campaign first checks staging admin authentication using
the shared header bridge, then runs the actual Python privilege-drop helper.
It records only effective UIDs and credential/canary presence flags, and applies
the existing credential scan before artifact upload. It makes no model call and
creates no task. D27 stays open until this smoke is verified; no new E1 campaign
has been launched with the replacement yet.
## Protected credential smoke passed

[Run 41972053886](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41972053886),
job 127062417973, passes at published `c6858ce9bbb33cf726be67ab5f204470e01bc5b8`.
The actual staging admin request succeeds using the saved credential. The
root server has UID 0; the ordinary companion identity has UID 1002 and reports
both `serviceCredentialPresent: false` and `serverCanaryPresent: false` through
the real Python helper. Artifact 13389733330 passes the credential scan.
The original `commit.txt` and `isolation.json` are retained under
`protected-smoke/`; their fields were independently compared with the job log.
No actual key was retrieved or printed. This smoke creates no task and makes
no Gemini call. The code boundary is repaired and verified. Old-key revocation
remains owner-confirmed rather than independently verified; the unchanged
GitHub metadata is retained above. Live evaluation can now resume after the
application changes finish their cloud qualification. This closes D27's known
inheritance defect without claiming the entire M8 secrets-isolation condition.