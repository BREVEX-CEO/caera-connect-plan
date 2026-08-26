# Claude Opus 5 — OCADE Primary Logic + UI Handoff

Start from branch `import/ocade-primary-logic-20260826`. Do not start from an older `main` snapshot.

Read these first:

1. `imports/ocade-primary-logic/README.md`
2. `imports/ocade-primary-logic/IMPORT_ANALYSIS.json`
3. `imports/ocade-primary-logic/INTEGRATION_MAP.md`
4. `scripts/import-ocade-primary-logic.mjs`
5. the existing OCADE agent loop, tool registry, local model authority, Cowork/extension, Settings, routes and design system

Then use the attached `OCADE_PRIMARY_LOGIC_RENAMED(1).zip` as a logic donor.

## Required workflow

- Run the importer to place the extracted donor tree under `imports/ocade-primary-logic/source/` and generate its inventory/receipt.
- Commit the staged import before product integration so provenance is preserved.
- Do NOT add the donor source directory to the production TypeScript build or import it wholesale.
- Classify every donor area as ADAPT / LOCAL-COMPANION / REFERENCE / QUARANTINE / DO-NOT-WIRE.
- Port reusable logic into OCADE-native modules. Preserve existing OCADE authorities: TanStack Start, React 19, browser-local WebGPU/WASM model runtime, Supabase auth/sync, Cloudflare, Chrome/Edge extension browser executor, offline/PWA and launch gates.
- Do not create a second Next.js app/router. Do not replace OCADE auth. Do not route normal Chat to a hosted AI provider. Do not expose arbitrary filesystem read/write endpoints.
- Use donor Tool/Task/permission/session/memory/file-edit/task-orchestration patterns where they improve OCADE, but remove duplicates instead of maintaining two implementations.
- Shell/PowerShell/PTY/process/filesystem execution belongs behind a local companion/native boundary, never the Cloudflare Worker.

## UI redesign goal

Make OCADE feel as simple and premium as Claude/ChatGPT while keeping its deeper capability underneath.

- Login: ECHOID-style cinematic minimal auth surface adapted to OCADE branding.
- Global product language: Operational-AI-Infrastructure-style black/silver environment with restrained aubergine/gold/crimson accents, premium typography, depth and meaningful motion.
- Focus surfaces/modals: Terranova-inspired refractive/liquid-glass treatment, but performance-safe.
- Cowork/Control: replace the current dashboard-heavy UI with an OCADE orb presence. Center = living orb; bottom = task input; contextual side panels only when needed. PAUSE, TAKE OVER and STOP must be obvious. STOP is the primary crimson emergency control.
- Orb states must mean something: idle, listening, thinking, speaking, acting, waiting for confirmation, paused, error, offline and online retrieval.
- Quick Appearance: remove useless controls. Keep only controls that visibly change the product. Accent/color changes must visibly affect the 3D environment/orb/accent lighting. Simplify Motion/Depth to a few understandable levels.
- Remove customer-facing model/vendor internals such as Qwen names, raw model filenames, hashes and unexplained internal names such as SOMLLM. Put necessary provenance in Advanced diagnostics only.
- Remove duplicate Settings, duplicate pages, dead navigation, empty placeholder products and repeated instructions. Collapse Settings into roughly Account, Personalization, AI & Voice, Privacy & Data, Devices & Control, Plan & Billing, Advanced.
- Hide raw storage/IndexedDB/OPFS details from normal users. Show a simple storage summary plus Manage Storage; technical internals live in Advanced.
- Every control must either work, persist and change runtime behavior, or be removed/disabled with an honest state.
- Use three visual-performance tiers: cinematic 3D only on Login/Home/Cowork/Voice; lightweight spatial depth on Projects/Search/Studio/Tasks; precision UI with subtle motion on Settings/Privacy/Security/Billing.
- No fake stats, fake clients, fake social links, fake buttons or decorative 3D that harms performance.

## Engineering definition of done

READ → TRACE → CODE → RUN → BREAK → FIX → RETEST → VERIFY.

Run localhost as a real customer in Chrome. Test desktop and mobile layouts, keyboard/focus, reduced motion, loading/error/empty states, direct URLs, refresh/back-forward, offline behavior and console/network errors. Run focused tests after every integration slice, then full typecheck/lint/build/test/release gates. Do not call source existence “working.”

After the import and redesign are fully green, remove superseded code and duplicated routes/components, update documentation, push checkpoints, open/finish the PR, and merge only when the production build and applicable runtime proof are clean. Keep the public launch gate closed until the separate final launch-readiness decision.
