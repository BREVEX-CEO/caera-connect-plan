# OCADE Primary Logic — Integration Map

## Target architecture

The production OCADE repository already has the authoritative product shell: TanStack Start, React 19, local WebGPU/WASM inference, Supabase authentication/sync, Cloudflare deployment and launch gating, Chrome/Edge extension Cowork execution, offline/PWA behavior and release proof tooling.

The imported donor tree is a **logic donor**, not a second application to mount beside OCADE.

## Disposition by donor area

| Donor area | Disposition | Production target |
|---|---|---|
| `src/Tool.ts` | ADAPT | OCADE tool contracts / agent registry |
| `src/Task.ts`, `src/tasks/**` | ADAPT | OCADE task lifecycle / background work |
| `src/tools/FileReadTool/**` | ADAPT | OCADE files tool, sandboxed |
| `src/tools/FileWriteTool/**` | ADAPT | OCADE files tool, permissioned |
| `src/tools/FileEditTool/**` | ADAPT | OCADE editing engine |
| `src/tools/GlobTool/**`, `GrepTool/**` | ADAPT | local project/file search |
| `src/tools/BashTool/**`, `PowerShellTool/**` | LOCAL-COMPANION ONLY | signed/local execution boundary |
| permission utilities/components | ADAPT | shared permission model / approval UX |
| history/session/memory utilities | ADAPT | OCADE local-first persistence |
| `src/services/compact/**` | REVIEW + ADAPT | context compaction |
| LSP/Git/IDE utilities | REVIEW + ADAPT | OCADE coding/work features |
| task/team/coordinator logic | LATER | multi-agent phase after single-agent proof |
| `src/QueryEngine.ts` | REWRITE ADAPTER | OCADE local inference boundary; do not retain donor provider transport |
| `src/services/api/**` | QUARANTINE | no direct production wiring |
| `src/services/oauth/**` | QUARANTINE | OCADE already has Supabase/Google auth |
| `src/bridge/**`, `src/remote/**`, `src/server/**` | QUARANTINE | no public Cloudflare execution path |
| analytics / remote settings / updater | DO NOT WIRE | existing OCADE policies remain authoritative |
| `src/services/ocadeTools/**` | AUDIT FIRST | treat as external tool-protocol transport until proven local/safe |
| `src/components/**`, `src/ink/**`, `src/screens/**` | REFERENCE | terminal UX patterns only; do not mount in browser UI |
| `web/**` | REFERENCE | separate Next.js 14 app; do not add a second router/framework |
| `docker/**`, Dockerfile | LOCAL/DEV ONLY | optional local companion/dev packaging |
| donor build scripts | REFERENCE | do not replace existing Vite/Cloudflare pipeline |

## Why direct merging would break OCADE

1. **Framework collision:** donor `web/` is Next.js 14/React 18 while OCADE is TanStack Start/Vite/React 19.
2. **Runtime collision:** donor CLI expects Bun, Ink, Node filesystem, shell and PTY access. Cloudflare Workers cannot provide those capabilities.
3. **Inference collision:** donor `QueryEngine` depends on its own protocol/service stack. OCADE already has a local browser model authority and must keep that boundary.
4. **Auth collision:** donor OAuth is stubbed/alternate; OCADE already uses Supabase + Google.
5. **Tool duplication:** OCADE already has agent/Cowork/browser tooling. A second registry would create duplicate commands, permissions and inconsistent receipts.
6. **Security collision:** donor Next file read/write APIs accept arbitrary filesystem paths. They are not safe web endpoints and must never be copied into OCADE production routes.
7. **Build instability:** donor validation itself reports unresolved relative imports and missing modules; adding it to `src/` would make production typecheck/build noisy or red.

## Safe integration order

### Phase A — staging and provenance

- extract archive under `imports/ocade-primary-logic/source/`
- preserve relative paths inside the donor tree
- remove stale vendor-only documentation from runtime packaging
- generate inventory: path, bytes, SHA-256, category, disposition
- run forbidden provider/network scans

### Phase B — tool kernel

Port, do not directly import:

- tool schema/factory concepts
- read-only vs mutating classification
- concurrency-safety metadata
- progress events
- result normalization
- permission hooks

Map those concepts onto the existing OCADE agent/tool registry.

### Phase C — safe local work tools

Port file read/search/edit/write behavior into OCADE's existing local sandbox and permission model. Add path-boundary, symlink, traversal and protected-file tests before enabling mutation.

### Phase D — task orchestration

Adapt task create/list/get/update/stop/output lifecycle, cancellation, background progress and durable receipts to OCADE's existing mission/task state.

### Phase E — coding-work features

Adapt Git/LSP/project utilities and terminal command patterns. Shell/PowerShell/PTY execution must run only through a local trusted companion/native boundary, never in Cloudflare.

### Phase F — memory/context

Selectively reuse compaction/session/history patterns while retaining OCADE's current local-first storage and Private Sync semantics.

### Phase G — optional multi-agent

Only after single-agent behavior is stable and proven: coordinator, teammate and background-agent patterns.

## Non-negotiable invariants

- no public hosted AI fallback
- no donor API/provider transport in normal Chat
- no arbitrary filesystem API route
- no hidden browser/PC action without permission policy
- no password/OTP/CVV/PIN/recovery-code automation
- every mutating agent action: observe → act → observe → verify
- STOP / PAUSE / TAKE OVER remain deterministic
- OCADE's Chrome/Edge extension remains the browser executor
- existing Supabase RLS and auth remain authoritative
- existing Cloudflare prelaunch/launch gate remains authoritative
- no new customer-facing model/vendor branding

## Definition of 'wired'

A donor concept is only 'wired' when all of the following are true:

1. reachable from an OCADE customer flow;
2. uses OCADE-native interfaces and runtime boundaries;
3. has no donor hosted-provider dependency;
4. permission and security rules are enforced;
5. focused tests pass;
6. surrounding tests pass;
7. typecheck/lint/build pass;
8. browser/runtime behavior is executed where possible;
9. source and runtime receipts identify the actual engine/executor;
10. no duplicate or obsolete product surface remains.
