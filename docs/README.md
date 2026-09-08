# Documentation

This directory contains OCADE's canonical role-specific documentation plus supporting audit, legal, provenance, deployment and evidence material.

## Canonical documents

| File | Owns |
|---|---|
| `../PLAN.md` | The sole ordered implementation plan, checkpoints, final verification, Git integration and deployment sequence. |
| `../CLAUDE.md` | The AI coding-agent entry point and documentation read order. |
| `PRD.md` | Product scope, target users, goals/non-goals, core features and acceptance criteria. |
| `APP_FLOW.md` | Routes, redirects, clicks, user journeys, overlays and UX/error/lifecycle states. |
| `DESIGN.md` | Visual language, layout, reference-app interpretation, components, Jarvis presentation and accessibility design rules. |
| `ARCHITECTURE.md` | Current/target stack, repository layers, Supabase/data/API/security/platform/deployment architecture and scalability boundaries. |
| `RULES.md` | Project-specific engineering constraints and forbidden practices. |
| `TESTING.md` | Test strategy, actual repository test stack, five silent speed killers, production-page/state checks and definition of done. |
| `MEMORY.md` | Concise current state, known problems, recent decisions and session handoff. |
| `DECISIONS.md` | Durable architecture/product decision records and superseded alternatives. |

There is intentionally no separate TRD or Backend Schema document: their unique technical/data requirements are consolidated into `ARCHITECTURE.md` to avoid repeating the same stack, database and API rules. There is intentionally no separate UI/UX Brief in addition to `DESIGN.md`, no separate performance document in addition to `TESTING.md`/`ARCHITECTURE.md`, and no separate production-pages checklist in addition to `APP_FLOW.md`/`TESTING.md`.

There is intentionally no `AGENTS.md`; `CLAUDE.md` is the single AI-agent entry point. Do not recreate duplicate instruction files or another master plan.

## Supporting documents

Existing audit reports, legal pages/process docs, deployment/runbooks, architecture boundaries, donor provenance, release evidence and platform proofs remain supporting evidence. They may describe historical/current implementation facts, but they do not override a newer explicit decision in the canonical documents.

When a major product/architecture decision changes, update `DECISIONS.md`, the owning canonical document and `MEMORY.md` if it changes current implementation state. Do not copy the same requirement into multiple files merely for visibility; use links instead.
