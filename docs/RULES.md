# Project Rules

## General Rules

Work from the actual current repository and canonical documentation, not stale chat summaries or historical branch assumptions. Read `CLAUDE.md`, `docs/PRD.md`, `docs/TRD.md`, `PLAN.md`, `docs/APP_FLOW.md`, `docs/UI UX Brief.md`, `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/Backend Schema.md`, `docs/RULES.md`, `docs/TESTING.md`, `docs/MEMORY.md` and `docs/DECISIONS.md` before substantial product-wide work.

Search before creating. If a subsystem already has an authority, repair/complete/merge it rather than creating a second router, store, database client, auth stack, task manager, agent loop, tool registry, model installer, usage system, payment stack, browser bridge, native-control engine or design system. For overlaps use KEEP, FIX, COMPLETE, MERGE, REPLACE or REMOVE and migrate callers before deletion.

Every visible control must perform real behavior, open a truthful unavailable state for a genuine external dependency, or be removed. A route, component, test or successful compile alone does not prove a product feature.

## Code Organization

Converge incrementally toward the ownership boundaries in `docs/ARCHITECTURE.md`. Do not mass-move files cosmetically. Move dependency-closed families only when ownership improves and imports/callers/tests can migrate safely. `shared` cannot depend on routes/features; `core` should remain environment-neutral where practical; route/features should not bypass canonical data/provider/native boundaries.

Generated files remain generated. Never hand-edit route trees, generated database types, ledgers or release evidence to make checks green; fix the source/generator and regenerate.

## Naming Conventions

Use descriptive purpose-based names consistent with the repository. Do not create `new`, `v2`, `replacement`, `final-final`, random-number or gibberish source names simply to avoid understanding current code. Runtime IDs may be random when uniqueness is required, but source/branch/migration/test/evidence names must communicate purpose.

## Type Safety

Preserve strict TypeScript checking and real domain types. Avoid broad `any`, unsafe casts and stringly-typed state when a validated union/schema can express the invariant. Validate untrusted external/provider/user inputs with explicit schemas. Generated Supabase types must match the reconciled schema.

## Error Handling

Fix root causes. Never swallow rejected promises, fake success after uncertain side effects, hide console/network/runtime failures, or convert unknown failures into completed task states. Side-effect success requires re-observation/postcondition verification where applicable. Errors exposed to users must say what failed, whether anything committed and the safe next action without leaking secrets/stacks.

## API Rules

All AI generation goes through one `OcadeIntelligence` boundary and one commercial permit. No direct browser/provider bypass. Server operations derive user/organization identity from authenticated context, not client-supplied owner IDs. External webhooks validate signatures/raw-body protocol and enter one idempotent state-application authority. Client-return URLs never grant entitlement.

Browser bundles cannot import unsafe Node/native modules or privileged credentials. Server/private APIs expose only the narrow operation needed; do not expose generic raw admin/database mutation endpoints.

## Database Rules

Read `docs/Backend Schema.md` together with `docs/ARCHITECTURE.md` before changing persistence. Supabase PostgreSQL and private Storage are canonical for ordinary account content. Do not reintroduce persistent IndexedDB/localStorage/browser-vault chat/project/task/artifact/memory stores. OPFS is model-only. Incognito is memory-only. RLS is mandatory for exposed tenant/user data, and Storage policies mirror metadata ownership.

Source/live migrations are reconciled semantically before production application. Use forward-only corrective migrations; do not replay by filename or destructively rewrite history. Add indexes only for actual WHERE/JOIN/ORDER BY/search patterns and query-plan evidence. Every growing query is bounded/paginated.

## Security Rules

Never commit/expose/log Gemini keys, Supabase service credentials, payment API/webhook secrets, lease private keys, session tokens, protected inputs or unnecessary customer content. Server secrets never use public/Vite prefixes. Dangerous organization/Admin/support-content/billing actions require server authorization and recent AAL2 where specified.

