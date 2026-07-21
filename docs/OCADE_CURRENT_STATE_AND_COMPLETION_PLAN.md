# OCADE — Current State & Completion Plan

> **Status:** Audit only. This document makes no code, schema, configuration, or
> environment changes. Every claim below is traceable to a real file in the repository at
> commit `cd0ad8f` (branch base: `origin/main`).
>
> **Product identity:** The assistant is **"OCADE by CAERA CADANE."** Underlying model
> providers remain truthful in Model Settings, diagnostics, and usage records — this
> document preserves that honesty and does not describe any capability as more complete
> than the code actually makes it.

---

## 0. Architecture reality check (read this first)

The repo was described as a "Vite/React/Supabase app synced from Lovable." The more precise
truth, which the rest of this document depends on:

- It is a **TanStack Start SSR application** (`package.json` name: `tanstack_start_ts`),
  React **19.2**, Vite **8**, Tailwind **v4** (CSS-first via `@import "tailwindcss"` +
  `@theme inline`; there is **no `tailwind.config.*`**).
- Routing is **file-based** through `@tanstack/react-router` (`src/routes/`), with a
  generated `src/routeTree.gen.ts`.
- **Supabase is the database + auth backend only.** There are **no Supabase edge functions**
  (`supabase/functions/` does not exist). Server-side logic runs as **TanStack Start server
  functions** in `src/lib/*.functions.ts` (via `createServerFn`) plus one API route,
  `src/routes/api/ocade.chat.ts`.
- The **single real model-generation path** is the **Lovable AI Gateway**
  (`src/lib/ai-gateway.server.ts`), an OpenAI-compatible endpoint keyed by the server-only
  secret `LOVABLE_API_KEY`.
- Package manager is **Bun** (`bunfig.toml`, `bun.lock`), though a stale
  `package-lock.json` is also committed (see §7). TypeScript is **`strict: true`**. There is
  **no test runner** and **no `test`/`typecheck` npm script**.

Two architectural primitives govern honesty across the whole app and are load-bearing for
OCADE completion:

- **FeatureRegistry** (`src/lib/features.ts`) — every visible capability must have a
  `Feature` entry. `registerFeature` **throws at registration** if a feature is not
  `active`/`beta` and lacks a `reason`. Statuses: `active | beta | setup_required | planned
  | hidden`. This is the "No-Dead-Button" enforcement seam.
- **ActionRegistry** (`src/lib/actions.ts`) — ~90 registered actions. `registerAction`
  throws if a `compliance`-logged action has no `category`, or a `strong` confirmation has
  no `confirmPhrase`. `executeAction` enforces confirmation + phrase match, races a timeout,
  and records success/failure to `activity_log` (operational) or the immutable compliance
  log (compliance). `validateRegistry()` runs a dev-time self-check.

---

## 1. What is real and working

All items below are backed by real Supabase tables and/or the real Lovable gateway.

### OCADE (assistant)
- **Chat — text + image vision. REAL.** `src/routes/api/ocade.chat.ts` authenticates the
  Supabase bearer token, enforces the user's `data_class_privacy` mode for the `chats` data
  class, persists user + assistant turns to `ocade_messages`, loads prior history, and
  streams a genuine model response via the AI SDK `streamText(gateway(modelId))`. Images are
  passed to the model as `image` parts (real vision path). The front end
  (`ChatSurface.sendMessage` in `src/routes/_authenticated/ocade.tsx`) streams the response
  body chunk-by-chunk.
- **Prompt-improve. REAL.** `improvePrompt` in `src/lib/ocade.functions.ts` calls
  `generateText` via the gateway.
- **Provider prefs + connection tests. REAL.** `src/routes/_authenticated/ocade.models.tsx`
  + `src/lib/ocade-providers.functions.ts` persist prefs to `ocade_provider_prefs`, run
  genuine network connection tests, and log events to `ocade_provider_events`
  (`getUsageDiagnostics` surfaces them).
- **Identity contract. REAL.** `src/lib/ocade-identity.ts` centralizes the "OCADE by CAERA
  CADANE" strings and identity-probe detection; the chat system prompt enforces truthful
  model disclosure.
- **Voice input/read-aloud. REAL (browser-native).** `toggleVoice` uses the Web Speech API;
  `readAloud` uses `speechSynthesis`. Works only where the browser supports it; there is no
  server/model voice.

