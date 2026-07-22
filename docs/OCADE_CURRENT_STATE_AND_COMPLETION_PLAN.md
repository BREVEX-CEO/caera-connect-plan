# OCADE — Current-State & Master Completion Plan

> **Document type:** Planning only. No application code, migrations, configuration, environment,
> dependencies, or lockfiles are changed by this document. Evidence is traceable to real files at
> branch base `origin/main` (`cd0ad8f`).
>
> **Truthfulness contract:** Nothing is marked complete unless the codebase proves it works.
> Planned/expanded capabilities are labelled with the status taxonomy in §0. No fake data, fake
> providers, fake success, or fake completion is used as evidence.

---

## 0. How to read this document (status taxonomy)

Every capability is tagged with one status:

- **WORKING** — real code + real data path, verified by reading the source.
- **PARTIAL** — real but incomplete or environment-limited.
- **DEMO-ONLY** — exists only under `/demo/*` (in-memory, never touches Supabase).
- **UI-ONLY** — rendered control with no real action behind it (should be gated per No-Dead-Button).
- **SETUP-REQUIRED** — real design, disabled until a credential/provider/config is supplied.
- **NATIVE-COMPANION-REQUIRED** — impossible in the browser; needs the signed native companion.
- **PLANNED** — a confirmed target with no implementation yet.
- **MISSING** — required by the vision, absent from the code.
- **BLOCKED** — depends on external infra/credentials/legal clearance.
- **COMPLETED-AFTER-IMPLEMENTATION** — used only in the phase plan to mark exit criteria.

---

# PART A — VERIFIED CURRENT STATE (truthful audit, preserved & updated)

## 1. Executive summary

CAERA CADANE is a **TanStack Start** SSR app (React 19, Vite 8, Tailwind v4, file-based routing),
with Supabase for DB/auth and a single real model path via the **Lovable AI Gateway**. The
platform already ships a genuinely honest foundation: a **FeatureRegistry** with a "No-Dead-Button"
registration guard, a compliance-aware **ActionRegistry**, three real storage adapters
(AES-GCM IndexedDB, Supabase-sync, and a deliberately-throwing PC-vault), Demo-mode isolation, a
three-theme system with correct gradient ownership, and a full custom-cursor system.

**OCADE today** is a working text+image chat assistant (streaming, persisted, privacy-enforced)
with real prompt-improve and provider diagnostics — but the chat route **hardcodes** the Lovable
provider, there are **no local (Ollama) models**, the model catalog uses **unverified future model
IDs**, and the big product vision (OCADE Voice, wake phrase, desktop copilot, PC/browser/software
control, native companion, mobile companion, memory, automations, video responses, subscriptions,
capability-label identity, offline-first) is **almost entirely MISSING as code** — present only as
honest placeholders. This plan turns that vision into an ordered, testable build while keeping every
claim truthful.

**Confirmed product direction (from the clarification rounds):** OCADE is the single product
identity; local-first with unlimited local processing and permissioned OCADE Cloud (28 uses / 8h);
zero user-facing API keys; capability-label identity (no raw model names in ordinary UI); Tauri +
Rust native companion with bounded low-risk PC control; unified Windows/macOS/Android/iOS
architecture; opt-in "Hello OCADE" wake phrase; original male/female voices; hybrid video
responses; 2/8-day, 1-month, 1-year plans; and testing/security/rollback/packaging as first-class
phases.

## 2. Verified current architecture

- **Framework:** TanStack Start SSR (`package.json` name `tanstack_start_ts`), `@tanstack/react-router`
  file routing, generated `src/routeTree.gen.ts`. Server logic = TanStack **server functions**
  (`src/lib/*.functions.ts`) + one API route (`src/routes/api/ocade.chat.ts`). **No** Supabase edge
  functions (`supabase/functions/` absent).
- **UI:** Tailwind v4 CSS-first (no `tailwind.config`), shadcn/ui primitives (`src/components/ui/*`,
  46 files), Radix, lucide, sonner, recharts, cmdk.
- **Backend:** Supabase (`@supabase/supabase-js`), ~50 RLS-enabled tables, SECURITY DEFINER RPCs,
  26–27 migrations. Auth via Supabase (OAuth + passwordless OTP) with `@lovable.dev/cloud-auth-js`.
- **AI:** Vercel AI SDK (`ai`, `@ai-sdk/openai-compatible`, `@ai-sdk/react`); one real gateway
  (`src/lib/ai-gateway.server.ts`, keyed by server-only `LOVABLE_API_KEY`).
