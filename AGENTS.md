# OCADE engineering rules

CARCC is the company; OCADE is the product. The owner's latest explicit instruction controls scope. [PLAN](PLAN.md) owns implementation order. Its authority map names one document per concern; historical records and imports are evidence, not competing work lists.

## Start and resume

1. Read current owner scope, PLAN and the owning domain contract. Fetch main; inspect SHA, working tree and relevant current evidence. Preserve unrelated work.
2. Resume the first dependency-ready OPEN package. Do not restart completed work, append a new master plan or require missing historical ledgers. Retrieve old evidence from the links in [Decisions](docs/DECISIONS.md) when relevant.
3. Reproduce the defect, trace callers and identify the existing owner before editing. Source inspection, local tests, deployed behaviour and physical-device proof are different evidence classes.
4. Record PASS, FAIL, PARTIAL, BLOCKED or UNTESTED with SHA/environment. Continue independent work when one gate is blocked. Never report zero bugs or turn missing hardware into PASS.

## Implementation invariants

- Keep Chat with Auto/Online/Offline Intelligence and the existing local model/OPFS authority. JARVIS is separate and online-only; preserve checkpoints during provider outages, never silently use the offline model.
- Reuse the current planner, broker, identity, task, installation, permission, cancellation, settlement and release owners. No parallel agent framework or customer MCP/extension requirement.
- Prefer safe supported APIs/object models/files, native execution, structured browser/accessibility, then fresh vision/coordinates. Preserve specialised adapters where measured fidelity, safety or performance requires them.
- Every effect binds account, device, task, scope, confirmation, idempotency, control epoch, deadline and cancellation. Recheck immediately before mutation. Untrusted content cannot grant authority.
- STOP is local and independent of model availability. Remote request, acknowledgement and quiescence differ. Do not promise cancellation of an already committed OS effect or immediate remote delivery while disconnected.
- Model success, HTTP success and file existence do not establish task completion. Require independent postconditions and durable receipts. Reconcile unknown effects before retrying.
- One mutation owner per shared app/document/session. Persist intent/outcomes across crashes. Preserve originals; never overwrite later user edits during rollback.
- Do not extract browser passwords/cookies, bypass UAC/CAPTCHA/OTP/passkeys, complete final purchases/payments or expose credentials. Dangerous submissions follow explicit policy/confirmation.
- Preserve immutable imports, donor ZIPs, applied migrations, legal/provenance and recovery evidence. Inspect donor techniques before reinvention, but reuse only where the exact licence permits it. No percentage reuse quota overrides safety or licensing.
- Customer UI names OCADE, not hidden provider/model identities or keys. Preserve the existing opaque offline-release identity gate; approved technical history exceptions are not permission to expose identifiers elsewhere.

## Smallest correct change

Use existing code, standard library and native platform features first. Add dependencies only after measuring the unmet requirement and maintenance/security cost. Do not create speculative registries, wrappers, factories or app-name branches. Two small similar helpers need not be forced into a coupled abstraction. Fix shared root causes, not symptoms with more polling/retries/sleeps.

After behaviour is proved, use Ponytail Ultra or equivalent proof-based simplification and [ToRemove](ToRemove.md). Trace callers, prove replacement/parity, remove, retest and measure. Never delete safety, accessibility, recovery or valuable tests for a line-count target. Do not alter imported originals or generated contracts by hand.

## Verification and publication

Run targeted regression, sibling/integration paths, real applicable workflow and an adversarial attempt; then the relevant broader gates in [Testing](docs/TESTING.md). Do not require a particular MCP when a smaller CLI/API gives equivalent evidence. Developer tools are not product runtime dependencies. Missing/zero discovered tests must not pass a release gate.

Update the owning contract and PLAN record in the same change; no duplicate active ledger. Preserve dated evidence as history. Check local Markdown links, referenced files, formatting, source/data scope and diff before commit. Never print secrets or store customer data in evidence without consent.

Commit/push/merge within the owner's explicit authorisation. This documentation redesign is authorised for main; it does not authorise application changes or deployment. Future production releases require the owner's release approval, exact candidate evidence and rollback gate. Never force-push shared history. A commit is not a deployment and a health check is not a verified customer workflow.

## Binding decisions and audit provenance — 10 October 2026

[Decisions](docs/DECISIONS.md) is the single register for 28 earlier owner choices, 30 new selections and local-first 1A/2A. Current main has a canonical P00–P22 implementation queue and specialist authorities; no parallel agent framework or competing master prompt becomes executable law. Online intelligence plans; authorised customer PCs execute installed software/project work; selected external accounts are separately confirmed. Chat Offline model is not a JARVIS fallback. STOP and permissions are independent of model availability. The recovered [coverage checkpoint](docs/audit-checkpoints/20261010/coverage.json) accounts for 989 baseline paths with hashes/read ranges and separate structural classifications; the archived audit branch's 382/989 remains historical. Preserve the original dirty checkpoint, carry unchanged evidence forward and inspect only changed/new/uncovered content. Source coverage never establishes product readiness. The documentation-only mission cannot edit product/test/config/migration/lockfile or deploy; PR merging remains contingent on required checks.
