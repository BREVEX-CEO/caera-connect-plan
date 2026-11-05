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

Candidate 26ec426b has passed Linux preflight/core, the Linux/Windows 2022/2025
168-test suites, macOS ARM64, and Windows installer qualification in run
41971524885. Intel's unrelated render/popup failures remain recorded as D28/D29;
the full matrix is not green. Its repaired verifier and harness can be retested
on the isolated Linux staging runner while those independent defects are fixed.
The source tree is frozen for each run; in-flight evaluations are never edited.