- **Package manager:** Bun (`bunfig.toml`, `bun.lock`) — a stale `package-lock.json` is also
  committed. **TypeScript strict**. **No test runner, no `test`/`typecheck` scripts.**
- **Baseline plan:** `.lovable/plan.md` "Master Plan v3" (α0→P40) is the prior roadmap; this
  document supersedes and expands it and removes the Lovable-editor-sync constraint (see §6/§13).

## 3. Complete repository map (key paths)

- `src/routes/` — public (`index`, `auth*`), `demo.*` (8), `api/ocade.chat.ts`, and
  `_authenticated/` (home, onboarding, `ocade`, `ocade.models`, `cania.*` +19 sections, `madee.*`,
  `ficia.*`, `settings.*`, `admin.*`). Layout gate: `_authenticated/route.tsx`.
- `src/lib/` — registries (`features.ts`, `actions.ts`), identity/model (`ocade-identity.ts`,
  `ocade-models.ts`, `ocade.functions.ts`, `ocade-providers.functions.ts`, `ai-gateway.server.ts`),
  storage (`storage/{types,resolver,sync-adapter,indexeddb-adapter,pc-vault-adapter}.ts`), demo
  (`demo/{context,data}`), theme (`theme-provider.tsx`), FICIA/MADEE/CANIA `*.functions.ts`,
  `settings-sections.ts`, `cania-sections.ts`, `devices.ts`, `session.ts`.
- `src/components/` — `shell/` (`AppShell`, `DemoShell`, `AuthShell`, `MarketingShell`,
  `OnboardingShell`, `SetupRequiredState`, `PageHeader`, `GlassPanel`, `BrandMark`),
  `settings/SettingsShell`, `cania/`, `madee/`, `ui/`.
- `supabase/migrations/` (26–27 SQL), `supabase/config.toml`.
- Root: `.lovable/plan.md`, `AGENTS.md`, `src/routes/README.md`, `.env` (committed), configs.

## 4. Real & working capabilities (WORKING)

- **OCADE chat, text + image vision** — `api/ocade.chat.ts`: Supabase bearer auth, `chats` privacy
  enforcement (browser_only refuses cloud without `allowCloud`, HTTP 428), persistence to
  `ocade_messages`, history load, real `streamText` streaming; images sent as vision parts.
- **OCADE prompt-improve** — `ocade.functions.ts` `improvePrompt` (real `generateText`).
- **Provider diagnostics** — `ocade.models.tsx` + `ocade-providers.functions.ts`: real connection
  tests, prefs in `ocade_provider_prefs`, events in `ocade_provider_events`.
- **Identity contract (baseline)** — `ocade-identity.ts` + chat system prompt: introduces as
  "OCADE by CAERA CADANE", truthfully names the active model on request, never claims to have
  trained the weights.
- **MADEE** resume editor + AI assist (graceful fallback) — WORKING.
- **FICIA** companies/people/roles/approvals/messenger/timesheets + immutable `compliance_audit_log`
  — WORKING.
- **CANIA** UI shell + saved topics/settings (RLS) — WORKING (live data intentionally empty).
- **Platform:** auth (OAuth + OTP) + onboarding gate; Devices; Privacy; Browser Vault (AES-GCM);
  Activity; Appearance/theme (dark/light/real) + full cursor system; FeatureRegistry +
  ActionRegistry enforcement; StorageAdapter resolver with per-data-class privacy.
- **Voice (browser)** — `ocade.tsx` Web Speech API input + read-aloud. **PARTIAL** (browser-only).

## 5. Partially working capabilities (PARTIAL)

- **Model selection** — `body.model` is honored, but the **provider is hardcoded** to the Lovable
  gateway (`provider_id:"lovable-ai"`); OpenAI-direct/Ollama/native are diagnostics-only.
