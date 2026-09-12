# OCADE Project Memory

## Current mission

OCADE is executing the simplification/rebuild mission in `PLAN.md`. The previous broad implementation was completed and merged to `main` at commit `4424a15abfe0fcf6b0e5550a0ee27095e7522029`, but that architecture is now intentionally superseded by the product decisions in these rewritten authorities.

Implementation branch: `claude/ecstatic-goldberg-4nycdu`, created from `origin/main` at `36df21d692ab22181b9637d7d4b6770d3b801405`.

## Progress

### Phase 0 — baseline, total read and isolated branch — DONE

- Baseline measured with `node scripts/measure-loc.mjs --by-dir` on the tracked source tree: **1904 files, 398,999 lines**.
- Method: git-tracked files with source extensions (`.ts .tsx .mts .cts .js .jsx .mjs .cjs .css .sql .rs .py .java .kt .swift .html .sh`), excluding `node_modules/`, `dist/`, `build/`, `docs/design-references/`, `vendor/`, `*.d.ts`, `*.gen.ts`, `src/routeTree.gen.ts` and `src/integrations/supabase/types.ts`. The same command is used at every later checkpoint.
- Top-level baseline: src 292,770 · scripts 43,935 · native 34,482 · supabase 22,259 · extension 2,213 · root 698 · ios 668 · mobile 629 · public 523 · android 504 · relay 318.
- Full KEEP/REUSE/REPLACE/DELETE map recorded in `release/OCADE_PLAN_CLASSIFICATION.json`.

Traced final authorities that must survive: Supabase Auth/integration, `src/lib/security`, `src/lib/commercial` (usage), `src/lib/limits` (rate limiting only), `src/lib/intelligence` + `supabase/functions/ocade-intelligence` (Gemini boundary), `src/lib/brain` OPFS model lifecycle, `src/lib/ocade-chat-store.ts` + `ocade.functions.ts`, `src/lib/files`, account/notification settings, payments/entitlement authority, hidden admin gate, legal/founder content.

Phase 0 decisions: one offline runtime backend (WASM GGUF, `@wllama/wllama`) because the stored model is a GGUF and an MLC/WebGPU backend would need a second model; `commercial` is the single usage authority; Supabase rows are the only chat storage.

### Phase 1 — approximately 90% legacy cleanup — DONE

- After cleanup: **582 files, 79,319 lines** — **80.1% removed** against the Phase 0 baseline of 398,999, same command.
- By top level: src 48,831 · supabase 22,259 · scripts 7,008 · root 698 · public 523.
- Still to come: `supabase/migrations` (22,259 lines) is reduced in Phase 10, and `src` falls further as the shell, `styles.css`, theme provider and settings are rebuilt in Phases 2–9. The honest figure at this checkpoint is 80.1%.
- Deleted: every retired route (Code, Projects, Tasks, Artifacts, Customize, Devices, Search, activity/automations/connectors/health/inbox/knowledge/lab/models/monitors/notifications/permissions/shared/studio/system/templates/work, cania/ficia/madee/home/challenge/onboarding/organization, all `settings.*` routes, blog/careers/company/compare/data-rights/download/faq/invite/press/pricing/products/search/security/status/support/team, share, checkout.success, lovable OAuth consent, bridge and status APIs, the landing `/` and the 4,519-line `ocade.index` chat).
- Deleted runtimes/libraries: agent, skills, work, tasks, code, artifacts, research, native, mobile, local, edge, runtime, memory, capabilities, provenance, reasoning, retrieval, recovery, packaging, release, launch, hardware, telemetry, diagnostics, landing, status, support, locale, prompt, entry, vision3d, orb, motion, voice, device, media, search, providers, organizations, attachments, comments, creative, engine, engineering, healing, messaging, the automation worker family and the donor `src/primary-logic` tree.
- Deleted platform trees: `android/`, `ios/`, `mobile/`, `extension/`, `native/`, `relay/`, `vendor/`, `imports/`, `capacitor.config.json`, `docker-compose.yml`.
- Deleted 383 of 395 flat `src/lib/__tests__` files and the brain tests bound to the removed vault; 12 authority tests kept. Deleted 179 of 205 scripts, all 118 stale `release/` evidence files and the five platform-specific workflows.
- Dependencies removed (288 packages): capacitor ×4, lovable cloud-auth, @mlc-ai/web-llm, three + @types/three, chromium-bidi, playwright-core, qrcode-generator, pdfjs-dist, node-llama-cpp, @yao-pkg/pkg, @tauri-apps/cli, ffmpeg-static, ffprobe-static, fflate, esbuild. npm scripts cut from 130 to 30.
- Reduced repository reread: a full import trace found 42 files with dangling imports. That list is the exact rewire scope for Phases 2–9 and is the reason the tree does not build at this checkpoint; Phase 2 rebuilds the shell and routing on top of it.

