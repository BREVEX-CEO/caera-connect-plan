# OCADE — ONE CANONICAL COMMERCIAL-READINESS MASTER PLAN

**Consolidated:** 28 October 2026 · **Scope:** `BREVEX-CEO/caera-connect-plan` / `ocade/p00-p22-implementation` only · **Document type:** implementation specification and evidence register, **not proof of completion**.

**Decision:** Replace the old PC-only `plan.md` checklist with one deduplicated plan integrating the uploaded **200-point `phases.md` + ten supplements**, 7 unique research reports (repeated uploads excluded), and the current repository evidence `OCADE_DEEP_AUDIT.md`, `BLOCKED_TESTS.md`, `docs/PHASES_STATUS.md`, `AGENTS.md`, `docs/DECISIONS.md`, `docs/TESTING.md`, route components and runtime sources. The old version remains available through Git history. This plan is not a command to deploy or incur charges.

> **Commercial promise:** finish authorized, useful customer work and return independently verified, editable deliverables, with truthful partial/blocked outcomes. Not arbitrary 100% reliability, not all tasks in milliseconds, and not unverified claims of competitor superiority.

**Owner controls:** Do not merge to `main`, deploy, change production, activate payments, incur charges, expose/rotate live secrets, operate the owner's PC, contact customer testers, or take other consequential actions without the owner's explicit approval. Work and commit only on this implementation branch; preserve concurrent changes. The requested cloud-only qualification is the **development/test strategy**, not permission to bypass real compatibility, customer-consent or owner-controlled launch gates.

**Canonical authority precedence:** newest explicit owner decisions > independently observed current branch > current `docs/DECISIONS.md` + `AGENTS.md` > reproduction/evidence in `OCADE_DEEP_AUDIT.md` and `BLOCKED_TESTS.md` > historical status ledgers > prior research/hypotheses. Model names, provider quotas, benchmarks and vulnerabilities require fresh verification before implementation decisions. Never mistake historical PASS or proposed architecture for working code.

## Fast index

| Phase | Order / workstream | Release-quality result |
|---|---|---|
| 00 | Inventory + proof baseline | Every reachable route/tool/state/legacy requirement has owner, test and evidence status |
| 01 | Critical safety / protocol / environment defects | No known P0 security, wrong-target, transport, STOP or false-completion defects |
| 02 | PC execution authority + exact capability preflight | Only healthy, authorized operations are admitted |
| 03 | Deterministic universal Windows/browser control | Correct target and optimal verified method; vision only when justified |
| 04 | Adaptive planning + micro-actions | Unexpected new steps/branches are discovered, completed and bounded |
| 05 | Professional deliverables + independent verification | Correct and polished PDFs, spreadsheets, documents, images, video, etc. |
| 06 | STOP / durable work / recovery + fast execution | Safe cancellation, resumption, low-latency local actions |
| 07 | Intelligence, Chat, model routing, voice, Offline | Reliable and transparent selected modes with honest quotas |
| 08 | Every route, panel, UI control, responsive and accessible state | Zero dead/confusing critical controls on supported viewports |
| 09 | Security, privacy, identity, permissions and infrastructure | Tested least privilege, safe uploads, RLS, secrets and recoverability |
| 10 | Device onboarding, mobile and cross-platform boundaries | Tested device-specific operation and transparent unsupported cases |
| 11 | Commercial operations, entitlements, payments readiness and legal | Complete customer lifecycle; payments stay disabled until approval |
| 12 | Cloud qualification + independent competitors/quality/performance tests | Reproducible real Windows/browser/mobile evidence |
| 13 | Release gate, limited pilot and launch protocol | All advertised capability gates pass on exact candidate; owner approval |

**Execution rule:** fix the first unqualified dependency; do not start UI polish or expansion while P0 target safety/transport is broken. Each phase is an implementation backlog, **not a claim that all listed capabilities are absent**. Preserve working components and replace only evidence-proven weak contracts.

## Implementation record for every task

Each issue/checklist entry MUST have: `ID | source ID(s) | current file/line/function | observed symptom | reproduction | source evidence SHA | root cause (or hypothesis) | before/after contract | smallest repair | negative/positive tests | cloud environment | measured time/cost | security effect | rollback | owner | status PASS/FAIL/BLOCKED/UNTESTED`. No "done" with absent evidence. Distinguish: **CODE EXISTS**, **UNIT PASS**, **MOCK PASS**, **REAL PROVIDER PASS**, **REAL CLOUD DESKTOP PASS**, **INDEPENDENT ORACLE PASS**, **RELEASE GATE PASS**. Aggregate P50/P95/P99 latency and cost by task family; never invent a percent.

### Baseline files to inspect / never treat as interchangeable

- `src/jarvis/agent.ts`, `protocol.ts`, `task-authority.server.ts`, `device.server.ts`, `engine.ts`, `stop-everywhere.ts`, `background.server.ts`, `upstream-turn.ts` — planner, tool policy, task authority, transport, STOP, state.
- `jarvis-runtime/ocade_device.py`, `ocade_computer.py`, `ocade_accessibility.py`, `ocade_identity.py`, `ocade_discovery.py`, `ocade_existing_browser.py`, `actions/browser_control.py`, `ocade_documents.py`, `ocade_sheets.py`, `ocade_media.py`, `ocade_egress.py` — real local actions and receipts.
- `src/components/chat/ChatWorkspace.tsx`, `src/jarvis/JarvisWorkspace.tsx`, `JarvisPanels.tsx`, `src/components/shell/AppShell.tsx`, `src/components/settings/*`, `src/routes/*` — real navigation, modal and interaction states.
- `docs/PHASES_STATUS.md`, `BLOCKED_TESTS.md`, `TOFIX.md`, `docs/TESTING.md`, `docs/CONTROL_INVENTORY.md`, `docs/DECISIONS.md` — evidence, historical expectations and open work. Resolve conflicts, do not copy old claims uncritically.
- `supabase/`, `src/lib/`, `src/integrations/`, `android/`, `scripts/`, `release/`, `.github/workflows/` — real access controls, business logic, packaging, migrations, automation and release boundaries.

**Inventory completeness job:** recursively list source/config/migrations/tests/docs/assets per HEAD and produce machine-readable `docs/audits/RELEASE_INVENTORY.json` with hashes and classifications; exclude vendored/generated/binary content from semantic audit but record its existence, license and risk. Run source search and runtime instrumentation to enumerate every route, API, UI control, branch/state, device operation, permission, model path and error. Every discovered element must have a row in coverage manifests. New routes/tools must fail CI when undocumented or untested.


## Phase 00 — Inventory, truth and dependency order (gate: evidence integrity)

**Inspect first:** branch HEAD, changes from concurrent agents, lockfile, route tree, `docs/PHASES_STATUS.md`, `OCADE_DEEP_AUDIT.md`, deployment fingerprint, platform builds; preserve existing `main` and release history. Record an immutable starting SHA and compare every audit finding against CURRENT source. Never blindly rerun a stale fix from a report.

**Deliver:** `docs/audits/RELEASE_INVENTORY.json`, `docs/audits/ROUTE_CONTROL_MATRIX.md`, `docs/audits/CAPABILITY_MATRIX.md`, `docs/audits/DEFECT_REGISTER.md`, `docs/audits/TEST_EVIDENCE.md`, `docs/audits/SOURCE_CROSSWALK.md`. Store all source paths, line ranges, owners, test IDs, supported platforms and unknowns. No overlapping second authority; use existing documents as append-only evidence where mandated.

**Test:** 200/200 canonical item mappings and all ten supplements; 100% of discovered active route/control identities in matrix (not 100% of possible unknown software); all RC01–RC17 receive current-source status; no unreviewed critical dependency or secret in build; reproducible route inventory. Generate a diff of discovered controls versus matrix and fail if missing. Unsupported hardware is marked BLOCKED, not PASS.

**Exit:** One source of truth with evidence-backed priority and no silently omitted requirement.


## Phase 01 — Repair current critical blockers before expanding features

**RC01: result backlog / 20 envelope.** `jarvis-runtime/ocade_device.py` ↔ `src/jarvis/device.server.ts`. Bound each exchange to ≤20 retained results, journal remainder, acknowledge individual `id+receipt+outcome` only after server acceptance, retry duplicates/loss safely; separate STOP/control channel from result backlog. Test 0,1,20,21,100,1000 results, malformed/duplicate receipts, process crash, reorder, latency and reconnection. No lost commands, no fake ACK.

**RC02 / RC03: Pillow and pypdf parsing risks.** Check installed versions against current advisories; update to patched compatible versions, enforce size/page/pixel/decompression limits before parsing, use isolated workers/timeouts, malware/zip-bomb tests. Never claim a CVE exploit was demonstrated by OCADE without evidence.

**RC04 / RC05: Windows paths/tool launching.** Correct Vite/DeepSeek native-vs-normalized path comparisons, sibling-prefix containment, quoting and platform executable resolution; replace bare `npx` assumptions where needed. Test Windows drive letters, UNC paths, unicode, spaces, symlinks, traversal, case, CLI suffixes in hosted native Windows; do not claim Windows PASS from Linux path tests.

**RC06: Cloudflare HIGH billing-read wiring.** Confirm correct scoped token is consumed by the intended check, validate success/denied/unavailable without leaking tokens; distinguish model capacity from account billing view. No unapproved provider charges or staging mutations.

**RC07: staging/release drift.** Test the exact source SHA, artifact hash, env-config signature, policy/migration version and device-protocol version. Fail closed when tested release differs from proposed candidate. Staging promotion only after approval.

**RC08: uncancellable file upload.** Thread task cancellation through blocking I/O, chunk uploads with abort, report already-committed effects, safely clean partials. STOP bounded under blocked network.

**RC09 / RC10: authentication protection.** Verify leaked-password protection and exact `/auth` service-worker no-cache handling; test authentication headers, old cached shells, reset flows and stale offline states. Production settings require owner approval.

**RC11: command parser.** Parse structured executable/arguments before restrictions; allow benign quoted characters while rejecting shell metacharacter abuse and workspace escapes; deny arbitrary PowerShell escalation.

**RC12: operation-specific readiness.** Don't treat `files=true` or `media=true` as evidence a precise conversion/render/recalculation works. Implement in Phase 02; this is central architectural P0.

**RC13: semantic completion gap.** Require independent content/effect/quality checks specific to user outcome, not "file exists" or string matches; negative oracle for wrong row/target/data. Implement in Phase 05.

**RC14: XLSX formula values.** Distinguish formula stored vs actually calculated; use real recalculation capability or return UNCERTAIN/BLOCKED. Verify values independently.

**RC15: Windows command isolation.** Windows executor must have scoped directories, process privileges, allowlisted/bounded commands, subprocess termination, limits and audit parity with Linux safety; no unrestricted shell for model-generated actions.

**RC16: subtitle Windows escaping.** Reproduce special-character paths and FFmpeg filtergraph across Windows locales; P2 hypothesis until confirmed.

**RC17: duplicate titles.** Never select first same-titled window. Bind unique process identity + creation/start time + HWND/automation ID + document path + task lease; ambiguous means observe/disambiguate, not act. Test two same-named docs and race with focus change.

**Other verified/historical risks to triage:** DeepSeek integration regression and subprocess boundaries, parser injection, stale tab identity, unsafe public env, privilege escalation, device pairing/replay, auth OTP delivery mismatch, bad dependency copies, model quota-reset assumptions, offline model authenticity and upload/notification settings. Check latest code before claiming any still broken.

**Exit tests:** P0 negative regressions fail before repair and pass after; 100% safety-gate tests, zero known critical security/wrong-target/false-completion defects in the defined candidate; no owner-side production/config changes. Record blocked native tests openly.


## Phase 02 — One execution authority and operation-level capability checks (PC first)

**Architecture contract:** `USER OUTCOME → scope/approval → required operations → registered healthy capabilities → exact target → bounded operation → observed effect → independently checked receipt → next action`. Centralize orchestration and permission checks; existing controllers remain specialised adapters. No model-specific executor forks and no parallel writers to the same window/file.

**Capability registry record:** operation identifier + typed input/output + format/mime + version + platform + installed adapter + declared prerequisites + measured health + user permission + allowlisted destinations + cost/time estimate + cancellation support + idempotency + verifier + expiry. Status `HEALTHY/DEGRADED/UNAVAILABLE/UNKNOWN/NOT_AUTHORIZED`; invalidate on process/path/permission/software/browser-profile change. Health checks run at startup and task admission, refresh upon failure; never convert UNKNOWN into PASS.

**Examples of required granularity:** `document.create.docx`, `document.render.pdf`, `pdf.inspect.pages`, `sheets.recalculate`, `sheets.verify.values`, `media.probe`, `media.decode`, `media.render.h264`, `media.subtitle.burn`, `media.verify.audio`, `browser.inspect.dom`, `browser.fill.form`, `uia.invoke`, `uia.set_value`, `screen.observe`, `screen.click`, `file.stage`, `file.readback`, `upload.abort`, `task.stop`. Test missing FFmpeg/Python/LibreOffice/browser/codec/network/font/permission cases before attempting main task. Use trusted packaged dependencies or checked alternatives; require approval to install/spend.

**Tool selection:** task-scoped, schema-validated, least-privileged catalogue. MCP is an optional adapter format, not the planner/security authority; no arbitrary third-party MCP auto-execution. Preserve deepseek-harness only when provenance, license, tests, policy, quota and benchmark parity support it. Preserve the owner's NO-HARDCODED-APPS rule: detect installed executables, file handlers, APIs, object models, UIA/DOM affordances; no brand-name routing tables or special benchmark shortcuts. Existing "Alternative A" stays baseline until replacement wins a reproducible A/B.

**Exit:** unknown-app capability discovery, negative permissions, healthy/missing precise operations, no unnecessary fallback or AI retries; 100% checked operation admissions in sampled and fuzzed tests.


## Phase 03 — Deterministic high-speed universal Windows/browser control

**Routing priority:** supported native application/API/object model → safe typed script/CLI and structured file-format operation → DOM/CDP/Playwright with authorized profile and tab → Windows UI Automation semantic control → fresh visual grounding → raw mouse/keyboard only when there is no reliable structured path. Order is chosen by measured health, effect safety, verification strength and cost, not unconditional "always API" when API is unsafe or inadequate. A file edit may finish without opening Word.

**Exact identity before EVERY consequential action:** bound OS user/session + device fingerprint + process PID/start-time + window handle + automation/runtime ID + document path/file identity + profile + browser target/tab/frame/origin. Revalidate on focus, tab, navigation, dialog, process/window replacement, DPI change, user takeover and queued resume. Ambiguous target → STOP/clarify; no guess, no "first matching title". Preserve original and customer manual edits; record pre/post hashes and scope.

**Browser micro-details:** discover installed registered browsers and user-authorized profiles without stealing unrelated sessions; inspect DOM, role/label/text, enabled/visible/covered/stale state; use stable locators and auto-waits; manage iframes/shadow DOM, SPA transitions, tabs, window opens, login and consent, alerts/popovers, checkboxes/radios/selects, uploads/downloads, pagination, scroll, keyboard, clipboard, file save dialogs, contenteditable, canvas fallback, credential boundary, cookie expiry, same-origin, navigation retries. No fabricated URLs, no CAPTCHA bypass, no bot circumvention.

**Windows UI micro-details:** enumerate real windows and controls; inspect semantic role, name, automation ID, patterns (Invoke, Value, Text, Selection, Grid, Scroll, Window) and bounds; infer enabled/read-only/checked/selected/expanded/focus. Support nested menus, toolbars, ribbons, tabs, grids, sliders, context menus, file pickers, font/size controls, drag/drop and keyboard access. Reinspect changed state, do not rely on memorized coordinates; deal with multiple monitors, scaling, DPI, virtual desktops, minimized/occluded windows, popup ownership, notifications, toast alerts, app restart, save confirmation, unsaved-change prompt and other-user interference. Respect UAC/secure desktop/protected sessions as explicit limitations.

**Visual route:** capture fresh correct-monitor/cropped view with dimensions and permission; use bounded image grounding, coordinate calibration, occlusion/motion/loading checks, inspect before and after, no screenshot after each character, no blind repeated pixel clicks; when semantic UI becomes available switch back. Raw keyboard/mouse actions must be bound to exact target and protected by policy.

**Operation protocol:** `task_id/action_id/idempotency_key/target_fingerprint/preconditions/capability/arguments/permissions/timeout/expected_effect/checker/safe_rollback`. Validate preconditions again at execution; commit only if target and lease hold; report precise `EXECUTED/OBSERVED/VERIFIED/UNKNOWN` and effects, not free-text success. Handle interruptions and race conditions with bounded retries.

**Exit:** multi-app unknown UI tasks, simultaneous duplicate titled docs, dynamic website state, modal surprises, rapid focus switch, scaling, interrupted write and browser/profile separation. Measure per-action p50/p95/p99; test unseen software via a cloud Windows VM; prove no wrong-target writes on adversarial suite.


## Phase 04 — Adaptive hierarchical micro-planning and bounded self-repair

**Use outcome contracts, not fixed plans.** At intake, derive final deliverable, scope, quality profile, facts and sources, explicit constraints, reversible/irreversible effects, approval requirements and independent success oracle. Surface unknown high-impact ambiguities; safe professional defaults for routine formatting.

**Three levels:** visible stable milestones (3–8), dynamic subgoal/dependency graph, task-local micro-actions chosen from real observed state. The AI may insert/remove/reorder/split steps (10 → 50+) when popups, missing fonts, conflicting sources, new document sections, media artefacts, failed preflight or unexpected UI appear. Replan only affected subtree; preserve verified parts and checkpoints. No artificial ten-step completion rule, yet strict global time/cost/recursion/attempt budgets.

**Before/after every meaningful action:** verify current target + permissions + capability + precondition; execute; compare intended postcondition with observed state; classify failures as missing prerequisite / target changed / permissions / transient / semantic mismatch / visual defect / unknown effect. Local deterministic repair for known safe cases; re-invoke AI only for genuine uncertainty. If user interrupts or changes inputs, freeze and reconcile current effects before continuing. Do not repeat external side effects without idempotency or explicit confirmation.

**Unknown tasks:** build capabilities from installed environment affordances, never hardcode Word/Excel/Calculator journeys in production. Domain standards supply quality policies and reviewers, not fixed UI click scripts. Learn reusable verified recipes only scoped to environments with validated signatures; invalidate on software version/profile changes. No automatic skill downloads.

**Worked example—professional current-information PDF:** identify question and audience → research fresh primary sources/cite dates → reconcile contradictions → outline → author factual sections → appropriate tables/charts with captions → select typography, color contrast, margins and page numbering → render → inspect pages and links → detect clipped chart/page break → adjust only affected page → independently verify content/appearance/download. More steps are added because they are needed, not because a prompt guessed their count.

**Worked example—video:** inspect clips/codecs/aspect/audio → plan edit → realize missing licensed font/audio issue → select safe alternative with permission → cut/transitions/captions/color/audio → render → inspect frames, black frames, abrupt audio/clip, sync/caption-safe area/resolution → repair only broken section → re-render and verify playback. No “file created = good video”.

**Exit:** injected new-dialog/missing tool/contradictory source tests cause automatic correct plan expansion; budget prevents infinite loops; silent false-success test detects missing page/chart/incorrect section.


## Phase 05 — Universal professional deliverables and independent verification

Implement task-family acceptance profiles, **not brand-specific executor branches**. Each output must carry source and deliverable hashes, structured content check, independent effect check and visual/perceptual inspection where relevant. Verifier must not simply parrot planner's text. Prefer deterministic recomputation or alternate parser/renderer, then independent reviewer for subjective quality. If confidence/evidence insufficient, report `PARTIAL/UNVERIFIED/BLOCKED`.

| Family | Minimum exact end-state tests and correction loops |
|---|---|
| Research/live web | Authoritative dated sources, quoted claim grounding, conflicts, citations actually resolve, up-to-date answer, no invented references, web prompt injection isolation |
| DOCX/Word/PDF | Title/subtitle/date, sections, heading hierarchy, styles and font sizes, tables, chart data, captions, numbering, header/footer/page numbers, TOC when useful, readable margins/contrast, page-break/widow handling, accessible structure, hyperlinks, metadata, correct PDF render, independent page-by-page visual check, editable original |
| Spreadsheets | Workbook sheets/cells/types, numbers, formulas, calculation engine values, relative/absolute references, errors, charts/filters, source-data reconciliation, precise row identity, formatting, imports, formula injection, save/open recalculation, independently recomputed totals and exception list |
| Presentations | slide order, aspect, titles, data, correct charts/images, layout/font consistency, contrast, overflow, speaker context, citations, render preview, editable PPTX |
| Images/photos | correct source image edited (not silently generated), subject/content preservation, dimensions/format, color/tone, no clipping, artifacts/banding, EXIF/orientation, side-by-side original and independent visual inspection, editable version when supported |
| Video/audio | timeline, cuts, duration, frame rate, aspect/resolution, color, transitions, captions spelling/timing/safe areas, missing frames, black frames, peak clipping/loudness, sync, export codec, playable output, license, independently inspected renders |
| Browser/PC workflows | exact website/app/account/tab/window, before/after authoritative state, durable receipt, safe downloads/uploads, no double-submit, no unauthorized side effects |
| Coding/files/CAD/creative/other | domain-specific validation (build/tests, parsers, geometry/model constraints, independent objective checks), preserve source and report unverifiable quality; don't promise supported software without real qualifying runs |

**Preflight resources:** runtimes/codec/font/browser installed, workspace writable, access rights, quotas, file size, content safety. Prefer native API/file pipeline and use visible app only where necessary; don't confuse workbook formula text with calculated values, or article prose with rendered document.

**Automatic repair:** compare failing criterion to affected subgoal, apply smallest supported fix, re-run independent checker, keep revision/evidence journal; bounded retries and no destructive edits to original. Deliver Open/Download preview with true filename/content type and verified source. Verify after upload, not only before.

**Exit:** ≥95% independently verified first-run completion per *advertised* task family and ≥99% within bounded recovery as an aspirational internal target on defined fixed+unseen suite; never report achieved until measured. In high-impact tasks, stronger approval may be required even when automated metrics pass.


## Phase 06 — Durable tasks, STOP, recovery, and measured speed

Separate `planned`, `authorized`, `in_flight`, `effect_unknown`, `observed`, `independently_verified`, `partial`, `blocked`, `cancelled` and `completed`. Every action uses idempotency and durable receipts. Heartbeat/connectivity failure preserves state without redoing an already committed external action. Queue safe background prefixes; unsafe step requires fresh approval or foreground intervention.

