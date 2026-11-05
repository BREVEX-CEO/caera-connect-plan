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
