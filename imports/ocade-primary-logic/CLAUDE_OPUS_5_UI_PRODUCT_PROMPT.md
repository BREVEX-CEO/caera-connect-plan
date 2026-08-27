# Claude Opus 5 — OCADE UI + Product Integration Execution Prompt

You are taking over OCADE as the principal product designer, principal frontend engineer, agent-systems engineer, performance engineer and release engineer.

Repository: `BREVEX-CEO/caera-connect-plan`

Start from branch:

`import/ocade-primary-logic-20260826`

Do not start from an older `main` snapshot and do not replace the existing OCADE architecture wholesale.

## 0. First prove the donor import exists

Before changing product code, verify all of the following:

- `imports/ocade-primary-logic/IMPORT_RECEIPT.json` exists.
- `imports/ocade-primary-logic/SOURCE_INVENTORY.json` exists.
- `imports/ocade-primary-logic/source/src/` exists.
- the import receipt reports more than 2,000 extracted files.
- read `imports/ocade-primary-logic/README.md`.
- read `imports/ocade-primary-logic/IMPORT_ANALYSIS.json`.
- read `imports/ocade-primary-logic/INTEGRATION_MAP.md`.
- read `imports/ocade-primary-logic/CLAUDE_HANDOFF.md`.

If the extracted source is not present, stop product integration and run/fix the importer first. Do not pretend the donor source was reviewed when it was not.

The donor archive is a staging/reference tree, not a second production application. Its package is marked `UNLICENSED` and contains no licence file, so do not assume commercial redistribution rights. Prefer OCADE-native rewrites/adapters of useful concepts and keep provenance-sensitive source quarantined until rights are confirmed.

## 1. Preserve OCADE's current production authorities

The existing application remains authoritative for:

- TanStack Start / Vite / React 19 application shell and routing;
- browser-local WebGPU/WASM inference;
- OCADE's model authority and Fast/Thinking runtime boundary;
- Supabase authentication, Private Sync and RLS;
- Cloudflare deployment and launch gate;
- the Chrome/Edge MV3 extension as the real browser executor;
- PWA/offline behavior;
- existing STOP / PAUSE / TAKE OVER safety behavior;
- existing launch-proof and release gates.

Do not introduce a second Next.js router. Do not mount donor `web/` into production. Do not route normal OCADE Chat through a hosted AI provider. Do not replace Supabase auth. Do not make Node/Bun filesystem, PTY or child-process code reachable from Cloudflare.

## 2. Donor-code integration strategy

Treat `imports/ocade-primary-logic/source/` as a logic donor only.

High-value concepts to inspect and selectively port:

- `src/Tool.ts`, `src/tools/**` — tool contracts, read-only/mutation metadata, permission hooks, progress/result patterns;
- `src/Task.ts`, `src/tasks/**` — durable task lifecycle, background progress, cancellation and receipts;
- file read/search/edit/write patterns — but route through OCADE's existing sandbox and permission boundaries;
- permission and human-handoff logic;
- session/history/memory/compaction patterns that improve OCADE without creating a second persistence authority;
- Git/LSP/project/coding-work patterns where they add real product value;
- multi-agent/coordinator patterns only after single-agent behavior is stable.

Quarantine/reference only:

- donor `QueryEngine` provider/service transport;
- `src/services/api/**` and `src/services/oauth/**`;
- analytics/updater/remote-managed-settings authority;
- `src/bridge/**`, `src/remote/**`, `src/server/**` unless an individual concept is clean-room adapted behind an OCADE-native boundary;
- `web/**` Next.js application;
- `src/components/**`, `src/ink/**`, `src/screens/**` terminal UI as direct browser UI;
- Bash/PowerShell/PTY/filesystem/process code except behind a local trusted companion/native boundary.

Do not register a second tool registry, second permission authority, second task engine, second auth system, second model engine or duplicate page just because one exists in the donor tree. Compare, choose the stronger implementation, port what is useful, migrate callers, test it, then remove the superseded duplicate.

## 3. Product goal: Claude/ChatGPT simplicity with OCADE-level depth underneath

The current customer UI exposes too much machinery. Reduce visible complexity aggressively.

The top-level product should feel simple and obvious. Prefer roughly:

- Chat
- Cowork / Control
- Projects
- Search
- Studio
- Tasks / Automations
- Settings

Hide or remove primary-navigation entries that are empty placeholders, duplicates, internal tools or future products with no current user value.

Do not make customers understand OCADE's runtime architecture just to use OCADE.

## 4. Login / authentication — ECHOID design direction

Rebuild the login experience using the ECHOID reference as design inspiration, adapted completely to OCADE branding and existing Supabase/Google authentication.

Desired feel:

