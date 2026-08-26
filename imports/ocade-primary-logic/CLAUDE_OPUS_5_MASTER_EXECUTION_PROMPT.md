# OCADE — Claude Opus 5 Master Execution Prompt

## Outcome

Finish OCADE as one coherent production product by making the uploaded `OCADE_PRIMARY_LOGIC_RENAMED.zip` donor the primary implementation source for overlapping runtime logic, extracting and normalizing it, replacing broken/duplicate legacy OCADE implementations where the donor is stronger, wiring every surviving feature through one canonical route and service boundary, repairing all integration errors, then completing the UI/product redesign and production proof.

Do not return a plan-only audit. Execute the repository work autonomously until the Definition of Done is met or a genuine external blocker requires a secret/account action that cannot be performed from the coding environment.

Work on branch `import/ocade-primary-logic-20260826`. Do not start from an old `main` snapshot.

## Authoritative context

Repository: `BREVEX-CEO/caera-connect-plan`

Uploaded donor archive: `.incoming/*.zip`

Required donor SHA-256:
`4b9590a17222ba460c26905daba7273076d0bb42163f5a8e6d9cda9076de2e49`

Expected extracted file count: `2124`

Existing importer:
`scripts/import-ocade-primary-logic.mjs`

Staging root:
`imports/ocade-primary-logic/source/`

Read the existing import documentation and source inventory/receipt when generated. Treat the donor as a source code donor, not as a second application that should be mounted beside OCADE.

## Product architecture authority

The donor ZIP becomes the preferred implementation source for overlapping agent/runtime capabilities when its implementation is complete and compatible. Replace weak, broken, stale or duplicate OCADE logic with adapted donor logic rather than keeping two competing systems.

Do not blindly overwrite protected OCADE boundaries. Preserve these system authorities unless there is a proven bug that can be fixed without changing their external contract:

- current OCADE TanStack/React application shell and canonical product router
- browser-first/local-first normal Chat architecture
- no public-cloud AI inference fallback for normal OCADE Chat
- current local WebGPU/WASM model authority and local inference boundary
- Supabase authentication and Private Sync boundaries
- existing RLS/security model
- Cloudflare deployment/domain/public-route contracts
- prelaunch/launch readiness gates
- current legal/public URLs
- extension/native/local-companion security boundaries

## Hard Cloudflare boundary

Do not change, rename, replace or rotate the existing Cloudflare URLs, domains, route mappings, Worker endpoints, public legal URLs, OAuth-facing public URLs, DNS assumptions or deployment bindings as part of this integration/UI work.

The UI and runtime must adapt around the existing Cloudflare contracts.

If a Cloudflare-side change is truly unavoidable, stop that specific change and report the exact external requirement instead of silently modifying it.

## Donor integration goal

Use the donor at the fullest technically safe extent for capabilities such as:

- agent loop/orchestration
- tool registry and tool execution contracts
- task/background-run orchestration
- permission and human-approval patterns
- file search/read/edit/write concepts
- context/session/history management
- memory and compaction patterns
- command routing
- browser-control coordination
- local computer-control coordination
- handoffs
- task state and result state
- error/state normalization
- developer/runtime diagnostics where useful

For every overlapping subsystem, choose one canonical production implementation. Migrate all callers and tests to it, then remove or archive the obsolete competing implementation. Do not leave `legacy`, `new`, `v2`, donor and old implementations all active together.

The donor currently contains mixed runtime assumptions and unresolved imports. Repair its dependency graph as part of adaptation instead of copy-pasting broken files into production.

Never push Node/Bun-only filesystem, shell, PowerShell, PTY or process execution into the browser bundle. Those capabilities must stay behind a trusted local/native companion boundary with explicit permissions.

Do not mount the donor Next.js web application as a second product shell. Reuse/adapt useful UI logic or patterns only when they belong in the existing OCADE application.

Do not reintroduce hosted model-provider fallbacks or donor provider/API/OAuth systems into normal OCADE Chat.

## Canonical product routing

After integration there must be one clear, working route/surface for each real customer capability. Consolidate duplicates and repair direct navigation, refresh, back/forward and deep links.

Core customer surfaces should be simplified around:

- Chat
- Cowork / Control
- Projects
- Search
- Studio / Outputs
- Tasks / Automations
- Devices where genuinely useful
- Settings

Secondary/internal/admin/diagnostic routes must not compete with primary navigation.

MADEE/CANIA/FICIA or other future/unfinished products must not occupy prime navigation if they are only placeholders. Hide or feature-gate them until they provide real value.

## Cowork + browser/computer control

Rebuild the Control + Work experience as a first-class OCADE product, not an engineering dashboard.

Functional requirements:

