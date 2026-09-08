# Documentation

This directory contains OCADE's canonical role-specific documentation plus supporting audit, legal, provenance, deployment and evidence material.

## Canonical documents

| File | Owns |
|---|---|
| `../PLAN.md` | The sole ordered implementation plan, checkpoints, final verification, Git integration and deployment sequence. |
| `../CLAUDE.md` | The single AI coding-agent entry point and documentation read order. |
| `PRD.md` | Product scope, target users, goals/non-goals, core features and product acceptance criteria. |
| `TRD.md` | Technical requirements that translate product behavior into runtime, security, platform, intelligence, performance and reliability constraints. |
| `APP_FLOW.md` | Routes, redirects, clicks, user journeys, overlays and UX/error/lifecycle states. |
| `UI UX Brief.md` | Concise experiential brief: product feel, information architecture, surface-level UX intent, responsive behavior and reference-app interpretation. |
| `DESIGN.md` | Detailed visual system, layout, components, Jarvis presentation, interaction rules and accessibility design authority. |
| `ARCHITECTURE.md` | Current/target stack, repository layers, system boundaries, data/API/security/platform/deployment architecture and scalability model. |
| `Backend Schema.md` | Backend data contract: current physical Supabase authorities, logical entities, relationships, RLS, Storage, pagination/indexing and migration rules. |
| `RULES.md` | Project-specific engineering constraints and forbidden practices. |
| `TESTING.md` | Test strategy, repository test stack, five silent speed killers, production-page/state checks and definition of done. |
| `MEMORY.md` | Concise current state, known problems, recent decisions and session handoff. |
| `DECISIONS.md` | Durable architecture/product decision records and superseded alternatives. |

These files are complementary rather than duplicate master plans. `TRD.md` states technical requirements; `ARCHITECTURE.md` explains how the system is structured. `UI UX Brief.md` communicates the intended experience; `DESIGN.md` remains the detailed design-system/implementation authority. `Backend Schema.md` owns the data contract while migrations and generated Supabase types remain the physical schema authority. `PLAN.md` remains the only implementation sequence.

There is intentionally no `AGENTS.md`; `CLAUDE.md` is the single AI-agent handbook. Do not recreate duplicate instruction files or another master plan.

## Supporting documents

Audit/readiness reports, acceptance ledgers, ADRs, legal material, security/breach procedures, deployment/CDN runbooks, Windows/browser/model proofs, donor provenance/licence material and release evidence are supporting records. Some describe historical states and may contain assumptions superseded by the canonical documents, but they retain evidence, provenance, legal, operational or checker value and must not be deleted merely because they are not current product authority.

A supporting Markdown file may be removed only after verifying all of the following: its unique information is represented by a current authority or immutable Git history; no script/test/workflow/package command/runtime process references it; it is not required for legal, licence, provenance, security, audit, migration, release or operational evidence; and deleting it cannot break a checker or future incident/recovery workflow.

When a major product/architecture decision changes, update `DECISIONS.md`, the owning canonical document and `MEMORY.md` if it changes current implementation state. Cross-reference instead of copying full specifications between documents.