**STOP everywhere:** user STOP takes priority over normal task/result queue; enforce server-side fence preventing new actions, cancel controllable in-flight subprocess/browser/upload, report already committed and unknown effects; verify STOP on offline device, backlog 1000, blocked upload, model busy, crash/restart. Pause/Resume/Take Over must not silently resume while user is controlling the PC. Unpair/revoke immediately invalidates authority.

**Performance:** establish baseline per task in current implementation branch, p50/p95/p99 end-to-end and per operation, model calls, screenshot count, retries, CPU/memory, network bytes, token/cost. Local event-driven UIA/DOM observation; warm workers; bounded batching only when targets/conditions stable; independent safe parallelism; cached capability health; send concise state deltas not full screenshots; avoid polling; consider validated speculative batches only after correctness proof. Individual local clicks may take milliseconds; external research/render/LLM calls are seconds or minutes. No fabricated wins.

**Exit:** interruption matrix passes without duplicates or unauthorized actions, real STOP measurement under worst-case injected faults, no silent loss of outputs, p95 goals set from real baseline then improved without lowering verified-task rate.


## Phase 07 — Chat, JARVIS, model policy, Offline and voice

Keep **Chat** for conversation/research/file understanding/offline intelligence; **JARVIS** for authorized, durable computer work. Share auth, library, knowledge and model gateway safely, but never pretend offline Chat can plan online JARVIS. Default route is owner's approved Gemini 3.5 Flash-Lite only if current API model and limits verify; authorized three keys use key-local failover, never quota circumvention or secret exposure. Gemma 4 Cloudflare HIGH is explicit opt-in with initial and periodic usage warnings, true provider ID, fail-closed on unavailable; no silent fallback and no paid use. Verify exact contemporary names/quotas rather than inheriting assumptions in old reports.

Finish sign-in, consent, thread history/search/rename/archive/delete, file attachments and checks, model provenance and receipts, citations/search, privacy controls, multilingual, accessibility, streaming and interruptions. Offline model must use authorized real release artifact with integrity/checksum, resume, install/delete/readback, no hidden network fallback; verify airplane-mode responses. Voice/wake must have permissions, clear listening state, interrupt/stop, no microphone access without consent; actual speech provider/hardware qualification remains blocked until available.

**Exit:** current real-model test matrices under authorized free quota; provider down/quota/no key/rotation/High warning; offline artifact and model identifier proved; voice tests with recorded consent; high impact actions still governed by task authority.


## Phase 08 — Every page, control and visual state (the real current route tree)

**Important route truth:** `/` is Chat, **not** a separate landing page. Settings is an **Account panel/sheet**, not 19 `/settings` pages. Devices & Access lives in JARVIS/Settings panels, not a separate known route. Do not resurrect dead screens to match historical mockups. Use the exact current file-route tree and discover any added dynamic routes at test time.

**Global per-control contract — applies to every page below:** enumerate every button, link, tab, dropdown, form field, check/radio/toggle, menu, modal, snackbar/toast, file picker, card action, navigation item, icon-button and shortcut; record accessible name, label/role, target, focus order, pointer/keyboard/touch, disabled/busy/error/empty/success states, permission/auth transitions, color/contrast, hover/focus/pressed, responsive layout, reduced motion, i18n, screen-reader announcement, validation, cancel/undo and real effect. Test mouse, keyboard only, screen reader, touch 320/375/768/1024/1440+, zoom 200%/400%, high contrast and dark/light. Automate DOM control census and detect inert buttons, invisible labels, overflow, broken tab traps and unhandled promises. Every control has at least positive, negative, permission and loading/empty state tests as applicable.

| Actual route/surface | Source component | Mandatory UI/UX control inventory & acceptance |
|---|---|---|
| `/` Chat home | `src/routes/index.tsx`, `src/components/chat/ChatWorkspace.tsx`, `ConversationList.tsx`, `MessageList.tsx` | Ask composer, send/stop, attachments and reorder/remove, microphone, mode and explicit High retry, stream/cancel, conversation history/search/rename/archive/delete, citation links, file cards, errors/limits, mobile sidebar and selected thread; no blank screen |
| `/ocade-jarvis` | `src/routes/ocade-jarvis.tsx`, `JarvisWorkspace.tsx`, `JarvisTask.tsx`, `JarvisPanels.tsx`, `JarvisBubble.tsx` | Composer with mid-task messaging, conversation/new task, progress, Stop every device, Pause/Resume/Take Over, connecting/unpairing device, browser permission, task memory/schedules, voice controls, task receipt and artifacts; no fake progress |
| `/library` (authenticated) | `src/routes/_authenticated/library.tsx` | Upload picker, drag/drop, search, preview/open, download exact bytes, delete confirmation, file size/mime, empty/expired/unauthorized/loading state, keyboard access, safe filename and quotas |
| `/admin` (staff only) | `src/routes/_authenticated/admin.tsx`, `ConsoleModules.tsx` | Server-side role/MFA gate, search, cases/reasons, grants, time windows, device removal, staff/usage/audit/system modules, validation, destructive confirmation, logged receipt, non-staff denial |
| `/auth` | `src/routes/auth.index.tsx` | email/password, show-hide password, OAuth, terms/privacy links, validation, error, rate limit, recovery, redirect back to original task; no dead auth path |
| `/auth/verify` | `src/routes/auth.verify.tsx` | numeric OTP entry, resend timer/cooldown, pasted code, invalid/expired and delivery errors, redirect and keyboard focus; match actual email delivery template |
| `/auth/challenge` | `src/routes/auth.challenge.tsx` | MFA TOTP/recovery, selection, retry and cooldown, AAL promotion, blocked insufficient factor, safe return |
| `/auth/callback` | `src/routes/auth.callback.tsx` | OAuth PKCE, expired/invalid state, loading and fallback, safe return URL, no open redirect, no cached auth page |
| `/reset-password` | `src/routes/reset-password.tsx` | link token, new/confirm password, show-hide, validators, revoked/expired link, success/failed login, MFA preservation |
| `/pricing` | `src/routes/pricing.tsx` | period selector, plan comparison, accessible prices/units/features, consistent canonical usage policy, sign-in CTA, no clickable checkout while disabled by owner |
| `/about`, `/help` | `src/routes/about.tsx`, `src/routes/help.tsx` | accurate product claims, support/contact, docs, links, FAQ, current capabilities/limitations and clear escalation |
| `/privacy`, `/terms` | `src/routes/privacy.tsx`, `src/routes/terms.tsx` | approved published text, effective date, accurate data/AI/device rights, accessible reading, no misleading compliance claim |
| Agent distribution | `src/routes/agent.$file.ts` | version/hash, legitimate download, safe content type, errors and OS requirements, signed/trustworthy package when available |
| Account/Settings *panel* | `src/components/settings/settings-panel.tsx`, `settings-dialog.tsx`, `AdvancedSection.tsx`, `BillingSection.tsx`, `DataControlsSection.tsx`, `NotificationsSection.tsx`, `SignInMethods.tsx`, `TwoStep.tsx`, `UsageSection.tsx` | open/close/Escape/focus restore, account and MFA, session methods, notifications, usage and billing, privacy export/deletion, permissions, offline advanced options, clear disabled unavailable states |
| Devices, Websites, Apps & Access *panels* | `src/jarvis/JarvisPanels.tsx`, device/bubble components | discover installed capabilities, pairing fingerprint/approval, trusted browsers/sites, scope controls, background/schedule, revoked/offline/reconnecting and permission denied, Stop/Remove/Take Over |
| Global shell and boundary | `AppShell.tsx`, `AuthShell.tsx`, `ErrorBoundary.tsx`, `__root.tsx` | skip link, navigation, mobile drawer, account menu, toast/status, offline, no hydration flicker, deep link history, theme contrast, 404/500, no memory/scroll/focus leaks |
| `/api/jarvis/*`, `/api/offline/*`, robots/sitemap | `src/routes/api/*`, `robots[.]txt.ts`, `sitemap[.]xml.ts` | route auth/csrf/rate limits/status schemas, no secrets, invalid method/request handling, correct status and cache, health and URL metadata; these are backend endpoints, not interactive pages |

**Visual design:** premium restrained, consistent spacing/type/color, responsive layouts, copy quality and zero temporary/placeholding UI. Analyze screenshots and accessibility trees for every route/state; inspect across device sizes and compare against approved reference images, but avoid blindly implementing decorative animation or features with no user value. Every interactive element must do real work or be removed; don't add fake FAQ/tests/ratings.

**Exit:** route-control census ↔ authored test ID bijection; 100% critical controls exercised in supported cloud browsers, plus automated WCAG 2.2 AA checks AND manual keyboard/screen reader/contrast visual review through hosted testing.


## Phase 09 — Security, identity, privacy and cloud infrastructure

Threat-model web + powerful local agent separately. Require server-side RLS/authorization on every tenant query, API route and file; MFA for privileged/owner/staff; role boundary and owner protection; sessions/refresh/revocation; sign-in recovery, OTP, rate limits and bot resistance. Test IDOR/tenant crossover, privilege escalation, JWT replay/expiry, CSRF, XSS, SSRF, SQL injection, path traversal, web prompt injection, malicious documents/websites, command injection, supply chain, file upload malware/zip bombs and log leaks. Tools are least privilege, secure signed pairing and scoped device authority; screenshots, chats and files never become instructions with higher authority.

**Secrets:** backend-only provider/service keys, no public env or bundle/history/log/screenshots/demo keys; rotate any verified exposed credential with owner approval; spending caps, per-user quota protections, revoked sessions; separate staging/prod; deployment hook locked to owner approved release; no startup terminal access to arbitrary secrets. Verify private buckets/R2 model signatures, encrypted transport/storage, data export/delete/retention, customer consent and disaster recovery. Security baselines OWASP ASVS 5, WSTG, AI-agent injection tests; external independent review remains release gate.

**Cloudflare/Supabase/monitoring:** inventory migrations/RLS and service keys, CI/CD bindings, Workers/Pages cache/header/WAF policies, Sentry privacy, backups and restore, request IDs and trace propagation, budgets, alerts, incident contact, DDoS/degraded mode; do not assume account capabilities or quotas. Run backup/restore in disposable staging only after allowed, no production mutations. Confirm privacy/terms precisely match data handling and region obligations; obtain legal review as required.

**Exit:** no known critical/high reachable security defect; all auth/role/tenant/device negative tests pass; secrets scan current repo/history/bundles; recovery and patching documented; independent review completed rather than simulated.


## Phase 10 — Device agents and cross-platform completion

**Windows website-first:** PWA is planning UI; installed signed Device Agent performs explicitly authorized local work. Install/first-run/pair/fingerprint/permissions/Ready/Offline/Reconnecting/Needs permission; update/uninstall rollback, service wake, tray/voice/bubble/notification, crash cleanup, safe STOP and consent. Test Windows 11 hosted interactive VM(s), scaling, locked/secure desktop limits and multiple standard apps and browser profiles. No hidden cloud desktop for production customer work.

**Android:** APK optional from `ocade.in` (no paid Play Store commitment); test packaging, foreground permission flow, access-service/floating bubble, device agent lifecycle, reconnect/offline/Stop/remove, gestures and process death using cloud Android emulator **after core Windows work**. Document Play-policy/accessibility restrictions and actual Android version/device compatibility.

**iOS/macOS:** iOS mobile web/Playwright/WebKit and hosted simulator UI tests, no assertion of real iOS device computer control from browser-only tests; macOS controller must remain blocked until a real legal hosted macOS environment and permissions exist. Avoid shipping unsupported platform claims. Cloud-first no user's PC; physical-specific compatibility gets a supported-configuration limitation until externally validated.

**Exit:** each advertised platform has binary signed/hash proven, permission UX, real task evidence, STOP/upgrade/rollback, support matrix, and explicit known platform restrictions; otherwise defer it from launch scope.


## Phase 11 — Complete commercial product (without activating live payments)

Entitlements and usage must match actual selected model/agent capacity, not assumed quota; pricing page and server gate share canonical catalogue; enforce free/Basic/Premium/Max only after approved product decision, refunds/cancellation/invoices/tax and regional policies reviewed. **Payments remain disabled** under explicit owner decision; code/tests in sandbox may be prepared but no live checkout/product activation. Correctly meter token/action usage, failed/cancelled work, quotas, developer/operator spending and plan upgrades/downgrades; never bill a fabricated completion.

Complete account creation/recovery/termination/data export/deletion, support email and truthful help center, complaint/takedown/DMCA channels where applicable, accessibility statement, privacy/terms/cookie/data-use policies, retention/deletion, product licensing and third-party notices. Staff console with logged permissions and safe auditing. Release operations: incident runbook, security escalation, uptime/degraded status, on-call ownership, backup recovery drills, migration rollback, dependency updates, controlled releases, versioned support and support SLAs.

**Exit:** all non-payment customer journeys demonstrated in staging, legal/security/business obligations reviewed by authorized owner/professionals, payments gated until separate approval and readiness.


## Phase 12 — Cloud-only test laboratory, benchmark proof, and competitive ablations

**Cloud-first infrastructure:** disposable interactive Windows 11 VMs with legitimate OS/app licensing and unrestricted *test-only* control access; dedicated cloud Linux tests, real Playwright Chromium/Firefox/WebKit, isolated test Supabase/Cloudflare settings, Android emulator last, hosted iOS simulator/real macOS only if available/authorized. If free cloud cannot supply licensed Windows GUI/Office/macOS, record BLOCKED; don't substitute Linux simulation or user PC and call it qualified. No spending without approval. Use synthetic identities and disposable files, never real customer data or unrelated signed-in sessions.

**Level 1 — deterministic:** typecheck/lint/test/static security scans, frontend route/control census, all API contracts, RLS/tenant negative tests, native Python/JS tests, parser fuzz/command injection, generated file reopening, visual snapshots and a11y.
**Level 2 — integrated:** real browser↔server↔agent transport, staging identity/model keys under quotas, pairing/revoke, authentic session/cookies, long task queues, STOP/Take Over, reliable event/receipt chain, version attestation.
**Level 3 — real GUI:** native cloud Windows app UIA/visual on *two identically named windows*, multiple monitors/scaling, popups/permissions, fake lookalike targets, missing runtime, weird filenames, crash, network drop/slow upload, unexpected confirmation, wrong browser tab/profile.
**Level 4 — professional deliverables:** real multi-page current report PDF, workbook with independently recalculated formulas, image **edit** vs generation, 2-minute video edit with bad audio/captions, presentation, browser workflow, cross-app comparison, chess and CAD as **stress/research benchmarks** if legal tools exist—not advertised user support until qualified. Visual QA and independent objective oracles; include unexpected extra requirements and mid-task repairs.
**Level 5 — security and operations:** chaos/injection/fault tests, concurrent tenants, credential revocation, 1000-result backlog, rapid STOP, high load, backup/restore, service worker upgrade, malformed upload, inaccessible controls, reader/caption support.
**Level 6 — independent:** five consenting users remotely run **unseen tasks** in hosted cloud Windows sessions across a documented pilot period; operators must not provide hidden scripted help. Record human rating separate from machine verifier. If no reviewers, mark gate BLOCKED.
**Level 7 — competitor benchmark:** same task/input, same machine/network budget, dated product/model builds, permission/timeout/support boundaries, 3+ independent seeds, cold/warm runs, p50/p95/p99, success verified by same oracle, wrong target, false success, manual takeover, API cost. Compare with ChatGPT, Claude, Gemini, Microsoft UFO, Manus, OpenClaw, browser-use etc only where legally and technically comparable. Baseline current OCADE and "Alternative A" vs new ablations: preflight only, direct-only, browser/UIA, vision fallback, adaptive replanning, verifier, batching/skills. Don't claim universal victory from marketing.

**Fixed suites + unseen suite:** enforce baseline ≥95% independently verified first-run success **in every advertised family**, internal ≥99% within bounded recovery goal on supported suites, and no known severe silent false-success; include statistical confidence intervals and sufficient sample size so a single run never becomes "100%". Safety critical: 100% pass for defined permission/STOP/wrong-target/irreversible-action regression matrix; broader unknown environments remain unguaranteed. Browser/a11y route coverage 100% of discovered **critical controls** across supported states. Define per-family p95 and per-success cost budgets using baseline before optimization.

**Evidence artifact per test:** candidate SHA/hash, package/runtime versions, OS/app/browser/profile, permission, case id/seed, input hash, exact expected outcome, video/screenshot/trace/log/receipt/output hash, independent checker, start/end/p50/p95 cost, PASS/FAIL/BLOCKED reason, effect classification. Retest same release artifact after fixes; freeze before sign-off. Prohibit "screenshot of chat saying done" as oracle. A cloud-only lab may justify launch **within precisely advertised tested configurations**; it cannot logically eliminate untested real customer hardware/software variations. Extend testing/limited pilot rather than silently claim 100% across all PCs.

**Exit:** all required real-cloud suites, adversarial tests, and independent review pass; no fake results, no unapproved spend or deployment.


## Phase 13 — Release gates and controlled commercial launch

| Gate | Mandatory independently archived evidence |
|---|---|
| R0 | Inventory and 200/200 legacy mapping plus supplements and route/control census current and conflict-free |
| R1 | No known critical/high exploitable defects; independent security review, secrets, RLS/role/session/device/prompt-injection protections |
| R2 | Correct control target; zero known wrong-target or silent false-success defects in audited advertised scope |
| R3 | STOP/revoke/permissions/irreversible actions pass complete supported safety matrix under fault injection; in-flight effects disclosed |
| R4 | Real cloud Windows/browser task families meet measured first-run success gate, semantic and rendered visual quality; no mocked evidence counted |
| R5 | Durable results/backlog/backpressure, resume/crash/network/upgrade tests, source and customer file preservation |
| R6 | Every active route/control has tested critical interaction, responsive states and WCAG 2.2 AA automation + manual review |
| R7 | Exact model identity, three-key quota-aware route, HIGH explicit warnings, Offline Chat release and negative mode tests; unsupported advertised modes removed or blocked |
| R8 | Operations, support, legal, data controls, backups, billing-disabled/payout policy, costs and customer consent complete |
| R9 | Immutable exact release hash, CI, staging candidate parity, rollback rehearsal, ≥5 independent consenting pilot users, signed owner launch approval |

**Never mark 10/10 merely because code tests passed.** Each gate has PASS/FAIL/BLOCKED, evidence link, exact SHA, checker and owner. No merge/deploy/payment/paid-service launch without new approval. When a real Windows VM/license/pilot is unavailable, narrow public claims or keep BLOCKED. Release candidate must be reproducibly built and tested; post-freeze changes void gate evidence until rerun.

**Rollback:** retain prior known-good binaries, DB migrations and recovery strategy; migrations separately approved, data compatibility checked; canary first; monitor real verified outcome/error rates and STOP; pause/rollback on critical regression; report customer effects truthfully.

## Appendix A — 17 audited root causes, with current-verification requirement

These are **findings from `OCADE_DEEP_AUDIT.md` dated 28 October**, not assertions that all remain unfixed after future commits. The audit claims many source-confirmed defects but some Windows reproductions are still blocked. Each work item in Phase 01 must be linked to its detailed audit section and revalidated against HEAD.

| ID | Primary issue | New phase | Proof classification from audit |
|---|---|---|---|
| RC01 | Device retained-result count > server 20 maximum | 01/06 | source and synthetic fail |
| RC02 | Pillow pinned dependency/advisory exposure | 01/09 | dependency exposure; exploit unproven |
| RC03 | pypdf parser resource/limit exposure | 01/09 | source dependency risk |
| RC04 | Windows DeepSeek/Vite path and sibling-prefix | 01 | synthetic fail; native test missing |
| RC05 | bare npx subprocess portability | 01 | source risk; native blocked |
| RC06 | HIGH billing-read token wiring | 01/07 | source and staging fail |
| RC07 | staging code drift | 01/12/13 | source/config mismatch |
| RC08 | upload cancellation not propagated | 01/06 | source gap; real STOP blocked |
| RC09 | leaked-password protection disabled in staging | 01/09 | observed staging risk |
| RC10 | /auth omitted from no-cache classifier | 01/09 | source defense gap |
| RC11 | quoted command data false-rejected | 01/03 | synthetic fail |
| RC12 | coarse capability vs healthy operation | 02 | source-supported central gap |
| RC13 | presence check not semantic correctness | 04/05 | source limitation; real case unproven |
| RC14 | XLSX formula expressions without recalculated values | 05 | source limitation |
| RC15 | Windows terminal lacks matching Linux OS sandbox | 03/09 | isolation gap |
| RC16 | FFmpeg subtitle special-path escaping | 05 | unverified hypothesis |
| RC17 | duplicate window title chooses first match | 01/03 | source ambiguity; native effect untested |

## Appendix B — Research consolidation and deliberate exclusions

**Sources read:** OCADE Commercial-Launch Master Plan · OCADE — The Best Combined Method From All the Research · OCADE PC Control: Current Method vs Intelligent Hybrid Control · OCADE PC Control Deep Research — Architecture, Competitors, Root Causes and Production Plan · OCADE Deep Research: The Architecture That Can Make JARVIS Fast, Accurate and Commercially Ready · OCADE PC Control — Deep-Research Architecture and Launch Plan · OCADE Windows Control Architecture: MCP, Tool Discovery and Reliable Local Execution. Repeated copies are one evidence source, not extra independent agreement. Attachments propose architectures and include dated observations; `OCADE_DEEP_AUDIT.md` and checked current source are higher authority for repairs.

**Best combination:** structured tool discovery/MCP interface; Direct-first / API & files / browser DOM / UIA / visual last; verifier-gated outcome contract; adaptive hierarchical micro-planning; durable checkpoints and STOP; specialist professional artifact quality profiles; cloud-native real GUI qualification; simplified premium UI + privacy/business controls. The proposed label **Outcome-Driven Adaptive Verifier-Gated Hierarchical Hybrid Control** is a project design name, not an established benchmark.

**Do NOT:** replace healthy OCADE with a screenshot-only agent; embed fixed Office/Calculator/brand-specific runtime paths; graft entire frameworks without license/compatibility test; confuse more MCP tools with intelligence; force huge 100-step upfront scripts; expose all tool internals in customer UI; spend quotas repeatedly to measure nothing; count a fixture as a real customer outcome; silently ignore failed or blocked test; assert 0% possibility of failure or every workflow in milliseconds; weaken MFA, STOP, tenant isolation or independent verification to debloat.