- browser control must use the existing trusted browser/extension boundary
- computer control must use the correct local/native boundary
- permissions are explicit and scoped
- high-impact actions require the existing confirmation/safety model
- PAUSE, TAKE OVER and STOP are always obvious when OCADE is acting
- activity is observable in plain language
- failures do not leave phantom running state
- STOP actually stops the active run/action chain
- browser and PC-control states survive the necessary navigation/reconnect cases without lying to the user
- no fake control, fake success or fake execution states

The primary Cowork UI should be minimal and orb-centered, with contextual panels appearing only when useful.

Create an original OCADE state-driven orb inspired by high-quality Jarvis/orb interaction patterns. Do not copy another product's branding or exact trade dress. The orb should communicate real state:

- idle
- listening
- understanding
- thinking
- speaking
- acting
- waiting for approval
- paused
- takeover
- stopped
- error
- offline/local-only
- retrieval/network activity

Use restrained gold for confirmation/important intent and crimson for danger/STOP. The orb is a state language, not decoration.

## Remove complexity and duplication

The current customer-facing product exposes too much implementation detail. Simplify aggressively without deleting real capability.

Remove or consolidate:

- duplicate pages
- duplicate options
- duplicate settings
- dead controls
- controls that do not affect real behavior
- excessive instructional copy
- technical diagnostics from normal customer flows
- unnecessary cursor customization
- raw storage/database/browser internals from ordinary Settings
- raw model filenames/hashes from ordinary Settings
- placeholder product pages from main navigation

Settings should become a small set of understandable groups, approximately:

- Account
- Personalization
- AI & Voice
- Privacy & Data
- Devices & Control
- Plan & Billing
- Advanced

Advanced retains truthful diagnostics and provenance.

## Model naming and customer-facing AI identity

Do not prominently expose `Qwen`, raw model filenames, hashes, runtime implementation names or `SOMLLM` in the normal OCADE customer UI.

Customer-facing choices should communicate OCADE behavior, for example `Fast`, `Thinking`, `Local Intelligence`, or similarly clear OCADE-native labels.

Truthful underlying model/runtime provenance must remain available under Advanced diagnostics/model information where appropriate. Do not falsify origin; simplify presentation.

If `SOMLLM` is only an internal/undefined identifier, remove it from normal UI and either give it a precise internal definition or eliminate it if unused.

## Quick Appearance + Motion & Depth

Quick Appearance must contain only controls that visibly work. Remove controls that are cosmetic clutter or disconnected from behavior.

Appearance/accent changes must visibly propagate into the supported 3D/orb/environment treatment rather than changing only a small UI token.

Simplify motion/depth controls into understandable presets instead of exposing many technical sliders. A suitable product model is:

- Motion: Off / Balanced / Immersive
- Depth: Low / Standard / High

Map those presets internally to the actual animation/parallax/particle/GPU configuration.

## UI design authority

The redesign must feel simpler than the current product while looking more premium and spatial. The target is Claude/ChatGPT-level surface simplicity with OCADE's deeper local/control capabilities underneath.

### Login / authentication — ECHOID-inspired

Use the user-supplied ECHOID design direction for OCADE authentication:

- full-viewport black cinematic composition
- full-bleed dark AI/surreal background media
- minimal top navigation/brand treatment
- right-aligned authentication panel on desktop, responsive on mobile
- sharp, restrained controls rather than generic rounded dashboard cards
- minimal copy
- strong typography hierarchy
- proper keyboard/focus behavior
- reduced-motion fallback using a poster/static background
- no fake invite/referral behavior unless OCADE actually supports it
- replace all ECHOID/E-network copy with OCADE/CARCC CADANE product copy

Reference media supplied by the user:
`https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260806_133255_956f653f-5d80-4b06-abd5-0f46c98b60fa.mp4`

Poster:
`https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260806_132328_5f9029c8-218f-4489-82b6-29ff2849920e.png`

Use only where legally/technically appropriate; keep a local/fallback path so auth remains usable if media fails.

### Global product/site language — Operational AI Infrastructure-inspired

Use the user-supplied Operational AI Infrastructure direction as the dominant visual language for most pages:

- pure black foundation
- crisp white/silver typography
- restrained metallic/liquid interaction surfaces
- Inter/system UI typography with selective editorial serif emphasis where appropriate
- controlled entrance motion
- premium hover/focus states
- strong whitespace and hierarchy
- background/ambient presence that never prevents content interaction
- no white flash
- responsive/mobile behavior
- reduced-motion behavior
- avoid rainbow gaming aesthetics and excessive glowing chrome

Reference background media supplied by the user:
`https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260818_072341_50851634-bbc3-4c33-9acc-7647d4db44aa.mp4`

Do not force this media onto every page if it harms readability/performance; preserve the design language with lighter ambient treatment on precision/settings surfaces.

### Glass overlays / focused surfaces — Terranova-inspired

Use the user-supplied Terranova direction selectively for overlays, confirmation sheets, Cowork contextual panels, device pairing, model download/progress and other high-value focused surfaces:

