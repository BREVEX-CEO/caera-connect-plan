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

### Phase 4 — Chat rebuilt — DONE

- `src/lib/chat/use-chat.ts` is the one authority Chat renders from: conversations, transcript, send, streaming, persistence, rename, archive, trash, restore, delete-all. The send order is fixed and is the product's correctness — permit, conversation, question, answer, delivery, settle — so a refused request never leaves a question nobody answered, and a request that produced nothing releases rather than charges.
- `ChatWorkspace` renders and decides nothing; `MessageList` shows a question as a compact bubble and an answer as prose with a Copy control that exists only on a finished answer; `ConversationList` owns Recent with rename/archive/delete behind a hover menu.
- One transport per backend and one assembly point: `intelligence/offline-transport.ts` wraps the single WASM adapter, `intelligence/ocade-intelligence.ts` is the only construction of the router. The two duplicate local transports are gone.
- Narrowed with the product: `IntelligenceBackend` 6 → 2, `GenerationSurface` 8 → 2, and the retired chat server functions (side threads, citations, reactions, citation forgetting) deleted.
- Removed the Lovable preview auth storage — a generated module that brokered the session token to a parent frame over postMessage on a host-name match, and a second auth storage authority.

**Three real defects the browser proof found, none of which a unit test could have:**

1. `online-client.ts` stored the global `fetch` by reference and called it as `deps.fetch(...)`. Chromium refuses that — "Illegal invocation" — so every online request threw before leaving the page, the router read it as a transport failure, and Automatic fell silently through to the on-device engine. Online intelligence could never have worked in a browser, and the failure looked exactly like a device still preparing.
2. The conversation menu closed on any `pointerdown` and exempted itself with `stopPropagation` in a React handler. React attaches listeners to the root container, so that does not stop a sibling listener on the same node — Rename, Archive and Delete all silently did nothing. Now it closes only on a pointer that landed outside the menu.
3. Choosing Rename unmounted the menu, and removing the focused menu item moved focus to the body — arriving as a blur on the field that had just appeared, which committed the unchanged title and closed itself in the same frame. Focus is now taken on the next frame and an earlier blur is ignored.