Passwords, OTPs, CAPTCHAs, CVV/PIN and recovery codes stay user-controlled; automation stops/hands over instead of silently reading, storing, inferring or typing them. Plugins/connectors/donor logic are untrusted capability inputs and cannot bypass identity, tenant, usage or permission policy.

## Dependency Rules

npm and the committed lockfile are the package authority. Prefer existing compatible dependencies over adding another library for the same responsibility. New dependencies need a clear product/maintenance/security reason and must not drag server/native code into browser bundles. Do not remove provenance/licence material required by donor or third-party usage.

## UI Rules

Read `docs/UI UX Brief.md` for experience intent and `docs/DESIGN.md` for detailed design-system/interaction rules before changing product UI. Keep OCADE independently branded. Claude is the primary information-architecture/interaction benchmark, ChatGPT and OpenClaw are secondary references; do not copy proprietary assets/source/exact copy or pixel-for-pixel trade dress. Keep one obvious primary action, secondary actions contextual, and remove duplicate buttons/More-style dashboard clutter. Normal and Jarvis Cowork share one runtime; Jarvis is not a second design system or task engine.

Provider/raw model names do not appear in ordinary customer UI. Use OCADE Intelligence, Online Intelligence and Offline Intelligence. Unconfigured connectors/providers/channels remain hidden or precisely unavailable.

## State Management

Persistent ordinary account state is server/Supabase authoritative. React/local state is for presentation and transient interaction, not a second durable store. Temporary offline-local turns may live only in current-tab memory and must warn before destructive navigation. Task, usage, entitlement and executor lifecycle states use one canonical state machine each.

## Testing Rules

Run focused tests after focused changes and the exact phase gate in `PLAN.md` before moving on. Final proof uses `docs/TESTING.md`. Do not skip/suppress shipped behavior to make the suite green, hand-edit generated evidence, or treat mocked success as runtime proof. Browser work requires real browser journeys with visible state, console, network, storage and postcondition inspection; Supabase requires adversarial cross-user/org testing; native/browser control requires observed postconditions.

## Git Rules

Preserve unknown work. Never `reset --hard`, `clean` destructively, force-push or rewrite published Lovable-connected history. Implementation uses one isolated completion branch; `main` stays stable until the complete final tree is verified. Reconcile latest `origin/main`, rerun required verification, fast-forward without force and verify remote SHA/tree. Do not deploy incomplete code.

## Performance Rules

Treat the five silent speed killers as correctness defects: remove N+1 query loops, add only evidence-backed indexes, bound/paginate growing datasets, optimize/lazy-load noncritical media, and split/lazy-load heavy Code/PDF/Jarvis/model/native/media bundles. Batch startup requests where practical and clean up workers/processes to prevent leaks. Performance budgets are deployment blockers, not optional warnings.

## Forbidden Practices

Never create duplicate canonical authorities, fake completion, fake availability, client-controlled entitlement, raw unrestricted Admin content browsing, browser-visible AI/payment/service secrets, persistent local ordinary customer-content stores, model redownload on normal revisit/update, blind donor import, blind source/live migration replay, decorative dead controls, stale generated evidence, or deployment from a tree different from the one tested.

## Documentation Rules

`PLAN.md` is the sole implementation plan and `CLAUDE.md` is the sole AI handbook. The canonical role-specific documents are `docs/PRD.md`, `docs/TRD.md`, `docs/APP_FLOW.md`, `docs/UI UX Brief.md`, `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/Backend Schema.md`, `docs/RULES.md`, `docs/TESTING.md`, `docs/MEMORY.md` and `docs/DECISIONS.md`. Do not recreate `AGENTS.md`, a second copy of any canonical role, another completion plan or a duplicate mission folder. Update the owning canonical document and cross-reference it. `docs/MEMORY.md` records current handoff only; `docs/DECISIONS.md` records meaningful decision history rather than duplicating implementation detail.
