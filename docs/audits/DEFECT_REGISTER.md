# Current root-cause disposition — 28 October 2026

Starting source `71e8b637a5f723a33593a39f73d6cccd3573e945`. This is a derived repair/evidence view of [plan.md](../../plan.md) and [BLOCKED_TESTS.md](../../BLOCKED_TESTS.md#cloud-safety-continuation--28-october-2026), not another work authority. Owner: OCADE principal engineering team. Status language distinguishes source, mock and real qualification.

| ID | Current evidence class | Repair / remaining requirement |
| --- | --- | --- |
| RC01 | CODE EXISTS; SOURCE REVIEWED; RUNTIME BLOCKED | Agent outbox now ≤20 results and ≤600,000 encoded characters; small control envelopes, sent-only ACKs, durable unsent results, optional hasMoreResults and no new server admission while draining/control. Seven agent/journal and five PostgreSQL cases added but UNRUN. Oversized/schema-invalid results and mixed-version/claimed-TTL behavior still need qualification. |
| RC02 | FAIL; REMEDIATION BLOCKED | Pillow 12.3.0 is affected by official advisories, including GHSA-v9pv-5gc8-w2m6 (patched 13.0.0); no OCADE exploit proved. No blind major-version bump without cloud Python/platform compatibility tests. |
| RC03 | FAIL; REMEDIATION BLOCKED | pypdf 6.19.0 is affected by later parser/resource advisories; upstream 6.21.3 fixes newest verified issues. No exploit proved; dependency upgrade, parser isolation and bounded hostile-file tests remain. |
| RC04 | ADAPTED JS PASS; NATIVE BLOCKED | Normalized upstream IDs/shim paths and slash-delimited source boundary; exact transform hooks tested with fixtures. Native Vite/esbuild Windows build UNRUN. |
| RC05 | ADAPTED CONTRACT PASS; NATIVE BLOCKED | Launch local pinned Prettier bin with process.execPath and createRequire, no shell or npx. Actual Windows process launch UNRUN. |
| RC06 | ADAPTED JS PASS; REAL PROVIDER BLOCKED | Dedicated billing-read credential at both eligibility checks; inference credential stays inference-only. Both required. No secrets/deployment/live provider calls. |
| RC07 | BLOCKED | No deployment changed; current staging does not qualify new candidate. Immutable web/service/agent/schema/runtime parity and rollback remain unproved. |
| RC08 | FAIL | Computer._file discards cancel before _deliver; urlopen timeout600 and reply.read are blocking. Real stalled-transfer reproduction and cancellable transport repair need cloud Python/HTTP execution. |
| RC09 | FAIL; OWNER CONFIG BLOCKED | Live read-only advisors confirm leaked-password protection disabled on staging and production. Owner approval/settings eligibility needed; unchanged. |
| RC10 | EXACT SOURCE MOCK PASS; BROWSER BLOCKED | Exact/auth and descendants bypass cache; cache version18 clears old shell. 20 mocked-event cloud cases pass, including offline/online and boundary controls. Real service-worker lifecycle UNRUN. |
| RC11 | SOURCE RISK; BLOCKED | Quoted-data command filter needs structured parsing with injection/escape tests before changing its security contract. |
| RC12 | FAIL SOURCE CONTRACT; BLOCKED | Computer.capabilities reports broad booleans; no proven operation-health admission across requested conversions/recalculation/codecs. No new speculative registry added. |
| RC13 | FAIL overall; extracted-source checks PASS; full execution BLOCKED | 71 controlled fixtures pass vs30/71 baseline: exact sheet identity, stale/recreated proof, malformed latest receipts, finite measurements/counts and valid file metadata.93 full verificationGap Vitest cases UNRUN. General semantic/visual/customer-oracle qualification remains open. |
| RC14 | BLOCKED | Formula expressions alone are not recalculated values. Native/calculation-engine and independent numerical oracle tests unavailable. |
| RC15 | FAIL SOURCE CONTRACT; NATIVE BLOCKED | Windows workspace mode checks argv paths but task scripts execute with user process access; Linux OS confinement parity is absent. Existing scripts can run without per-command confirmation. No exploit run. |
| RC16 | HYPOTHESIS; BLOCKED | No native Windows special-path FFmpeg subtitle reproduction; no speculative escape patch. |
| RC17 | PARTIAL SOURCE REPAIR; NATIVE BLOCKED | Reject same-title duplicate windows/UIA matches; close unique window only; require nonzero HWND, verify focus HWND and stale screen HWND.17 synthetic tests added UNRUN. PID/start-time/document/task lease and final-effect races remain open. |

Official dependency evidence, retrieved 28 October 2026: [Pillow critical advisory](https://github.com/python-pillow/Pillow/security/advisories/GHSA-v9pv-5gc8-w2m6), [Pillow13 release compatibility](https://pillow.readthedocs.io/en/stable/releasenotes/13.0.0.html), [pypdf6.21.3 release](https://github.com/py-pdf/pypdf/releases/tag/6.21.3), [encrypted-PDF exhaustion](https://github.com/py-pdf/pypdf/security/advisories/GHSA-62m5-6wh8-28x7). These establish dependency risk, not an OCADE exploit.

Every changed contract preserves originals and receipts. Rollback: revert the introducing implementation-branch commit after reviewing subsequent concurrent changes; no deployed/cloud state was modified. No code removal/dependency change is claimed to improve performance. First dependency-ready verification is the unrun RC01/RC17 Python and PostgreSQL regression set in an authorized free cloud runner; RC02/03 and RC08 remain critical work before expansion.
