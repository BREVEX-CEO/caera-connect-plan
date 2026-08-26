# START HERE — Claude Opus 5 OCADE takeover

Work from branch `import/ocade-primary-logic-20260826`. Do not start from `main` and do not begin UI work before Phase 0 is complete.

## Phase 0 — mandatory donor extraction and proof

The user-uploaded donor ZIP is already committed under `.incoming/`. GitHub-hosted Actions for this repository are currently failing before a runner is assigned, so perform this extraction in your coding environment.

1. Confirm the branch and cleanly inspect current state:
   - `git status`
   - `git branch --show-current`
   - `git log --oneline --decorate -20`
2. Locate the single ZIP in `.incoming/`; do not assume its display name.
3. Compute SHA-256 and require exactly:
   `4b9590a17222ba460c26905daba7273076d0bb42163f5a8e6d9cda9076de2e49`
4. Read `scripts/import-ocade-primary-logic.mjs` before running it.
5. Install dependencies if needed without changing dependency versions.
6. Run the existing importer against the located ZIP with `--replace`.
7. Verify all of these before continuing:
   - `imports/ocade-primary-logic/source/src/` exists
   - `imports/ocade-primary-logic/IMPORT_RECEIPT.json` exists
   - `imports/ocade-primary-logic/SOURCE_INVENTORY.json` exists
   - receipt `archiveSha256` is the exact SHA above
   - receipt `extractedFileCount` is exactly `2124`
   - extracted source is isolated under `imports/ocade-primary-logic/source/`
   - production `src/` has not been overwritten or bulk-imported
8. After successful verification, remove only the transfer ZIP from `.incoming/`.
9. Commit this phase separately with a clear checkpoint such as:
   `Stage extracted OCADE primary logic source`
10. Push the branch and confirm the extracted tree is browsable on GitHub.

If Phase 0 fails, fix the importer/extraction problem and repeat. Do not skip it and do not begin UI work from the ZIP directly.

## Phase 1 — understand before integrating

Read completely:

- `imports/ocade-primary-logic/README.md`
- `imports/ocade-primary-logic/IMPORT_ANALYSIS.json`
- `imports/ocade-primary-logic/INTEGRATION_MAP.md`
- `imports/ocade-primary-logic/CLAUDE_HANDOFF.md`
- `imports/ocade-primary-logic/CLAUDE_OPUS_5_UI_PRODUCT_PROMPT.md`
- `imports/ocade-primary-logic/SOURCE_INVENTORY.json`
- the existing OCADE router, Chat, local-model authority, agent loop, tool registry, Cowork/extension, permissions, Settings, Supabase, offline/PWA, Cloudflare and launch-gate code

The donor tree is a logic donor, not a second application. Existing OCADE architecture remains authoritative.

## Phase 2 — selective logic integration

Adapt useful donor Tool, Task, permission, file/search/edit, session/history/memory, context-compaction and task-orchestration concepts into OCADE-native interfaces. Remove duplicates rather than keeping competing implementations.

Never directly wire donor hosted-provider/API/OAuth/remote/server transports into normal OCADE web Chat. Never mount the donor Next.js app. Node/Bun filesystem, shell, PowerShell, PTY and process execution must remain behind a local trusted companion/native boundary.

## Phase 3 — product/UI redesign

Execute `CLAUDE_OPUS_5_UI_PRODUCT_PROMPT.md` as the governing UI/product specification.

Core direction:

- Claude/ChatGPT-level simplicity on the surface
- ECHOID-inspired OCADE login
- Operational-AI-Infrastructure-inspired global visual language
- Terranova-inspired selective liquid glass
- original OCADE state-driven orb for Control/Cowork
- remove duplicate pages/options and excessive instructions
- remove useless Quick Appearance controls
- appearance/accent changes must visibly affect the 3D/orb environment
- simplify Motion & Depth to understandable presets
- remove Qwen/raw model filenames/hashes/SOMLLM from normal customer UI; truthful provenance belongs only in Advanced diagnostics
- hide low-level storage internals from normal customers
- simplify Settings into a small number of customer concepts
- Control + Work must be rebuilt as a premium, minimal, stateful experience with obvious PAUSE / TAKE OVER / STOP
- use real 3D only where it adds product value and keep the application fast

## Execution standard

Do not return another audit or wishlist. Do the repository work.

READ → TRACE → CODE → RUN → BREAK → FIX → RETEST → VERIFY → COMMIT.

Every enabled control must work, persist where appropriate, and change real behavior. Remove or honestly disable anything that is not implemented. Test localhost as a real customer, desktop/mobile responsiveness, keyboard/focus, reduced motion, loading/error/empty states, direct routes, refresh/back-forward, offline transitions and console/network errors.

Run focused tests after each integration slice, then typecheck, lint, build, full relevant tests and release gates. Do not call source existence "working". Keep checkpoint commits. Do not merge to `main` or open the launch gate until the final production proof is genuinely clean.