### MADEE (Resume Builder)
- **Resume editor. REAL / complete.** Routes `madee.*`; components
  `src/components/madee/ResumePreview.tsx`, `ResumeSections.tsx`; logic
  `src/lib/madee.functions.ts` (project/version CRUD, attestation-gated, browser-only vs
  private-sync storage split), `madee-export.ts`, `madee-local-store.ts`.
- **AI assist. REAL with graceful fallback.** `src/lib/madee-ai.functions.ts` (improve
  bullet, summary, grammar, ATS check, JD match, parsing) call the gateway `generateText`;
  when `LOVABLE_API_KEY` is absent they return `{ ok:false, error }` so manual editing
  continues to work.

### FICIA (company / HR / messenger / timesheets) — REAL / complete
- Companies CRUD via SECURITY DEFINER RPCs, access requests, legal-ID/name conflict checks
  (`src/lib/ficia-companies.functions.ts`); people/employments/org units
  (`ficia-people.functions.ts`); business messenger with tenant isolation
  (`messenger.functions.ts`); timesheets with a single-running-entry DB constraint,
  consent-gated activity samples, locked periods, approve/reject/lock
  (`timesheet.functions.ts`); immutable audit writer (`compliance-log.functions.ts`).
- Regulated mutations append to the immutable `compliance_audit_log`. High-risk actions
  carry strong confirmation phrases (e.g. `ficia.people.terminate` → "TERMINATE",
  `ficia.approvals.release` → "RELEASE", `ficia.time.period.lock` → "LOCK").

### CANIA — REAL UI + real saved topics/settings
- `src/lib/cania.functions.ts` persists saved topics and alert prefs (RLS-scoped). The UI
  shell (`CaniaLayout.tsx`, `SectionView.tsx`, `DataCard.tsx`) is complete. Live data is
  intentionally empty (see §3).

### Platform / shell
- **Auth. REAL.** `src/integrations/supabase/client.ts` (lazy singleton, localStorage
  session, autoRefresh); `auth.tsx` offers Google + Apple OAuth (via
  `@lovable.dev/cloud-auth-js`) and passwordless **phone/email OTP**
  (`supabase.auth.signInWithOtp`), with a same-origin `safeNext()` open-redirect guard.
  Server-side `requireSupabaseAuth` middleware validates the bearer via
  `supabase.auth.getClaims`.
- **Onboarding gate. REAL.** `_authenticated/route.tsx` `beforeLoad` redirects
  unauthenticated users to `/auth`, and users with `profiles.onboarding_completed = false`
  to `/onboarding` (5-step wizard: display name, locale/timezone, account type, privacy
  mode, module selection). Registers the device on mount.
- **Devices. REAL.** `settings.devices.tsx` + `src/lib/devices.ts` list/revoke real device
  rows with a confirm-phrase action.
- **Privacy + Browser Vault. REAL.** `settings.privacy.tsx`, `settings.vault.tsx`; the
  StorageAdapter system (`src/lib/storage/*`) with an IndexedDB adapter that AES-GCM-encrypts
  each record value using an in-memory DEK, a Supabase sync adapter (RLS-scoped to
  `auth.uid()`), and a PC-vault adapter that deliberately throws
  `NativeCompanionRequiredError` (no silent fallback).
- **Activity log. REAL.** `settings.activity.tsx` reads `activity_log`.
- **Appearance / theme / custom cursor. REAL.** `src/lib/theme-provider.tsx` + `styles.css`:
  three themes (`dark` obsidian, `light` silver/ivory/gold, `real` animated aurora),
  reduced-motion + high-contrast + auto low-performance (rAF FPS sampler), and a
  CSS-variable custom cursor (`system | caera_black | caera_white | auto_contrast | custom |
  accessibility`). Prefs persist to `user_settings` when signed in, else `localStorage`.
- **Registries. REAL.** FeatureRegistry + ActionRegistry as described in §0.

---

## 2. What is only Demo data

Demo Mode is isolated by design and **never touches Supabase**.

- **Flag & isolation:** `caera:demo` in `sessionStorage`; `DemoProvider`
  (`src/lib/demo/context.tsx`) holds all sample data in React state (seeded from
  `src/lib/demo/data.ts`) with in-memory-only mutators; `useDemo` throws outside `/demo/*`.
  The `/demo` route is `ssr:false` + `robots: noindex`.
