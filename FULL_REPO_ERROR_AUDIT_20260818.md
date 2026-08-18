# Full Repository Error Audit — 2026-08-18

Scope: `BREVEX-CEO/caera-connect-plan`, audited from `main` at `90e1a90c319b09efa51eee6dd1ac4273e4d3606b`.

This ledger counts only concrete current failure modes with a reproducible source/test contract. Historical defects already fixed on `main`, stale audit ledgers, unused optional UI primitives, and unimplemented future features are not counted as current bugs.

## Result

- Confirmed current defects found: **21**
- Source fixes implemented on this branch: **21 / 21**
- Regression coverage added/updated: **21 / 21**
- Hosted CI/runtime executions observed for this branch: **0** at the time this ledger was written
- Therefore this branch does **not** claim the repository is bug-free or runtime-green. It claims that all 21 defects below have concrete source fixes and regression contracts pending executable CI proof.

The 26 route/migration defects already fixed by `main` commit `90e1a90c319b09efa51eee6dd1ac4273e4d3606b` are historical and are deliberately excluded from the 21-count below.

## Confirmed defects and fixes

| # | Type | Concrete failure on audited `main` | Fix on this branch |
|---:|---|---|---|
| 1 | Privacy / architecture | Public cloud-model generation paths remained reachable through OCADE chat/model authorities. | Cloud chat endpoint is a `410` fail-closed tombstone; engine/model/provider authorities are local-only and stale cloud preference migrates to local. |
| 2 | Security / SSRF / fail-close | Provider/bridge metadata could accept unsafe host targets and provider failures were not consistently fail-closed. | Provider surface is local-only; bridge URLs are restricted to private/local targets and database/provider errors are explicit. |
| 3 | Financial integrity | A valid payment webhook could be acknowledged after a failed persistence transition, preventing provider retry. | Verified events return success only after required DB writes succeed; persistence failure returns `500` for retry. |
| 4 | Model-selection correctness | Browser tier promotion could use circular/self proof instead of proof from the currently proven tier. | Promotion requires a proven lower tier and advances at most one rank at a time. |
| 5 | Concurrency / memory | Multiple same-origin tabs could each own a full browser model, multiplying RAM/GPU pressure. | Web Locks elect one browser-model owner; followers relay through BroadcastChannel. |
| 6 | Performance / resource waste | A healthy preferred desktop engine could still warm a large browser fallback unnecessarily. | Browser fallback warms only when the preferred engine is unavailable. |
| 7 | Download resilience | A transient HTTP resume failure could delete already-downloaded browser model bytes. | Partial bytes are preserved across transient failures and resumed later. |
| 8 | Model integrity | Previously verified metadata could be trusted even when it described a different physical file size. | Verification metadata is bound to exact stored byte size and rewritten only for the completed file. |
| 9 | Supply-chain integrity | A model with a published digest could become executable when digest verification was unavailable. | Published digests fail closed with `verification_unavailable`; unverified weights are refused. |
| 10 | Download resilience | Local Ollama-compatible model pulls had no bounded automatic retry/backoff. | Transient pulls retry up to five attempts with exponential backoff; deliberate cancellation is not retried. |
| 11 | Streaming parser correctness | A final NDJSON pull object without a trailing newline was never parsed. | Decoder flushes and parses the remaining final buffer. |
| 12 | Service-worker correctness | Asynchronous cache writes could outlive the fetch event and be terminated early. | Cache writes are attached to `event.waitUntil`. |
| 13 | Offline privacy / reliability | Exact `/auth` handling and flaky first-install caching had gaps; incomplete shell caching lacked an explicit retry/status path. | Auth/API/server-function responses are never cached; offline shell retry/status messaging is explicit. |
| 14 | Data persistence correctness | Supabase conversation/title writes could ignore errors/affected-row truth and retry in ways that could duplicate work after partial success. | Required writes validate errors/affected rows and expose partial title-update failure without redoing committed work. |
| 15 | Release-gate security | Historical time could control launch and an internal-looking Host header could bypass production readiness. | Launch is controlled by explicit readiness; Host is not a production bypass; production preview requires explicit configuration. |
| 16 | Concurrency / authorization | Browser-device registration was multi-step client logic vulnerable to duplicate/racing registrations. | Registration is one authenticated DB transaction with per-install advisory locking and `auth.uid()` scoping. |
| 17 | Same-tab concurrency | Preload and send could race and initialize the same WebGPU/WASM model twice in one tab. | Both adapters share an in-flight initialization promise keyed to the model. |
| 18 | Supply-chain integrity | WASM fallback could bypass OCADE's verified persistent model store. | WASM executes only OCADE-managed fingerprint-verified weights; direct unverified HF loading is removed. |
| 19 | Product truth / UI | Model Control still exposed public cloud providers/models even after local-only product intent. | Model Control exposes only local engines and no Gemini/GPT/OpenAI/Lovable test controls. |
| 20 | Cross-tab recovery | Follower tabs could remain stranded after the elected Web Lock owner disappeared. | Followers query the lock state and re-elect an owner when the owner disappears. |
| 21 | Cross-tab streaming reliability | One fixed wall-clock relay timeout could kill a healthy long generation. | Heartbeats and activity-aware idle timeout keep active generations alive while still detecting dead owners. |

## Category totals

- Security, privacy, authorization, financial/supply-chain integrity: **7**
- Concurrency, ownership, memory/resource races: **5**
- Model selection/download/parser resilience: **5**
- Offline/service-worker correctness and privacy: **2**
- Database persistence correctness: **1**
- Product/UI truthfulness: **1**
- **Total: 21**

## Regression evidence added

Primary aggregate contract: `src/lib/__tests__/full-repo-defect-contract.test.ts`.

Behavior-focused additions include:

- `src/lib/__tests__/launch-gate-hidden-bugs.test.ts`
- `src/lib/__tests__/model-download-hidden-bugs.test.ts`
- `src/lib/__tests__/service-worker-hidden-bugs.test.ts`
- updated model lifecycle, model catalogue, router, gateway, allowance and browser catalogue suites
- database migration/registration assertions for atomic browser-device creation

These tests are committed regression evidence, not a fabricated claim that hosted CI executed them.

## Verification boundary

The repository already defines full CI gates covering TypeScript, ESLint, unit tests, shuffled test isolation, production build, evidence/honesty gates, Rust safety, database migration/RLS/type parity, managed browser checks and mutation safety. Those are the correct executable proof layer for this branch.

At the time of this ledger, hosted execution has not been observed for this audit branch. Do not merge on the basis of this document alone; require an actual runner result or equivalent clean local execution before treating the branch as release-proven.