**Cloud-only vs commercial:** hosted native Windows testing with realistic user sessions and an independent remote pilot is the strongest cloud-first strategy. It is sufficient to qualify **a bounded, clearly documented set of supported configurations**, not every possible customer PC. Owner-approved distribution, third-party licenses, legal/business and final launch are still required.


## Appendix C — Exact traceability of ALL original 200 requirements

This is a **deduplicated exact-text preservation** of the first uniquely numbered 1–200 requirements in the uploaded `phases.md` (subsequent 1–20 numbered supplement items are separately in Appendix D). The status is the **historical source-row disposition in `docs/PHASES_STATUS.md`, not a new PASS**; qualification must be re-evaluated against current HEAD and cloud oracles. Even if old status says PASS, reverify after the new changes. The "new phase" column is an assignment, not evidence of implementation.

| Original ID | Original requirement (exact text) | New phase | Historical status |
|---:|---|---|---|
| 1 | Make JARVIS consistently finish real tasks, not just pass automated code tests. | 01 | FAIL |
| 2 | Fix video editing reliability — the reported result was only **1 successful attempt out of 6**. | 01 | IN PROGRESS |
| 3 | Fix spreadsheet calculations, incorrect formulas and false success reports. | 01 | FAIL |
| 4 | Make the real Offline Chat model install and answer correctly without internet. | 01 | BLOCKED |
| 5 | Fix Gemma 4 High mode returning `503 high_unavailable`. | 01 | BLOCKED |
| 6 | Ensure the default Gemini model actually works consistently. | 01 | PARTIAL |
| 7 | Handle Gemini rate limits without repeated failures or excessive retries. | 01 | FAIL |
| 8 | Fix JARVIS getting stuck, repeating actions or abandoning tasks. | 01 | PARTIAL |
| 9 | Make every completed task deliver the actual file, with **Open** and **Download**. | 01 | PASS (stub journey) |
| 10 | Ensure STOP immediately prevents further unauthorized work. | 01 | PARTIAL |
| 11 | Prevent duplicate files, incorrect modifications and accidental changes to existing user work. | 01 | PARTIAL |
| 12 | Complete all unfinished critical security fixes. | 01 | OPEN |
| 13 | Keep Gemini as the default online model, subject to verifying the exact model's availability. | 07 | PARTIAL |
| 14 | Correctly configure and test all three Gemini API-key slots. | 07 | PARTIAL |
| 15 | Switch between authorized keys only when allowed, without bypassing shared provider quotas. | 07 | PARTIAL |
| 16 | Make High mode use the intended Cloudflare Gemma 4 model, with clear usage warnings. | 07 | BLOCKED |
| 17 | Never silently substitute another model when a selected model fails. | 07 | PARTIAL |
| 18 | Complete Auto, Online and Offline Chat modes. | 07 | PARTIAL |
| 19 | Keep JARVIS online-planned, with no hidden offline-model fallback. | 07 | PARTIAL |
| 20 | Make responses faster without sacrificing accuracy. | 07 | OPEN |
| 21 | Add safe retries, timeouts, error recovery and clear provider error messages. | 07 | PARTIAL |
| 22 | Track actual model identity, requests, tokens, neurons, failures and capacity. | 07 | PARTIAL |
| 23 | Track AI costs and stop before unapproved paid usage. | 07 | PARTIAL |
| 24 | Prevent fake answers, invented citations and false claims that a task is completed. | 07 | IN PROGRESS |
| 25 | Keep **Alternative A** as the current architecture until a replacement proves both faster *and* more reliable. | 02–06 | PASS |
| 26 | Understand the user's goal before performing actions. | 02–06 | PARTIAL |
| 27 | Automatically discover available apps, websites, tools, files and permissions. | 02–06 | PARTIAL |
| 28 | Avoid hardcoded app names and application-specific control lists. | 02–06 | PARTIAL |
| 29 | Choose the fastest safe control method automatically: native APIs, scripts, file formats, browser controls, accessibility, then vision. | 02–06 | PARTIAL |
| 30 | Support complete multi-step tasks across several applications. | 02–06 | PARTIAL |
| 31 | Control browser tabs, forms, navigation, downloads and uploads safely. | 02–06 | PARTIAL |
| 32 | Support desktop applications through the authorized Device Agent. | 02–06 | BLOCKED |
| 33 | Read the actual screen when needed and respond to changes. | 02–06 | PARTIAL |
| 34 | Recognize loading screens, pop-ups, permissions and unexpected errors. | 02–06 | PARTIAL |
| 35 | Never interact with the wrong window, tab or document. | 02–06 | PARTIAL |
| 36 | Allow tasks to run in the background when safely supported. | 02–06 | PARTIAL |
| 37 | Allow users to continue chatting while JARVIS works. | 02–06 | PARTIAL |
| 38 | Implement reliable STOP, Pause, Resume and Take Over. | 02–06 | PARTIAL |
| 39 | Recover after browser closure, computer restart or interrupted internet. | 02–06 | PARTIAL |
| 40 | Continue unfinished work without repeating irreversible actions. | 02–06 | PARTIAL |
| 41 | Keep originals safe and preserve user-made edits. | 02–06 | PARTIAL |
| 42 | Verify each important result independently before claiming success. | 02–06 | IN PROGRESS |
| 43 | Show honest progress: Thinking, Working, Checking, Fixing and Completed. | 02–06 | PARTIAL |
| 44 | Return useful completed files and clearly explain anything unfinished. | 02–06 | PARTIAL |
| 45 | Support natural conversations, questions and explanations. | 07–08 | PARTIAL |
| 46 | Provide accurate answers with clear uncertainty when information cannot be verified. | 07–08 | PARTIAL |
| 47 | Support live web research with citations and source links. | 07–08 | PARTIAL |
| 48 | Support follow-up questions without losing context. | 07–08 | PARTIAL |
| 49 | Let users upload documents, images and supported files. | 07–08 | PARTIAL |
| 50 | Read, summarize, compare and explain uploaded files. | 07–08 | PARTIAL |
| 51 | Support useful conversation history and search. | 07–08 | PARTIAL |
| 52 | Allow users to rename, archive, delete and organize conversations. | 07–08 | PARTIAL |
| 53 | Build controllable memory, with user permission and deletion options. | 07–08 | PARTIAL |
| 54 | Support programming assistance, explanations and structured answers. | 07–08 | PARTIAL |
| 55 | Support different languages, including Indian languages where verified. | 07–08 | PARTIAL |
| 56 | Implement voice conversation with understandable speech and interruption handling. | 07–08 | BLOCKED |
| 57 | Make Chat and JARVIS feel like one connected product while keeping their different capabilities clear. | 07–08 | PARTIAL |
| 58 | Create and edit Word documents. | 05 | PARTIAL |
| 59 | Create and edit Excel workbooks with correct formulas. | 05 | PARTIAL |
| 60 | Create and edit PowerPoint presentations. | 05 | PARTIAL |
| 61 | Create, read, convert and export PDFs. | 05 | PARTIAL |
| 62 | Handle CSV, text files, folders and common business formats. | 05 | PARTIAL |
| 63 | Build charts using correct underlying data. | 05 | PARTIAL |
| 64 | Reconcile accounts, invoices and spreadsheet records. | 05 | PARTIAL |
| 65 | Produce professional reports with working tables and layouts. | 05 | PARTIAL |
| 66 | Edit images and save the correct final image. | 05 | PARTIAL |
| 67 | Edit videos, add requested captions, manage audio and export the final video. | 05 | IN PROGRESS |
| 68 | Preserve editable projects when the user requests them. | 05 | PARTIAL |
| 69 | Read and summarize permitted online videos using actual captions or accessible media evidence. | 05 | BLOCKED |
| 70 | Automate web forms, research and repetitive browser workflows. | 05 | PARTIAL |
| 71 | Work across multiple apps without losing track of the task. | 05 | PARTIAL |
| 72 | Handle unfamiliar installed apps through capability discovery rather than hardcoded brand rules. | 05 | PARTIAL |
| 73 | Reopen all generated files to verify their contents and appearance. | 05 | PARTIAL |
| 74 | Return the requested deliverables, not just a success message. | 05 | PARTIAL |
| 75 | Connect the newly added staging R2 secrets to the correct test workflow. | 07 | PARTIAL |
| 76 | Verify authorized, read-only access to the private model bucket. | 07 | PARTIAL |
| 77 | Verify the Worker has the correct `OCADE_MODELS` R2 binding. | 07 | PARTIAL |
| 78 | Test the **actual OCADE model**, not only a substitute. | 07 | BLOCKED |
| 79 | Make downloading resumable after interruptions. | 07 | PARTIAL |
| 80 | Check model size, authenticity and SHA-256 integrity. | 07 | PARTIAL |
| 81 | Ensure the model runs entirely offline after installation. | 07 | BLOCKED |
| 82 | Test real answer quality, not only whether text appears. | 07 | BLOCKED |
| 83 | Preserve the installed model across browser restarts and supported offline sessions. | 07 | BLOCKED |
| 84 | Handle insufficient storage, memory limits and device incompatibility. | 07 | PARTIAL |
| 85 | Allow safe model updates and complete removal without exposing data. | 07 | PARTIAL |
| 86 | Finish the Windows Device Agent. | 10 | BLOCKED |
| 87 | Test installation, sign-in, pairing and automatic tray startup after authorized installation. | 10 | BLOCKED |
| 88 | Ensure the Agent connects only to its authorized customer account. | 10 | PARTIAL |
| 89 | Test real Windows desktop and application control. | 10 | BLOCKED |
| 90 | Build and qualify the macOS companion with Apple's supported permissions. | 10 | BLOCKED |
| 91 | Finish the Android application and genuine emulator testing. | 10 | PARTIAL |
| 92 | Use a mobile testing harness where appropriate, but verify on actual emulators/devices. | 10 | PARTIAL |
| 93 | Qualify iOS Safari/PWA support and Apple-permitted actions. | 10 | BLOCKED |
| 94 | Never claim simulated iOS testing proves physical iPhone compatibility. | 10 | BLOCKED |
| 95 | Support website/PWA installation on supported browsers. | 10 | PARTIAL |
| 96 | Make account and task history synchronize correctly across devices. | 10 | PARTIAL |
| 97 | Support authorized remote control of a paired PC from mobile. | 10 | PARTIAL |
| 98 | Handle device disconnection, sleep, reconnect and revocation. | 10 | PARTIAL |
| 99 | Provide signed installation packages and secure updates. | 10 | BLOCKED |
| 100 | Complete uninstall and update rollback testing without losing user work. | 10 | BLOCKED |
| 101 | Make OCADE visually consistent throughout the product. | 08 | PARTIAL |
| 102 | Complete a clean, fast, ChatGPT-style chat experience with OCADE's own design identity. | 08 | PARTIAL |
| 103 | Finish the unified Chat/JARVIS sidebar and conversation lifecycle. | 08 | PARTIAL |
| 104 | Make Settings simple: Account, Preferences, Devices, Privacy & Security, Billing & Usage. | 08 | PARTIAL |
| 105 | Keep device rows, switches and permission choices compact and understandable. | 08 | PARTIAL |
| 106 | Keep one obvious STOP button for each active task and a clear global Stop all option. | 08 | PARTIAL |
| 107 | Make task progress accurate, concise and visible. | 08 | PARTIAL |
| 108 | Show completed files with working preview, Open and Download actions. | 08 | PASS (stub journey) |
| 109 | Make sign-in, onboarding and device pairing straightforward. | 08 | PARTIAL |
| 110 | Make every page usable on mobile, tablet and desktop. | 08 | PARTIAL |
| 111 | Finish dark/light themes, responsive layouts and animations. | 08 | PARTIAL |
| 112 | Test keyboard navigation, screen readers, contrast and accessibility. | 08 | PARTIAL |
| 113 | Remove unused UI, empty screens, confusing wording and unnecessary prompts without removing essential controls. | 08 | PARTIAL |
| 114 | Test authentication, Google sign-in, session expiry and account recovery. | 09 | PARTIAL |
| 115 | Enforce MFA for privileged and high-risk operations. | 09 | PARTIAL |
| 116 | Prevent one account from accessing another customer's conversations, devices or files. | 09 | PARTIAL |
| 117 | Verify Supabase Row Level Security across every applicable table. | 09 | PARTIAL |
| 118 | Secure all API keys, R2 credentials, tokens and database secrets. | 09 | PARTIAL |
| 119 | Rotate any credentials confirmed to have been exposed. | 09 | OPEN |
| 120 | Prevent prompt injection from websites, documents and tool results from taking control. | 09 | PARTIAL |
| 121 | Isolate generated scripts, shell commands and file access within permitted boundaries. | 09 | PARTIAL |
| 122 | Prevent unauthorized access to unrelated browser tabs and personal files. | 09 | PARTIAL |
| 123 | Require clear permission before sensitive or consequential actions. | 09 | PARTIAL |
| 124 | Keep STOP and device-revocation enforcement on the server and Device Agent. | 09 | PARTIAL |
| 125 | Prevent duplicate purchases, changes and other irreversible actions after retries. | 09 | PARTIAL |
| 126 | Secure task logs, screenshots, recordings and stored memories. | 09 | PARTIAL |
| 127 | Test account deletion, data export and erasure. | 09 | PARTIAL |
| 128 | Test session revocation, device removal and permission changes. | 09 | PARTIAL |
| 129 | Secure the Owner/Staff console with strict roles, audit trails and MFA. | 09 | PARTIAL |
| 130 | Complete dependency scanning, penetration testing and independent adversarial security review. | 09 | OPEN |
| 131 | Define and enforce Basic, Premium and Max entitlements where applicable. | 11 | PARTIAL |
| 132 | Show remaining uses and subscription details clearly. | 11 | PARTIAL |
| 133 | Charge one JARVIS use only after one server-verified completed task, according to OCADE's approved rule. | 11 | PARTIAL |
| 134 | Do not deduct uses for stopped, failed, duplicate or unverified tasks. | 11 | PARTIAL |
| 135 | Prevent customers from bypassing limits through parallel requests or devices. | 11 | PARTIAL |
| 136 | Make usage accounting accurate even after restarts and network failures. | 11 | PARTIAL |
| 137 | Monitor actual AI cost per customer and completed task. | 11 | PARTIAL |
| 138 | Verify whether free AI quotas can realistically support the intended customer load. | 11 | MEASURED: NO |
| 139 | Establish sustainable pricing and capacity before accepting paying customers. | 11 | PARTIAL |
| 140 | Build payment integration in sandbox only until the owner approves a provider. | 11 | OPEN |
| 141 | Test payment success, failure, cancellation, refund, renewal and webhook replay. | 11 | OPEN |
| 142 | Support subscription upgrades, downgrades and entitlement expiry. | 11 | OPEN |
| 143 | Display accurate invoices, payment status and billing policies when payments are enabled. | 11 | OPEN |
| 144 | Keep live checkout disabled until pricing, legal terms and the payment provider are explicitly approved. | 11 | PASS |
| 145 | Measure total task completion time, not just individual AI response time. | 12 | OPEN |
| 146 | Reduce unnecessary AI calls using verified, bounded local actions. | 12 | PARTIAL |
| 147 | Measure performance against the selected Alternative A baseline. | 12 | OPEN |
| 148 | Improve browser and Device Agent responsiveness. | 12 | PARTIAL |
| 149 | Prevent unnecessary polling, repeated screenshots and duplicate operations. | 12 | PARTIAL |
| 150 | Handle slow providers, outages, quota exhaustion and partial responses. | 12 | PARTIAL |
| 151 | Make database migrations reproducible and consistent between staging and production. | 12 | PARTIAL |
| 152 | Add monitoring for errors, latency, failures and resource consumption. | 12 | PARTIAL |
| 153 | Protect against server overload and excessive concurrent requests. | 12 | PARTIAL |
| 154 | Test database backup and recovery. | 12 | PARTIAL |
| 155 | Test recovery after crashes and partial deployments. | 12 | PARTIAL |
| 156 | Ensure updates are compatible with supported older clients. | 12 | PARTIAL |
| 157 | Provide reliable error reports without leaking sensitive customer information. | 12 | PARTIAL |
| 158 | Run all unit, integration, database, security and browser tests on the exact release candidate. | 12 | PARTIAL |
| 159 | Test every page, button, menu, dialog and Settings control. | 12 | PARTIAL |
| 160 | Test complete login, logout, recovery and account-switch journeys. | 12 | PARTIAL |
| 161 | Test Standard Chat, High mode and Offline Chat independently. | 12 | PARTIAL |
| 162 | Test real JARVIS browser workflows. | 12 | PARTIAL |
| 163 | Test real documents, spreadsheets, presentations and PDFs. | 12 | PARTIAL |
| 164 | Test image editing and video editing. | 12 | PARTIAL |
| 165 | Test real Windows and macOS desktop tasks. | 12 | BLOCKED |
| 166 | Test Android and supported iOS journeys. | 12 | PARTIAL |
| 167 | Test speech recognition, spoken replies, microphone permissions and cancellation. | 12 | BLOCKED |
| 168 | Test STOP during file changes, browser operations and long-running tasks. | 12 | PARTIAL |
| 169 | Test simultaneous tasks, app-focus changes and user interference. | 12 | PARTIAL |
| 170 | Test incorrect permissions, refused actions and malicious instructions. | 12 | PARTIAL |
| 171 | Test internet loss, API failures, browser crashes and power interruptions. | 12 | PARTIAL |
| 172 | Verify all output files independently, including visual appearance and calculations. | 12 | PARTIAL |
| 173 | Test with many different real tasks, not one memorized example. | 12 | PARTIAL |
| 174 | Measure accuracy, false completions, human interventions, p50/p95 speed and failures by workflow family. | 12 | OPEN |
| 175 | Publish clear Terms of Service and Privacy Policy. | 11–13 | PARTIAL |
| 176 | Disclose AI-provider data handling, retention and any applicable training use. | 11–13 | PARTIAL |
| 177 | Obtain valid, withdrawable consent where required. | 11–13 | PARTIAL |
| 178 | Document customer permissions for PC control and remote access. | 11–13 | PARTIAL |
| 179 | Review applicable Indian and international privacy, consumer and payment requirements. | 11–13 | PARTIAL |
| 180 | Verify rights and licences for software, AI models, datasets, media and dependencies. | 11–13 | PARTIAL |
| 181 | Create customer help pages, FAQs and troubleshooting instructions. | 11–13 | PARTIAL |
| 182 | Provide a working contact/support channel. | 11–13 | PARTIAL |
| 183 | Build a process for security complaints and incident response. | 11–13 | PARTIAL |
| 184 | Make export, deletion and refund requests manageable. | 11–13 | PARTIAL |
| 185 | Prepare clear installation, compatibility and system-requirement documentation. | 11–13 | PARTIAL |
| 186 | Test the entire onboarding experience with new users. | 11–13 | OPEN |
| 187 | Run a controlled pilot with at least five consenting independent testers. | 11–13 | OPEN |
| 188 | Fix the issues discovered during that pilot. | 11–13 | OPEN |
| 189 | Verify that customers understand what OCADE can and cannot do. | 11–13 | OPEN |
| 190 | Research current competing AI assistants using official documentation and reproducible tests. | 12–13 | PARTIAL |
| 191 | Compare real task accuracy, speed, usability, safety and cost — not promotional claims. | 12–13 | BLOCKED |
| 192 | Compare OCADE's Chat with leading conversational AI interfaces. | 12–13 | BLOCKED |
| 193 | Compare JARVIS with existing computer-use and agent products on matched real tasks. | 12–13 | BLOCKED |
| 194 | Improve the weakest customer-facing experiences first. | 12–13 | PARTIAL |
| 195 | Remove unused dependencies, dead code and duplicate systems without losing required functionality. | 12–13 | PARTIAL |
| 196 | Complete a final independent security and quality review. | 12–13 | OPEN |
| 197 | Freeze the release code and rerun all relevant tests. | 12–13 | OPEN |
| 198 | Verify release automation cannot accidentally deploy unapproved changes. | 12–13 | OPEN |
| 199 | Rehearse deployment rollback and recovery. | 12–13 | OPEN |
| 200 | Prepare a controlled production launch, but deploy only after the owner explicitly approves it. | 12–13 | OPEN |

**Coverage invariant:** all 200 original IDs appear exactly once here; no original item is dropped because its work is duplicated in another phase. Status history remains in `docs/PHASES_STATUS.md`; audit/implementation evidence wins.


## Appendix D — Complete source-numbered supplements A–J and explicit gaps

Original supplement numbers are preserved exactly rather than renumbered. Duplicate substantive work is implemented once under Phase 08 (UI), 09 (security), 11 (commercial/legal), or 12–13 (test/launch), but each original source item below retains its identity. **Missing numbers in the uploaded source are recorded as missing, not invented or silently called completed.** Non-checklist implementation notes are retained.

### Supplement A — 16 API Key Leaks to Fix on Your Vibe-Coded AI Chatbot → Phase 09

- [ ] **A-01** Keys in env variables
- [ ] **A-02** .env in gitignore
- [ ] **A-03** Secret keys off frontend
- [ ] **A-04** Check public env vars
- [ ] **A-05** Hide service role key
- [ ] **A-06** Scan your git history
- [ ] **A-07** Rotate leaked keys
- [ ] **A-08** Secret scanning on
- [ ] **A-09** Secrets in host dashboard
- [ ] **A-10** Restrict key permissions
- [ ] **A-11** Proxy calls via server
- [ ] **A-12** Check screenshots, demos
- [ ] **A-13** Don't log secrets
- [ ] **A-14** Separate dev, prod keys
- [ ] **A-15** Spending limits on keys
- [ ] **A-16** Never paste keys in chat

### Supplement B — 19 Security Holes to Close on Your Vibe-Coded SaaS App → Phase 09

- [ ] **B-01** Row level security
- [ ] **B-02** Auth on every API route
- [ ] **B-03** Never trust the frontend
- [ ] **B-04** Rate limiting
- [ ] **B-05** Sanitize user input
- [ ] **B-06** Parameterized queries
- [ ] **B-07** Lock down CORS
- [ ] **B-08** HTTPS everywhere
- [ ] **B-09** Stop IDOR bugs
- [ ] **B-10** Debug mode off in prod
- [ ] **B-11** CAPTCHA on public forms
- [ ] **B-12** Log admin actions
- [ ] **B-13** Private storage buckets
- [ ] **B-14** Hide admin pages properly
- [ ] **B-15** Update vulnerable packages
- [ ] **B-16** Check file upload types
- [ ] **B-17** Claude security review
- [ ] **B-18** Security headers
- [ ] **B-19** Verify webhook signatures