- single full-viewport black cinematic experience;
- full-bleed background media, never an inset video card;
- OCADE/CARCC CADANE identity, not ECHOID copy;
- minimal navigation;
- restrained right-aligned authentication panel on wide screens;
- strong negative space;
- premium typography;
- Google sign-in and currently supported authentication only;
- no fake auth providers;
- poster/static fallback;
- reduced-motion mode must disable nonessential video/motion;
- mobile layout remains usable and fast.

Do not break the already-working Google → Supabase → OCADE login flow.

## 5. Global OCADE visual language — Operational AI Infrastructure direction

Use the Operational AI Infrastructure/Vesper reference as the global design language, not as copied content.

Palette hierarchy:

- black = environment;
- silver/white = structure, typography and neutral controls;
- aubergine = intelligence/depth/ambient spatial light;
- gold = premium/important/confirmation intent;
- crimson = danger/STOP/destructive operations only.

Do not spray all colors across every component. Most UI remains black/silver. Color communicates meaning.

Create a global ambient visual layer that can be reused across product pages without forcing every page to run a heavy WebGL scene.

When a dialog, sheet, command surface or important modal opens:

- reduce background visual opacity;
- add controlled blur/dimming;
- preserve context behind the foreground surface;
- freeze/reduce background motion for high-risk confirmation states;
- use fast 180–320ms transitions rather than slow cinematic delays.

## 6. 3D motion and depth — simplify the controls

Do not expose a developer-quality-control panel to normal users.

Quick Appearance must contain only options that produce a visible customer-facing change. Remove cursor-selection clutter unless there is a strong accessibility reason and it actually works.

Accent/color selection must visibly affect:

- orb lighting;
- ambient 3D environment;
- focus/selection accents;
- active premium controls.

Simplify motion/depth to understandable presets, for example:

- Motion: Off / Balanced / Immersive
- Depth: Low / Standard / High

OCADE should internally choose particle count, blur intensity, parallax, DPR and animation quality from the preset and device capability.

## 7. Cowork / Control — complete redesign

The current Control + Work/Cowork dashboard is visually overloaded and must be replaced with a much simpler Jarvis-like presence.

Use the interaction concept of SAGAR-TAMANG/ultron-by-sagar-builds as inspiration for an ORIGINAL OCADE orb implementation. Do not copy third-party code unless its licence clearly allows the intended use and attribution obligations are satisfied.

Core composition:

- center = living OCADE orb;
- bottom = primary task/composer input;
- left/right contextual panels appear only when needed;
- current task, observation timeline, permissions and verification appear progressively rather than permanently occupying the screen;
- PAUSE, TAKE OVER and STOP are always obvious;
- STOP is the one strong crimson emergency control.

Orb states must correspond to real product state:

- idle — slow breathing core;
- listening — audio-reactive expansion;
- understanding/thinking — particles reorganize inward;
- speaking — surface/audio ripple;
- acting — orbit/action movement;
- waiting for confirmation — motion settles and gold confirmation ring appears;
- paused — suspended/frozen state;
- takeover — orb yields/recedes;
- error — controlled fracture/error state, not noisy flashing;
- offline — compact self-contained core;
- online retrieval — temporary external connection ring.

The orb is a status language, not decoration.

For mutating computer/browser actions preserve:

OBSERVE → ACT → OBSERVE AGAIN → VERIFY.

Protected inputs such as passwords, OTP, CAPTCHA, CVV, PIN and recovery codes always pause for the user.

## 8. Terranova-style spatial glass — selective use only

Use Terranova's refractive/liquid-glass concept for high-value foreground surfaces such as:

- Cowork confirmations;
- voice HUD;
- device pairing;
- command palette;
- model download/install sheet;
- permission/handoff dialogs;
- important onboarding steps.

Do not run expensive refraction behind every settings card. Provide a CSS/frost fallback and reduced-motion/low-power fallback.

## 9. Settings — radical simplification

Collapse Settings to approximately:

1. Account
2. Personalization
3. AI & Voice
4. Privacy & Data
5. Devices & Control
6. Plan & Billing
7. Advanced

Move current sub-settings under these canonical owners and delete duplicate entry points.

Every setting must satisfy one of these states:

- works, persists and changes runtime behavior;
- intentionally disabled with a clear reason;
- removed.

No dead switches.

Remove repeated explanatory paragraphs from the first level. Use a short title + one-sentence explanation; place technical details under Learn more / Advanced.

## 10. Model branding — major commercial rule

Normal customers must NOT see raw third-party implementation branding such as:

- Qwen model names;
- raw GGUF filenames;
- model hashes;
- unexplained internal names such as SOMLLM;
- low-level runtime/provider identifiers.

Customer-facing model choices should be OCADE product concepts such as:

- Fast
- Thinking
- OCADE Local Intelligence

Necessary model provenance/licensing/diagnostic information belongs in Advanced → Model information/Diagnostics where technically sophisticated users can inspect it.

Do not falsify provenance; hide implementation clutter from primary UI, not legal/licensing facts that must be disclosed.

