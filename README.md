# OCADE

**OCADE BY CARCC CADANE** is a browser-first AI workspace centered on **Chat, Cowork and Code**. It combines conversational intelligence, delegated browser/computer work, repository-aware coding, Projects, Tasks, Artifacts, Search, customization, organizations and Offline Intelligence in one product.

Canonical public identity comes from `src/config/company-facts.ts`. Product implementation/readiness is governed by the documentation set below and should not be inferred from an old audit paragraph or the existence of a source file alone.

## Documentation Authority

Read these in order before substantial product-wide work:

1. [`CLAUDE.md`](CLAUDE.md) — single AI coding-agent entry point and repository working rules.
2. [`docs/PRD.md`](docs/PRD.md) — product requirements and acceptance definition.
3. [`docs/TRD.md`](docs/TRD.md) — technical requirements and non-functional/runtime constraints.
4. [`PLAN.md`](PLAN.md) — sole production-completion implementation plan and final verification/release sequence.
5. [`docs/APP_FLOW.md`](docs/APP_FLOW.md) — routes, redirects, clicks, user journeys and UX states.
6. [`docs/UI UX Brief.md`](docs/UI%20UX%20Brief.md) — concise experience, information-architecture and surface-level UI/UX intent.
7. [`docs/DESIGN.md`](docs/DESIGN.md) — detailed visual/interaction system and reference-app guidance.
8. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — current/target system, data, API, security and deployment architecture.
9. [`docs/Backend Schema.md`](docs/Backend%20Schema.md) — backend data contract, current Supabase authorities, relationships, RLS/Storage and migration rules.
10. [`docs/RULES.md`](docs/RULES.md) — project-specific engineering rules and forbidden practices.
11. [`docs/TESTING.md`](docs/TESTING.md) — testing strategy, performance gates and production-state checks.
12. [`docs/MEMORY.md`](docs/MEMORY.md) — current status, known problems and session handoff.
13. [`docs/DECISIONS.md`](docs/DECISIONS.md) — major architecture/product decisions and superseded alternatives.

The documents are intentionally role-specific, not competing master plans. `TRD.md` complements `ARCHITECTURE.md`; `UI UX Brief.md` complements and does not replace `DESIGN.md`; `Backend Schema.md` complements the architecture while source migrations/generated types remain the physical schema authority. `PLAN.md` is still the only implementation sequence.

The repository intentionally does not use `AGENTS.md`. Do not recreate a second AI handbook or another master plan.

## Current Product Direction

### Data

Supabase PostgreSQL is the target canonical persistent authority for ordinary account/user data, with private Supabase Storage for customer files and durable artifact bodies. Historical IndexedDB/localStorage/browser-vault content paths are migration targets, not the final architecture. OPFS is reserved for Offline Intelligence model binaries/chunks and model-owned metadata.

### Intelligence

Online intelligence is pinned to **Gemini 3.1 Flash-Lite** through one server-side OCADE intelligence boundary with exactly three optional secret slots: primary, secondary and tertiary. Keys are never browser-readable. Local-only inference must produce zero provider network traffic. One logical AI request keeps one commercial usage permit through retries, tools, subagents, key failover and eligible local fallback.

### Offline Intelligence

Model preparation begins automatically and non-blockingly on the first browser/device visit where supported, including the landing page. The installer verifies/reuses content-addressed OPFS chunks, resumes interrupted transfers and repairs only missing/corrupt content. A verified model is not re-downloaded on normal revisit, sign-in/sign-out, account deletion, service-worker update or compatible deployment. Only explicit Remove Offline Intelligence deletes it; deliberate removal suppresses automatic reinstall until the user explicitly installs again.

### Cowork

Cowork has two presentations over one runtime. **Normal Cowork** is a minimal practical work interface. **Jarvis Cowork** is the immersive voice/autonomy interface with the liquid-glass network orb, audio-reactive states and contextual browser/PC observation. Both share the same tasks, permissions, usage, memory, browser/Windows execution and receipts.

### Code

Code is intended to be a real coding-agent workspace with repository intake, editing, search, symbols/diagnostics, exact patches, diff/review, Git, permissioned terminal/LSP/dev-server, preview/browser verification, parallel sessions/subagents and durable results.

### UI/UX

Claude is the primary behavioral/information-architecture benchmark; ChatGPT and OpenClaw are secondary references for chat polish and transparent agent/computer-use interactions. OCADE remains independently branded and implemented. The ordinary product is minimal and restrained; Jarvis is the expressive visual mode.

### Commercial

Free uses the shared 28-successful-AI-requests / 388-minute window. Paid usage uses server-authoritative windows while the UI shows percentage/reset. Payments, subscriptions, refunds, disputes/chargebacks and audited Admin grants are mandatory but deliberately implemented as the final major phase so OCADE does not take money before the rest of the product is reliable.

## Current Repository State

The current production-completion plan was audited from `main` commit `5b967735267fb650df63d02d76788ba620353cc4`, which consolidated prior Claude/Codex implementation work through Block 9. Later documentation-only commits have advanced `main` while preserving that implementation baseline distinction. The current authority set includes the separate TRD, UI UX Brief and Backend Schema, and the 2026-09-09 Markdown cleanup consolidated the former standalone ADR decisions into `docs/DECISIONS.md`.

That implementation baseline already has extensive tests, generated evidence, local-model/runtime foundations, extension/native/mobile source, Supabase schema and release tooling, but the plan also records known remaining defects and architectural migrations. **The repository is not considered production-complete merely because this documentation exists.** Follow `PLAN.md` phase by phase and prove the exact final implementation tree.

## Development

The current package manager/runtime are pinned in `package.json`, `.node-version` and `.nvmrc`. Common commands include:

```bash
npm ci
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:full
npm run audit:journey
npm run launch:prove
npm run deploy:check
```

Use the actual current `package.json` scripts as the command source of truth. Focused changes should run focused tests first; the full release matrix is defined in `PLAN.md` and `docs/TESTING.md`.

## Secrets and Configuration

Never commit real secrets or local `.env` files. Browser-visible variables are not authorization. Gemini server keys, Supabase service credentials, payment API/webhook secrets and other privileged material belong only in deployment/server secret stores. `.env.example` documents names/placeholders, not secret values.

## Imported Primary Logic

The repository includes an approved donor integration/provenance system for `OCADE_PRIMARY_LOGIC`. The verified donor contains 2,126 files. The production-completion plan requires re-evaluating every donor family and maximizing useful safe behavior—especially Chat, Cowork, Code, agents/tools, tasks, Git/LSP, shell safety, permissions, browser/computer control and recovery—without importing duplicate servers/providers/stores/telemetry or broken architecture merely to increase file count.

## Evidence and Historical Documents

Audit reports, readiness contracts, provenance, legal documents, security/breach procedures, runbooks, generated ledgers and release evidence remain useful supporting records. Some preserve historical states and may contain wording superseded by the canonical documents. The former standalone ADR decisions now live in `docs/DECISIONS.md`. Supporting records cannot override current product/architecture/implementation authorities, but they must not be deleted unless their unique evidence/operational value and repository references have been safely retired.

## Licence

The repository is proprietary. Third-party libraries, models and imported logic remain subject to their respective licences/notices. See [`LICENSE`](LICENSE), `release/THIRD_PARTY_NOTICES.md` and the provenance/licence material under `src/primary-logic` and `imports/`.
