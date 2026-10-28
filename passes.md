# OCADE — independently verified narrow passes

Audit date: 2026-10-28 UTC. Exact product source: **8acf290b27526cf2bf7abdb098769d24bbccbadf**, branch **ocade/p00-p22-implementation**, repository **BREVEX-CEO/caera-connect-plan**. Base tree: 78f46bb9ea3c01d61b9e1d47e15a08d9152cb1e2. The later report-only commit does not change tested product source.

Latest instructions supersede plan.md's older PC-only campaign: **cloud-only, $0 checks only, testing only**. No owner Windows PC, personal browser, desktop agent, local server, local files or local process was accessed after that instruction. No product/workflow/dependency/schema/configuration fix, installation, deployment, service shutdown, credential change, purchase, task rescue or merge was performed. Only these three Markdown reports are authorized for branch publication.

Current methods: remote GitHub source/API reads; read-only authorized Supabase staging queries; read-only Cloudflare resource metadata; free TinyFish Fetch; isolated V8 function/predicate probes in functions.exec. V8 is not a cloud OS/browser, Python, Vite, Playwright or native Windows runtime. Supabase staging is a separately observed environment, **not attested as the exact candidate deployment**. Production pages/old deployment were not used as candidate tests. No real inference calls were made.

Counts are from [testing results.md](testing%20results.md): **81 discrete checks:49 PASS,11 FAIL,7 PARTIAL,14 BLOCKED,0 UNTESTED;67 assessable completed checks.** The separate227 requirement mappings have0 PASS,4 FAIL,18 PARTIAL,203 BLOCKED,2 UNTESTED. Do not add these overlapping registers. No real JARVIS/cloud-browser/native workflow, provider inference or offline generation executed. Real AI calls0; task timing/CPU/RAM unmeasured; no candidate screenshot available.

## What these49 passes establish

Only the49 PASS rows from the discrete audit ledger appear here. Metadata/source assertions and synthetic V8 function results retain their narrow scope. **No new real-device, browser-journey, real-model, offline-inference or JARVIS-task PASS exists in this cloud audit.** Existing old-code/dirty-local results are excluded. Failed, partial, blocked, hypothetical and unexecuted tests are not credited.

All rows inherit source 8acf290b27526cf2bf7abdb098769d24bbccbadf, audit date2026-10-28 and0 real model calls. Staging row/catalog results apply only to the observed staging snapshot. Per-check CPU/RAM/task timing was not instrumented; the only separate service latency is the BoldChess prerequisite Fetch6259.455ms. No candidate screenshots were available, and no screenshot is implied.