**Required implementation standard for A/B:** A key in an environment variable is not automatically safe if that variable is public, logged or exposed to a browser. Store all true secrets only in approved secret managers; scan every reachable branch/history/artifact/recording, revoke and rotate confirmed leaks, enforce least privilege, and use independent adversarial checks. Fail closed on missing authorization and never claim that hiding an admin link provides authorization.

### Supplement C — 30 Reasons Your Site Looks Vibecoded (Part 1) → Phase 08

- [ ] **C-01** Harsh gradients
- [ ] **C-02** Lucide icons
- [ ] **C-03** Pure white background
- [ ] **C-04** Rainbow coloring
- [ ] **C-05** Drop shadows
- [ ] **C-06** 3 feature cards in a row
- [ ] **C-07** Emojis
- [ ] **C-08** Liquid glass
- [ ] **C-09** Em dashes
- [ ] **C-10** Inter/geist/space grotesk
- [ ] **C-11** Colored left stripe
- [ ] **C-12** Fake testimonials
- [ ] **C-13** Bento grids
- [ ] **C-14** Terminal window
- [ ] **C-15** "It's not x, it's y"
- [ ] **C-16** Checkmark bullets
- [ ] **C-17** 3 pricing tiers
- [ ] **C-18** No real product demos
- [ ] **C-21** No skeleton loaders-skeleton loaders are required
- [ ] **C-22** Radial orbs
- [ ] **C-23** Dot grids
- [ ] **C-24** Sparkle icons
- [ ] **C-25** Animated arrows
- [ ] **C-26** No TOS
- [ ] **C-27** No privacy policy
- [ ] **C-28** Hover animations
- [ ] **C-29** Neon colors
- [ ] **C-30** Basic pastel colors

**Source gaps (not tasks inferred):** C-19, C-20 do not occur in the uploaded `phases.md`. Do not fabricate their text; confirm with owner only if full external checklist parity is ever necessary. All actually supplied text is retained.

### Supplement D — 20 Reasons Why Your App Looks Vibecoded → Phase 08

- [ ] **D-01** Purple to blue gradient
- [ ] **D-02** Gradient hero text
- [ ] **D-03** A badge above the headline
- [ ] **D-04** Three icon boxes in a row
- [ ] **D-05** Emojis in your headings
- [ ] **D-06** Color left border cards
- [ ] **D-08** Untouched shadcn components
- [ ] **D-09** Lucide icons everywhere
- [ ] **D-10** Inter font everywhere
- [ ] **D-11** Space Grotesk plus Instrumental Serif
- [ ] **D-12** Serif italics for accent words
- [ ] **D-13** Em dashes everywhere
- [ ] **D-14** Generic buzzwords
- [ ] **D-16** Cursor following line
- [ ] **D-18** Low contrast dark mode
- [ ] **D-19** Inconsistent spacing
- [ ] **D-20** Grain texture

**Source gaps (not tasks inferred):** D-07, D-15, D-17 do not occur in the uploaded `phases.md`. Do not fabricate their text; confirm with owner only if full external checklist parity is ever necessary. All actually supplied text is retained.

### Supplement E — 20 Things You Can Tell Claude to Add to Your Website Right Now Pt.3 → Phase 08

- [ ] **E-01** Dark mode toggle
- [ ] **E-02** Simple cookie banner
- [ ] **E-03** Site search
- [ ] **E-04** Back to top button
- [ ] **E-05** Mobile menu
- [ ] **E-06** Loading animations
- [ ] **E-07** Hover states
- [ ] **E-08** Scroll progress bar
- [ ] **E-09** Copy button
- [ ] **E-10** Print stylesheet
- [ ] **E-11** Sticky headers
- [ ] **E-12** Skip to content
- [ ] **E-13** Password visibility toggle
- [ ] **E-14** UTM tracking
- [ ] **E-15** Form success state
- [ ] **E-16** Form error state
- [ ] **E-17** Confirmation modals
- [ ] **E-18** Last updated date
- [ ] **E-19** Expandable FAQ
- [ ] **E-20** Floating contact button

**Fit-to-product check:** Do not add floating contact controls, scroll bars, marketing animations or cookie banners inside a task workspace merely to check a box. Implement where genuinely useful and legally required, and document N/A decisions.

### Supplement F — 20 Things to Tell Claude to Fix on Your Vibecoded Website (Image 1) → Phase 08

- [ ] **F-01** Remove horizontal scrolling
- [ ] **F-02** Find broken links
- [ ] **F-03** Add a mobile menu
- [ ] **F-04** Add a favicon
- [ ] **F-05** Fix page titles
- [ ] **F-06** Add meta descriptions
- [ ] **F-07** Fix footer links
- [ ] **F-08** Add a custom 404 page
- [ ] **F-09** Fix the copyright year
- [ ] **F-10** Compress images
- [ ] **F-11** Fix broken buttons
- [ ] **F-12** Add success messages
- [ ] **F-13** Add error messages
- [ ] **F-14** Remove placeholder text
- [ ] **F-15** Remove unused navigation
- [ ] **F-16** Fix mobile overflow
- [ ] **F-17** Make the logo clickable
- [ ] **F-19** Make the email clickable
- [ ] **F-20** Make every page mobile optimized

**Source gaps (not tasks inferred):** F-18 do not occur in the uploaded `phases.md`. Do not fabricate their text; confirm with owner only if full external checklist parity is ever necessary. All actually supplied text is retained.

### Supplement G — Website Redesign Checklist (Feels Expensive) → Phase 08

- [ ] **G-01** One font pair
- [ ] **G-02** Two brand colours
- [ ] **G-03** More white space
- [ ] **G-04** Bigger headlines
- [ ] **G-05** Real photos
- [ ] **G-06** Consistent spacing
- [ ] **G-07** Grid alignment
- [ ] **G-08** One CTA per section
- [ ] **G-09** Consistent buttons
- [ ] **G-10** One icon set
- [ ] **G-11** Real testimonials
- [ ] **G-12** Shorter paragraphs
- [ ] **G-13** 5-link menu
- [ ] **G-14** Darker text
- [ ] **G-15** Mobile layout fixed
- [ ] **G-16** Feels expensive

### Supplement H — Systems Check / Launch Poll → Phase 12–13

- [ ] **H-01** Mobile tested
- [ ] **H-02** All links
- [ ] **H-03** Contact form
- [ ] **H-04** Loads < 3s
- [ ] **H-05** Images
- [ ] **H-06** HTTPS
- [ ] **H-07** Chrome + Safari check
- [ ] **H-08** No typos
- [ ] **H-09** WhatsApp button
- [ ] **H-10** Domain email
- [ ] **H-11** Analytics
- [ ] **H-12** Google index
- [ ] **H-13** Link preview
- [ ] **H-14** Backups
- [ ] **H-15** Payments

**Launch applicability:** Under three seconds is a measured performance target for the relevant page/network/device, not an invented result. WhatsApp/domain email are support/channel choices and need owner consent. Payments remain sandbox-only until authorized; don't count live payment activation as approved.

### Supplement I — 20 Things to Have Claude Do So Your App Doesn't Get Sued → Phase 11

- [ ] **I-01** Add a privacy policy
- [ ] **I-02** Add terms of service
- [ ] **I-03** Add a refund policy
- [ ] **I-04** Add a cookie policy
- [ ] **I-05** Add a cookie consent banner
- [ ] **I-06** Check your form consents
- [ ] **I-07** Don't collect unnecessary data
- [ ] **I-08** Audit your third-party SDKs
- [ ] **I-09** Remove dark patterns
- [ ] **I-10** Remove hidden fees
- [ ] **I-11** Remove fake reviews
- [ ] **I-12** Remove unsupported claims
- [ ] **I-13** Add accessibility alt text
- [ ] **I-14** Fix your color contrast ratio
- [ ] **I-15** Add keyboard navigation
- [ ] **I-16** Add your business details
- [ ] **I-17** Get age consent if you collect kids' data
- [ ] **I-18** Add an unsubscribe link to your emails
- [ ] **I-19** License any fonts and images you use
- [ ] **I-20** Add a data deletion request option

### Supplement J — 20 Things to Have Claude Do Before Launching Your Website → Phase 13

- [ ] **J-01** Add a privacy policy page
- [ ] **J-02** Add a terms and conditions page
- [ ] **J-03** Get your secrets off the front end
- [ ] **J-04** Force HTTPS
- [ ] **J-05** Add a cookie consent banner
- [ ] **J-06** Add meta titles and descriptions
- [ ] **J-07** Add a social preview image
- [ ] **J-08** Add a favicon
- [ ] **J-09** Generate a sitemap and robots.txt
- [ ] **J-10** Add alt text to your images
- [ ] **J-11** Compress your images
- [ ] **J-12** Check your page load speed
- [ ] **J-13** Fix your color contrast
- [ ] **J-14** Make it mobile friendly
- [ ] **J-15** Add a custom 404 page
- [ ] **J-16** Fix any broken links
- [ ] **J-17** Add form validation
- [ ] **J-18** Add spam/bot protection
- [ ] **J-19** Set up analytics
- [ ] **J-20** Add one clear call to action

## Appendix E — Special owner tests, advanced benchmarks and source integrity

The original attachment's elite work policy, competitive proof clauses and benchmarks are incorporated into Phase 05 and Phase 12 but are not claimed to pass. Specifically: (1) real video editing and actual output link, (2) chess gameplay at both settings, (3) existing-image cinematic edit not generation, (4) CAD vehicle mechanical/electrical model, (5) failure → diagnosis → repair → retest. These are investigative stress tests; absent license or hosted app, mark BLOCKED and never advertise support. Preserve no-hardcoded-app policy for runtime even when named applications are test fixtures.

**Repository source files to reconcile at implementation:** `OCADE_DEEP_AUDIT.md`, `docs/PHASES_STATUS.md`, `BLOCKED_TESTS.md`, `TOFIX.md`, `docs/DECISIONS.md`, `docs/TESTING.md`, `docs/CONTROL_INVENTORY.md`, `FINAL_AUDIT_LEDGER.md` (explicitly historical), `AGENTS.md`, `CLAUDE.md`, plus `src/`, `jarvis-runtime/`, `android/`, `supabase/`, `scripts/`, `release/`, `.github/`. Check list against current source tree; external research assertions require date/license/current source validation.

**Immediately next authorized development step (NOT executed by this document edit):** Re-open HEAD and ownership/concurrent writes; baseline tests without costs; reproduce and fix RC01 / RC17 / RC08 / RC12 / RC13 / RC02–03 / RC04 / RC06–07 in minimal safe order; then build operation registry, adaptive planner and verification; then page/control inventory and UI fixes; then staged full cloud-real GUI campaign. Log PASS/FAIL/SKIP/BLOCKED after every milestone, with a real verified launch percentage only when release gates evidence exists.

**Final invariant:** No source document, original ID, supplement, route, action or release gate can be implicitly assumed complete; record the unresolved work rather than deleting it. Commercial readiness is an evidence-backed approval decision, never a plan-file checkbox.

## Appendix F — Research Micro-Specification: actionable detail below Phases 00–13

This is a binding **engineering clarification**, not evidence of tests passing. It consolidates the latest useful recommendations from seven distinct Deep Research files. Repeated uploads are not independent evidence. The 200 original requirements and all ten original supplements in Appendices C–D remain authoritative for coverage, but recurring work gets one code owner and one canonical implementation/test. The source-derived microdetail register in Appendix G must be classified by an implementing agent as CONFIRMED, REPRODUCED, FIXED, TESTED, DUPLICATE, DEFERRED, UNSUPPORTED or N/A with a reason; generic research ideas are not automatically live bugs.

### F1. Exact action and authority lifecycle — Phase 01/02/03/06

For any action store task, tenant, device, account, actor, milestone, subgoal, action ID, sequence, idempotency key, source trust level, tool capability ID/version/health revision, target identity, authorized path/origin, expected inputs/outputs, precondition, effect type, time/resource limit, cancellation token, verifier, retry policy, trace ID, output hash and acknowledgement. Treat LLM-generated fields as suggestions until independently checked by server/device policy.

Distinguish PLANNED, AUTHORIZED, QUEUED, IN_FLIGHT, EFFECT_UNKNOWN, EFFECT_OBSERVED, VERIFYING, VERIFIED, FAILED, PARTIAL, BLOCKED, STOP_REQUESTED, CANCELLED and COMPLETED; retain actual existing enum names where semantically equivalent. A tool returning success or a file existing is not proof the requested business outcome was achieved. Verify both allowed target and result before marking complete.

Revalidate permissions and target identity before each consequential effect, after navigation, app restart, dialog change, focus theft, browser tab switch, display/DPI change and user takeover. Approval for one account/recipient/amount/file is not approval for changed arguments. Only one active writer per exact document, tab, window or remote effect.

### F2. Exact operation health; installation and dependencies — Phase 02

Registry entry must include typed operation, supported platforms/formats/codecs, absolute binary path, pinned version and package hash, prerequisite graph, last bounded self-test, health expiry, authorization, cost/latency class, cancellation ability, fallback and independent verifier. Separate installed / reachable / authorized / permitted / operation-healthy / target-compatible. UNKNOWN is not HEALTHY. Invalidate after environment, dependency, permission, device, browser-profile or model-quota changes.

Probe separately: PDF create/read/render/page extraction; DOCX create/Word export; XLSX formula write/recalculation/value verification; PPTX rendering; video/audio decode, H.264 encoder, ffprobe, subtitle filter and codec; Python interpreter/import (detect Windows Store alias), Node/npm launcher, LibreOffice headless, signed browser binary, Playwright/CDP, UIA inspect/invoke/value/selection, native app object model, screen capture, disk permissions, filenames/fonts, upload abort and quota headroom.

Use signed/hashed and approved dependency manifests; do not trust arbitrary PATH or AI-invented package IDs; do not silently install, elevate privilege or spend. Remove every known-unhealthy operation from the planner's exposed tools before the task begins. Test each dependency removed, outdated, denied, corrupted, blocked by PATH, failing probe and disappearing mid-task. Verified substitute only if same permission, fidelity, side effects and quality standards.

### F3. Browser semantic control and user-profile grants — Phase 03/09

A browser grant binds authorized account/device, executable/profile/session/tab/target/frame and allowed origins, task ID, read/write/upload/download/submit permissions, issue/expiry/revocation times. Distinguish isolated agent browser from explicit control of the customer's already-authenticated browser; never attach to unrelated sessions. A proposed extension/native-message bridge must verify permitted extension origin/ID; powerful debugger or CDP permission requires clear consent and is never silently enabled. Existing OCADE browser implementations must be inspected before adding another controller.

DOM/accessibility first: roles, names, labels, text and stable scoped selectors; test element visible/enabled/editable/not obstructed/still attached. Include links, buttons, text/password/email/number/date inputs, contenteditable, radio, checkbox, tri-state, range, select/autocomplete/combobox, modal, context menu, iframe/shadow DOM, SPA route changes, tab/windows, file picker, drag/drop, downloads/uploads, progress, virtualized lists, consent/login/MFA, scroll and DOM mutation. On canvas or custom inaccessible controls, ground a *fresh* visual observation with DPI, zoom, scroll and bounds, then verify changed state. Return to semantic control when possible.

Adversarial matrix: duplicate tab titles, different Chrome/Edge profiles, tab closed mid-action, origin redirect, stale locator, hidden/covered element, popup focus, cookie expiry, cross-origin iframe, failed download, upload abort, user typing during batch, revoked grant, malicious webpage instructions, 429/500 and unknown external form submission. Never bypass CAPTCHA, login or site restrictions.

### F4. Exact Windows window/document identity — Phase 03/10

Bind device ID, Windows user session, executable/process PID **plus start time**, HWND, UIA root/runtime identity, document path/hash or unsaved document identity, owner dialog, foreground/monitor, display resolution and scale. A title is only a human-readable hint: if two exact titles match, stop before writing. Verify target identity again just before any file/app/clipboard mutation; do not act based solely on currently focused window.

Query supported UIA patterns dynamically: Invoke, Value, Text/TextEdit, Selection/SelectionItem, Toggle, ExpandCollapse, RangeValue, Grid/Table/SpreadsheetItem, Scroll, Window; support keyboard fallback where semantic pattern unavailable. Include menu/ribbon/toolbar, font/size/style, list/grid/tree, native save/open dialog, file conflict, checkbox, zoom, slider, drag/drop, modal, app-not-responding, unsaved edits and external human changes. UIA events when available; bounded state polling otherwise. Test multiple monitors, 100/125/150/200% scaling, minimized/occluded/overlapped windows, process restart, nested dialogs, clipboard/IME and virtual desktops. Treat UAC secure desktop, locked screen and protected app boundaries as restrictions, never something to bypass.

Visual fallback requires fresh screenshot timestamp, verified monitor and crop, current coordinates, DPI/zoom calibration, occlusion and animation check, plus post-action observation. Don't repeat blind same-coordinate clicks or take screenshots after each typed character. Raw mouse/keyboard is last, not normal app control.

### F5. Protocol, durable receipts and STOP — Phase 01/06

The audited desktop agent can retain more than the server's twenty-results-per-exchange maximum. Bound both count **and bytes**, maintain unsent journal, exact action ID/receipt/outcome acknowledgement, transactionally deduplicate receipts and retry receipt transmission, not user effect. Test 0/1/19/20/21/40/100/1000 results; duplicate/stale/reordered/malformed/wrong ACK, agent/server restart, partial acknowledgement, huge tool output, disk full, transport timeout, old protocol, reconnection and concurrent exchange.

Send STOP/Pause/revoke through a priority control lane independent of result backlog. STOP immediately fences new authorization; cancellation propagates through active transfer, parser, render, subprocess tree, browser navigation and UI wait where safe. Distinguish STOP-request accepted from actual in-flight operations halted. Report any committed or unknown effect and reconcile external status before resume or retry. A cancellation cannot undo already sent email, order, payment or published change. After timeout on a non-idempotent action, query authoritative external state; never blindly submit twice. Resume and Take Over require new capability, target and authorization checks.

### F6. Dynamic planning and reason-aware repair — Phase 04

Make a 3-level living plan: user outcome/quality contract, visible stable milestones, evolving micro-actions with exact pre/postconditions. There is no fixed ten-step execution cap. Replan only affected subtree when new evidence, conditional branch, unexpected dialog, contradictory research, bad export, missing font, changed file or target appears. Preserve proven work, original files and user edits. Batch safe local actions when no new observation is required, call a model only for genuine planning uncertainty. Bounded time, tool, model, retry, recursion, provider quota and cost budgets; ask for authority only when materially required.

Classify TOOL_MISSING, TARGET_MOVED/AMBIGUOUS, ELEMENT_STALE, AUTH_EXPIRED, PERMISSION_DENIED, RATE_LIMIT, NETWORK, PROVIDER_ERROR, APPLICATION_CRASH, INVALID_OUTPUT, SEMANTIC_MISMATCH, VISUAL_DEFECT, RESOURCE_EXHAUSTED, EFFECT_UNKNOWN and STOP/TAKEOVER. One rational verified alternative after changed evidence beats repeated speculative failures. Unknown high-impact external effect -> reconciliation and blocked status, never automatic duplicate.

### F7. Independent professional-quality verification — Phase 05

Verify at separate layers: (1) explicit and appropriate implicit requirements, (2) factual/semantic accuracy, (3) structure and order, (4) rendered appearance or audiovisual quality, (5) openable technical file/state and (6) provenance/consistency. The executor/model must not act as sole judge. A wrong spreadsheet number in a wrong row fails even if desired number appears somewhere. For subjective quality use an independent rubric and reviewer, not an invented deterministic perfect score.

Professional PDF/Word: current primary citations, title/date/summary, heading hierarchy, fonts, size/spacing, margins, page numbering/header/footer, widows/orphans, page and section breaks, TOC when useful, captions, chart sources, table pagination, hyperlink destinations, metadata, accessible reading order, Unicode/font embedding, rendered-page visual inspection and repair only affected pages.

Spreadsheet/accounting: source-row identity, numeric type/locale/currency, cross-sheet references, formula strings **and computed values**, filters/hidden sheets, chart ranges, rounding, reconciliation totals/exceptions, recalculation, correct destination and preservation of source workbook.

Presentation: slide order/ratio, text overflow, alignment, source-accurate chart and image, hierarchy, contrast, speaker context, native editable original and rendered slide inspection.

Video/audio: actual input media, frame timing/FPS, resolution/aspect, cuts/transitions, caption timing and safe placement, clip audio balance/loudness/noise, clipping/synchronization, missing/black frames, codec, final playable export plus editable project where requested. Check with independent ffprobe and actual frame/audio decode.

Image/photo: edit supplied image rather than silently generate a different one, respect source crop/orientation/EXIF, format/dimensions, avoid artifacts, preserve unedited areas, compare original and output visually, save editable source where requested.

Browser/desktop/email: exact correct account/window/tab/destination and observed remote persisted effect, correct file hashes, no unrelated changes. Code/CAD/unknown apps: qualified domain verifier, geometry/unit/build check and honest unsupported status.

### F8. Full UI/UX control census and commercial product — Phase 07–11

Current source routes include Chat home, JARVIS, authenticated Library, staff Admin, Auth/Verify/Challenge/Callback, password reset, Pricing, About, Help, Privacy, Terms, agent distribution and API endpoints. **Settings is an account panel**, not a collection of former routes; Devices & Access is in JARVIS/settings. Never reintroduce retired pages merely because historical documents mention them.

Every actual link/button/menu/modal/icon/keyboard shortcut/file picker/voice permission/selector/STOP/approval action needs test cases for visible, focus, hover, selected, busy, disabled, empty, success, error, auth expired, permission refused, network/offline, retry, cancellation and accessible announcement when applicable. Test 320/375/768/1024/1440 widths, dark/light/high contrast, 200–400% zoom, RTL/Indian language if supported, focus order/trap and return, screen readers, touch and reduced motion. Every active control must have a real effect or be removed. Audit page-specific copy, inaccurate claims, downloads, pricing/usage agreement, settings persistence, bad links, form validation and device permissions.

Security: tenant RLS, account switching, JWT/session expiry/revoke, MFA/owner roles, least-privileged local PC grants, path traversal, SSRF/XSS/CSRF/IDOR, prompt injection from web/documents, safe upload/malware/parser limits, frontend bundle and log secrets, credential rotation under owner approval, authorized billing and retention/export/delete, backups and rollback. User cannot be exposed to stack traces; internal diagnostics must retain exact error/effect data securely.

