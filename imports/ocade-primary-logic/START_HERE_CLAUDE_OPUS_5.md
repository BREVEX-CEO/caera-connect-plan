# START HERE — Claude Opus 5 OCADE takeover

Work from branch `import/ocade-primary-logic-20260826`.

The current user-supplied primary-logic archive is expected at:

`.incoming/OCADE_PRIMARY_LOGIC(1).rar`

Required SHA-256:

`a1ce51f92447ada16a52631a2fdf61ec4d5ff24efa1e078beaa00b6b4741f467`

Expected archive inventory:

- 2,123 files
- 346 directories
- 33,932,339 uncompressed bytes

## Mandatory extraction gate

Before any production integration:

1. Verify branch/status/recent commits.
2. Verify the RAR hash exactly.
3. Extract it in the Claude coding environment into an isolated temporary location.
4. Inventory every extracted file and compare the file count/structure to the archive.
5. Scan the extracted tree for unresolved internal imports, missing dependencies, duplicate runtimes, unsafe browser/server boundaries, stale routes, secrets or credentials, and licensing/provenance requirements.
6. Stage the extracted source under `imports/ocade-primary-logic/source/`; do not bulk-overwrite production `src/`.
7. Generate/update `IMPORT_RECEIPT.json`, `SOURCE_INVENTORY.json`, and the integration analysis from the actual revised archive.
8. Treat existing OCADE TanStack/React, local-first inference, Supabase/RLS, Cloudflare/public URLs, extension/native safety boundaries and launch gates as protected authorities unless repository evidence proves a specific replacement is safer and better.

## Integration objective

After the extraction gate, trace every overlapping subsystem and choose one canonical production implementation. Repair and adapt useful source, replace weaker/broken/duplicate OCADE logic only where justified, migrate all callers/routes/tests, then remove superseded implementations after proof. Prioritize Chat ↔ agent/tool wiring, browser control, computer control/Cowork, tasks/automations, memory/projects/search/outputs, route consolidation and Settings simplification.

Never put filesystem/shell/PTY/process execution in the browser bundle. Keep those behind the local/native boundary. Keep normal OCADE Chat local-first and do not add public-cloud AI fallback.

Do not change working Cloudflare domains, OAuth URLs, legal URLs or verified public routes as part of the integration.

## UI phase

Only after functional integration is stable, execute the OCADE UI/product redesign using the attached ECHOID, Operational AI Infrastructure and Terranova references as design references: cinematic minimal auth, premium black/silver product language, selective liquid glass, and an original state-driven OCADE orb for Cowork/Control. Keep it fast, responsive and reduced-motion safe.

## Definition of done

Run and repair focused tests during each slice, then typecheck, lint, build, route/auth/local-model/agent/tool/browser-control/Cowork/offline/mobile/desktop/security/RLS/Cloudflare/release gates. Keep checkpoint commits. Do not merge to `main` or open the launch gate until production proof is genuinely clean.

Do the repository work autonomously; do not ask the user to edit source code manually. Stop only for a genuine external credential/account decision that cannot be resolved from the repository or coding environment.