| ID | Verified assertion | Environment | Actual evidence | Timing | Evidence key |
| --- | --- | --- | --- | --- | --- |
| ENV-01 | Exact implementation ref | GitHub read-only source at 8acf290b27526cf2bf7abdb098769d24bbccbadf | Branch resolved to 8acf290b27526cf2bf7abdb098769d24bbccbadf; tree 78f46bb9ea3c01d61b9e1d47e15a08d9152cb1e2. | Not instrumented separately | E-VERSION |
| ENV-05 | $0 tool contract and balance | TinyFish wallet metadata | Fetch/Search rates $0; automation rates metered and not used. Balance remained USD 10; auto-reload unconfigured. | Not instrumented separately | E-COST |
| ENV-06 | Report push deployment triggers | GitHub read-only source at 8acf290b27526cf2bf7abdb098769d24bbccbadf | Production deployment/offline publication are manual approval workflows; CI push restricted to main and ignores Markdown. No workflow dispatched. | Not instrumented separately | E-WORKFLOWS |
| DB-01 | RLS enabled on public tables | Staging Postgres metadata | 42/42 public tables have RLS enabled; this does not prove every policy/mutation. | Not instrumented separately | E-RLS |
| DB-02 | Foreign-row SELECT isolation | Staging Postgres READ ONLY transaction + authenticated role | Synthetic foreign JWT subject sees 0 owner rows across profiles, conversations, devices, tasks, Library items and messages. | Not instrumented separately | E-RLS |
| DB-03 | Owner-row positive controls | Staging Postgres READ ONLY transaction + authenticated role | Owner subject sees counts 1 / 16 / 2 / 13 / 1 / 53 respectively; baseline nonempty. | Not instrumented separately | E-RLS |
| DB-04 | Role lookup isolation | Staging Postgres READ ONLY | has_role(other-user,'admin') returned false under nonstaff subject. | Not instrumented separately | E-RLS |
| DB-05 | Sensitive table privileges | Staging Postgres catalog | anon permit SELECT=false; authenticated permit SELECT=false; authenticated recovery-code SELECT=false. | Not instrumented separately | E-PRIV |
| DB-06 | Server-only permit RPC privileges | Staging Postgres catalog | Three exact permit RPCs deny EXECUTE to anon and authenticated (6 privilege checks). | Not instrumented separately | E-PRIV |
| DB-07 | Nonstaff permit settlement refusal | Staging Postgres READ ONLY synthetic actor | Direct call with a nonexistent synthetic permit was refused SQLSTATE 42501; rolled back. | Not instrumented separately | E-PRIV |
| DB-08 | Nonstaff device removal refusal | Staging Postgres READ ONLY synthetic actor | Direct admin-remove RPC on all-zero device refused SQLSTATE 42501; rolled back; no device changed. | Not instrumented separately | E-PRIV |
| DB-09 | Private staging storage buckets | Staging storage catalog | library and messenger public=false; size limits 104857600 and 26214400; no file contents read. | Not instrumented separately | E-STORAGE |
| HIGH-01 | valid_free | Isolated functions.exec V8; source expression/function only; synthetic input | Expected true; actual true. | Timer resolution insufficient for meaningful duration | E-HIGH |
| HIGH-02 | missing | Isolated functions.exec V8; source expression/function only; synthetic input | Expected false; actual false. | Timer resolution insufficient for meaningful duration | E-HIGH |
| HIGH-03 | paid | Isolated functions.exec V8; source expression/function only; synthetic input | Expected false; actual false. | Timer resolution insufficient for meaningful duration | E-HIGH |
| HIGH-04 | trial | Isolated functions.exec V8; source expression/function only; synthetic input | Expected false; actual false. | Timer resolution insufficient for meaningful duration | E-HIGH |
| HIGH-05 | duplicate_workers | Isolated functions.exec V8; source expression/function only; synthetic input | Expected false; actual false. | Timer resolution insufficient for meaningful duration | E-HIGH |
| HIGH-06 | billable_component | Isolated functions.exec V8; source expression/function only; synthetic input | Expected false; actual false. | Timer resolution insufficient for meaningful duration | E-HIGH |
| HIGH-07 | missing_components | Isolated functions.exec V8; source expression/function only; synthetic input | Expected false; actual false. | Timer resolution insufficient for meaningful duration | E-HIGH |
| HIGH-08 | failed_envelope | Isolated functions.exec V8; source expression/function only; synthetic input | Expected false; actual false. | Timer resolution insufficient for meaningful duration | E-HIGH |
| HIGH-09 | empty_result | Isolated functions.exec V8; source expression/function only; synthetic input | Expected false; actual false. | Timer resolution insufficient for meaningful duration | E-HIGH |
| HIGH-10 | malformed_entries | Isolated functions.exec V8; source expression/function only; synthetic input | Expected false; actual false. | Timer resolution insufficient for meaningful duration | E-HIGH |
| SESSION-01 | 401 retryable timeout rejected | Isolated functions.exec V8; source expression/function only; synthetic input | Input {"status":401,"name":"AuthRetryableFetchError","message":"timeout"}; expected false; actual false. | Not instrumented separately | E-SESSION |
| SESSION-02 | 403 rejected | Isolated functions.exec V8; source expression/function only; synthetic input | Input {"status":403}; expected false; actual false. | Not instrumented separately | E-SESSION |
| SESSION-03 | 429 retryable rejected | Isolated functions.exec V8; source expression/function only; synthetic input | Input {"status":429,"name":"AuthRetryableFetchError"}; expected false; actual false. | Not instrumented separately | E-SESSION |
| SESSION-04 | 502 retryable rejected | Isolated functions.exec V8; source expression/function only; synthetic input | Input {"status":502,"name":"AuthRetryableFetchError"}; expected false; actual false. | Not instrumented separately | E-SESSION |
| SESSION-05 | zero-status retryable permitted | Isolated functions.exec V8; source expression/function only; synthetic input | Input {"status":0,"name":"AuthRetryableFetchError"}; expected true; actual true. | Not instrumented separately | E-SESSION |
| SESSION-06 | raw fetch transport permitted | Isolated functions.exec V8; source expression/function only; synthetic input | Input {"name":"TypeError","message":"Failed to fetch"}; expected true; actual true. | Not instrumented separately | E-SESSION |
| SESSION-07 | AuthApiError timeout rejected | Isolated functions.exec V8; source expression/function only; synthetic input | Input {"name":"AuthApiError","message":"timeout"}; expected false; actual false. | Not instrumented separately | E-SESSION |
| SESSION-08 | missing session rejected | Isolated functions.exec V8; source expression/function only; synthetic input | Input {"name":"AuthSessionMissingError"}; expected false; actual false. | Not instrumented separately | E-SESSION |
| SESSION-09 | unknown error rejected | Isolated functions.exec V8; source expression/function only; synthetic input | Input {"message":"unrecognised"}; expected false; actual false. | Not instrumented separately | E-SESSION |
| SESSION-10 | null error rejected | Isolated functions.exec V8; source expression/function only; synthetic input | Input null; expected false; actual false. | Not instrumented separately | E-SESSION |
| SESSION-11 | future | Isolated functions.exec V8; source expression/function only; synthetic input | Input {"expires_at":200}; now=100000; expected true; actual true. | Not instrumented separately | E-SESSION |
| SESSION-12 | boundary | Isolated functions.exec V8; source expression/function only; synthetic input | Input {"expires_at":100}; now=100000; expected false; actual false. | Not instrumented separately | E-SESSION |
| SESSION-13 | expired | Isolated functions.exec V8; source expression/function only; synthetic input | Input {"expires_at":99}; now=100000; expected false; actual false. | Not instrumented separately | E-SESSION |
| SESSION-14 | missing expiry | Isolated functions.exec V8; source expression/function only; synthetic input | Input {}; now=100000; expected false; actual false. | Not instrumented separately | E-SESSION |
| SESSION-15 | null session | Isolated functions.exec V8; source expression/function only; synthetic input | Input null; now=100000; expected false; actual false. | Not instrumented separately | E-SESSION |
| SW-01 | Never-cache classifier /api/jarvis/device | Isolated functions.exec V8; source expression/function only; synthetic input | Expected true; actual true; only the classifier is evaluated, not Cache API/navigation behavior. | Not instrumented separately | E-SW |
| SW-02 | Never-cache classifier /_serverFn/abc | Isolated functions.exec V8; source expression/function only; synthetic input | Expected true; actual true; only the classifier is evaluated, not Cache API/navigation behavior. | Not instrumented separately | E-SW |
| SW-03 | Never-cache classifier /auth/verify | Isolated functions.exec V8; source expression/function only; synthetic input | Expected true; actual true; only the classifier is evaluated, not Cache API/navigation behavior. | Not instrumented separately | E-SW |
| SW-05 | Never-cache classifier /help | Isolated functions.exec V8; source expression/function only; synthetic input | Expected false; actual false; only the classifier is evaluated, not Cache API/navigation behavior. | Not instrumented separately | E-SW |
| ACK-1 | Result backlog length 0 | Source-derived contract probe in V8 | Agent sends 0; server maximum 20; length admissible=true. No live HTTP/Zod/Python run. | Not instrumented separately | E-ACK |
| ACK-2 | Result backlog length 1 | Source-derived contract probe in V8 | Agent sends 1; server maximum 20; length admissible=true. No live HTTP/Zod/Python run. | Not instrumented separately | E-ACK |
| ACK-3 | Result backlog length 20 | Source-derived contract probe in V8 | Agent sends 20; server maximum 20; length admissible=true. No live HTTP/Zod/Python run. | Not instrumented separately | E-ACK |
| OFF-01 | R2 release object size | Read-only Cloudflare R2 metadata | Opaque release object exists; size 484220160 equals manifest totalBytes. ETag is multipart, not SHA-256. | Not instrumented separately | E-OFFLINE |
| OFF-02 | R2 public exposure configuration | Read-only Cloudflare R2 domain configuration | Managed public domain disabled; custom-domain list empty. | Not instrumented separately | E-OFFLINE |
| DEP-01 | Selected npm advisory metadata | deps.dev v3 via $0 Fetch | 270 unique name@version production-marked lockfile entries checked: advisoryKeys empty for all; four transient reads retried successfully. Not npm audit or full dev-dependency audit. | Not instrumented separately | E-DEPS |
| WEB-01 | BoldChess page availability | $0 cloud Fetch; no personal browser | Computer page fetched and difficulty levels present. No chess moves, game outcome or JARVIS control verified. | Fetch latency 6259.455 ms; not gameplay time | E-CHESS |
| WEB-03 | Paid-plan disclosure in source | GitHub read-only source at 8acf290b27526cf2bf7abdb098769d24bbccbadf | Pricing source explicitly states paid plans are not open and nothing is charged; source-text assertion only, no rendered/checkout proof. | Not instrumented separately | E-PRICING |


