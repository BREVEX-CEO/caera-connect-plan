# E1 repair retests

No new task success is claimed here yet. The full historical 48-task E1 remains
27/48 strict first-attempt success at 00cbd9e; its raw evidence is unchanged.

The protected manual workflow now accepts an immutable candidate SHA and an
optional named-family selection. A secrets-free registration job verifies the
exact checkout, implementation-branch binding and ancestry before the protected
server job can start. The root server step remains staging-only and the ordinary
companion/oracle environment filters remain required. Artifacts are labelled
with the tested candidate and contain its actual checkout SHA.

The intended first retest covers config_repair, port_conflict, web_fact,
release_pick, editable_totals and report_headings at seed 22. This is six known
regression families, not full or unseen E1 qualification. All 48 paced tasks at
one commit remain required for the full requested campaign. A partial result
cannot earn a 90% unseen-success PASS. Readiness updates also wait for CI.

The unpublished integrated repair was not adopted. Its test results do not
establish verifier or harness completion on the implementation branch. Those
coding obligations remain open; no staging retest is started by the coding audit.