### F9. Cloud-only test evidence, performance and launch gates — Phase 12–13

Cloud simulation does not prove real Windows UIA. Require disposable **interactive Windows desktop VMs** with correct licensing, real agent and application processes, browser, UIA, display state, accessibility, real generated files, visual checker and independent user pilot. Linux/browser CI remains valuable but separate. Android emulator late; iOS hosted WebKit/simulator cannot prove physical/native control; macOS requires actual hosted native environment. Do not spend or use owner's PC without approval.

Build exact artifact attestation: web SHA, server/function digest, agent binary/hash, protocol/schema, model/provider identity, tool registry and runtime manifest, OS/browser/app build, dataset and suite seed. Capture video/screenshots, receipts, hashes, independent verifiers, machine specs, p50/p95/p99 total latency, AI turns/tokens, retries, total cost and supported configuration. Fault-inject missing runtime, duplicate window, focus theft, bad popup, stale element, lost ACK, 1000-result backlog, STOP during upload/render, process/network outage, token revoke, malicious input, malformed PDF/image, full disk, partial export and mismatched staging. Re-run affected suite on frozen exact candidate.

Targets only—not claimed results: zero known critical security issues/wrong-target writes/false VERIFICATION SUCCESS in qualification corpus; 100% pass on defined STOP/permissions/irreversible-action safety matrix; at least 95% independently verified first-run success for each advertised task family, stretch 99% within bounded recovery where statistically supportable; real measurable p50/p95 latency and cost with confidence intervals; all 10 release gates and at least five consenting independent pilot users. Commercial approval cannot be proven by code and cloud simulation alone. Release/support claims limited to configurations actually qualified.

### F10. Tool architecture and conflicts resolved — Phase 02/12

One OCADE authority with many adapters, not overlapping autonomous brains. Preserve existing Playwright/DOM, UIA, direct files/media, signed device transport and checkpoint mechanisms; fix their weak contracts before adding frameworks. MCP exposes task-scoped approved tools; MCP is not a security boundary. Dynamic provider interfaces are replaceable while OS execution authority is not. Playwright MCP/CDP, Chrome DevTools MCP, native messaging, pywinauto, local micro-model, TinyFish, Skyvern, Browser Use, Stagehand, UI-TARS, Agent S and Microsoft UFO are *reference/optional scoped adapters* only where the current system lacks proved functionality and A/B shows gains. Pin compatible licenses and provenance. Never hardcode brand-specific app paths, prompt-only routing, unapproved expense, hidden model fallback or speculative unsafe actions.

**Conflicts:** one research recommends offline JARVIS, but the current approved rule is online-planned JARVIS and separately functioning offline Chat. Some older reports inaccurately say Playwright/UIA are missing: newer source confirms they already exist. Some provider names/quotas/specifications disagree among reports; current official documentation and current source must decide. The original 200 items and 10 supplements remain mapped, with historical status never confused with current qualification.


## Appendix G — All-report small-detail audit register

This is a source-derived audit queue, not independent evidence that code is defective. 561 textually unique detailed bullet/numbered/table observations were extracted from the seven distinct research reports. Each R-ID must be mapped to an existing Phase 00–13 task/test or classified DUPLICATE, DEFERRED, HISTORICAL, N/A or UNSUPPORTED with reason. Do not install tools merely because a research table named them. The current repo and newest owner decisions supersede conflicting recommendations. This section preserves tiny details that might otherwise be missed, while the harmonized Appendix F is the executable specification.

### R1: Adaptive microplanning and quality (15 distinct source details)

- **R1-001** [Why the current “AI makes a plan” approach is not enough] whether the information is current;
- **R1-002** [Why the current “AI makes a plan” approach is not enough] a heading appearing alone at the bottom of a page;
- **R1-003** [Why the current “AI makes a plan” approach is not enough] the PDF looking different after export?
- **R1-004** [The solution is not “make a 100-step plan”] \| **Milestones** \| What large pieces must be completed? \|
- **R1-005** [The solution is not “make a 100-step plan”] \| **Micro-actions** \| What exactly should I do *right now* based on the current situation? \|
- **R1-006** [The video example and every other task] \| Word document \| formatting, broken page, inconsistent heading \|
- **R1-007** [The video example and every other task] \| Excel \| formula error, missing data, incorrect number type \|
- **R1-008** [The video example and every other task] \| PowerPoint \| overcrowded slide, bad image, inconsistent layout \|
- **R1-009** [The video example and every other task] \| PDF \| page overflow, missing page number, bad render \|
- **R1-010** [The video example and every other task] \| Video \| audio problem, caption collision, rendering issue \|
- **R1-011** [The video example and every other task] \| Image \| wrong crop, artefact, inconsistent dimensions \|
- **R1-012** [The video example and every other task] \| Browser \| pop-up, authentication, changed page layout \|
- **R1-013** [The video example and every other task] \| Software install \| restart needed, missing dependency \|
- **R1-014** [The video example and every other task] \| Research \| conflicting evidence, missing source \|
- **R1-015** [The video example and every other task] \| Email workflow \| missing attachment, recipient ambiguity \|

### R2: Existing hybrid controls and audit (111 distinct source details)

- **R2-001** [Executive summary] \| Is current OCADE screenshot-only? \| **No.** It is already hybrid. \|
- **R2-002** [Executive summary] \| Is Playwright missing? \| **No.** Already implemented. \|
- **R2-003** [Executive summary] \| Is Windows UI Automation missing? \| **No.** Already implemented. \|
- **R2-004** [Executive summary] \| Is direct file/document control missing? \| **No.** Considerable support already exists. \|
- **R2-005** [Executive summary] \| Is vision fallback missing? \| No; screen control exists. \|
- **R2-006** [Executive summary] \| Should OCADE be completely rewritten? \| **No.** Strengthen the execution layer. \|
- **R2-007** [Executive summary] \| Stronger than simple hybrid? \| **Yes: verifier-gated hierarchical hybrid with capability health, durable state and reason-aware recovery.** \|
- **R2-008** [Executive summary] \| Can it honestly guarantee 100% arbitrary PC control? \| **No.** Neither OCADE nor a competitor can guarantee that for arbitrary software, websites, crashes, permissions and external services. \|
- **R2-009** [Executive summary] \| Has OCADE beaten competitors today? \| **No benchmark evidence yet.** The latest audit qualified **0/10 release gates** and ran no fresh native Windows workflow.  \|
- **R2-010** [The current control stack] \| Layer \| Current OCADE implementation \| What it does \|
- **R2-011** [The current control stack] \| AI planner \| `src/jarvis/agent.ts` \| Sends context/tools to the model, manages tasks, actions, checkpoints and results.  \|
- **R2-012** [The current control stack] \| Control policy/tool contract \| `src/jarvis/protocol.ts` \| Defines browser/computer actions, capabilities, outcome checks and tool schemas.  \|
- **R2-013** [The current control stack] \| Routing instructions \| `JARVIS_SYSTEM_PROMPT` in `src/jarvis/protocol.ts` \| Tells JARVIS to prefer app automation/scripts → files → UIA → screen and to batch predictable actions.  \|
- **R2-014** [The current control stack] \| PC executor \| `jarvis-runtime/ocade_computer.py`, `Computer.run()` \| Dispatches files, Office-like documents, video, PDF, apps, commands, screen, settings and UIA actions.  \|
- **R2-015** [The current control stack] \| Capability reporting \| `Computer.capabilities()` \| Reports broad booleans such as files, terminal, screen, computer control and Windows accessibility.  \|
- **R2-016** [The current control stack] \| Browser executor \| `jarvis-runtime/actions/browser_control.py`, `_BrowserSession` \| Playwright, DOM/accessibility snapshots, tabs, downloads, real/isolated browser contexts and visual fallback.  \|
- **R2-017** [The current control stack] \| Windows semantic control \| `jarvis-runtime/ocade_accessibility.py`, `inspect()` / `act()` \| Reads Windows UI Automation controls and invokes/sets/selects semantic controls without moving the mouse where possible.  \|
- **R2-018** [The current control stack] \| Screen fallback \| `ocade_computer.py` screen actions \| Fresh screenshot plus guarded mouse/keyboard operations.  \|
- **R2-019** [The current control stack] \| Device transport \| `jarvis-runtime/ocade_device.py`, `_exchange_loop()` \| Exchanges commands/results between the desktop agent and OCADE server.  \|
- **R2-020** [The current control stack] \| Server transport \| `src/jarvis/device.server.ts`, `exchange()` \| Validates device exchange, queues commands, acknowledgements and STOP/Pause information.  \|
- **R2-021** [The current control stack] \| Result checks \| `outcomeCheck`, `READS_BACK`, task-authority verification \| Requires read-backs for completion and supports file/cell/text/measure checks.  \|
- **R2-022** [Side-by-side] \| User request \| Model interprets request \| Outcome compiler identifies requested result and proof required \|
- **R2-023** [Side-by-side] \| Browser vs PC \| Model calls `start_task` with browser/computer \| Runtime classifier also verifies which execution domain is actually needed \|
- **R2-024** [Side-by-side] \| Tool availability \| Broad capability flags \| Exact operation health registry \|
- **R2-025** [Side-by-side] \| Tool exposure \| Large browser/computer capability surface \| Only healthy, relevant tools exposed \|
- **R2-026** [Side-by-side] \| App discovery \| `app_info` during workflow \| Cache app capabilities and preflight exact required operations \|
- **R2-027** [Side-by-side] \| Browser \| Structured Playwright first, visual fallback \| Keep this; strengthen with deterministic browser routing \|
- **R2-028** [Side-by-side] \| Desktop \| UIA plus direct operations plus screen \| Keep this; bind exact process/window/document identity \|
- **R2-029** [Side-by-side] \| File work \| Dedicated file/document actions \| Keep and expand deterministic adapters \|
- **R2-030** [Side-by-side] \| Media \| Dedicated video operations; may discover dependency at runtime \| Preflight FFmpeg/ffprobe before planning \|
- **R2-031** [Side-by-side] \| PDF \| `pdf_export`; dependency may be discovered during execution \| Select a known healthy PDF route before task begins \|
- **R2-032** [Side-by-side] \| AI calls \| Model may re-enter loop after tool failures \| Local runtime batches safe deterministic steps \|
- **R2-033** [Side-by-side] \| Waiting \| Some fixed settling/polling \| Prefer events and actionability checks \|
- **R2-034** [Side-by-side] \| Failure \| Model receives failure and chooses another route \| Reason-aware fallback ladder from known healthy routes \|
- **R2-035** [Side-by-side] \| Transport \| Results accumulated for exchange \| Count/byte-bounded durable result stream \|
- **R2-036** [Side-by-side] \| STOP \| Shares exchange path \| Priority control channel/independent deliverability \|
- **R2-037** [Side-by-side] \| Verification \| Read-back + outcome checks \| Workflow-specific independent verifier \|
- **R2-038** [Side-by-side] \| Completion \| Server already tries to prevent unsupported completion \| **Hard rule:** completion impossible without verifier evidence \|
- **R2-039** [Side-by-side] \| Recovery \| Checkpoints exist \| Idempotent actions + unknown-effect reconciliation + checkpoints \|
- **R2-040** [Side-by-side] \| Long task \| Agent/model loops \| Local execution graph executes predictable sections without model round-trip \|
- **R2-041** [The strongest version is actually beyond “Direct + Vision”] whether it works with this version of the application;
- **R2-042** [The strongest version is actually beyond “Direct + Vision”] whether this is the exact intended document;
- **R2-043** [The strongest version is actually beyond “Direct + Vision”] whether the action executed once or twice;
- **R2-044** [The strongest version is actually beyond “Direct + Vision”] whether a network acknowledgement was lost;
- **R2-045** [The strongest version is actually beyond “Direct + Vision”] whether the output is actually correct;
- **R2-046** [The strongest version is actually beyond “Direct + Vision”] whether an alternative route should be tried.
- **R2-047** [Publicly documented patterns] \| Competitor / system \| Publicly documented approach \| Best lesson for OCADE \|
- **R2-048** [Publicly documented patterns] \| **OpenAI / computer use** \| Separate structured browser and general computer drivers; environment remains application-controlled; actions/results form a tool loop.  \| Make browser vs desktop an explicit runtime routing decision. \|
- **R2-049** [Publicly documented patterns] \| **OpenAI hosted agent browser** \| Durable session identity and recovery; after a connection loss, retrieve the existing state instead of blindly resending work.  \| Treat unknown acknowledgement as unknown effect, not permission to repeat. \|
- **R2-050** [Publicly documented patterns] \| **Claude Browser Use** \| Accessibility tree/elements/forms/tabs plus screenshots and coordinates; refs preferred when structure exists.  \| Structured browser references first; pixels only when structure cannot represent the target. \|
- **R2-051** [Publicly documented patterns] \| **Claude Computer Use** \| Screenshot + mouse/keyboard desktop toolset; can batch several operations in one model turn.  \| Keep visual desktop control as universal fallback, not first choice. \|
- **R2-052** [Publicly documented patterns] \| **Gemini Computer Use** \| Screenshot-driven browser/mobile/desktop actions; developer provides the client executor; configurable safety and prompt-injection detection are documented.  \| Separate model prediction from trusted execution and add dedicated screen-injection defences. \|
- **R2-053** [Publicly documented patterns] \| **OpenClaw** \| Isolated managed Chromium is the default; deterministic tab control; optional existing signed-in Chrome session through Chrome DevTools MCP.  \| Have a safe isolated default and a separately authorised “real browser” mode. \|
- **R2-054** [Publicly documented patterns] \| **Playwright** \| Locators are built around retryability and live element resolution.  \| Do not manually recreate reliable locator semantics with pixel clicks. \|
- **R2-055** [Publicly documented patterns] \| **Windows UI Automation** \| Exposes elements, properties, control patterns and events for semantic programmatic interaction with Windows applications.  \| Invoke controls directly instead of visually clicking them whenever possible. \|
- **R2-056** [P0 — make the existing engine trustworthy] \| P0 change \| What changes in non-coding terms \| Why \|
- **R2-057** [P0 — make the existing engine trustworthy] \| **Operation-level Capability Registry** \| Before doing a job, OCADE knows exactly what operations work on this PC. \| Fixes the biggest architectural fault, RC12.  \|
- **R2-058** [P0 — make the existing engine trustworthy] \| **Task-specific preflight** \| Check everything required for this particular job before starting it. \| Stops “discovering FFmpeg/LibreOffice/etc. is unavailable halfway through”. \|
- **R2-059** [P0 — make the existing engine trustworthy] \| **Fix result batching** \| Never send more results than the server allows; keep the rest queued. \| Fixes RC01 and long-task synchronisation.   \|
- **R2-060** [P0 — make the existing engine trustworthy] \| **Priority STOP/control delivery** \| STOP must remain deliverable even when result reporting is unhealthy. \| Safety and responsiveness. \|
- **R2-061** [P0 — make the existing engine trustworthy] \| **Unique window/document identity** \| Track process + window + document, rather than title alone. \| Fixes RC17 wrong-target risk.  \|
- **R2-062** [P0 — make the existing engine trustworthy] \| **Cancellable uploads/long jobs** \| Every long operation obeys STOP. \| Fixes RC08.  \|
- **R2-063** [P0 — make the existing engine trustworthy] \| **Patch unsafe parser dependencies** \| Upgrade affected Pillow/pypdf versions after compatibility qualification and isolate untrusted parsing. \| Audit marks both as P0 dependency risks.  \|
- **R2-064** [P0 — make the existing engine trustworthy] \| **Independent final verifier** \| A separate component proves the requested result rather than trusting the planner. \| Fixes RC13's semantic-verification gap.  \|
- **R2-065** [P0 — make the existing engine trustworthy] \| **Windows build/path fixes** \| Qualify Windows path and process-launch behaviour. \| The audit records Windows-specific build/launch problems.  \|
- **R2-066** [Which MCPs and tools I would actually add] \| Tool / service \| Recommendation \| Wiring role \|
- **R2-067** [Which MCPs and tools I would actually add] \| **Existing Playwright** \| **KEEP — P0** \| Primary browser executor. OCADE already has it. \|
- **R2-068** [Which MCPs and tools I would actually add] \| **Playwright MCP** \| **OPTIONAL P1** \| Useful if OCADE wants a standard MCP exposure layer; don't run a second competing controller against the same tab. \|
- **R2-069** [Which MCPs and tools I would actually add] \| **Chrome DevTools MCP** \| **ADD OPTIONAL P1** \| Authorised attachment to the customer's existing Chrome session when login state is required. Chrome officially supports agent attachment to active browser sessions.  \|
- **R2-070** [Which MCPs and tools I would actually add] \| **Windows UI Automation** \| **KEEP + STRENGTHEN P0** \| Primary semantic desktop control. No reason to replace it with screenshot clicking. \|
- **R2-071** [Which MCPs and tools I would actually add] \| **FFmpeg** \| **MANAGED DEPENDENCY P0** \| Video/audio transformation. \|
- **R2-072** [Which MCPs and tools I would actually add] \| **ffprobe** \| **MANAGED VERIFIER P0** \| Independently inspect duration, streams, dimensions and container data; its output is designed to be machine readable.  \|
- **R2-073** [Which MCPs and tools I would actually add] \| **LibreOffice headless** \| **ADD/PREFLIGHT P0 where required** \| Reliable DOC/ODT/XLS/PPT conversion/export path. LibreOffice officially supports headless/programmatic operation and `--convert-to`, including PDF conversion.  \|
- **R2-074** [Which MCPs and tools I would actually add] \| **Capability Registry** \| **BUILD INTERNAL P0** \| Central truth of what actually works. This matters more than another AI model. \|
- **R2-075** [Which MCPs and tools I would actually add] \| **Independent Result Verifier** \| **BUILD INTERNAL P0** \| Determines whether “Completed” is legally allowed. \|
- **R2-076** [Which MCPs and tools I would actually add] \| **MCP Host / Gateway** \| **P1** \| Connect curated external capabilities under one schema/auth/policy layer. \|
- **R2-077** [Which MCPs and tools I would actually add] \| **TinyFish** \| **OPTIONAL P2** \| Cloud web automation/search fallback, not core Windows control. Its MCP server exposes web search, extraction, browser automation, remote browser sessions/profiles and monitoring.  \|
- **R2-078** [Which MCPs and tools I would actually add] \| **Local SLM/VLM** \| **EXPERIMENT P2** \| Fast routing, error classification or visual grounding when benchmarked beneficially. \|
- **R2-079** [Which MCPs and tools I would actually add] \| **Vision computer-use model** \| **KEEP AS FALLBACK** \| Canvas, games, custom-rendered apps and inaccessible UI. \|
- **R2-080** [Which MCPs and tools I would actually add] \| **Raw mouse/keyboard** \| **LAST RESORT** \| Act only from fresh visual/identity evidence. \|
- **R2-081** [Proposed performance gates] \| Wrong-target destructive writes \| **0** \| Duplicate-title/document stress suite \|
- **R2-082** [Proposed performance gates] \| False “Completed” results \| **0** in qualification campaign \| Independent verifier vs actual artefact \|
- **R2-083** [Proposed performance gates] \| Supported deterministic/browser workflow success \| **≥99%** \| Minimum 1,000 repeat runs across fixed benchmark \|
- **R2-084** [Proposed performance gates] \| Mixed Windows GUI workflow success \| **≥97%** \| Large Windows application benchmark \|
- **R2-085** [Proposed performance gates] \| Exact capability preflight \| **100% before mutation** \| Instrument every task \|
- **R2-086** [Proposed performance gates] \| Warm route-selection/preflight p95 \| **<500 ms** \| Local tracing \|
- **R2-087** [Proposed performance gates] \| Cold preflight p95 \| **<2 s** \| Clean-start measurements \|
- **R2-088** [Proposed performance gates] \| Structured browser action overhead p95 \| **<500 ms**, excluding website/network wait \| Playwright trace \|
- **R2-089** [Proposed performance gates] \| UIA action overhead p95 \| **<750 ms**, excluding application processing \| Device trace \|
- **R2-090** [Proposed performance gates] \| STOP acknowledgement locally \| **<1 s p95** \| Forced long-operation tests \|
- **R2-091** [Proposed performance gates] \| Network STOP/cancel \| **<2 s p95** under qualified network conditions \| Fault-injection tests \|
- **R2-092** [Proposed performance gates] \| Result journal backlog \| **1,000 results with zero loss/duplication** \| Protocol stress \|
- **R2-093** [Proposed performance gates] \| Duplicate side effects after lost ACK \| **0** \| Kill/reconnect/replay campaign \|
- **R2-094** [Proposed performance gates] \| Model round-trips \| **≥40% fewer than current baseline** on deterministic workflows \| Current-vs-new A/B \|
- **R2-095** [Proposed performance gates] \| Vision fallback rate in supported structured apps \| **<10%** \| Route telemetry \|
- **R2-096** [Proposed performance gates] \| Unrecoverable-loop incidents \| **0** \| Long-task and fault-injection suite \|
- **R2-097** [P0 protocol and execution tests] Result queues of 20, 21, 100 and 1,000.
- **R2-098** [P0 protocol and execution tests] Lost/delayed/duplicate acknowledgements.
- **R2-099** [P0 protocol and execution tests] STOP while a result backlog exists.
- **R2-100** [P0 protocol and execution tests] STOP during upload, conversion, video render and script execution.
- **R2-101** [P0 protocol and execution tests] Dependency exists / missing / corrupt / wrong version.
- **R2-102** [P0 protocol and execution tests] Duplicate window names and duplicate document basenames.
- **R2-103** [P0 protocol and execution tests] Window changes document between observation and write.
- **R2-104** [P0 protocol and execution tests] Browser navigation makes an old reference stale.
- **R2-105** [P0 protocol and execution tests] Browser page moves an element after observation.
- **R2-106** [P0 protocol and execution tests] Application crashes after mutation but before acknowledgement.
- **R2-107** [P0 protocol and execution tests] Network drops immediately before and after a consequential action.
- **R2-108** [P0 protocol and execution tests] Task resumes after process/server restart.
- **R2-109** [P0 protocol and execution tests] Path traversal/workspace escape attempts.
- **R2-110** [P0 protocol and execution tests] Prompt-injection page attempting to override task permissions.
- **R2-111** [P2 competitive and endurance qualification] hundreds of intermediate results.

### R3: Execution root causes and competitors (84 distinct source details)

