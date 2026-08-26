# OCADE Primary Logic — Staging Area

This directory is the controlled staging point for the user-provided `OCADE_PRIMARY_LOGIC_RENAMED(1).zip` archive before selective integration into the production OCADE application.

## Archive inventory verified on 26 August 2026

- Extracted root: `OCADE_PRIMARY_LOGIC/`
- Files in uploaded archive: **2,124**
- Uncompressed bytes: **33,941,081**
- Approximate text lines: **544,055**
- TypeScript: **1,439 `.ts`**
- TSX: **634 `.tsx`**
- JavaScript: **20 `.js`**
- JSON: **11**
- Markdown: **4**
- Shell: **4**
- CSS: **3**
- Other: TOML/YAML/SVG/HTML/example files

Largest functional areas:

- `src/utils/` — 563 files
- `src/components/` — 389 files
- `src/commands/` — 209 files
- `src/tools/` — 184 files
- `src/services/` — 137 files
- `src/hooks/` — 104 files
- `src/ink/` — 96 files
- `web/` — 151 files (separate Next.js application)

The archive's own validation file labels it `READY_FOR_REPO_STAGING_NOT_WIRED`. It also reports **357 unique unresolved relative imports** and **2,178 TS2307 missing-module diagnostics** in the sanitized tree. Therefore this donor tree must **not** be dropped into the production build path wholesale.

## What this source actually contains

The archive is a large agent/coding-runtime donor tree with:

- core tool abstractions (`Task`, `Tool`, `QueryEngine`)
- file read/write/edit, Bash and PowerShell tools
- tool permissions and human-approval flows
- task orchestration, background tasks and multi-agent patterns
- session/history/memory utilities
- terminal/Ink UI and prompt-input logic
- Git/LSP/IDE utilities
- plugin/skill/command patterns
- bridge/remote/server code
- a separate Next.js web chat UI
- Docker/build scripts

## Production integration rule

**OCADE's existing TanStack/React/Cloudflare application remains authoritative.** This donor source is never allowed to replace the existing router, auth, local-model engine, Supabase layer, Cloudflare launch gate, extension executor, or production release system.

Integration must be selective and adapter-based:

1. Preserve the donor source under this staging namespace.
2. Classify each module before it is reachable from production code.
3. Port reusable logic into OCADE-native modules instead of importing the donor runtime directly.
4. Keep Node/Bun/process/filesystem/PTY code behind a local companion or desktop boundary.
5. Keep normal web AI inference on OCADE's existing local WebGPU/WASM runtime.
6. Never wire donor hosted-model API, vendor OAuth, remote bridge, telemetry, updater or tool-server transport into the production web application.
7. No imported module becomes production-reachable until focused tests, surrounding tests, typecheck, build and launch gates pass.

## High-value reusable areas

- `src/Tool.ts` + `src/tools/**`: tool schema/registry patterns
- `src/Task.ts` + `src/tasks/**`: task lifecycle and background-work patterns
- permission components/utilities: approval, denial and protected-action UX
- session/history/memory utilities: selectively adapt to OCADE's current persistence model
- file/edit/search/grep tool logic: adapt behind OCADE's permission and sandbox boundaries
- terminal/Bash/PowerShell patterns: local companion only
- multi-agent coordination patterns: later phase, after single-agent stability

## Quarantined / reference-only areas

- `web/**`: Next.js 14 + React 18 app; OCADE production uses TanStack Start + React 19
- `src/components/**` and `src/ink/**`: terminal UI reference, not direct browser UI
- `src/bridge/**`, `src/remote/**`, `src/server/**`: remote/server assumptions; not production web paths
- `src/services/api/**`, `src/services/oauth/**`, analytics/updater/remote-managed settings: do not wire without a separate security review
- unrestricted donor file APIs: never expose server-side arbitrary `path.resolve()` read/write routes to the web
- generated terminal bundle and other generated artifacts: do not duplicate into the production client

## Provenance / cleanup note

The uploaded tree still contains a small number of stale vendor/reference strings in documentation and secret-detection examples. Those are not evidence of an active hosted-model route, but they must remain out of customer-facing OCADE branding and out of any active provider path.

## Next action

Use `INTEGRATION_MAP.md` as the implementation order. The archive should be imported into this staging directory by a coding environment that has direct filesystem access to the uploaded ZIP, then reusable modules should be ported into the existing OCADE architecture one bounded slice at a time.
