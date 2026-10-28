# Cloud safety evidence — 28 October 2026

**Result: NOT commercially qualified.** Starting implementation HEAD `71e8b637a5f723a33593a39f73d6cccd3573e945`; observed main `e53725a25a48508b990135b93c0a6bfa555bb87e`. Exact candidate source objects below bind this evidence; the final commit is identified by Git history. No self-referential commit placeholder is used.

Development used GitHub content-addressed blobs and remote tool memory. No repository checkout, product runtime or tests ran on the owner's PC. Local reads were limited to the provided skill instructions. No deployment, production/staging mutation, secret read/change, provider generation, payment, paid VM, scheduled continuation or force-push occurred.

## Executed cloud evidence

| Scope | Before | After | Exact evidence class |
| --- | --- | --- | --- |
| RC04/05 path/shim/launcher | 89/135 pass; 46 assertion failures | 135/135 pass | Exact extracted source hooks with deterministic path/transform/process fixtures. 132 path/shim cases plus 3 launcher-contract assertions; no actual Vite/esbuild/Node/Windows process execution. |
| RC10 auth/cache | 15/20 pass; 5 assertion failures | 20/20 pass |Full exact service-worker code with simulated network, Cache Storage and event dispatch; no real browser. |
| RC06 billing credential isolation | 9/13 pass; 4 assertion failures | 13/13 pass | Exact boundary declarations/methods and highIncluded parser with eight type-only removals and fake HTTP. No Deno/deployment/real billing/inference. |

These 168 passing contract assertions are **not**168 customer tasks,55 distinct defects, a workflow success percentage, latency/cost measurement or launch qualification. Before/after source hashes and reproducible adapters are in [the evidence directory](../audit-checkpoints/20261028-cloud-safety/). Independent path and credential checks were authored by a separate agent; the primary agent reviewed the credential patch. RC01 and RC17 received separate-agent source reviews. This is not an external human security review or a consenting-user pilot.

RC01 review caught a Resume-empty-outbox command-discard race and repaired both server admission and its regression before integration. RC17 review caught missing/zero HWND values passing an equality check; the final patch refuses them. Neither review is represented as a runtime PASS.

## Added but UNRUN

Cloud CPython/Node/PostgreSQL/native runners are unavailable under the no-spend constraint. The source-added agent/journal, exchange DB, window identity, resolver, service-worker and credential Vitest tests have **not** run in their standard test runners. Full `verify:full`, typecheck, ESLint, Prettier, production build, dependency audit, native Windows GUI, browser/a11y/mobile/Office, real model/offline and rollback qualification are **BLOCKED/UNTESTED** for this candidate. The 17 window tests are synthetic unit fixtures, not native Windows acceptance.

Suggested commands **only in authorized isolated cloud environments**:

- `python -m unittest discover -s jarvis-runtime/tests -p test_agent.py`
- `python -m unittest discover -s jarvis-runtime/tests -p test_window_identity.py`
- `npx vitest run src/jarvis/__tests__/device-exchange.test.ts src/deepseek/__tests__/resolve.test.ts src/lib/__tests__/service-worker.test.ts src/lib/intelligence/__tests__/boundary-credentials.test.ts`
- The broader applicable `npm run verify:full`, Python/native and exact-candidate workflow gates after targeted tests pass.

Existing Actions evidence: current starting HEAD had zero check runs. Recent [CI](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/38932904911), [browser](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/38904373137) and [Android](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/38904368896) jobs had no runner/steps. Historical CI-00-01 records a billing/spending refusal; current included allowance was not verified. No paid/inconclusive rerun was started. The remote JS sandbox forbids dynamic code generation and WebAssembly (even an empty module); a Pyodide CDN probe returned403. This cannot supply CPython or native GUI qualification. Plugin discovery did not identify a connected free native/code runner.

## Read-only service audit