- **R3-001** [The root causes in the current audit] \| **RC01** \| Desktop result journal may contain more than the server's maximum 20-result envelope. \| Long jobs can fail synchronisation; control/STOP traffic can become entangled with backlog delivery. \| **P0** \|
- **R3-002** [The root causes in the current audit] \| **RC02** \| Pinned Pillow `12.3.0` matches upstream security advisories, including a serious memory-corruption class issue. OCADE exploitability was not demonstrated. \| Untrusted images carry unnecessary parser risk. \| **P0** \|
- **R3-003** [The root causes in the current audit] \| **RC03** \| `pypdf 6.19.0` is in an affected range and PDF parsing begins before OCADE's output-text limit can protect the process. \| Malformed PDFs can consume resources before the normal limit is reached. \| **P0** \|
- **R3-004** [The root causes in the current audit] \| **RC04** \| DeepSeek/Vite path checking mixes Windows-native and Vite-normalised paths and has a sibling-prefix issue. \| Required transformations can be skipped or applied to the wrong path on Windows. \| **P0** \|
- **R3-005** [The root causes in the current audit] \| **RC05** \| Build tooling directly invokes bare `npx`, which is a portability risk on Windows. Fresh native reproduction remains blocked. \| Build/link process can behave differently across platforms. \| **P1** \|
- **R3-006** [The root causes in the current audit] \| **RC06** \| The dedicated Cloudflare Billing Read credential is not consumed as intended; HIGH checks use the existing token path. \| HIGH availability can fail even though a separate billing credential was configured. \| **P0** \|
- **R3-007** [The root causes in the current audit] \| **RC07** \| Staging intelligence code does not match the candidate implementation. \| A staging PASS would not qualify the actual candidate. \| **P0** \|
- **R3-008** [The root causes in the current audit] \| **RC08** \| File delivery/upload uses blocking I/O without task cancellation propagated into it. \| STOP can be requested while the upload continues. \| **P0** \|
- **R3-009** [The root causes in the current audit] \| **RC09** \| Supabase staging leaked-password protection was disabled. \| Weaker account protection than intended. \| **P1** \|
- **R3-010** [The root causes in the current audit] \| **RC10** \| Exact `/auth` is not included in the service worker's intended unconditional no-cache matcher. \| Authentication navigation relies more heavily on response headers than intended. No disclosure was demonstrated. \| **P1** \|
- **R3-011** [The root causes in the current audit] \| **RC11** \| Raw command text is scanned for shell characters before arguments are properly understood. \| Legitimate quoted values can be rejected, causing unnecessary retries. \| **P1** \|
- **R3-012** [The root causes in the current audit] \| **RC12** \| Broad capabilities are treated as though individual operations are healthy. \| JARVIS discovers missing Python/FFmpeg/LibreOffice/etc. after starting work. \| **P0 — central architecture issue** \|
- **R3-013** [The root causes in the current audit] \| **RC13** \| Verification can confirm existence and matching words/numbers without proving complete business correctness. \| A wrong value in the wrong spreadsheet row could potentially satisfy a weak check. \| **P0** \|
- **R3-014** [The root causes in the current audit] \| **RC14** \| XLSX fallback can write formula expressions but does not itself calculate them. \| A spreadsheet can look structurally correct while calculated values remain stale/unavailable. \| **P1** \|
- **R3-015** [The root causes in the current audit] \| **RC15** \| Windows direct command execution does not have the same OS sandbox used by the Linux route. \| Arbitrary authorised code requires a stronger Windows isolation story. \| **P1** \|
- **R3-016** [The root causes in the current audit] \| **RC16** \| FFmpeg subtitle-filter escaping may break for Windows paths containing special characters. \| Possible media-render failure; this remains a hypothesis requiring Windows reproduction. \| **P2 / unresolved** \|
- **R3-017** [The root causes in the current audit] \| **RC17** \| Duplicate exact window titles can lead to first-match selection instead of recognising ambiguity. \| JARVIS could operate on the wrong same-named document. \| **P0** \|
- **R3-018** [API/UI-tree first versus screenshot/VLM first] \| Target identity \| Semantic element/app/document identity \| Coordinates or visually inferred object \|
- **R3-019** [API/UI-tree first versus screenshot/VLM first] \| Speed \| Usually much faster for ordinary actions \| Requires image capture/model inference frequently \|
- **R3-020** [API/UI-tree first versus screenshot/VLM first] \| Token/bandwidth cost \| Small structured observations \| Potentially large image payloads \|
- **R3-021** [API/UI-tree first versus screenshot/VLM first] \| Resilience to moved windows/layout \| Strong when semantic identity remains stable \| Coordinates can shift \|
- **R3-022** [API/UI-tree first versus screenshot/VLM first] \| Form filling \| Excellent \| Works but inefficient \|
- **R3-023** [API/UI-tree first versus screenshot/VLM first] \| Complex canvas/game \| Often unavailable \| **Excellent fallback** \|
- **R3-024** [API/UI-tree first versus screenshot/VLM first] \| Legacy/custom UI \| Sometimes inaccessible \| Often still usable \|
- **R3-025** [API/UI-tree first versus screenshot/VLM first] \| Verification \| Can inspect exact DOM/UI state \| Often needs additional visual inference \|
- **R3-026** [API/UI-tree first versus screenshot/VLM first] \| Best OCADE role \| **Primary** \| **Fallback** \|
- **R3-027** [Task routing must happen before computer control] \| “Research five suppliers.” \| Search/research/browser \|
- **R3-028** [Task routing must happen before computer control] \| “Download my invoice.” \| Browser DOM → filesystem \|
- **R3-029** [Task routing must happen before computer control] \| “Create an Excel spreadsheet from this PDF.” \| PDF parser → spreadsheet API → verifier \|
- **R3-030** [Task routing must happen before computer control] \| “Create a professional PDF.” \| Document/PDF renderer \|
- **R3-031** [Task routing must happen before computer control] \| “Edit the Excel workbook I currently have open.” \| Excel/app adapter or UIA \|
- **R3-032** [Task routing must happen before computer control] \| “Turn these clips into a video.” \| Media pipeline/FFmpeg \|
- **R3-033** [Task routing must happen before computer control] \| “Change this Windows setting.” \| Windows UIA \|
- **R3-034** [Task routing must happen before computer control] \| “Play BoldChess.” \| Browser structure if available → canvas/VLM fallback \|
- **R3-035** [Task routing must happen before computer control] \| “Use Photoshop on my currently open project.” \| App adapter/API if available → UIA → vision \|
- **R3-036** [Task routing must happen before computer control] \| “Download invoices and enter totals into desktop accounting software.” \| Browser → parser → desktop app adapter/UIA \|
- **R3-037** [Use a local small model, but only where it helps] deciding whether a new large-model call is necessary;
- **R3-038** [Use a local small model, but only where it helps] small visual-grounding fallback;
- **R3-039** [Use a local small model, but only where it helps] continuing very predictable micro-steps.
- **R3-040** [Use a local small model, but only where it helps] inventing capabilities that preflight says are unavailable.
- **R3-041** [Independent verification] \| TXT \| reopen file, compare expected content \|
- **R3-042** [Independent verification] \| DOCX \| independently parse package, check required headings/tables/content \|
- **R3-043** [Independent verification] \| PDF \| reopen with separate parser/render route, confirm pages/content \|
- **R3-044** [Independent verification] \| XLSX \| check sheets/cells/formulas **and calculated values when required** \|
- **R3-045** [Independent verification] \| Image \| independently decode, dimensions, requested edit evidence, original preserved \|
- **R3-046** [Independent verification] \| Video \| `ffprobe` duration/resolution/streams + decode representative frames \|
- **R3-047** [Independent verification] \| Browser form \| inspect resulting DOM/server state \|
- **R3-048** [Independent verification] \| File download \| signature/MIME/hash + expected content \|
- **R3-049** [Independent verification] \| Windows application \| re-read UIA/app state and resulting persisted artefact \|
- **R3-050** [Independent verification] \| Accounting \| exact balances, row provenance, unmatched items, recalculation \|
- **R3-051** [Independent verification] \| Order tracking \| actual status + source/time + missing records clearly marked \|
- **R3-052** [Recommended tool stack] \| **Playwright / Playwright MCP** \| Primary browser automation \| **Core.** Use semantic DOM/accessibility snapshots and stable references.  \|
- **R3-053** [Recommended tool stack] \| **Chrome DevTools Protocol / Chrome DevTools MCP** \| Authorised control of an existing Chrome session, debugging/network/page data \| **Core for existing-browser mode**, under explicit customer permission. Chrome DevTools tooling can reuse active browser context.  \|
- **R3-054** [Recommended tool stack] \| **Puppeteer** \| Alternative Chromium/Firefox automation through CDP/WebDriver BiDi \| **Not a second primary engine.** Keep as compatibility/test option if there is a concrete gap; Playwright should remain the normal browser runtime.  \|
- **R3-055** [Recommended tool stack] \| **Windows UI Automation** \| Native Windows semantic controls \| **Core.** This should be the normal desktop interaction mechanism before vision.  \|
- **R3-056** [Recommended tool stack] \| **pywinauto** \| Python abstraction over Win32/UIA for particular native-app automation \| Useful implementation/compatibility layer where it simplifies existing code, not another independent “brain”.  \|
- **R3-057** [Recommended tool stack] \| **WinAppDriver** \| WebDriver-style Windows application automation \| Better suited as **testing/compatibility infrastructure** than OCADE's universal production controller.  \|
- **R3-058** [Recommended tool stack] \| **OCADE Browser MCP** \| OCADE-owned semantic browser actions \| Build on Playwright/CDP; expose `navigate`, `find`, `fill`, `click`, `download`, `upload`, `verify`. \|
- **R3-059** [Recommended tool stack] \| **OCADE Windows MCP/service** \| Stable Windows capabilities \| First-party wrapper around UIA/app identity, with visual fallback; do not expose arbitrary raw coordinates by default. \|
- **R3-060** [Recommended tool stack] \| **OCADE Files MCP/service** \| File list/read/write/move/copy/hash \| First-party and permission-scoped. Routine file operations should not require shell commands. \|
- **R3-061** [Recommended tool stack] \| **OCADE Documents service** \| DOCX/XLSX/PPTX/PDF operations \| First-party typed operations plus independent verifiers. \|
- **R3-062** [Recommended tool stack] \| **FFmpeg + ffprobe** \| Video/audio creation and verification \| **Bundle/pin/health-check**, rather than relying on arbitrary customer PATH configuration.  \|
- **R3-063** [Recommended tool stack] \| **LibreOffice headless** \| Repeatable Office→PDF conversion/calculation fallback \| Optional but useful; bundle/qualify deliberately rather than searching for it during a job.  \|
- **R3-064** [Recommended tool stack] \| **Python environment manager such as `uv`** \| Known Python runtime/environment \| Prefer a pinned managed runtime over calling whatever `python` happens to mean on Windows. `uv` supports managed Python environments and Windows.  \|
- **R3-065** [Recommended tool stack] \| **Local model runtime** \| Optional SLM/VLM micro-controller \| P1 optimisation; use a pinned, supported runtime. Hermes currently demonstrates one practical local-model approach.  \|
- **R3-066** [Recommended tool stack] \| **MCP gateway/tool registry** \| Expose only relevant tools \| Core integration abstraction, but behind OCADE permissions—not in place of them. \|
- **R3-067** [Recommended tool stack] \| **TinyFish / specialist web agents** \| Difficult external websites \| Optional fallback, not the default browser engine and not evidence of Windows support. \|
- **R3-068** [Recommended tool stack] \| **GitHub Actions Windows / disposable Windows runner** \| Continuous Windows qualification \| Essential testing lane. Exact pricing/free eligibility depends on account and runner configuration and is therefore **unspecified here**. \|
- **R3-069** [Recommended tool stack] \| **Cloud Windows VM runner** \| Full UIA/agent qualification without using the owner's PC \| Required for repeatable disposable native testing when CI runners cannot provide interactive desktop requirements. Exact vendor/cost remains **unspecified**. \|
- **R3-070** [Acceptance criteria before public launch] \| **Protocol** \| 21/100/1,000 retained results drain without loss or duplicate effect; dropped/reordered/duplicate ACKs handled correctly. \|
- **R3-071** [Acceptance criteria before public launch] \| **STOP** \| STOP remains deliverable during result backlog and long I/O; no new action admitted after the measured STOP boundary; ongoing effect reconciled honestly. \|
- **R3-072** [Acceptance criteria before public launch] \| **Targeting** \| Zero writes to the wrong document across duplicate filenames/titles, focus theft, enumeration changes and process restarts in the release corpus. \|
- **R3-073** [Acceptance criteria before public launch] \| **Preflight** \| Remove each dependency individually; planner never selects an unavailable operation. \|
- **R3-074** [Acceptance criteria before public launch] \| **Browser** \| DOM/accessibility is primary; vision only where structured targets genuinely fail; hostile-page/popup/iframe/download/upload tests included. \|
- **R3-075** [Acceptance criteria before public launch] \| **Windows** \| Disposable Windows tests for Notepad, multi-window identity, unknown applications, native dialogs and UIA fallback. \|
- **R3-076** [Acceptance criteria before public launch] \| **Documents** \| DOCX/PDF/XLSX/PPTX outputs independently reopen and satisfy semantic assertions. \|
- **R3-077** [Acceptance criteria before public launch] \| **Spreadsheet** \| Formula strings **and calculated results** independently verified where calculation is requested. \|
- **R3-078** [Acceptance criteria before public launch] \| **Media** \| ffprobe plus actual decode/frame/audio checks after render. \|
- **R3-079** [Acceptance criteria before public launch] \| **Security** \| Patched dependency set; malicious/malformed parser fixtures cannot hang the long-lived agent; resource ceilings verified. \|
- **R3-080** [Acceptance criteria before public launch] \| **Deployment** \| Candidate SHA/digests/agent/schema/capability versions exactly match the tested target. \|
- **R3-081** [Acceptance criteria before public launch] \| **False completion** \| **Zero false VERIFIED results** in the qualification corpus. \|
- **R3-082** [Acceptance criteria before public launch] \| **Held-out professional work** \| Execute the planned 30 reconciliation + 30 client-document + 30 order-status cases using the real current model/tool path. \|
- **R3-083** [Acceptance criteria before public launch] \| **Elite tasks** \| Execute the five planned elite benchmarks: professional video, BoldChess, photo editing, vehicle CAD and failure/recovery. \|
- **R3-084** [Acceptance criteria before public launch] \| **Release gates** \| **10/10 qualified**, replacing today's 0/10. \|

### R4: Provider-neutral execution architecture (117 distinct source details)