## Evidence and reproduction

### E-VERSION — GitHub commit/ref/tree

Implementation branch HEAD 8acf290b27526cf2bf7abdb098769d24bbccbadf; base tree 78f46bb9ea3c01d61b9e1d47e15a08d9152cb1e2, authored 2026-10-27T13:21:29Z. Main read-only check: e53725a25a48508b990135b93c0a6bfa555bb87e. Recursive tree was not truncated (2492 entries). [Exact source](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/plan.md).

### E-COST — TinyFish contract/wallet

Read-only wallet final as_of 2026-10-28T07:47:49.567Z: balance USD10, auto_reload unconfigured, pending_top_up null. Fetch $0/url, Search $0/query. Agent $0.016/step and Browser $0.002/minute were NOT used. Starting and final inspected balances equal. User explicitly selected available $0 checks only.

### E-WORKFLOWS — Source workflow gates

[.github/workflows/ci.yml](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/.github/workflows/ci.yml) pushes only main and ignores **/*.md; [.github/workflows/cloudflare-production.yml](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/.github/workflows/cloudflare-production.yml) is workflow_dispatch with approval text and production environment; [.github/workflows/offline-artifact.yml](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/.github/workflows/offline-artifact.yml) is manually approved publication. No Actions rerun, dispatch, release, merge or deployment made. Source inspection is not a rollback rehearsal.

### E-RLS — Staging database logs/counts

Read-only transactions with SET LOCAL ROLE authenticated and transaction-local synthetic JWT claims; explicit ROLLBACK. Existing authorized staging-owner baseline/owner-role counts: profiles1, conversations16, devices2, tasks13, library_items1, messages53. Foreign synthetic subject: all six targeted owner counts0. has_role(other-user,'admin') false. No customer content selected. Role simulation tests policy execution inside Postgres, not JWT signature/API authentication. Snapshot timestamps around 07:15–07:48 UTC; DB not attested to candidate migration version.

### E-PRIV — Staging privileges/refusal results

anon permit SELECT=false; authenticated permit SELECT=false; authenticated recovery-code SELECT=false. ocade_claim_generation_transport, ocade_finalize_generation_permit, ocade_release_generation_permit each anon_execute=false/authenticated_execute=false. Direct nonstaff finalization and ocade_admin_remove_device probes returned SQLSTATE42501, inside READ ONLY transactions and rolled back. Only these guards were tested.

### E-STORAGE — Staging bucket catalog

library: public=false, file_size_limit104857600; messenger: public=false, file_size_limit26214400; allowed_mime_types=null for both. This does not prove signed-URL expiry, content validation, cross-user downloads or deletion.

### E-HIGH — Exact function executed in V8

[supabase/functions/_shared/workers-ai.ts](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/supabase/functions/_shared/workers-ai.ts) blob b90a333e389981827fee2ffaf35c56c2c4401884. Type annotations erased in memory only; 10 synthetic inputs/expected outputs recorded below, all passed. No request/inference/billing eligibility proved.

### E-SESSION — Exact functions executed in V8

[src/lib/auth/session-failure.ts](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/src/lib/auth/session-failure.ts) blob d40244516ec25c40dff5819f93ef557e76943bb8. Type-only declarations/annotations erased in memory; 10 error cases plus 5 expiry cases passed. No actual session revoked or restored.

### E-SW — Exact classifier executed in V8

[public/sw.js](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/public/sw.js) blob fbe7907e69cf93c6a12a8cd1389c11d01fb23401. Expected/actual: /api/jarvis/device true/true; /_serverFn/abc true/true; /auth/verify true/true; /auth true/false; /help false/false. No browser Cache API run.

### E-ACK — Cross-language source contract probe

[jarvis-runtime/ocade_device.py:465](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/jarvis-runtime/ocade_device.py#L465) sends all results; [src/jarvis/device.server.ts:487](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/src/jarvis/device.server.ts#L487) limits results to20. Queue lengths0/1/20 allowed by length;21/40 rejected by length. Current exchange source lines ~740 onward echoes receipt/outcome. Zod, Python, HTTP and native device not executed.

### E-OFFLINE — Manifest + private R2 metadata

[release/OCADE_OFFLINE_RELEASE.json](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/release/OCADE_OFFLINE_RELEASE.json): release ocr-2dc0ee44eb397906, totalBytes484220160, sha2562dc0ee44eb39790624623cf5e2a8cc21973c4839a67fed406dd3f9b2e6b7f800, context4096, requiredMemory943718400. Object ocade-private-models/r/ocr-2dc0ee44eb397906/a exists with size484220160, ETag9a94d8c3b8717857e241106e1e80d0f8-58, content type application/octet-stream, custom metadata{}, modified Sep16. Multipart ETag is NOT expected SHA256. Managed public domain disabled; custom domains[]. No full bytes, digest, model initialization, generation, storage/corruption/removal or range/resume executed.

### E-DEPS — Current advisory lookup metadata

[package-lock.json](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/package-lock.json) lockfileVersion3:537 package entries including root. Selected274 production-marked entries (!dev,!devOptional,!link) represent270 distinct name@version; optional entries included. All270 queried through [deps.dev GetVersion](https://docs.deps.dev/api/v3/#getversion), no advisoryKeys returned. Four transient npm reads retried successfully; one advisory-detail read retried. [jarvis-runtime/requirements-agent.txt](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/jarvis-runtime/requirements-agent.txt)25 exact pins queried; Pillow44/pypdf11 advisory records (55 total,52 alias groups),23 pins no advisoryKeys. Python transitives/dev-only npm not audited; no install/build/npm audit/exploit. Full version/record inventories below.

### E-CHESS — Free external cloud page Fetch

https://boldchess.com/play/computer/ returned rendered text/title and 16 difficulty levels, including lowest/MAX. Fetch latency6259.455ms. No board move/action, video, game transcript, JARVIS call or outcome.

### E-PRICING — Pricing source disclosure

[src/routes/pricing.tsx:149](https://github.com/BREVEX-CEO/caera-connect-plan/blob/8acf290b27526cf2bf7abdb098769d24bbccbadf/src/routes/pricing.tsx#L149) states paid plans not open/nothing charged. No rendered page or payment action tested.


Full unit inputs/outputs, six-table positive/foreign controls, direct dependency inventory, exact source blob fingerprints and all coverage limitations are preserved in [testing results.md](testing%20results.md). Failed assertions and current advisory records are preserved in [failuer.md](failuer.md).

## Strict interpretation

- **Database:** nonempty owner positive controls matter. Six foreign-row counts0 paired with owner counts1/16/2/13/1/53 verify these scoped SELECT policies. Synthetic SQL claims do not verify JWT signatures, real signup, OAuth, MFA, revocation, storage URLs or write policies.
- **Dependencies:**270 selected npm versions returned empty advisoryKeys at lookup time. This does not qualify dev-only npm packages, Python transitives, native binaries, licences or absence of undisclosed vulnerabilities. No broad dependency/security PASS is claimed.
- **High/session predicates:**10 High and15 session cases passed in V8 with exact source and type-only erasure. No live billing decision, inference, session or browser state is thereby qualified.
- **Service-worker/ACK positive controls:** matching classifier paths and backlog sizes0/1/20 passed only their isolated conditions. Failing /auth, path and oversize cases remain failures; no complete protocol/cache PASS is claimed.
- **Offline:**R2 size and private-domain configuration passed metadata checks. Full SHA256, delivery, browser storage, download/resume/corruption/deletion and actual inference did not execute.
- **BoldChess:**a readable computer page is only prerequisite availability. No chess game or benchmark was passed.
- **Pricing/workflows:**source assertions passed. Actual payment/deployment flows were not exercised or authorized.

Release qualification remains0/10 gates. Successful narrow checks cannot be averaged into public-readiness or >=95% workflow accuracy.