### Phase 2 — minimal shell and routing — DONE

- One shell (`src/components/shell/AppShell.tsx`): sidebar with OCADE, New chat, Chat, Library, Cowork and Account; Settings opens from Account as a compact panel; a drawer at phone width. Built from the Grok reference for structure and density only.
- `/` is Chat (`src/components/chat/ChatWorkspace.tsx`): centred workspace, `Ask OCADE`, composer with attachment/microphone/send and the Auto | OCADE | Offline selector. Signed-out Send reaches `/auth` and the message is held in the tab rather than discarded.
- Routes now: `/`, `/library`, `/cowork`, `/about` (About the Founder, absorbing the founder page), `/help` (new, absorbing faq/support), `/terms`, `/privacy`, `/auth` + callback/verify, `/reset-password`, `/admin` (one hidden screen), payments webhook, robots, sitemap. Everything retired returns 404.
- Rebuilt rather than carried forward: `__root.tsx` (no depth scene, no locale boot, no landing entry), `styles.css` 1157 → 587 lines (no REAL theme, aurora, depth system, orb or companion animations), the appearance authority (`src/lib/appearance.tsx`, three preferences instead of cursor kinds, depth strength, trails and an rAF low-performance sampler), `GlassPanel`, `BrandMark`, `PublicPage`, `AuthShell`, the admin gate.
- Offline runtime reduced to one backend: the WASM/GGUF adapter. WebGPU/MLC, the desktop bridge, the paired desktop, the shared-tab engine, the native companion handoff, the device-mode resolver, the brain router, the tier-benchmark promotion store and the two duplicate intelligence transports are gone. `browser-catalogue.ts` (4 tiers, 2 families) became `model-catalogue.ts` (one artifact).
- Restored from the Phase 1 sweep after tracing proved they were required: `model-vault.ts` (versioned OPFS storage, atomic activation, rollback, removal), `install-telemetry.ts`, `telemetry/operation-health.ts` (the Edge health record), `diagnostics/error-journal.ts`, the health endpoint (`lib/health.ts`), the Unicode sanitizer (now `security/unicode-sanitization.ts`) and the device identity the offline allowance needs (now `commercial/device-identity.ts`).
- Launch-gate removed from `server.ts` and `cloudflare-entry.ts`: the product is launched and a permanently open gate was a second authority deciding what the public may see.
- Gates: typecheck clean, eslint 0 errors, prettier clean, 779 unit tests pass, production build succeeds, and `npm run audit:shell` proves 23 real-browser checks against the served build (routing, sidebar, composer, pending message, retired routes 404, phone drawer, no sideways scroll, no page errors, no provider/runtime identifier on screen).
- Measurement: **562 files, 73,776 lines — 81.5% below the Phase 0 baseline.**

**Tests deleted with their surfaces, to be re-authored by the phase that rebuilds each:** auth surfaces and account safety (Phase 3), every-AI-surface-is-gated and offline usage integration (Phase 5), limits server wiring (Phase 6), model product presentation and the offline shell mirror (Phase 7), notification settings and "nobody can be charged" (Phase 9), the public security claims page and the MFA challenge gate (Phase 3 decides whether the challenge screen returns; the assurance middleware on server functions is untouched and still fails closed).

### Phase 3 — authentication rebuild — DONE