- **R4-001** [What is actually wrong inside OCADE] \| Coarse capability admission \| JARVIS starts a task and discovers halfway through that FFmpeg/Python/LibreOffice is unavailable \| “Computer/media available” is confused with “this exact operation is healthy now” \| **P0** \|
- **R4-002** [What is actually wrong inside OCADE] \| Result transport >20 \| A long-running task can accumulate enough results that the exchange becomes invalid \| Local journal and server envelope have incompatible batching contracts \| **P0** \|
- **R4-003** [What is actually wrong inside OCADE] \| STOP shares the work path \| Stopping work can become unreliable while the normal result path is blocked \| Safety/control traffic is not sufficiently independent \| **P0** \|
- **R4-004** [What is actually wrong inside OCADE] \| Duplicate window titles \| JARVIS can operate on the wrong same-named document/window \| Target identity is based too heavily on first matching title \| **P0** \|
- **R4-005** [What is actually wrong inside OCADE] \| Uncancellable upload \| STOP can occur but an in-progress upload may continue \| Blocking I/O does not receive task cancellation \| **P0** \|
- **R4-006** [What is actually wrong inside OCADE] \| Weak semantic completion check \| A requested number may exist in the output but be in the wrong place \| Verification proves presence/state, not complete business correctness \| **P0** \|
- **R4-007** [What is actually wrong inside OCADE] \| Staging/source mismatch \| A test may actually exercise different AI code than the branch under review \| No immutable end-to-end deployment attestation \| **P0** \|
- **R4-008** [What is actually wrong inside OCADE] \| Windows Vite path issue \| Code behaves differently on Windows paths \| Normalised and native path representations are mixed \| **P0** \|
- **R4-009** [What is actually wrong inside OCADE] \| HIGH billing credential wiring \| HIGH mode eligibility can break independently of model functionality \| Correct scoped credential is not consumed where expected \| **P0** \|
- **R4-010** [What is actually wrong inside OCADE] \| Pillow/pypdf issues \| Hostile image/PDF input can expose parser risk \| Vulnerable/unbounded parsing occurs in the agent process \| **P0** \|
- **R4-011** [What is actually wrong inside OCADE] \| XLSX recalculation limitation \| Spreadsheet can contain formulas without independently proven calculated values \| File generation is mistaken for native spreadsheet execution \| **P1** \|
- **R4-012** [What is actually wrong inside OCADE] \| Raw command filtering \| Benign quoted content may be rejected \| Security policy analyses string syntax rather than a typed operation \| **P1** \|
- **R4-013** [What is actually wrong inside OCADE] \| `/auth` service-worker edge \| Authentication state can interact incorrectly with cache rules \| Exact route isn't covered by the intended exclusion \| **P1** \|
- **R4-014** [What is actually wrong inside OCADE] \| Bare `npx` invocation \| Windows build/tool setup can be brittle \| Process launching assumes Unix-like executable behaviour \| **P1** \|
- **R4-015** [What the leading competitors are actually doing] \| **ChatGPT / OpenAI Computer Use** \| OpenAI separates browser-oriented and full computer tooling, while applications may also expose their existing deterministic operations as normal function tools. \| Do not send every task through screenshot control. \|
- **R4-016** [What the leading competitors are actually doing] \| **OpenAI Dots** \| Dots have their own cloud computers and connect to thousands of applications through a plugin ecosystem; users remain able to pause/control the agent. \| Give the planner a governed capability ecosystem rather than hard-wiring every integration. \|
- **R4-017** [What the leading competitors are actually doing] \| **Codex** \| Uses a reusable agent harness with managed context, tool use, controlled environments and long-running work; cloud coding tasks use isolated sandboxes. \| Long tasks need a runtime/harness, not a gigantic prompt. \|
- **R4-018** [What the leading competitors are actually doing] \| **Claude Browser Use** \| Uses accessibility/page structure, forms, tabs and screenshots within a browser-specific toolset. \| Browser tasks should use structural browser state first. \|
- **R4-019** [What the leading competitors are actually doing] \| **Claude Computer Use** \| Full-desktop tasks use screenshot/mouse/keyboard tools; multiple actions can be returned in one model turn. \| Use visual desktop control only when the task genuinely leaves structured surfaces; batch safe actions. \|
- **R4-020** [What the leading competitors are actually doing] \| **Gemini 4 Argon** \| Computer Use produces UI actions from screenshots while the developer owns the execution environment; Gemini also supports function calling and computer use. \| Keep model intelligence separate from local authority/execution. \|
- **R4-021** [What the leading competitors are actually doing] \| **Meta Muse** \| Muse selects built-in skills, can browse/use connected apps and operates subject to permissions and approvals. Meta is also developing on-device agentic models. \| Route to skills/connectors before GUI improvisation. \|
- **R4-022** [What the leading competitors are actually doing] \| **OpenClaw** \| Separates an isolated agent-only browser from an optional authenticated user's Chrome session; browser control exposes deterministic tab/action/snapshot operations. \| Explicit browser profiles and session identity are better than “find some Chrome window”. \|
- **R4-023** [What the leading competitors are actually doing] \| **Manus** \| Connectors unify external services and MCP servers under permission/cost controls. \| MCP should feed a controlled integration layer, not bypass OCADE authority. \|
- **R4-024** [What the leading competitors are actually doing] \| **Hermes** \| Discovers registered MCP tools and lets operators filter what each server exposes. \| Tool discovery needs filtering, not “show the model every tool”. \|
- **R4-025** [What the leading competitors are actually doing] \| **xAI/Grok** \| xAI's current API supports built-in tools, custom function calling and remote MCP servers; its docs explicitly recommend `allowed_tools` to reduce both context overhead and risk. \| Expose a small task-specific tool subset. \|
- **R4-026** [What the leading competitors are actually doing] \| **Microsoft UFO** \| Separates an application-selecting HostAgent, an application-level agent and an Application Automator that can use UI controls/native APIs/tools. \| App selection and app execution should be different responsibilities. \|
- **R4-027** [What the leading competitors are actually doing] \| **Agent S** \| Combines a main planner, separate GUI grounding and optionally a code environment; current project documentation also describes reflection/recovery. \| A dedicated grounding/executor layer can outperform asking one huge model to do everything. \|
- **R4-028** [What the leading competitors are actually doing] \| **UI-TARS / Agent TARS** \| Supports GUI control, browser DOM/hybrid strategies, MCP and an event-stream architecture. \| Hybrid browser control and structured event history are stronger than pure pixels. \|
- **R4-029** [What the leading competitors are actually doing] \| **Perplexity** \| Its Agent API combines search, URL retrieval, code execution, MCP and model routing in a managed runtime. \| Use a dedicated research pipeline for research instead of teaching desktop JARVIS to scrape the web manually. \|
- **R4-030** [How OCADE should decide browser versus full PC] \| “Search the web for suppliers” \| Research/browser \|
- **R4-031** [How OCADE should decide browser versus full PC] \| “Book this through the website” \| Browser DOM + approval \|
- **R4-032** [How OCADE should decide browser versus full PC] \| “Create an Excel workbook from this PDF” \| PDF parser → spreadsheet API; **no GUI unless required** \|
- **R4-033** [How OCADE should decide browser versus full PC] \| “Create a professional PDF” \| Document/PDF tools; **no browser or desktop first** \|
- **R4-034** [How OCADE should decide browser versus full PC] \| “Edit the workbook I currently have open in Excel” \| Excel/native automation or UIA \|
- **R4-035** [How OCADE should decide browser versus full PC] \| “Turn these clips into a video” \| Media pipeline/FFmpeg, not screen clicking \|
- **R4-036** [How OCADE should decide browser versus full PC] \| “Play BoldChess in the browser” \| Browser DOM/vision depending on canvas \|
- **R4-037** [How OCADE should decide browser versus full PC] \| “Use Photoshop to edit this open project” \| App-specific/native route → UIA → vision \|
- **R4-038** [How OCADE should decide browser versus full PC] \| “Download a report and enter its total into desktop accounting software” \| Browser subtask → file/parser → full-PC subtask \|
- **R4-039** [The micro-loop for every task] Parse the user's requested deliverables and constraints.
- **R4-040** [The micro-loop for every task] Convert them into typed operations, not vague prose.
- **R4-041** [The micro-loop for every task] Determine whether each operation belongs to research, browser, direct-file, native-app or full-desktop control.
- **R4-042** [The micro-loop for every task] Query operation-level capability health.
- **R4-043** [The micro-loop for every task] Remove every unavailable or unauthorised tool **before** the model sees its action options.
- **R4-044** [The micro-loop for every task] Bind the target: account, device, application process, window, document, browser profile and tab.
- **R4-045** [The micro-loop for every task] Generate a short plan containing expected postconditions.
- **R4-046** [The micro-loop for every task] Batch deterministic low-risk actions when no new observation is required.
- **R4-047** [The micro-loop for every task] Observe only the state that changed.
- **R4-048** [The micro-loop for every task] Check the expected postcondition.
- **R4-049** [The micro-loop for every task] If it failed, return a **typed machine error**, not a giant stack trace.
- **R4-050** [The micro-loop for every task] Choose a different known-supported route if one exists.
- **R4-051** [The micro-loop for every task] Limit retries by cause, not by arbitrary iteration count.
- **R4-052** [The micro-loop for every task] Independently verify the final artifact/state.
- **R4-053** [Recommended stack] \| Capability \| Recommendation \| Priority \| Why \|
- **R4-054** [Recommended stack] \| **Existing OCADE Playwright controller** \| **KEEP and strengthen** \| P0 \| Already implemented; should remain primary browser writer \|
- **R4-055** [Recommended stack] \| **Existing Windows UIA** \| **KEEP and strengthen** \| P0 \| Already implemented; add target identity, health and event waits \|
- **R4-056** [Recommended stack] \| **Existing typed file/document/sheet/media modules** \| **KEEP** \| P0 \| Much faster and safer than GUI editing \|
- **R4-057** [Recommended stack] \| **Operation Health Registry** \| **BUILD** \| P0 \| Main missing execution contract \|
- **R4-058** [Recommended stack] \| **Target Identity Resolver** \| **BUILD** \| P0 \| Fixes wrong-window/document risk \|
- **R4-059** [Recommended stack] \| **Independent workflow verifiers** \| **BUILD** \| P0 \| Prevents false completion \|
- **R4-060** [Recommended stack] \| **Bounded result transport** \| **FIX** \| P0 \| Solves 20-result failure \|
- **R4-061** [Recommended stack] \| **Independent STOP/control channel** \| **FIX** \| P0 \| STOP must work even under backlog \|
- **R4-062** [Recommended stack] \| **Cancellable transfer layer** \| **BUILD/FIX** \| P0 \| Removes uncancellable uploads \|
- **R4-063** [Recommended stack] \| **Pinned runtime manager** \| **BUILD** \| P0 \| FFmpeg/PDF/Office dependencies become known capabilities \|
- **R4-064** [Recommended stack] \| **Dynamic tool projection/search** \| **BUILD** \| P0 \| Model sees only relevant healthy tools \|
- **R4-065** [Recommended stack] \| **MCP 2026-07-28 gateway** \| **ADD cautiously** \| P1 \| Standard connector/tool interoperability \|
- **R4-066** [Recommended stack] \| **Playwright MCP** \| **Adapter/test/reference**, not second executor \| P1 \| Structured browser interface and interoperability \|
- **R4-067** [Recommended stack] \| **Chrome DevTools MCP** \| **Optional authenticated-browser adapter** \| P1 \| Good for explicitly authorised existing sessions \|
- **R4-068** [Recommended stack] \| **FFmpeg + ffprobe** \| **Package/pin/health-test** \| P1 \| Reliable media operations and verification \|
- **R4-069** [Recommended stack] \| **LibreOffice headless** \| **Optional qualified converter** \| P1 \| Useful PDF/office fallback, not mandatory for every task \|
- **R4-070** [Recommended stack] \| **Office native automation** \| **First-party adapter** \| P1 \| Needed for native recalculation/macros/open unsaved documents \|
- **R4-071** [Recommended stack] \| **Browser Use** \| **Benchmark/optional managed-browser adapter** \| P1/P2 \| Strong external browser-agent stack \|
- **R4-072** [Recommended stack] \| **Stagehand** \| **Evaluate as fallback/self-healing layer** \| P2 \| Useful browser abstractions, but avoid second uncontrolled writer \|
- **R4-073** [Recommended stack] \| **Skyvern** \| **Benchmark/optional specialised workflow adapter** \| P2 \| Good vision+Playwright reference \|
- **R4-074** [Recommended stack] \| **UI-TARS grounding** \| **Research fallback** \| P2 \| Useful for structurally opaque GUI regions \|
- **R4-075** [Recommended stack] \| **Agent S ideas** \| **Research architecture/benchmark** \| P2 \| Strong planner/grounder separation \|
- **R4-076** [Recommended stack] \| **Microsoft UFO concepts** \| **Borrow architecture, don't embed wholesale** \| P2 \| Application routing pattern fits OCADE \|
- **R4-077** [Recommended stack] \| **OpenAdapt** \| **Evaluate for repeated workflows** \| P2 \| Demonstration → deterministic replay → independent verification \|
- **R4-078** [Recommended stack] \| **TinyFish-style managed web runner** \| **Optional cloud adapter** \| P2 \| Useful when OCADE needs an external isolated browser, not the local control core \|
- **R4-079** [Recommended stack] \| **Hermes/Manus MCP catalogues** \| **Study UX/governance pattern** \| P2 \| Good connector discovery and filtering models \|
- **R4-080** [The cloud test matrix] \| Linux browser runner \| Website routes, Playwright, auth UI, forms, accessibility, browser task suite \|
- **R4-081** [The cloud test matrix] \| Windows clean VM \| Agent install, service startup, pairing, UIA, Notepad, Explorer, native dialogs \|
- **R4-082** [The cloud test matrix] \| Windows Office VM \| Word, Excel, PowerPoint, recalculation, PDF export, reopen/verify \|
- **R4-083** [The cloud test matrix] \| Windows media VM \| FFmpeg, images, audio/video, codec failures, cancellation \|
- **R4-084** [The cloud test matrix] \| Windows “missing tools” VM \| Deliberately remove each dependency and verify preflight blocks bad plans \|
- **R4-085** [The cloud test matrix] \| Browser matrix \| Chrome, Edge and supported Chromium paths; isolated and explicitly attached sessions \|
- **R4-086** [The cloud test matrix] \| Security/fuzz runner \| PDF/image parser abuse, malformed files, oversized inputs, auth boundaries \|
- **R4-087** [The cloud test matrix] \| Network-fault runner \| Offline transition, packet loss, latency, server 500s, upload interruption \|
- **R4-088** [The cloud test matrix] \| Transport stress runner \| 0/1/20/21/100/1,000 result backlogs, lost ACKs, duplicate receipts \|
- **R4-089** [The cloud test matrix] \| Long-task runner \| Hours-long tasks, checkpoints, restart/reconnect, resumed execution \|
- **R4-090** [The cloud test matrix] \| Wrong-target runner \| Same file names, same window titles, focus stealing, pop-ups, multiple documents \|
- **R4-091** [The cloud test matrix] \| Benchmark runners \| OSWorld-style desktop tasks, WindowsAgentArena-style tasks, browser benchmark tasks and OCADE's held-out corpus \|
- **R4-092** [Commercial model] \| **Free / Starter** \| Chat, limited research, limited browser automation, local deterministic tools \|
- **R4-093** [Commercial model] \| **Pro** \| Full JARVIS PC control, larger usage allowance, offline/local options, advanced models \|
- **R4-094** [Commercial model] \| **Business** \| Managed devices, team connectors, permissions, audit trails, admin policies \|
- **R4-095** [Commercial model] \| **Enterprise** \| SSO, device fleets, data residency controls, private model/provider options, policy enforcement \|
- **R4-096** [Commercial model] \| **Heavy compute add-on** \| Cloud browsers, long-running agents, premium models, large media workloads \|
- **R4-097** [The revised priority order] \| **P0** \| Fix 20-result batching and separate STOP/control delivery \|
- **R4-098** [The revised priority order] \| **P0** \| Add operation-level dependency health/preflight \|
- **R4-099** [The revised priority order] \| **P0** \| Fix unique window/process/document targeting \|
- **R4-100** [The revised priority order] \| **P0** \| Make uploads and all long I/O genuinely cancellable \|
- **R4-101** [The revised priority order] \| **P0** \| Patch/isolate Pillow and PDF parsers \|
- **R4-102** [The revised priority order] \| **P0** \| Fix Windows path/build portability \|
- **R4-103** [The revised priority order] \| **P0** \| Attest exact web/server/agent/model/runtime versions \|
- **R4-104** [The revised priority order] \| **P0** \| Fix HIGH/billing credential boundary \|
- **R4-105** [The revised priority order] \| **P0** \| Build task-family semantic verification \|
- **R4-106** [The revised priority order] \| **P0** \| Run exact-candidate disposable Windows qualification \|
- **R4-107** [The revised priority order] \| **P1** \| Optimise browser control around DOM/accessibility and action batches \|
- **R4-108** [The revised priority order] \| **P1** \| Strengthen UIA identity and event-driven waits \|
- **R4-109** [The revised priority order] \| **P1** \| Pin/qualify FFmpeg, Office/PDF converters and runtime dependencies \|
- **R4-110** [The revised priority order] \| **P1** \| Implement health-filtered dynamic tool projection \|
- **R4-111** [The revised priority order] \| **P1** \| Build true offline-JARVIS provider routing over the same executor \|
- **R4-112** [The revised priority order] \| **P1** \| Build long-task durable checkpoints/recovery \|
- **R4-113** [The revised priority order] \| **P1** \| Simplify the customer-facing progress UI \|
- **R4-114** [The revised priority order] \| **P2** \| Evaluate Playwright MCP, Chrome DevTools MCP, Browser Use, Stagehand and Skyvern as measured adapters \|
- **R4-115** [The revised priority order] \| **P2** \| Evaluate specialised local GUI grounding such as UI-TARS-style models \|
- **R4-116** [The revised priority order] \| **P2** \| Explore “demonstrate once → compile workflow” automation \|
- **R4-117** [The revised priority order] \| **P2** \| Expand the connector/plugin marketplace after the core executor is proven \|

### R5: Runtime tools and commercial launch (41 distinct source details)

- **R5-001** [Executive conclusion] Video task → JARVIS eventually discovers FFmpeg is unavailable.
- **R5-002** [Executive conclusion] Image task → JARVIS discovers Python is not correctly available through its execution environment.
- **R5-003** [Executive conclusion] DOCX → PDF → JARVIS discovers LibreOffice is unavailable only after starting.
- **R5-004** [Executive conclusion] Windows build → DeepSeek integration mishandles Windows path separators.
- **R5-005** [Executive conclusion] Agent communication → retained results can exceed what the server accepts.
- **R5-006** [Executive conclusion] New agent versus old server → acknowledgement contract can differ.
- **R5-007** [Executive conclusion] Browser/local inference → CSP/routing problems appear only after execution starts.
- **R5-008** [Executive conclusion] Tasks can spend many AI calls exploring the computer rather than doing the work.
- **R5-009** [Executive conclusion] The latest audit still has **0/10 release gates satisfied** and no complete current-version JARVIS workflow campaign.
- **R5-010** [JARVIS should first classify the task] \| “Open my local Excel workbook” \| Full PC / Office \|
- **R5-011** [JARVIS should first classify the task] \| “Create an XLSX from this PDF” \| File/document tools first \|
- **R5-012** [JARVIS should first classify the task] \| “Change this setting in Photoshop” \| Windows UI \|
- **R5-013** [JARVIS should first classify the task] \| “Send this through a website” \| Browser + approval if required \|
- **R5-014** [Full-PC task] interaction across multiple native applications.
- **R5-015** [Then eliminate the already-known defects] \| Retained-result/server batch mismatch \| Negotiated bounded batching + acknowledgement/backpressure \|
- **R5-016** [Then eliminate the already-known defects] \| Old/new protocol mismatch \| Versioned handshake + compatibility enforcement \|
- **R5-017** [Then eliminate the already-known defects] \| Windows DeepSeek path bug \| Platform-independent canonical path handling \|
- **R5-018** [Then eliminate the already-known defects] \| Bare `npx` portability problem \| Resolve known executable through Node/package runtime \|
- **R5-019** [Then eliminate the already-known defects] \| Staging intelligence older than candidate \| Pin/deploy identical artefact/version \|
- **R5-020** [Then eliminate the already-known defects] \| Pillow security advisories \| Upgrade/replace and regression-test affected image flows \|
- **R5-021** [Then eliminate the already-known defects] \| pypdf advisories \| Upgrade/replace, parser limits and hostile-file tests \|
- **R5-022** [Then eliminate the already-known defects] \| Leaked-password protection disabled \| Enable and test staging/production configuration \|
- **R5-023** [Then eliminate the already-known defects] \| Service-worker `/auth` exclusion problem \| Correct routing/cache rules and regression-test \|
- **R5-024** [Then eliminate the already-known defects] \| Library cancellation gap \| Cancellation-aware upload lifecycle \|
- **R5-025** [Backend actually does this] select document/presentation capability
- **R5-026** [Backend actually does this] request approval if policy requires
- **R5-027** [The most important additions, in priority order] \| **Critical** \| Capability Registry \| Stops Python/FFmpeg/LibreOffice-style surprise failures \|
- **R5-028** [The most important additions, in priority order] \| **Critical** \| Versioned agent/server protocol \| Stops incompatible PC-control sessions \|
- **R5-029** [The most important additions, in priority order] \| **Critical** \| Bounded result queue + acknowledgements \| Prevents result backlog/synchronisation failures \|
- **R5-030** [The most important additions, in priority order] \| **Critical** \| Independent verifier \| Prevents false “Done” results \|
- **R5-031** [The most important additions, in priority order] \| **Critical** \| Windows UI Automation executor \| Makes native control semantic instead of coordinate-driven \|
- **R5-032** [The most important additions, in priority order] \| **Critical** \| Playwright browser executor \| Makes websites fast and structured \|
- **R5-033** [The most important additions, in priority order] \| **High** \| File/document/PDF adapters \| Avoids unnecessary GUI control \|
- **R5-034** [The most important additions, in priority order] \| **High** \| Packaged media executor \| Stops dependency hunting \|
- **R5-035** [The most important additions, in priority order] \| **High** \| Durable workflow engine \| Makes long tasks resumable \|
- **R5-036** [The most important additions, in priority order] \| **High** \| Typed recovery engine \| Makes failures predictable and recoverable \|
- **R5-037** [The most important additions, in priority order] \| **High** \| Skills library \| Encodes proven workflows rather than rediscovering them \|
- **R5-038** [The most important additions, in priority order] \| **High** \| Cloud Windows test farm \| Tests PC behaviour without using your personal PC \|
- **R5-039** [The most important additions, in priority order] \| **High** \| Security/tool gateway \| Prevents MCP/tool access becoming a new attack surface \|
- **R5-040** [The most important additions, in priority order] \| **Medium** \| Specialist web-agent fallback such as TinyFish \| Useful for difficult web workflows, but should not replace OCADE's core browser engine \|
- **R5-041** [The most important additions, in priority order] \| **Development only** \| GitHub/Supabase/Cloudflare MCPs \| Excellent for building OCADE; should not automatically be exposed to customer JARVIS \|

### R6: Windows/MCP/receipts exact controls (151 distinct source details)

