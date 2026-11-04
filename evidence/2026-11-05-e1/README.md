# Full E1 at 00cbd9e — independently audited 5 November 2026

The complete paced campaign ran all 48 instances, seeds 22–24 and 16 families,
on a disposable Linux Actions runner. It failed acceptance. No readiness,
requirement or concept PASS is promoted by this campaign.

- [Run 41859445291](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/41859445291)
- Tested commit: `00cbd9e6a6bd04d487afe6f14acc252fe3b2bcc7`.
- Credential-scanned artifact: `13362802482`, 121,071 compressed bytes.
- `raw/` preserves the downloaded 48 task reports, three original summaries and
  commit marker. `audit.json` records SHA-256 hashes of every raw file.

| Measure | Result |
|---|---|
| Original hidden-oracle passes | 35/48 (72.9%) |
| Authority reports completed | 31/48 (64.6%) |
| Both completed and hidden oracle passes | **27/48 (56.25%)** |
| Strict successes by seed | 22: 11/16; 23: 9/16; 24: 7/16 |
| Recorded gaming events | 0 over all 48 instances |
| Target-choice attempts | 0 across three release-pick cases |
| Target-selection accuracy | Unmeasured; no denominator of observed choices |

The old harness counted an oracle pass even when the authority was blocked,
waiting or still running. Eight such oracle passes do not establish completion.
The independent audit reads each original summary's oracle result and its
separate task report's status; success requires both oracle=true and
status=completed. Original results remain unchanged. The corrected harness
keeps oracle and completed counters separate.

## Observed failures and ownership

- Four completed tasks fail the hidden oracle: config_repair in seeds 22/23,
  port_conflict in seeds 23/24. Seed 22's port task also fails while running.
- The repaired scripts in seeds 22/23 contain a literal backslash-n in their
  shebang. `script_runnable` accepts the text because Python compilation treats
  that line as a comment. The actual independent invocation exits 1. Interpreter
  validation and a confirmed-invocation goal regression are required (D25).
- The CLI calls local STOP before returning its report. STOP correctly ends
  owned jobs. In seed 23 the task's actual curl receipt contains its expected
  board response, but the later hidden oracle sees the stopped service. This
  timing defect needs an independent pre-teardown probe; it does not retroactively
  turn a failed raw oracle into a PASS (D26).
- Four correct Office outputs remain blocked by unobservable file_parses
  predicates. Independent OOXML-reader regression/fix is in qualification.
- Two web-fact instances produce the expected note but remain blocked by a
  source-page predicate. Goal compilation must check the requested deliverable.
- All three release cases stop before any download. The fixture also serves
  plain text as application/zip and does not configure the checked Node
  transport's CA. Real archives, proper fixture trust and ZIP verification are
  in qualification; the original denominator remains 48 (D26).
- Busy waits and unfinished tasks remain failures. Claim transport recovery
  has a published repair, but these families require live retesting. Provider
  capacity is not assumed solved and no key is rotated.

The first new runtime-fixture regression failed before its assertions because
the standard-library preflight had no Playwright. That run is not fixture proof.
The regression now belongs to the runtime-equipped Linux phase and forbids
skips. Both the companion suite and fixture must pass; either failure fails the
phase. Full E1 and target accuracy remain below their acceptance conditions.