- `/auth` rebuilt (821 → 372 lines): Continue with Google as the primary action, then one segmented Email | Phone choice that sends a six-digit code. Supabase Auth is the only identity authority; the third-party auth wrapper and the Apple/Microsoft buttons for providers nobody configured are gone, and `OAuthProvider` is now the single provider the product actually has.
- New: `src/lib/auth/phone-numbers.ts` — an international country picker (28 calling codes) and one pure `toE164` resolver that drops a national trunk zero, lets an explicit `+` override the picker, and refuses what cannot be valid before a provider ever sees it.
- The password is off the way in, by decision: it is optional, managed under Account, and `/reset-password` remains for accounts that have one. That screen was rebuilt in the product's current language and gained the password-visibility control the checklist asks for.
- `/auth/verify` rebuilt: exactly six digits, the resend countdown as the control's own label, real backoff on wrong codes. The `intent` flag that decided `shouldCreateUser` is gone with the separate sign-in/create screens it existed for.
- The second-factor gate is back, and one layer up: the challenge is `/auth/challenge` rather than `/_authenticated/challenge`, so the screen that completes signing in no longer sits behind the gate that requires signing in to be complete. `_authenticated` redirects an enrolled `aal1` session to it, fails open on an unreadable assurance answer, and re-throws the redirect — the server-side `requireAssurance` middleware is still the lock and still fails closed.
- `DEFAULT_NEXT` is `/` (Chat). It pointed at `/ocade`, a route that no longer exists.
- Re-authored the tests deleted in Phase 2: `auth-surfaces.test.ts` (one identity authority, one provider, no password on the way in, no provider text in a refusal, throttling present, every destination through `safeNext`) and a new `phone-numbers.test.ts`.
- Gates: typecheck clean, eslint 0 errors, prettier clean, 803 unit tests pass, build succeeds, `npm run audit:auth` proves 10 real-browser checks and `npm run audit:shell` still proves 23.
- **Not proven here, and named as unproven:** that Google, email delivery and SMS are configured on the live Supabase project. The browser proof runs against a local build whose readiness flags are set locally; production still fails closed until each `VITE_AUTH_*` flag is set against a verified live provider.

## New final product

Primary customer destinations:

- Chat
- Library
- Cowork, with Cowork/Jarvis modes inside it
- Account → Settings

Public retained pages: About, Help, Terms, Privacy.

Retired as standalone customer products: Code, Projects, Tasks, Artifacts, Customize, Devices, Search dashboard, pricing, old landing, desktop/Copilot and old Jarvis/Cowork UI.

## Execution order

1. `PLAN.md`: read/scan, aggressive cleanup, read again, then rebuild Chat/Auth/Usage/Gemini/Offline Intelligence/Library/Settings/Supabase core.
2. Prove the core completely.
3. `PLAN2.md`: extract `.incoming/OCADE_JARVIS.zip`, make it the canonical Cowork/Jarvis runtime, delete superseded old runtimes, then prove full product.

Do not start PLAN2 early.

## UI references

The only visual UI reference set is:

- `docs/design-references/grok/` — primary and sole layout/density/UI reference.

Use `docs/UI_REFERENCE_CHECKLIST.md` for the lightweight production checklist.

The former Stitch/Jarvis 3D reference folder/archive is removed and must not be treated as a design source. Build original OCADE UI; references do not authorize proprietary asset/copy cloning.

## Offline Intelligence

Internal model: Qwen 2.5 1.5B, never customer-facing by real name.

Customer terms: OCADE / Offline / Offline Intelligence.

Required lifecycle: automatic first-visit preparation, OPFS, adaptive parallel chunks, resume, integrity verify, repair only missing/corrupt chunks, install once, reuse across refresh/sign-in/out/service-worker/deploy/commit/main merges. Model identity is independent of app SHA.

## Online Intelligence

Use exactly these Supabase server/Edge secrets:

- `GEMINI_API_KEY_PRIMARY`
- `GEMINI_API_KEY_SECONDARY`
- `GEMINI_API_KEY_TERTIARY`

Never put them in normal tables/browser bundles.

## Usage

Free: 28 successful user requests / 388 minutes, account-wide across devices and online/offline. One successful user request counts once even when Cowork later performs many internal steps.

## Auth

Supabase Auth remains authority. Primary Google, plus email OTP and phone OTP with country picker. Optional password may live under Account. Production provider availability must match actual configured delivery/provider state.

## Supabase

Last verified live project before redesign: `sazhgaisyhkdbrooycdv`. Re-verify before migrations.

The redesign will remove database objects dedicated only to retired standalone products after final dependency tracing. RLS/least privilege and the single subscription/usage authorities remain mandatory.

## OCADE JARVIS donor

Archive: `.incoming/OCADE_JARVIS.zip`.

The owner wants its donor feature set retained when PLAN2 begins. It becomes the single Cowork runtime. Normal Cowork is prompt/task UI; Jarvis is online-Gemini voice/hands-free presentation over the same runtime.

## Agent defaults

Always:

```text
/ponytail full
/caveman full
```

Ponytail controls engineering behavior. Caveman compresses chat output only. Correctness/PLAN authority always wins over compression.

## Next action

`PLAN.md` Phase 4 — rebuild Chat completely. Wire `ChatWorkspace` to the conversation store: send through the intelligence router, stream the answer, persist to Supabase, list recent conversations in the sidebar with rename/archive/trash/restore, route attachments to Library, show concise one-line failures, and never render answer controls when there is no answer.

Update this file after every verified major phase with current branch/SHA, completed gate, exact next action and LOC checkpoints when measured.