- **Voice** — Web Speech API only; no wake phrase, greeting, male/female voices, or local STT/TTS.
- **OCADE attachments** — images reach the model; **non-image files are not sent** ("not sent in
  this build").
- **CANIA** — full UI, but every external provider is `setup_required` (catalog-only, no fetching).

## 6. Demo-only capabilities (DEMO-ONLY)

`/demo/*` uses `sessionStorage` `caera:demo` + in-memory `DemoProvider`, never touching Supabase.
**Files** and **Tasks** exist ONLY here (`demo.files.tsx`, `demo.tasks.tsx`); also demo variants of
OCADE/FICIA/MADEE/CANIA/Settings. Seed data in `src/lib/demo/data.ts`.

## 7. Placeholder / setup-required capabilities (SETUP-REQUIRED / UI-ONLY / NATIVE-COMPANION-REQUIRED)

- **~24 Settings sections** render honest `SetupRequiredState` (`settings-sections.ts`).
- **OCADE Work mode** — `WorkModePanel` disabled, "Native Companion Required".
- **OpenAI-direct / Ollama providers** — real connection tests, not wired to generation.
- **MADEE `resume_ai`** without `LOVABLE_API_KEY`; OCADE Voice settings section.
- **PC-vault storage adapter** — throws `NativeCompanionRequiredError` by design.

## 8. Missing capabilities (MISSING) — the bulk of the expanded vision

No code exists for: capability-label identity layer; OCADE Voice (wake phrase, greeting,
male/female, local STT/TTS); capability-aware local fallback chain; Ollama integration; offline
detection/matrix; desktop copilot; PC/browser/software control; native companion (Tauri/Rust);
mobile companion; projects/outputs/scheduled/automations; replay/learning; memory architecture;
non-image/document intelligence (PDF/Office/code); hybrid video response; subscriptions/entitlements;
usage-allowance enforcement; automated tests/typecheck.

## 9. Incorrect or misleading UI states (to correct)

1. **Raw model/provider names in ordinary UI** — `ocade.models.tsx` + `ocade-models.ts` surface
   "Gemini 3.5 Flash", "GPT-5.4 mini", "OpenAI (direct)", "add an OPENAI_API_KEY". Per decisions
   #14–18 these must become **capability labels** (OCADE Local/Cloud/…), with raw names + the whole
   provider/key screen moved to **admin-only** infra.
2. **Unverified future model IDs** (`gemini-3.5-flash`, `gpt-5.4-mini`, `gpt-5.5`) — must be
   validated against what the gateway actually serves, or replaced.
3. **Provider selector implies routing it doesn't do** — selecting OpenAI/Ollama changes nothing in
   generation today; must either route for real or be hidden from users.
4. **`ficia_time_entries`** referenced in code/types + a migration COMMENT but never `CREATE`d — a
   schema-history gap to reconcile before CI provisioning.

---

# PART B — OCADE TARGET (confirmed decisions, truthfully classified)

## 10. OCADE product identity

- **Single identity.** OCADE is the one product/assistant across chat, voice, desktop copilot, PC
  control, browser, mobile, files, projects, automations, offline, and cloud. Public feature names:
  **OCADE Voice**, **OCADE Desktop Copilot**, **OCADE Assistant**. "Jarvis" is an **internal
  codename only** (decision #2) — never user-facing.
- **Creator wording (decision #1):** "I am OCADE, developed and created by CAERA CADANE." Still
  truthfully names the active model when asked; **never** claims CAERA CADANE trained third-party
  weights (#19).
- **Four-layer separation:** (1) Product identity = OCADE; (2) Execution engine = the local/cloud
  inference currently selected; (3) Provider = the runtime delivering inference (internal); (4)
  Capability = chat/vision/code/voice/tools/automation.
- **Capability labels in ordinary UI (#18):** OCADE Local, OCADE Local Fast, OCADE Local Vision,
  OCADE Local Code, OCADE Cloud, OCADE Automatic. Raw runtime/model/version/licence/provider names
  live ONLY in admin diagnostics, support reports, legal/licence notices, security logs, internal
  routing. Never in ordinary chat, selectors, onboarding, marketing, or routine errors.
- **Files:** update `ocade-identity.ts` (vendor string + disclosure), the chat system prompt in
  `api/ocade.chat.ts`, and add a capability-label mapping module. Status: **PLANNED**.

## 11. FICIA / CANIA / MADEE positioning

FICIA, CANIA, MADEE are **not foundation AI models** (#28). In model/assistant selection surfaces
only, show "FICIA — Not an AI model — Coming soon" (and CANIA/MADEE). **Everywhere else, preserve
their real module functions** — do not label working sections (FICIA WORKING, MADEE WORKING, CANIA
UI WORKING) as unavailable. They are specialised modules that may later consume OCADE capabilities.
Status: preventive labelling **PLANNED**; modules themselves unchanged.

## 12. OCADE chat completion

Current: WORKING but provider-hardcoded, no memory, non-image files dropped. Target: route through
the provider layer (§13), attach projects/memory (§17/§19), document intelligence (§18), capability
labels (§10), and the fallback chain (§14). Status: **PARTIAL → PLANNED** completion.

## 13. Provider-routing architecture

- Replace the hardcoded gateway in `api/ocade.chat.ts` with a **router** that reads the user's
  selected capability profile + `ocade_provider_prefs` + data-class privacy, then dispatches to the
  resolved engine. **Provider-neutral**: Lovable gateway stays as **replaceable internal infra**
  (#16); adding/removing a provider must not require rewriting OCADE chat.
- **No user-facing keys (#14–16):** remove "API key"/BYOK/secret/developer-credential terminology
  from all user surfaces; cloud creds are admin-only encrypted infra, never in browser/logs/prompts/
  replay/exports. The current user-facing provider/key screen becomes **admin-only** (§38).
- Server-side: key protection, health checks, metering, cancellation, timeout, retry limits, cost
  caps, failover, outage messages. Status: **PLANNED**.

## 14. Ollama & local-model completion

- **Local-first (#10, #17).** Detect Ollama; discover installed engines; record capability, context,
  RAM/VRAM, CPU/GPU fit, speed, tool/vision support, licence, health, version, storage.
- **Capability-aware fallback chain (#17):** preferred local → secondary local → smaller
  low-resource local → reduced local response → **ask permission for OCADE Cloud** → approved cloud
  → clear failure message. Never silently cross to cloud.
- **Installation (#20):** detect hardware, recommend a profile, show download size, require
  confirmation, one-click install, never silent multi-GB downloads, resume interrupted downloads,
  keep multiple compatible backups.
- **Recommended internal catalog (from Group-5 answer, adjustable):** general 7–8B (e.g. Llama
  3.1 8B → *OCADE Local*), small/fast (e.g. Qwen2.5-3B / Phi → *OCADE Local Fast*), vision (e.g.
  Llama 3.2 Vision / LLaVA → *OCADE Local Vision*), code (e.g. Qwen2.5-Coder → *OCADE Local Code*).
  Names are internal; users see capability labels. Status: **MISSING → PLANNED** (companion-dependent
  for true local execution; a browser bridge URL is an interim).

## 15. Cloud-provider support (OCADE Cloud)

Managed, permissioned cloud after local can't complete. Consumes the 28/8h allowance (#12).
Approval asked before crossing to cloud (#13), remembered only for the current conversation;
sensitive/protected content always fresh. Encrypted keys server-side, metering, cost caps,
daily/monthly limits, failover, honest outage states. Status: gateway WORKING; routing/allowance
**PLANNED**.

## 16. Model capability registry

Extend `ocade-models.ts` into a capability registry mapping **capability profiles → eligible engines
(local or cloud)** with capability flags (text/vision/code/tools/context/speed/cost/licence). Powers
"OCADE Automatic" selection and the fallback chain. Raw identities internal-only. Status: **PARTIAL
→ PLANNED**.

## 17. Projects & conversations

Projects, conversations, pinned/archived, branches/variants, project instructions, project memory.
Today OCADE's sidebar shows Projects/Outputs/Scheduled/Automations as honest **PLANNED** disabled
rows. Target: real `ocade_projects` / `ocade_project_items` tables (RLS), wired to the composer,
with Features/Actions registered. Status: **MISSING → PLANNED**.

## 18. Files & document intelligence

Uploads, indexing, and **offline** understanding of text, Markdown, PDF, DOCX, XLSX, CSV, and source
code (#44) — plus citations/source tracing. Non-image files currently dropped. Target: local
extraction pipeline + optional retrieval, gated where not built. Status: **MISSING → PLANNED**.

## 19. Memory architecture

Opt-in (#31), reviewable, editable, deletable, governed by privacy mode, **distinct from chat
history**. New data-class + review UI + retention controls. Status: **MISSING → PLANNED**.

## 20. Outputs & artifacts

Generated outputs (documents, exports, visual responses) stored per privacy/retention; exportable;
listed in the OCADE "Outputs" contextual item (currently PLANNED). Status: **MISSING → PLANNED**.

## 21. Desktop Copilot

Overlay/floating assistant, system tray, global shortcut, selected-text assistance, screenshot
understanding, active-window context, clipboard access, notification reading, task execution with
confirmation/progress/cancellation/recovery, replay, visible privacy status, emergency stop, startup
+ background resource limits. Uses the same OCADE intelligence/memory/permissions (#3).
Status: **MISSING / NATIVE-COMPANION-REQUIRED → PLANNED**.

## 22. OCADE Voice architecture

Selectable original male/female voices, **no assumed default** (chosen in onboarding), push-to-talk
first, optional local wake phrase, interruption/stop-speaking, captions, local STT/TTS where
installed, **multilingual** (#22, #27). Wake phrase "Hello OCADE" / optional "Hey OCADE", **opt-in
and off by default**, detected locally (#23). Personalized greeting from onboarding (#24) with
**first-name-no-title default** (#25) and **never inferring titles** (#26). Multilingual via
installable, independently verified language packs — a language is not advertised until its STT, TTS,
wake phrase, and commands pass verification (#27). No default microphone recording. Original design —
no imitation of any copyrighted assistant's voice/personality/sound/design. Status: **MISSING →
PLANNED**.

## 23. Native companion

Tauri desktop shell + **Rust security & execution core** + secure local IPC + Capacitor mobile +
shared TypeScript contracts/UI where practical (#4). Hard trust boundary between web app, server,
native companion, browser extension, mobile companion, provider execution, local storage, cloud
storage. Controls: authentication, encryption, request signing, nonce/replay protection, permission
checks, update signing, secure install, process isolation, least privilege, action logging,
emergency shutdown, version compatibility. **Not claimed working until compiled, signed, and
runtime-proven** per platform. Status: **MISSING / BLOCKED (native build outside this repo) →
PLANNED**.

## 24. PC control (companion V1)

Bounded, low-risk actuation (#6, #7): read approved screen/active window; open approved apps/files/
folders; type user-approved text; focus & arrange windows; copy/paste with permission; emergency
stop; confirmation + audit trail. **No** delete/move/rename, **no** scripts, **no** financial/
credential actions in V1. Every action risk-classified (§28). Status: **MISSING /
NATIVE-COMPANION-REQUIRED → PLANNED**.

## 25. Software-control adapter system

Capability-based **adapter SDK** (#9) so integrations are added without rewriting the core. V1
adapters: **browser, approved files/folders, window management** (#8). Each action: capability
detection, risk class, unsupported-action reporting, fallback strategies. Status: **MISSING →
PLANNED**.

## 26. Browser automation

Browser companion/extension: tab discovery, page understanding (DOM + accessibility tree),
screenshots, form assistance, navigation, permitted downloads/uploads, per-site allow/deny +
capability rules, session/incognito boundaries, confirmation before sensitive submission, action
receipts, replay/rollback where possible. **Webpage content is untrusted data**: never follow page
instructions that try to override user intent or OCADE safety rules (prompt-injection defence §31).
First browser: Chromium/Chrome. Status: **MISSING → PLANNED**.

## 27. Mobile companion & control (V1)

Secure pairing (QR, encryption, approval, expiry, trusted-device list, revocation), desktop-status
monitoring, notifications, approve/deny actions, cancellation, emergency stop, task hand-off,
conversation continuity, file/clipboard hand-off with permission (#34). **No unrestricted remote
desktop control**; sensitive PC actions from mobile require a trusted paired device + authenticated
user + clear details + confirmation + expiration + audit + cancellation. Status: **MISSING →
PLANNED**.

## 28. Permissions & approvals

Risk-tiered via the existing **ActionRegistry** (#32): read-only, low, confirmation-required, high,
prohibited. Automations get dry-run/preview + approval gates. Per-app/per-site permission model;
permission expiry; visible privacy status. Status: registry WORKING; extension **PLANNED**.

## 29. Password / credential boundaries

OCADE **may** open the correct page and fill user-approved non-sensitive fields (#30). OCADE **must
never** create/choose/type passwords, enter OTPs, solve CAPTCHAs, complete biometrics, enter payment
authentication, expose protected credentials, submit final registration, or accept terms without
explicit user action (#29). **Protected-input mode:** OCADE cannot read protected fields;
screenshots/recordings/replay redact them; the user completes the step manually; OCADE resumes only
after the user confirms. Status: **MISSING → PLANNED**.

## 30. Security & privacy

Per-data-class privacy modes (browser_only / pc_vault / private_sync) already real. Extend: no
user-facing keys; admin-only encrypted cloud creds; local-first defaults; least-privilege companion;
signed updates; audit of every actuation; emergency stop everywhere. Status: foundation WORKING;
extensions **PLANNED**.

## 31. Prompt-injection defence

Treat all webpage/document/tool content as untrusted data, never instructions. Detect hidden/
adversarial instructions; confirm before sensitive submissions; strip/quote injected directives;
never let observed content escalate permissions or reveal secrets/system prompts. Status: **MISSING
→ PLANNED**.

## 32. Activity logs & replay

Two-log model preserved: immutable **compliance_audit_log** (permanent) + **activity_log**
(operational). Operational activity + action replay default to **90-day retention, user-adjustable**
(#33); compliance permanent and separate. Replays redact protected inputs. Status: logs WORKING;
replay **PLANNED**.

## 33. Automations & scheduling

V1: manual + scheduled/recurring + simple conditional triggers; dry-run/preview, approval gates,
logs, rollback where possible; no destructive/financial/irreversible action without confirmation.
Full event-driven engine deferred. Status: **MISSING → PLANNED**.

## 34. Offline & local-first behaviour

Local-first; useful offline once local components are installed (#10, #21). On connectivity loss:
detect; keep local features active; show a small non-disruptive offline indicator; prevent repeated
failing cloud calls; move eligible requests to local; preserve unsent work; queue only safe-to-retry
tasks; explain unavailable features; retry with backoff; notify on reconnect. **Explicit error
states:** internet unavailable; local engine unavailable/loading/lacks-capability; companion
disconnected; cloud approval required; cloud allowance exhausted; API key invalid *(internal only)*;
provider temporarily unavailable; device memory insufficient; model install incomplete; subscription
expired; offline entitlement verification unavailable. Status: **MISSING → PLANNED**.

## 35. Database & migration requirements

New tables (all RLS, own-row/tenant-scoped): `ocade_projects`, `ocade_project_items`,
`ocade_outputs`, `ocade_memory` (+ review/audit), `ocade_automations`, `ocade_automation_runs`,
`ocade_replays`, `local_engines` (device-scoped inventory), `voice_prefs` (or extend
`user_settings`), `subscriptions`, `entitlements`, `usage_ledger` (cloud allowance), `devices`
extension for pairing, `companion_sessions`, `permission_grants`. Reconcile the missing
`ficia_time_entries` migration. Every table ships with a migration + RLS + tests. Status: **PLANNED**.

## 36. API & server-function requirements

New/updated server functions: provider router (replace hardcoded chat provider), local-engine
detection/health bridge, allowance metering + reset, subscription/entitlement checks (with signed
offline cache), memory CRUD, projects/outputs CRUD, automation scheduler + runner, companion pairing
+ signed IPC broker, voice/session endpoints, document-extraction. Admin-only provider/diagnostics
endpoints. Status: **PLANNED**.

## 37. UI & navigation requirements

**Unified shell (#42):** one module-aware sidebar, **layout-level single-shell mounting**, contextual
navigation for all modules. Consolidate `AppShell`/`DemoShell` into one `WorkspaceShell` mounted in
`_authenticated/route.tsx` and `demo.tsx`; remove ~33 per-page wrappers; lift OCADE's conversation
sidebar + CANIA sections into the shell contextual slot; real account area; capability-label model
picker; calm design (no giant cards/oversized headings/heavy blur; dark/light flat, REAL owns
gradients). Status: **PLANNED** (design validated against existing `AppShell`, `DemoShell`,
`CaniaLayout`, `settings-sections.ts`).

## 38. Settings requirements

Keep the existing honest IA (`settings-sections.ts`). Changes: move the provider/model/key screen to
**admin-only**; add capability-profile settings (no keys); add Voice (voices/wake/greeting/language/
accent/formality), Memory (review/delete/retention), Automations, Subscriptions/Usage (allowance +
next reset), Companion/Permissions, Offline. Remove all user-facing "API key" terminology (#15).
Status: **PARTIAL → PLANNED**.

## 39. Performance & resource limits

Companion background resource caps; local-inference performance surfacing; low-resource voice/video
modes; FPS-aware theme already exists; download size/disk guards. Status: **PLANNED**.

---

# PART C — QUALITY, PLATFORMS, PHASES

## 40. Testing strategy

Introduce a **test runner + `typecheck` script first** (none today). Test types (#45): unit,
integration, end-to-end, native-companion, permission, offline, cloud-fallback, voice, wake-phrase
(incl. false-positive), model-download (incl. interruption), subscription, usage-reset, installer/
update, rollback, migration, prompt-injection, protected-input, hardware-compatibility. **No phase
is "done" because UI exists** — every phase verifies the full path
**UI → state → API/native IPC → execution → persistence → error handling → audit → rollback**.

## 41. CI & quality gates

Add scripts: `test`, `typecheck` (tsc `--noEmit`), keep `lint`, add `build` gate. CI runs
typecheck + lint + unit/integration + build on every PR; native/e2e on tagged runs. No merge on red.
Status: **MISSING → PLANNED**.

## 42. Packaging & deployment

Web: current Vite/Nitro build. Desktop: Tauri signed installers (Windows first, then macOS).
Mobile: Capacitor (Android, iOS). Signed auto-update channels; per-platform verification + packaging
**separately** (#5) — one build never proves another platform. Status: **PLANNED**.

## 43–46. Platform expansion (unified core, verified separately)

**Unified programme (#5):** one shared architecture/core (Tauri+Rust+Capacitor, shared TS contracts,
shared permissions, shared design system) targeting **Windows, macOS, Android, iOS as soon as
possible**; **Windows is the lead/reference** verified first; **each platform is verified, packaged,
and release-tested separately** and ships only when its own verification passes (honest per-platform
gating — never pretend one build proves all). §43 Windows-first · §44 macOS · §45 Android · §46 iOS.
Status: **PLANNED**.

## 47. Ordered implementation phases

Each phase uses the template in §49. Recommended order:

- **P0 — Quality foundations.** Add test runner + `typecheck`/`build` gates; fix lint; reconcile
  `ficia_time_entries`; remove stale `package-lock.json` (Bun). *Edit mode; no feature code.*
- **P1 — Unified WorkspaceShell (#37, #42).** One shell, layout-level, contextual nav; capability-
  label model picker scaffold; calm pass. *No auth/RLS/Demo regression.*
- **P2 — Identity + capability labels (#1, #10, #18).** Update `ocade-identity.ts` + chat system
  prompt to CAERA-CADANE creator wording; capability-label mapping; hide raw names; move provider/
  key screen to admin-only; strip user-facing key terminology (#14–16).
- **P3 — Provider router (#13).** Replace hardcoded chat provider with a router honoring capability
  profile + privacy; Lovable becomes one internal provider; verify model IDs.
- **P4 — Local engine bridge + Ollama detection + fallback chain (#14, #17).** Browser-bridge
  interim; capability-aware chain; ask-before-cloud; allowance hooks.
- **P5 — Allowance + offline matrix + error states (#12, #34).** 28/8h cloud metering (local
  unlimited); offline detection + explicit error states; signed offline entitlement cache.
- **P6 — Projects, memory, outputs (#17, #19, #20).** Tables + RLS + UI + Features/Actions.
- **P7 — Document intelligence (#18, #44).** Non-image + PDF/DOCX/XLSX/CSV/code, offline, citations.
- **P8 — Automations v1 (#33).** Manual + scheduled + simple triggers; dry-run; approvals; logs.
- **P9 — Subscriptions/entitlements (#35–37).** Configurable per-plan matrix; post-expiry local
  stays; usage enforcement. *(Prices pending §54.)*
- **P10 — Native companion V1 (Windows) (#4, #23, #24, #25).** Tauri+Rust core, secure IPC, bounded
  PC control, browser/files/windows adapters, emergency stop, audit. *Signed build proven outside
  this repo before any "available" flag flips.*
- **P11 — OCADE Voice (#22–27).** Voices, push-to-talk, opt-in wake phrase, greeting, captions,
  local STT/TTS, multilingual with per-language verification.
- **P12 — Desktop Copilot (#21).** Overlay/tray/shortcut/selected-text/screenshot/actions/replay.
- **P13 — Mobile companion V1 (#27).** Pairing, monitor, approve/deny, cancel, e-stop, hand-off,
  continuity (Android → iOS).
- **P14 — Hybrid video response (#38–41).** Animated OCADE presence + visual panel + optional
  confirmed screen tutorial; offline where installed; opt-in.
- **P15 — Browser automation hardening + prompt-injection defence (#26, #31).**
- **P16 — Packaging/deploy across platforms (#42–46);** signed installers + update channels.

## 48. Dependencies & prerequisites

Test runner (e.g. Vitest) + Playwright (e2e); Tauri + Rust toolchain (native); Capacitor (mobile);
local STT/TTS + wake-word engine (voice); PDF/Office parsers (docs); signing certs (BLOCKED on
external procurement); subscription/payment provider (deferred). Each phase lists its own.

## 49. Acceptance tests per phase (template)

Every phase entry MUST specify: **phase number · exact purpose · current status · what it builds/fixes
· recommended Claude model · thinking level · read-only/edit mode · prerequisites · files in scope ·
forbidden changes · DB changes · API changes · web changes · desktop changes · mobile changes ·
security requirements · privacy requirements · implementation steps · automated tests · manual tests
· acceptance criteria · rollback point · risks · completion definition · next prompt.**

Example — **P3 Provider router:** *purpose:* consume selected provider instead of hardcoded; *status:*
PARTIAL; *model:* Opus, high thinking, edit mode; *prereq:* P2; *files:* `api/ocade.chat.ts`,
`ocade-providers.functions.ts`, new `provider-router.server.ts`; *forbidden:* auth gate, RLS, Demo;
*DB:* none; *API:* router; *tests:* unit (routing table), integration (privacy blocks cloud),
e2e (switch reflects in `ocade_provider_events`); *acceptance:* selecting a profile changes the real
engine and is provable in events, not mocked; *rollback:* revert commit; *completion:* no hardcoded
`provider_id`; *next:* P4.

## 50. Risks & mitigations

- **Scope vastly exceeds a web app** → phase gating + honest status; nothing claimed until proven.
- **Native/mobile unverifiable in-repo** → per-platform verification; feature flags stay false until
  signed+runtime-proven.
- **Zero tests today on compliance-critical FICIA** → P0 first; never weaken checks to pass.
- **Committed `.env` with Supabase keys** → rotate + git-ignore (separate hygiene task).
- **Unverified model IDs / gateway coupling** → verify in P3; keep provider replaceable.
- **Full multilingual scope** → per-language verified packs; advertise only what passes.
- **Credential/PC-control safety** → protected-input mode, risk tiers, emergency stop, audit.

## 51. Rollback strategy

Each phase = its own branch/PR with a revertable commit and a stated rollback point. No DB migration
lands without a down path/plan. Companion/mobile releases gated behind feature flags that revert to
"unavailable" cleanly. Global rollback point for this programme: `origin/main` (`cd0ad8f`).

## 52. Honest completion percentages

Web assistant core (chat text+image, persistence, privacy) ~65–70%; FICIA ~90%; MADEE ~85%; CANIA UI
~80% (live data ~10%); platform (auth/onboarding/settings/theme/cursor/devices/privacy/vault) ~80%.
Expanded OCADE vision overall (voice, copilot, PC/browser/software control, native + mobile
companion, memory, automations, video, subscriptions, offline): **~8–12% built**, the remainder
PLANNED/MISSING/BLOCKED. Provider routing ~50% (selection UI real, generation hardcoded). Native
control ~0–5%; mobile ~0%; browser automation ~0%; voice ~15% (browser Web Speech only).

## 53. Definition of fully completed OCADE

OCADE is "complete" when, on each separately-verified platform: local-first chat/voice work offline
after install; capability-aware fallback + permissioned OCADE Cloud with 28/8h allowance enforced;
no user-facing keys; capability-label identity truthful; projects/files/memory/outputs/automations
real; desktop copilot + bounded PC/browser/software control via signed companion with emergency stop
+ audit; mobile pairing/approvals/continuity; hybrid video responses; subscriptions/entitlements with
post-expiry local access; protected-input + prompt-injection defences; and the full test/security/
rollback/packaging matrix green — with every capability honestly labelled and nothing faked.

## 54. Questions requiring user decisions (residual)

1. **Subscription prices + per-plan values** (deferred; "do not invent pricing"): for each plan
   (2-day / 8-day / 1-month / 1-year) — price; cloud allowance if above the 28/8h base; storage,
   file, and automation limits; included extras (premium voices, desktop video, desktop companion,
   mobile companion). Structure is fixed (#35–37: uniform core, 2+2 devices, 28/8h) — only numbers
   remain.
2. **Model-ID verification:** confirm which real cloud models the gateway serves (current catalog
   uses unverified future IDs).
3. **Signing/certificate procurement** for Windows/macOS/mobile (BLOCKED on external accounts).
4. Any later decision to differentiate plans beyond duration/price (currently declined, #35).

---

*Prepared as a planning revision. No application code, migrations, configuration, environment,
dependencies, or lockfiles were changed in producing this document; only this Markdown file was
edited. Native, mobile, and OS-level capabilities remain honestly gated until compiled, signed, and
runtime-proven.*