## 11. Storage — simplify customer presentation

Do not lead with IndexedDB, OPFS, browser cache keys, individual model files or hashes.

Normal UI should look like:

Local storage — X GB used
Manage storage

Inside Manage Storage, show understandable categories such as models, conversations, files, projects and cache. Low-level database/filesystem diagnostics live under Advanced.

## 12. Remove duplicate pages and options

Build an authoritative route/page inventory before redesigning.

For every route and navigation item classify it:

- KEEP
- MERGE INTO
- HIDE UNTIL READY
- ADVANCED ONLY
- DELETE

Do not leave two pages that control the same underlying setting or feature. Do not leave placeholder products in primary navigation merely because source files exist. Do not leave theoretical pricing that looks purchasable while payments are disabled.

Search, Projects, Studio, Tasks and empty states must teach the customer what to do next instead of presenting large empty black areas.

## 13. Visual performance tiers

Every page should feel interactive, but not every page should run heavy 3D.

Tier A — Cinematic:

- Login
- Home
- Cowork / Control
- Voice

Allowed: real Three.js/video/reactive orb, lazy-loaded.

Tier B — Spatial:

- Projects
- Search
- Studio
- Tasks
- Artifacts
- Devices

Use lightweight perspective, controlled particles, glass, motion and depth.

Tier C — Precision:

- Settings
- Privacy
- Security
- Billing
- Advanced diagnostics

Use high-quality typography, hierarchy, subtle ambient depth and fast micro-interactions. Avoid continuous GPU-heavy scenes.

## 14. Performance requirements

3D must never delay the app shell.

- lazy-load heavy 3D/orb bundles;
- prefetch Cowork/orb assets opportunistically after the primary UI is interactive;
- cap device pixel ratio adaptively;
- adaptive particle counts;
- stop/reduce render loops when the tab is hidden;
- stop/reduce background rendering when a foreground modal fully obscures it;
- target 60 FPS on capable hardware with a controlled 30 FPS/degraded fallback;
- respect `prefers-reduced-motion`;
- avoid layout thrash;
- keep mobile memory/GPU limits in mind;
- dispose Three.js/WebGL resources on unmount;
- measure bundle size, route load time and interaction responsiveness after each major redesign slice.

## 15. Error and empty-state quality

Do not show raw Supabase, Postgres, environment-variable, model-file or stack-trace errors to normal customers.

Customer message first:

- what failed;
- whether local data is safe;
- what still works;
- Retry / Fix / Learn more.

Put raw technical details behind an expandable diagnostics section.

Empty states must be actionable and educational, not just “No items yet.”

## 16. Do the work, do not only audit

Work in bounded slices:

READ → TRACE → CODE → RUN → BREAK → FIX → RETEST → VERIFY → COMMIT.

Recommended order:

1. baseline + route/settings inventory;
2. duplicate/dead-surface consolidation plan and safe removals;
3. shared design tokens/layout/motion primitives;
4. login redesign without breaking auth;
5. global shell/navigation simplification;
6. Settings consolidation and functional control audit;
7. Cowork/Control orb redesign while preserving executor/safety semantics;
8. Search/Projects/Studio/Tasks spatial redesign;
9. model/storage/customer-facing terminology cleanup;
10. responsive/mobile/a11y/reduced-motion pass;
11. performance optimization;
12. full production proof.

Do not ask the owner to edit source files manually. The owner is a vibe-coder and expects the coding agent to perform repository changes, tests, commits and fixes directly.

## 17. Testing definition of done

At minimum execute and fix until green where available:

- typecheck;
- lint;
- focused component/route tests;
- full test suite;
- production build;
- route/direct-URL QA;
- real Chrome desktop QA;
- mobile viewport QA;
- keyboard/focus QA;
- reduced-motion QA;
- console/network error sweep;
- Settings persistence/runtime-effect tests;
- Chat Fast/Thinking/Stop/Regenerate/persistence;
- local WebGPU/WASM behavior;
- Cowork browser-extension pairing and real actions;
- PAUSE / TAKE OVER / STOP;
- offline/online transitions;
- Supabase/auth/RLS regressions;
- launch source checks and existing release gates.

Do not call a feature working because source exists or because a unit test exists. Execute the reachable customer flow.

## 18. Merge discipline

Make checkpoint commits so work is recoverable. Keep the donor tree isolated. Remove superseded production code only after replacements are proven. Do not weaken existing launch/security/model-provider regression gates just to make the redesign pass.

Do not merge/release any provenance-sensitive donor code commercially until its reuse rights are established.

Keep the public launch gate closed until final product proof and launch authority are independently satisfied.

Final outcome: OCADE should present Claude/ChatGPT-level simplicity, with OCADE's deeper local-first, Cowork, automation, privacy and control capabilities hidden behind progressive disclosure rather than exposed as configuration clutter.