- **R6-001** [What OCADE needs to change first] \| Runtime availability is uncertain \| JARVIS spends minutes looking for Python, FFmpeg or conversion tools \| No authoritative capability/preflight registry before planning; previous trials found Python command discovery, FFmpeg and LibreOffice problems.  \| **P0** \|
- **R6-002** [What OCADE needs to change first] \| Result backlog can exceed 20 \| Long-running sessions can stop synchronising correctly \| Candidate agent sends its retained result journal wholesale while server input caps results at 20.  \| **P0** \|
- **R6-003** [What OCADE needs to change first] \| GUI control is overused \| Typing/clicking becomes slow or targets the wrong state \| Visual computer control is inherently less structured than UI Automation or DOM control; Microsoft exposes deterministic UIA controls specifically for programmatic interaction.  \| **P0** \|
- **R6-004** [What OCADE needs to change first] \| Browser automation is not one coherent capability \| Web tasks hang or use screen clicking unnecessarily \| OCADE needs DOM/accessibility control for browser tasks and a separate approved browser-session bridge. Playwright provides structured page automation; Chrome also provides an explicit authorised DevTools connection mechanism.  \| **P0** \|
- **R6-005** [What OCADE needs to change first] \| Dependency checks happen during work \| JARVIS tries one unavailable program after another \| Discovery should happen at agent startup and before planning, not halfway through the task \| **P0** \|
- **R6-006** [What OCADE needs to change first] \| Completion and execution are too closely coupled \| The model may believe something is finished before the artefact is correct \| Verification must be a separate deterministic stage \| **P0** \|
- **R6-007** [What OCADE needs to change first] \| Windows path handling has a known problem \| New builds can work differently on Windows \| The audited DeepSeek path predicate mishandles Windows-style/path-normalised separators and sibling prefixes.  \| **P0** \|
- **R6-008** [What OCADE needs to change first] \| `npx` invocation is not fully portable \| A Windows machine can fail to launch a JS tool even though Node exists \| The audit still identifies bare `npx` execution as a Windows portability risk.  \| **P1** \|
- **R6-009** [What OCADE needs to change first] \| Document/image dependencies need attention \| Some file jobs may be unsafe or hang on malformed input \| The audited candidate pins Pillow 12.3.0 and pypdf 6.19.0 versions covered by current advisories.  \| **P0 security** \|
- **R6-010** [The local execution controller] Validate the task and permissions.
- **R6-011** [The local execution controller] Validate that the path is within the customer's authorised workspace.
- **R6-012** [The local execution controller] Resolve `documents.pdf_from_docx` through the capability registry.
- **R6-013** [The local execution controller] Check that its dependency is actually healthy.
- **R6-014** [The local execution controller] Record `action_id` durably **before** executing anything.
- **R6-015** [The local execution controller] Invoke the independent verifier.
- **R6-016** [The local execution controller] Retry the *transmission*, not the side effect, if the network acknowledgement is lost.
- **R6-017** [Windows UI Automation before screen clicking] Record its PID, process start time and top-level window handle.
- **R6-018** [Windows UI Automation before screen clicking] Find the expected top-level UIA element.
- **R6-019** [Windows UI Automation before screen clicking] Find a child by semantic criteria: control type + automation ID + accessible name.
- **R6-020** [Windows UI Automation before screen clicking] Check that the element still belongs to the expected application/window.
- **R6-021** [Windows UI Automation before screen clicking] Call `Invoke`, `SetValue`, `Select`, etc.
- **R6-022** [Windows UI Automation before screen clicking] Wait for a relevant UIA event or state change.
- **R6-023** [Windows UI Automation before screen clicking] Only fall back to a screenshot/coordinate action if no reliable UIA representation exists.
- **R6-024** [Native file formats] \| Job \| First choice \| Secondary \| Last resort \|
- **R6-025** [Native file formats] \| Create/edit `.docx` \| Open XML document API \| LibreOffice/Word automation \| visual UI \|
- **R6-026** [Native file formats] \| Create/edit `.xlsx` structure/formulas \| Open XML spreadsheet API \| Excel/LibreOffice calculation/application interface \| visual UI \|
- **R6-027** [Native file formats] \| Create/edit `.pptx` \| Open XML presentation API \| PowerPoint/LibreOffice \| visual UI \|
- **R6-028** [Native file formats] \| Convert Office file to PDF \| verified LibreOffice headless/native Office exporter \| other approved converter \| visual Save As \|
- **R6-029** [Native file formats] \| Read PDF \| patched parser in isolated worker \| rendering/text extraction alternative \| GUI \|
- **R6-030** [Native file formats] \| Create simple PDF \| native PDF-generation component \| document → LibreOffice PDF \| GUI \|
- **R6-031** [Native file formats] \| Video/audio \| FFmpeg \| known installed editor integration \| visual UI \|
- **R6-032** [Native file formats] \| Media verification \| `ffprobe` \| second decoder/probe \| visual inspection \|
- **R6-033** [Durable acknowledgements and batching] Server assigns `task_id`, `action_id` and idempotency key.
- **R6-034** [Durable acknowledgements and batching] Agent persists action before performing it.
- **R6-035** [Durable acknowledgements and batching] Agent executes at most once for that idempotency key.
- **R6-036** [Durable acknowledgements and batching] Result receives a unique `receipt`.
- **R6-037** [Durable acknowledgements and batching] Result body gets a content hash.
- **R6-038** [Durable acknowledgements and batching] Agent writes result to a durable outbox.
- **R6-039** [Durable acknowledgements and batching] Exchange sends at most the server-advertised batch size.
- **R6-040** [Durable acknowledgements and batching] With the audited current contract, never send more than **20 results** in one exchange.
- **R6-041** [Durable acknowledgements and batching] Server transactionally persists the result.
- **R6-042** [Durable acknowledgements and batching] Server returns `action_id + receipt + outcome`.
- **R6-043** [Durable acknowledgements and batching] Agent removes an entry only when the returned receipt exactly matches the stored receipt.
- **R6-044** [Durable acknowledgements and batching] Lost acknowledgement causes the *same receipt* to be transmitted again.
- **R6-045** [Durable acknowledgements and batching] Server deduplicates the receipt instead of executing work again.
- **R6-046** [Durable acknowledgements and batching] STOP/Pause/control messages get a separate high-priority path so a giant result backlog cannot delay STOP.
- **R6-047** [Durable acknowledgements and batching] Exponential backoff with jitter is used for transient transport failure.
- **R6-048** [Durable acknowledgements and batching] Non-transient failures move to a dead-letter/error state rather than retrying forever.
- **R6-049** [Independent verification] \| TXT \| reopen from disk; exact/semantic text comparison; hash \|
- **R6-050** [Independent verification] \| DOCX \| parse package independently; confirm headings/tables/content; optionally render \|
- **R6-051** [Independent verification] \| XLSX \| reopen workbook package; confirm sheets/cells/formulas; use a calculation engine when calculated values matter \|
- **R6-052** [Independent verification] \| PDF \| parser confirms format/pages/text; render representative pages \|
- **R6-053** [Independent verification] \| Image \| independent decode; dimensions; expected changes; preserve original \|
- **R6-054** [Independent verification] \| Video \| `ffprobe` duration/resolution/streams; decode sample frames; confirm audio exists where required \|
- **R6-055** [Independent verification] \| Browser form \| independently query resulting DOM/server state \|
- **R6-056** [Independent verification] \| Windows app \| re-query UIA state and resulting filesystem/application state \|
- **R6-057** [Independent verification] \| Download \| MIME/signature/hash plus requested filename/content \|
- **R6-058** [MCPs, plugins and Windows runtimes to add] \| **`ocade.capabilities`** \| OCADE MCP: `search`, `get`, `health`, `refresh` \| Single source of truth for what this PC can actually do \| **P0** \| Local agent only; no admin required \|
- **R6-059** [MCPs, plugins and Windows runtimes to add] \| **`ocade.runtime`** \| Internal service/MCP read surface: `probe`, `versions`, `self_test` \| Detect Python, Node, FFmpeg, LibreOffice, browsers, Office and app capabilities *before* planning \| **P0** \| Absolute executable paths and pinned manifests \|
- **R6-060** [MCPs, plugins and Windows runtimes to add] \| **`ocade.files`** \| OCADE MCP: `list`, `read`, `write_atomic`, `copy`, `move`, `hash`, `stat` \| Reliable scoped file operations without GUI \| **P0** \| No broad disk access; workspace-root enforcement \|
- **R6-061** [MCPs, plugins and Windows runtimes to add] \| **`ocade.documents`** \| OCADE MCP over Open XML/document libraries \| Create/inspect DOCX, XLSX, PPTX directly \| **P0** \| Recommended .NET/Open XML or another pinned local implementation; exact runtime version unspecified. Microsoft's SDK is intended for Word/Excel/PowerPoint Open XML packages.  \|
- **R6-062** [MCPs, plugins and Windows runtimes to add] \| **`ocade.pdf`** \| OCADE MCP: `convert`, `inspect`, `render`, `verify` \| PDF creation/conversion/inspection \| **P0** \| LibreOffice headless where conversion is needed; patched PDF parser. LibreOffice exposes headless programmatic operation.  \|
- **R6-063** [MCPs, plugins and Windows runtimes to add] \| **`ocade.windows.uia`** \| OCADE MCP/client tools: `windows`, `find_element`, `invoke`, `set_value`, `select`, `wait_for`, `get_text` \| Reliable Windows application control \| **P0** \| Windows UI Automation through .NET/COM; no Python GUI package should be the only implementation.  \|
- **R6-064** [MCPs, plugins and Windows runtimes to add] \| **Playwright MCP / `ocade.browser`** \| Official `@playwright/mcp`; DOM/accessibility snapshots \| Primary web-page control \| **P0** \| Node.js **20+** for current Playwright MCP; compatible Chromium/Edge.  \|
- **R6-065** [MCPs, plugins and Windows runtimes to add] \| **OCADE Chrome/Edge Bridge** \| Manifest V3 extension + native messaging \| Securely associate an authorised browser/tab with the local agent \| **P0** \| Installed extension + native-messaging host; Edge and Chrome support native-app messaging.  \|
- **R6-066** [MCPs, plugins and Windows runtimes to add] \| **Chrome DevTools MCP** \| Official Chrome DevTools MCP, advanced mode \| Attach to an explicitly authorised existing Chrome debugging session \| **P1** \| Chrome's remote debugging must be enabled and connection authorised by the user.  \|
- **R6-067** [MCPs, plugins and Windows runtimes to add] \| **`ocade.media`** \| OCADE MCP wrapping FFmpeg/ffprobe and patched image library \| Video/audio/image transformations \| **P1** \| Pinned FFmpeg/ffprobe; patched image library. ffprobe provides machine-readable media inspection.  \|
- **R6-068** [MCPs, plugins and Windows runtimes to add] \| **`ocade.visual`** \| Provider-specific computer-use adapter \| Screenshot/mouse/keyboard fallback \| **P1 fallback only** \| Existing Windows input/screenshot layer; foreground-target verification \|
- **R6-069** [MCPs, plugins and Windows runtimes to add] \| **`ocade.verify`** \| OCADE MCP/internal service \| Independent artefact and final-state validation \| **P0** \| Parsers/renderers independent from the executor where practical \|
- **R6-070** [MCPs, plugins and Windows runtimes to add] \| **`ocade.transport`** \| Internal, **not exposed to model** \| Durable actions, receipts, idempotency, batching, STOP \| **P0** \| Persistent local DB/journal \|
- **R6-071** [MCPs, plugins and Windows runtimes to add] \| **`ocade.cloud-simulator`** \| Test-only MCP \| Deterministic fake filesystem/UI/browser/errors for provider testing \| **P2/test** \| No customer PC access \|
- **R6-072** [Runtime policy] Load OCADE's signed dependency manifest.
- **R6-073** [Runtime policy] Locate each dependency through configured absolute path.
- **R6-074** [Runtime policy] Verify executable signature/hash where OCADE packages it.
- **R6-075** [Runtime policy] Run a bounded `--version`/health probe.
- **R6-076** [Runtime policy] Record exact version and capability.
- **R6-077** [Runtime policy] Check minimum/maximum supported range.
- **R6-078** [Runtime policy] Record `AVAILABLE`, `DEGRADED` or `MISSING`.
- **R6-079** [Runtime policy] Expose that status to the capability registry.
- **R6-080** [Runtime policy] Never let the model select an unavailable capability.
- **R6-081** [Runtime policy] Offer a normal installer/update flow to the customer if a required component is genuinely missing.
- **R6-082** [Runtime policy] Never automatically elevate to Administrator because a model decided to.
- **R6-083** [Runtime policy] Refresh registry after an installation/update.
- **R6-084** [Task intake → plan → capability → execute → verify → acknowledge] **Receive the customer's request.**
- **R6-085** [Task intake → plan → capability → execute → verify → acknowledge] Resolve current user permissions.
- **R6-086** [Task intake → plan → capability → execute → verify → acknowledge] Classify requested side effects: read, write, browser action, app control, external submission, destructive action.
- **R6-087** [Task intake → plan → capability → execute → verify → acknowledge] Define machine-verifiable completion conditions.
- **R6-088** [Task intake → plan → capability → execute → verify → acknowledge] Snapshot the current capability registry.
- **R6-089** [Task intake → plan → capability → execute → verify → acknowledge] Remove unavailable or unauthorised tools.
- **R6-090** [Task intake → plan → capability → execute → verify → acknowledge] Send the AI the goal + available capability descriptions, not arbitrary access to the machine.
- **R6-091** [Task intake → plan → capability → execute → verify → acknowledge] For large catalogs, let the provider's tool-discovery mechanism find only relevant tools.
- **R6-092** [Task intake → plan → capability → execute → verify → acknowledge] Ask for a **structured execution plan**, not private chain-of-thought.
- **R6-093** [Task intake → plan → capability → execute → verify → acknowledge] Resolve every planned capability to one actual local implementation.
- **R6-094** [Task intake → plan → capability → execute → verify → acknowledge] Persist action before execution.
- **R6-095** [Task intake → plan → capability → execute → verify → acknowledge] Execute using the highest-quality control layer.
- **R6-096** [Task intake → plan → capability → execute → verify → acknowledge] Capture structured observations.
- **R6-097** [Task intake → plan → capability → execute → verify → acknowledge] Re-check target identity after state-changing actions.
- **R6-098** [Task intake → plan → capability → execute → verify → acknowledge] If action fails, return a typed error.
- **R6-099** [Task intake → plan → capability → execute → verify → acknowledge] Let the planner choose only an allowed fallback.
- **R6-100** [Task intake → plan → capability → execute → verify → acknowledge] Limit retries by step, time and cost.
- **R6-101** [Task intake → plan → capability → execute → verify → acknowledge] After artefacts exist, invoke `ocade.verify`.
- **R6-102** [Task intake → plan → capability → execute → verify → acknowledge] Verification must use independent observations.
- **R6-103** [Task intake → plan → capability → execute → verify → acknowledge] If verification fails, task returns to bounded recovery.
- **R6-104** [Task intake → plan → capability → execute → verify → acknowledge] If verification passes, write immutable verification evidence.
- **R6-105** [Task intake → plan → capability → execute → verify → acknowledge] Persist the result receipt locally.
- **R6-106** [Task intake → plan → capability → execute → verify → acknowledge] Send results in bounded batches—currently no more than 20 for the audited OCADE exchange contract.
- **R6-107** [Task intake → plan → capability → execute → verify → acknowledge] Server persists and returns exact receipt acknowledgement.
- **R6-108** [Task intake → plan → capability → execute → verify → acknowledge] Agent clears only exactly acknowledged receipts.
- **R6-109** [Task intake → plan → capability → execute → verify → acknowledge] PWA changes status to **Verified Complete**.
- **R6-110** [Task intake → plan → capability → execute → verify → acknowledge] User sees the artefacts and verification result.
- **R6-111** [Cloud-only simulation] Build the same OCADE local controller as a replaceable interface.
- **R6-112** [Cloud-only simulation] Implement a deterministic `FakeWindowsController`.
- **R6-113** [Cloud-only simulation] Implement fake browser, filesystem, document and media MCP servers.
- **R6-114** [Cloud-only simulation] Give them realistic state machines.
- **R6-115** [Cloud-only simulation] Inject errors such as missing FFmpeg, stale element, timeout, duplicated ACK, disconnected network and permission denial.
- **R6-116** [Cloud-only simulation] Run every provider against exactly the same task corpus.
- **R6-117** [Cloud-only simulation] Compare which tools each provider chooses.
- **R6-118** [Cloud-only simulation] Confirm no provider can bypass capability permissions.
- **R6-119** [Cloud-only simulation] Run browser workflows in isolated Playwright Chromium/Edge environments.
- **R6-120** [Cloud-only simulation] For genuine UI Automation tests, use an isolated **Windows** runner/VM; a Linux container cannot prove Windows UIA behaviour.
- **R6-121** [Cloud-only simulation] Test native file creation and verification in the runner.
- **R6-122** [Cloud-only simulation] Simulate agent/server disconnect immediately before and after a side effect.
- **R6-123** [Cloud-only simulation] Simulate lost acknowledgement and prove no duplicate execution.
- **R6-124** [Cloud-only simulation] Simulate STOP with a large outbox backlog.
- **R6-125** [Cloud-only simulation] Capture tool traces and timings.
- **R6-126** [Cloud-only simulation] Mark these results **CLOUD/SIMULATION PASS**.
- **R6-127** [Cloud-only simulation] Never convert that result into **REAL WINDOWS PASS** until the same scenario succeeds on an authorised physical/Windows environment.
- **R6-128** [Missing or unqualified OCADE pieces] \| **Reliable Python runtime resolution** \| Real task environment could not reliably invoke Python; Windows Store alias/`py` availability caused failure.  \| Bundle/register a known interpreter or absolute path; expose it through capability registry \|
- **R6-129** [Missing or unqualified OCADE pieces] \| **FFmpeg / ffprobe** \| Video attempt failed because FFmpeg was unavailable.  \| Package or require a pinned runtime; self-test at startup; add `ocade.media` \|
- **R6-130** [Missing or unqualified OCADE pieces] \| **LibreOffice converter** \| DOCX succeeded but PDF conversion failed because LibreOffice was absent.  \| Add explicit PDF conversion capability or another approved deterministic exporter \|
- **R6-131** [Missing or unqualified OCADE pieces] \| **Result batching** \| Candidate can send >20 retained results to a server schema capped at 20.  \| Bounded batches + replay/idempotency tests \|
- **R6-132** [Missing or unqualified OCADE pieces] \| **Durable receipt lifecycle** \| Receipt retention exists, but the backlog contract is unsafe at >20.  \| Transactional outbox and exact receipt ACK \|
- **R6-133** [Missing or unqualified OCADE pieces] \| **Windows DeepSeek path normalisation** \| Audited predicate fails Windows separator and sibling-boundary cases.  \| Normalise path representation and enforce segment boundaries \|
- **R6-134** [Missing or unqualified OCADE pieces] \| **Node/`npx` launcher** \| Bare `npx` Windows portability remains a partial finding.  \| Resolve Node/tool entry point via known absolute executable rather than shell lookup \|
- **R6-135** [Missing or unqualified OCADE pieces] \| **Pillow dependency** \| Audited `pillow==12.3.0` falls in current advisory ranges.  \| Select a supported patched release; exact replacement version not specified here \|
- **R6-136** [Missing or unqualified OCADE pieces] \| **pypdf dependency** \| Audited `pypdf==6.19.0` falls in current parser/resource advisories.  \| Patch and sandbox parsing with time/memory bounds \|
- **R6-137** [Missing or unqualified OCADE pieces] \| **Playwright MCP production integration** \| Real browser reliability remains unqualified in the plan.  \| Add dedicated structured browser capability and tests \|
- **R6-138** [Missing or unqualified OCADE pieces] \| **Chrome/Edge authorised bridge** \| Full existing-session control not release-qualified.  \| Signed extension/native-messaging bridge or explicitly approved DevTools connection \|
- **R6-139** [Missing or unqualified OCADE pieces] \| **Windows UI Automation layer** \| Real desktop control remains a release qualification target rather than established customer reliability.  \| Build target-aware UIA service \|
- **R6-140** [Missing or unqualified OCADE pieces] \| **Capability registry** \| Previous tasks discovered unavailable dependencies after execution had begun.  \| Central preflight registry \|
- **R6-141** [Missing or unqualified OCADE pieces] \| **Independent verifier coverage** \| Plan explicitly requires independently checked results; workflow qualification remains incomplete.  \| Separate verifier for every output family \|
- **R6-142** [Missing or unqualified OCADE pieces] \| **Candidate-vs-staging AI parity** \| Audit found available staging intelligence older than candidate source.  \| Version/health handshake before claiming candidate testing \|
- **R6-143** [Missing or unqualified OCADE pieces] \| **Offline model qualification** \| Plan/report evidence does not establish full real offline-inference qualification.  \| Separate offline download, integrity, inference, fallback and deletion tests \|
- **R6-144** [Integration tests developers should require] connection failure before upload;
- **R6-145** [Integration tests developers should require] failure after server persist but before agent receives ACK;
- **R6-146** [Integration tests developers should require] \| Tool-selection accuracy \| Did it pick the correct OCADE capability? \|
- **R6-147** [Integration tests developers should require] \| Unnecessary calls \| How many model/tool calls were wasted? \|
- **R6-148** [Integration tests developers should require] \| Fallback quality \| Did it select a sensible alternative? \|
- **R6-149** [Integration tests developers should require] \| Permission compliance \| Did it stay inside authorised tools? \|
- **R6-150** [Integration tests developers should require] \| False completion \| Did it ever say finished before verifier passed? \|
- **R6-151** [Integration tests developers should require] \| Model independence \| Does changing provider leave local execution behaviour unchanged? \|

### R7: Latest combined commercial synthesis (42 distinct source details)

- **R7-001** [What is wrong with the current OCADE] \| Current weakness \| What it means in practice \| Commercial consequence \|
- **R7-002** [What is wrong with the current OCADE] \| **Capability checking is too broad** \| OCADE may know “documents are supported” without knowing whether the exact PDF/video/spreadsheet operation is healthy right now. \| Failures appear halfway through tasks. \|
- **R7-003** [What is wrong with the current OCADE] \| **Routing is not deterministic enough** \| The model is encouraged to prefer better tools, but the runtime does not always strictly enforce the optimal route. \| Same request can take a slower or less reliable path. \|
- **R7-004** [What is wrong with the current OCADE] \| **Plans are too static conceptually** \| An initial plan cannot predict every formatting correction, popup, missing fact or broken output. \| Complex work ends incomplete. \|
- **R7-005** [What is wrong with the current OCADE] \| **Verification is too weak in places** \| “File exists” can be mistaken for “user's requested result is correct.” \| False completion. \|
- **R7-006** [What is wrong with the current OCADE] \| **Window/document identity can be ambiguous** \| Similar window titles can cause the wrong target to be selected. \| Potentially serious wrong-document edits. \|
- **R7-007** [What is wrong with the current OCADE] \| **Long-task communication has a known mismatch** \| The audit found the device can accumulate more results than the server accepts in one exchange. \| Delays, stuck work and control-message problems. \|
- **R7-008** [What is wrong with the current OCADE] \| **STOP is not completely independent of work execution** \| Some blocking operations can make cancellation slow. \| Poor user control and safety. \|
- **R7-009** [What is wrong with the current OCADE] \| **Repeated AI/screenshot loops cost time** \| Tiny deterministic actions can unnecessarily require another model round trip. \| Slow control and higher cost. \|
- **R7-010** [What is wrong with the current OCADE] \| **Security defects remain** \| The audit identified vulnerable dependencies and other security/configuration problems. \| Launch blocker. \|
- **R7-011** [What is wrong with the current OCADE] \| **Production parity is not proven** \| The audit found environment/version drift and incomplete native Windows validation. \| A passing test may not represent the shipping product. \|
- **R7-012** [The commercial build plan] \| Order \| Workstream \| What must be completed before moving on \|
- **R7-013** [The commercial build plan] \| **Foundation** \| Remove known critical bugs, dependency vulnerabilities, environment drift and transport defects. \| Clean security/dependency checks; result transport stable; exact candidate build identifiable. \|
- **R7-014** [The commercial build plan] \| **Execution core** \| Implement outcome contracts, operation-level capability health, deterministic routing, exact target identity and independent verification. \| Same task repeatedly chooses the correct control method and target. \|
- **R7-015** [The commercial build plan] \| **Adaptive autonomy** \| Dynamic milestones, microstep creation, targeted repair, bounded retries, checkpoints and recovery. \| Unexpected conditions no longer require restarting whole tasks. \|
- **R7-016** [The commercial build plan] \| **Fast PC control** \| Direct operations, Playwright/browser control, Windows UIA, vision fallback, action batching and state-diff observation. \| Supported task families meet latency and reliability targets. \|
- **R7-017** [The commercial build plan] \| **Long-task engine** \| Durable task state, STOP/Pause/Resume/Take Over, cancellation, retries and crash/network recovery. \| Power/network/provider interruption tests pass without duplicate side effects. \|
- **R7-018** [The commercial build plan] \| **Professional outputs** \| Domain-specific quality profiles for PDF, Word, spreadsheet, presentation, image, video, browser and general desktop work. \| Outputs satisfy semantic and visual acceptance checks. \|
- **R7-019** [The commercial build plan] \| **Product experience** \| Simplify Chat/JARVIS, Files, Devices, Settings, authentication, onboarding, billing and progress UX. \| No dead controls, confusing states or inaccessible critical workflows. \|
- **R7-020** [The commercial build plan] \| **Security and privacy** \| Tenant isolation, permissions, secrets, file safety, prompt-injection defence, confirmation boundaries, audit logs and deletion/export. \| Security gate and adversarial tests pass. \|
- **R7-021** [The commercial build plan] \| **Commercial systems** \| Billing, entitlements, usage metering, support, analytics, privacy/legal material and operational controls. \| Failed/stopped work is not incorrectly charged; customer/account lifecycle works. \|
- **R7-022** [The commercial build plan] \| **Release proof** \| Full cloud browser + cloud Windows matrix, performance, accessibility, security, endurance and competitive benchmark. \| Every mandatory gate passes on the exact release candidate. \|
- **R7-023** [Every major page family] \| **Chat/JARVIS** \| One obvious input; attachments; mode selection when genuinely necessary; STOP prominent while working; clear result delivery. \|
- **R7-024** [Every major page family] \| **Task progress** \| Show simple states such as **Planning → Opening → Working → Checking → Fixing → Waiting for you → Completed**. \|
- **R7-025** [Every major page family] \| **Files/results** \| Preview, open and download the actual generated artefact; identify version and completion status. \|
- **R7-026** [Every major page family] \| **Devices** \| Clear paired-device state, permissions, revoke, reconnect, last-seen and capability health. \|
- **R7-027** [Every major page family] \| **Settings** \| Grouped, understandable options rather than exposing implementation complexity. \|
- **R7-028** [Every major page family] \| **Authentication** \| Reliable sign-in, recovery and session handling without confusing loops. \|
- **R7-029** [Every major page family] \| **Onboarding** \| Explain what JARVIS can control, what permissions it requires and when confirmation is required. \|
- **R7-030** [Every major page family] \| **Billing** \| Plan, limits, usage, invoices and entitlement state should be understandable before a user pays. \|
- **R7-031** [Every major page family] \| **Offline mode** \| Clearly communicate which capabilities remain available without cloud services. \|
- **R7-032** [Every major page family] \| **Admin/operations** \| Health, failures, releases, security events, usage and support tooling must be available to authorised staff only. \|
- **R7-033** [Mandatory launch benchmarks] \| **Professional document** \| Research → structured document → visual quality → correct PDF → citations/content independently checked. \|
- **R7-034** [Mandatory launch benchmarks] \| **Spreadsheet** \| Import/edit/formulas/recalculation/charts/export; numerical results independently recomputed. \|
- **R7-035** [Mandatory launch benchmarks] \| **Video** \| Inspect media → discover defects → edit → audio/subtitles/layout → export → inspect finished render. \|
- **R7-036** [Mandatory launch benchmarks] \| **Browser** \| Multi-page authenticated workflow, dynamic UI, downloads/uploads, popups and recovery. \|
- **R7-037** [Mandatory launch benchmarks] \| **Desktop applications** \| Correct application/window/document selected across multiple simultaneous windows. \|
- **R7-038** [Mandatory launch benchmarks] \| **Unknown software** \| UIA first, vision fallback where necessary, without app-specific hard-coded instructions. \|
- **R7-039** [Mandatory launch benchmarks] \| **Long-running task** \| Pause/resume/network interruption/provider failure/restart without duplicated irreversible actions. \|
- **R7-040** [Mandatory launch benchmarks] \| **STOP** \| Control request interrupts promptly even under load or a failing worker. \|
- **R7-041** [Mandatory launch benchmarks] \| **Adversarial content** \| Malicious webpage/document attempts to redirect the agent outside the user's authority. \|
- **R7-042** [Mandatory launch benchmarks] \| **Failure-repair** \| Deliberately introduce a defect; agent detects it, diagnoses it, repairs only affected work and verifies again. \|

**Final audit:** Every R-ID, every RC01–RC17, original requirement #1–200, supplements A–J, and each discovered page/control/action must have one canonical task, owner, test, evidence path and unresolved status. Automated cloud tests do not grant permission to deploy, spend, access production secrets, contact users or bypass customer consent.