Supabase security advisors observed 28 October 2026: staging 17 RLS/no-policy INFO,41 authenticated  SECURITY DEFINER WARN,1 leaked-password WARN; production 16 INFO,36 SECURITY DEFINER WARN,1 leaked-password WARN. Default-deny RLS and intentional gated RPCs can be legitimate; these counts are not counts of proved exploits. Review functions/policies individually and qualify tenant/role behavior. [RLS remediation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [RPC review](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Read-only Cloudflare trigger preflight: `ocade-web` non-production trigger includes `*`, excludes `main` and `ocade/p00-p22-implementation`; production includes only `main`. No settings/build/deploy changes. Recheck before future pushes; this is push isolation, not rollout qualification. The currently connected account does not itself prove the application's HIGH free eligibility. No application credential values were retrieved.

## Candidate source objects

| Path | Git blob SHA |
| --- | --- |
| `jarvis-runtime/ocade_device.py` | `7bba430c5c0fed82c0a69aa1b3cd4d1f5a436614` |
| `src/jarvis/device.server.ts` | `4c44172ffc0b3e5ae4fa298fdcc2a5c8adc2e3ee` |
| `jarvis-runtime/tests/test_agent.py` | `3ebf23a2117af5e4f2918de88f36ff1b05c6e9a3` |
| `src/jarvis/__tests__/device-exchange.test.ts` | `c67950334454907665f8b35a4a4bb6814e23ee7e` |
| `jarvis-runtime/ocade_computer.py` | `f3462f713fd2a8b79dd843d2d9ae50c3ed66c51c` |
| `jarvis-runtime/ocade_accessibility.py` | `c62da6952fb453cbddd1160c0ac2461008eb6af8` |
| `jarvis-runtime/tests/test_window_identity.py` | `2d7d00b082c60cebf1928526b9e5933c23ac551a` |
| `src/deepseek/resolve.ts` | `7efc82ba6f810a61791777d0ae611420e6dca169` |
| `vitest.deepseek.config.ts` | `4d243d62bd55fda4441abc7e75f36a7b13172a80` |
| `scripts/deepseek-link.mjs` | `585d1e7a4333dd9cb6232b72a1625a287b28cf59` |
| `src/deepseek/__tests__/resolve.test.ts` | `9a9691f5cac8eb732c2236a58e04db8ce0d15ef5` |
| `public/sw.js` | `49e998ed501d0cd0dc62beb3884b03959680aa5f` |
| `src/lib/__tests__/service-worker.test.ts` | `a07d0bbed71362ab5ab4d9de1524913c14328b20` |
| `supabase/functions/_shared/boundary.ts` | `b5bba4c2a50d59f27c5fcec0e68497a697353103` |
| `src/lib/intelligence/__tests__/boundary-credentials.test.ts` | `7f254b25f1cf9e600b880e274309f2aec770be5d` |

Compatible server-first rollout is required before any future updated agent deployment; old servers do not understand `hasMoreResults`. Single oversized or schema-invalid results stay retained and can block normal work; control delivery remains separate. Claimed-action expiry, malformed journal structure, mixed-version behavior, blocked network/STOP, HWND reuse/PID/document races and semantic outcome checks remain open. See [defect register](DEFECT_REGISTER.md).

## Commercial evidence denominator

[All source-item dispositions and 10 gates](SOURCE_CROSSWALK.md): **0/10 gates PASS → 0/100 commercial gate index**. No fresh customer workflow campaign was run, so first-run/recovery success, p50/p95/p99, AI calls, retries, per-success cost and competitor performance are **NOT MEASURED**. Existing historical 4–17 runs/family do not meet the representative independent qualification gate. Five consenting independent users, legal/security reviews, credentials, legitimate hosted native environments and owner launch approval remain external blockers.

The 2158-object starting inventory is metadata coverage, not 2158 semantically audited files. Source-to-control ownership and full codebase semantic review are incomplete; all unsupported historical completion claims remain superseded by these limits.
