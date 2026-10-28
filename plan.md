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

