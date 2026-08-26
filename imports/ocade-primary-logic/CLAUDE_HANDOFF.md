# Claude Opus 5 — OCADE Primary Logic + Production Handoff

Start from branch:

`import/ocade-primary-logic-20260826`

Do not start from an old `main` snapshot. Reconcile the branch with current `origin/main` first while preserving the import work.

The authoritative task is now:

`imports/ocade-primary-logic/CLAUDE_OPUS_5_MASTER_EXECUTION_PROMPT.md`

Read it completely and execute it. Older ZIP-specific handoff text is superseded.

Current source archive:

`.incoming/OCADE_PRIMARY_LOGIC.rar`

Verified archive identity:

- SHA-256: `a1ce51f92447ada16a52631a2fdf61ec4d5ff24efa1e078beaa00b6b4741f467`
- Git blob SHA-1: `c3121695459979b5ca77ac14e267488675fba7e4`
- bytes: `10,140,038`
- expected extracted files: `2,123`

Use `scripts/import-ocade-primary-logic.mjs` after extracting the RAR into a temporary directory. The importer now accepts an extracted directory or ZIP; it intentionally does not parse RAR directly.

Do not bulk-overwrite production `src/`. Stage, classify, trace, adapt or independently reimplement as appropriate, migrate callers/tests, verify, then remove superseded code.

Preserve OCADE's local-first model boundary, Supabase/RLS/auth, Cloudflare/public/OAuth contracts, extension/native permission boundaries, offline/PWA behavior and launch gates. Preserve legally required licence/copyright/attribution/provenance notices.

Primary engineering goals are shared Chat/Cowork runtime, real agent/tool wiring, one execution tool registry, browser/computer-control repair, one tasks system, coherent memory/search/projects/outputs, route/settings consolidation, original OCADE orb/control UX, responsive premium UI, performance hardening, security review and production proof.

Do not stop after an audit. Continue implementation autonomously until the master Definition of Done is satisfied or a genuine external credential/account action blocks only that specific step.