- **Demo-only surfaces (no authenticated equivalent):**
  - **Files** — only `src/routes/demo.files.tsx` (static list; uploads disabled).
  - **Tasks** — only `src/routes/demo.tasks.tsx` (local `markTaskDone`; "Nothing is saved to
    real accounts").
  - Demo variants of OCADE/FICIA/MADEE/CANIA/Settings for signed-out preview.
- **Seed data:** `DEMO_COMPANY` (Meridian Foods, sample GSTIN, India/INR),
  `DEMO_OCADE_MESSAGES`, `DEMO_TIMESHEET`, `DEMO_INVOICES`, `DEMO_TASKS`, `DEMO_FILES`,
  `DEMO_COMPANY_CHAT`, `DEMO_RESUME`, `DEMO_REPORTS` — each field flagged "sample" in the UI.

---

## 3. What is placeholder or setup-required

These are honestly gated (disabled / "Setup Required" / "Native Companion Required") — none
are faked.

- **CANIA live data.** `src/lib/cania-providers.ts` is a **catalog only** — its header states
  "Nothing here fetches… NO fake live data anywhere." All external providers (GNews, NewsAPI,
  weather, etc.) are `setup_required`. Features `cania.center/alerts/search` are
  `setup_required`.
- **OCADE Work mode.** `WorkModePanel` in `ocade.tsx` is a static "Native Companion Required"
  panel — Pause/Stop/Replay buttons are `disabled`; copy states OCADE "cannot control your
  mouse, keyboard, terminal or filesystem" in the browser build. `ocade.copilot` is `planned`
  with reason "Requires the Native Companion (Cursor / Tauri build)."
- **OCADE non-image files.** Attachments UI is real (≤10 files, 20 MB) and images reach the
  model, but non-image files are explicitly NOT sent ("Non-image files are not sent to the
  model in this build").
- **OCADE OpenAI-direct / Ollama providers.** Both are **connection-tested for real** but are
  **not wired into any generation path** — chat always routes through the Lovable gateway
  (the endpoint hardcodes `provider_id: "lovable-ai"`). They are diagnostics/roadmap today.
- **OCADE Voice settings section** and **MADEE `resume_ai`** (without `LOVABLE_API_KEY`) are
  `setup_required`.
- **~24 Settings sections** (`src/lib/settings-sections.ts`) render honest Setup-Required
  states: Profile, Account, Authentication, Security, Data Controls, Billing, Usage, Limits,
  OCADE Preferences/Voice/Work/Permissions/Learning, Notifications, Language, Time/Focus,
  Accessibility, Skills, Connectors, Integrations, Developer, and several FICIA
  roles/approvals/compliance/signature-trust sub-sections.

---

## 4. What is missing

Not yet present in any form (or present only as a "Planned" label with no data model):

- **OCADE Projects / Outputs / Scheduled / Automations** — sidebar rows hard-disabled with
  "Planned" badges; the Composer "Project" selector is disabled; no data model.
- **OCADE Replay / Learning** — only a disabled "Replay" button + a `setup_required`
  "Learning and Replay" settings section.
- **Non-image file understanding** — no extraction/RAG pipeline.
- **Authenticated Files and Tasks backends** — exist only as demo.
- **Browser automation** — no `puppeteer`/`playwright` dependency or implementation anywhere
  (only marketing/plan copy mentions it).
- **Native / computer control / OS voice** — Native Companion not built.
- **Automated tests** — none exist (no `*.test.*`, `*.spec.*`, `__tests__/`, no runner).

---

## 5. Exact routes and components involved

**Public / auth:** `/` (`index.tsx`), `/auth`, `/auth/verify`, `/auth/callback`.

**API:** `POST /api/ocade/chat` (`src/routes/api/ocade.chat.ts`) — streaming chat.

**Demo (`ssr:false`, noindex):** `/demo` + `demo.{index,ocade,ficia,madee,cania,files,tasks,settings}`.

**Protected (`_authenticated/`, `ssr:false`, layout `route.tsx`):**
- Home: `/home`; Onboarding: `/onboarding`.
- OCADE: `/ocade`, `/ocade/models`.
- CANIA (`cania.tsx` layout): `/cania` + 19 sections (`world, business, markets, weather,
  traffic, currency, commodities, sports, government, finance, technology, travel, risks,
  alerts, country, saved, search, settings`).
- MADEE (`madee.tsx`): `/madee`, `/madee/new`, `/madee/$projectId`,
  `/madee/$projectId/preview`.
- FICIA (`ficia.tsx`): `/ficia`, `/ficia/new`, `/ficia/$tenantId`,
  `/ficia/$tenantId/approvals`, `/messenger`, `/people`, `/roles`, `/time`,
  `/time/approvals`, `/time/reports`, `/time/settings`.
- Settings (`settings.tsx`): `/settings`, `/settings/$section`, `/settings/activity`,
  `/appearance`, `/devices`, `/privacy`, `/vault`.
- Admin: `/admin/country-packs`, `/admin/country-packs/$packId`, `/admin/launch-gate`.

**Shell components:** `src/components/shell/` — `AppShell.tsx` (authenticated shell: top bar,
collapsible sidebar, module accents), `AuthShell.tsx`, `DemoShell.tsx`, `MarketingShell.tsx`,
`OnboardingShell.tsx`, `SetupRequiredState.tsx`, `DemoBadge`; plus
`src/components/settings/SettingsShell.tsx`, `src/components/cania/CaniaLayout.tsx`,
`src/components/ui/sidebar.tsx`. OCADE-specific: `ChatSurface`, `WorkModePanel` (in
`ocade.tsx`).

**Responsive model:** single Tailwind `md` (768px) pivot — below 768 the sidebar is a
`mobileOpen` overlay drawer; at ≥768 it collapses between 60px/248px. No dedicated tablet
breakpoint.

---

## 6. Exact database tables and policies involved

All tables are in `public` with **Row Level Security enabled + policies** (own-row
`auth.uid()`, tenant-member checks, admin-write, messenger-membership). 26–27 migrations in
`supabase/migrations/` (2026-07-20 → 07-21). Storage RLS policies exist on `storage.objects`
(`messenger_read/insert/delete_own`).

| Domain | Tables |
|---|---|
| Core / identity | `profiles`, `user_roles`, `tenants`, `tenant_members`, `user_settings`, `devices`, `compliance_audit_log` (formerly `audit_log`), `feature_flags` |
| Activity / privacy | `activity_log`, `browser_grants`, `data_class_privacy`, `vault_config`, `user_private_records` |
| OCADE | `ocade_conversations`, `ocade_messages`, `ocade_provider_prefs`, `ocade_provider_events` |
| CANIA | `cania_saved_topics`, `cania_alert_prefs`, `cania_settings` |
| MADEE | `madee_resume_projects`, `madee_resume_versions` |
| Launch / admin | `launch_gate_items`, `launch_gate_history`, `access_requests` |
| Country packs / compliance | `country_packs`, `country_pack_versions`, `rule_sources`, `compliance_events`, `historical_test_cases`, `pack_reviews`, `company_obligations` |
| FICIA org | `ficia_locations`, `ficia_departments`, `ficia_teams`, `ficia_employments`, `ficia_custom_roles`, `ficia_role_grants`, `ficia_approval_policies`, `ficia_approval_requests`, `ficia_approval_decisions` |
| Messenger | `msg_threads`, `msg_thread_members`, `msg_cross_company_grants`, `msg_messages`, `msg_message_edits`, `msg_attachments`, `msg_reactions`, `msg_pins`, `msg_read_receipts`, `msg_message_links` |

**SECURITY DEFINER functions (locked-down grants):** `create_company_with_owner`,
`find_conflicting_legal_id`, `find_similar_company_names`, `is_tenant_owner_or_manager`,
`ficia_has_permission`, `enforce_resume_attestation`, `set_resume_version_number`,
`set_updated_at`.

**⚠ Schema integrity finding:** `ficia_time_entries` is referenced by
`src/lib/timesheet.functions.ts` and `src/integrations/supabase/types.ts`, and a migration
(`20260721153321`) contains only a `COMMENT ON TABLE public.ficia_time_entries …`, but **no
`CREATE TABLE public.ficia_time_entries` exists in any committed migration**. The table
appears to live only in generated types / the live Cloud DB. This is a real migration-history
gap to reconcile before relying on `supabase db reset`/CI provisioning.

---

## 7. Safe deletion candidates

> This document **recommends only**; it deletes nothing. The user's instruction to reuse
> existing code before creating new code, and to preserve completed FICIA/MADEE/CANIA work,
> governs every classification below.

### SAFE_AUTO_DELETE
- **`package-lock.json`** — Bun is the declared package manager (`bunfig.toml`, `bun.lock`).
  The npm lockfile is a second source of truth that can drift. (Confirm no CI step consumes
  it first.)

### REVIEW_REQUIRED
- **Unused `src/components/ui/*` shadcn primitives** — 46 files; several are likely unused
  (candidates seen: `carousel.tsx`, `input-otp.tsx`, `menubar.tsx`, `resizable.tsx`,
  `chart.tsx`). **Verify import usage per file before removing** — some are referenced
  indirectly.
- **Model-catalog duplication** — `src/lib/ocade-models.ts` (5 models) vs
  `src/lib/ai-gateway.server.ts` `OCADE_MODEL_DISPLAY` (3 models). Consolidate to one source
  of truth (do not delete blindly).
- **Committed `.env` with Supabase keys** — a real `.env` (publishable/anon key + project
  ref) is checked into the tree. The anon key is RLS-protected and semi-public, but committing
  `.env` is poor hygiene. Decision required: rotate + git-ignore, or accept. **Out of scope
  for this docs-only PR.**
- **Dense same-day migration history (26–27 files)** — candidate for squash *awareness* only;
  `AGENTS.md` warns against rewriting pushed Lovable history, so treat as MUST-NOT-rewrite in
  practice.

### MUST_KEEP
- `src/routeTree.gen.ts` (generated), `src/integrations/lovable/*` (auto-generated,
  load-bearing for the AI gateway), `src/lib/lovable-error-reporting.ts`,
  `src/lib/ai-gateway.server.ts`.
- All `src/lib/*.functions.ts`, both Supabase clients (`client.ts` browser + `client.server.ts`
  server — legitimately distinct), all migrations, `features.ts`, `actions.ts`,
  `src/lib/storage/*`, `demo/*`.
- All FICIA / MADEE / CANIA code, auth, onboarding, RLS policies, StorageAdapter, theme,
  cursor.

---

## 8. OCADE target architecture

The goal is to complete OCADE **without weakening** the existing honesty guarantees.

1. **Provider routing that the chat path actually consumes.** Today the chat endpoint
   hardcodes `provider_id: "lovable-ai"`, so the provider-selection UI is decorative for live
   inference. Target: `api/ocade.chat.ts` reads `ocade_provider_prefs` and dispatches to the
   selected, server-validated provider (Lovable gateway now; OpenAI-direct/Ollama only when
   their `setup_required` gate is satisfied). Keep secrets server-only.
2. **Single model catalog** — collapse `ocade-models.ts` + `ai-gateway.server.ts` display
   list into one exported source.
3. **Projects data model** — real tables (e.g. `ocade_projects`, `ocade_project_items`) with
   RLS, wired to the Composer selector, replacing the "Planned" placeholders. Register
   corresponding Features + Actions (No-Dead-Button policy).
4. **Files pipeline** — an authenticated Files route + StorageAdapter-backed store; non-image
   extraction so files can inform chat. Gate anything not built as `setup_required`.
5. **Replay / learning** — persist and replay OCADE sessions using the existing audit
   patterns (`ocade_provider_events` / `activity_log`), not a new fake log.
6. **Native Companion boundary** — keep Work mode honestly gated behind
   `NativeCompanionRequiredError` until a Tauri/Cursor build exists.

Every new visible control must map to a **real registered Action**, or be hidden / shown as
Disabled / Setup Required / Native Companion Required with a reason.

---

## 9. Ordered implementation slices

Each slice is independently shippable and leaves the app in a working state.

1. **S1 — Provider routing wiring.** Make chat honor `ocade_provider_prefs`; keep Lovable as
   default. Single model catalog.
2. **S2 — Settings truthfulness pass.** Audit each of the ~24 `setup_required` sections;
   implement the cheap real ones (Profile, Notifications, Language), keep the rest honestly
   gated.
3. **S3 — OCADE Projects.** Tables + RLS + Composer wiring + Features/Actions.
4. **S4 — Files (authenticated).** Route + StorageAdapter store + upload; non-image
   extraction behind a gate.
5. **S5 — Tasks (authenticated).** Route + backend, mirroring the demo shape.
6. **S6 — Replay/Learning.** Session capture + replay UI over existing audit tables.
7. **S7 — Test harness.** Introduce Vitest + first tests on compliance-critical paths
   (timesheet lock, approvals SoD, action confirmation). **Do not weaken any check to pass.**
8. **S8 — Native Companion spike.** Define the IPC contract; keep browser build gated.

---

## 10. Acceptance tests for each slice

- **S1:** Selecting OpenAI-direct with a valid server key produces a response from that
  provider; with no key it stays `setup_required` and chat falls back to Lovable — verified by
  a real `ocade_provider_events` entry, not a mocked one.
- **S2:** Each shipped settings section performs a real registered Action; every unshipped one
  still renders `SetupRequiredState` with a reason. `validateRegistry()` passes.
- **S3:** Create/select/delete a project persists across reload (RLS-scoped to the user);
  disabled "Planned" badges are gone only where the feature is now `active`.
- **S4:** Upload a file → it appears in the authenticated Files route and (if extractable)
  informs a chat answer; non-extractable types show an honest "not sent" notice.
- **S5:** A task created while signed in survives reload and is scoped by RLS.
- **S6:** A completed OCADE session can be replayed from persisted records; replay shows real
  timestamps/events.
- **S7:** `bun run test` green; a deliberately broken RLS/confirmation check makes a test
  **fail** (proves tests are load-bearing).
- **S8:** Work mode remains disabled in the browser build and only activates against a running
  Native Companion.

Cross-cutting acceptance (all slices): `bun run lint` clean; TypeScript strict passes;
responsive at mobile/tablet/desktop; no new dead buttons (`validateRegistry()` + FeatureRegistry
registration guards).

---

## 11. Risks and rollback

### Risks
- **Committed `.env` with Supabase keys** — anon key is RLS-protected but should be rotated +
  git-ignored; treat as a hygiene/security follow-up.
- **Orphaned `ficia_time_entries`** — code/types reference a table with no `CREATE TABLE`
  migration; a clean `supabase db reset` or CI provision would break timesheets. Reconcile
  before automating DB provisioning.
- **Zero automated tests** on compliance-critical FICIA/timesheet/approval logic labeled
  "must not break" — highest-leverage gap; any refactor is unguarded.
- **Lovable sync coupling** — commits to the connected branch sync to Lovable; `AGENTS.md`
  forbids rewriting pushed history. Do not squash/rebase pushed migrations.
- **Dual lockfiles** — `bun.lock` + `package-lock.json` can diverge and produce
  environment-specific installs.
- **Provider UI vs reality drift** — until S1, provider selection does not affect live
  inference; users could believe they switched providers when they did not. (Diagnostics are
  honest; generation is not yet routed.)

### Rollback plan
This PR adds exactly one documentation file and touches no runtime surface, so rollback is
trivial: revert the single commit or delete the `docs/ocade-current-state-audit` branch. No
migrations, config, env, or lockfile changes are included, so there is nothing to un-apply in
Supabase or the build.

**Rollback point for future OCADE work:** base commit `cd0ad8f` (== `origin/main` at audit
time). Each implementation slice (§9) should be its own branch/PR with its own revertable
commit.

---

## 12. Honest percentage estimates

Rough, evidence-based completeness toward a shippable OCADE product. Not precise metrics —
they reflect how much of each area is real vs. gated/missing per the findings above.

| Area | Estimate | Basis |
|---|---:|---|
| **OCADE UI (shell, chat surface, composer, model settings)** | **~80%** | Shell, chat surface, model-settings page, voice, attachments UI all real; Projects/Outputs/Replay panels are disabled placeholders. |
| **OCADE web logic (chat orchestration, persistence, prompt-improve)** | **~70%** | Streaming, persistence, privacy enforcement, prompt-improve all real; provider routing not consumed by chat; no Projects/Replay logic; non-image files unhandled. |
| **Model integration** | **~65%** | One real streaming provider (Lovable gateway) with vision + graceful fallback; OpenAI-direct/Ollama tested but not wired to generation; catalog drift. |
| **Storage** | **~85%** | Three real adapters (IndexedDB AES-GCM, Supabase sync, PC-vault stub that honestly throws), per-data-class privacy resolver, RLS — mature. PC-vault requires Native Companion. |
| **Browser automation** | **~0%** | No dependency or implementation; marketing copy only. |
| **Native / computer control** | **~5%** | Only honest "Native Companion Required" gating + IPC-shaped placeholders; no runtime. |
| **Cross-platform readiness** | **~40%** | Responsive web (mobile/tablet/desktop) works via a single `md` pivot; Feature `platforms` metadata exists; but Windows/macOS/Android/iOS builds and the Native Companion do not exist. |

Platform-wide, treating "real & shippable web features" broadly: **FICIA ~90%, MADEE ~85%,
CANIA UI ~80% (live data ~10%), core platform (auth/onboarding/settings shell/theme/devices/
privacy/vault) ~80%.** These are the "must not break" areas and are the most complete.

---

*Prepared as a read-only audit. No source files were modified, deleted, formatted, or
repaired in producing this document.*
