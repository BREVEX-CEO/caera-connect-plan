# Local STOP during a claim — 5 November 2026

A new, independent regression invalidates the previously earned M2 STOP
condition. Readiness is temporarily 10/100 (M1 only), 18/42 conditions PASS.
Requirements 88 and 216 are retracted to PARTIAL (77/266 PASS); concept 57 is
PARTIAL (44/84 PASS). Denominators are unchanged. Raw historical test/evaluation
artifacts remain untouched; a new independent architecture snapshot records
the retraction.

Tests-only candidate b454ea08 in run 41900561913, Linux job 126821515464,
prewarms the actual filesystem MCP worker, writes local STOP while a claim is
in flight, and returns a valid action from that claim. The old loop dispatches
it before looking at STOP again. The independent filesystem probe reports:

    OCADE_LOCAL_STOP_CLAIM:{"dispatches":1,"outputCreated":true,"journalStarted":true}

The same required module also reproduces a socket TimeoutError escaping the
claim retry loop. Ten test methods remain required; neither the exact count nor
any existing case was removed. The first STOP fixture used a role where the
loader expects a module; that earlier failure is not claimed as STOP proof.

The candidate rechecks local STOP immediately after the claim, before dispatch,
and normalizes transport/unreadable-response failures to the existing retry
path. A resumed claim receives the same bounded planning-turn transport budget
as a receipt. The injected socket-timeout and real warm-worker cases pass in Linux
preflight at candidate 23efef02 (run 41900570544); the full platform matrix is
pending. No task deadline or evaluation timeout is extended.

M2, requirements 88/216 and concept 57 may be restored only after the repaired
control path passes the required Linux, Windows and macOS qualification. The
coherent repair is included with this assessment. D22/D23 remain open
until that proof is recorded and the coherent repair is committed.