- refractive/liquid-glass feel
- clear foreground/content stacking
- restrained frost and border treatment
- premium open/close motion
- do not run expensive live refraction on every card/page
- use simpler CSS/backdrop fallbacks on weaker devices

Reference media supplied by the user:
`https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260816_125506_3a597378-ec85-4ebd-bd22-03b45508ac62.mp4`

The source reference deliberately uses a live duplicated video + SVG displacement effect; adapt the visual result only where the performance budget supports it. Do not make the entire application depend on a per-frame canvas refraction pipeline.

## Global focus-depth behavior

When a drawer, modal, command surface, confirmation or critical permission sheet opens, the background should reduce visual dominance consistently.

Use one shared focus-depth system:

- ordinary page: full ambient presence
- drawer/sheet: background reduced
- important modal: stronger dim/blur
- permission/security confirmation: stronger focus isolation
- emergency STOP state: almost all visual noise removed

Transitions should feel fast and premium, not cinematicly slow.

## Performance requirements

Interactive/3D design must remain fast.

Use performance tiers rather than WebGL everywhere:

- Cinematic: Login, Voice, Cowork/Control and a small number of hero experiences
- Spatial: Projects, Search, Studio, Tasks, Devices using lightweight depth and limited effects
- Precision: Settings, Privacy, Security, Billing, Local Engine using mostly static premium UI with small ambient cues

3D/orb code must lazy-load outside the critical shell, dispose resources when leaving, pause/reduce work when hidden, respect reduced motion, cap DPR/particle load, and provide a lightweight fallback.

Do not let UI polish regress startup, typing latency, scrolling, navigation, model inference or control responsiveness.

## Product-state honesty

Every enabled button must execute a real action.

Every route must either:

- load a real working page,
- intentionally redirect,
- or show an honest setup/access/unavailable state.

Do not use fake successes, fake uploads, fake AI responses, fake device activity, fake automation runs or fake control states.

Technical errors should be translated into customer language first, with optional expandable diagnostics.

## Data/storage presentation

Normal customers should not see low-level IndexedDB/cache/model-file/hash details by default.

Show a simple storage summary such as local space used + Manage Storage. Put implementation details in Advanced diagnostics.

Preserve actual local/offline behavior and storage management underneath.

## Testing and Definition of Done

The work is done only when all of the following are true:

1. The uploaded ZIP is extracted and verified by exact SHA-256 and exact `2124` file count.
2. `IMPORT_RECEIPT.json` and `SOURCE_INVENTORY.json` accurately describe the extracted donor.
3. Donor logic is adapted into production rather than merely stored in `imports/`.
4. Overlapping old/broken logic is migrated or removed so one canonical implementation remains per subsystem.
5. Unresolved donor imports used by production are fixed; quarantined/reference-only donor files do not leak into production builds.
6. Chat/local inference authority remains local-first with no hosted inference fallback.
7. Browser control and Cowork computer control work through correct trusted boundaries with real permissions and STOP/PAUSE/TAKE OVER behavior.
8. Direct routes, refresh, back/forward and deep links work for surviving customer pages.
9. Duplicate/dead/placeholder customer pages and settings are removed or feature-gated.
10. Qwen/raw model implementation details and SOMLLM do not dominate normal UI; provenance remains truthful in Advanced.
11. Login follows the OCADE-adapted ECHOID direction.
12. Main product UI follows the Operational AI Infrastructure direction without becoming visually noisy.
13. Selective glass/focus surfaces follow the Terranova direction without introducing broad performance regressions.
14. Appearance controls visibly work, including supported orb/3D accent propagation.
15. Motion/depth settings are simplified and functional.
16. Desktop and mobile layouts are production-quality.
17. Keyboard/focus/accessibility and `prefers-reduced-motion` are respected.
18. Console/network errors caused by OCADE code are resolved in tested customer journeys.
19. Typecheck, lint, production build and relevant automated tests pass.
20. Existing Cloudflare URLs/routes/contracts remain unchanged.
21. Existing public legal/OAuth URLs remain unchanged.
22. Launch gate remains closed until the final production proof is clean; do not open it merely because the calendar date arrives.
23. The final repository contains no obvious duplicate runtime/router/task/tool/control implementations left active without a documented reason.

## Execution behavior

Use autonomous repository execution. Read broadly enough to understand dependencies, then implement and verify end-to-end. Make checkpoint commits by coherent integration slice so work can be recovered.

Do not stop after telling the user what should be changed. Change it.

Do not ask the user to edit source code manually.

Do not micromanage your own work back to the user. Keep user-facing updates concise and outcome-oriented.

If blocked only by an external credential/account action, finish every independent code task first, then report the smallest exact manual action required.

Final response should be concise and include:

- branch and final commit SHA
- donor integration summary
- old implementations removed/replaced
- routes/features verified
- UI surfaces redesigned
- tests/build results
- any genuine external blocker
- whether it is safe to proceed to final launch verification