- Proof infrastructure: `scripts/e2e/supabase-stub.mjs`, a purpose-built loopback Supabase (auth, PostgREST, the usage RPCs, the Edge Function's SSE shape) replacing a 2,075-line donor stub that modelled organizations, support articles and status incidents. It proves OCADE's own wiring and is explicitly not RLS, not the ledger's concurrency and not the provider.
- Gates: typecheck clean, eslint 0 errors, prettier clean, 797 unit tests, build, and three browser journeys — `audit:shell` 23, `audit:auth` 10, `audit:chat` 14.
- Measurement: 579 files, 73,911 lines — 81.5% below baseline.

**Named as unproven, not faked:** this sandbox has no egress to the hosted Supabase project (organization network policy), so no browser proof here touches the live project, real Gemini or real SMS/email delivery. A dedicated proof account `ocade-e2e@ocade.test` exists on the live project for when a networked environment is available; nothing else on that project was touched.

### Phase 5 — account-wide usage authority — DONE

- One authority confirmed and the duplicates removed: `src/lib/commercial` owns the allowance, `src/lib/limits` stays the request rate limiter, and the two unused parallel modules (`ocade-allowance.ts` device arithmetic, `ocade-usage.functions.ts` entitlement read) are deleted.
- Settings gained a Billing category showing the allowance: plan, what is left in this session, when it returns, and the rule that one request counts once. Shaped on the server by tier — Free sees exact numbers, paid plans see a proportion — so a browser cannot ask for the equivalents behind a percentage.
- The number is read fresh whenever it is opened and invalidated after every settled request, because a cached allowance is wrong in exactly the two cases that matter: just after sending here, and any time after sending on another device.
- Re-authored `every-ai-surface-is-gated.test.ts` for the reduced product: one assembly point for the router, every surface takes a permit before it streams, an exhausted request never falls through to the on-device engine, every path settles, and delivery is recorded only when something was delivered.
- `npm run audit:usage` proves 12 checks in a real browser: a free account starts at 28, a successful request costs exactly one, an exhausted allowance refuses with a truthful reset time and invents no answer, and history, Settings, Billing and Library all still open while it is exhausted.
- Gates: typecheck, eslint 0 errors, prettier, 805 unit tests, build, and four browser journeys — shell 23, auth 10, chat 14, usage 12.

**Named as unproven:** two devices racing for the last use is PostgreSQL's row lock, proven in the database tests rather than in the browser; and the loopback stub mirrors the ledger's arithmetic, not its concurrency.

### Cleanup checkpoint — final aggressive pass before Phase 6 — DONE

Owner instruction, on top of the phase order: one more destructive pass over
everything outside the protected Chat and Auth foundations, then rebuild the
visible UI against the Grok reference. Chat and Auth logic were not rewritten —
only their presentation moved.

- **Donors are gone for good.** `.incoming/` and `OCADE JARVIS.zip` deleted;
  `CLAUDE.md`, `PLAN.md`, `PLAN2.md`, `docs/ARCHITECTURE.md`, `docs/Backend Schema.md`,
  `docs/DECISIONS.md`, `docs/PRD.md`, `docs/TESTING.md`, `docs/TRD.md` and this file
  no longer expect one to arrive. `PLAN2.md` now writes one Cowork runtime for OCADE.
  The historical "what was deleted" lines stay, because they are the record.
- **Deleted outside the foundations:** the unmounted legal-consent cluster, the whole
  `src/components/ui` shadcn set, `src/components/shell/{EmptyState,GlassPanel,shell-context,use-shell}`,
  20+ dead `src/lib` modules, the customer-checkout cluster with no surface
  (`hooks/usePaddleCheckout`, `lib/paddle.ts`, `utils/payments.functions`,
  `payments/checkout-availability`, `payments/entitlements`), the orphaned
  `ocade-injection-guard` + `security/unicode-sanitization`, `lib/stream-limits`,
  the six-module `src/lib/offline` readiness cluster that duplicated what
  `public/sw.js` already does alone, `components.json` and `.lovable/`.
  The server-side billing hook is kept: the webhook route, `webhook-apply`,
  `paddle-plans`, `paddle.server` and `entitlement-resolver` are how a paid tier
  ever becomes true.
- **Dependencies:** 7 `@radix-ui` packages, `class-variance-authority`,
  `tw-animate-css`, `@testing-library/dom`, `@testing-library/react`, `jsdom` and
  `@webgpu/types` removed. 15 runtime dependencies remain.
- **Markdown:** only the fourteen authorities named in `CLAUDE.md` remain; the three
  strays (`public/fonts/README.md`, `public/models/README.md`, `supabase/APPLY_ORDER.md`) are gone.
- **`verify:full` is honest again.** It named 38 gates, 30 of which belonged to
  products that no longer exist. It names the 14 that have a subject in this tree,
  and CI and the production deploy workflow both run that one list. The deploy
  workflow's launch-lock verification — which asserted the old landing copy and a
  503 from `/auth` — is deleted; it contradicted the product.
- **Two gates were repaired at the root, not silenced.** `check-reachability.mjs`
  now treats an `ENTERED_ELSEWHERE` module as an ENTRY, so what the Edge Function
  imports is no longer reported as dead; and a stale exemption is judged by a
  second walk that excludes those entries. It also carries `AWAITING_MOUNT`: 15
  modules that reach nobody yet, each with the unfinished phase that owes them a
  surface (4 for Phase 7, 11 for Phase 9). `PLAN.md` Phase 12 requires that list
  to be empty, and an entry that is deleted or mounted is reported as stale debt.
- **UI rebuilt to the reference proportions** (`docs/design-references/grok/`, measured
  off the screenshots): 256px sidebar with 40px nav rows at 15px, sentence-case section
  labels, an empty state that centres the question and the composer together as one
  group, a 768px composer at ~100px tall with a 16px radius, a 15px transcript, and a
  896×640 settings modal with a 200px category pane. Near-black ground, one hairline,
  no cards, no gradients.

- **Measured:** 528 tracked source files, 69,604 lines — 72.3% fewer files and 82.6%
  fewer lines than the Phase 0 baseline of 1,904 / 398,999, same command.
- **Gates:** `npm run verify:full` passes all 14 on this tree, and the four browser
  journeys pass 59 checks against the production build — shell 23, auth 10, chat 14,
  usage 12. Chat and Auth behave exactly as they did before the pass.

### Phase 6 — online OCADE through Gemini — DONE

- **Three secrets, and no fourth.** The Edge Function read an unprefixed
  `GEMINI_API_KEY` as the primary for compatibility with an earlier deployment.
  `PLAN.md` says exactly three, so the alias is gone and all three slots are read
  through `PROVIDER_KEY_ENVIRONMENT` rather than retyped strings — one place says
  what the server may read.
- **The boundary accepts only the surfaces the product has.** It validated against
  eight, six of which belong to deleted products. `GENERATION_SURFACES` is now a
  runtime list and `online-boundary.test.ts` fails if the Edge Function's copy
  (Deno cannot follow the `@/` alias) ever disagrees with it.
- The failover rules were already implemented and are proven against a fake
  provider in `edge-handler.test.ts`: primary first, 401/403 moves to the next
  slot without retrying, 5xx and transport failures retry then move on, 429 retries
  and then answers 429 rather than rotating to evade a project quota, and nothing
  fails over once output has begun.
- **Re-authored the limits server-wiring test** deleted in Phase 2, for the reduced
  surface: every policy has a caller, the one-time-code sender and the payment
  webhook are both behind one, and the webhook keys by its source rather than by an
  account an unauthenticated caller supplied. The `research` and `billing_read`
  policies had no caller left and are deleted.
- **`npm run audit:online` proves 12 checks in a real browser:** an online answer
  streams through OCADE's own boundary; the request carries the person's identity
  and a server-issued permit naming the same generation and surface; a refused
  boundary produces a truthful sentence and no invented answer; a refused request
  costs nothing; and no key name, provider host or model identifier reaches the
  page or any script the browser downloaded.
- **A defect the journey found:** the sidebar's New chat navigated to `/?new=true`
  and nothing listened. `useChat` had `newConversation` and no caller, so the open
  conversation stayed on screen and the next message was appended to it. Wired, and
  the parameter is consumed so a reload is not a second reset.
- **Measured:** 528 files, 69,615 lines. Gates: all 14 in `verify:full`, plus five
  browser journeys — shell 23, auth 10, chat 14, online 12, usage 12.

**Named as unproven:** that Gemini itself answers, and that the three secrets are
set on the live project. This environment has no egress to `sazhgaisyhkdbrooycdv`
and the Supabase MCP exposes no secret listing. The live Edge Function is at
version 2 and is the OLD code: one `GEMINI_API_KEY`, model `gemini-3.7-flash`, no
failover, eight surfaces. **Phase 12 deployment obligation:** set
`GEMINI_API_KEY_PRIMARY` (and optionally `SECONDARY`/`TERTIARY`) on the project,
redeploy `ocade-intelligence` from the merged tree, and verify a real answer —
without the primary secret the new function reports itself unavailable rather than
falling back to the old name.

### Phase 7 — Offline Intelligence rebuild — DONE

The engine was already here and nobody could reach it. This phase gave it a
surface, a signed allowance and the tests its gate asks for.

- **The lifecycle had no screen.** `useInstallation` — watch, retry, pause,
  uninstall, reinstall, repair — had no caller anywhere, so the control `PLAN.md`
  insists on ("only explicit Remove deletes it") could not be pressed. Settings
  now has a **Data Controls** category with Offline Intelligence: one honest state
  line, a progress bar only while bytes are moving, Remove behind a confirmation,
  Install afterwards, and Repair only when something is actually wrong.
- **`describeInstall` speaks Phase 7's vocabulary exactly** — Preparing OCADE,
  Downloading <percent>, Verifying, Ready, Repairing, Removed — and is still the
  single authority for that line. Idle used to say "Starting OCADE…" even straight
  after a removal, which was untrue in the one case somebody is looking. The
  authority's two different "it is not installed" sentences are now one word.
- **The service worker was never registered.** `public/sw.js` has been in the tree
  the whole time with network-first navigation, an offline page and the
  `backgroundfetch*` handlers the transfer resumes through, and nothing ever
  called `register`. So the product that promises to work offline could not open
  offline. Registered after load, at the root.
- **The offline half of the allowance could not be spent.** The browser could
  reserve against a signed lease and nothing had ever installed one, because
  `allocateOfflineUsage` had no caller — a device with no network had no allowance
  and Offline Intelligence could not answer at all. `offline-allowance.ts` is the
  missing half: while there is a network it reconciles what was spent offline
  first, then tops up only when the device is low. `trustedOfflineTimeNow` moved
  into `offline-lease.ts` so the two callers share one notion of trusted time.
- **`install-once.test.ts` drives the real transfer engine** — 921 lines that
  nothing covered — against a fake ranged server: first install verifies, the plan's
  parallelism is used, an interruption resumes and asks ONLY for what is missing,
  a checkpoint from a different artifact is discarded rather than trusted, a failed
  chunk is retried, a corrupted artifact is refused as `digest_mismatch` rather than
  installed, an unverifiable one is never reported verified, and a complete
  checkpoint makes not one request.
- **Model identity is the artifact's, not the build's** — asserted now, including
  that no engine module reaches for a build identifier.
- **Deleted:** `use-brain.ts` (a hook with no caller) and `ocade-model-presentation.ts`
  (customer names for four engine tiers that no longer exist).
- **`npm run audit:offline` proves 12 checks in a real browser:** the screen is
  reachable, it says only what Phase 7 allows, it names no model, format, publisher
  or runtime anywhere in Settings or Chat, Remove asks first, Keep leaves it alone,
  removal says so plainly, and a reload does not quietly start it downloading again.
- **Measured:** 529 files, 70,009 lines. Gates: all 14 in `verify:full`, plus six
  browser journeys — shell 23, auth 10, chat 14, online 12, offline 12, usage 12.

**Named as unproven:** a real 1.1 GB install. The artifact is on a CDN this
environment cannot reach, so the transfer is proven against the real engine with a
fake ranged server rather than against the real source. Background-fetch resumption
through the service worker is proven only as far as the worker being registered.

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
3. `PLAN2.md`: write one Cowork runtime in OCADE's own architecture, with Jarvis as its voice-first presentation, then prove the full product. There is no donor tree.

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

## Cowork and Jarvis

There is no donor archive. `.incoming/` is deleted and will not return: a donor
tree is a second architecture with its own runtime, registries and permission
model, which is the thing the whole rebuild exists to remove.

`PLAN2.md` writes one Cowork runtime for OCADE. Normal Cowork is a prompt/task
presentation; Jarvis is the voice-first presentation of the same runtime.
Capabilities are built in order — browser actions, files, voice, then computer
actions — and anything not yet built is absent rather than present and disabled.

## Agent defaults

Always:

```text
/ponytail full
/caveman full
```

Ponytail controls engineering behavior. Caveman compresses chat output only. Correctness/PLAN authority always wins over compression.

## Next action

`PLAN.md` Phase 8 — rebuild Library. One `All | Images | Files` surface with search
over uploaded files/images and generated outputs, preview, download and delete,
delete-all through Data Controls, technical provenance kept out of the default UI,
and cross-device data plus private object access proven through Supabase/RLS.

Update this file after every verified major phase with current branch/SHA, completed gate, exact next action and LOC checkpoints when measured.
