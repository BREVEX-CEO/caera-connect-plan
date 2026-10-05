# Full Error Audit Ledger

## Audit identity and constraints
- Repository: `BREVEX-CEO/caera-connect-plan`.
- Audited main SHA: `f277408aaaf5381c949bb62119d84f7fa57ffb09` (GitHub connector and local Git; HEAD and `git ls-remote origin refs/heads/main` reverified unchanged2026-10-05).
- Scope: strict read-only product audit. Only this file and `PONYTAIL_DEBLOAT_LEDGER.md` may change in the repository. Disposable build/test artifacts are permitted. No fixes, deployments, migrations, production mutations, or cleanup.
- Existing clean disposable checkout recovered from the interrupted audit chat. Its logs are historical evidence until explicitly cross-checked; previous claims are not current passes.
- Status: **IN PROGRESS / PARTIAL**. Not a finished full audit. No claim of zero bugs or release readiness.
- Authority: the latest explicit audit request overrides older implementation/fix/deploy instructions. The requested final ledger-only push to main is explicitly authorized, after the audit is complete.


## Evidence rules
PASS means only the named check passed. FAIL means reproduced unexpected behavior. PARTIAL means incomplete evidence. BLOCKED names the unavailable prerequisite. UNTESTED means no executed evidence. Severity: Critical = immediate severe security/data-loss exposure; Major = release-scope capability or required gate fails; Minor = limited UX/maintenance defect. Environment failures are separately labeled and do not automatically prove a product bug.


## Current coverage
| Area | Status | Evidence / remaining work |
| --- | --- | --- |
| Latest main / clean baseline | PASS | Local HEAD and origin/main match the audited SHA;974 baseline tracked files. Current tracked diff empty; only the two permitted ledgers untracked. No ledger commit/push yet. |
| Authority read | PASS | Root AGENTS.md, CLAUDE.md, ToRemove.md, entire PLAN.md through Phase 56; canonical company/product, device/mobile, Owner/Admin, toolchain, orchestration, PRD/TRD/architecture/flow/design/schema/rules/testing/memory authorities; imported donor preservation authority read. Historical instructions do not authorize product changes. |
| First complete file-by-file source read | PASS | 974/974 baseline tracked files fully read or explicitly decoded/inspected as binary/structured artifacts, reconciled2026-10-04. Runtime/Android, all302src, all412Supabase, support195 and authority ownership manifests resolve to zero remaining paths. Binary inspection is not editable binary-source or physical platform proof. |
| Windows / PC control | PARTIAL | Native inventory, isolated actual --health and idle-Agent/STOP lifecycle plus eight synthetic support checks passed. Active foreground/tray/control/install/update/background/native voice remains UNTESTED or BLOCKED by unknown installed-agent side effects; hardware is available. |
| Gemini/OCADE universal control | PARTIAL | Ordinary mocked planner/JARVIS tests and local fixture text/history coverage executed. Actual provider-to-executor-to-observed-result workflow remains UNTESTED; no live provider/control actions performed. |
| Browser / Chrome | PARTIAL | Local exact-main fixture chat, Library, settings, public pages, Owner layouts, dialogs and named states exercised; deployed signed-in page read-only checkpoint recorded. Real customer role/provider workflows and full reachable-state coverage remain incomplete. |
| Android / mobile | PARTIAL | Android14 Pixel_6a emulator online; passive installed development APK inventory and environment Wait performed. Chrome public URL reached address bar, then readable screenshot/hierarchy failed0xffffffff. Native launch BLOCKED by unknown saved pairing/wake side effects; physical Android absent/BLOCKED. APK asset alignment does not prove full DEX/main alignment. |
| Responsive / mobile web | PARTIAL | Local desktop browser CSS320/374-width views and responsive named pages showed no horizontal overflow. Same-path drawer source defect F123 and focus F048 remain. Desktop viewport evidence does not prove physical mobile behavior. |
| macOS / iOS | BLOCKED | No local Apple device/simulator or xcrun/simctl/idevice tools exposed. Remote inventory refuses without provider login; no account/allocation performed. Windows WebKit/viewport emulation cannot prove physical Apple behavior. |
| Wake / voice | FAIL | F-001 clean-checkout desktop signature rejection reproduced; F-002 Android signature omission cross-checked. Physical listening/voice remains untested. |
| Owner / Staff / usage | PARTIAL | Complete first source read; local Owner fixture with six Staff layouts, ordinary usage tests and named UI/source findings recorded. Real signed-in role/permission/account workflows remain UNTESTED/BLOCKED; fixture layout evidence does not establish authorization. |
| Devices | PARTIAL | Complete first source read, local empty-device drawer/forms and isolated idle agent lifecycle. Real paired device enrollment, control, revoke, wake and background lifecycle remain UNTESTED/BLOCKED. |
| Background / Remote PC | PARTIAL | First source read complete; deployed service endpoint absent404 (F-060). Physical paired/background/provider workflow not proved. |
| Security / auth / isolation | PARTIAL | Passive complete first source read and specifically named defensive/local evidence in findings; additional exploitation/security reproduction workflows rejected by safeguards and remain BLOCKED. Hosted customer isolation/auth behavior not inferred from metadata or mocks. |
| Supabase / Cloudflare / deployment | PARTIAL | Supabase ACTIVE_HEALTHY, hostedPostgres17.6,40publictablesRLS-enabled,138migrationentries, oneJWT-verified ocade-intelligence function. Read-only advisories and service404 recorded. Local136migration+verifier checks PASS onPGlite18.3, not hosted execution. Cloudflare privileged evidence remains unavailable; deployment/provider readiness pending. |
| Performance / resources | PARTIAL | Bounded-read fixture F008, source resource findings and two local cached/reload traces recorded without observed tasks over50ms during their measured intervals. Cold landing TBT/TTI, sustained resource use and native load remain UNTESTED; traces do not establish the200ms landing TBT budget. |
| Second full source audit | PARTIAL | 562/974 complete: src297, support177 and root88 (original77 plus11 delegated paths). All available ordinary second reads complete; zero PENDING. Remaining412 Supabase second reads are BLOCKED by rejected automatic-review dispatch; no retry/workaround. First-pass coverage does not substitute for this second pass. |


### Practical coverage checkpoint — 2026-10-04
- PASS: direct TypeScript `tsc --noEmit`, exit0, fresh disposable exact-main practical checkout. Avoided the npm typecheck wrapper that regenerates tracked route source.
- PASS: ESLint read-only invocation without --fix, exit0, same clean practical copy. No product edits.
- PASS: fresh ordinary isolated Vitest run,26testfiles/267tests,0failure/skip/pending/todo,5.02seconds; brain/chat, router/online-client, pricing/clock, release and ordinary JARVIS agent/graph/schedule cases. Exact command/files/report digest and clean post-test diff recorded in disposable ordinary-unit-provenance.json. Auth/authorization/exploitation and broad database suites excluded/BLOCKED; this is not full-suite proof.
- PASS / local only: production build compiled against disposable loopback stub, generated Cloudflare-module output and served on127.0.0.1:8788. Build copied source remains byte-identical under git diff. Actual browser UI coverage follows; no deployment or provider readiness inferred.
- PARTIAL / environment warning: Windows harness Node DEP0190 warns about child-process shell argument composition (`scripts/e2e/harness.mjs` build spawn). Current arguments are fixed run/build strings; no untrusted-input injection or product defect demonstrated. Runtime warning retained for future shell-free npm-CLI invocation review; no harness edits.
- BLOCKED / Android environment: emulator has in.ocade.app0.1.0 and Chrome, but foreground detection fails twice and passive window state reports SystemUI Application Not Responding. OS-level emulator instability is not an OCADE defect; no restart/dismiss/permission/install performed. Installed APK/source SHA alignment remains UNVERIFIED.
- PASS: latest remote main rechecked with git ls-remote, still f277408aaaf5381c949bb62119d84f7fa57ffb09. Deliverable repository tracked diff remains empty; only the two permitted ledgers are untracked.
- PASS (availability only): Windows11 native app inventory, installed Chrome/Edge, available Android14 Pixel_6a emulator. Physical Android and Apple evidence BLOCKED; actual product control remains unproved.
- PARTIAL: all974 first-pass baseline files accounted for; complete practical route/control/state coverage and second974-file pass remain outstanding.
- Isolation: new disposable `work/practical-checkout` contains the exact audited main for build/test artifacts. Existing dependencies reused without install/update. No deployment, migration, provider request or production mutation authorized/executed.
- BLOCKED: broad additional security/exploitation reproduction workflows rejected by tool safeguards. Passive source review and ordinary mocked correctness/UX/resource checks continue; blocked evidence never counts as PASS.


## Measured first-pass checkpoint — 2026-10-04
At the latest reconciled snapshot, first pass **974/974 files,100% complete/0% remaining**; second pass **562/974 files,57.7% complete/42.3% remaining (412 files)**. All available independent ordinary source reads and practical checks are exhausted; zero ordinary reads PENDING. The remaining412 second-pass files are BLOCKED by automatic review, not inaccessible source. Required platform/customer/provider/deployment evidence remains BLOCKED/UNTESTED, so the entire requested audit is INCOMPLETE. Both-ledger accuracy reconciliation is complete against the available source and evidence manifests. Ledger-only commit/push remains pending because the audit-completion condition is unmet. Binary/source evidence does not prove physical platform behavior; exact manifests and isolated fixtures remain in disposable current-chat work/. No rejected security workflow was retried or worked around.


### Browser practical continuation — local fixture
- **PASS:** harmless JARVIS fixture message streams explicit stub answer, empties composer, persists history, updates27/28 allowance, and reopens after New conversation. Graph count updates, zoom controls and focus/expand views respond. This proves local transport/UI only; Gemini/OCADE actual provider and universal physical control remain BLOCKED.
- **PASS:** actual CSS320 viewport shows JARVIS shell, navigation and Devices drawer without horizontal document overflow; Settings dialog fits x0..320. Requested viewport numbers differ by4/3 from measured CSS width under the existing browser scaling; adjusted disposable override yields measured320. Initial measured500/426 were not silently counted as375/320 evidence. No product defect from browser scaling.
- **PASS:** mobile Library empty All/Images filter and search controls render with document width320.
- **BLOCKED:** local Library disposable-text upload chooser opened, but extension rejected file access because Allow access to file URLs is disabled. No extension permissions changed and no upload occurred. Preview/open/download for newly added browser files remain untested unless another legitimate fixture route becomes available. Product upload correctness is not disproved by this environment restriction.


### Public pages, local roles and fixture chat coverage — 2026-10-04
- **PASS:** Help25accordions each open/close with aria-expanded and rendered answer text; eight topic filters return corresponding FAQ groups; recovery codes search finds its answer. **FAIL:** answer-only captcha search missing (F064 browser-confirmed); outdated mode label F108; contact guidance loop F109.
- **PASS:** public About and Pricing navigation, Terms26sections and Privacy15sections render at measuredCSS320 without horizontal overflow; legal-page Back to top returns scrollY0. Pricing8combinations of weekly/monthly and USD/EUR/GBP/INR display the corresponding existing rate map; no purchase controls or charges executed.
- **PASS, fixture transport only:** Temporary Online chat answers, edit cancel, regenerate and changed-question edit render correctly; leaving/reopening landing clears temporary content. Mobile bubble expands to Ask JARVIS and collapse/full-view controls; voice capture/provider/permission behavior untested.
- **PASS, fixture UI only:** persisted Library seeded text appears with62B, Files/name search includes it and Images excludes it with No matches. This does not prove browser upload or real Storage. Open/download remains PARTIAL F091 with no observed successful destination.
- **PASS, fixture UI only:** Primary Owner account shows Unlimited use and Owner Console; Customers list, positive/negative search, customer summary, access-form preview/cancel, Cases empty queue, Staff own usage, System meters and Audit empty view render. Empty reason fields leave change controls disabled; no grant, revocation, suspension, deletion, recovery or global service control submitted. CSS320 Owner layout fits document width.
- **PASS, fixture UI only:** Support account shows Staff Console with Customers/Cases layouts, customer empty task/device summary and case queue. Protected-route sign-out reaches normal auth next=/admin; a deliberately concurrent goto was aborted by that redirect and settled correctly, an automation sequencing event, not a product defect.
- **PARTIAL:** these role fixtures use documented loopback stub accounts and do not establish deployed role enforcement, live account isolation or production operations. Security execution rejected earlier remains BLOCKED. Other role/populated/error/confirmed mutation states remain explicitly untested until individually covered.


### Fresh deployed identity/read-only browser checkpoint — 2026-10-04
- **PASS, liveness/identity only:** public GET https://ocade.in/api/health returns200/statusok, commit f277408aaaf5381c949bb62119d84f7fa57ffb09, deployment e6b2d5ea-49b5-46ff-9635-6ef241459390, supabasePublic/supabaseServer/modelDelivery/offlineLeases true. Scope explicitly liveness; no provider, object, authorization or account workflow readiness inferred. Exact response work/deployed-health-20261004.json.
- **PASS:** origin/main still auditedf277 SHA and deliverable checkout tracked diff empty; only two ledgers untracked.
- **PARTIAL:** fresh Chrome production tab initially rendered unsigned controls, then restored an existing browser-profile Owner session. No credentials entered and no new login performed. Initial SSR shell is not a guest-enforcement test. Existing account content was not opened, submitted, edited, deleted or exported. Production mutation tests remain excluded by strict Supabase/runtime read-only scope; use disposable fixtures for changes.


- Browser environment cross-check: in-app browser also restores the same existing production session; it is not an independent guest profile. No real session was signed out or modified to manufacture guest evidence. Hosted guest/auth enforcement remains BLOCKED by available isolated-session evidence, with local normal-auth fixture coverage separate.
- Performance **PARTIAL**: supported CDP resource snapshot on production landing/Help observes one document/frame, no audio or RTC objects; landing usedJSheap10,706,140bytes/669nodes, Help8,858,248bytes/265nodes after navigation. Help measured navigation-to-DOMContentLoaded~575ms and firstMeaningfulPaint~753ms, script160ms/task421ms over observation. One trace contains239events including ParseHTML90.882ms but no top-level RunTask events under initial categories; zero matching tasks is NOT zero blocking time. Lighthouse TBT/200ms-budget assessment and sustained resource-growth evidence remain UNTESTED. Temporary diagnostic collection was stopped/disabled after readout; no page content or product state changed.
- Android blocker cross-check2026-10-04: current dedicated mobile hierarchy now succeeds and explicitly shows System UI is not responding with Close app/Wait. This confirms OS dialog rather than an OCADE error. A bounded Wait dismissal is the next ordinary UI test step; no app close/restart/install/permission or OS setting change is authorized/executed.


### Android practical environment continuation — 2026-10-04
- **PASS, environment only:** selecting the OS dialog's Wait action dismissed the SystemUI ANR and exposed launcher; no app close/restart/install/settings change performed. This makes the earlier blanket foreground blocker historical rather than a claim that every later attempt failed.
- **PARTIAL:** normal Android Chrome URL opening reaches secure https://ocade.in/help address bar on Android14 emulator. The hierarchy exposes only Chrome Web View, not product content; no Help render/interaction PASS claimed. Screenshot tool then fails0xffffffff and independent subsequent UI hierarchy dump fails0xffffffff. Product visual/control evidence therefore remains **BLOCKED** by current device automation/environment reliability. No OS repair/restart attempted.
- **BLOCKED, strict read-only native launch:** installed OCADE pairing/wake state is unknown. Passive source cross-check `android/src/in/ocade/app/MainActivity.java:104-110` starts AgentService when connected/waiting and WakeService for saved wake+microphone. `AgentService.java:54-65,145-155` creates foreground UI/bubble and posts saved-server capabilities/apps/heartbeat. No read-only launch mode exists; debug server extra writes persistent settings. Launch cannot be guaranteed to preserve live Supabase/runtime state, so not executed. Private keys/preferences not read or changed. This is a test-scope/environment limitation, not a new native bug.
- Physical Android and physical/simulator Apple evidence remain **BLOCKED**; emulator numerical/asset checks never count as physical proof.


### Local Library and Windows readiness continuation — 2026-10-04
- **PASS, disposable fixture only:** in-app browser normal guest Library navigation redirects to auth next=/library; normal documented fixture password sign-in returns to Library. Actual file chooser upload of work/audit-fixture-note.txt succeeds and displays80B. This resolves the Chrome extension file-access blocker for this text-only local test; no hosted Storage or binary preview correctness inferred.
- **PARTIAL F091 clarification:** actual in-app browser Open emits Page.windowOpen with userGesture=true, target _blank, noopener features and destination origin127.0.0.1:54321. Signing/opening was attempted with an active gesture; no new controlled tab/download was observed. Do not attribute this observation to lost activation, production Storage failure or popup blocking without further evidence. Supported browser popup observation limitations remain possible. Page.disable diagnostic command was unsupported; no product mutation followed.
- **PASS:** unknown local route renders404 and Open Chat recovery. No product error inferred from intentional absent route.
- **PASS, bounded native readiness only:** actual Device Agent --health __main__ exits0 in1.281s with no stdout/stderr, external sockets, subprocess or registry writes under the scratch containment observer. Existing COM generated cache redirected to disposable work; no readiness mocks. Evidence work/actual-health-fixture/results.json and practical-actual-health.py. This proves import/resource/native-constructor readiness, not tray, physical control, wake, pairing or normal background startup; F001 remains unresolved.
- Practical cross-check2026-10-04: actual idle Agent.run worker exits0 after fixture STOP exchange, yet its owned ocade-egress thread remains alive before harness-only explicit shutdown/server_close. work/idle-stop-fixture/results.json records proxyAliveAfterWorkerExit=true. This upgrades F112 to bounded lifecycle FAIL; actual embedded repeated growth remains unmeasured. Harness releases proxy/stub and joins all three owned threads with zero cleanup errors.


### Text attachment and idle Windows coverage continuation — 2026-10-04
- **PASS, fixture UI/transport only:** actual in-app browser chooser attaches80B disposable text, Remove clears the unsent chip, reattachment and ordinary Online question send succeed. Response explicitly identifies itself as stubbed and includes filename plus SILVER content; sent-file link points to Library, composer clears and usage25→24/28. This proves local text attachment plumbing, not real-provider reasoning or binary preview fidelity. No product/customer content changed.
- **PASS, isolated idle runtime only:** actual fixture Identity persistence and two empty-command Agent heartbeat exchanges reach Ready; stop_everything synchronously sets cancellation, next own-loopback exchange sends stop=true, response clears stop_all and worker exits0 in5.703s. Host apps/browser/GUI probes are doubled; tools/enrollment/rotation/background calls0. No external connection, registry write, host input or real pairing. F112 lifecycle remains FAIL despite functional idle STOP PASS; active task cancellation and actual physical PC control remain separate incomplete evidence.


### Remaining ordinary tests and safe settings coverage — 2026-10-04
- **PASS, pure/mock/fs-only:**97additional tests across14safe remaining candidate files. Cumulative493PASS/0FAIL in53distinct files,43whole-file plus10partial selections.66intentionally unselected cases and56unrun auth/security/SQL files remain explicitly BLOCKED/excluded, not passed. Exact names/commands/scopes and empty tracked/cached diffs in work/ordinary-extra-unit-provenance.json. No live provider/SQL/account/storage effects.
- **PASS, fixture preview only:** Account and Privacy settings render email/MFA/delete/export/session/offline controls and correct fixture record counts; no credentials, MFA, deletion, model removal, export of real data or session revocation submitted. Visible close-icon dismisses settings. Selecting the full-screen backdrop's semantic center landed on the covering panel; source confirms absolute inset backdrop and covering relative panel. This automation targeting result is not a broken close-icon finding.
- **PARTIAL, performance:** full deployed reload trace captures292events/90top-level tasks with no >50ms task before visible composer, no truncation or pending events. Capture ends at composer visibility and may precede all hydration; cache not disabled and no cold Lighthouse/TTI window. This bounded observation does not establish200ms TBT compliance. Diagnostic trace stopped.


## Practical phase closure and exact evidence limits — 2026-10-04
Available ordinary local UI, build/static gates, pure/mock tests, read-only hosted identity/metadata and bounded platform checks are now exhausted under the strict scope and currently usable environments. This closes the practical investigation phase so the required second complete source review can start. It does **not** turn unavailable or excluded customer/platform states into PASS, certify every production control, or claim full required evidence/readiness.

- Windows/PC control, background/Remote PC, universal Gemini/OCADE: **PARTIAL** actual health and idle source runtime; real companion foreground/control/tray, long-running remote tasks, Take Over/Co-work, host actions and active STOP remain **BLOCKED/UNTESTED**. Normal installed startup can use existing identity/state, fixed singleton port, tray/wake/inventory/service paths; no verified side-effect-free customer startup exists. Host tools are available, hardware is not falsely called unavailable. No real account/device pairing, provider work, inventory upload or Supabase usage mutation undertaken.
- Wake/voice: **FAIL** signature/cleanup/input-path findings separately recorded; synthetic math and fake UI checks **PASS**. Real microphone/utterance/noise/TTS/audio-device/background accuracy **BLOCKED/UNTESTED** without isolated audio/device evidence; no simulated speech is represented as trained physical wake proof.
- Browser/Chrome/responsive: **PASS/PARTIAL/FAIL** are per observations above: Chat/JARVIS/Library/settings/public legal/help/pricing/Owner and six staff-role fixtures,320/374CSS widths, normal auth, model-source failure, safe menus/forms/drawers. Research toggles true/false; archive creates reachable Archived group and Unarchive returns Today; Delete first press shows Delete for good and outside click cancels without deletion. Rename preview/Escape works. Download/export outcomes remain PARTIAL F091/F113. Real OAuth, challenge/recovery/verification completion and credentials/MFA/session enforcement remain **BLOCKED**, not proven by local sign-in or route rendering. Production browser has an existing Owner session, no independent guest profile.
- Route inventory:23tracked route files, including layout/root wrappers; public user pages /, /about, /help, /pricing, /privacy, /terms; product /ocade-jarvis, /library, /admin and safe auth form have actual fixture coverage. Callback/challenge/verify/reset lifecycle completion, device enroll/exchange/continue, signed offline bytes and agent distribution routes have source/selected ordinary tests only where recorded; real credential/provider/paired-device/signature enforcement or distribution installation remains BLOCKED. Intentional404 recovery passes. Source/test evidence is not a browser flow PASS.
- Android/mobile: emulator inventory and passive APK asset checks **PARTIAL**, SystemUI Wait **PASS environment only**, public Chrome URL reached address bar only then screenshot/hierarchy failed0xffffffff; readable product control proof **BLOCKED**. Native launch **BLOCKED** by unknown saved live pairing/wake side effects, physical phone absent. Mobile desktop CSS tests never substitute for installed/native/ARM/Doze/microphone evidence.
- iOS/macOS: **BLOCKED** no connected physical Apple device, simulator, macOS host or logged-in remote provider. No notarization/TCC/Safari/native-wake/control/notification/background/update proof fabricated.
- Owner/Staff/Devices/usage/auth/account isolation: role-layout and empty/form-preview/local allowance changes **PASS/PARTIAL** only. Real customer grants/suspension/recovery/deletion/export, MFA/access expansion, live paired devices and tenant enforcement **BLOCKED/excluded** under strict live-state scope and prior safeguard rejection. Existing source findings remain; no further exploitation or vulnerability reproduction attempted.
- Supabase/Cloudflare/deployment: live Supabase metadata/advisors and liveness identity **PASS/PARTIAL** only; missing deployed background function F060 **FAIL**. Cloudflare privileged connector metadata unavailable **BLOCKED**; no deployment/migration/config changes. Genuine multi-session PostgreSQL rollback/reapply and customer isolation proof **BLOCKED**, narrow prior disposable migration evidence remains separate.
- Performance/resources/update/rollback: local build and selected bounds/ordinary checks **PASS**, bounded browser timing **PARTIAL**, actual retained proxy F112 **FAIL**. Cold Lighthouse200msTBT, sustained heap/thread growth, constrained physical model loading and signed installed update/rollback/uninstall **BLOCKED/UNTESTED**; no settings/install changes or load/exhaustion stress.
- Test total:493ordinary PASS,0ordinary FAIL,53of109testfiles selected (43whole/10partial),66intentional unselected cases plus56unrun security/auth/SQL files. This is not a full-suite green result. Five static gates PASS/four FAIL; full verification fails F010/F011/F012/F107. Other excluded security/host-effect/runtime tests retain explicit limitations in provenance/platform inventory.

Current remaining scope, updated2026-10-05:412 BLOCKED second-pass files plus the explicitly BLOCKED/UNTESTED required platform/customer/provider/deployment evidence. All independent ordinary reads/checks are complete. Entire requested audit completion and ledger-only commit/push are still pending; source coverage alone cannot establish full user/platform readiness. No product fixes or cleanup performed.


### Second-pass coverage extensions
- Known deferred provider coverage: docs/DEFERRED_GEMINI_ISSUES.md G1-G10 are historical preview observations concerning routing, MAX_MODEL_STEPS, text tool calls, false completion/export, stale APIs, coordinates, confirmation burden, Qt controls, duplicate launch and missing real-model matrix. Status PARTIAL/UNTESTED for current evidence; dated mitigations are neither current reproduced findings nor PASS. Existing F107 formatting defect is independent. No ten invented current bugs counted.


### Root second-pass coverage — 2026-10-05
- Additional READ COMPLETE: disjoint five-file handoff from src reviewer confirmed before reading: src/lib/notifications/categories.ts118lines, channels.ts102, delivery.ts119, history.ts93 and preference-sync.ts132. All fully read by root; original root77 assignment remains complete. F214/F218 and related D015 ownership opportunity recorded immediately; actual notification/provider/backend behavior remains unexecuted. Original302-file src assignment denominator stays unchanged with these five delegated reads reconciled by path union.
- READ COMPLETE: all77 root-assigned baseline files. This comprises all15 android/ files; all48 jarvis-runtime/ files including packaging, runtime adapters, protocol/config, wake assets and every retained test/manual script; and all14 public/ files including service worker, offline page, manifest, font licenses and binary assets. Complete source read is inspection coverage, not a runtime behavior PASS. Existing findings were extended rather than duplicated.
- PASS structure/decode only: all nine assigned binaries. Both ICO files fully decoded (runtime six embedded sizes, public favicon three); PNGs fully decoded/verified and four original images visually inspected (Apple180x180, OG1200x630, app192x192 and512x512). The soft512 icon is a conditional quality opportunity under D011, not a corrupt-image failure.
- PASS structure/decode only: wake NPZ ZIP CRC and all16 arrays inspected for dtype/shape/finite values, positive standard deviations and threshold. No inference, audio capture or signature bypass. Wake release failures F001/F002 remain independent.
- PASS structure/decode only: Inter22 font tables/518 glyphs/230 cmap entries, variable weight100-900; JetBrains Mono21 tables/394 glyphs/229 cmap entries, weight100-800 fully decompiled. Disposable inspection adapter used existing Node zlib Brotli with fontTools; no dependency installation or product runtime modification. Font structure/license reads do not establish legal or physical rendering certification.
- Additional ordinary service-worker fixtures executed against unchanged main: fetch delivery controls two PASS; failed cache-persistence cases two FAIL (F191). Install/activate missing-first-paint fixture PARTIAL (F194). These results are separate from the previously recorded493 ordinary unit-test passes and do not increase that count.
- Exact per-path read metadata and binary digests are retained in disposable root-second-pass-coverage.json and root-binary-second-evidence.json. Native Windows active control, physical mobile/Apple, provider, hosted authorization and sustained resource evidence remain explicitly unproved. No product fixes, cleanup, deployments or migration writes occurred.

2026-10-04: resumed without restarting completed work. Authority read and runtime/Android first pass complete; Supabase first pass412/412 and public/API handoff14/14 complete. Root legal/admin/library/styles and auth routes complete. Remaining reviewer/test/document paths are recorded in exact disposable manifests. No full practical suite or second complete pass is finished. No product edits, deployments or cleanup; ledger-only commit/push remains pending until required audit work is complete.


### Historical implementation handoff second-read coverage2026-10-05
- COMPLETE source/document read: docs/audits/2026-09-27-jarvis/OCADE-JARVIS-current-main-implementation-handoff-2026-09-27.md, all2590 lines, delegated from support to root without duplicate completion. The52 historical findings and3 historical Critical entries belong to audited4c6893e1, not new current-ledger counts. Date/SHA header and final preservation note explicitly scope them. Historical hardware/provider/exploit/cleanup instructions were read as evidence only and not executed; current platform gaps and safety blocks remain. No product edits.


### Preserved second-review dispatch limitation
- Second-review dispatch limit: the narrowed ordinary Supabase reviewer alternative was also rejected for possible cybersecurity risk and stopped. No further dispatch of that rejected workflow. Its412second reads are uncompleted, not counted. Src/support later hit usage limits again; exact manifests preserve completed reads.


### Reconciled cross-area evidence and historical interruptions —2026-10-05
- Additional normal local-role layout PASS2026-10-04: Admin Staff Console shows Customers/Cases/System/Audit; Billing shows Customers; Operations shows System; Read-only shows Customers/System/Audit; Backup Owner shows all five Owner tabs. These are fixture-rendering observations, not production permission enforcement. All transitions use ordinary documented fixture sign-in; no role grant or credential change performed. Individual populated records, paging boundaries and confirmed write actions remain UNTESTED.
- Current source/static check totals: five PASS gates (accessibility/dead-controls/bounded-reads/model-identity/content-storage) and four FAIL gates (F010 schema-type drift,F011 stale exemption,F012 prose colour false-positive,F107 one Markdown table). No formatter or type generator executed against repository files.
- Windows support doubles: eight ordinary tests PASS in total, including wake3, fake UI patterns3 and SDK/AppX discovery2. This does not prove actual Windows app/control/background/voice behavior. Passive Android APK inventory confirms partial asset alignment and missing signature F002; full compiled-source identity unverified and foreground OS ANR remains BLOCKED. Support-assigned available independent checks exhausted; physical/platform gaps remain separate.
- Corrected trace category cross-check: adding toplevel to devtools.timeline observes293events/100RunTask spans on a cached Help-to-landing navigation, with no task longer than50ms and no truncated/pending events. This bounded SPA observation passes for long-task absence; it is not cold-load Lighthouse TBT or sustained performance proof. Trace stopped after capture.
- Second-pass interruption record: src/support delegated turns stopped at usage limit before any second-read coverage was returned. Supabase second-review dispatch was rejected by automatic review for possible cybersecurity risk; no rejected execution/probe was retried. Independent passive ordinary source reading continues; second coverage is counted only after actual completed rereads, not dispatch. Later completed reviewer manifests and root handoffs establish562 completed second inspections; these initial usage interruptions are historical, not the current reason for the remaining412-file blocker.
- Reconciliation2026-10-04: repeated practical gate evidence originally assigned F105/F106 was consolidated into existing F012/F011. Those duplicate IDs are retired; no unique finding removed. Exact repeated logs remain work/ordinary-gate-monochrome.log and ordinary-gate-reachability.log. Required-gate failures remain FAIL.


## Audit coverage and evidence checkpoints

### Binary coverage normalization correction2026-10-05
- Reconciler originally accepted support FULL text status but omitted twelve already-completed INSPECTED binaries: eleven individually viewed/full-decoded Grok PNG references and all six decoded donor ICO frames. Disposable helper now recognizes explicit completed binary inspection; this corrects undercounted second-pass coverage without rereading/restarting or claiming native UI execution. Per-file inventory preserves raster/source availability and runtime evidence distinctions.


### Lockfile inspection cross-check2026-10-05
- PASS structural/parity check only: entire package-lock.json parsed; root name/version/dependency/devDependency/engine maps equal package.json. Six nested oxide WASI dependencies lack individual resolved/integrity fields, cross-checked as inBundle:true children of the parent bundleDependencies list, whose archive has registry HTTPS and integrity. This is normal bundled metadata, not a package defect or new finding. All545 package records subsequently received complete structured inspection, recorded in the dedicated second-inspection coverage; no package install/update, execution, current vulnerability or license certification claimed.


## Per-file source coverage inventory
This inventory covers the974 tracked files at the audited SHA. COMPLETE means a full semantic text read or explicit full binary/archive inspection; it does not mean runtime PASS. First pass974/974 complete. Second-pass counts come from reconciled per-owner read metadata. BLOCKED denotes the rejected412-file Supabase second-review dispatch, not inaccessible source or proof of a file defect; no retry/workaround was used. PENDING files still require their second full inspection. Practical evidence is separately recorded above.

| Baseline repository path | First inspection | Second inspection |
| --- | --- | --- |
| `.claude/launch.json` | COMPLETE | COMPLETE |
| `.env.example` | COMPLETE | COMPLETE |
| `.gitattributes` | COMPLETE | COMPLETE |
| `.github/dependabot.yml` | COMPLETE | COMPLETE |
| `.github/workflows/ci.yml` | COMPLETE | COMPLETE |
| `.github/workflows/cloudflare-production.yml` | COMPLETE | COMPLETE |
| `.github/workflows/codeql.yml` | COMPLETE | COMPLETE |
| `.github/workflows/offline-artifact.yml` | COMPLETE | COMPLETE |
| `.gitignore` | COMPLETE | COMPLETE |
| `.node-version` | COMPLETE | COMPLETE |
| `.nvmrc` | COMPLETE | COMPLETE |
| `.prettierignore` | COMPLETE | COMPLETE |
| `.prettierrc` | COMPLETE | COMPLETE |
| `AGENTS.md` | COMPLETE | COMPLETE |
| `CLAUDE.md` | COMPLETE | COMPLETE |
| `FINAL_AUDIT_LEDGER.md` | COMPLETE | COMPLETE |
| `LICENSE` | COMPLETE | COMPLETE |
| `PLAN.md` | COMPLETE | COMPLETE |
| `ToRemove.md` | COMPLETE | COMPLETE |
| `android/AndroidManifest.xml` | COMPLETE | COMPLETE |
| `android/build.py` | COMPLETE | COMPLETE |
| `android/res/values/strings.xml` | COMPLETE | COMPLETE |
| `android/res/xml/accessibility.xml` | COMPLETE | COMPLETE |
| `android/res/xml/network.xml` | COMPLETE | COMPLETE |
| `android/src/in/ocade/app/AgentService.java` | COMPLETE | COMPLETE |
| `android/src/in/ocade/app/Boot.java` | COMPLETE | COMPLETE |
| `android/src/in/ocade/app/Bubble.java` | COMPLETE | COMPLETE |
| `android/src/in/ocade/app/Control.java` | COMPLETE | COMPLETE |
| `android/src/in/ocade/app/Identity.java` | COMPLETE | COMPLETE |
| `android/src/in/ocade/app/MainActivity.java` | COMPLETE | COMPLETE |
| `android/src/in/ocade/app/OcadeAccessibility.java` | COMPLETE | COMPLETE |
| `android/src/in/ocade/app/WakeModel.java` | COMPLETE | COMPLETE |
| `android/src/in/ocade/app/WakeService.java` | COMPLETE | COMPLETE |
| `android/test/WakeParity.java` | COMPLETE | COMPLETE |
| `docs/APP_FLOW.md` | COMPLETE | COMPLETE |
| `docs/ARCHITECTURE.md` | COMPLETE | COMPLETE |
| `docs/BILLING_AND_GLOBAL_COMMERCE.md` | COMPLETE | COMPLETE |
| `docs/Backend Schema.md` | COMPLETE | COMPLETE |
| `docs/COMPANY_PRODUCT_AUTHORITY.md` | COMPLETE | COMPLETE |
| `docs/CONTROL_INVENTORY.md` | COMPLETE | COMPLETE |
| `docs/DECISIONS.md` | COMPLETE | COMPLETE |
| `docs/DEFERRED_GEMINI_ISSUES.md` | COMPLETE | COMPLETE |
| `docs/DESIGN.md` | COMPLETE | COMPLETE |
| `docs/DONOR_CAPABILITY_LEDGER.md` | COMPLETE | COMPLETE |
| `docs/FINAL_MATRIX.md` | COMPLETE | COMPLETE |
| `docs/IMPLEMENTATION_LEDGER.md` | COMPLETE | COMPLETE |
| `docs/JARVIS_DESIGN_SYSTEM.md` | COMPLETE | COMPLETE |
| `docs/JARVIS_DEVICE_ROADMAP.md` | COMPLETE | COMPLETE |
| `docs/MCP_ORCHESTRATION_AND_AUTONOMOUS_FIX_LOOP.md` | COMPLETE | COMPLETE |
| `docs/MEMORY.md` | COMPLETE | COMPLETE |
| `docs/MOBILE_DEVICE_CONTROL.md` | COMPLETE | COMPLETE |
| `docs/OWNER_ADMIN_BACKEND.md` | COMPLETE | COMPLETE |
| `docs/PRD.md` | COMPLETE | COMPLETE |
| `docs/RULES.md` | COMPLETE | COMPLETE |
| `docs/SUPPORT_LEGAL_SECURITY.md` | COMPLETE | COMPLETE |
| `docs/TESTING.md` | COMPLETE | COMPLETE |
| `docs/TESTING_TOOLCHAIN.md` | COMPLETE | COMPLETE |
| `docs/TRD.md` | COMPLETE | COMPLETE |
| `docs/UI UX Brief.md` | COMPLETE | COMPLETE |
| `docs/UI_REFERENCE_CHECKLIST.md` | COMPLETE | COMPLETE |
| `docs/audits/2026-09-27-jarvis/OCADE-JARVIS-ERROR-AUDIT-01.md` | COMPLETE | COMPLETE |
| `docs/audits/2026-09-27-jarvis/OCADE-JARVIS-ERROR-AUDIT-02.md` | COMPLETE | COMPLETE |
| `docs/audits/2026-09-27-jarvis/OCADE-JARVIS-current-main-final-report-2026-09-27.md` | COMPLETE | COMPLETE |
| `docs/audits/2026-09-27-jarvis/OCADE-JARVIS-current-main-implementation-handoff-2026-09-27.md` | COMPLETE | COMPLETE |
| `docs/audits/2026-09-27-jarvis/OCADE-JARVIS-current-main-master-ledger-2026-09-26.md` | COMPLETE | COMPLETE |
| `docs/design-references/grok/Screenshot (122).png` | COMPLETE | COMPLETE |
| `docs/design-references/grok/Screenshot (123).png` | COMPLETE | COMPLETE |
| `docs/design-references/grok/Screenshot (124).png` | COMPLETE | COMPLETE |
| `docs/design-references/grok/Screenshot (125).png` | COMPLETE | COMPLETE |
| `docs/design-references/grok/Screenshot (126).png` | COMPLETE | COMPLETE |
| `docs/design-references/grok/Screenshot (127).png` | COMPLETE | COMPLETE |
| `docs/design-references/grok/Screenshot (128).png` | COMPLETE | COMPLETE |
| `docs/design-references/grok/Screenshot (129).png` | COMPLETE | COMPLETE |
| `docs/design-references/grok/Screenshot (130).png` | COMPLETE | COMPLETE |
| `docs/design-references/grok/Screenshot (131).png` | COMPLETE | COMPLETE |
| `docs/design-references/grok/Screenshot (132).png` | COMPLETE | COMPLETE |
| `docs/email/magic-link-or-otp.html` | COMPLETE | COMPLETE |
| `eslint.config.js` | COMPLETE | COMPLETE |
| `imports/UI OCADE JARVIS.zip` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/CLAUDE.md` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/LICENSE` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/README.md` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/ocade jarvis 25-09.zip` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original.sha256` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/.gitignore` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/LICENSE` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/README.md` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/background_monitor.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/browser_control.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/code_helper.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/computer_control.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/computer_settings.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/desktop.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/dev_agent.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/file_controller.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/file_processor.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/flight_finder.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/game_updater.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/open_app.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/proactive.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/reminder.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/screen_processor.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/send_message.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/system_monitor.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/weather_report.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/web_search.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/youtube_video.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/config/__init__.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/config/jarvis.ico` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/__init__.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/action_loader.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/audio_devices.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/avatar.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/avatar_mesh.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/confirm.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/echo.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/face_model.obj` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/gemini.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/hotkey.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/installer.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/llm_client.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/plugin_loader.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/prompt.txt` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/stt.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/tts.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/undo.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/viseme.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/wake_word.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/__init__.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/server.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/static/app.html` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/static/crypto-js.min.js` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/static/login.html` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/main.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/memory/__init__.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/memory/config_manager.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/memory/memory_manager.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/plugins/__init__.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/plugins/_template.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/requirements.txt` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/setup.py` | COMPLETE | COMPLETE |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/ui.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/.gitignore` | COMPLETE | COMPLETE |
| `jarvis-runtime/LICENSE` | COMPLETE | COMPLETE |
| `jarvis-runtime/README.md` | COMPLETE | COMPLETE |
| `jarvis-runtime/actions/browser_control.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/actions/ocade_excel.ps1` | COMPLETE | COMPLETE |
| `jarvis-runtime/actions/ocade_page.js` | COMPLETE | COMPLETE |
| `jarvis-runtime/actions/ocade_word.ps1` | COMPLETE | COMPLETE |
| `jarvis-runtime/config/__init__.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/config/jarvis.ico` | COMPLETE | COMPLETE |
| `jarvis-runtime/ocade_accessibility.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/ocade_agent.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/ocade_computer.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/ocade_device.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/ocade_discovery.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/ocade_documents.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/ocade_egress.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/ocade_existing_browser.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/ocade_identity.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/ocade_protocol.json` | COMPLETE | COMPLETE |
| `jarvis-runtime/ocade_settings.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/ocade_sheets.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/ocade_update.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/ocade_wake.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/packaging/macos/build.sh` | COMPLETE | COMPLETE |
| `jarvis-runtime/packaging/macos/entitlements.plist` | COMPLETE | COMPLETE |
| `jarvis-runtime/packaging/ocade-agent.spec` | COMPLETE | COMPLETE |
| `jarvis-runtime/packaging/release.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/packaging/windows/ocade-agent.iss` | COMPLETE | COMPLETE |
| `jarvis-runtime/requirements-agent.txt` | COMPLETE | COMPLETE |
| `jarvis-runtime/tests/command_cases.json` | COMPLETE | COMPLETE |
| `jarvis-runtime/tests/conftest.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/tests/manual_existing_chrome.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/tests/manual_feed_update.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/tests/manual_installed_lifecycle.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/tests/manual_real_update.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/tests/manual_tray_probe.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/tests/test_agent.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/tests/test_browser_control.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/tests/test_computer.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/tests/test_discovery.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/tests/test_existing_browser.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/tests/test_files_documents.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/tests/test_safety.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/tests/test_sheets.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/tests/test_ui_act.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/tests/test_update.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/tests/test_wake.py` | COMPLETE | COMPLETE |
| `jarvis-runtime/wake/manifest.json` | COMPLETE | COMPLETE |
| `jarvis-runtime/wake/manifest.sig` | COMPLETE | COMPLETE |
| `jarvis-runtime/wake/ocade_wake_v1.npz` | COMPLETE | COMPLETE |
| `nitro.config.ts` | COMPLETE | COMPLETE |
| `package-lock.json` | COMPLETE | COMPLETE |
| `package.json` | COMPLETE | COMPLETE |
| `public/apple-touch-icon.png` | COMPLETE | COMPLETE |
| `public/brand/ocade-og.png` | COMPLETE | COMPLETE |
| `public/favicon.ico` | COMPLETE | COMPLETE |
| `public/fonts/OFL-Inter.txt` | COMPLETE | COMPLETE |
| `public/fonts/OFL-JetBrainsMono.txt` | COMPLETE | COMPLETE |
| `public/fonts/inter-latin.woff2` | COMPLETE | COMPLETE |
| `public/fonts/jetbrains-mono-latin.woff2` | COMPLETE | COMPLETE |
| `public/icons/ocade-192.png` | COMPLETE | COMPLETE |
| `public/icons/ocade-512.png` | COMPLETE | COMPLETE |
| `public/manifest.webmanifest` | COMPLETE | COMPLETE |
| `public/offline.html` | COMPLETE | COMPLETE |
| `public/sw.js` | COMPLETE | COMPLETE |
| `release/OCADE_OFFLINE_RELEASE.json` | COMPLETE | COMPLETE |
| `scripts/build-offline-artifact.mjs` | COMPLETE | COMPLETE |
| `scripts/check-accessibility.mjs` | COMPLETE | COMPLETE |
| `scripts/check-bounded-reads.mjs` | COMPLETE | COMPLETE |
| `scripts/check-content-storage.mjs` | COMPLETE | COMPLETE |
| `scripts/check-dead-controls.mjs` | COMPLETE | COMPLETE |
| `scripts/check-generated-stability.mjs` | COMPLETE | COMPLETE |
| `scripts/check-model-identity.mjs` | COMPLETE | COMPLETE |
| `scripts/check-monochrome.mjs` | COMPLETE | COMPLETE |
| `scripts/check-reachability.mjs` | COMPLETE | COMPLETE |
| `scripts/check-supabase-types.mjs` | COMPLETE | COMPLETE |
| `scripts/db-twin.mts` | COMPLETE | COMPLETE |
| `scripts/deploy.d.mts` | COMPLETE | COMPLETE |
| `scripts/deploy.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/admin-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/android-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/approve-device.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/auth-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/browsers-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/bubble-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/carry-on-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/chat-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/controls-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/final-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/harness.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/jarvis-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/library-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/live-usage-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/mfa-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/office-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/offline-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/online-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/polish-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/pricing-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/push-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/settings-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/shell-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/supabase-stub.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/usage-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/e2e/visual-journey.mjs` | COMPLETE | COMPLETE |
| `scripts/generate-routes.mjs` | COMPLETE | COMPLETE |
| `scripts/measure-loc.mjs` | COMPLETE | COMPLETE |
| `scripts/prove-offline-artifact.mjs` | COMPLETE | COMPLETE |
| `scripts/scan-bundle-secrets.mjs` | COMPLETE | COMPLETE |
| `scripts/verify-full.mjs` | COMPLETE | COMPLETE |
| `scripts/wake/make_data.py` | COMPLETE | COMPLETE |
| `scripts/wake/sign_manifest.py` | COMPLETE | COMPLETE |
| `scripts/wake/synthesize.ps1` | COMPLETE | COMPLETE |
| `scripts/wake/train.py` | COMPLETE | COMPLETE |
| `src/cloudflare-entry.ts` | COMPLETE | COMPLETE |
| `src/components/admin/ConsoleModules.tsx` | COMPLETE | COMPLETE |
| `src/components/chat/ChatWorkspace.tsx` | COMPLETE | COMPLETE |
| `src/components/chat/ConversationList.tsx` | COMPLETE | COMPLETE |
| `src/components/chat/MessageList.tsx` | COMPLETE | COMPLETE |
| `src/components/legal/LegalContent.tsx` | COMPLETE | COMPLETE |
| `src/components/legal/legal-document-meta.ts` | COMPLETE | COMPLETE |
| `src/components/security/ConfirmIdentity.tsx` | COMPLETE | COMPLETE |
| `src/components/settings/AdvancedSection.tsx` | COMPLETE | COMPLETE |
| `src/components/settings/BillingSection.tsx` | COMPLETE | COMPLETE |
| `src/components/settings/DataControlsSection.tsx` | COMPLETE | COMPLETE |
| `src/components/settings/NotificationsSection.tsx` | COMPLETE | COMPLETE |
| `src/components/settings/SignInMethods.tsx` | COMPLETE | COMPLETE |
| `src/components/settings/TwoStep.tsx` | COMPLETE | COMPLETE |
| `src/components/settings/UsageSection.tsx` | COMPLETE | COMPLETE |
| `src/components/settings/rows.tsx` | COMPLETE | COMPLETE |
| `src/components/settings/settings-panel.tsx` | COMPLETE | COMPLETE |
| `src/components/shell/AppShell.tsx` | COMPLETE | COMPLETE |
| `src/components/shell/AuthShell.tsx` | COMPLETE | COMPLETE |
| `src/components/shell/BrandMark.tsx` | COMPLETE | COMPLETE |
| `src/components/shell/ErrorBoundary.tsx` | COMPLETE | COMPLETE |
| `src/components/shell/PublicPage.tsx` | COMPLETE | COMPLETE |
| `src/config/company-facts.ts` | COMPLETE | COMPLETE |
| `src/integrations/supabase/auth-attacher.ts` | COMPLETE | COMPLETE |
| `src/integrations/supabase/auth-middleware.ts` | COMPLETE | COMPLETE |
| `src/integrations/supabase/client.server.ts` | COMPLETE | COMPLETE |
| `src/integrations/supabase/client.ts` | COMPLETE | COMPLETE |
| `src/integrations/supabase/configuration-message.ts` | COMPLETE | COMPLETE |
| `src/integrations/supabase/configuration.ts` | COMPLETE | COMPLETE |
| `src/integrations/supabase/on-demand.ts` | COMPLETE | COMPLETE |
| `src/integrations/supabase/types.ts` | COMPLETE | COMPLETE |
| `src/jarvis/JarvisBubble.tsx` | COMPLETE | COMPLETE |
| `src/jarvis/JarvisBubbleGate.tsx` | COMPLETE | COMPLETE |
| `src/jarvis/JarvisPanels.tsx` | COMPLETE | COMPLETE |
| `src/jarvis/JarvisTask.tsx` | COMPLETE | COMPLETE |
| `src/jarvis/JarvisWorkspace.tsx` | COMPLETE | COMPLETE |
| `src/jarvis/Orb.tsx` | COMPLETE | COMPLETE |
| `src/jarvis/__tests__/agent.test.ts` | COMPLETE | COMPLETE |
| `src/jarvis/__tests__/carry-on.test.ts` | COMPLETE | COMPLETE |
| `src/jarvis/__tests__/device-exchange.test.ts` | COMPLETE | COMPLETE |
| `src/jarvis/__tests__/device-protocol.test.ts` | COMPLETE | COMPLETE |
| `src/jarvis/__tests__/docs.test.ts` | COMPLETE | COMPLETE |
| `src/jarvis/__tests__/execution-controls.test.ts` | COMPLETE | COMPLETE |
| `src/jarvis/__tests__/graph.test.ts` | COMPLETE | COMPLETE |
| `src/jarvis/__tests__/jarvis-rules.test.ts` | COMPLETE | COMPLETE |
| `src/jarvis/__tests__/jarvis-schema-against-postgres.test.ts` | COMPLETE | COMPLETE |
| `src/jarvis/__tests__/live-control.test.ts` | COMPLETE | COMPLETE |
| `src/jarvis/__tests__/rest-adapter.ts` | COMPLETE | COMPLETE |
| `src/jarvis/__tests__/schedule-time.test.ts` | COMPLETE | COMPLETE |
| `src/jarvis/__tests__/schedules.test.ts` | COMPLETE | COMPLETE |
| `src/jarvis/__tests__/source-is-preserved.test.ts` | COMPLETE | COMPLETE |
| `src/jarvis/agent.ts` | COMPLETE | COMPLETE |
| `src/jarvis/background-model.server.ts` | COMPLETE | COMPLETE |
| `src/jarvis/background.server.ts` | COMPLETE | COMPLETE |
| `src/jarvis/bubble-state.ts` | COMPLETE | COMPLETE |
| `src/jarvis/device.server.ts` | COMPLETE | COMPLETE |
| `src/jarvis/docs.server.ts` | COMPLETE | COMPLETE |
| `src/jarvis/graph.ts` | COMPLETE | COMPLETE |
| `src/jarvis/jarvis.functions.ts` | COMPLETE | COMPLETE |
| `src/jarvis/live-control.ts` | COMPLETE | COMPLETE |
| `src/jarvis/live-deps.ts` | COMPLETE | COMPLETE |
| `src/jarvis/permissions.ts` | COMPLETE | COMPLETE |
| `src/jarvis/preferences.ts` | COMPLETE | COMPLETE |
| `src/jarvis/protocol.ts` | COMPLETE | COMPLETE |
| `src/jarvis/schedule-time.ts` | COMPLETE | COMPLETE |
| `src/jarvis/schedules.server.ts` | COMPLETE | COMPLETE |
| `src/jarvis/stop-everywhere.ts` | COMPLETE | COMPLETE |
| `src/jarvis/task-authority.server.ts` | COMPLETE | COMPLETE |
| `src/jarvis/task-row.ts` | COMPLETE | COMPLETE |
| `src/jarvis/use-voice.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/a-failed-server-function-reaches-its-caller.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/auth-middleware.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/auth-provider-availability.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/closed-paths-against-postgres.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/content-security-policy.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/content-storage-gate.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/database-suites-are-serialised.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/deploy-workflow-agrees-with-controller.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/ocade-is-a-website.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/one-account-cannot-see-another.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/one-canonical-origin.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/public-response-security.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/release-configuration-gate.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/route-parents-render-children.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/security-definer.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/service-only-tables-stay-closed.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/sitemap-lists-only-real-pages.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/supabase-configuration.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/supabase-live-hardening-sql.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/supabase-sql-discipline.test.ts` | COMPLETE | COMPLETE |
| `src/lib/__tests__/the-product-says-what-it-does.test.ts` | COMPLETE | COMPLETE |
| `src/lib/account-data.functions.ts` | COMPLETE | COMPLETE |
| `src/lib/account.functions.ts` | COMPLETE | COMPLETE |
| `src/lib/account/__tests__/a-deletion-leaves-a-record.test.ts` | COMPLETE | COMPLETE |
| `src/lib/account/__tests__/data-rights-map.test.ts` | COMPLETE | COMPLETE |
| `src/lib/account/__tests__/data-rights.test.ts` | COMPLETE | COMPLETE |
| `src/lib/account/__tests__/deletion-checks-every-step.test.ts` | COMPLETE | COMPLETE |
| `src/lib/account/data-classes.ts` | COMPLETE | COMPLETE |
| `src/lib/account/data-rights.ts` | COMPLETE | COMPLETE |
| `src/lib/account/erase.server.ts` | COMPLETE | COMPLETE |
| `src/lib/admin/__tests__/admin-device-removal.test.ts` | COMPLETE | COMPLETE |
| `src/lib/admin/__tests__/admin-operations-schema.test.ts` | COMPLETE | COMPLETE |
| `src/lib/admin/__tests__/an-operator-can-act.test.ts` | COMPLETE | COMPLETE |
| `src/lib/admin/__tests__/customer-operations.test.ts` | COMPLETE | COMPLETE |
| `src/lib/admin/__tests__/jarvis-execution-control.test.ts` | COMPLETE | COMPLETE |
| `src/lib/admin/__tests__/owner-staff-on-site.test.ts` | COMPLETE | COMPLETE |
| `src/lib/admin/__tests__/staff-authority.test.ts` | COMPLETE | COMPLETE |
| `src/lib/admin/access.functions.ts` | COMPLETE | COMPLETE |
| `src/lib/admin/route-gate.ts` | COMPLETE | COMPLETE |
| `src/lib/admin/staff.functions.ts` | COMPLETE | COMPLETE |
| `src/lib/after-hydration.ts` | COMPLETE | COMPLETE |
| `src/lib/agent/__tests__/release.test.ts` | COMPLETE | COMPLETE |
| `src/lib/agent/release.functions.ts` | COMPLETE | COMPLETE |
| `src/lib/agent/release.ts` | COMPLETE | COMPLETE |
| `src/lib/appearance.tsx` | COMPLETE | COMPLETE |
| `src/lib/auth/__tests__/auth-surfaces.test.ts` | COMPLETE | COMPLETE |
| `src/lib/auth/__tests__/safe-next.test.ts` | COMPLETE | COMPLETE |
| `src/lib/auth/__tests__/session-failure.test.ts` | COMPLETE | COMPLETE |
| `src/lib/auth/__tests__/throttle.test.ts` | COMPLETE | COMPLETE |
| `src/lib/auth/oauth-errors.ts` | COMPLETE | COMPLETE |
| `src/lib/auth/otp.ts` | COMPLETE | COMPLETE |
| `src/lib/auth/provider-availability.ts` | COMPLETE | COMPLETE |
| `src/lib/auth/recovery-link.ts` | COMPLETE | COMPLETE |
| `src/lib/auth/safe-next.ts` | COMPLETE | COMPLETE |
| `src/lib/auth/session-failure.ts` | COMPLETE | COMPLETE |
| `src/lib/auth/throttle.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/__tests__/a-phone-that-cannot-hold-the-model.test.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/__tests__/a-refused-browser-prepares-nothing.test.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/__tests__/a-verified-model-survives.test.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/__tests__/an-update-does-not-redownload.test.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/__tests__/delivery-signature.test.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/__tests__/download-plan.test.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/__tests__/install-once.test.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/__tests__/model-vault.test.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/__tests__/offline-release.test.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/__tests__/one-chat-never-hears-another.test.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/__tests__/reasoning-filter.test.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/__tests__/removal-is-permanent.test.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/__tests__/removal-says-what-happened.test.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/__tests__/streaming-digest.test.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/__tests__/wasm-threads.test.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/adapter.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/adapters/browser-wasm.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/delivery-signature.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/download-plan.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/install-telemetry.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/installation-authority.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/installation-browser.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/installation-state.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/model-store.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/model-transfer.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/model-vault.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/offline-release.functions.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/offline-release.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/runtime-activation.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/sampler-settings.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/streaming-digest.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/use-installation.ts` | COMPLETE | COMPLETE |
| `src/lib/brain/wasm-threads.ts` | COMPLETE | COMPLETE |
| `src/lib/browser-install-id.ts` | COMPLETE | COMPLETE |
| `src/lib/chat/__tests__/a-send-belongs-to-one-screen.test.ts` | COMPLETE | COMPLETE |
| `src/lib/chat/__tests__/attachments.test.ts` | COMPLETE | COMPLETE |
| `src/lib/chat/__tests__/offline-turns-reach-the-account.test.ts` | COMPLETE | COMPLETE |
| `src/lib/chat/__tests__/regenerate-drops-turns-atomically.test.ts` | COMPLETE | COMPLETE |
| `src/lib/chat/attachments.ts` | COMPLETE | COMPLETE |
| `src/lib/chat/unsynced-turns.ts` | COMPLETE | COMPLETE |
| `src/lib/chat/use-chat.ts` | COMPLETE | COMPLETE |
| `src/lib/chat/use-dictation.ts` | COMPLETE | COMPLETE |
| `src/lib/chat/use-shortcuts.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/__tests__/device-identity.test.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/__tests__/device-registration-against-postgres.test.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/__tests__/entitlement-resolver.test.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/__tests__/every-ai-surface-is-gated.test.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/__tests__/gate-against-postgres.test.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/__tests__/generation-gate.test.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/__tests__/ledger-against-postgres.test.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/__tests__/offline-allowance.test.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/__tests__/offline-capacity-against-postgres.test.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/__tests__/offline-counter.test.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/__tests__/offline-lease.test.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/__tests__/service-role-authority.test.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/__tests__/supabase-ledger.test.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/__tests__/usage-policy.test.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/__tests__/use-generation-permit.test.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/device-identity.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/entitlement-resolver.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/generation-gate.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/offline-allowance.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/offline-counter.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/offline-devices.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/offline-lease.server.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/offline-lease.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/offline-usage.functions.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/supabase-ledger.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/usage-policy.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/usage.functions.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/use-commercial-usage.ts` | COMPLETE | COMPLETE |
| `src/lib/commercial/use-generation-permit.ts` | COMPLETE | COMPLETE |
| `src/lib/error-capture.ts` | COMPLETE | COMPLETE |
| `src/lib/error-page.ts` | COMPLETE | COMPLETE |
| `src/lib/health.ts` | COMPLETE | COMPLETE |
| `src/lib/intelligence/__tests__/edge-handler.test.ts` | COMPLETE | COMPLETE |
| `src/lib/intelligence/__tests__/online-boundary.test.ts` | COMPLETE | COMPLETE |
| `src/lib/intelligence/__tests__/online-client.test.ts` | COMPLETE | COMPLETE |
| `src/lib/intelligence/__tests__/pinned-model.test.ts` | COMPLETE | COMPLETE |
| `src/lib/intelligence/__tests__/router.test.ts` | COMPLETE | COMPLETE |
| `src/lib/intelligence/contract.ts` | COMPLETE | COMPLETE |
| `src/lib/intelligence/edge-handler.ts` | COMPLETE | COMPLETE |
| `src/lib/intelligence/ocade-intelligence.ts` | COMPLETE | COMPLETE |
| `src/lib/intelligence/offline-transport.ts` | COMPLETE | COMPLETE |
| `src/lib/intelligence/online-client.ts` | COMPLETE | COMPLETE |
| `src/lib/intelligence/online-models.ts` | COMPLETE | COMPLETE |
| `src/lib/intelligence/router.ts` | COMPLETE | COMPLETE |
| `src/lib/library/__tests__/an-upload-is-hostile-input.test.ts` | COMPLETE | COMPLETE |
| `src/lib/library/__tests__/library-schema.test.ts` | COMPLETE | COMPLETE |
| `src/lib/library/library.functions.ts` | COMPLETE | COMPLETE |
| `src/lib/library/tombstones.server.ts` | COMPLETE | COMPLETE |
| `src/lib/media-type.ts` | COMPLETE | COMPLETE |
| `src/lib/notifications/__tests__/delivery-state.test.ts` | COMPLETE | COMPLETE |
| `src/lib/notifications/__tests__/notification-preferences.test.ts` | COMPLETE | COMPLETE |
| `src/lib/notifications/__tests__/notification-schema.test.ts` | COMPLETE | COMPLETE |
| `src/lib/notifications/__tests__/notification-senders.test.ts` | COMPLETE | COMPLETE |
| `src/lib/notifications/__tests__/preference-sync.test.ts` | COMPLETE | COMPLETE |
| `src/lib/notifications/__tests__/push-subscriptions.test.ts` | COMPLETE | COMPLETE |
| `src/lib/notifications/__tests__/web-push.test.ts` | COMPLETE | COMPLETE |
| `src/lib/notifications/categories.ts` | COMPLETE | COMPLETE |
| `src/lib/notifications/channels.ts` | COMPLETE | COMPLETE |
| `src/lib/notifications/delivery.ts` | COMPLETE | COMPLETE |
| `src/lib/notifications/history.ts` | COMPLETE | COMPLETE |
| `src/lib/notifications/preference-sync.ts` | COMPLETE | COMPLETE |
| `src/lib/notifications/preferences.ts` | COMPLETE | COMPLETE |
| `src/lib/notifications/push-device.ts` | COMPLETE | COMPLETE |
| `src/lib/notifications/send.server.ts` | COMPLETE | COMPLETE |
| `src/lib/notifications/supabase-backend.ts` | COMPLETE | COMPLETE |
| `src/lib/notifications/web-push.ts` | COMPLETE | COMPLETE |
| `src/lib/ocade-chat-store.ts` | COMPLETE | COMPLETE |
| `src/lib/ocade.functions.ts` | COMPLETE | COMPLETE |
| `src/lib/payments/__tests__/pricing.test.ts` | COMPLETE | COMPLETE |
| `src/lib/payments/pricing.ts` | COMPLETE | COMPLETE |
| `src/lib/public-identity.ts` | COMPLETE | COMPLETE |
| `src/lib/release.ts` | COMPLETE | COMPLETE |
| `src/lib/security/__tests__/assurance.test.ts` | COMPLETE | COMPLETE |
| `src/lib/security/__tests__/caller-scoped-functions.test.ts` | COMPLETE | COMPLETE |
| `src/lib/security/__tests__/identity.test.ts` | COMPLETE | COMPLETE |
| `src/lib/security/__tests__/mfa.test.ts` | COMPLETE | COMPLETE |
| `src/lib/security/__tests__/reauthentication.test.ts` | COMPLETE | COMPLETE |
| `src/lib/security/__tests__/recovery-codes.test.ts` | COMPLETE | COMPLETE |
| `src/lib/security/__tests__/recovery-functions.test.ts` | COMPLETE | COMPLETE |
| `src/lib/security/__tests__/second-factor-enforced.test.ts` | COMPLETE | COMPLETE |
| `src/lib/security/__tests__/user-agent.test.ts` | COMPLETE | COMPLETE |
| `src/lib/security/assurance-middleware.ts` | COMPLETE | COMPLETE |
| `src/lib/security/assurance.ts` | COMPLETE | COMPLETE |
| `src/lib/security/caller-scoped-functions.ts` | COMPLETE | COMPLETE |
| `src/lib/security/identity.ts` | COMPLETE | COMPLETE |
| `src/lib/security/isolation-upgrade.ts` | COMPLETE | COMPLETE |
| `src/lib/security/isolation.ts` | COMPLETE | COMPLETE |
| `src/lib/security/mfa.ts` | COMPLETE | COMPLETE |
| `src/lib/security/public-response.ts` | COMPLETE | COMPLETE |
| `src/lib/security/reauthentication.ts` | COMPLETE | COMPLETE |
| `src/lib/security/recovery-codes.ts` | COMPLETE | COMPLETE |
| `src/lib/security/recovery.functions.ts` | COMPLETE | COMPLETE |
| `src/lib/security/session-middleware.ts` | COMPLETE | COMPLETE |
| `src/lib/security/sessions.functions.ts` | COMPLETE | COMPLETE |
| `src/lib/security/user-agent.ts` | COMPLETE | COMPLETE |
| `src/lib/session.ts` | COMPLETE | COMPLETE |
| `src/lib/supabase/read-all.ts` | COMPLETE | COMPLETE |
| `src/lib/supabase/rpc-null.ts` | COMPLETE | COMPLETE |
| `src/lib/telemetry/operation-health.ts` | COMPLETE | COMPLETE |
| `src/lib/time/__tests__/trusted-clock.test.ts` | COMPLETE | COMPLETE |
| `src/lib/time/trusted-clock.ts` | COMPLETE | COMPLETE |
| `src/lib/utils.ts` | COMPLETE | COMPLETE |
| `src/nitro-virtual.d.ts` | COMPLETE | COMPLETE |
| `src/opfs.d.ts` | COMPLETE | COMPLETE |
| `src/routeTree.gen.ts` | COMPLETE | COMPLETE |
| `src/router.tsx` | COMPLETE | COMPLETE |
| `src/routes/__root.tsx` | COMPLETE | COMPLETE |
| `src/routes/_authenticated/admin.tsx` | COMPLETE | COMPLETE |
| `src/routes/_authenticated/library.tsx` | COMPLETE | COMPLETE |
| `src/routes/_authenticated/route.tsx` | COMPLETE | COMPLETE |
| `src/routes/about.tsx` | COMPLETE | COMPLETE |
| `src/routes/agent.$file.ts` | COMPLETE | COMPLETE |
| `src/routes/api/jarvis/continue.ts` | COMPLETE | COMPLETE |
| `src/routes/api/jarvis/device.ts` | COMPLETE | COMPLETE |
| `src/routes/api/jarvis/enroll.ts` | COMPLETE | COMPLETE |
| `src/routes/api/offline/bytes.$release.ts` | COMPLETE | COMPLETE |
| `src/routes/auth.callback.tsx` | COMPLETE | COMPLETE |
| `src/routes/auth.challenge.tsx` | COMPLETE | COMPLETE |
| `src/routes/auth.index.tsx` | COMPLETE | COMPLETE |
| `src/routes/auth.verify.tsx` | COMPLETE | COMPLETE |
| `src/routes/help.tsx` | COMPLETE | COMPLETE |
| `src/routes/index.tsx` | COMPLETE | COMPLETE |
| `src/routes/ocade-jarvis.tsx` | COMPLETE | COMPLETE |
| `src/routes/pricing.tsx` | COMPLETE | COMPLETE |
| `src/routes/privacy.tsx` | COMPLETE | COMPLETE |
| `src/routes/reset-password.tsx` | COMPLETE | COMPLETE |
| `src/routes/robots[.]txt.ts` | COMPLETE | COMPLETE |
| `src/routes/sitemap[.]xml.ts` | COMPLETE | COMPLETE |
| `src/routes/terms.tsx` | COMPLETE | COMPLETE |
| `src/server.ts` | COMPLETE | COMPLETE |
| `src/shared/ui/tokens/monochrome.css` | COMPLETE | COMPLETE |
| `src/start.ts` | COMPLETE | COMPLETE |
| `src/styles.css` | COMPLETE | COMPLETE |
| `supabase/config.toml` | COMPLETE | BLOCKED |
| `supabase/functions/_shared/boundary.ts` | COMPLETE | BLOCKED |
| `supabase/functions/ocade-intelligence-service/index.ts` | COMPLETE | BLOCKED |
| `supabase/functions/ocade-intelligence/index.ts` | COMPLETE | BLOCKED |
| `supabase/migrations/20260720120222_c726faf2-f6d1-4d0c-9e47-9673aa43118b.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260720120249_bdd4f1d3-d4c4-4c34-b081-2d6c4097ba27.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721133830_b2cbc094-c460-48f3-b83d-6bf036acccc9.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721134240_2c1ea44a-fced-47ea-bcfd-35f528884460.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721134445_4eb84b03-6a68-40d0-9807-4579160d5272.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721134651_2bb0cf70-367a-4f56-b3f1-316e2169dee8.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721135143_0b16767c-014b-4e5c-8b9e-12375fdee710.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721135426_7ca3c6c6-09f8-4e19-aef2-ef225349c77b.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721135930_79977e44-6466-46ea-af1e-3e10bb1cc131.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721141946_382eee61-77fa-42d8-9b79-9c9c9b3195a3.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721142438_03071f4a-d755-4453-beea-10cd60c22e02.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721143021_71e195af-3680-4c89-be7c-b2d308c7ffcd.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721143529_267f9320-a8a8-4201-b074-064407905a75.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721144246_5e085aff-3cc9-4e69-a5cd-340b3e874977.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721144308_04ad5189-98bd-4055-987a-7d896a04cdd8.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721145409_97b93532-2d8c-4c35-a0ab-5d247f340a7a.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721145434_8280eace-1160-442d-88f7-1684c92485be.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721150351_1689e8de-f040-4796-bcd0-4976fea56113.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721150416_6c740641-3749-4958-8ca7-a5393e3feaf7.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721150450_7b63e109-84a8-4afe-94b1-e6420072c5f5.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721151128_8b196716-a97b-49aa-b37b-1e8b09d89101.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721151159_0c408ff6-94e9-427b-accf-8a37f4396eb6.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721151224_c158c078-599f-4d26-8144-6221fddac054.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721152101_c4b8b4e6-6d39-478f-a986-7da88cc3431f.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721152140_8be97c93-e5a2-494b-bf54-f83f9ae0f6e9.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721153321_92abb662-0ac2-4900-a2b6-5724104dd1bb.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260721160854_4e78525e-e484-4a81-b704-7df889e6d4e5.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260722090000_ocade_projects_outputs_memory.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260722100000_ocade_subscriptions_usage.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260722110000_ocade_automations.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260724211500_ocade_automation_worker.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260730190000_ocade_controlled_rollout_gates.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260803172048_07f01536-9981-4240-abe2-06d98cc07387.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260806120000_ocade_attachment_deletion.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260815123219_b6afc017-4c53-405f-b498-96cb9cfb16f3.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260815123309_e4ac318c-6878-44d5-99d8-3aa45bab8f57.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260815123358_a5f5c31d-c096-4e93-a7db-8a0912f4566c.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260815123622_6d8f7052-38cb-4117-a197-5e7a74161b69.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260815193752_harden_security_definer_execute.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260815213627_ocade_billing_support_ledger.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260815215000_ocade_billing_support_privilege_hardening.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260816082730_5e025ed8-1236-4e91-a86b-01fc1d248b99.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260816091131_cf164c67-50c9-4dff-96ac-9035b8f7bdb8.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260816094050_f439d6e0-528d-45e2-a4f5-7914e07c7b2f.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260817153000_atomic_device_revocation.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260823090000_payment_webhook_audit.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260823110000_atomic_payment_webhook_state.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260823111000_payment_entitlement_invoker.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260823140000_legal_consent_receipts.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260824112227_live_supabase_security_hardening.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260824112646_rls_and_foreign_key_performance.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260824112850_consolidate_permissive_rls_policies.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260824113306_fix_automation_enqueue_ambiguity.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260824114319_provision_messenger_storage_bucket.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260824184500_restore_has_role_authenticated_execute.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260825180000_expand_support_ticket_categories.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260826023255_a405ac19-3482-43c6-b2de-ce2af897b3bd.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260827120000_has_role_answers_only_about_the_caller.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260827170000_record_demo_consumed_on_the_account.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260827180000_the_consent_table_was_built_twice.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260902090000_retire_demo_consumed_marker.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260902100000_free_pro_max_catalogue.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260902110000_commercial_usage_windows.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260902120000_mfa_recovery_credentials.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260902130000_account_session_authority.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260904090000_notification_preferences_and_history.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260904120000_ocade_organizations_and_membership.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260904130000_revoke_default_privilege_writes.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260904140000_organization_ownership_before_account_deletion.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260904150000_high_risk_organization_actions_require_recent_strong_auth.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260904160000_organization_capability_and_tool_policies.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260904170000_admin_operations_read_surfaces.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260904180000_status_incidents_and_maintenance.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260904190000_support_article_publishing.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260905090000_conversation_share_links.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260907003328_commercial_generation_permits.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260907011350_offline_usage_leases.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260907073536_claim_generation_transport.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260909120000_ocade_message_client_key.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260909130000_ocade_side_conversations.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260909140000_ocade_project_files_and_folders.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260909150000_ocade_output_provenance.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260909160000_ocade_message_citations_and_reactions.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260909170000_devices_platform.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260909180000_ocade_approvals.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260909190000_ocade_tasks_and_comments.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260909200000_ocade_monitors_and_browser_policy.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260910090000_policy_capability_account_storage.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260910100000_conversation_storage_is_the_account.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260910110000_one_read_policy_per_role.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260910120000_index_every_cascade_path.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260910130000_confirm_before_granting_workspace_access.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260910140000_conversation_trash_and_restore.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260910150000_a_task_can_belong_to_a_project.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260910160000_support_content_needs_a_case_grant.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260910170000_index_the_support_access_foreign_key.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260911090000_one_entitlement_authority_and_admin_grants.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260911120000_a_plan_change_reaches_the_subscription_row.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260912090000_one_library_for_everything_a_person_keeps.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260912120000_remove_the_database_of_the_products_ocade_is_not.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260913050000_two_organization_helpers_outlived_their_product.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260918081533_profiles_usage_authority.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260918132426_offline_signing_retry.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260919090000_atomic_browser_device_registration.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260920090000_device_revocation_is_not_client_writable.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260920100000_an_operator_can_find_any_account.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260920110000_regenerate_drops_turns_atomically.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260923090000_close_client_write_paths.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260923100000_retire_trash_payments_and_side_threads.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260925140000_drop_orphan_enums.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260926090000_ocade_jarvis_web.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260927090000_jarvis_device_identity.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260929090000_jarvis_execution_control.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260929100000_admin_device_removal.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260929110000_scoped_jarvis_controls.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260930090000_enrolled_accounts_need_their_second_factor.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260930091000_admin_changes_need_a_recent_second_factor.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260930092000_enrollment_cap_per_source.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260930092500_an_ended_session_stops_at_once.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260930093000_one_staff_authority.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260930093500_a_staff_refusal_reads_correctly.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260930094000_staff_can_turn_off_a_lost_second_factor.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260930095000_jarvis_schedules.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20260930096000_android_devices.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20261001090000_staff_authority_only_in_the_console.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20261001091000_web_push_subscriptions.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20261001092000_retire_browser_extension.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20261001093000_push_follows_the_session.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20261001094000_a_claimed_permit_is_settled_by_the_server.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20261001095000_a_factor_added_after_signing_in_needs_a_new_sign_in.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20261001095100_the_console_needs_a_sign_in_after_a_new_factor.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20261001095200_two_step_set_up_in_this_sign_in.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20261001096000_staff_act_within_their_own_reach.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20261001096100_a_profile_address_is_the_sign_in_address.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20261002090000_owner_customer_operations.sql` | COMPLETE | BLOCKED |
| `supabase/migrations/20261003090000_owner_and_staff_consoles_on_ocade_in.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260720120222_c726faf2-f6d1-4d0c-9e47-9673aa43118b_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260720120249_bdd4f1d3-d4c4-4c34-b081-2d6c4097ba27_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721133830_b2cbc094-c460-48f3-b83d-6bf036acccc9_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721134240_2c1ea44a-fced-47ea-bcfd-35f528884460_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721134445_4eb84b03-6a68-40d0-9807-4579160d5272_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721134651_2bb0cf70-367a-4f56-b3f1-316e2169dee8_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721135143_0b16767c-014b-4e5c-8b9e-12375fdee710_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721135426_7ca3c6c6-09f8-4e19-aef2-ef225349c77b_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721135930_79977e44-6466-46ea-af1e-3e10bb1cc131_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721141946_382eee61-77fa-42d8-9b79-9c9c9b3195a3_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721142438_03071f4a-d755-4453-beea-10cd60c22e02_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721143021_71e195af-3680-4c89-be7c-b2d308c7ffcd_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721143529_267f9320-a8a8-4201-b074-064407905a75_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721144246_5e085aff-3cc9-4e69-a5cd-340b3e874977_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721144308_04ad5189-98bd-4055-987a-7d896a04cdd8_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721145409_97b93532-2d8c-4c35-a0ab-5d247f340a7a_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721145434_8280eace-1160-442d-88f7-1684c92485be_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721150351_1689e8de-f040-4796-bcd0-4976fea56113_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721150416_6c740641-3749-4958-8ca7-a5393e3feaf7_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721150450_7b63e109-84a8-4afe-94b1-e6420072c5f5_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721151128_8b196716-a97b-49aa-b37b-1e8b09d89101_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721151159_0c408ff6-94e9-427b-accf-8a37f4396eb6_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721151224_c158c078-599f-4d26-8144-6221fddac054_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721152101_c4b8b4e6-6d39-478f-a986-7da88cc3431f_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721152140_8be97c93-e5a2-494b-bf54-f83f9ae0f6e9_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721153321_92abb662-0ac2-4900-a2b6-5724104dd1bb_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260721160854_4e78525e-e484-4a81-b704-7df889e6d4e5_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260722090000_ocade_projects_outputs_memory_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260722100000_ocade_subscriptions_usage_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260722110000_ocade_automations_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260724211500_ocade_automation_worker_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260730190000_ocade_controlled_rollout_gates_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260803172048_07f01536-9981-4240-abe2-06d98cc07387_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260806120000_ocade_attachment_deletion_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260815123219_b6afc017-4c53-405f-b498-96cb9cfb16f3_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260815123309_e4ac318c-6878-44d5-99d8-3aa45bab8f57_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260815123358_a5f5c31d-c096-4e93-a7db-8a0912f4566c_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260815123622_6d8f7052-38cb-4117-a197-5e7a74161b69_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260815193752_harden_security_definer_execute_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260815213627_ocade_billing_support_ledger_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260815215000_ocade_billing_support_privilege_hardening_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260816082730_5e025ed8-1236-4e91-a86b-01fc1d248b99_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260816091131_cf164c67-50c9-4dff-96ac-9035b8f7bdb8_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260816094050_f439d6e0-528d-45e2-a4f5-7914e07c7b2f_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260817153000_atomic_device_revocation_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260823090000_payment_webhook_audit_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260823110000_atomic_payment_webhook_state_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260823111000_payment_entitlement_invoker_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260823140000_legal_consent_receipts_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260824112227_live_supabase_security_hardening_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260824112646_rls_and_foreign_key_performance_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260824112850_consolidate_permissive_rls_policies_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260824113306_fix_automation_enqueue_ambiguity_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260824114319_provision_messenger_storage_bucket_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260824184500_restore_has_role_authenticated_execute_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260825180000_expand_support_ticket_categories_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260826023255_a405ac19-3482-43c6-b2de-ce2af897b3bd_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260827120000_has_role_answers_only_about_the_caller_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260827170000_record_demo_consumed_on_the_account_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260827180000_the_consent_table_was_built_twice_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260902090000_retire_demo_consumed_marker_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260902100000_free_pro_max_catalogue_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260902110000_commercial_usage_windows_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260902120000_mfa_recovery_credentials_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260902130000_account_session_authority_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260904090000_notification_preferences_and_history_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260904120000_ocade_organizations_and_membership_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260904130000_revoke_default_privilege_writes_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260904140000_organization_ownership_before_account_deletion_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260904150000_high_risk_organization_actions_require_recent_strong_auth_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260904160000_organization_capability_and_tool_policies_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260904170000_admin_operations_read_surfaces_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260904180000_status_incidents_and_maintenance_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260904190000_support_article_publishing_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260905090000_conversation_share_links_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260907003328_commercial_generation_permits_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260907011350_offline_usage_leases_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260907073536_claim_generation_transport_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260909120000_ocade_message_client_key_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260909130000_ocade_side_conversations_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260909140000_ocade_project_files_and_folders_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260909150000_ocade_output_provenance_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260909160000_ocade_message_citations_and_reactions_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260909170000_devices_platform_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260909180000_ocade_approvals_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260909190000_ocade_tasks_and_comments_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260909200000_ocade_monitors_and_browser_policy_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260910090000_policy_capability_account_storage_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260910100000_conversation_storage_is_the_account_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260910110000_one_read_policy_per_role_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260910120000_index_every_cascade_path_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260910130000_confirm_before_granting_workspace_access_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260910140000_conversation_trash_and_restore_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260910150000_a_task_can_belong_to_a_project_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260910160000_support_content_needs_a_case_grant_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260910170000_index_the_support_access_foreign_key_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260911090000_one_entitlement_authority_and_admin_grants_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260911120000_a_plan_change_reaches_the_subscription_row_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260912090000_one_library_for_everything_a_person_keeps_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260912120000_remove_the_database_of_the_products_ocade_is_not_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260913050000_two_organization_helpers_outlived_their_product_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260918081533_profiles_usage_authority_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260918132426_offline_signing_retry_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260919090000_atomic_browser_device_registration_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260920090000_device_revocation_is_not_client_writable_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260920100000_an_operator_can_find_any_account_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260920110000_regenerate_drops_turns_atomically_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260923090000_close_client_write_paths_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260923100000_retire_trash_payments_and_side_threads_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260925140000_drop_orphan_enums_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260926090000_ocade_jarvis_web_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260927090000_jarvis_device_identity_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260929090000_jarvis_execution_control_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260929100000_admin_device_removal_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260929110000_scoped_jarvis_controls_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260930090000_enrolled_accounts_need_their_second_factor_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260930091000_admin_changes_need_a_recent_second_factor_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260930092000_enrollment_cap_per_source_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260930092500_an_ended_session_stops_at_once_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260930093000_one_staff_authority_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260930093500_a_staff_refusal_reads_correctly_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260930094000_staff_can_turn_off_a_lost_second_factor_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260930095000_jarvis_schedules_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20260930096000_android_devices_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20261001090000_staff_authority_only_in_the_console_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20261001091000_web_push_subscriptions_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20261001092000_retire_browser_extension_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20261001093000_push_follows_the_session_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20261001094000_a_claimed_permit_is_settled_by_the_server_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20261001095000_a_factor_added_after_signing_in_needs_a_new_sign_in_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20261001095100_the_console_needs_a_sign_in_after_a_new_factor_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20261001095200_two_step_set_up_in_this_sign_in_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20261001096000_staff_act_within_their_own_reach_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20261001096100_a_profile_address_is_the_sign_in_address_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20261002090000_owner_customer_operations_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/rollback/20261003090000_owner_and_staff_consoles_on_ocade_in_rollback.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260720120222_c726faf2-f6d1-4d0c-9e47-9673aa43118b_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260720120249_bdd4f1d3-d4c4-4c34-b081-2d6c4097ba27_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721133830_b2cbc094-c460-48f3-b83d-6bf036acccc9_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721134240_2c1ea44a-fced-47ea-bcfd-35f528884460_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721134445_4eb84b03-6a68-40d0-9807-4579160d5272_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721134651_2bb0cf70-367a-4f56-b3f1-316e2169dee8_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721135143_0b16767c-014b-4e5c-8b9e-12375fdee710_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721135426_7ca3c6c6-09f8-4e19-aef2-ef225349c77b_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721135930_79977e44-6466-46ea-af1e-3e10bb1cc131_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721141946_382eee61-77fa-42d8-9b79-9c9c9b3195a3_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721142438_03071f4a-d755-4453-beea-10cd60c22e02_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721143021_71e195af-3680-4c89-be7c-b2d308c7ffcd_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721143529_267f9320-a8a8-4201-b074-064407905a75_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721144246_5e085aff-3cc9-4e69-a5cd-340b3e874977_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721144308_04ad5189-98bd-4055-987a-7d896a04cdd8_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721145409_97b93532-2d8c-4c35-a0ab-5d247f340a7a_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721145434_8280eace-1160-442d-88f7-1684c92485be_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721150351_1689e8de-f040-4796-bcd0-4976fea56113_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721150416_6c740641-3749-4958-8ca7-a5393e3feaf7_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721150450_7b63e109-84a8-4afe-94b1-e6420072c5f5_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721151128_8b196716-a97b-49aa-b37b-1e8b09d89101_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721151159_0c408ff6-94e9-427b-accf-8a37f4396eb6_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721151224_c158c078-599f-4d26-8144-6221fddac054_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721152101_c4b8b4e6-6d39-478f-a986-7da88cc3431f_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721152140_8be97c93-e5a2-494b-bf54-f83f9ae0f6e9_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721153321_92abb662-0ac2-4900-a2b6-5724104dd1bb_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260721160854_4e78525e-e484-4a81-b704-7df889e6d4e5_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260722090000_ocade_projects_outputs_memory_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260722100000_ocade_subscriptions_usage_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260722110000_ocade_automations_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260724211500_ocade_automation_worker_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260730190000_ocade_controlled_rollout_gates_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260803172048_07f01536-9981-4240-abe2-06d98cc07387_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260806120000_ocade_attachment_deletion_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260815123219_b6afc017-4c53-405f-b498-96cb9cfb16f3_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260815123309_e4ac318c-6878-44d5-99d8-3aa45bab8f57_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260815123358_a5f5c31d-c096-4e93-a7db-8a0912f4566c_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260815123622_6d8f7052-38cb-4117-a197-5e7a74161b69_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260815193752_harden_security_definer_execute_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260815213627_ocade_billing_support_ledger_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260815215000_ocade_billing_support_privilege_hardening_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260816082730_5e025ed8-1236-4e91-a86b-01fc1d248b99_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260816091131_cf164c67-50c9-4dff-96ac-9035b8f7bdb8_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260816094050_f439d6e0-528d-45e2-a4f5-7914e07c7b2f_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260817153000_atomic_device_revocation_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260823090000_payment_webhook_audit_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260823110000_atomic_payment_webhook_state_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260823111000_payment_entitlement_invoker_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260823140000_legal_consent_receipts_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260824112227_live_supabase_security_hardening_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260824112646_rls_and_foreign_key_performance_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260824112850_consolidate_permissive_rls_policies_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260824113306_fix_automation_enqueue_ambiguity_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260824114319_provision_messenger_storage_bucket_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260824184500_restore_has_role_authenticated_execute_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260825180000_expand_support_ticket_categories_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260826023255_a405ac19-3482-43c6-b2de-ce2af897b3bd_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260827120000_has_role_answers_only_about_the_caller_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260827170000_record_demo_consumed_on_the_account_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260827180000_the_consent_table_was_built_twice_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260902090000_retire_demo_consumed_marker_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260902100000_free_pro_max_catalogue_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260902110000_commercial_usage_windows_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260902120000_mfa_recovery_credentials_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260902130000_account_session_authority_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260904090000_notification_preferences_and_history_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260904120000_ocade_organizations_and_membership_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260904130000_revoke_default_privilege_writes_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260904140000_organization_ownership_before_account_deletion_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260904150000_high_risk_organization_actions_require_recent_strong_auth_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260904160000_organization_capability_and_tool_policies_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260904170000_admin_operations_read_surfaces_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260904180000_status_incidents_and_maintenance_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260904190000_support_article_publishing_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260905090000_conversation_share_links_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260907003328_commercial_generation_permits_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260907011350_offline_usage_leases_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260907073536_claim_generation_transport_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260909120000_ocade_message_client_key_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260909130000_ocade_side_conversations_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260909140000_ocade_project_files_and_folders_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260909150000_ocade_output_provenance_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260909160000_ocade_message_citations_and_reactions_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260909170000_devices_platform_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260909180000_ocade_approvals_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260909190000_ocade_tasks_and_comments_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260909200000_ocade_monitors_and_browser_policy_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260910090000_policy_capability_account_storage_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260910100000_conversation_storage_is_the_account_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260910110000_one_read_policy_per_role_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260910120000_index_every_cascade_path_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260910130000_confirm_before_granting_workspace_access_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260910140000_conversation_trash_and_restore_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260910150000_a_task_can_belong_to_a_project_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260910160000_support_content_needs_a_case_grant_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260910170000_index_the_support_access_foreign_key_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260911090000_one_entitlement_authority_and_admin_grants_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260911120000_a_plan_change_reaches_the_subscription_row_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260912090000_one_library_for_everything_a_person_keeps_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260912120000_remove_the_database_of_the_products_ocade_is_not_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260913050000_two_organization_helpers_outlived_their_product_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260918081533_profiles_usage_authority_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260918132426_offline_signing_retry_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260919090000_atomic_browser_device_registration_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260920090000_device_revocation_is_not_client_writable_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260920100000_an_operator_can_find_any_account_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260920110000_regenerate_drops_turns_atomically_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260923090000_close_client_write_paths_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260923100000_retire_trash_payments_and_side_threads_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260925140000_drop_orphan_enums_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260926090000_ocade_jarvis_web_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260927090000_jarvis_device_identity_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260929090000_jarvis_execution_control_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260929100000_admin_device_removal_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260929110000_scoped_jarvis_controls_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260930090000_enrolled_accounts_need_their_second_factor_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260930091000_admin_changes_need_a_recent_second_factor_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260930092000_enrollment_cap_per_source_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260930092500_an_ended_session_stops_at_once_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260930093000_one_staff_authority_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260930093500_a_staff_refusal_reads_correctly_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260930094000_staff_can_turn_off_a_lost_second_factor_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260930095000_jarvis_schedules_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20260930096000_android_devices_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20261001090000_staff_authority_only_in_the_console_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20261001091000_web_push_subscriptions_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20261001092000_retire_browser_extension_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20261001093000_push_follows_the_session_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20261001094000_a_claimed_permit_is_settled_by_the_server_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20261001095000_a_factor_added_after_signing_in_needs_a_new_sign_in_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20261001095100_the_console_needs_a_sign_in_after_a_new_factor_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20261001095200_two_step_set_up_in_this_sign_in_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20261001096000_staff_act_within_their_own_reach_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20261001096100_a_profile_address_is_the_sign_in_address_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20261002090000_owner_customer_operations_verify.sql` | COMPLETE | BLOCKED |
| `supabase/verification/20261003090000_owner_and_staff_consoles_on_ocade_in_verify.sql` | COMPLETE | BLOCKED |
| `tsconfig.json` | COMPLETE | COMPLETE |
| `vite.config.ts` | COMPLETE | COMPLETE |
| `vitest.config.ts` | COMPLETE | COMPLETE |
| `wrangler.json` | COMPLETE | COMPLETE |


### Second inspection coverage2026-10-05: package-lock.json
- PASS structured JSON inspection only: all bytes parsed, all545 package records and every substantive field reviewed in complete ranges0-109,110-219,220-329,330-439,440-544. All544 package source/integrity fields structurally checked; six bundled WASI metadata exceptions cross-checked against parent inBundle/bundleDependencies. Funding/license values inventoried and root maps match package.json. Opaque URL/hash bytes were structurally inspected rather than claiming an8226-line literal reread. Required cross-platform optional packages and contract-bound transitive versions must stay; no installation, update, license certification or vulnerability/runtime claim.


### Second inspection coverage2026-10-05: imports/ocade-jarvis/ocade jarvis 25-09.zip
- PASS archive structure/provenance only: full66-entry central inventory inspected; every member read with ZIP CRC validation and SHA256, zero duplicate names. All58 non-directory members exactly match separately completed second-pass source-original files, including ui.py and vendor bundle;8 directories are empty metadata. Semantic findings from those exact members remain conditional donor evidence. No extraction, installation, launch, import or production integration.


### Second inspection coverage2026-10-05: imports/UI OCADE JARVIS.zip
- PASS structure/decode and full semantic member inspection only: all38 ZIP entries read with CRC/SHA256 and full inventory, zero duplicate names; all30 text members fully reread, including907-line lockfile,650-line OrbCanvas and887-line CSS in complete ranges. All8 PNGs fully decoded/verified; four duplicate pairs are D050. Source findings F231-F236 recorded immediately, plus conditional adaptation opportunity D051. No archived build/install/launch, physical mobile/Apple behavior, current-runtime defect or integration proof claimed.


### Second inspection coverage2026-10-05: docs/audits/2026-09-27-jarvis/OCADE-JARVIS-ERROR-AUDIT-01.md
- PASS full semantic historical document review only: all4132 lines covered.1155 exact matching text lines reuse already completed2590-line handoff review with per-block line mapping in work/historical-delta-0.json; all2977 unique lines fully numbered and reviewed in1-450,451-900,901-1400,1401-2050,2051-2440,2441-2797,2798-3385,3386-3750,3751-4132 ranges. Historical57 findings/855 counters and old SHAs remain historical, not current tests or totals. F096 reference errors reconfirmed and F237 phase-label ambiguity immediately recorded; no historical runtime/security reproduction or product mutation.


### Second inspection coverage2026-10-05: docs/audits/2026-09-27-jarvis/OCADE-JARVIS-current-main-master-ledger-2026-09-26.md
- PASS complete semantic historical review with validated reuse, not a literal3830-line output claim:3827 mapped lines exactly equal already fully reviewed canonical error-audit text after trailing-whitespace normalization only; all1110 differences are zero-vs-two trailing spaces, with leading/semantic text unchanged. Three unique lines3828-3830 fully read. Mapping, complete line-set partition and SHA256 in work/historical-delta-1.json verified by verify-historical-reuse.py. Earlier unbounded raw delta output was truncated and not credited; verified semantic comparison repaired coverage. F096/F237 repeat here; old52 findings/855 counters remain historical, no current platform/source-test PASS inferred.


## Findings

### F-001 — Major / FAIL — Bundled desktop wake manifest is rejected after a clean checkout
- Found by: SOURCE REVIEW with direct cryptographic cross-check; consistent with the interrupted runtime test failure, independently verified now.
- Reproduction: from audited main, import `ocade_wake` and call `verify()`; separately verify both checkout bytes and `git show HEAD:jarvis-runtime/wake/manifest.json` with `ocade_update.verify_manifest`. Both fail. Convert only an in-memory copy from LF to CRLF and repeat: signature succeeds. No repository bytes were changed.
- Expected: the shipped signed bundled model verifies on every clean Windows/macOS/Linux checkout and package build.
- Actual: checkout and Git blob are LF and produce `UpdateRefused: The update manifest is not signed by OCADE`; wake startup produces `WakeUnavailable: The wake model's manifest is not OCADE's`. The existing signature validates the CRLF variant.
- Location: `jarvis-runtime/ocade_wake.py:131-144` (`verify`); `jarvis-runtime/ocade_update.py:63-73` (`verify_manifest`); `scripts/wake/sign_manifest.py:26-29`; `scripts/wake/train.py:503`; `.gitattributes` JSON LF rule; `jarvis-runtime/wake/manifest.json` and `manifest.sig`.
- Root cause: signing consumes the working-tree bytes; training uses platform-default newline translation. Git normalizes the signed JSON to LF, changing the signed bytes. The signer verifies only pre-commit bytes, not the normalized artifact.
- User impact: packages built from current clean main cannot start desktop Wake Mode. Fail-closed verification correctly prevents use; it must not be bypassed.
- Recommended fix (not executed): emit canonical LF bytes before signing, sign those bytes with the release owner's key, preserve exact signed bytes through Git and packaging, and verify from a clean checkout and final package on all target platforms.
- Release blocker: yes for bundled desktop wake. Physical audio accuracy remains separately untested.


### F-002 — Major / FAIL — Android bypasses the canonical wake-manifest signature authority
- Found by: SOURCE REVIEW; cross-checked builder and loader independently.
- Reproduction: inspect `android/build.py` wake asset copy loop and `WakeService.load()`. The build copies only `manifest.json` and the NPZ; the service parses the manifest and checks the NPZ against its supplied hash. No `manifest.sig` is packaged or verified. F-001 establishes that the desktop rejects these exact manifest/signature bytes while the Android loader has no equivalent signature check.
- Expected: one signed manifest verification authority governs install, health, update, rollback and wake startup on desktop and Android.
- Actual: Android trusts a hash supplied by the same unsigned manifest. Its loader does not authenticate the manifest with the pinned release key.
- Location: `android/build.py:56-60`; `android/src/in/ocade/app/WakeService.java:105-111` (`load`); compare desktop `ocade_wake.verify` and `ocade_update.verify_manifest`.
- Root cause: Android ports model hashing but omits Ed25519 manifest authentication and the signature asset.
- User impact: wake integrity behavior differs across platforms and cannot prove the required common release provenance. APK signing provides a separate package-level boundary; this finding does not claim arbitrary production APK tampering is possible.
- Recommended fix (not executed): package and verify the same canonical manifest/signature with the trusted public key before parsing/loading; test wrong signer, modified manifest/model and final APK asset identity.
- Release blocker: yes for the explicit common signed-wake authority requirement.

- Packaged-artifact cross-check2026-10-04: installed emulator base.apk (SHA25675f6c99a64070868bdf5420a66d5b6e4b0dc0c07df1f07f3bd620b1dfecaed8e,308039bytes,ZIP CRC PASS) lacks assets/wake/manifest.sig. Protocol/NPZ exactly match main; packaged manifest has97CRLF versus main LF, normalized text/JSON match. Passive byte inventory confirms omission in this development APK; no signature probe repeated. Full Java/DEX alignment to main remains UNVERIFIED and SystemUI ANR blocks foreground evidence. See work/practical-installed-apk-results.json.


### F-003 — Major / FAIL — Undo backups collide and overwrite the original
- Found by: SOURCE REVIEW; reproduced with disposable files and a fixed clock, no product files changed.
- Reproduction: back up `sales.xlsx`, change its bytes, back it up again within the same second to the same undo directory. Both calls return the same path, only one backup remains, and the first backup now contains the edited bytes. Same-basename files from different directories collide too.
- Expected: each edit has a unique immutable backup, so undo can restore the right original.
- Actual: backup identity is second-resolution time plus basename; `shutil.copy2` silently overwrites the existing backup.
- Location: `jarvis-runtime/ocade_sheets.py:208-215` (`backup`); duplicate Word backup naming at `ocade_documents.py:162-163`; shared callers `ocade_computer.py:704-706` (`_keep`) and restore at `:730-733` (`_put_back`).
- Root cause: no unique/exclusive backup creation or source-path identity; undo closures retain a path whose contents can later change.
- User impact: rapid repeated edits or similarly named files destroy recovery evidence and can restore the wrong workbook/document/file.
- Recommended fix (not executed): create backups with exclusive unique names, bind backup metadata to the exact source and edit identity, and test rapid same-file edits plus identical basenames in separate directories across file/Office undo.
- Release blocker: yes for safe overwrite/undo fidelity.


### F-004 — Major / FAIL — Spreadsheet file editing destroys unrelated formatting while reporting success
- Found by: SOURCE REVIEW with disposable workbook reproduction.
- Reproduction: create A1 with underline, strike, superscript, vertical top alignment, 30-degree rotation, indent 2 and shrink-to-fit. Invoke `ocade_sheets.edit_file` with a format operation requesting only bold and horizontal center. Reopen the saved workbook.
- Expected: bold/center changes apply; every unrequested style attribute remains intact.
- Actual: `ok=True`, but underline/strike/superscript become None; vertical alignment becomes None, rotation becomes 0, indent becomes 0, shrink-to-fit becomes None.
- Location: `jarvis-runtime/ocade_sheets.py:284-293` (`edit_file`, format branch).
- Root cause: reconstructs new `Font` and `Alignment` from a small subset of existing attributes instead of copying and changing requested fields.
- User impact: the no-Excel fallback silently damages document formatting despite the required preservation contract. Excel COM behavior is not claimed to have this same defect.
- Recommended fix (not executed): copy existing style objects and change only explicitly requested properties; verify complete style fidelity after save/reopen, including macros and unsupported workbook-feature refusal.
- Release blocker: yes for preservation-safe spreadsheet file edits.


### F-005 — Major / FAIL — Coordinate safety gate fails open when accessibility inspection errors
- Found by: SOURCE REVIEW and isolated simulated cross-check (no OS input).
- Reproduction: run `screen_click` with a fresh observation and a fake GUI. When `ocade_accessibility.gate_at` returns a payment refusal, status is blocked and no click occurs. Make that same gate raise `RuntimeError`: status becomes done and the fake GUI records a click.
- Expected: unreadable safety-critical target inspection refuses/pauses input until a safe target can be verified.
- Actual: any gate exception returns None, which is treated as permission to click. `gate_at` also returns None if its UIA dependency cannot import; protected-owner lookup suppresses errors to an empty owner.
- Location: `jarvis-runtime/ocade_computer.py:1028-1036` (`_gate`), click dispatch `:1066-1080`; `ocade_accessibility.py` `gate_at`, `_owner` and `_protected` error paths.
- Root cause: fail-open exception handling equates inspection failure with a non-sensitive target.
- User impact: payment, human-authentication or destructive controls can lose their policy gate when accessibility is unavailable. No live purchase/security action was attempted.
- Recommended fix (not executed): refuse or hand off when target sensitivity/process identity cannot be established; separate safe fallback observation from permission; test provider exceptions, missing UIA, protected/elevated windows and coordinates over payment controls.
- Release blocker: yes for safe physical control.


### F-006 — Major / FAIL — Already-cancelled coordinate actions still execute
- Found by: SOURCE REVIEW and isolated simulated cross-check (no OS input).
- Reproduction: set a `threading.Event` before `Computer.run(screen_click, cancel=event)` with a valid observation, fake GUI and non-sensitive gate. It reports done and records a click. Existing `test_stop_ends_typing` covers short typing but not this click branch.
- Expected: a cancelled action performs no further physical input and returns a stopped outcome.
- Actual: click/drag/keys/scroll and long-text paste branches do not check the cancellation token before input; only short typing checks it.
- Location: `jarvis-runtime/ocade_computer.py:1048-1127` (`_screen`), especially `:1080`; cancellation token enters through `ocade_device.Agent._execute` but that function does not pre-check it either.
- Root cause: cancellation enforcement differs by input branch and is absent at shared dispatch.
- User impact: STOP/Pause/device revoke racing with dispatch can permit a late physical action. Simulated reproduction proves the branch behavior; real revoke-mid-action evidence is still pending.
- Recommended fix (not executed): re-check cancellation immediately before every input and within multi-step input, with stopped settlement; test STOP between validation and click/paste/drag/key dispatch.
- Release blocker: yes for synchronous STOP.

- Additional cross-check: a disposable workbook edit with an already-set cancellation event and `engine='file'` returned `ok=True` and saved A1 from `original` to `changed`. `ocade_sheets.edit:377-391` passes the token only to Excel; `edit_file:251-374` receives no token. STOP also fails before/through file-engine spreadsheet edits. Include this engine in the recommended cancellation tests.


### F-007 — Major / PARTIAL — Desktop stale-coordinate validation misses same-window layout changes
- Found by: SOURCE REVIEW; cross-check of the observed state contract and `_stale` return.
- Reproduction: hold an observation and keep desktop x/y/w/h, monitor count and foreground title unchanged. Move/resize that window within the desktop or change its contents under program control. These changes are absent from `_geometry`, so `_stale` returns None. A simulated equal-geometry check confirms acceptance; real visual movement remains pending.
- Expected: window move/resize, scroll, popup, content mutation, DPI changes and navigation invalidate coordinates.
- Actual: compares only total desktop geometry, monitor count, title and age up to 60 seconds. No window identity/rectangle, DPI, content generation or fingerprint is stored/compared.
- Location: `jarvis-runtime/ocade_computer.py:894-909` (`_geometry`), `observe`, and `:1012-1025` (`_stale`).
- Root cause: desktop geometry/title are used as a proxy for target scene identity.
- User impact: coordinates can land on a different control while still considered fresh, especially after asynchronous app updates or automated window changes.
- Recommended fix (not executed): bind input to fresh target identity/rectangle/DPI and scene generation, invalidate after visual mutations, and prove same-title popups, window moves, scrolling, navigation and DPI cases with real input safely confined to test apps.
- Release blocker: yes pending real reproduction or proven equivalent mitigation; PARTIAL marks the missing physical cross-check.


### F-008 — Major / FAIL — Small read limits do not bound file allocation
- Found by: SOURCE REVIEW and a disposable file reproduction.
- Reproduction: create a 10,000,000-byte text file; call `ocade_documents.extract_text(path, 100)` with a spy around `Path.read_bytes`. It allocates all 10,000,000 bytes before returning 100 characters. Inspect general `file_read` for the same read-then-slice sequence.
- Expected: a bounded preview reads only the permitted prefix and keeps memory/latency proportional to the preview size.
- Actual: entire files are loaded before truncation. OOXML extraction reads every matching archive entry and joins all text before slicing. Spreadsheet edits eagerly materialize every selected cell; validation accepts `A1:XFD1048576`, `A:A` and out-of-grid `ZZZ9999999` without numeric/area limits. The enormous-range/ZIP consequences are source evidence, not an executed exhaustion test.
- Location: `jarvis-runtime/ocade_documents.py:33-38,43-84` (`_zip_parts`, `extract_text`); `ocade_computer.py:502`; `ocade_sheets.py:35-36,56-63,272-274`.
- Root cause: output limits are applied after allocation; range validation is syntactic and has no workbook bounds or maximum work size.
- User impact: innocuous preview of a large local log/document or a generated wide-range edit can exhaust memory, freeze the device agent and delay STOP/background work.
- Recommended fix (not executed): bounded stream reads/decompression, per-entry and total archive/workbook limits, numeric Excel bounds and operation-area budgets, cancellation during iteration; prove large/sparse files and safe rejection without exhaustive allocation.
- Release blocker: yes for resource-bounded device execution; no destructive stress test was performed.

- Additional ordinary cross-check2026-10-04: `jarvis-runtime/ocade_discovery.py:162-175` (_readme) loads an entire README via read_text before slicing6000/1500. Disposable10,000-byte fixture and read_text spy read10,000 while preview returned6000. Same resource-bound defect reaches SDK app discovery; no stress or exhaustion test executed.

- F008 second-pass ordinary output extension: Computer._run ocade_computer.py:771-791 communicates/drains child output but retains all bytes until result completion, slicing MAX_OUTPUT only afterward. Verbose ordinary builds/tests can allocate unbounded logs within timeout; no output/exhaustion stress run. Bound retained output during drainage while preserving diagnostic tail and cancellation.


### F-009 — Major / PARTIAL — Office verification reopen restores macro execution policy too early
- Found by: SOURCE REVIEW, cross-checked independently in both Office adapters.
- Reproduction: follow the first open and subsequent verification reopen for an agent-opened `.xlsm`/`.docm`. Each first open sets `AutomationSecurity=3`, then immediately restores the user's prior setting. The saved file is later reopened outside that security scope.
- Expected: every autonomous open, including read-back verification, disables workbook/document macros.
- Actual: `Workbooks.Open`/`Documents.Open` on the verification branch uses the restored prior policy. A macro-enabled document may therefore run startup code during verification when that policy permits macros. No malicious macro or real Office execution was attempted; real policy-dependent behavior is pending.
- Location: `jarvis-runtime/actions/ocade_excel.ps1:63-66,163-168`; `actions/ocade_word.ps1:47-51,121-124`.
- Root cause: macro suppression encloses only the initial open; the second open is treated as a harmless read.
- User impact: a document treated as data can execute local code during an autonomous edit verification, subject to installed Office policy.
- Recommended fix (not executed): use the same force-disable scope for every open/reopen, restore host settings in a reliable finally block, and prove with harmless startup-macro fixtures under several policies and existing Office instances.
- Release blocker: yes pending platform reproduction or proof of an equivalent mitigation.


### F-010 — Major / FAIL — Supabase generated types omit the new unlimited-grants table
- Found by: SOURCE REVIEW and fresh required-gate execution by the support reviewer.
- Reproduction: run `node scripts/check-supabase-types.mjs` on audited main. Exit 1: missing `ocade_unlimited_grants`. Cross-check migration creation against the generated type map.
- Expected: generated schema types include every table created by main's applied migration set, and the required verification gate passes.
- Actual: the migration creates the table but the committed type map lacks it; `verify:full` fails.
- Location: `scripts/check-supabase-types.mjs:197`; `supabase/migrations/20261003090000*` table creation at line 86; `src/integrations/supabase/types.ts`; `scripts/verify-full.mjs` type gate.
- Root cause: schema migration and generated type snapshot were not synchronized.
- User impact: required CI/release verification fails and typed consumers cannot represent the added authority table. This does not by itself prove live unlimited-grant authorization is broken.
- Recommended fix (not executed): regenerate from a database containing the complete migration set; preserve RPC-only grant access and re-run schema/type verification.
- Release blocker: yes, required verification gate.


### F-011 — Minor / FAIL — Reachability gate retains a deleted-file exemption
- Found by: SOURCE REVIEW and fresh gate execution by the support reviewer.
- Reproduction: run `node scripts/check-reachability.mjs`; exit 1 reports stale exemption `src/ffprobe-static.d.ts`. Cross-check tracked files: declaration is absent.
- Expected: exemption inventory matches surviving source files after cleanup.
- Actual: checker references a deleted declaration and fails `verify:full`/CI.
- Location: `scripts/check-reachability.mjs:61-62`; `scripts/verify-full.mjs:35`.
- Root cause: declaration removal did not remove its checker exemption.
- User impact: required release validation fails despite this specific declaration no longer being reachable or shipped.
- Recommended fix (not executed): retire only the proven stale exemption and re-run reachability against every retained source file.
- Release blocker: yes as a required gate, though the defect's product impact is Minor.


### F-012 — Minor / FAIL — Monochrome gate misclassifies a React error citation as a color
- Found by: SOURCE REVIEW and fresh gate execution by the support reviewer.
- Reproduction: run `node scripts/check-monochrome.mjs`; exit 1 identifies `React #418` in a source comment as a non-neutral hex color.
- Expected: inspect actual UI/CSS color tokens; a diagnostic reference in prose is permitted.
- Actual: raw-text regex reads the numeric citation as a three-digit hex token, failing required verification.
- Location: `scripts/check-monochrome.mjs:52-62`; `src/lib/after-hydration.ts:6`; `scripts/verify-full.mjs:37`.
- Root cause: color scanning does not distinguish comments/prose from syntax carrying a rendered color.
- User impact: CI/release verification is blocked by a false positive; this check does not prove a colored UI element exists.
- Recommended fix (not executed): scan appropriate syntax/tokens or exclude comments safely; prove real forbidden colors remain rejected and numeric error references pass.
- Release blocker: yes as a required gate; no product formatting change was made.


### F-013 — Minor / PARTIAL — Offline artifact builder trusts stale or incomplete cached bytes
- Found by: SOURCE REVIEW and isolated release-tool reproduction outside the repository.
- Reproduction: seed a disposable `.artifact/artifact.bin` with a 64-byte container bearing accepted magic/version 3/tensor-count 1/metadata-count 1; select `https://example.invalid/...` as artifact source; run the audited `build-offline-artifact.mjs --no-upload` from that disposable directory.
- Expected: selected source/release identity is bound to cached bytes, incomplete data is rejected or fetched safely, and no success manifest is generated for unverified data.
- Actual: exit 0 and a release manifest for the seeded bytes, without fetching the selected source. Existing cache skips fetch and only superficial header checks run.
- Location: `scripts/build-offline-artifact.mjs:58-67,76-86,113`.
- Root cause: file existence is treated as valid reusable cache independently of selected source, with insufficient structural validation at this step.
- User impact: a maintainer retry/source change can silently reuse stale or truncated artifacts. The workflow's separate generation-proof gate remains a mitigation; no broken production release or upload is claimed.
- Recommended fix (not executed): bind cache to source/release identity or require explicit reuse, use atomic verified downloads, reject structural truncation and require final generation proof before upload.
- Release blocker: PARTIAL; shipping impact depends on proof-gate coverage and remains to be reconciled.


### F-014 — Major / FAIL — Support cases authorize every conversation and every Support reader
- Found by: SOURCE REVIEW, database migration/application caller cross-checks and isolated database-policy reproduction.
- Reproduction contract: Owner opens a case for Customer A. A different Support member with `cases.read` can discover all open cases, use that case id and request any other conversation owned by A. The final SQL predicate checks generic permission, open case and customer ownership, with no assigned staff or selected conversation check.
- Expected: the Owner/Admin authority requires named Support with one scoped account/conversation authorization, not account-wide content exposure to every Support reader.
- Actual: case schema has customer/opened-by/reason/expiry but no assignee/conversation binding. The application lists all open cases and all that customer's conversation titles, then the RPC permits their messages. Source coverage of later migrations found no superseding scope check. No live private conversation was read.
- Location: `supabase/migrations/20260930093000_one_staff_authority.sql:84-99,497-526,550-580,845` (`ocade_case_open`, `ocade_case_messages`); `src/lib/staff.functions.ts:621-680`; compare `docs/OWNER_ADMIN_BACKEND.md` named Support scope. Existing `staff-authority.test.ts:499-510` covers another customer but not another conversation/unassigned staff.
- Root cause: case grants bind only the customer, while every permissioned staff member shares case discovery/read authorization.
- User impact: opening one support case exposes unrelated conversations and their titles to staff not named for that case, violating least privilege and the stated support boundary.
- Recommended fix (not executed): bind the approved case to explicit staff/account/conversation scope, enforce it inside all SQL and server list/read paths, and prove unrelated staff, same-customer other conversations, expiration, closure and revocation fail closed.
- Release blocker: yes pending isolated proof or contrary final authority evidence.

- Isolated proof completed: `work/check-case-scope.mjs` applied all 136 current migrations to the actual DatabaseTwin with owner, two Support users, one customer and two same-customer conversations. Owner opened a case; unassigned Support B successfully read the other conversation's seeded content. No live content was accessed. This upgrades the finding to FAIL and confirms the release blocker.


### F-015 — Minor / FAIL — Dead-control checker accepts an inert button beside an active button
- Found by: SOURCE REVIEW and isolated checker reproduction outside the repository.
- Reproduction: a disposable `Probe.tsx` contains `<button>Does nothing</button>` followed by a button with `onClick`. Run `check-dead-controls.mjs --json`: exit 0, no findings. Remove the second button: the first correctly produces a no-handler finding and exit 1.
- Expected: each opening control tag is checked independently.
- Actual: 2,500 characters after the first tag include the sibling's handler and mask the inert control.
- Location: `scripts/check-dead-controls.mjs:75,189`.
- Root cause: fixed-width text context crosses JSX control boundaries.
- User impact: required validation can silently accept reachable inert controls; no particular shipped button is alleged from this fixture alone.
- Recommended fix (not executed): inspect the exact opening JSX tag with the existing brace scanner or a syntax parser, and prove neighboring/nested active/inert controls independently.
- Release blocker: incomplete real-UI assurance; this gate false negative is confirmed, product dead-control inventory remains pending.


### F-016 — Major / FAIL — Usage settlement ignores backend refusal and outage
- Found by: SOURCE REVIEW and isolated execution of the actual boundary implementation.
- Reproduction: transpile `boundary.ts` in a disposable fixture with fake environment/fetch; return HTTP 500, HTTP 403, then HTTP 200 with false RPC result. Both finalize and release resolve successfully in every case (two attempted requests per case). No production request was made.
- Expected: settlement is acknowledged before marking a permit settled, and refusal/outage remains recoverable/accounted.
- Actual: finalize/release inspect neither HTTP status nor RPC outcome. The shared handler marks `settled=true` before its callback, suppresses errors and emits the final answer.
- Location: `supabase/functions/_shared/boundary.ts` (`finalizePermit`, `releasePermit`); `_shared/edge-handler.ts:496-502,545`.
- Root cause: network promise completion is treated as successful accounting; no acknowledged result or durable reconciliation.
- User impact: a delivered answer can remain unaccounted when reservations later expire/release, undermining usage limits and audit integrity.
- Recommended fix (not executed): validate status and decoded settlement outcome, use bounded retries/durable reconciliation, and distinguish unacknowledged accounting from final settlement. Prove denial/outage/retry/idempotent settlement.
- Release blocker: yes for usage/accounting reliability.


### F-017 — Minor / FAIL — Wake holdout evidence includes held-out speakers' negative speech
- Found by: SOURCE REVIEW and pure job-name reproduction; no data generation or training writes.
- Reproduction: generate job metadata for Microsoft Ravi's ordinary negative speech: filename `speech_2.wav`; the trainer derives voice `2` from the stem, which does not match holdout `ravi`/`susan`. Cross-check provenance: it retains the real voice but this filter does not use it.
- Expected: speaker holdout excludes that speaker from positive/negative training and background/babble streams.
- Actual: held-out ordinary speech enters training and stream backgrounds. This invalidates a claim of fully unseen-speaker validation; no physical detector-accuracy failure is claimed.
- Location: `scripts/wake/make_data.py:86-93`; `scripts/wake/train.py:142-145`.
- Root cause: negative filename index is mistaken for speaker identity despite explicit provenance metadata.
- User impact: wake robustness evidence is overstated and can hide unfamiliar-speaker false positives/negatives.
- Recommended fix (not executed): use provenance voice IDs for every clip/background source, prove speaker-set disjointness and rerun training/evaluation plus physical voice tests.
- Release blocker: accuracy evidence remains incomplete; severity concerns the validation defect, not a proven wake-recognition failure.

- F017 second-pass conditional extension: scripts/wake/train.py135-140 can leave held positives empty for a requested unavailable voice; Windows.one202-207 uses clips or training positives, while444-447 reports heldOutVoices. Stream454-455 can receive an empty held set with no injected positives. This silently substitutes training positives in nominal unseen-window proof. No retraining or claim current packaged model used that corpus. Recommended explicit nonempty requested-holdout assertion and None-vs-empty distinction. Existing F017 remains one finding.


### F-018 — Major / FAIL — Recovery reports removed 2FA when factor listing fails
- Found by: SOURCE REVIEW and isolated actual-source VM reproduction.
- Reproduction: authenticated recovery fixture consumes a valid code, then `admin.mfa.listFactors` returns `{data:null,error:service unavailable}`. Actual result is `ok:true`, zero factor deletions, session revocation and a success notification. Successful baseline lists/deletes one factor. No live account was changed.
- Expected: factor-read failure produces a truthful retryable failure and no claim that two-step verification was removed.
- Actual: the listing error is discarded, zero factors are treated as success, and the valid code is already consumed. Notification says two-step verification was turned off.
- Location: `src/lib/security/recovery.functions.ts:149-160,174-193`; existing tests omit failed factor-listing branch.
- Root cause: destructures only `data`, not `error`, and equates missing data with an empty confirmed factor list after irreversible code consumption.
- User impact: lost-phone user remains locked out with a spent recovery code, revoked sessions and misleading security notice.
- Recommended fix (not executed): validate factor listing before consumption where feasible; use retry-safe recovery state, check all deletion/revocation outcomes and verify final factor state. Test read/delete/revoke outages and retry behavior.
- Release blocker: yes for trustworthy account recovery.


### F-019 — Major / FAIL — Delegated staff can restore powers beyond their own reach
- Found by: SOURCE REVIEW and isolated all-136-migration DatabaseTwin reproduction.
- Reproduction: Support has delegated `staff.manage` but lacks `usage.manage`; target Admin is explicitly denied `usage.manage`. Support calls `ocade_staff_set_permissions(target,'{}','{}',reason)`. Result: changed=true and target `usage.manage=true` despite caller not holding it. No live staff records changed.
- Expected: nonowners cannot expand another staff member's effective permissions beyond their own authority, including by removing denials.
- Actual: validation checks only explicitly added `p_granted`; clearing `p_denied` silently restores role-default permissions.
- Location: `supabase/migrations/20261001096000_staff_act_within_their_own_reach.sql:104-110` (`ocade_staff_set_permissions`).
- Root cause: requested grant overrides are compared instead of effective before/after permission sets.
- User impact: delegated staff can undo the Owner's deliberate billing/security/customer restrictions and indirectly confer powers they do not possess.
- Recommended fix (not executed): lock/recheck the target record and compare newly effective permissions with caller authority; prove role defaults, denial removal, explicit grants, concurrent edits and owner exception.
- Release blocker: yes, staff authorization escalation.

- Verification gap cross-checked: `supabase/verification/20261001096000_staff_act_within_their_own_reach_verify.sql:11-14` only checks that the function text contains “hold yourself”; it does not execute a denied-reset transition. It passes despite the reproduced effective-permission bypass. Keep the historical proof, but add adversarial isolated effective-permission tests in any future authorized fix.


### F-020 — Minor / PARTIAL — Visual journey can label a failed dialog setup as a pass
- Found by: SOURCE REVIEW; setup-failure branch cross-checked against assertions.
- Reproduction contract: opening Devices/Settings throws in a screen's `act`; the journey catches and discards it, then evaluates only base-page overflow/errors and saves a screenshot labeled as the requested screen. No live dialog failure is claimed.
- Expected: failed setup fails that screen check; target dialog/page is visibly asserted before capture.
- Actual: no target-visible postcondition distinguishes the intended dialog from the underlying page.
- Location: `scripts/e2e/visual-journey.mjs:45-80,105`.
- Root cause: setup exception suppression plus general assertions unrelated to target state.
- User impact: screenshots and PASS labels can overstate UI/mobile coverage and conceal unreachable controls.
- Recommended fix (not executed): fail setup explicitly, assert intended state and capture that state; prove click/navigation failures do not become PASS.
- Release blocker: evidence gap; real UI coverage remains pending.
- Related meaningful coverage limitation: `scripts/e2e/final-journey.mjs:42-43,94,125` excludes JARVIS/admin, caps initial controls at 40 and catches click errors. Its broad header is not evidence that every route/control was tested. Record this journey as PARTIAL where those limits apply.


### F-021 — Minor / FAIL — Offline proof mistakes the CPU-only flag for a file path
- Found by: SOURCE REVIEW and fresh nonmutating CLI reproduction.
- Reproduction: `node scripts/prove-offline-artifact.mjs --cpu-only`; fails ENOENT while statting `<repo>/--cpu-only`, before opening a browser or writing artifacts.
- Expected: flag-only invocation selects the default `.artifact/artifact.bin` and CPU proof mode.
- Actual: positional argument parsing uses `process.argv[2]` as the artifact while independently recognizing the named flag.
- Location: `scripts/prove-offline-artifact.mjs:18,22,24`.
- Root cause: no separation of named options and positional paths.
- User impact: advertised CPU-only fallback proof cannot run in that invocation form; explicit-path invocation remains to be tested.
- Recommended fix (not executed): use minimal option/positional parsing and prove default/explicit paths with and without CPU-only.
- Release blocker: proof-tool defect; browser CPU inference itself is not proven broken by this CLI failure.
- Related evidence limitation: line 499's reported GPU layers are inferred from requested layers/adapter, not backend telemetry; actual GPU offload remains PARTIAL until confirmed by runtime evidence.


### F-022 — Minor / FAIL — Retained license/evidence documents link to absent files
- Found by: SOURCE REVIEW and tracked-file/existence cross-check.
- Reproduction: follow `LICENSE:65-66` to `release/THIRD_PARTY_NOTICES.md` and `docs/DEFERRED_GEMINI_ISSUES.md:3` to `docs/FINAL_REPORT.md`; neither target exists or is tracked.
- Expected: distribution-notice and final-evidence references resolve to retained authoritative documents.
- Actual: stale paths point at removed/absent files.
- Location/root cause: the two referring lines above were not reconciled with document removal/consolidation.
- User impact: maintainers cannot find referenced release notices/evidence. Legal completeness is UNVERIFIED; this finding does not assert a legal violation.
- Recommended fix (not executed): prepare/review required bundled notices and redirect evidence references to actual retained authority; prove every reference and preserve provenance.
- Release blocker: notice completeness requires verification before distribution.


### F-023 — Major / FAIL — DatabaseTwin concurrent tenant calls share request identity
- Found by: SOURCE REVIEW and twice-repeated disposable database-test reproduction.
- Reproduction: sequential `asTenant(A)` and `asTenant(B)` SELECT auth.uid return A and B. Concurrent `Promise.all` calls both return B in the actual memory-only twin. No production database was touched.
- Expected: each simulated request preserves its own role/JWT for the whole query.
- Actual: role/claims are changed over separate awaited operations on a shared connection without a transaction.
- Location: `scripts/db-twin.mts:392-430` (`asTenant`), `:445-465` (`asAnon`); compare transaction in `asServiceRole:474`.
- Root cause: session-scoped identity setup interleaves across callers.
- User impact: tenant/account-isolation tests can give false results and fail to prove the production authorization contract. This is a harness defect, not a demonstrated live cross-account exploit.
- Recommended fix (not executed): transaction-local role/claims/query as one unit; prove concurrent A/B/anonymous/service requests and reset on failure.
- Release blocker: reliable concurrent isolation evidence is unavailable through this helper until repaired.


### F-024 — Minor / FAIL — Closing browser sessions leaves their event-loop threads running
- Found by: SOURCE REVIEW and isolated actual session-lifecycle execution.
- Reproduction: subclass only `_async_init` to avoid launching a browser; start/close three actual `_BrowserSession` instances. All three threads remain alive and event loops running. Fixture explicitly stops/joins/closes them afterward.
- Expected: closing/dropping a session frees its loop/thread and reconnecting does not accumulate abandoned workers.
- Actual: `_async_close` closes Playwright/context but never stops/closes the loop or joins its thread; `_run_loop` runs forever. `Browsers.close` also never shuts down its owned egress server.
- Location: `jarvis-runtime/actions/browser_control.py:196-209,228-248`; `ocade_device.py:168-180`; `ocade_egress.py` `EgressProxy`.
- Root cause: lifecycle handles browser objects but omits owned infrastructure cleanup.
- User impact: reconnect/drop cycles retain daemon threads/event loops/listener resources; prior pending-task warnings are not alone proof, but this fresh lifecycle test is.
- Recommended fix (not executed): orderly coroutine cancellation, stop/join/close loop, shutdown/server_close proxy and idempotent cleanup; prove repeated start/reconnect/stop without thread/socket growth.
- Release blocker: resource lifecycle defect; actual long-run growth/performance is still untested.


The preserved donor `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/browser_control.py:478,489-503,890-913` repeats the same loop/thread leak: actual class with fake Playwright remains thread-alive/loop-running after close. Fixture explicitly stopped/joined/closed afterward, without starting a browser. Its timed-out submitted future is also not cancelled (source-only concern). This is conditional donor reuse evidence under F-024, not a second current-runtime release blocker.

- F024 donor corroboration: immutable donor browser_control.py462-478/489-504 retains event loop/thread after browser close. Safari label571 actually uses Playwright WebKit559-569; no physical Safari proof.


### F-025 — Minor / FAIL — Egress refusal response declares the wrong body length
- Found by: SOURCE REVIEW and exact byte-count cross-check.
- Reproduction: split `ocade_egress.BLOCKED_PAGE` at CRLFCRLF. Header says Content-Length 55; actual refusal body is 54 bytes.
- Expected: valid complete HTTP 403 with accurate body length.
- Actual: server closes one byte earlier than advertised, permitting a truncated-response/network error instead of a complete refusal page.
- Location/root cause: `jarvis-runtime/ocade_egress.py:24-25`, hard-coded length drift.
- User impact: confusing network failure when a private-network target is correctly blocked. The security refusal itself remains intact.
- Recommended fix (not executed): derive Content-Length from body bytes and prove blocked request status/body completion in real browser.
- Release blocker: no by itself; real refusal rendering still pending.


### F-026 — Major / FAIL — Account export omits retained private records while claiming completeness
- Found by: SOURCE REVIEW, retained migration/caller cross-check and disposable actual-source VM reproduction.
- Reproduction: fixture contains one owned `user_private_records` row. Export never queries that table, returns none of its content, `partial:false` and a note that every table was read in full. No live account data read or changed.
- Expected: export covers retained synchronized personal data or explicitly discloses a supported exclusion/partial result.
- Actual: canonical export table map lacks the table, even though account erasure explicitly deletes it and self-CRUD schema remains active.
- Location: `src/lib/account/data-classes.ts:92-186`; `account/data-rights.ts:203-244`; `account/erase.server.ts:20`; creation migration `20260721135426*`; `data-rights-map.test.ts:193` hardcodes only four mapped tables.
- Root cause: export inventory diverges from retained schema/erasure inventory and tests mirror that incomplete map.
- User impact: portability loses retained personal data; it becomes unrecoverable after subsequent account deletion. No legal determination is made.
- Recommended fix (not executed): include the retained data with proper ownership/filtering and enforce schema-driven map coverage against all retained personal-data classes; prove populated/empty/paged/private records and truthful partial failures.
- Release blocker: yes for complete/truthful account export.


### F-027 — Minor / FAIL — Usage journey's warning assertion always passes
- Found by: SOURCE REVIEW and predicate cross-check.
- Reproduction: the check labeled composer-warning-before-allowance-exhaustion tests `locator.count() >= 0`; zero warnings satisfies it. Playwright counts are nonnegative. This predicate can never reject an absent warning.
- Expected: assert a visible warning in the appropriate pre-exhaustion threshold/state with truthful reset information.
- Actual: checks neither warning existence/visibility nor the intended pre-exhaustion state (journey is already exhausted there).
- Location/root cause: `scripts/e2e/usage-journey.mjs:289-294`, vacuous nonnegative-count comparison.
- User impact: usage UX proof can report PASS while the warning is missing. No production-warning defect is alleged solely from this test.
- Recommended fix (not executed): assert threshold/state and visible correct warning; prove a missing warning fails.
- Release blocker: evidence gap for usage UX.


### F-028 — Major / FAIL — JARVIS continues a queued tool batch after STOP
- Found by: SOURCE REVIEW and disposable actual-source VM reproduction.
- Reproduction: model returns two `remember` calls; abort the controller when the first asynchronous memory call completes. The second still executes with `signal.aborted=true`; only the next model iteration throws `Stopped`. No live memory/task/schedule writes were made.
- Expected: STOP prevents each later tool dispatch and subsequent durable mutation where possible.
- Actual: batch loop has no `stopIfAsked`; memory/schedule/start/finish-task branches omit the check present in device actions.
- Location: `src/jarvis/agent.ts:653-658`, `runTool:444-569`; compare `runDevice:387`.
- Root cause: cancellation is enforced between model steps rather than between tool calls and durable post-await actions.
- User impact: later reminders, memory changes, task creation/completion can happen after STOP. This fixture does not establish PC physical-input bypass.
- Recommended fix (not executed): cancellation at each dispatch and before durable writes after awaits; prove STOP during multi-tool and delayed persistence batches.
- Release blocker: yes for global STOP semantics.


### F-029 — Major / PARTIAL — Android omits human/payment guards in text and Enter paths
- Found by: SOURCE REVIEW and independent comparison of Android dispatch/gates with the canonical browser adapter. Physical/mock Android execution remains pending.
- Reproduction contract: Android `ui_act(set_value)` or `screen_type` targets an editable non-password payment-card/OTP field; only `isPassword` is refused. `screen_keys(enter)` directly performs IME Enter on focused input without inspecting the submitting payment/sensitive control.
- Expected: payment card entry stays blocked, human verification stays human, and Enter enforces the same purchase/sensitive submission policy as a click.
- Actual: these branches bypass `gate`; there is no Android card/OTP/captcha boundary classification. The browser independently has card/OTP boundary checks and submit inspection.
- Location: `android/src/in/ocade/app/Control.java` (`act` set_value exception, `screenStep` screen_type and screen_keys Enter); `jarvis-runtime/actions/browser_control.py` (`_gate`, press); `actions/ocade_page.js` card/boundary/submit identity.
- Root cause: mobile port shares click regexes but does not implement equivalent typing/human-boundary/submission guards.
- User impact: signed allowed steps can enter verification/payment fields or submit through IME without the intended local hard rule. No real code/payment was entered or submitted.
- Recommended fix (not executed): platform-appropriate field/boundary classification, explicit submission gates and fail-closed unknown sensitivity; prove harmless Android payment/OTP/password/captcha fixtures, both UIA/text/IME and coordinate paths.
- Release blocker: yes pending isolated/real platform proof or equivalent mitigation.


### F-030 — Minor / FAIL — Offline privacy journey compares undefined fields instead of provider requests
- Found by: SOURCE REVIEW and isolated comparison of the actual response shape/predicate.
- Reproduction: `/__last-request` fixture returns the request record directly; the journey instead selects `state.lastRequest`. For different old/new request records, both selected values serialize to null and comparison passes. No live provider traffic was generated.
- Expected: manual Offline proof fails if any additional provider request occurs.
- Actual: traffic changes cannot fail this equality because the selected field is absent.
- Location: `scripts/e2e/online-journey.mjs:333-345`; `scripts/e2e/supabase-stub.mjs:1655,2374-2420`.
- Root cause: caller expects a wrapper object that the fixture does not return.
- User impact: the privacy/network gate can report PASS despite changed provider traffic; no actual product data leak is established by this fixture.
- Recommended fix (not executed): compare actual request records and request counters, with a negative regression that sends traffic and must fail.
- Release blocker: evidence gap for Offline privacy.


### F-031 — Minor / FAIL — Malformed numeric HTML entity crashes JARVIS documentation reading
- Found by: SOURCE REVIEW and disposable actual-source VM reproduction.
- Reproduction: baseline HTML `&#65;` returns `ok:true`; `&#1114112;` throws RangeError from unbounded `String.fromCodePoint`. No live network/backend access occurred.
- Expected: malformed/untrusted HTML yields replacement text or a truthful safe tool failure.
- Actual: parsing outside the fetch catch propagates an exception through `readJarvisDocs`; workspace reports a generic retry error without a proper task transition.
- Location: `src/jarvis/docs.server.ts:42-48` (`decode`), `:113-115` (parse outside catch); `src/jarvis/jarvis.functions.ts:825-826`; `src/jarvis/JarvisWorkspace.tsx:489-493` (generic toast; path confirmed against tracked inventory).
- Root cause: numeric entity values are not validated as Unicode scalars and parse failures are uncaught at the tool boundary.
- User impact: malformed documentation interrupts a JARVIS task. No code injection is claimed.
- Recommended fix (not executed): validate/replace invalid decimal/hex scalar values and return explicit parse failure; prove malformed entities, maximum scalar, invalid surrogate and redirect cases.
- Release blocker: no alone; documentation workflow failure is confirmed.


### F-032 — Major / FAIL — Global STOP announces success when cancellation writes fail
- Found by: SOURCE REVIEW and disposable actual-source VM reproduction.
- Reproduction: task-status update succeeds, but claimed/queued activity cancellation updates return errors. Actual server result is `{stopped:1,running:[]}` and `stopEverywhere` shows “JARVIS stopped.” Baseline returns the active id. No live task/device was changed.
- Expected: report partial/stopping/failure truthfully and retain/retry cancellation intent until active work is acknowledged.
- Actual: errors from both activity updates are ignored, producing an empty active list that the client treats as confirmed success.
- Location: `src/jarvis/jarvis.functions.ts:777-787`; `src/jarvis/stop-everywhere.ts:19-20`.
- Root cause: failed writes masquerade as absence of running activity; success toast is not tied to device acknowledgement.
- User impact: user believes physical/background work ended without proof. Task status may later stop work via polling; persistent execution is not demonstrated by this fixture.
- Recommended fix (not executed): check every cancellation outcome, use atomic stop intent/active-id capture and retry, and distinguish requested/unacknowledged/failed/confirmed states. Test individual write failures, polling delay and acknowledgement timeout.
- Release blocker: yes for truthful STOP safety.


### F-033 — Minor / FAIL — Stub failure injection cannot refuse its POST/PATCH writes
- Found by: SOURCE REVIEW and actual disposable loopback-stub reproduction.
- Reproduction: configure refusal fixture for POST `ocade_messages`; POST a seeded row. It returns 201 and writes the row instead of the requested 500. Isolated memory-only stub process was terminated; no live data changed.
- Expected: a configured matching refusal applies before write dispatch and supports reliable save-failure proofs.
- Actual: successful POST/PATCH/JARVIS dispatch returns before the refusal branch.
- Location: `scripts/e2e/supabase-stub.mjs:1702-1718` (fixture), `:2279,2328` (writes), `:2337` (late refusal).
- Root cause: failure injection is ordered after the code paths it is meant to reject.
- User impact: tests can claim failure-handling coverage without actually producing failures. No corresponding production save failure is alleged.
- Recommended fix (not executed): dispatch matching one-shot/refusal behavior before each relevant write and prove every supported verb/table actually refuses without side effects.
- Release blocker: evidence gap for write-failure behavior.


### F-034 — Major / FAIL — Consent verification deletes existing customers' matching legal receipts
- Found by: SOURCE REVIEW and disposable all-136-migration DatabaseTwin reproduction.
- Reproduction: seed an existing account's retained consent receipt with `terms_version='v1'`, `privacy_version='v1'`; run the full historical verification SQL in the isolated twin. Before count 1, after 0; verifier completes without error. No production verifier or deletion was executed.
- Expected: verification changes only its own disposable fixtures and preserves existing append-only consent evidence.
- Actual: fixture insertion is rejected/caught, then cleanup deletes every matching version receipt without account/id binding, including the pre-existing row.
- Location: `supabase/verification/20260823140000_legal_consent_receipts_verify.sql:69-74,77`.
- Root cause: broad version-only cleanup runs against shared tables outside an outer rollback/dedicated fixture identity.
- User impact: an operator running this retained verifier against an existing database can erase legal consent evidence across accounts with matching historical versions. Production prevalence of those versions is unverified.
- Recommended fix (not executed): disposable-only verifier execution or an outer rolled-back transaction with dedicated captured fixture IDs; prove all nonfixture rows unchanged on success/failure. Preserve applied history/provenance.
- Release blocker: yes for safe owner verification operations; do not run this script on production during this audit.


### F-035 — Major / PARTIAL — Concurrent recovery regeneration can retain two valid batches
- Found by: SOURCE REVIEW; PostgreSQL concurrency reproduction BLOCKED pending a disposable multi-connection database.
- Reproduction: two transactions for the same account compute MAX(generation) before either replacement completes. The second DELETE can acquire its statement snapshot before the first commits, miss that transaction's newly inserted rows, and insert its own batch. All 136 migrations were cross-checked; only one replacement function definition exists. Single-connection DatabaseTwin cannot establish this interleaving; no production writes were attempted.
- Expected: exactly the latest recovery sheet remains valid; all earlier codes are retired.
- Actual: source permits two batches to survive with the same generation, contrary to the notification that earlier codes no longer work. Dynamic exploit remains unproven.
- Location: `supabase/migrations/20260902120000_mfa_recovery_credentials.sql:84-119`, especially `:103-111`; `src/lib/security/recovery.functions.ts:54-90`.
- Root cause: account replacement has no stable per-account row/advisory lock around generation, deletion and insertion.
- User impact: concurrently regenerated earlier recovery codes may remain valid after the owner expects their revocation.
- Recommended fix (not executed): serialize replacement on a stable account lock and prove concurrent requests with two genuine PostgreSQL connections, including an empty first batch.
- Release blocker: pending concurrency proof or serialization evidence for recovery revocation.


### F-036 — Major / FAIL — Queued speech restart survives End and page cleanup
- Found by: SOURCE REVIEW and actual-source disposable hook reproduction.
- Reproduction: start voice; recognition ends and schedules its 300 ms restart; call End before the timer; run the pending callback. Actual hook with React/browser doubles reports recognition starts 1 before End and 2 afterward, with the original media track stopped. No real microphone was activated.
- Expected: End, unmount or sign-out prevents all subsequent recognition starts and transcript delivery.
- Actual: the queued callback starts a new recognizer after cleanup. Physical microphone/provider capture remains unverified.
- Location: `src/jarvis/use-voice.ts:134-177` (`listen`, `onend`), `:292-303` (`end`), unmount effect below it.
- Root cause: restart timer is neither retained/cancelled nor guarded against off state, unmount or changed session generation.
- User impact: recognition and transcript routing can resume after explicitly ending voice or leaving the screen.
- Recommended fix (not executed): cancel retained retry timers and guard callbacks/listen by current state and lifecycle generation; test End, pause and unmount during the retry window.
- Release blocker: yes for voice lifecycle/privacy guarantees.


### F-037 — Minor / PARTIAL — Preserved donor installer reports readiness after failed installs
- Found by: SOURCE REVIEW and isolated namespace execution with installer/process doubles.
- Reproduction: all dependency availability checks false, pip calls false, browser installer returns 1; captured logs still say “Playwright browser ready.” and “All dependencies ready”. No dependency or browser installation was executed.
- Expected: failed installs produce truthful failure/partial readiness.
- Actual: ignored return values yield success messages.
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/installer.py:121-138` (`install_for_config`).
- Root cause: pip boolean results and subprocess exit status are discarded.
- User impact: misleading readiness if the preserved donor installer is launched/reused. Current minimal runtime does not import this installer; this is donor provenance, not proof of a shipped runtime failure.
- Recommended fix (not executed): preserve immutable snapshot; any separately authorized adaptation must aggregate failures and verify installed browser binaries before claiming readiness.
- Release blocker: no for current runtime; conditional on reuse.


### F-038 — Minor / FAIL — Donor monitor identity collapses distinct non-Latin topics
- Found by: SOURCE REVIEW and pure namespace reproduction with in-memory persistence doubles.
- Reproduction: add 東京, then 巴黎. The second returns “Already monitoring: 東京”; one entry remains under the empty key. No donor daemon, file write or network call ran.
- Expected: two distinct topics can be monitored independently.
- Actual: ASCII-only slug strips both topics to the same empty identifier; truncated common prefixes also collide.
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/background_monitor.py:37,76-83` (`_slug`, `add_monitor`).
- Root cause: lossy display-derived slug is used as uniqueness identity.
- User impact: multilingual topics are lost if this preserved donor module is reused. Current runtime reachability is not established.
- Recommended fix (not executed): preserve donor snapshot; any adaptation needs Unicode-normalized identity plus digest/UUID and collision tests.
- Release blocker: no for current runtime; donor-only evidence.


### F-039 — Minor / FAIL — Data Controls disguises failed reads as empty accounts and hides delete failures
- Found by: SOURCE REVIEW and actual-component disposable render with React/query doubles.
- Reproduction: query isError=true, data undefined; render ConversationsSection and LibrarySection. They display “You have no conversations.” and “Nothing is in your Library.” A mutation error has no alert/error branch. Cross-check delete server functions throw on backend errors.
- Expected: distinguish loading/failed/empty reads and show truthful deletion failure with retry.
- Actual: undefined query data becomes count 0 and an empty-account message; delete rejection is not presented to the user.
- Location: `src/components/settings/DataControlsSection.tsx` (`ConversationsSection`, `LibrarySection`, count defaults and mutation handlers); `src/lib/ocade.functions.ts:140-149`; `src/lib/library/library.functions.ts:219-227`.
- Root cause: query/mutation error and loading states are omitted although the shared `Pending` component supports read errors.
- User impact: user cannot tell whether retained content exists or whether deletion was refused; no actual account content was deleted in this audit.
- Recommended fix (not executed): explicit Pending/read-success-empty branches and mutation error/retry status; verify backend refusal and offline cases in disposable UI fixtures.
- Release blocker: no alone; data controls need truthful failure states.


### F-040 — Minor / FAIL — Mark all read renders success when notification write is refused
- Found by: SOURCE REVIEW and actual-component disposable callback reproduction.
- Reproduction: seed an unread notification in the component; `markAllNotificationsRead` returns `{ok:false,message:'write denied'}`. Click handler still replaces its readAt with “now”. Actual-source fixture confirmed this transition without live writes.
- Expected: retain unread state and display failed/partial outcome when the server refuses.
- Actual: every rendered notification is locally marked read on any resolved result.
- Location: `src/components/settings/NotificationsSection.tsx` (Mark all read `.then`); `src/lib/notifications/history.ts` (`HistoryOutcome`, `call`, error return).
- Root cause: resolved discriminated failure result is ignored and treated as successful acknowledgement.
- User impact: visible read status disagrees with persisted security/account notification history.
- Recommended fix (not executed): inspect outcome.ok before updating local records, expose refusal/retry and test resolved errors as well as thrown failures.
- Release blocker: no alone; truthful notification status failure.


### F-041 — Minor / FAIL — Donor memory updates lose concurrent successful writes
- Found by: SOURCE REVIEW and real disposable JSON concurrency fixture outside the repository.
- Reproduction: two threads synchronize immediately after loading the same memory, then update notes.first and notes.second. Both log Saved; final JSON retains only one key. No live memory or product files were modified.
- Expected: independent concurrent updates both survive.
- Actual: last stale snapshot write overwrites the other successful update.
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/memory/memory_manager.py:182-190` (`update_memory`), separate write lock in `save_memory`; donor `actions/background_monitor.py:51-60` has the same split.
- Root cause: read/merge/write is not one locked transaction; locking separate reads and writes cannot prevent lost updates.
- User impact: donor memory/topic settings can disappear if this preserved implementation is reused. Current production import path is not established.
- Recommended fix (not executed): preserve donor; adapted implementation needs one transaction/RMW lock or transactional storage and concurrent update regression proof.
- Release blocker: no for current runtime; donor-only evidence.


### F-042 — Minor / PARTIAL — Archived UI microphone lacks initialization-failure and unmount cleanup
- Found by: SOURCE REVIEW of full archived App member, cross-checked against all its effects and voice callback.
- Reproduction: in the visual prototype, getUserMedia succeeds; AudioContext construction or analyzer initialization fails before streamRef assignment. Catch only alerts; acquired tracks cannot be reached by its stop path. No real microphone capture occurred; runtime reproduction remains unverified.
- Expected: every acquired microphone track/context is cleaned up on initialization failure and unmount.
- Actual: no catch cleanup or voice unmount effect exists in the archived App.
- Location: `imports/UI OCADE JARVIS.zip`, member `src/App.tsx:124-138` (`toggleVoice`), App effects.
- Root cause: acquisition precedes cleanup ownership; component lifecycle never disposes voice resources.
- User impact: microphone can outlive failed/closed archived prototype if reused. Current product voice is independently audited in F-036.
- Recommended fix (not executed): preserve archive; any adaptation requires try/finally ownership and unmount cleanup with failed-initialization tests.
- Release blocker: no solely from immutable visual provenance.


### F-043 — Minor / PARTIAL — Archived visual prototype contains inert controls and canned answers
- Found by: SOURCE REVIEW of full App/InputBar/Sidebar/TopBar ZIP members.
- Reproduction: source shows random canned replies after a timer; activeTab changes only sidebar highlighting; Attach, Settings and window controls have no handlers; Permissions only alerts a label. No production route was asserted to behave this way.
- Expected: any reused functional surface connects controls to real behavior or clearly identifies prototype-only affordances.
- Actual: archived UI remains a visual prototype, without functional backend/router/file actions for these controls.
- Location: `imports/UI OCADE JARVIS.zip`, `src/App.tsx:21-32,98-109,219`; `src/components/InputBar.tsx:37`; `Sidebar.tsx:115`; `TopBar.tsx:36,46-63`.
- Root cause: visual scaffold includes unfinished product interactions.
- User impact: reuse without implementation would mislead users about actions and answers; current replacement functionality must be proved independently.
- Recommended fix (not executed): retain visual provenance, connect only necessary controls when separately authorized and test their real outcomes.
- Release blocker: no solely from archived prototype.


### F-044 — Major / PARTIAL — Library deletion queue accepts another account's unindexed object path
- Found by: SOURCE REVIEW and all-136-migration DatabaseTwin tenant SQL proof; actual Storage deletion BLOCKED/not performed.
- Reproduction: attacker inserts own Library index row with a known victim object path that has no existing Library index row, then deletes their forged row. Actual tenant SQL succeeds and queues tombstone owner_id=attacker, storage_path=victimUUID/objectUUID. Legitimate delete server action subsequently sweeps that owner's queue with service credentials. UNIQUE prevents forging an already indexed path; this finding is limited to unindexed/upload-in-progress objects.
- Expected: index/tombstone storage path must belong to its account; privileged sweep must reject owner/path mismatch.
- Actual: queue accepts the victim path and privileged sweep passes supplied paths to Storage removal without owner-prefix validation. No live object was deleted.
- Location: `supabase/migrations/20260912090000_one_library_for_everything_a_person_keeps.sql:40,72-82,100`; `src/lib/library/tombstones.server.ts:27-34`; `src/lib/library/library.functions.ts:204-216`.
- Root cause: row policy binds user_id but storage_path only needs nonempty text; trigger/sweep trust that unbound path.
- User impact: known unindexed private uploads can be targeted for cross-account deletion; physical deletion exploit is not dynamically verified.
- Recommended fix (not executed): enforce storage_path owner prefix at DB and privileged sweep boundaries; disposable cross-account negative tests for forged paths, direct uploads and pending registration.
- Release blocker: yes for storage/account isolation pending full disposable Storage proof or mitigation.


### F-045 — Major / FAIL — JARVIS admits overlapping submissions before message save completes
- Found by: SOURCE REVIEW and AST-extracted actual send callback with delayed persistence fixture.
- Reproduction: existing conversation; invoke Send twice before the first save resolves. Actual callback fixture reports two in-flight saves while running=false, then two saved questions and two model turns. No live provider/device task executed.
- Expected: one turn is admitted synchronously; another is queued/interjected consistently.
- Actual: persistence awaits precede the running/abort admission state, allowing overlapping loops and overwriting shared live/abort refs.
- Location: `src/jarvis/JarvisWorkspace.tsx:317-407`, especially gates `:325,352`, awaits `:377-398`, state `:401-407`.
- Root cause: no synchronous admission guard covers the asynchronous conversation/message save phase.
- User impact: duplicate questions, overlapping responses/usage and ambiguous STOP ownership. Database open-task uniqueness may prevent duplicate physical tasks; those are not demonstrated.
- Recommended fix (not executed): synchronous busy ref before the first await, serialized conversation ownership and Stop handling during save; regression for double Enter/Send and voice plus typing under delayed persistence.
- Release blocker: yes for reliable task admission and STOP semantics.


### F-046 — Minor / FAIL — iPhone browser registration is labelled macOS
- Found by: SOURCE REVIEW and actual-source user-agent fixture; physical Apple evidence remains BLOCKED.
- Reproduction: common iPhone Safari UA includes “iPhone” and “like Mac OS X”; actual parser returns kind=mobile, displayName=Safari on macOS. Registration caller persists browserLabel as its name.
- Expected: Safari on iOS for this UA.
- Actual: macOS check wins before iOS check.
- Location: `src/lib/browser-install-id.ts:35-49`; `src/lib/commercial/device-identity.ts:189-194`.
- Root cause: overlapping UA patterns ordered incorrectly.
- User impact: misleading Devices identity; this fixture is not a physical iOS test.
- Recommended fix (not executed): iOS-first display classification or reuse existing tested session display parser; verify iPhone/iPad/Android/desktop labels.
- Release blocker: no alone.


### F-047 — Major / FAIL — Message verifier deletes retained transcript on fixed-key collision
- Found by: SOURCE REVIEW and full-history DatabaseTwin reproduction.
- Reproduction: seed a legitimate message using valid client_key `verify-client-key-probe`; execute the actual verifier. Count falls 1 to 0 with no error. No live verifier or deletion ran.
- Expected: verification affects only its own disposable fixtures.
- Actual: duplicate fixture insertion is caught, then an unscoped key-only DELETE removes existing matching messages across accounts.
- Location: `supabase/verification/20260909120000_ocade_message_client_key_verify.sql:37-48`.
- Root cause: fixed shared-table probe identity and cleanup without captured fixture/account scope or outer rollback; related to F-034.
- User impact: an operator running this verifier against populated data can destroy matching transcript content. Generated application keys make natural collision unlikely; direct valid keys are accepted.
- Recommended fix (not executed): disposable-only execution or rollback transaction with dedicated captured fixture IDs; prove nonfixture rows unchanged on success/failure.
- Release blocker: yes for safe verification operations.


### F-048 — Minor / FAIL — Modal surfaces omit keyboard focus containment and restoration
- Found by: SOURCE REVIEW and fresh actual Chrome keyboard reproduction for Settings,2026-10-04. Other modal variants remain source-only/PARTIAL.
- Reproduction: open Settings or Confirm identity, then Tab through controls; source provides no focus trap/inert background or focus restoration. Mobile drawer additionally has no dialog/aria-modal semantics or focus movement. Escape support exists for Settings/drawer only.
- Expected: modal keyboard focus stays inside, initial focus is deliberate, close restores trigger focus and underlying workspace is inactive.
- Actual: declared aria-modal dialogs rely on markup alone. Fresh local exact-main Chrome: opening Settings leaves activeElement=BODY, outside dialog; one Tab focuses the background account button while Settings remains open (insideDialog=false before/after). DOM inspection and actual key input cross-check the missing lifecycle. Screen-reader/other modal/physical Apple effects remain UNTESTED.
- Location: `src/components/settings/settings-panel.tsx` (`SettingsDialog`, provider effects); `src/components/security/ConfirmIdentity.tsx` (dialog); `src/components/shell/AppShell.tsx:67-106` (drawer).
- Root cause: custom overlays omit shared modal accessibility lifecycle.
- User impact: keyboard/screen-reader users may reach obscured controls and lose context.
- Recommended fix (not executed): one appropriate accessible modal primitive/native dialog lifecycle, including stacked confirmation dialog; test Tab/Shift+Tab/Escape/close on desktop/mobile web.
- Release blocker: accessibility evidence remains incomplete; no physical platform PASS claimed.


### F-049 — Major / FAIL — Automatic offline fallback silently drops image attachments
- Found by: SOURCE REVIEW and actual router/contract/transport fixture with image-aware offline adapter.
- Reproduction: Automatic online permit includes an image; Online becomes unavailable. Offline transport strips images, adapter receives zero images and returns a successful guessed answer instead of its image refusal. No real model/provider/image processing ran.
- Expected: unavailable image capability refuses truthfully or keeps the Online requirement; it cannot answer as though it saw the image.
- Actual: fallback is admitted successfully after removing image payload/capability evidence.
- Location: `src/lib/intelligence/offline-transport.ts:34-50,86-112` (`toBrainMessages`, adapter request); `src/lib/brain/adapters/browser-wasm.ts:526-530` image refusal; `src/lib/intelligence/router.ts:120-139` fallback.
- Root cause: lossy transport conversion bypasses adapter's image refusal and fallback admission lacks vision gating.
- User impact: misleading image interpretation and potentially counted generation during provider/network fallback; real-model outcome remains untested.
- Recommended fix (not executed): fail closed for images without proven vision capability, preserve payload when supported, and test Automatic failure/LocalOnly image cases.
- Release blocker: yes for truthful multimodal fallback.


### F-050 — Major / PARTIAL — Donor Windows launcher interpolates raw URI into a shell
- Found by: SOURCE REVIEW and mocked subprocess capture; no shell command was executed.
- Reproduction: raw name `custom: & echo AUDIT_ONLY` reaches colon URI branch and captures `start custom: & echo AUDIT_ONLY` with shell=True, reporting success.
- Expected: validated typed URI/app identity reaches a safe OS launch authority; metacharacter input is refused.
- Actual: shell syntax survives raw string interpolation.
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/open_app.py:92-96` (`_launch_windows`).
- Root cause: raw model/app string is granted shell interpretation.
- User impact: command execution hazard if preserved donor launcher is reused; current production import is absent/unestablished. No production exploit is alleged.
- Recommended fix (not executed): preserve immutable donor; adaptation needs validated launch identity and safe platform API/argv, plus harmless injection refusal tests.
- Release blocker: conditional on reuse, not current shipped-path proof.


### F-051 — Minor / FAIL — Donor Linux launcher reports success on xdg-open failure
- Found by: SOURCE REVIEW and mocked process returncode 1 with no matching binary.
- Reproduction: xdg-open returns failure; `_launch_linux` still returns True (“Opened”). No Linux process or physical platform test ran.
- Expected: inspect exit status and continue/refuse truthfully.
- Actual: any normally returned subprocess result is success.
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/open_app.py:209-215`.
- Root cause: ignored subprocess exit status.
- User impact: false success if donor launcher is reused.
- Recommended fix (not executed): preserve snapshot; adapted code must check process/UI result before success and verify real launch behavior.
- Release blocker: no for current runtime.


### F-052 — Minor / FAIL — Input-only voice Continue crashes without speech synthesis
- Found by: SOURCE REVIEW and actual-hook browser doubles.
- Reproduction: SpeechRecognition exists, speechSynthesis absent; start voice, pause, resume. Fixture throws TypeError reading paused; recognizer starts remain 1. No real microphone/platform test occurred.
- Expected: supported speech input resumes even when spoken output is unavailable.
- Actual: resume unconditionally dereferences absent synthesis API.
- Location: `src/jarvis/use-voice.ts:281-289`; `src/jarvis/JarvisTask.tsx:320-327` Continue control.
- Root cause: capability separation used at startup is omitted during resume.
- User impact: supported input-only voice remains paused with an unhandled action error.
- Recommended fix (not executed): guard synthesis capability and test input-only pause/resume alongside full-capability and unsupported environments.
- Release blocker: no alone; cross-platform voice behavior fails.


### F-053 — Minor / FAIL — Donor audio transport probe leaks stream on write/read failure
- Found by: SOURCE REVIEW and fake sounddevice stream fixture.
- Reproduction: RawOutputStream.start succeeds and write throws; probe returns False without stop/close. No actual audio device was opened.
- Expected: every created stream is disposed on all success/failure paths.
- Actual: probe cleanup follows successful operation only; adjacent `_usable` correctly uses finally.
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/audio_devices.py:134-166` (`_transport_works`).
- Root cause: missing finally ownership around probe stream.
- User impact: leased audio resources can survive failed donor readiness checks if reused.
- Recommended fix (not executed): preserve donor; adaptation needs unconditional stop/close and failure-path resource assertions.
- Release blocker: no for current runtime.


### F-054 — Minor / FAIL — Donor audio probe cache survives sample-rate reconfiguration
- Found by: SOURCE REVIEW and mocked 24 kHz failure followed by 48 kHz configure.
- Reproduction: failed API/direction probe is cached; configure changes sample rate and device-list cache but retained probe result still refuses without rechecking.
- Expected: changed rate/hardware invalidates affected readiness results.
- Actual: cache identity excludes rate/device and configure leaves probe results intact.
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/audio_devices.py:119` (`_transport_works` cache), `:197` (`configure` rate/cache update).
- Root cause: readiness cache scope differs from configuration scope.
- User impact: false audio readiness/refusal after donor configuration changes if reused.
- Recommended fix (not executed): preserve snapshot; adaptation should invalidate/version results by device/rate/direction and test changed hardware/rate.
- Release blocker: no for current runtime.


### F-055 — Minor / FAIL — Donor reminders scheduled at the same time overwrite each other
- Found by: SOURCE REVIEW and mocked scheduler/script fixture, without installing any OS job.
- Reproduction: two different messages for 2099-01-01 10:00 both report success with name JARVISReminder_20990101_100000; script path and scheduled job identity coincide. Windows uses schtasks /F; macOS/Linux identities similarly derive from this name.
- Expected: separate reminders remain independently scheduled.
- Actual: second replaces the first script/job.
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/reminder.py` (`reminder` task_name, `_write_notify_script`, `_schedule_windows` overwrite flag, platform label/unit paths).
- Root cause: scheduled timestamp is used as unique reminder identity.
- User impact: lost reminder if preserved donor implementation is reused; no production import/platform execution was established.
- Recommended fix (not executed): preserve donor; adapted scheduler needs persistent unique reminder IDs and duplicate-time regression tests on actual available platform fixtures.
- Release blocker: no for current runtime.


### F-056 — Major / FAIL — Attaching long text stores the truncated model excerpt as the Library copy
- Found by: SOURCE REVIEW and actual attachment parser/payload fixture.
- Reproduction: attach a 250,000-byte text file. Parser deliberately limits model text to 200,000 characters plus a truncation warning; ChatWorkspace sends that transformed text as contentBase64 to addLibraryItem. Server uploads decoded supplied bytes. Original byte equality fails; the warning becomes part of the stored file. No live Library write occurred.
- Expected: bounded model reading may truncate, but a Library copy advertised as the attached file preserves its original bytes or explicitly refuses full retention.
- Actual: original name/type is attached to an incomplete changed file, with no distinct Library preservation warning.
- Location: `src/components/chat/ChatWorkspace.tsx` (`attach`, contentBase64 from read.text); `src/lib/chat/attachments.ts` (`MAX_TEXT_CHARS`, readAttachment text cut); `src/lib/library/library.functions.ts` (`addLibraryItem` decode/upload).
- Root cause: model-normalized excerpt is reused as archival file content.
- User impact: later Library download does not reproduce the retained source document; UTF-8 normalization can additionally alter non-UTF-8 text. User's external original is not deleted.
- Recommended fix (not executed): separate bounded model representation from original byte retention, with explicit storage-size refusal and original-byte equality tests.
- Release blocker: yes for faithful file retention.


### F-057 — Minor / FAIL — Conversation options cannot open with keyboard activation
- Found by: SOURCE REVIEW and actual-component render fixture.
- Reproduction: focus “More options for Fixture” and activate Enter/Space. Actual button has onPointerDown only, with no onClick/onKeyDown; render fixture confirms handler absence. Pointer path exists; real browser keyboard test remains pending.
- Expected: semantic button click from keyboard opens Rename/Archive/Export/Delete menu.
- Actual: keyboard-generated click has no handler, leaving menu actions unreachable through this control.
- Location: `src/components/chat/ConversationList.tsx` (More options button, onPointerDown toggle).
- Root cause: pointer ordering workaround replaced the activation handler without a keyboard equivalent.
- User impact: keyboard-only users cannot manage conversations via this menu.
- Recommended fix (not executed): preserve pointer ordering while supporting semantic keyboard click and menu focus/Escape behavior; test Enter/Space and pointer activation.
- Release blocker: accessibility failure; no physical browser PASS claimed yet.


### F-058 — Minor / FAIL — Code Copy announces copied when clipboard API is unavailable/refused
- Found by: SOURCE REVIEW and actual CodeBlock callback fixture with absent clipboard API.
- Reproduction: click Copy code where navigator.clipboard is absent; helper no-ops and state still becomes copied=true. Rejected write promises are likewise not inspected. No system clipboard was changed.
- Expected: copied indicator only follows successful clipboard acknowledgement, otherwise truthful failure/fallback.
- Actual: visual checkmark is unconditional and helper returns void.
- Location: `src/components/chat/MessageList.tsx` (`copy`, `CodeBlock` copy callback).
- Root cause: asynchronous/no-op clipboard result is disconnected from success state.
- User impact: users paste stale/empty clipboard contents believing code was copied.
- Recommended fix (not executed): await/inspect clipboard outcome, expose fallback/refusal, and test missing/rejected/successful API cases.
- Release blocker: no alone.


### F-059 — Minor / PARTIAL — Donor flight search contains a conflicting fixed historical itinerary
- Found by: SOURCE REVIEW and pure URL/base64 inspection; live Google precedence UNTESTED.
- Reproduction: build DEL→BOM for 2026-12-31. q contains the requested route/date, but fixed tfs bytes contain 2025-03-15, IST and LHR. No flight site or purchase flow was used.
- Expected: one coherent requested itinerary.
- Actual: URL combines dynamic text with unrelated fixed encoded itinerary; resulting live selection is not proved.
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/flight_finder.py:121` (`_build_google_flights_url`).
- Root cause: copied opaque provider query payload is hard-coded across all requests.
- User impact: wrong-trip risk if preserved donor code is reused; current shipped-path reachability is unestablished.
- Recommended fix (not executed): preserve snapshot; adaptation must use coherent supported route/date parameters and verify actual selected itinerary.
- Release blocker: no for current runtime; conditional reuse hazard.


### F-060 — Major / FAIL — Deployed backend is missing the configured background JARVIS model function
- Found by: current read-only Supabase metadata/endpoint checks plus SOURCE REVIEW.
- Reproduction: live function inventory for project sazhgaisyhkdbrooycdv contains only ocade-intelligence v12 (verify_jwt=true). GET `/functions/v1/ocade-intelligence-service` returns 404 NOT_FOUND “Requested function was not found”; existing ordinary function returns 401 Missing authorization header. No task, provider request or deployment mutation was executed.
- Expected: configured service endpoint exists for authorized server-side background model continuation.
- Actual: background-model caller POSTs an absent function and receives unavailability; a full physical background task was not run.
- Location: `supabase/config.toml:6-7`; `supabase/functions/ocade-intelligence-service/index.ts:10-17`; `src/jarvis/background-model.server.ts:44-58`; `src/routes/api/jarvis/continue.ts:33`.
- Root cause: repository function/caller exist but function is absent in current live deployment inventory.
- User impact: connected model planning for browser-closed/background/Remote PC continuation cannot reach its backend endpoint. Existing function liveness/auth response does not prove provider readiness.
- Recommended fix (not executed): separately authorized deployment of configured function, then prove service authentication/permit/continuation and physical device outcomes.
- Release blocker: yes for deployed background continuation.


### F-061 — Minor / PARTIAL — Hosted Auth leaked-password protection is disabled
- Found by: current read-only Supabase security advisor and SOURCE REVIEW; real credential assignment intentionally not attempted.
- Reproduction: advisor returns auth_leaked_password_protection WARN. Reset form locally requires matching passwords of at least eight characters, with no breach screening; hosted policy is the responsible authority.
- Expected: compromised password candidates are rejected by an eligible configured Auth policy.
- Actual: advisor explicitly identifies leaked-password protection as disabled. Actual acceptance of a compromised candidate has not been tested; no breach/takeover is alleged.
- Location: hosted Auth project sazhgaisyhkdbrooycdv; `src/routes/reset-password.tsx:139-148`; `supabase/config.toml` does not configure Auth password policy.
- Root cause: hosted breach protection feature is disabled; this is not a claim that client length validation implements provider policy.
- User impact: known-compromised credentials are not screened by this feature.
- Recommended fix (not executed): establish plan eligibility and enable hosted protection under future authorization, then prove provider rejection/error UX in isolated accounts. Supabase documents Pro-and-above eligibility: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
- Release blocker: hardening/evidence gap; actual credential behavior remains unverified.


### F-062 — Major / PARTIAL — Forged recovery fragment opens password reset without verified recovery proof
- Found by: SOURCE REVIEW and actual route/helper browser-double fixture; real credential change not attempted.
- Reproduction: ordinary existing auth session, navigate to `/reset-password#access_token=garbage&type=recovery`. No PASSWORD_RECOVERY event or token exchange occurs; actual route opens form and submits auth.updateUser once. Fixture reports linkValid=true, exchanges=0, updateCalls=1. Installed Auth SDK retains existing sessions on failed URL callbacks; configured PKCE does not establish this implicit recovery claim.
- Expected: form/credential mutation requires verified recovery session or a separately verified current credential, as the route's stated safety boundary requires.
- Actual: a nonempty untrusted fragment is sufficient for local admission; submit does not independently require verified recovery evidence. Hosted acceptance/reauthentication policy remains unverified, so actual takeover is not claimed.
- Location: `src/lib/auth/recovery-link.ts:74-76,99`; `src/routes/reset-password.tsx` (`checkTheLink` fallback opensResetForm, `submit` updateUser); `src/integrations/supabase/client.ts` PKCE configuration.
- Root cause: syntactic URL claim is treated as authenticated recovery proof and is not tied to the provider's validated recovery event/session.
- User impact: user at an already signed-in browser can reach a high-risk credential mutation without the intended extra proof; final provider authorization outcome needs isolated GoTrue evidence.
- Recommended fix (not executed): bind admission and submission to validated recovery-session evidence or proper recent identity proof; test forged/missing/expired fragments with existing ordinary session and provider-policy variants.
- Release blocker: yes for credential-change safety pending full provider proof or mitigation.


### F-063 — Minor / FAIL — Donor Gemini JSON parser changes valid arrays into objects or fallback
- Found by: SOURCE REVIEW and AST-only actual-function reproduction, without provider/import side effects.
- Reproduction: `[{'a':1}]` expressed as valid JSON with double quotes returns object rather than list; valid two-object array returns DEFAULT with Extra data error. Both source fixtures were re-run from disposable work.
- Expected: valid provider JSON preserves its full shape.
- Actual: first/last brace slicing occurs before bracket handling, stripping array structure.
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/gemini.py:421-438` (`as_json`).
- Root cause: heuristic object extraction precedes ordinary whole-document JSON parsing.
- User impact: changed/lost structured provider results if preserved donor parser is reused; current production reachability is unestablished.
- Recommended fix (not executed): preserve donor; adaptation should parse complete JSON first, then handle fences/extraction while preserving container shape; test object/array/nested/fenced/malformed responses.
- Release blocker: no for current runtime.


### F-064 — Minor / FAIL — Help search excludes published answer text
- Found by: SOURCE REVIEW and full QUESTIONS/actual-filter disposable execution; actual Chrome Help search2026-10-04 confirmed captcha returns Nothing matches that despite published answer text.
- Reproduction: search captcha or fingerprint; zero matches although published safety/enrollment answers contain those exact terms. Positive recovery codes search matches its manually supplied words.
- Expected: search finds guidance by terms present in its published answer.
- Actual: filtering includes question, manual words and category only.
- Location: `src/routes/help.tsx:382-386`, QUESTIONS answer/words fields and stated search purpose near `:41`.
- Root cause: parallel hand-maintained keywords omit answer content.
- User impact: users cannot find relevant safety/enrollment guidance using its own terminology.
- Recommended fix (not executed): searchable plain answer content from one authority or verified complete indexing, with positive/negative term fixtures and browser search checks.
- Release blocker: no alone.


### F-065 — Minor / FAIL — Donor text helper ignores configured OpenAI-compatible provider
- Found by: SOURCE REVIEW and AST-only actual-function fixture with network doubles.
- Reproduction: provider=openai, base localhost:1234, valid choices[].message.content response. Actual call_llm_text uses /api/chat and returns empty text. No HTTP request occurred.
- Expected: provider-aware endpoint and response shape, as neighboring call_llm/stream implement.
- Actual: helper always assumes Ollama /api/chat and message.content.
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/llm_client.py:330-384` (`call_llm_text`).
- Root cause: duplicate provider routing/response handling diverges in text-only helper.
- User impact: silent empty/failing helper responses if donor is reused with LM Studio/OpenAI-compatible configuration; current production reachability is unestablished.
- Recommended fix (not executed): preserve donor; adaptation should reuse provider-aware call/normalization and prove both providers' text results.
- Release blocker: no for current runtime.


### F-066 — Minor / FAIL — Donor build helper calls failed execution “working”
- Found by: SOURCE REVIEW and AST-only actual helper/process doubles.
- Reproduction: subprocess exits 1 with empty stdout/stderr; actual _run_file/_has_error/_build returns “Build complete…code is working after 1 attempt” and “Executed with no output.” No process/model/file write ran.
- Expected: nonzero exit is failure regardless of printed keywords; timeout is not a readiness probe.
- Actual: returncode is dropped and success is inferred from text patterns. Related dev_agent timeout path claims likely working without checking readiness (source-only cross-check).
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/code_helper.py` (`_run_file`, `_build`); `actions/dev_agent.py:97-109,328-353,546-556` (`_has_error`, `_run_project`, `_build_project`). Reported old line offsets are reconciled by exact function names.
- Root cause: structured process/save outcomes are reduced to strings and heuristic keyword checks.
- User impact: false project readiness if donor helpers are reused. Ignored _save_file result is an additional source concern, not independently runtime-proven.
- Recommended fix (not executed): preserve donor; adapted helpers must propagate exit/save/timeout status and use explicit readiness probes with negative fixtures.
- Release blocker: no for current runtime.


### F-067 — Major / PARTIAL — Revoked offline capacity can be returned while another browser still holds its signed lease
- Found by: SOURCE REVIEW and actual-handler fixture; full two-browser/DB spend effect remains unverified.
- Reproduction: account owns revoked browser B with active signed lease; caller from another browser submits only B deviceId. Actual handler invokes privileged return RPC for B and reports 700 hundredths refunded, without caller installation/erasure evidence. Offline B can retain its previously signed block until expiry. No live revocation/refund/spend occurred.
- Expected: other-browser capacity remains held until expiry/reconciliation; local return requires a sound proof that retained spendable capacity cannot remain.
- Actual: account ownership plus revoked status suffices for privileged refund, contradicting the handler's documented current-browser-only boundary.
- Location: `src/lib/commercial/offline-usage.functions.ts:230-290` (`closeOfflineUsageForRevokedDevice`); `supabase/migrations/20260918081533_profiles_usage_authority.sql:615-643` return RPC; offline lease signature/time/account/device verification.
- Root cause: documented local erasure/installation precondition is assumed from UI cooperation, not enforced by the server/lease protocol.
- User impact: same-account allowance can be credited while previously issued offline capacity remains spendable, causing double-spend/usage drift. Complete concurrent quota effect remains PARTIAL.
- Recommended fix (not executed): hold return until expiry/reconciliation or use a protocol with verifiable lease retirement; a spoofable installation ID alone is insufficient. Prove genuine two-browser offline/online refund/spend interleavings in disposable accounts.
- Release blocker: yes for accounting integrity pending full protocol proof or mitigation.


### F-068 — Major / PARTIAL — Donor generated-code sandbox grants unrestricted file operations
- Found by: SOURCE REVIEW and AST-only actual execution/sandbox fixture using a fake Path.
- Reproduction: generated `Path('outside-scope.txt').unlink()` is accepted and returns Done, while its prompt prohibits deletion and restricts inspection/writes. Fake Path records attempted unlink; zero real files/desktop actions were changed.
- Expected: destructive/unscoped operations are refused by an enforced capability boundary.
- Actual: unrestricted Path is injected into arbitrary exec; model instructions are the only deletion/write restriction.
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/desktop.py:43-74,98-100,135-149`.
- Root cause: prompt rules do not constrain capabilities granted to generated Python.
- User impact: destructive unscoped operations if the archived engine is reused. Current production import/exploit is unestablished; no real deletion occurred.
- Recommended fix (not executed): preserve donor; adaptation must use explicit allowlisted operations with validated scope/consent, never unrestricted generated-code exec as a safety sandbox.
- Release blocker: conditional on reuse, not proof of a current shipped exploit.


### F-069 — Major / FAIL — Remove races runtime activation and never disposes its loaded adapter
- Found by: SOURCE REVIEW and actual ModelInstallationAuthority deferred-activation fixture.
- Reproduction: installation awaits activation; uninstall aborts/clears/removes and publishes idle Removed. Old activation resolves successfully, then publishes ready. Fixture confirms removalok=true, removed=1, intent=true, followed by ready/isReady=true. No real model/download/disk deletion ran.
- Expected: Removed stays removed until explicit reinstall; loaded/in-flight runtime is stopped/disposed before removal completes.
- Actual: stale activation publishes ready after removal. Production uninstall wiring supplies no runtime disposer; delegated runtime uses module live independent of installation state. Real model memory/GPU effects remain unverified.
- Location: `src/lib/brain/installation-authority.ts:875-915,930-970`; `src/lib/brain/use-installation.ts:101-103`; `src/lib/brain/installation-browser.ts:247-269`; `src/lib/brain/runtime-activation.ts:102,125-176`.
- Root cause: activation lacks operation-generation/post-await abort guard, uninstall does not join old work or dispose the runtime authority.
- User impact: Remove can show readiness again and leave inference resources available after the user removes Offline Intelligence.
- Recommended fix (not executed): cancel/join stale activation, guard publications by generation/signal and dispose loaded runtime before truthful removal; prove delayed activation, normal ready removal and resource shutdown.
- Release blocker: yes for removal/privacy/resource lifecycle guarantees.


### F-070 — Major / PARTIAL — Donor rename validates source scope but permits escaping destination
- Found by: SOURCE REVIEW and AST-only actual validation/rename fixture using fake file operations.
- Reproduction: safe source plus new_name `../outside-uncreated-fixture.txt` returns Renamed; recorded destination resolves outside configured root. No real file was moved/renamed.
- Expected: new name is a permitted basename and resolved destination remains in authorized scope.
- Actual: destination is source.parent/new_name without destination scope validation; absolute names likewise override the parent.
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/file_controller.py:371-393` (`rename_file`, `_is_safe_path`).
- Root cause: source validation is incorrectly assumed to protect the independently supplied destination.
- User impact: scoped donor rename can target outside its authorized root if reused. Current production reachability/real file effect is unestablished.
- Recommended fix (not executed): preserve donor; adaptation must validate basename/resolved destination and undo scope, with traversal/absolute-name negative tests.
- Release blocker: conditional reuse hazard, not current shipped-path proof.


### F-071 — Minor / FAIL — Donor CSV processing uses an unsupported pandas argument
- Found by: SOURCE REVIEW and actual AST-extracted function with existing pandas 2.2.3/in-memory CSV.
- Reproduction: valid CSV reaches read_csv with errors='replace'; result is “Could not read file: read_csv() got an unexpected keyword argument errors”. Installed reader signature confirms argument absence. No product file/network operation occurred.
- Expected: valid CSV reaches requested analysis/filter/sort/statistics.
- Actual: affected reads fail at the invalid keyword.
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/file_processor.py:320-415` (`_process_data`, read_csv call; raw source search identifies line 331).
- Root cause: text-open error handling argument is incorrectly used for pandas.
- User impact: donor CSV workflow fails if reused; current production reachability is unestablished.
- Recommended fix (not executed): preserve donor; adaptation needs supported encoding_errors plus CSV/TSV delimiter, malformed encoding and valid data-operation tests.
- Release blocker: no for current runtime.


### F-072 — Major / FAIL — Failed model write advances the digest beyond the durable resume frontier
- Found by: SOURCE REVIEW and actual transfer/download-plan/StreamingSha256 disposable 192-byte fixture.
- Reproduction: 64-byte chunks; first write succeeds, second is refused. Failed checkpoint records contiguousChunks=1 but digest.bytes=128 instead of 64. Retry fetches correct remaining bytes, hashes the refused chunk again and reports digest_mismatch. No real download/storage exhaustion occurred.
- Expected: digest covers only durable bytes and retry resumes aligned progress after storage becomes available.
- Actual: digest advances before write acceptance, remains advanced on refusal, and resumed correct bytes mismatch. Authority removes the partial version after mismatch.
- Location: `src/lib/brain/model-transfer.ts:439-453,727-743,295-314,863-868`; `src/lib/brain/installation-authority.ts:762-788` digest-mismatch removal.
- Root cause: hash/frontier commit ordering and missing digest-byte/frontier validation permit an inconsistent checkpoint.
- User impact: valid partial progress is discarded and model bytes are re-downloaded, wasting time/bandwidth/battery during low-storage recovery. Physical large-file storage-full behavior remains untested.
- Recommended fix (not executed): commit hashing with accepted durable writes, rollback on refusal or maintain transactional digest state; validate checkpoint alignment and prove refusal/resume/flush-failure cases.
- Release blocker: yes for reliable offline download recovery.


### F-073 — Minor / FAIL — Password-management guidance points to a missing Account control
- Found by: SOURCE REVIEW of complete Settings Account/SignInMethods/TwoStep UI and repository-wide password mutation search.
- Reproduction: sign-in copy says optional password is set under Account; reset page directs signed-in users to Settings to enter current password. Account settings offers identity/email/two-step/sign-out/deletion only; the sole user password update is reset-password.tsx. Existing current-password proof helper has no such UI caller.
- Expected: promised set/change-password control exists with appropriate proof, or guidance describes an actually reachable supported flow.
- Actual: users are directed to a nonexistent control. Real signed-in UI confirmation remains pending practical testing.
- Location: `src/routes/auth.index.tsx` password-method guidance; `src/routes/reset-password.tsx:56,195-196` guidance; `src/components/settings/settings-panel.tsx` AccountSettings; `src/components/settings/SignInMethods.tsx`; `src/lib/security/reauthentication.ts` current-password proof.
- Root cause: UI/documentation promise survived without a connected password-management action.
- User impact: users cannot follow the advertised Account path to create/change their optional password.
- Recommended fix (not executed): separately authorize connecting a safe verified credential flow or correct unsupported guidance; prove fresh proof and password-change failure states before exposing it.
- Release blocker: no alone; advertised auth flow is incomplete.


### F-074 — Minor / PARTIAL — Donor avatar eyelid expression state is never rendered
- Found by: SOURCE REVIEW and complete state/render reference cross-check; no Qt rendering test occurred.
- Reproduction: sleeping/thinking updates _lids, but renderer computes eye visibility solely from _blink. _lids has initialization/update references and no rendering consumer.
- Expected: documented expression state affects the eyelid rendering, or unsupported expression is not promised.
- Actual: state is disconnected from the rendered features.
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/avatar.py` (`_lids` initialization/update, `_paint_features` visibility).
- Root cause: animation state and renderer diverge.
- User impact: missing donor visual expression if reused; current UI reachability/Qt appearance is unverified.
- Recommended fix (not executed): preserve original; adapted renderer should connect the necessary state or remove only proven-unused state after visual parity tests.
- Release blocker: no for current runtime.


### F-075 — Major / PARTIAL — Donor game-update fallback disables the global mouse failsafe without restoration
- Found by: SOURCE REVIEW of the complete donor updater and failsafe reference search; no mouse action or setting change was executed.
- Reproduction: install fallback sets pyautogui.FAILSAFE=False; full source contains no restoration. Source control flow therefore leaves the process-wide emergency corner-stop disabled afterward.
- Expected: preserve emergency-stop behavior across fallback actions and failures.
- Actual: a global safety setting is permanently disabled in that process after this branch.
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/game_updater.py:353`.
- Root cause: mutable global safety override without scoped restoration; current runtime import is unestablished.
- User impact: donor automation can continue despite the user's emergency mouse gesture if reused; no real platform exploit/execution is asserted.
- Recommended fix (not executed): preserve donor; adaptation must retain failsafe and prove cancellation/Stop across fallback/error paths, restoring any allowed temporary state in finally.
- Release blocker: conditional reuse hazard, not current shipped-path proof.


### F-076 — Minor / FAIL — Donor browser navigation reports the previous page as newly opened
- Found by: SOURCE REVIEW and AST-only actual browser-session fixture with fake Playwright.
- Reproduction: existing page URL is existing.invalid; request requested.invalid and mock goto failure. Actual result is “Opened: https://existing.invalid/”. No browser/network navigation occurred.
- Expected: requested navigation failure is reported and no success is inferred from an unrelated prior page.
- Actual: swallowed goto error plus nonblank current URL produces success.
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/browser_control.py:635-665` (`go_to`).
- Root cause: postcondition checks page existence rather than requested navigation outcome.
- User impact: downstream donor interaction can target the wrong page if reused; current runtime navigation needs independent proof.
- Recommended fix (not executed): preserve donor; adaptation must tie success to requested navigation/redirect/error postconditions and verify failure after an existing page.
- Release blocker: no for current runtime.


### F-077 — Major / FAIL — Already installed offline model needs another whole model's free disk quota to activate
- Found by: SOURCE REVIEW and actual BrowserWasmAdapter probe fixture.
- Reproduction: verified existing weights provider has a 100-byte model; storage has 50 free bytes. Probe refuses insufficient_storage without consulting the provider (calls=0). No real model/storage quota manipulation occurred.
- Expected: existing verified model can activate without reserving its full disk size again; additional-byte requirements belong to the installer.
- Actual: runtime probe always requires free quota >= model.totalBytes, including installed/resident cases. Download headroom can be sufficient initially and activation fail after those bytes are stored.
- Location: `src/lib/brain/adapters/browser-wasm.ts:239-263,335-340`; `src/lib/brain/runtime-activation.ts:95-100`; `src/lib/brain/installation-authority.ts:623-626` download headroom.
- Root cause: missing-artifact storage admission is conflated with compute/memory/runtime readiness.
- User impact: completed installs on low-storage browsers cannot provide offline answers and repeatedly fail available runtime paths. Physical mobile near-full-quota evidence remains untested.
- Recommended fix (not executed): installer checks only additional required bytes; adapter probes compute/memory and verified existing artifacts appropriately. Test cached/resident/cold/missing model with low free quota.
- Release blocker: yes for dependable installed offline capability.


### F-078 — Minor / FAIL — Donor failed screen capture leaves vision permanently busy
- Found by: SOURCE REVIEW and AST-only actual tool method with capture double.
- Reproduction: screen_process capture raises after busy=True. First result fails; busy remains True. After cooldown timestamp reset, second request returns “Vision is still processing the previous request” without capture retry. No screen/camera/provider was accessed.
- Expected: failed capture releases busy ownership so retry is possible.
- Actual: only successful later flush/turn or reconnect clears the flag; failure catch does not.
- Location: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/main.py:1164,1175,1256,1456,1567,2109` (`_execute_tool`, vision state).
- Root cause: busy lifecycle cleanup exists only on later success/reconnect paths.
- User impact: transient donor capture failure disables vision until reconnect if reused.
- Recommended fix (not executed): preserve donor; adaptation must release failure ownership in finally while keeping successful pending-injection ownership explicit, with retry tests.
- Release blocker: no for current runtime.


### F-079 — Major / PARTIAL — Configured notification email is recorded as sent without an email transport
- Found by: SOURCE REVIEW; cross-checked channel selection, report creation and server dispatch. Deployed email configuration/delivery remains UNTESTED.
- Reproduction: configure VITE_TRANSACTIONAL_EMAIL_SENDER, choose email delivery for an eligible security notification, trace send.server dispatch. Email is selected and recorded as sent; only web_push has provider dispatch.
- Expected vs actual: sent requires provider acceptance; actual email success is generated from channel selection alone.
- Location/root cause: `src/lib/notifications/channels.ts:57-66,95`, `preferences.ts:229-240`, `delivery.ts:65-71`, `send.server.ts:86-108`; sender configuration exposes a channel with no implemented transport.
- User impact: misleading security-alert delivery records and missed alerts when this configuration is used.
- Recommended fix (not executed): implement verified email dispatch or keep the channel unavailable; record transport outcome. Verify selected, rejected, accepted and provider-failure cases.
- Release blocker: conditional on deployed email availability; source defect confirmed, deployed behavior unverified.


### F-080 — Minor / FAIL — Offline reasoning filter drops literal answer suffixes at stream end
- Found by: SOURCE REVIEW and actual extracted reasoning filter fixture (`work/check-reasoning-filter-final-tail.cjs`).
- Reproduction: finish output with `The less-than symbol is <` or `HTML tag begins <th`; actual output omits `<` / `<th`. Ordinary answer control passes.
- Expected vs actual: literal text survives clean EOF; actual pending prefix is discarded.
- Location/root cause: `src/lib/brain/adapters/browser-wasm.ts:71-95,615-637`; a possible `<think>` prefix is buffered but never flushed at successful EOF.
- User impact: incomplete offline answers, especially HTML/math explanations. No real model inference exercised.
- Recommended fix (not executed): finalize filter state explicitly and preserve literal unfinished prefixes while retaining reasoning redaction; test split tags and EOF cases.
- Release blocker: no individually.


### F-081 — Minor / PARTIAL — Preserved donor memory UI makes a false local-only disclosure
- Found by: SOURCE REVIEW; cross-checked disclosure against prompt construction and Gemini connection. No provider request performed.
- Reproduction: read MemoryOverlay disclosure “Nothing here is sent anywhere”; saved memory is formatted into Gemini system_instruction during connection.
- Expected vs actual: disclosure explains remote model use; actual claim contradicts the source data flow.
- Location/root cause: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/ui.py:2259-2261`; `main.py:964-965,1015-1024,2097`; UI privacy wording is detached from provider prompt behavior.
- User impact: donor users may save sensitive information under a misleading expectation if the donor is reused.
- Recommended fix (not executed): preserve original provenance; any adaptation must accurately disclose destination and consent controls, verified against actual prompt assembly.
- Release blocker: conditional donor reuse; not current shipped-path evidence.


### F-082 — Minor / PARTIAL — Preserved donor camera lifecycle can duplicate workers and leak captures
- Found by: SOURCE REVIEW; hardware execution BLOCKED/not attempted.
- Reproduction: call camera start twice; each clears the shared stop flag and starts a worker. Failed-read retry replaces VideoCapture without releasing the previous capture; exception exit lacks guaranteed release.
- Expected vs actual: one owned camera worker with release on every exit/retry; actual worker creation and capture replacement omit those guarantees.
- Location/root cause: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/ui.py:3147-3151,3168-3185`; absent running guard and finally-owned capture cleanup.
- User impact: potential camera/resource contention if donor UI is reused. Physical camera symptoms unverified.
- Recommended fix (not executed): preserve donor; adaptation needs single worker ownership, stop/join and finally release. Verify restart, double-start, failed read and exception on legitimate camera hardware.
- Release blocker: no for current runtime.


### F-083 — Minor / FAIL — Donor bundled Base64url decoder reuses the wrong alphabet cache
- Found by: SOURCE REVIEW and actual bundled-library VM fixture (`work/support-donor-base64url-repro.cjs`), no traffic.
- Reproduction: decode `-_8` in URL-safe mode, then `+/8=` in standard mode on the same codec. Expected `fbff`; actual second decode `000f`. Fresh standard codec gives `fbff`.
- Expected vs actual: both supported alphabets decode consistently; actual first-selected alphabet remains cached across mode changes.
- Location/root cause: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/static/crypto-js.min.js:1` (disposable formatted copy lines 438-463); shared reverse-map cache is not keyed by alphabet.
- User impact: corrupted bytes if this Base64url mode-switch API is reused. Current dashboard uses Base64; shipped-path failure not established.
- Recommended fix (not executed): preserve bundled original; adapted dependency/codec must isolate alphabet caches and retain byte/protocol compatibility tests.
- Release blocker: no for current runtime.


### F-084 — Minor / FAIL — Donor reconfiguration silently discards unrelated saved preferences
- Found by: SOURCE REVIEW and AST-only actual method with in-memory Store (`work/support-donor-ui-repro.py`).
- Reproduction: existing config contains assistant_name, input_device and voice_name; invoke _on_setup_done. Result contains only gemini_api_key and os_system. No physical config write.
- Expected vs actual: changing setup fields preserves unrelated preferences; actual whole-file replacement loses them.
- Location/root cause: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/ui.py:5192-5196,5412`; reconfiguration serializes a new partial dictionary instead of updating existing configuration.
- User impact: unexpected preference reset if donor is reused.
- Recommended fix (not executed): preserve donor; adapted setup should merge validated changes with retained configuration and test initial setup/reconfiguration separately.
- Release blocker: no for current runtime.


### F-085 — Minor / FAIL — Donor glance facade silently calls an avatar it does not own
- Found by: SOURCE REVIEW and AST-only actual facade with fake HUD (`work/support-donor-ui-repro.py`).
- Reproduction: call JarvisUI.glance; expected HUD avatar call count 1, actual 0. self._avatar is never assigned and the exception is swallowed.
- Expected vs actual: facade forwards to owned HUD avatar; actual request silently disappears.
- Location/root cause: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/ui.py:5335-5341`; actual avatar belongs to HUD (`396-399,448-454`).
- User impact: dead donor facade API if a new caller uses it; current main calls HUD directly.
- Recommended fix (not executed): retain original provenance; adaptation should use the existing HUD ownership path and verify forwarding instead of duplicate facade state.
- Release blocker: no.


### F-086 — Minor / FAIL — Donor TTS playback failure leaves its producer blocked
- Found by: SOURCE REVIEW and AST-only actual speak method (`work/support-donor-tts-repro.py`); model/audio mocked.
- Reproduction: produce 20 fake chunks and make playback raise. Producer remains alive with queue full at 4; fixture manually drained, joined and confirmed cleanup afterward.
- Expected vs actual: consumer failure cancels/joins producer; actual blocking queue.put has no cancellation path.
- Location/root cause: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/tts.py:310-347`, especially 331/335/345; producer lifetime depends on uninterrupted consumption.
- User impact: leaked daemon/model resources after audio failure if donor TTS is reused.
- Recommended fix (not executed): adapted pipeline needs cancellation-aware queue operations and finally cleanup; test speaker failure, stop and model exception without real audio side effects.
- Release blocker: no for current runtime.


### F-087 — Major / FAIL — Donor undo can delete a pre-existing original or overwritten destination
- Found by: SOURCE REVIEW and AST-only actual file methods with entirely in-memory filesystem doubles (`work/support-donor-undo-repro.py`).
- Reproduction: an existing create_file target has snapshot-read failure; creation continues and undo deletes it as allegedly new. Separately copy over an existing destination; undo deletes the destination without restoring old content. Both originals become null; physical operations = 0.
- Expected vs actual: failure to preserve an original blocks mutation, and undo restores overwritten content; actual missing snapshot is treated as absence and copy undo only deletes.
- Location/root cause: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/file_controller.py:57-60,236-245,351,355-361`; undo provenance conflates unreadable with nonexistent and omits overwritten destination journaling.
- User impact: data loss if donor file control is reused. Current runtime has a separate implementation and requires separate verification.
- Recommended fix (not executed): preserve donor; adaptation must distinguish absence/read failure and durably journal originals before replacement. Verify occupied destinations and unreadable snapshots using disposable data.
- Release blocker: conditional donor reuse; not an additional current-runtime blocker.


### F-088 — Minor / FAIL — Donor spreadsheet sort returns CSV bytes under an XLSX filename
- Found by: SOURCE REVIEW and AST-only actual processor with fake DataFrame (`work/support-donor-formats-repro.py`); no physical write.
- Reproduction: sort fixture.xlsx; actual writer call is to_csv('fixture_sorted.xlsx'), and operation reports success.
- Expected vs actual: spreadsheet output retains its workbook format; actual CSV serialization carries the workbook suffix.
- Location/root cause: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/file_processor.py:396-403` (`_process_data`); shared sort branch ignores file_type when choosing writer.
- User impact: misleading format and failed workbook opening if donor processing is reused.
- Recommended fix (not executed): adapted writer must match selected format and preserve applicable workbook semantics; reopen generated disposable workbook as verification.
- Release blocker: no for current runtime.


### F-089 — Minor / FAIL — Donor advertises XML processing but dispatches it to JSON parsing
- Found by: SOURCE REVIEW and AST-only actual JSON handler fixture (`work/support-donor-formats-repro.py`).
- Reproduction: recognized XML input with valid XML content enters _process_json; actual result is “Invalid JSON”. No files or network changed.
- Expected vs actual: XML gets an XML parser or explicit unsupported response; actual advertised XML route uses json.loads.
- Location/root cause: `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/file_processor.py:71,422,823`; dispatch maps XML to the JSON handler.
- User impact: every valid XML processing request fails misleadingly if donor processor is reused.
- Recommended fix (not executed): adapted implementation should either support a bounded native XML parser or remove the unsupported capability; test valid/malformed XML separately from JSON.
- Release blocker: no for current runtime.


### F-090 — Minor / FAIL — Library items beyond the newest 500 are unreachable and search falsely reports no matches
- Found by: SOURCE REVIEW, server/UI cross-check and disposable 501-item boundary fixture (`work/check-library-ui-boundaries.cjs`). No hosted data created.
- Reproduction: keep 501 items; search for the oldest. Server returns at most newest 500; local UI filter reports no matches and has no next-page/search-server path. Fixture olderItemExists=true, visibleOlderMatches=0.
- Expected vs actual: retained files remain reachable/searchable; actual listing silently truncates with no truncation notice or paging.
- Location/root cause: `src/lib/library/library.functions.ts:57-72` (`listLibraryItems`); `src/routes/_authenticated/library.tsx:43-46,58-61,115-118,195-198`; hard-coded library-size assumption and no pagination contract.
- User impact: older retained files appear missing and cannot be opened/downloaded/deleted through this route. Real 501-item account evidence UNTESTED.
- Recommended fix (not executed): bounded cursor paging or server search with truthful completeness state; verify 499/500/501 items and name search across page boundaries.
- Release blocker: no individually; required for growing libraries.


### F-091 — Minor / PARTIAL — Library has no fallback when post-signing popup opening is unavailable
- Found by: SOURCE REVIEW and actual extracted component open method with popup double (`work/check-library-ui-boundaries.cjs`). Real Chrome/mobile popup policies remain UNTESTED.
- Reproduction: resolve signing normally, make window.open return null. Actual openCalls=1, problems=[]; no fallback appears. The browser opening call occurs after awaited signing. This is a boundary fixture, not proof of a blocked browser popup: noopener can also return null for a successfully opened window.
- Expected vs actual: unavailable popup produces a usable link/fallback or actionable message; actual method assumes a window opened and returns silently.
- Location/root cause: `src/routes/_authenticated/library.tsx:95-101` (open handler; item/Open and Download call the same handler); post-await window.open outcome is ignored; preview and Download share this path.
- User impact: conditional silent failure under popup restrictions; actual occurrence and browser activation behavior are not yet established. Do not infer failure from null alone.
- Recommended fix (not executed): provide ordinary signed-link navigation/download or owned pre-open/fallback, accounting for noopener return semantics; verify genuine Chromium and mobile activation behavior before choosing a fix.
- Release blocker: no individually; platform behavior evidence still required.

- Chrome local-fixture cross-check2026-10-04: seeded own-account62-byte ASCII text object/row using existing disposable stub routes (not upload UI). Clicking item/Open leaves page unchanged with no toast or new loopback tab in both controlled and user-tab inventories. Independent Download click yields no observed download event within8s and no new tab/error toast. Console warn/error empty. This is PARTIAL unexpected behavior under the actual test browser; popup/download restriction versus observer/fixture limitations is not yet isolated. Do not claim successful delivery or infer a production Storage outage.


### F-092 — Major / FAIL — Ready attachments disappear silently from the submitted question
- Found by: SOURCE REVIEW and actual forRequest fixture (`work/check-attachment-budget-omission.cjs`); no provider/browser upload performed.
- Reproduction: select four ready PNG files of 5 MiB each, exactly the raw 20 MiB total budget. Actual requestNames contains only photo0.png and photo1.png; two selected files are omitted without warning.
- Expected vs actual: send all accepted attachments or explicitly refuse/report exclusions before clearing selection; actual budget break silently drops the remaining accepted files.
- Location/root cause: `src/lib/chat/attachments.ts:169-185` compares Base64 character count against a raw-byte budget; `src/components/chat/ChatWorkspace.tsx:230-248,314-326` accepts pending files then clears them after passing the truncated request. Text cost likewise uses character length rather than UTF-8 bytes.
- User impact: incomplete comparisons/answers while users believe all selected files reached the model; attachment context lost from the question.
- Recommended fix (not executed): consistent payload/decoded-byte budgets and explicit exclusion/refusal result before send; verify multi-image boundaries, Unicode text, order and restored pending selections. Real four-photo browser evidence remains PARTIAL.
- Release blocker: yes for truthful attachment submission.

- F092 source-PARTIAL reading-state extension: ChatWorkspace247-248 resolves readAttachment asynchronously; submission314-316 calls forRequest then clears all pending items, while Enter455-458/Send632-633 do not wait for reading chips. attachments173-174 skips nonready, and late completion maps into cleared selection. A send before reading resolves can silently lose the accepted file. This extends F092, not a duplicate new finding; no new execution. Recommended admission wait/disable or explicit exclusion, with retained selection.


### F-093 — Major / FAIL — OAuth callback fallback exchanges the entire URL instead of the authorization code
- Found by: SOURCE REVIEW and installed SDK with fake fetch (`work/check-auth-error-boundaries.cjs`); networkRequests=0, no credentials or provider used.
- Reproduction: callback has code=fixture-code and no restored session. Route invokes exchangeCodeForSession(full URL); installed AuthClient serializes auth_code as `https://fixture.invalid/auth/callback?code=fixture-code`, not `fixture-code`.
- Expected vs actual: fallback exchanges the extracted authorization code; actual payload supplies a URL the auth endpoint cannot interpret as that code.
- Location/root cause: `src/routes/auth.callback.tsx:88-101` (`restore`), installed `@supabase/auth-js` GoTrueClient exchangeCodeForSession/_exchangeCodeForSession; authCode is checked but url is passed.
- User impact: fallback cannot recover sign-in when automatic session detection did not consume the code. Ordinary automatic exchange may succeed independently; live OAuth fallback remains UNTESTED.
- Recommended fix (not executed): supply extracted code with the SDK's expected contract; verify automatic completion, missing session, reload and transient exchange failure with isolated auth fixtures.
- Release blocker: yes for the advertised fallback path, not proof every Google sign-in fails.


### F-094 — Minor / FAIL — Failed auth-client load leaves OTP resend permanently busy
- Found by: SOURCE REVIEW and actual extracted resend method with rejected load double (`work/check-auth-error-boundaries.cjs`).
- Reproduction: cooldown=0; invoke resend and reject loadSupabaseClient with a chunk/network error. Actual thrown=true, resending=true, errors=[].
- Expected vs actual: show actionable failure and release busy state; actual rejected await skips all reset/error rendering, leaving resend disabled until route reload.
- Location/root cause: `src/routes/auth.verify.tsx:153-182` (`resend`); busy is set before client load but no enclosing catch/finally owns cleanup.
- User impact: code resend unavailable after transient client loading failure, with no explanation. Real browser chunk outage remains untested.
- Recommended fix (not executed): wrap the whole load/send lifetime with friendly error handling and finally busy cleanup; verify failed import/send followed by successful retry.
- Release blocker: no individually.

- Verify-button lifetime extension2026-10-05 (Minor/PARTIAL subcase, source only): auth.verify.tsx:113-129 sets busy before verifyOtp await; rejection skips returned-error handling145 and leaves Verify disabled214, with no catch/finally through152. SDK returned error is handled; rejected-await hosted incidence UNTESTED. Reuse bounded try/catch/finally UI ownership across load/verify/resend while retaining throttle rules. No credential, OTP, provider, session or auth/security execution; no new count or enforcement claim.
- Reset-button lifetime extension2026-10-05 (Minor/PARTIAL subcase, source only): reset-password.tsx:147-149 sets busy before updateUser await with no catch/finally through168; rejection skips reset149 and leaves Update password disabled259. Returned SDK errors150-164 are handled; actual rejected-await hosted incidence UNTESTED. Same bounded cleanup recommendation; no password, provider, account or auth/security execution, no new count.


### F-095 — Major / FAIL — Editing or regenerating offline chat retains replaced turns in its replay journal
- Found by: SOURCE REVIEW and actual resend/journal/flush fixture (`work/check-offline-edit-retains-old-turns.cjs`), mocked append transport, no live writes.
- Reproduction: offline journal holds old question and answer; edit the question and reconnect. Visible transcript has edited question, but waiting and uploaded turns contain old question, old answer, edited question; deletionCalls=0.
- Expected vs actual: replaced turns retire from the pending journal before replay; actual UI replacement leaves durable old content eligible for upload.
- Location/root cause: `src/lib/chat/use-chat.ts:814,833-835` changes screen and skips server deletion for wholly unsynced turns; no journal retirement. `unsynced-turns.ts:144-159` retains client keys; `src/lib/ocade-chat-store.ts:200-229` replays them.
- User impact: old/replaced personal text resurrects in saved history and answers can show contradictory history. Physical IndexedDB/reconnect UI evidence remains PARTIAL.
- Related source-only branch: individual unsynced Delete passes a temporary turn id to UUID-only `deleteMessage` (`src/lib/ocade.functions.ts:184-186`) and restores the screen on refusal (`use-chat.ts:867`); it also lacks journal retirement. This branch requires its own executed UI proof.
- Recommended fix (not executed): one journal-aware replacement/deletion lifetime coordinated with in-flight drains and synced atomic deletion; verify edit/regenerate/delete/reconnect races and rollback without restoring retired text.
- Release blocker: yes for faithful offline conversation persistence.


### F-096 — Minor / FAIL — Preserved historical Calculator revalidation points to the wrong finding
- Found by: SOURCE REVIEW; cross-checked canonical index and local section, no old runtime test repeated.
- Reproduction: historical audit line2719 calls installed Calculator misclassification JARVIS-037; index40 and section2682/checkpoint2734 identify JARVIS-016. Index61 assigns JARVIS-037 to a different terminal boundary finding.
- Expected vs actual: revalidation references the app-discovery finding; actual copied id links unrelated evidence/severity.
- Location/root cause: `docs/audits/2026-09-27-jarvis/OCADE-JARVIS-ERROR-AUDIT-01.md:2719`, cross-reference `:40,61,2682,2734`; stale copied identifier.
- User impact: misleading historical remediation/evidence linkage. Historical SHA4c6893e findings and passes are not current f277408 proof.
- Recommended fix (not executed): annotate/correct the historical cross-reference under separately authorized documentation work, preserving original counters/timestamps/provenance.
- Release blocker: no current runtime implication.

- Additional confirmed occurrences: the same audit `:2772` mislabels missing-file path disclosure as JARVIS-038 instead of JARVIS-021 (`:2740,2786`). Preserved master ledger `docs/audits/2026-09-27-jarvis/OCADE-JARVIS-current-main-master-ledger-2026-09-26.md:2613,2666` repeats the wrong Calculator/path IDs; its section/checkpoint identities are `:2576,2628,2634,2680`. These are the same historical reference defect, not new runtime failures.


### F-097 — Major / FAIL — Staff customer detail turns failed usage/task reads into empty history
- Found by: SOURCE REVIEW and actual readCustomer handler with permitted caller/transport doubles (`work/check-customer-read-outage.cjs`); no live SQL/auth requests.
- Reproduction: usage RPC and task/last-use queries return database unavailable. Actual returnedSuccess=true, usage=[], tasks=[], lastUsed={chat:null,jarvis:null}.
- Expected vs actual: affected sections report unavailable; actual response is indistinguishable from genuinely unused account/no tasks.
- Location/root cause: `src/lib/admin/staff.functions.ts:357-402` (`readCustomer`); data extraction discards each result.error and replaces missing data with empty arrays/null. `src/routes/_authenticated/admin.tsx` renders these as ordinary customer detail.
- User impact: support/billing operators can make decisions on false usage/history. Deployed outage UI remains PARTIAL.
- Related source-only concern: security detail error results are also discarded at `staff.functions.ts:404-417`; reproduction of that security branch remains BLOCKED by the unavailable permitted workflow, not counted as separately proven failure.
- Recommended fix (not executed): check read errors and model section unavailability explicitly; verify partial/global database faults and genuinely empty accounts independently.
- Release blocker: yes for truthful operator diagnostics.

- F097 second-pass companion-read pattern extension (Minor/PARTIAL scope): src/lib/admin/staff.functions.ts:163-168 checks staff/invite/default queries but ignores profiles.error, returning null emails on a failed identity read. ConsoleModules.tsx:344,443 substitutes UUID/they while controls remain usable. Source-only outage contract, no request/permission mutation. Expected explicit partial identity-read failure/retry rather than indistinguishable unavailable email; UUID fallback may still identify known staff, so no incorrect permission or total page failure claimed. Preserve F097 as one swallowed-companion-query family finding.

- F097 companion-read extension also covers listCases staff.functions.ts:633-636 and listAudit:783-787: profiles.error ignored, UUID fallback returned as successful companion identity read. Root exact source cross-check, no staff/customer requests. Same pattern, not additional findings.


### F-098 — Major / FAIL — Library deletion returns success while physical file removal stays pending
- Found by: SOURCE REVIEW and actual deleteLibraryItem/sweepTombstones with owned-row/mock Storage outage (`work/check-library-delete-pending-success.cjs`); no live Storage mutation.
- Reproduction: delete owned item and make Storage.remove fail. Sweep returns pending=1; actual serverReported={ok:true}. Index row disappears, pending removal is hidden.
- Expected vs actual: disclose indexed removal versus pending byte erasure and provide a reliable retry lifetime; actual normal success suppresses pending result. Bulk deletion likewise discards it.
- Location/root cause: `src/lib/library/library.functions.ts:204-225`; `src/lib/library/tombstones.server.ts:35-56`; sweep intentionally retains failed tombstones, callers ignore returned pending. Current retry is tied to a later owner deletion, not an autonomous sweep.
- User impact: bytes remain retained after apparently completed deletion; disappeared item has no own retry action in Library. Data Controls also receives no physical-erasure status. Physical hosted outage/UI evidence remains PARTIAL.
- Recommended fix (not executed): return/surface pending erasure with safe retry or reliable background processing, retain tombstones until Storage confirmation and verify fail/retry/partial/bulk cases.
- Release blocker: yes for truthful file erasure.


### F-099 — Major / FAIL — Stop during allowance claiming still starts online provider work
- Found by: SOURCE REVIEW and actual handleOnlineIntelligence with stub dependencies (`work/check-provider-stop-during-allowance.cjs`); no live auth/provider/customer requests.
- Reproduction: abort request.signal during awaited claimPermit, then resolve a successful claim. Actual requestAborted=true, providerCalls=1, providerWasAborted=false, status=200, finalDelivered=true.
- Expected vs actual: stopped request starts no generation and releases unused claimed capacity; actual provider gets a fresh live signal after the abort event has already occurred.
- Location/root cause: `src/lib/intelligence/edge-handler.ts:700-709`; the request abort listener is registered after asynchronous claim and never copies signal.aborted. Provider timeout can remain active for 110 seconds.
- User impact: provider work/resources and settlement can continue after Stop/leave during the claim window. Deployed request-abort propagation remains PARTIAL.
- Recommended fix (not executed): establish abort ownership before awaits and check current signal state before provider dispatch, with correct unused-permit settlement; verify pre-abort, abort during claim, after dispatch and stream Stop races.
- Release blocker: yes for dependable Stop/resource accounting.


### F-100 — Minor / FAIL — Provider retries skip default backoff when Retry-After is absent
- Found by: SOURCE REVIEW and actual retryAfter fixture (`work/check-provider-default-retry-delay.cjs`); no provider calls.
- Reproduction: absent Retry-After at attempts0/1/2 produces [0,0,0] ms; explicit one second produces 1000 ms.
- Expected vs actual: missing header uses configured 250/500/1000 ms fallback; actual Number(null)=0 selects immediate retry.
- Location/root cause: `src/lib/intelligence/edge-handler.ts:340-343`, callers `:784,815,821`; missing header is parsed as explicit zero. Network-exception caller constructs a headerless503, guaranteeing this branch.
- User impact: outage/rate-limit requests retry immediately and increase load instead of giving recovery time. Actual provider header behavior unmeasured.
- Recommended fix (not executed): distinguish absent/empty values before numeric parsing; retain explicit zero and test numeric/date/invalid/missing headers with actual delay values.
- Release blocker: no individually.


### F-101 — Minor / FAIL — Service-only table coverage assertion checks its own list length instead of current coverage
- Found by: SOURCE REVIEW and cross-check against filtered read-only live metadata snapshot, observed2026-10-04. No permission probes or writes executed.
- Reproduction: inspect test “covers every table the live advisor reports as policy-free”: only expect(SERVICE_ONLY).toHaveLength(7). Current advisor snapshot reports16 intended policy-free tables, nine outside the literal list; assertion still evaluates7=7.
- Expected vs actual: completeness check compares discovered intended service-only tables against the test scope; actual assertion cannot detect any new unlisted table.
- Location/root cause: `src/lib/__tests__/service-only-tables-stay-closed.test.ts:25-33,63-68`; frozen self-count presented as discovery coverage.
- User impact: false confidence in completeness of a regression gate. Advisor policy-free status is intentional design and is not itself a vulnerability or missing-policy bug.
- Recommended fix (not executed): compare disposable migrated catalog/explicit authority inventory to the declared scope, retaining legitimate no-policy designs; fail clearly on an unaccounted new table.
- Release blocker: no individually; current table protection remains a separate evidence class.


### F-102 — Minor / FAIL — Commercial seam test silently omits current JARVIS surface
- Found by: SOURCE REVIEW; cross-checked test arrays against canonical exported types/constants, no SQL executed.
- Reproduction: compare surfaces=[chat] in the allegedly exhaustive suite to GENERATION_SURFACES=[chat,jarvis]. it.each never runs JARVIS. Array element typing also does not enforce inclusion of every future union member.
- Expected vs actual: every current surface/tier seam is checked; actual current JARVIS surface is omitted despite exhaustive-coverage commentary.
- Location/root cause: `src/lib/commercial/__tests__/ledger-against-postgres.test.ts:194-205`; `src/lib/commercial/generation-gate.ts:57-58`; manual nonexhaustive vocabulary duplicates the canonical authority.
- User impact: a required current surface has no coverage in this promised seam gate. No runtime JARVIS database refusal inferred; other JARVIS suites remain separate evidence.
- Recommended fix (not executed): derive surfaces from canonical constants and enforce exhaustive tier keys; compare appropriate SQL constraint parity with independent fixtures.
- Release blocker: no individually; verification gap.


### F-103 — Minor / PARTIAL — Database-backed gate suite omits explicit database cleanup
- Found by: SOURCE REVIEW; entire285-line suite read by reviewer, root cross-checked imports/setup/absence of close and DatabaseTwin lifetime.
- Reproduction: inspect suite setup creating DatabaseTwin and registering no afterAll/close. Resource measurement/watch rerun remains UNTESTED; no additional SQL executed.
- Expected vs actual: explicit test-owned database disposal after success/failure; actual PGlite ownership is left to worker teardown/GC.
- Location/root cause: `src/lib/commercial/__tests__/gate-against-postgres.test.ts:1,104-118`; `scripts/db-twin.mts:327-332,506-507` exposes explicit close; neighboring suites use afterAll.
- User impact: avoidable test/WASM resource retention, particularly reruns; actual bytes/handle persistence unmeasured.
- Recommended fix (not executed): use existing afterAll close and failure-safe setup ownership, verify repeated isolated suite execution without growing resources.
- Release blocker: no individually.


### F-104 — Minor / FAIL — Offline transfer reports HTTP source failures as a dropped connection
- Found by: TESTING and SOURCE REVIEW, observed2026-10-04. Local Chrome Settings > Privacy & Security shows “The connection kept dropping while OCADE was preparing this device.” Local private model artifacts are unavailable in the disposable harness; production artifact availability is UNTESTED.
- Cross-check/reproduction: inspect fetchChunk terminal retry branch: stable non-success HTTP responses reach the same failure=network/retriable=true result as transport exceptions. Actual transferModel disposable fixture received five responsive HTTP404 results, zero exceptions/writes/source switches, and returned failure=network/retriable=true with this connection text. Sleep requests375/750/1500/3000/6000ms were intercepted to avoid waits; work/check-transfer-404-reason.log preserves the result. Actual local HTTP status was not captured; no claim that Chrome observed404.
- Expected vs actual: distinguish unavailable/refused model sources from interrupted transport; actual terminal response text advises a connection problem regardless of HTTP cause.
- Location/root cause: `src/lib/brain/model-transfer.ts:498-599`, fetchChunk exhausted retries return the unconditional network reason; `src/routes/api/offline/bytes.$release.ts:89-102` can return missing-store503 or missing-artifact404. `scripts/e2e/offline-journey.mjs:11-15` explicitly excludes real installation because the private artifact bucket is unavailable.
- User impact: misleading recovery advice and repeated repairs when an artifact source is missing or refuses access. Local installation readiness is BLOCKED by the fixture environment, not evidence of a production outage.
- Recommended fix (not executed): retain HTTP status and source-failure classification after bounded retries; reserve connection wording for transport failures and preserve legitimate refresh/rotation behavior.
- Release blocker: no individually; real model installation still requires separate available-artifact evidence.


### F-107 — Minor / FAIL — Committed deferred-issue document fails the required formatting gate
- Found by: TESTING and SOURCE REVIEW, observed2026-10-04. Read-only prettier --check . exits1 and names only docs/DEFERRED_GEMINI_ISSUES.md; independent check of that document also exits1.
- Reproduction/cross-check: run installed formatter in the disposable exact-main checkout without --write. Inspect package format:check and verify-full requirement. work/ordinary-gate-format.log records output.
- Expected vs actual: committed nonexempt files satisfy the required formatting gate or carry an explicitly justified authority exemption; actual document does neither and fails verification.
- Location/root cause: `docs/DEFERRED_GEMINI_ISSUES.md`; `package.json:23`; `scripts/verify-full.mjs:20`; .prettierignore does not exempt this document. Disposable formatting comparison confirms table alignment/padding only at lines16-27; both versions30lines, no semantic text change.
- User impact: full CI/release verification cannot pass; no product behavior defect inferred.
- Recommended fix (not executed): review formatting-only delta and preserve authority/provenance contents; apply approved formatting or a specifically justified existing-policy exemption later.
- Release blocker: required verification gate failure.


### F-108 — Minor / FAIL — Help names a network mode that the current composer does not offer
- Found by: TESTING and SOURCE REVIEW, local Chrome/mobile Help accordion expanded and compared to current composer.
- Reproduction: open Help > What does Auto, OCADE and Offline mean? It instructs that OCADE answers over the network. Open Chat; mode buttons are Auto, Online, Offline, with no OCADE mode button.
- Expected vs actual: help uses the actual control label Online; actual question and explanation use a retired/different label OCADE.
- Location/root cause: `src/routes/help.tsx:85-91` static help vocabulary; `src/components/chat/ChatWorkspace.tsx:42` current online label.
- User impact: small but concrete instruction mismatch for users choosing network mode.
- Recommended fix (not executed): align help with canonical visible labels, keeping explanation of provider/network semantics.
- Release blocker: no individually.


### F-109 — Minor / FAIL — Published privacy/support contact guidance leads to a page with no contact channel
- Found by: TESTING and SOURCE REVIEW. Actual local Privacy and Terms links lead to Help; Help exposes FAQs/search and only links back to Terms/Privacy.
- Reproduction/cross-check: Privacy section15 says requests use the OCADE ticket system and directs users to Help for current contact status. Visit Help and inspect every accordion/public link; no ticket submission, contact-status section or verified contact destination exists. Source route inventory and ticket/contact searches contain legal copy and internal staff/account comments, not a customer ticket route.
- Expected vs actual: promised ticket/contact direction reaches an available channel or explicitly explains its unavailability; actual guidance loops between Help and legal pages.
- Location/root cause: `src/components/legal/LegalContent.tsx:338-351,551-557`; `src/routes/help.tsx:433-436` footer links back to legal documents. Static contact claims lack a connected user destination.
- User impact: a user cannot follow published instructions to reach support/privacy/security/grievance channels through the site. This finding does not assert a legal compliance determination or whether an external unpublished channel exists.
- Recommended fix (not executed): connect one verified existing channel and publish honest availability; update contact guidance consistently without inventing addresses or duplicating support systems.
- Release blocker: support/privacy readiness gap; no account or service mutation executed.


### F-110 — Minor / PARTIAL — Rapid fixture account switch loses an email field value; timing cause unresolved
- Found by: TESTING, suspicious unconfirmed behavior recorded2026-10-04. Not a confirmed hosted authentication defect.
- Reproduction/cross-check: loopback Admin sign-out followed immediately by waiting for Email textbox, filling Billing fixture email, switching to password, filling fixture password and Sign in. Flow stayed on auth with blank email and Enter your email address and password. Refill after settled render succeeds and Billing Console loads normally. Earlier independently paced Owner/Support flows retain email.
- Expected vs actual: filled email remains through mode selection and submission; actual rapid sequence lost it once. Tool fill/hydration/navigation timing versus genuine keyboard behavior is unresolved; no real credentials or external authentication used.
- Location/root cause: `src/routes/auth.index.tsx:107-109,317,328,344` controlled state/onChange; no explicit mode-switch setEmail reset found. Likely early-render lifecycle or automation event timing, not established source fault. Further genuine keyboard/slow-load evidence required before attributing to the product.
- User impact: if reproducible for real early user input, sign-in requires re-entry; current evidence may be limited to automation timing.
- Recommended fix (not executed): first reproduce with actual key input and measured route/hydration lifecycle; preserve user input if a product race is established. Do not change product code solely on this fixture incident.
- Release blocker: no individually; UNCONFIRMED.


### F-111 — Minor / PARTIAL — Device Agent treats any listener on its fixed port as the running agent
- Found by: SOURCE REVIEW during safe Windows startup preflight; independently source-crosschecked. No port spoofing, service probe, process stop or multi-user runtime reproduction executed.
- Reproduction: trace already_running with a successful connection to47831, regardless of responder identity. main returns with OCADE Device Agent is already running. Port is global on the machine while exit-token state is per account home.
- Expected vs actual: distinguish this account's agent from occupied unrelated resources/another account's instance; actual any successful TCP connection suppresses startup with the same running message.
- Location/root cause: `jarvis-runtime/ocade_agent.py:39,46-68,110-118,598-608`; fixed global resource and listener existence substituted for instance identity. Exit authorization is a separate protected path and is not shown broken by this finding.
- User impact: unrelated port occupancy or another Windows session can prevent this account's legitimate agent from starting; fully isolated foreground startup cannot choose an alternate port. Actual frequency/environment occurrence unmeasured.
- Recommended fix (not executed): use an account-scoped instance lock/IPC and distinguish busy nonmatching endpoints; preserve authenticated stop and failure accounting. Never kill an unverified listener to make the test pass.
- Release blocker: compatibility/startup evidence gap; not individually confirmed in a real multi-user environment.


### F-112 — Minor / FAIL — Device executor cleanup leaves its owned egress proxy running
- Executed ordinary lifecycle corroboration2026-10-04, reconciled2026-10-05: unchanged actual Agent/Identity idle fixture completed two owned loopback exchanges, transmitted/acknowledged STOP and agent.run returned0 in its owned worker thread. proxyAliveAfterWorkerExit=true confirms proxy retention at worker exit. Harness then explicitly shut down/joined all three owned threads; cleanup errors and remaining owned threads were empty. Duration5.703s. No enrollment, provider, physical actions or production writes; host capabilities/apps doubled. Exact work/idle-stop-fixture/results.json and practical-idle-stop.py retain digests/containment. This establishes one retained-process lifecycle, not sustained/repeated resource growth.
- Found by: SOURCE REVIEW during Windows foreground preflight, later corroborated by the named isolated ordinary idle lifecycle above. No browser or physical control action executed.
- Reproduction: follow Browsers construction, EgressProxy constructor and executor _halt/close. Constructor binds an ephemeral loopback socket and starts a serve_forever daemon thread. Browsers.close only drops browser sessions; no shutdown/server_close path exists in these modules.
- Expected vs actual: final executor disposal releases all owned sockets/threads; actual proxy survives close while the parent process remains alive. Process termination eventually reclaims resources; repeated/sustained lifecycle growth remains UNTESTED, while the one named idle fixture confirms retention.
- Location/root cause: `jarvis-runtime/ocade_device.py:84-87,177-179,309-314`; `jarvis-runtime/ocade_egress.py:133-144`; task-session cleanup used without a distinct final proxy lifecycle.
- User impact: stopped/abandoned executor instances can retain listeners/threads and complicate repeated tests/embedded use; sustained resource impact unmeasured. Separate from preserved-donor browser thread finding F024.
- Recommended fix (not executed): distinguish reusable task session cleanup from final executor disposal; final shutdown/server_close and bounded thread join on lifecycle exit, with repeated ownership checks.
- Release blocker: no individually; required resource lifecycle evidence incomplete.

- F112 owned-input-hook extension: InputGuard ocade_computer.py:244-255 starts mouse/keyboard listeners without retaining handles or any stop/close method. Agent._halt ocade_device.py:309-314 closes browsers only. Embedded/repeated executor lifetime can retain owned hook workers after STOP; physical hook behavior UNTESTED, no listeners started. Track/stop/join only owned handles with existing lifecycle.


### F-113 — Minor / PARTIAL — Fixture conversation export has no observed download; cause unresolved
- Found by: TESTING and SOURCE REVIEW2026-10-04. Suspicious unconfirmed behavior, not a demonstrated production export failure.
- Reproduction/cross-check: local in-app browser opens a two-message disposable conversation menu, registers download observer before Export, selects Export; observer times out10s, menu closes and no warning/error appears in captured console. Rename preview/Escape works. Library download observation was also unavailable F091, suggesting environment-level observability remains possible.
- Expected vs actual: user receives a Markdown download; no download was observed by this tool. Actual filesystem/destination result and cross-browser export outcome remain UNVERIFIED.
- Location/root cause: `src/lib/chat/use-chat.ts:989-1007` formats rows and calls saveFile; `src/lib/utils.ts:15-21` creates a detached download anchor then immediately revokes its object URL. Observer/backend limitations versus asynchronous download/object-URL lifecycle are unresolved; immediate revocation is an investigation candidate, not established causation.
- User impact: if this reflects a real download failure, conversation preservation silently fails; current evidence cannot establish affected users/platforms.
- Recommended fix (not executed): verify real file delivery/content in an observable browser first, then change URL lifetime only if a browser-specific race is established. Preserve eventual blob cleanup and avoid treating observer timeout as proof of product failure.
- Release blocker: no individually confirmed blocker; export evidence remains incomplete.


### F-114 — Minor / FAIL — Android builder selects SDK directories lexicographically
- Found by: SECOND SOURCE REVIEW2026-10-05; pure path-order cross-check only, no build/install/config changes.
- Reproduction: evaluate the exact max(Path) selection with installed-directory names android-35 and android-9, and tools35.0.0 and9.0.0. Selected values are android-9 and9.0.0. No SDK artifacts or subprocess executed.
- Expected vs actual: choose the supported/pinned SDK and build tools compatible with target35 and Java17; actual directory-string ordering chooses an older single-digit version above modern versions and does not filter metadata/nonversion entries.
- Location/root cause: `android/build.py:23-25`; bare max on SDK directory Path values treats names as text, not version/API numbers. `android/AndroidManifest.xml:14` targets35; javac/d8 assumptions at build.py72-77 depend on suitable tools.
- User impact: a legitimate SDK installation containing older versions can cause compile/dex failure or select an unintended toolchain. Actual current-host APK build not rerun; installed SDK version combination is not claimed to trigger this defect today.
- Recommended fix (not executed): choose an explicit supported API/tool version or parse/filter version directories, with clear missing-tool error. Keep owner signing and release transport policies unchanged.
- Release blocker: affected build environments; current production runtime unaffected by this source-only selection check.


### F-115 — Major / PARTIAL — Android STOP can lose cancellation while publishing a new step
- Found by: SECOND SOURCE REVIEW2026-10-05; source interleaving cross-check only, no Android control/reproduction executed.
- Cross-check: AgentService work checks stopAll before command admission, then replaces cancel with a fresh false AtomicBoolean and starts the step. STOP on the UI/service thread between that check and replacement sets the old cancel and stopAll, but the new worker receives an uncancelled token. Control.run checks only its supplied token before dispatch; no shared admission lock/generation fence closes this interval.
- Expected vs actual: local STOP prevents a not-yet-started step from beginning; source permits one new step after STOP in this narrow interleaving. Later heartbeat may report STOP, but immediate local guarantee is not maintained. Frequency and physical Android occurrence unmeasured.
- Location/root cause: `android/src/in/ocade/app/AgentService.java:75-79,183-210`; `android/src/in/ocade/app/Control.java:78-90`. Individual atomic booleans do not make STOP check/token replacement/worker publication one atomic lifecycle transition.
- User impact: a phone action can begin after the person presses STOP, before remote cancellation catches up. Separate from server queued-batch F028 and already-cancelled desktop coordinate F006; no claim that all Android STOP fails.
- Recommended fix (not executed): serialize local STOP with command admission/token publication or use a monotonic cancellation generation; validate the generation immediately before dispatch and preserve pending STOP until its own acknowledgement.
- Release blocker: Android local STOP reliability requires correction and legitimate deterministic/physical lifecycle evidence; current Android practical environment remains BLOCKED.

- F115 second-pass desktop corroboration: jarvis-runtime/ocade_device.py:259-262,399-405,415-425 has the same admission-check to fresh-cancel-token replacement interval. Tray STOP/ Pause after admission check but before replacement can set the old token; the new worker holds a false token until later exchange. Root full loop read and exact source cross-check only, no active action or race reproduction. Synchronize admission/token publication with cancellation generation; preserve one finding for this cross-platform family.


### F-116 — Major / PARTIAL — Android control-loss deadline waits behind a longer blocking exchange
- Found by: SECOND SOURCE REVIEW2026-10-05, passive timeout/control-flow cross-check; no network-delay or device reproduction.
- Cross-check: AgentService promises cancellation after15s unreachable while a step runs, but checks elapsed time only in the exchange exception handler. Identity.exchange permits40s read timeout plus15s connection timeout; no independent deadline watchdog runs while post blocks.
- Expected vs actual: reachability loss cancels a running step by the stated15s boundary; source can wait beyond it for blocking I/O before setting cancellation. Actual step duration/platform occurrence is UNTESTED; ordinary short completed steps are not asserted to keep running.
- Location/root cause: `android/src/in/ocade/app/AgentService.java:33-34,155,216-221`; `android/src/in/ocade/app/Identity.java:158-160,187-201`. Timeout supervision shares the blocking exchange thread rather than an independent task deadline.
- User impact: an unusually stalled active step may remain uncancelled longer than the published control-loss bound when remote STOP cannot reach it.
- Recommended fix (not executed): maintain a monotonic independent cancellation deadline or bound exchange blocking to the remaining control-loss budget; verify actual delayed-I/O/active-step lifecycle in a legitimate isolated environment.
- Release blocker: remote control-loss guarantee remains unproven; Android physical/runtime evidence BLOCKED.

- F116 second-pass desktop corroboration: jarvis-runtime/ocade_device.py:47,350-375 checks elapsed control loss only after Identity.exchange returns/throws; ocade_identity.py:139,154,199-204 uses40-second blocking requests and may first rotate with another request. Thus declared15-second cancellation is not independently enforced while an exchange blocks. No delayed request/action execution performed; short actions and real platform timing not asserted. Use an independent bounded cancellation deadline consistent with transport.


### F-117 — Minor / PARTIAL — Android request exceptions bypass HTTP resource cleanup
- Found by: SECOND SOURCE REVIEW2026-10-05; passive source exception-path cross-check only.
- Cross-check: post creates HttpURLConnection, then writes body/reads response; disconnect is only on the normal path. Output failure, response timeout or readAll exception exits before disconnect; response InputStream is not explicitly scoped/closed. No socket exhaustion or real request executed.
- Expected vs actual: every owned connection/stream is released on success and failure; source lacks finally cleanup on repeated exception paths. Runtime socket retention/GC recovery magnitude is UNTESTED.
- Location/root cause: `android/src/in/ocade/app/Identity.java:187-205,237-242`; cleanup is a fall-through statement rather than guaranteed owned-resource lifecycle.
- User impact: repeated connection failures can retain resources until implementation/GC reclamation and make long-running mobile recovery less predictable.
- Recommended fix (not executed): wrap connection use in finally disconnect and response input in try-with-resources; preserve timeout and error semantics.
- Release blocker: no individually; sustained mobile resource evidence incomplete.


### F-118 — Minor / PARTIAL — Deployment can verify a bundle reporting a different source commit
- Found by: SECOND SOURCE REVIEW2026-10-05; support report independently crosschecked at source, no workflow/deployment executed.
- Cross-check: production workflow always checks out main, while Vite prioritizes triggering/inherited WORKERS_CI_COMMIT_SHA/GITHUB_SHA over git HEAD. A manual dispatch from another ref or stale CI variable can label main bytes with that other SHA. Deployment health gate compares service/version/deployment/config but never source commit, and build inherits the environment.
- Expected vs actual: embedded/verified commit identifies the checkout actually built; actual source permits unvalidated CI metadata and successful health verification with incorrect provenance.
- Location/root cause: `.github/workflows/cloudflare-production.yml:39-42`; `vite.config.ts:19-25,37`; `scripts/deploy.mjs:350-369,480-484`; `src/lib/release.ts:7-11`. Checkout and CI-event identities are conflated, with no promotion-time commit equality check.
- User impact: release/audit/rollback evidence can name the wrong source revision despite the bundle being built from main. Current observed deployed commit matches auditedmain; no current production mismatch asserted.
- Recommended fix (not executed): derive expected commit from actual checkout after checkout, embed it and verify health.commit against that authority before reporting promotion/final success.
- Release blocker: affected release provenance remains unproven; no deployment changed.


### F-119 — Major / PARTIAL — Staff permission editor retains stale drafts after refreshed records
- Found by: SECOND SOURCE REVIEW2026-10-05; passive UI/state/write-shape cross-check, no permission changes or enforcement probe.
- Reproduction contract: two authorized owner editors load the same member; one updates the record, the other refetches and opens Change. Member summary receives refreshed props, but draft arrays remain initial useState values. Saving a separate intended edit submits both stale full arrays and can reverse the other authorized change.
- Expected vs actual: editor starts from refreshed state or rejects a conflict; source keeps stale draft across same member.userId and replaces arrays without version comparison. Real multi-owner/browser reproduction remains UNTESTED.
- Location/root cause: `src/components/admin/ConsoleModules.tsx:161,273-274,283,366`; `src/lib/admin/staff.functions.ts:224-228`; `supabase/migrations/20261001096000_staff_act_within_their_own_reach.sql:110-112`. Props are snapshotted once, reopen does not reset them, persistence replaces the complete fields.
- User impact: authorized access changes unintentionally revert and visible refreshed summary disagrees with editing chips. This is an ordinary stale-state conflict, not a demonstrated authorization bypass.
- Recommended fix (not executed): initialize draft from latest member when opening; preserve/flag dirty drafts on external updates and use optimistic version conflict handling where appropriate.
- Release blocker: staff administration consistency requires correction/legitimate concurrency evidence.


### F-120 — Minor / PARTIAL — Conversation day grouping uses fixed durations across daylight saving
- Found by: SECOND SOURCE REVIEW2026-10-05; independently crosschecked date arithmetic, no browser/host-clock changes.
- Reproduction contract: local midnight following a daylight-saving transition; Yesterday threshold is today minus86400000, not prior local calendar midnight. Spring-forward can include the preceding day's23:00 hour; fall-back can exclude yesterday's00:00 hour. Seven-day threshold has the same calendar/duration mismatch.
- Expected vs actual: groups follow viewer local dates as documented; actual thresholds drift by an hour where offsets change. Physical/browser DST observation UNTESTED; India fixed-offset environment does not itself reproduce it.
- Location/root cause: `src/components/chat/ConversationList.tsx:255-271`; duration subtraction after local setHours, despite comment promising local midnights.
- User impact: users in DST zones see history under misleading day/week groups.
- Recommended fix (not executed): derive previous local calendar dates with setDate and local midnight, verify both transitions without changing host timezone.
- Release blocker: no individually.


### F-121 — Minor / PARTIAL — Bounded-read checker borrows a cap from an unrelated query
- Found by: SECOND SOURCE REVIEW2026-10-05; independently source-crosschecked gate logic, no security/probe or gate execution.
- Reproduction contract: an awaited select assigned to a variable has no cap; a different later query within1400chars has limit(1). assignedToVariable makes the checker search the entire window, so the unrelated query's limit marks the first select bounded.
- Expected vs actual: each read has its own evidenced bound; source accepts a nearby cap from another read. No current shipped uncapped read asserted by this counterexample.
- Location/root cause: `scripts/check-bounded-reads.mjs:58-74,95-99,115`; lexical window scanning loses query ownership for variable continuations.
- User impact: gate success can conceal a future/unnoticed unbounded database read and overstate resource readiness.
- Recommended fix (not executed): track the exact query chain/variable continuation or use an existing parser, with an adjacent bounded/unbounded query regression. Avoid inventing a broad framework just for the gate.
- Release blocker: gate assurance limitation, not a demonstrated production resource failure.


### F-122 — Minor / PARTIAL — Cancelled identity dialog can reopen after late setup completes
- Found by: SECOND SOURCE REVIEW2026-10-05; passive UI async-lifecycle cross-check, no OTP/provider/authentication execution.
- Reproduction contract: request confirmation, cancel during loading, then let delayed factor/client setup finish. Cancel settles false and sets idle, but late setup unconditionally sets totp/email/error and reopens a dialog with no pending resolver.
- Expected vs actual: cancelled flow remains closed and late work ignored; source permits an orphan modal after action already rejected. Actual real-provider timing UNTESTED; no proof or access is fabricated.
- Location/root cause: `src/components/security/ConfirmIdentity.tsx:40-75,159`; no cancellation generation/teardown guard across awaited setup and UI publication.
- User impact: surprise reopened confirmation cannot resume the cancelled action and confuses the next user interaction.
- Recommended fix (not executed): fence late setup by cancellation generation and settle owned pending requests on unmount; preserve genuine proof requirements.
- Release blocker: no individually; confirmation lifecycle correctness incomplete.


### F-123 — Minor / PARTIAL — Same-path chat selection leaves the mobile navigation drawer open
- Found by: SECOND SOURCE REVIEW2026-10-05; independently source-crosschecked, no new browser execution.
- Reproduction contract: at mobile / open navigation then choose New chat or a saved chat. New chat changes search/state while pathname stays /; saved conversation activation changes only chat state.
- Expected vs actual: destination selection closes drawer and exposes transcript; AppShell close effect depends only pathname, so same-path selection leaves drawerOpen true until manual dismissal.
- Location/root cause: `src/components/shell/AppShell.tsx:60-64,138-139`; `src/components/chat/ChatWorkspace.tsx:214-218`; `src/components/chat/ConversationList.tsx:164`; `src/lib/chat/use-chat.ts:949-960`. Navigation closure observes pathname rather than selection intent/location/state.
- User impact: new/selected chat is obscured by the drawer on mobile. Earlier different-path responsive navigation PASS does not cover this branch. Separate from focus-containment F048.
- Recommended fix (not executed): close drawer on sidebar/history selection or appropriate full-location change, retaining mobile keyboard/escape behavior.
- Release blocker: no individually; browser reproduction of this same-path branch remains UNTESTED.


### F-124 — Minor / PARTIAL — Accessibility checker misses icon controls with inline arrow handlers
- Found by: SECOND SOURCE REVIEW2026-10-05; independently source-crosschecked lexical matching, no scanner execution.
- Reproduction contract: an unnamed icon-only button has onClick={() => save()} and an aria-hidden icon. ICON_ONLY ends opening attributes at the arrow's > then fails to match the remaining handler text before the icon, skipping the unnamed control.
- Expected vs actual: unnamed icon controls are checked regardless of ordinary handler syntax; source raw regex misses this common shape despite an existing brace-aware attributes helper.
- Location/root cause: `scripts/check-accessibility.mjs:62-77,299-304`; separate [^>]* regex bypasses JSX-aware attribute ownership.
- User impact: a PASS can hide missing accessible names. No currently shipped unnamed control asserted by this source counterexample.
- Recommended fix (not executed): reuse existing brace-aware/parser ownership logic and verify inline arrows, comparisons, strings and nested controls with ordinary fixtures.
- Release blocker: accessibility assurance gap, not established current UI failure.


### F-125 — Minor / PARTIAL — Final UI sweep can pass with no successfully pressed controls
- Found by: SECOND SOURCE REVIEW2026-10-05; independently crosschecked full loop/terminal assertion, no journey execution.
- Reproduction contract: all selected controls are skipped/disabled/covered or click times out. Loop catches every interaction exception; final check only requires no page errors, even pressed=0. Visible controls are capped40 and reused by index after state changes.
- Expected vs actual: attempted/skipped/failed controls and intended identity determine coverage status; source can report a successful control sweep while no eligible action succeeded and omissions are silent.
- Location/root cause: `scripts/e2e/final-journey.mjs:90-100,108-141`; broad catch and page-error-only assertion substitute for per-control behavior/coverage proof.
- User impact: release evidence overstates reachable-control coverage; this does not prove a current product button failed. Existing F020 is a separate dialog setup assertion.
- Recommended fix (not executed): record stable control identity, attempted/success/skipped/failure outcomes, explicit cap/exclusions and unexpected exceptions; do not assert entire route scope from a partial sweep.
- Release blocker: exhaustive UI proof cannot rely on this sweep alone.


### F-126 — Minor / FAIL — Polish journey fabricates document-language PASS
- Found by: SECOND SOURCE REVIEW2026-10-05; independently crosschecked constant assertion, no browser/journey run.
- Reproduction/cross-check: metadata loop captures document.documentElement.lang, but asserts only title/description/OpenGraph. Subsequent language check receives literal true; missing/empty language would still pass.
- Expected vs actual: each inspected route's declared language is validated; actual evidence reports PASS without inspecting captured lang.
- Location/root cause: `scripts/e2e/polish-journey.mjs:355-370`; leftover unconditional success assertion and unused measured property.
- User impact: accessibility release evidence is unreliable. Current root document language is not asserted absent by this finding.
- Recommended fix (not executed): assert captured valid language per route and verify empty/missing-lang negative fixture.
- Release blocker: evidence-gate defect; no individual current document-language defect established.


### F-127 — Minor / PARTIAL — Device connection lookup failure is presented as an expired request
- Found by: SECOND SOURCE REVIEW2026-10-05; independently crosschecked thrown backend error and rendering branch, no enrollment/auth/provider action.
- Reproduction contract: valid pending connection request lookup suffers backend/network failure and query retries exhaust. pendingEnrollment throws; request.data is absent, rendering chooses expired/already-used rather than an error/Retry state.
- Expected vs actual: distinguish successful no-row from failed lookup; source incorrectly tells user to restart request from device.
- Location/root cause: `src/jarvis/JarvisPanels.tsx:912-919,944-948`; `src/jarvis/jarvis.functions.ts:609-617,636-638`; UI branches on !row without request.isError.
- User impact: transient outage causes unnecessary pairing restart and misleading device status; actual live request behavior remains UNTESTED/BLOCKED.
- Recommended fix (not executed): explicit query error state and bounded Retry/refetch; reserve expired copy for successful null result.
- Release blocker: no individually; device enrollment error evidence incomplete.


### F-128 — Minor / PARTIAL — Device approval proof logs success after a click without checking transition
- Found by: SECOND SOURCE REVIEW2026-10-05; independently crosschecked complete helper, no approval executed.
- Reproduction contract: Connect click succeeds as an input event while backend refuses or response remains pending. Helper sleeps1500ms then unconditionally prints approved with device ID and exits normally.
- Expected vs actual: approval proof verifies connected/ownership transition or reports failure; source records intent as completed approval without status or error assertion.
- Location/root cause: `scripts/e2e/approve-device.mjs:35-41`; fixed delay substitutes for acknowledged product outcome. Browser cleanup also lacks finally on intermediate failures.
- User impact: installed-device release evidence can claim connection despite refusal/delay. No current failed live approval asserted.
- Recommended fix (not executed): bounded wait for actual connected/ownership state and explicit failed/pending evidence; release owned browser in finally.
- Release blocker: helper is insufficient installed approval evidence by itself.


### F-129 — Major / PARTIAL — JARVIS availability timer attempts to resume a manually stopped task
- Found by: SOURCE REVIEW, second pass2026-10-05; passive UI/status-write cross-check only. No provider/device/task mutation.
- Reproduction/cross-check: Task becomes waiting after Unavailable; press Stop before retry delay expires. Stop does not clear busyUntil/resumeAfterBusy; timer excludes only running/completed and calls resume for stopped task. setBusyUntil synchronously clears busyRef before resume. changeTask has no terminal-status predicate in its write shape. Exact database source follow-up below found no terminal-transition rejection in the named constraint/trigger; no SQL or actual resumed device action executed.
- Expected vs actual: Explicit Stop cancels automatic retry; source retains retry intent and attempts a stopped→running update/continuation.
- Location/root cause: src/jarvis/JarvisWorkspace.tsx:170-178,469-483,585-620,654-666; src/jarvis/task-authority.server.ts:137-151. Retry intent outlives explicit cancellation and uses a negative rather than intended-waiting-state guard.
- User impact: Unexpected continuation after Stop or an unhandled refused retry; real runtime occurrence UNTESTED.
- Recommended fix (not executed): Clear retry intent on stop/global stop/owner change; admit automatic resumption only for matching intended waiting task and controller, with terminal transition checks.
- Release blocker: STOP/automatic continuation reliability requires legitimate lifecycle proof; actual provider/device execution remains BLOCKED.

- F129 database refinement: source status membership constraint20260926090000_ocade_jarvis_web.sql542-543 has no terminal transition rejection; trigger564-572 clears finished_at when returning running. Root inspected exact constraint/trigger, no SQL executed. Stopped-to-running retry remains possible subject to ordinary ownership/device/open-task uniqueness; real action execution untested.


### F-130 — Minor / PARTIAL — Remote task panel retains the previous task screenshot after switching tasks
- Found by: SECOND SOURCE REVIEW2026-10-05; passive state/effect/render cross-check, no screenshot/device execution.
- Reproduction/cross-check: A frame loaded for taskA; switch panel to taskB whose read is delayed/fails. Component retains frame state, effect never clears it and swallows read errors. Workspace renders BrowserPanel without a task key.
- Expected vs actual: TaskB shows its own frame or labelled loading/stale/error; source shows taskA image under current-task supervision until replacement, indefinitely on repeated failure.
- Location/root cause: src/jarvis/JarvisTask.tsx:152-166; src/jarvis/JarvisWorkspace.tsx:1087-1095. Retained state is not associated with task identity and failures have no visible state.
- User impact: Misleading Remote PC supervision and incorrect context for Stop/Take Over; live two-task evidence UNTESTED.
- Recommended fix (not executed): Clear/label frame on task change, associate response with taskID/generation, serialize stale pulls and expose errors.
- Release blocker: Supervision correctness gap; not an independently reproduced physical-control failure.


### F-131 — Minor / PARTIAL — Offline proof reports GPU offload from capability and request alone
- Found by: SECOND SOURCE REVIEW2026-10-05; passive proof assertion cross-check, no model/GPU execution.
- Reproduction/cross-check: An incorrect/empty answer sets failed, yet gpuAdapter=true and gpuRequested>0 still print PASS artifact answered with layers offloaded. No observed offloaded layer count checked. Overall process can exit1 while GPU headline says PASS.
- Expected vs actual: GPU inference verdict requires correct successful answer and observed offload; source uses adapter availability/request only.
- Location/root cause: scripts/prove-offline-artifact.mjs:447-454,476-487,494-508. Requested configuration is substituted for successful GPU execution despite contrary comment.
- User impact: Misleading separate GPU evidence; current actual hardware/model behavior UNTESTED.
- Recommended fix (not executed): Tie verdict to successful correct inference and actual engine offload evidence; keep CPU fallback distinct and honest.
- Release blocker: GPU readiness proof incomplete; no product GPU fault inferred.


### F-132 — Minor / PARTIAL — E2E aggregate promotes unavailable platform checks into all-journeys-passed
- Found by: SECOND SOURCE REVIEW2026-10-05; passive child-status/headline cross-check, no journeys executed.
- Reproduction/cross-check: Office missing Excel/Word emits BLOCKED and exits0; push unavailable service can emit BLOCKED then passed; carry-on missing Python/commands also exits0. Harness counts only nonzero exits and labels all journeys passed.
- Expected vs actual: Aggregate preserves PASS/PARTIAL/BLOCKED coverage with counts; source zero status erases capability gaps in headline even though individual stdout may retain them.
- Location/root cause: scripts/e2e/office-journey.mjs:73-77,345-346,497-500; push-journey.mjs:121-127,308-311; carry-on-journey.mjs:49-51,165-167; harness.mjs:323-332. Failure-only process accounting lacks coverage status.
- User impact: Release evidence can look exhaustive on hosts without required capabilities. Current audit deliberately records unavailable evidence separately.
- Recommended fix (not executed): Return structured coverage status and aggregate unavailable subchecks explicitly; preserve actual failure codes and bounded cleanup.
- Release blocker: Full-scope proof cannot rely on aggregate headline alone.

- F132 extension: JARVIS journey270-275 unavailable device and1310 speech service emit BLOCKED but1396-1399 can still report passed/exit0.


### F-133 — Minor / PARTIAL — Cancelled orb pointer gestures retain stale captured pointer state
- Found by: SECOND SOURCE REVIEW2026-10-05; independently crosschecked handlers; no gesture/browser execution.
- Reproduction/cross-check: Begin pinch then system/browser emits pointercancel or lost capture. Only pointerup removes IDs/reset; next gesture sees stale entries and can pinch against old coordinates or skip intended pan.
- Expected vs actual: Cancelled gesture clears affected pointer/drag/pinch state; source has no cancel/lostcapture completion handler.
- Location/root cause: src/jarvis/Orb.tsx:385-404. Pointer lifecycle handles normal release only.
- User impact: Mobile orb may jump or stop responding until remount; actual cancelled-touch observation UNTESTED.
- Recommended fix (not executed): Share pointer completion for up/cancel/lostcapture and recover remaining finger; verify ordinary pinch and cancellation.
- Release blocker: No individually; mobile gesture evidence incomplete.


### F-134 — Minor / PARTIAL — Blocked carry-on journey bypasses cleanup of its owned runtime and browser
- Found by: SECOND SOURCE REVIEW2026-10-05; support full-file cross-check and root ownership/finally review, no processes spawned.
- Reproduction/cross-check: Helper starts device process and browser, then missing commands branch calls process.exit(0) inside try. Node exits immediately without executing finally kill/close.
- Expected vs actual: BLOCKED path closes owned resources; source can leave child runtime polling and browser open.
- Location/root cause: scripts/e2e/carry-on-journey.mjs:136-143,165-167,567-569. Abrupt exit bypasses structured lifecycle; helper child not registered for exit cleanup.
- User impact: Test artifacts/processes can persist after an unavailable check; distinct from runtime-owned proxy F112. Actual leak measurement UNTESTED.
- Recommended fix (not executed): Propagate structured BLOCKED via return/exception through finally, then close/join owned resources before deciding exit status.
- Release blocker: Test resource hygiene gap, not customer runtime failure.

- F134 cleanup-family extension: jarvis-journey.mjs1089-1099 owns userBrowser inside try; normal1148 kills it, finally1390-1393 omits it. Exception1100-1147 can retain child. No host process started; distinct current-runtime/customer claims not inferred.


### F-135 — Major / PARTIAL — Connection removal clears Wake preference while the Android listener remains active
- Found by: SECOND SOURCE REVIEW2026-10-05; root full-read cross-check, no phone/microphone action.
- Reproduction/cross-check: With Wake running, disconnectPhone or remote removal calls Identity.forget, which clears wake preference. Only AgentService is stopped; WakeService listen continues while !stopping and never checks preference. MainActivity reads false and offers Turn on Wake Mode despite active listener.
- Expected vs actual: Displayed/saved Wake state matches actual microphone lifecycle; source clears saved state without stopping or reconciling the independent listener.
- Location/root cause: android/src/in/ocade/app/Identity.java:87-98; MainActivity.java:290-292,330-340; AgentService.java:157-165; WakeService.java:113-153. Connection cleanup and independent wake-service lifecycle diverge.
- User impact: Misleading microphone state after disconnection/removal; wake audio remains local by source, no exfiltration claimed. Physical occurrence remains BLOCKED/UNTESTED.
- Recommended fix (not executed): Deliberately stop/reconcile Wake on removal, or preserve independent Wake preference if that is intended product policy; verify runtime/UI agreement and resource release.
- Release blocker: Wake state/privacy readiness gap needs legitimate native lifecycle evidence.


### F-136 — Minor / PARTIAL — Android wake teardown does not promptly release its owned recorder
- Found by: SECOND SOURCE REVIEW2026-10-05; root full-read plus official API cross-check, no live audio.
- Reproduction/cross-check: onDestroy sets stopping/statusOff and interrupts worker, but recorder is local to listen and released only in finally. Blocking read is not explicitly stopped; exception path sleeps2000ms before finally. SystemClock.sleep defers interrupts, so teardown during that wait does not expedite release.
- Expected vs actual: Owned microphone is released with bounded teardown acknowledgement; source publishes Off before worker/recorder release and does not join the worker.
- Location/root cause: android/src/in/ocade/app/WakeService.java:65-70,114-150. Recorder ownership inaccessible to teardown, interrupt substituted for actual stop/release.
- User impact: Delayed release can conflict with a rapid re-enable or another microphone user. Exact real-device delay and blocking-read behavior UNTESTED.
- Recommended fix (not executed): Provide bounded owned-recorder stop/release and worker join; use interruptible/cancellable retry delay, preserving platform microphone consent.
- Release blocker: No individually; native audio resource evidence incomplete.

- F136 API evidence: [Android SystemClock.sleep](https://developer.android.com/reference/android/os/SystemClock#sleep(long)) documents deferred interrupt handling; no physical recorder timing inferred.


### F-137 — Minor / PARTIAL — Android wake failure reason is overwritten by ordinary service destruction
- Found by: SECOND SOURCE REVIEW2026-10-05; root full-read lifecycle cross-check, no corrupted model or native launch.
- Reproduction/cross-check: Wake load failure sets unavailable status then stopSelf; onDestroy unconditionally replaces status with Off while saved wake remains true. MainActivity renders Turn off Wake Mode (Off), losing the actionable unavailable reason.
- Expected vs actual: Unavailable reason remains visible and requested/running states are distinguished; source erases failure diagnosis during teardown.
- Location/root cause: android/src/in/ocade/app/WakeService.java:65-69,101-107; MainActivity.java:108-109,290-292. Requested preference, service running state and failure status conflated.
- User impact: User sees contradictory On preference/Off status and cannot identify unavailable wake assets; physical error-state observation UNTESTED.
- Recommended fix (not executed): Retain last failure separately from running state and render explicit unavailable/retry guidance; do not overwrite failed status with generic Off.
- Release blocker: No individually; wake error UI incomplete.


### F-138 — Minor / PARTIAL — JARVIS journey uses a vacuous STOP wait and visual disappearance as cessation proof
- Found by: SECOND SOURCE REVIEW2026-10-05; support full-file and root exact assertion cross-check, no task/action executed.
- Reproduction/cross-check: After Stop, until(locator.count()>=0) always succeeds. Global STOP assertion checks title retained and STOP button absent, not persisted stopped state or owned process termination. Later Take Over branch has separate stronger stopped checks; coverage is uneven.
- Expected vs actual: STOP proof observes actual acknowledged cessation; source can pass without establishing it.
- Location/root cause: scripts/e2e/jarvis-journey.mjs:727-729,774-778,952-955. Vacuous predicate/visual state substituted for task/process outcome.
- User impact: Remote/global STOP evidence may conceal ineffective cancellation; no current task failure inferred from this source test defect.
- Recommended fix (not executed): Assert persisted stopped/acknowledged state and bounded owned-process termination; preserve separate UI evidence.
- Release blocker: STOP release evidence cannot rely on these assertions alone.


### F-139 — Minor / PARTIAL — Voice journey accepts Listening as proof the answer was spoken
- Found by: SECOND SOURCE REVIEW2026-10-05; support full-file and root exact predicate cross-check, no speech/audio execution.
- Reproduction/cross-check: Voice flow already reached Listening; answer-is-spoken assertion later accepts Speaking OR Listening. A TTS path that never delivers an utterance can satisfy the existing state.
- Expected vs actual: Speaking proof observes synthesis invocation/completion or legitimate audio; source accepts unrelated listening state.
- Location/root cause: scripts/e2e/jarvis-journey.mjs:1249,1295-1299. Shared status string replaces speech outcome.
- User impact: False positive voice-output evidence; actual physical audio remains BLOCKED and is not replaced by browser status.
- Recommended fix (not executed): Observe utterance text/invocation and synthesis lifecycle in isolated fixture, retaining physical audio as separate required proof.
- Release blocker: Voice-output readiness remains incomplete.


### F-140 — Minor / FAIL — Local usage fixture diverges on settlement retries, minimum charge and window rollover
- Found by: SECOND SOURCE REVIEW2026-10-05; support full stub/SQL and root settlement-body cross-check only; no SQL or permit probes.
- Reproduction/cross-check: Fixture stores no original window keys, finalize ignores already-settled state and applies reserved difference to current windows; paid charge lacks25 minimum. Source arithmetic: reserved25/cost50 finalized twice accumulates75 instead of50. Release after rollover adjusts new rather than reserved old window.
- Expected vs actual: Fixture mirrors canonical idempotent/original-window/minimum-charge contract; actual fixture semantics differ.
- Location/root cause: scripts/e2e/supabase-stub.mjs:767-775,794-823; supabase/migrations/20260926090000_ocade_jarvis_web.sql:318-350. Settlement state/charged amount/reservation window not retained consistently.
- User impact: Browser usage proofs can pass while retry/minimum/rollover branches differ from deployed SQL. This is a test-fixture defect, not a claimed hosted billing failure.
- Recommended fix (not executed): Mirror canonical settlement status/charged amount/original window keys and pricing, or explicitly exclude those proofs until parity established.
- Release blocker: Fixture-based usage readiness is incomplete for these branches.


### F-141 — Minor / PARTIAL — Offline recovery proof accepts blocked or failed database deletion as storage loss
- Found by: SECOND SOURCE REVIEW2026-10-05; support full-file and root deletion-handler cross-check, no storage mutation.
- Reproduction/cross-check: deleteDatabase onsuccess/onerror/onblocked all resolve identically; subsequent recovery asserts history readable without checking databases vanished. Open connection can block deletion while intact IndexedDB supplies history.
- Expected vs actual: Storage loss is confirmed or marked BLOCKED/PARTIAL; source can report recovery after storage loss without actual clearing.
- Location/root cause: scripts/e2e/offline-journey.mjs:257-266,271-294. Failure/blocked/success outcomes collapsed.
- User impact: Unproven local-storage-loss/recovery branch despite headline PASS; no product recovery failure established.
- Recommended fix (not executed): Capture per-database outcome, close owned connections where legitimate, verify absence and retain BLOCKED/error status.
- Release blocker: Recovery evidence insufficient for actual cleared IndexedDB.


### F-142 — Minor / PARTIAL — Database test adapter suppresses singular-row cardinality errors
- Found by: SECOND SOURCE REVIEW2026-10-05; src reviewer complete adapter and installed SDK contract cross-check; no tests/SQL.
- Reproduction/cross-check: Adapter tracks single/maybeSingle separately but both return rows[0] or null with error:null. Multiple rows and zero-row single are silently accepted rather than canonical cardinality errors.
- Expected vs actual: Test adapter preserves actual singular response contract; source masks cardinality error branches.
- Location/root cause: src/jarvis/__tests__/rest-adapter.ts:68-69,95; installed SDK PostgrestBuilder.ts:519-531 and PostgrestTransformBuilder.ts:689-695. Convenience row selection substitutes for server/SDK result semantics.
- User impact: Database-backed unit proof can miss ordinary duplicate/missing-row error handling; no production cardinality fault demonstrated.
- Recommended fix (not executed): Implement explicit cardinality contract and narrow adapter checks; retain useful existing DB tests and avoid building another general backend simulator.
- Release blocker: Test fidelity gap only.


### F-143 — Minor / FAIL — Preserved browser search helper does not encode literal query characters
- Found by: SECOND SOURCE REVIEW2026-10-05; support full-file source cross-check; preserved donor conditional reuse only, no navigation.
- Reproduction/cross-check: Query C++ & graphs#notes is appended using replace spaces with plus. Literal plus/ampersand/hash become URL syntax rather than original search text in native and async paths.
- Expected vs actual: Entire query is encoded as one literal search parameter; source truncates/reinterprets it.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/browser_control.py:348-352,635-644,667-669,986. Space-only replacement used instead of URL encoding.
- User impact: Incorrect legacy search results if adapted/reused; not current production behavior.
- Recommended fix (not executed): Use standard-library urlencode/quote_plus in a later adapted helper; preserve immutable original.
- Release blocker: No current-runtime blocker; conditional reuse defect.


### F-144 — Minor / FAIL — Preserved browser tool advertises an incognito option it never reads
- Found by: SECOND SOURCE REVIEW2026-10-05; support full-file symbol/control-flow cross-check; conditional reuse only, no browser/profile action.
- Reproduction/cross-check: Schema advertises incognito Boolean, but handler/native/persistent launch never consumes it; normal real/persistent profile is used regardless.
- Expected vs actual: Requested private session is isolated or explicitly refused; source silently ignores requested option.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/browser_control.py:370-441,516-624,926-1053,1118-1120. Unsupported schema flexibility lacks implementation.
- User impact: Legacy helper may retain browsing where user requested private behavior; no current shipped profile claim.
- Recommended fix (not executed): Remove unsupported option from adapted schema or implement/verify actual isolation before advertising; retain original provenance.
- Release blocker: No current-runtime blocker; privacy contract matters before reuse.


### F-145 — Minor / PARTIAL — Background JARVIS ignores failure to persist its question or reply
- Found by: SECOND SOURCE REVIEW2026-10-05; src reviewer complete say/caller cross-check, passive only; no provider/database action.
- Reproduction/cross-check: say awaits message insert but ignores returned error. Asked Which quarter while insert fails; caller marks task waiting and notifies needs answer despite missing question. Finished branch can report finished without conversational reply, though task.result may remain.
- Expected vs actual: Question/reply is durable or storage failure is explicit/retryable; source progresses despite resolved error result.
- Location/root cause: src/jarvis/background.server.ts:344-353,388-389,449-451. Resolved Supabase error is not inspected before status progression.
- User impact: User cannot answer unseen background question; lost explanation/false completion state. Actual background provider remains unavailable F060.
- Recommended fix (not executed): Handle insert error and preserve retryable question/result persistence before reporting waiting/finished outcome.
- Release blocker: Background continuation evidence/correctness incomplete.


### F-146 — Major / PARTIAL — Device result acknowledgements can discard an unpersisted completed outcome
- Found by: SECOND SOURCE REVIEW2026-10-05; src reviewer settlement/client cross-check, no device/SQL execution.
- Reproduction/cross-check: Ordinary completed result faces transient DB update error; server ignores error, fallback also fails and returns unknown acknowledgement in successful exchange. Device clears all results/frame/pending journal on HTTP success without interpreting acknowledgements.
- Expected vs actual: Durable result retained until accepted/stopped/known-final acknowledgement; source can erase sole result while activity remains uncompleted.
- Location/root cause: src/jarvis/device.server.ts:601-615,622-630; jarvis-runtime/ocade_device.py:390-391. DB refusal disguised as unknown and sender uses HTTP-level rather than per-result acknowledgement.
- User impact: Task may expire/fail or repeat work already done; unrelated to intelligence usage settlement F016. Actual transient-service occurrence UNTESTED.
- Recommended fix (not executed): Propagate retryable persistence failure and selectively remove acknowledged results, retaining journal remainder through reconnect.
- Release blocker: Device durable result delivery requires legitimate lifecycle proof.


### F-147 — Major / PARTIAL — Preserved optimize helper replaces a whole file using only its first6000characters
- Found by: SECOND SOURCE REVIEW2026-10-05; support full function/write helper cross-check, conditional donor reuse only; no model/file write.
- Reproduction/cross-check: File longer6000chars sent to model as code[:6000]; returned code written to whole original with no tail preservation/backup/diff/refusal, then Code optimized announced.
- Expected vs actual: Preserve full original semantics or explicitly bounded patch/refusal; source can discard unseen tail.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/code_helper.py:78-84,388-440,413,425-429. Truncated context used as whole-file replacement authority.
- User impact: Legacy source/data loss if adapted; no current production path claimed.
- Recommended fix (not executed): Use bounded reviewed patch/diff or reject oversize with recoverable backup in adapted runtime; keep donor immutable.
- Release blocker: Conditional reuse blocker only.


### F-148 — Minor / FAIL — Preserved focus helper reports success without checking platform focus result
- Found by: SECOND SOURCE REVIEW2026-10-05; support full platform branches cross-check, conditional reuse; no host input/subprocess.
- Reproduction/cross-check: Windows AppActivate false, macOS osascript nonzero or Linux xdotool failure are ignored; helper still reports Focused window if subprocess call itself returned.
- Expected vs actual: Verify requested focus or explicit failure; source equates subprocess invocation with focused destination.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/computer_control.py:258-286,300-305. Boolean/exit status/output ignored.
- User impact: Later legacy typing may target prior window; physical/current shipped effect unproved.
- Recommended fix (not executed): Interpret platform outcome and verify actual focused window before success in adapted code; preserve original.
- Release blocker: Conditional reuse reliability defect only.


### F-149 — Minor / FAIL — Preserved user-data action invents missing personal fields
- Found by: SECOND SOURCE REVIEW2026-10-05; support profile/fallback/schema full cross-check, conditional reuse; no memory/form action.
- Reproduction/cross-check: Missing profile returns empty map; user_data substitutes random email/name when requested field absent, returning bare value without missing/random marker. Separate random_data helper is reused implicitly.
- Expected vs actual: Missing real user information is requested/refused; source returns fabricated field as if user data.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/computer_control.py:96-109,146-155,500-507,571-573. Fixture fabrication leaks into real-field contract.
- User impact: Incorrect identity/contact details may enter legacy forms if reused; no current account mutation claimed.
- Recommended fix (not executed): Explicit missing-field result; retain random values only for separate deliberate fixture action in adapted code.
- Release blocker: Conditional reuse correctness/privacy defect only.


### F-150 — Minor / FAIL — Preserved Windows volume fallback reports a change while only toggling mute twice
- Found by: SECOND SOURCE REVIEW2026-10-05; support setter/handler full cross-check, conditional reuse; no audio/COM/input.
- Reproduction/cross-check: pycaw failure triggers two volumemute presses without setting scalar; handler reports requested percentage and records success if keypress does not throw. Two toggles leave original level unchanged.
- Expected vs actual: Requested volume set/verified or unavailable reported; source reports unchanged level as changed.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/computer_settings.py:162-179,831-839. Unrelated input sequence substitutes for failed setter; macOS/Linux returncodes also ignored181-186.
- User impact: False legacy setting/undo evidence, current physical audio UNTESTED.
- Recommended fix (not executed): Use verified supported setter or honest error in adapted runtime; keep original.
- Release blocker: Conditional reuse only.


### F-151 — Major / PARTIAL — Leaving JARVIS can retain a foreground controller awaiting an invisible decision
- Found by: SECOND SOURCE REVIEW2026-10-05; src reviewer complete effects/drive-finally cross-check, no task/browser/device execution.
- Reproduction/cross-check: Navigate away while confirmation or Take Over/Pause promise pending. Owner effect aborts only on next setup, cleanup only sets transcript current=false; unmount does not abort current controller or settle hooks. ownerRef remains unchanged and heartbeat persists until drive resolves.
- Expected vs actual: Unmount abandons foreground ownership and follows explicit wait/background handoff policy; source can retain unresolved decision/heartbeat after UI disappears.
- Location/root cause: src/jarvis/JarvisWorkspace.tsx:240-284,402,432-439; src/jarvis/agent.ts:352,407,572-580. Component-owned task/promise lifecycle lacks unmount cleanup.
- User impact: Orphan active heartbeat can prevent timeout/background takeover while user cannot answer; actual provider/device occurrence UNTESTED.
- Recommended fix (not executed): Dedicated mounted/generation lifecycle abort, settle decision gates and release/hand off controller according to background mode; verify ordinary route change during waits.
- Release blocker: Foreground/background lifecycle requires correction and legitimate proof.


### F-152 — Major / PARTIAL — macOS lock actions request display sleep rather than verified session lock
- Found by: SECOND SOURCE REVIEW2026-10-05; support lock/sleep/action-map cross-check, conditional reuse; no Apple command/settings.
- Reproduction/cross-check: Darwin lock_screen calls pmset displaysleepnow, same command as sleep_display. Authentication lock depends on user platform settings rather than established lock outcome.
- Expected vs actual: Requested lock uses supported lock and verifies/honestly reports result; source only sleeps display.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/computer_settings.py:460-473,505-506,647. Different advertised contracts share unrelated display-sleep implementation.
- User impact: Legacy user may believe session locked when it is merely asleep; actual Apple evidence BLOCKED, no current shipped lock fault asserted.
- Recommended fix (not executed): Supported verified lock path or explicit unavailable result in adapted code; preserve original.
- Release blocker: Conditional reuse blocker only.

- F152 current-runtime source corroboration: ocade_computer.py:870-890 also maps Darwin lock to pmset displaysleepnow, then says Asked the computer to lock. This is active companion source, but Mac package/hardware is unbuilt/BLOCKED and no actual lock command performed. Same display-sleep/lock contract family; authentication lock is not established by source command alone. Conditional donor evidence and current unbuilt Mac branch kept distinct.


### F-153 — Minor / FAIL — Preserved mute undo restores level but never restores original mute state
- Found by: SECOND SOURCE REVIEW2026-10-05; support setter/getter/undo contract cross-check, conditional reuse; no audio/settings.
- Reproduction/cross-check: Mute action captures only old scalar; undo invokes volume_set(old), which does not restore mute flag. Successful mute from unmuted state can remain muted after claimed undo.
- Expected vs actual: Undo restores both original mute and level; source restores scalar only.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/computer_settings.py:87,93-119,162-187,598-600,883-899. Incomplete before-state snapshot and wrong inverse action.
- User impact: False legacy undo success and ongoing silence; actual physical result UNTESTED.
- Recommended fix (not executed): Capture/restore mute independently, distinguish mute/unmute/toggle and verify exact prior state in adapted code; keep original.
- Release blocker: Conditional reuse only.


### F-154 — Minor / PARTIAL — Preserved wallpaper download deletes the asset retained by desktop preferences
- Found by: SECOND SOURCE REVIEW2026-10-05; support full relevant branches and root numbered cross-check. Conditional donor reuse only; no download, OS setting or Apple command executed.
- Reproduction/cross-check: set_wallpaper_from_url downloads a temporary file, passes it to set_wallpaper, then unlinks it. macOS stores its POSIX path; GNOME/KDE/Xfce store its file URI/path. These branches do not copy it to persistent owned storage before deletion.
- Expected vs actual: a successful wallpaper choice remains available after desktop reload/login; source removes the referenced asset immediately. Actual platform reload behavior remains UNTESTED/BLOCKED.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/desktop.py:177-182,187-221,240-251 (set_wallpaper, set_wallpaper_from_url). Temporary-download cleanup outlives an assumed, unverified platform copy.
- User impact: wallpaper may disappear/revert after desktop reload if this donor capability is adapted; no current production integration or physical occurrence claimed.
- Recommended fix (not executed): retain a durable owned wallpaper asset with explicit replacement/cleanup lifecycle in any adapted implementation; verify platform reload/login. Preserve the immutable donor original.
- Release blocker: conditional reuse reliability gap only.


### F-155 — Minor / PARTIAL — Computer provider declaration omits supported actions' required arguments
- Found by: SECOND SOURCE REVIEW2026-10-05; src reviewer and root canonical/schema/forwarding source cross-check only. No provider, file or device action executed.
- Reproduction/cross-check: canonical file_import requires from; recipe_save requires app, route, steps and verify (optional recovery); doc_edit/sheet_edit support overwrite. The computer provider inputSchema declares none of these properties, although its description advertises imports/recipes. Edge handler forwards it unchanged. The name/to descriptions also omit app_info and external import/export semantics.
- Expected vs actual: declared tool properties cover supported required inputs and deliberate copy/overwrite choice; actual declaration leaves these inputs undescribed and outside its declared property set. Models may guess extra properties, so this does not establish universal provider refusal.
- Location/root cause: src/jarvis/protocol.ts:267-276,286,320,332,762-813; src/lib/intelligence/edge-handler.ts:324-331. Manually duplicated canonical action contracts and provider argument declarations drift.
- User impact: recipe learning/file import or requested in-place Office edits may be unavailable, retried or incorrectly inferred; provider end-to-end effect remains UNTESTED.
- Recommended fix (not executed): align provider properties/descriptions with the existing canonical action schemas and verify supported action contracts; retain explicit overwrite intent.
- Release blocker: these advertised capabilities need legitimate provider/device evidence; no whole-product provider failure inferred.


### F-156 — Minor / PARTIAL — Release builder replaces the shared update feed with only the current platform
- Found by: SECOND SOURCE REVIEW2026-10-05; root full packaging/updater read and public feed source cross-check only; no builds, publishing or update execution.
- Reproduction/cross-check: Each release.py invocation builds platforms/installers with only platform_key(), writes fixed manifest.json/.sig and uploads them to the same agent prefix. Publishing a second architecture/OS therefore replaces, rather than merges, previously offered builds. Updater check/install require the current platform entry; UI reads only windows-x64 installer.
- Expected vs actual: A shared release version retains all deliberately supported published platform builds; source last platform publication removes other entries. No current hosted multi-platform release was inspected or claimed broken.
- Location/root cause: jarvis-runtime/packaging/release.py:102-108,131-146; jarvis-runtime/ocade_update.py:132-134,236-240; src/lib/agent/release.ts:51-56. Per-platform build output is also used as whole shared release authority.
- User impact: A future legitimate macOS/Linux/arm64 publish can make existing Windows builds unavailable to the feed/UI, and vice versa; current Apple distribution is explicitly unbuilt/BLOCKED.
- Recommended fix (not executed): Collect verified per-platform artifacts under one release manifest owner, sign the complete declared release, then publish it once; verify every retained platform entry without introducing parallel feeds.
- Release blocker: Multi-platform release publication requires evidence before offering those builds.


### F-157 — Minor / PARTIAL — Update publication exposes a temporarily mismatched manifest and signature
- Found by: SECOND SOURCE REVIEW2026-10-05; root full release/updater and route/cache cross-check only. No signature bypass, tampering, publishing or network failure reproduction.
- Reproduction/cross-check: upload orders versioned files first, then manifest.json, then manifest.json.sig as separate object puts. check fetches those two mutable objects separately. A normal check between the final puts, or across publication, can pair the new manifest with old signature; Schedule records error and defers its next check one hour.
- Expected vs actual: Ordinary release publication supplies one coherent signed release snapshot; actual source has a transient fail-closed mismatch window. Verification correctly refuses mismatched bytes; this is a reliability observation, not a verification flaw.
- Location/root cause: jarvis-runtime/packaging/release.py:102-108; jarvis-runtime/ocade_update.py:222-224,267-274,50; src/routes/agent.$file.ts:35-42; src/lib/agent/release.ts:25-31. Independently mutable feed objects lack a snapshot/version boundary.
- User impact: Some otherwise healthy agents can report an update error and wait an hour after publication; actual production incidence/duration UNTESTED.
- Recommended fix (not executed): Publish an immutable coherent signed-release object/snapshot with one final pointer, or narrowly retry coherent snapshot reads during ordinary publication while retaining all verification requirements.
- Release blocker: No individual readiness claim; signed installed update/publish evidence remains BLOCKED/UNTESTED.


### F-158 — Minor / FAIL — Preserved project runner splits quoted arguments into different argv entries
- Found by: SECOND SOURCE REVIEW2026-10-05; support full source and root exact parser/caller cross-check. Conditional donor reuse only; no command or provider executed.
- Reproduction/cross-check: Planner supplies run_command string. _run_project uses str.split then subprocess.run(list); an ordinary --title "hello world" becomes two arguments containing literal quote characters, and quoted paths with spaces split similarly.
- Expected vs actual: Keep intended argv boundaries; source whitespace splitting changes argument values and can fail valid ordinary launches.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/dev_agent.py:298-310,473-475. Shell-like command string is treated as whitespace-separated structured argv.
- User impact: Adapted donor can fail generated project runs or pass wrong input; no current production integration or host execution claimed.
- Recommended fix (not executed): Use structured argv in the narrow planner contract, or an explicitly supported platform-aware parser; preserve immutable donor original.
- Release blocker: Conditional reuse reliability gap only.


### F-159 — Major / PARTIAL — Scheduled work consumes its schedule before persisting the durable instruction/outcome
- Found by: SECOND SOURCE REVIEW2026-10-05; src reviewer full scheduled source and root exact scheduled/background contract cross-check only. No task, database, notification or provider executed.
- Reproduction/cross-check: Tick advances next_at/deactivates a one-off before remind/startScheduledWork. say ignores insert error. Reminder still returns Reminded; scheduled work can create plan:[] task after full user instruction failed to persist, retaining only what.slice(0,200) as title from a request allowing500. Background reconstructs transcript plus title, not original schedule. Task insert errors all report device busy.
- Expected vs actual: A consumed schedule has a durable deliverable/instruction or explicit retryable failure; source can irreversibly consume one-off work and report success or start from incomplete instructions. Notifications may independently deliver a truncated reminder, so total delivery loss is not established.
- Location/root cause: src/jarvis/schedules.server.ts:60-79,98-111,143-159; src/jarvis/background.server.ts:185-201,254-264; src/jarvis/protocol.ts schedule what schema. Claim advancement and durable message/task outcome are not reconciled; insert results ignored/misclassified.
- User impact: One-off reminders/tasks may be lost or executed without important trailing instructions during storage failure; no live occurrence demonstrated. Extends the persistence family F145 with the separate schedule-consumption hazard.
- Recommended fix (not executed): Check message/task results, retain a durable full instruction and retryable outcome with idempotent claim/finalization semantics; distinguish uniqueness/busy from storage errors. Verify ordinary write-outage recovery in an isolated fixture.
- Release blocker: Scheduled/background correctness needs reliable durable instruction/outcome evidence.


### F-160 — Minor / PARTIAL — Desktop wake tray claims Listening from availability without recorder liveness
- Found by: SECOND SOURCE REVIEW2026-10-05; root full agent/wake loop source cross-check only. No microphone, permissions, device unplug or audio action executed.
- Reproduction/cross-check: agent sets WAKE ready from manifest/dependency availability and launches an untracked listening thread. _wake_words renders Listening whenever ready+background. listen catches InputStream startup/retry errors without reporting them to WAKE; consumer failures also have no supervisor acknowledgement.
- Expected vs actual: Listening reflects an active working recorder/consumer; actual tray can keep Listening while microphone permission/device initialization is failing or the consumer has exited. F001 currently prevents baseline ready on this checkout, so this is a conditional reachable branch after a valid bundle, not observed physical listening.
- Location/root cause: jarvis-runtime/ocade_agent.py:550-577; jarvis-runtime/ocade_wake.py:155-166,218-259. Asset availability, requested mode and actual recorder/worker state are conflated.
- User impact: user can expect wake response from an inactive microphone and lacks actionable retry/permission diagnosis; exact Windows/macOS physical behavior UNTESTED/BLOCKED.
- Recommended fix (not executed): report recorder/consumer startup, retry and exit state through the existing wake authority; supervise owned threads and distinguish requested/ready/listening/unavailable states.
- Release blocker: wake UI/runtime agreement requires legitimate audio evidence.


### F-161 — Minor / PARTIAL — Preserved desktop organizer loses partial-move undo on a later failure
- Found by: SECOND SOURCE REVIEW2026-10-05; support full source and root exact organizer/duplicate branch cross-check. Conditional donor reuse only; no file moved/deleted.
- Reproduction/cross-check: organize_desktop records each successful move locally but registers push_undo only after the entire loop. A later permission/name/path failure reaches outer except and returns error before registration; earlier moves remain without the advertised one-command undo.
- Expected vs actual: completed partial moves retain a recoverable journal or are rolled back; source discards journal ownership on the error path.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/file_controller.py:541-621,581,584-587,608,620-621. Whole-operation success controls undo registration rather than each completed mutation.
- User impact: adapted organizer can leave a partially changed desktop without its promised recovery; ordinary actual filesystem occurrence UNTESTED. Separate from F087 unsafe inverse behavior.
- Recommended fix (not executed): retain/register partial results before further work or reconcile them on failure, and return truthful partial outcome in any adapted implementation; preserve original.
- Release blocker: conditional reuse recovery gap only.


### F-162 — Minor / FAIL — Preserved PDF extraction and Word conversion silently discard text beyond50000characters
- Found by: SECOND SOURCE REVIEW2026-10-05; support full relevant branches and root numbered cross-check. Conditional donor reuse only; no PDF, provider or output mutation executed.
- Reproduction/cross-check: _extract_pdf_text joins pages then returns text[:50000]. extract_text writes that prefix and announces Text extracted; to_word uses the same prefix and announces conversion. No full extraction mode or truncation status in these branches.
- Expected vs actual: Full extraction/conversion or explicitly limited output/refusal; source presents a truncated document as completed output.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/file_processor.py:183-199,206-209,238-251. Model-context-style bound reused as whole-document output authority.
- User impact: Adapted donor can omit later pages/content without notice; no current product integration or actual PDF loss asserted.
- Recommended fix (not executed): Stream full extraction within explicit resource bounds or return a truthful truncation result and safe alternative in any adapted implementation; preserve original.
- Release blocker: Conditional donor conversion completeness gap only.

- F162 second-pass family extension: immutable donor file_processor.py:485-490 feeds only content[:30000] to fix/optimize/document and508-513 saves a whole-extension sibling without truncation status. Original survives (unlike F147), but derived output can omit unseen tail. Text reformat/fix295-296 similarly uses40000-character prefix then311-314 claims full result. Root exact source cross-check; no provider/file operation. Explicit bounded partial status/refusal or preserved full transformation contract recommended.


### F-163 — Minor / FAIL — Desktop boolean settings turn failed OS reads and writes into verified-off success
- Found by: SECOND SOURCE REVIEW plus isolated AST-selected existing-function TEST2026-10-05; every subprocess call doubled. No host setting, Apple/Linux command, registry or audio mutation.
- Reproduction/cross-check: _out ignores returncode and returns empty stdout on the simulated unavailable OS tool. _read_mute/_read_dark interpret empty output as false; setting(name,false) repeats failed setter/read and returns done with before=false/value=false. All four Linux/Darwin mute/dark-mode cases reproduce this outcome;16 simulated calls, no real subprocess.
- Expected vs actual: Unavailable/error result when the OS cannot report/change the setting; actual reports off and successful verified change from off to off.
- Location/root cause: jarvis-runtime/ocade_settings.py:33-34,58-63,80-88,138-142,154-171. Boolean comparison conflates failed/unparseable reads with a legitimate false value; _out drops OS exit/error outcome.
- User impact: JARVIS can falsely report or confirm mute/appearance changes on unavailable/failing platform tools. Physical Mac/Linux evidence remains BLOCKED/UNTESTED; fixture proves function logic only. Distinct from preserved donor F150/F153.
- Recommended fix (not executed): Require successful supported command result and explicit boolean parsing before readback verification; preserve unavailable state and actual before/after contract.
- Release blocker: Boolean setting evidence needs actual platform verification. Disposable evidence work/ordinary-settings-crosscheck.json.


### F-164 — Major / PARTIAL — Account export pages rows without stable order or a concurrent-write consistency boundary
- Found by: SECOND SOURCE REVIEW2026-10-05; src full read and root exact paging/client/claim cross-check only. No account export, database request or customer activity executed.
- Reproduction/cross-check: readTable/readCascadedTable repeatedly select('*').eq(...).range(offset,offset+499) with no order or snapshot. For over500 rows, ordinary insertion/deletion between pages can shift offsets and repeat/omit records; unordered independent plans also provide no stable traversal guarantee. Existing immutable Array.slice fake does not exercise changing page boundaries.
- Expected vs actual: Export has a documented consistent/stable complete traversal or explicit partial caveat; source marks partial only when reads fail and states every table was read in full after successful unordered page requests.
- Location/root cause: src/lib/account/data-rights.ts:105-114,118-136,147-171,218-220,244; src/lib/account/__tests__/data-rights.test.ts:34-49. Offset traversal lacks deterministic unique ordering/snapshot or cursor boundary; success conflated with complete set.
- User impact: A large active account's downloaded copy can duplicate/omit retained records without partial warning. Separate from F026 missing export classes and F090 bounded Library browsing. Actual database concurrency effect UNTESTED.
- Recommended fix (not executed): Use deterministic unique-key traversal and explicit snapshot/concurrent-write semantics; verify ordinary page-boundary changes in an isolated account fixture before completeness claim.
- Release blocker: Complete large-account export evidence requires this consistency contract.

- Boundary extension2026-10-05 (Minor/PARTIAL subcase): src/lib/supabase/read-all.ts:27,33,53-65 accepts only a short page, so exactly100000 rows fill all200 pages and throw the inaccurate larger-than100000 error without an end probe. Define inclusive/exclusive cap honestly or allow one bounded end probe; preserve bounded resource ownership. Arithmetic/control-flow cross-check only, no database/export execution and no new count. Its settled-history comment45-47 also needs the existing concurrent-write caveat.


### F-165 — Major / PARTIAL — Office job runners wait for child exit before draining bounded output pipes
- Found by: SECOND SOURCE REVIEW plus owned ordinary pipe TEST2026-10-05; root full Word/Excel Python and PowerShell source cross-check. No Office process, document, workbook or host action executed.
- Reproduction/cross-check: Both wrappers capture stdout/stderr pipes, poll until exit, then read stdout. Word result can contain20000text characters plus headings; Excel can return10ranges of50x20cells with unbounded cell strings. Child JSON write can fill the pipe and wait for parent drainage, while parent waits for exit until180-second timeout. Owned Python child writing20000bytes remained running before drainage and exited0 after communicate drained it; generic plumbing evidence, not an Office reproduction.
- Expected vs actual: Read output while child runs and retain bounded cancellation/result completion; source cyclic waiting can timeout after edits are already saved.
- Location/root cause: jarvis-runtime/ocade_documents.py:169-180; jarvis-runtime/ocade_sheets.py:234-246; actions/ocade_word.ps1:19-28,100-114; actions/ocade_excel.ps1:27-41,159-180. Undrained stdout/stderr with exit polling instead of coordinated I/O completion.
- User impact: Ordinary larger Office results may hang and report failed/timed-out despite saved changes; native incidence remains UNTESTED. Disposable evidence work/ordinary-pipe-crosscheck.json, owned child exited and pipes drained.
- Recommended fix (not executed): Drain both pipes while waiting with a bounded supported subprocess communication/cancellation strategy; wait/reap killed child and retain truthful saved/partial outcome.
- Release blocker: Office success/cancellation fidelity needs legitimate real Windows Office verification.

- F165 outcome extension: Computer._sheet ocade_computer.py:588-590 reports The workbook was not changed for an unsuccessful job. Excel may already have saved before result-pipe completion or applied partial edits in an existing open workbook. This blanket unchanged claim is not established by the process error. Root exact source/script cross-check, no Office mutation.

- F165 document outcome extension: Computer._doc ocade_computer.py:624-626 similarly claims The document was not changed on unsuccessful job, without proving unchanged state. Actual PowerShell Save occurs before result output and existing-open document partial changes are not rolled back. Root full source cross-check only. Existing Computer._run:773-781 supplies a minimal communication pattern for D044, but F008 output retention still requires bounds.


### F-166 — Minor / PARTIAL — Excel same-name fallback leaves the user's first instance alerts disabled
- Found by: SECOND SOURCE REVIEW2026-10-05; root complete Excel script branch cross-check only; no COM/Excel mutation.
- Reproduction/cross-check: Script attaches existing Excel, snapshots DisplayAlerts then sets false. If target workbook has the same basename as a different open file, it overwrites $excel with a new instance and replaces $alerts. Success/failure cleanup restores only the new reference; first user's Excel retains false.
- Expected vs actual: Restore every changed user-owned app setting after using an isolated same-name instance; actual original reference/alert snapshot is lost.
- Location/root cause: jarvis-runtime/actions/ocade_excel.ps1:46-60,175-185. Reference reassignment discards ownership of already changed DisplayAlerts state.
- User impact: User's existing Excel may suppress later normal warnings/prompts after this branch; actual installed instance behavior UNTESTED.
- Recommended fix (not executed): Restore the first instance state before switching or retain per-instance owned state for finally cleanup; verify same-name workbooks in separate directories and failure paths.
- Release blocker: No individually; Office user-state preservation evidence incomplete.


### F-167 — Minor / FAIL — Preserved media processor reports FFmpeg conversion success after nonzero exit
- Found by: SECOND SOURCE REVIEW2026-10-05; support complete file and root exact process/status branches cross-check. Conditional donor reuse only; no FFmpeg or output write executed.
- Reproduction/cross-check: Audio extraction, trim, frame and conversion invoke subprocess.run without check/returncode inspection or produced-file verification, then return Saved/extracted/converted. Unavailable probe also treats a launched but nonzero ffmpeg -version as available.
- Expected vs actual: Failed encoder/input returns failure and only verified newly produced output earns success; source reports nonexistent/incomplete output after ordinary nonzero tool failure.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/file_processor.py:593-598,626-630,641-646,656-661,708-712. Process invocation conflated with successful media outcome.
- User impact: Adapted media workflow can claim a file exists when conversion failed; no shipped media integration or current host failure claimed.
- Recommended fix (not executed): Check return status, preserve bounded diagnostic stderr and verify newly produced output before success in adapted implementation; preserve immutable original.
- Release blocker: Conditional donor media reliability gap only.


### F-168 — Minor / PARTIAL — Owner access badge selects a different grant window than the canonical entitlement resolver
- Found by: SECOND SOURCE REVIEW2026-10-05; src reviewer full file and root exact UI/selection/latest-contract cross-check only. No grant, revoke, SQL or account mutation executed.
- Reproduction/cross-check: listAccountAccess filters revoked/expired rows but not starts_at and has no deterministic expiry order. Its map keeps first Max or last Pro. Canonical resolver excludes future starts and chooses strongest tier then longest ends_at; grant RPC inserts without replacing prior records. Two active Max rows returned shorter then longer display shorter date/reason/ID, and UI revokes that selected record.
- Expected vs actual: Displayed effective window/record agrees with canonical active selection; actual manually repeated selection differs. Future-dated retained rows also appear live in the UI although excluded by resolver.
- Location/root cause: src/lib/admin/access.functions.ts:174-203; src/routes/_authenticated/admin.tsx:301-307,784-796; supabase/migrations/20260911090000_one_entitlement_authority_and_admin_grants.sql:148-160;20260930093000_one_staff_authority.sql:722-725. Time/tie rules omitted from duplicated UI selection.
- User impact: Owner sees misleading effective expiry/reason and a different revoke target from effective access; ordinary multi-grant UI/provider occurrence UNTESTED, no authorization flaw claimed.
- Recommended fix (not executed): Use canonical current/time/tie selection with deterministic grant identity and transparent remaining-grant behavior; verify ordinary multiple-current/future-window fixtures.
- Release blocker: No individually; Owner access management accuracy needs proof.


### F-169 — Minor / FAIL — Preserved Office text extractor saves a missing-dependency diagnostic as document content
- Second-pass donor generation extension2026-10-05: actions/youtube_video.py:191-193 returns unavailable-provider text or an empty string as a successful summary value; caller:338-347 speaks/saves it and reports Summary complete and saved. Expected generation failure/empty output remains unconfirmed without a completed-summary claim. Root/support exact source cross-check only; no provider, UI or file action. Propagate structured failure and validate nonempty content in future adaptation; preserve original.
- Found by: SECOND SOURCE REVIEW2026-10-05; support full processor and root exact text/error consumer cross-check. Conditional donor reuse only; no install, document read, provider or output write executed.
- Reproduction/cross-check: _process_text_doc's nested _read_content returns python-docx not installed or Read failed diagnostic as string; the caller treats nonempty text as extracted content and writes success. _read_pptx_text returns analogous python-pptx diagnostic, also saved by extraction branch. Analysis branches can send this diagnostic as if document text.
- Expected vs actual: Missing extractor dependency produces failure or explicit unavailable result; actual successful extracted output can contain only tool diagnostic.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/file_processor.py:267-288,765-773. Helpers share ordinary text and failure messages in one string return contract.
- User impact: Adapted donor can produce misleading document copy/summary when optional library is absent; no current integration or actual file failure claimed.
- Recommended fix (not executed): Separate errors from extracted text with a narrow exception/result contract and stop transformation on unavailable extractor; preserve immutable donor original.
- Release blocker: Conditional donor extraction reliability gap only.


### F-170 — Minor / FAIL — Preserved flight date normalization accepts invalid dates or substitutes today
- Found by: SECOND SOURCE REVIEW2026-10-05; support whole file and root exact parser/search caller cross-check. Conditional donor reuse only; no provider, navigation or flight search executed.
- Reproduction/cross-check: _parse_date accepts an ISO-looking prefix without full-string/calendar validation, returning an invalid month/day with trailing text unchanged. An unparseable nonempty date with unavailable provider falls back to today. flight_finder passes that result directly to search; relative-key substring and month fallback are also permissive.
- Expected vs actual: Invalid/ambiguous intended date asks for correction or explicit unavailable result; source silently changes/accepts invalid itinerary dates.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/flight_finder.py:40-85,316-317,332-334. Pattern/prefix normalization and fallback are treated as validated date authority.
- User impact: Adapted donor can search wrong dates or malformed itineraries; separate from fixed historical itinerary F059, no current production travel workflow claimed.
- Recommended fix (not executed): Validate complete calendar date and fail clearly for unresolved intent in any adapted implementation; preserve immutable source.
- Release blocker: Conditional donor date correctness gap only.


### F-171 — Minor / PARTIAL — Owner system counter includes expired device connections as waiting
- Found by: SECOND SOURCE REVIEW2026-10-05; src complete function and root exact count/expiry source cross-check only. No enrollment, database request or device mutation.
- Reproduction/cross-check: System pendingEnrollments counts every jarvis_devices row with user_id null, without enrollment_expires_at>now. A normal request expires and no later enrollment triggers source cleanup, so retained row still counts as Computers waiting to connect even though approval/auth source regards it expired.
- Expected vs actual: Waiting metric counts current approvable requests or distinguishes expired backlog; actual stale rows increase active waiting label.
- Location/root cause: src/lib/admin/staff.functions.ts:747-751; src/components/admin/ConsoleModules.tsx:844; src/jarvis/device.server.ts:287-292,363-365; src/jarvis/jarvis.functions.ts:615. Lifecycle cleanup depends on a later enrollment, while metric omits expiry condition.
- User impact: Owner/staff operational page may suggest unresolved connections that cannot be approved; actual timed-out fixture/UI count UNTESTED.
- Recommended fix (not executed): Filter active expiry in waiting metric and expose expired backlog only with explicit meaning if useful; verify ordinary expiration/no-next-request fixture.
- Release blocker: No individually; operational counter accuracy gap.


### F-172 — Major / PARTIAL — Preserved download watcher interprets missing activity as successful completion before shutdown
- Found by: SECOND SOURCE REVIEW2026-10-05; support entire source and root exact snapshot/caller cross-check. Conditional donor reuse only; no Steam, scheduler, provider or shutdown executed.
- Reproduction/cross-check: Watcher first observes a state1026 game, then calls shutdown when no later snapshot has that state. Manifest reader swallows read/parse failures into absent entries. Temporary unreadable/missing or non-running/paused/error state can therefore satisfy completion without confirming requested game's installed/up-to-date state.
- Expected vs actual: Shutdown only follows explicitly verified successful requested work with cancellation; source absence-of-running state substitutes for completion.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/game_updater.py:150-170,642-665,1005-1010,1025-1030. Unverified observations and missing/error states collapsed into destructive follow-up success.
- User impact: Adapted donor may shut down PC while intended work is incomplete and other user work is active; actual platform state transitions UNTESTED, no current runtime integration claimed.
- Recommended fix (not executed): Track requested IDs and explicit stable successful completion, retain unreadable/paused/failure outcomes, and provide cancellation before any requested shutdown in adapted code; preserve immutable donor.
- Release blocker: Conditional reuse blocker for automatic shutdown reliability.


### F-173 — Minor / PARTIAL — Appearance account sync ignores saved dark mode and retains a touched flag across sessions
- Found by: SECOND SOURCE REVIEW2026-10-05; src whole source and root exact load/session/persist cross-check only. No account/cloud request or UI preference mutation.
- Reproduction/cross-check: With local light and untouched provider, successful account settings theme=dark falls back to current light; only explicit remote light is accepted. Both valid modes are offered/persisted. After any local control change, touchedRef remains true across subsequent sign-out/sign-in because auth handler resets only loadedFor, suppressing later account loads.
- Expected vs actual: Both valid account themes apply after first paint unless overridden by a newer change in that session; actual sync is one-way and change fence can outlive the session it protects.
- Location/root cause: src/lib/appearance.tsx:105-106,133-153,162-165,214-219; src/components/settings/settings-panel.tsx:340-345. Missing explicit dark branch and local-change generation/session lifecycle not reconciled.
- User impact: Saved cross-device preferences can be ignored in the current browser; actual UI/cloud timing remains UNTESTED. No account-isolation breach claimed.
- Recommended fix (not executed): Accept both supported modes and scope stale-read/local-change fencing to the current session/generation while preserving first-paint local behavior.
- Release blocker: No individually; account preference fidelity gap.


### F-174 — Minor / FAIL — Spreadsheet diagnostic treats a quoted cell name as an actual self-reference
- Found by: SECOND SOURCE REVIEW plus pure existing-function TEST2026-10-05; no workbook, Office, file or host mutation.
- Reproduction/cross-check: problems for B1 formula =IF(A1="B1",1,0) reports B1 refers to itself, although B1 occurs only as string literal. Control =A1+1 has no problem; genuine =B1+1 still reports self-reference. Computer._sheet forwards result in Check/problemlist.
- Expected vs actual: Only actual formula references cause circular-reference warning; regex scans literal text and produces a false diagnostic.
- Location/root cause: jarvis-runtime/ocade_sheets.py:130-149; jarvis-runtime/ocade_computer.py:593-599. Reference pattern runs over full formula without excluding quoted string literals, unlike existing _formula_ok quote handling48-50.
- User impact: JARVIS can misleadingly warn about a valid workbook and attempt unnecessary correction. Test proves parser logic only, real Excel formula calculation UNTESTED. Evidence work/ordinary-sheet-diagnostic.json.
- Recommended fix (not executed): Exclude properly quoted literal spans before reference diagnostics or use the smallest already-supported formula token handling; retain real self/error checks.
- Release blocker: No individually; spreadsheet diagnostic fidelity gap.


### F-175 — Minor / PARTIAL — Preserved scheduled game entrypoint lacks donor package context and Linux path quoting
- Found by: SECOND SOURCE REVIEW2026-10-05; support full source and root exact scheduled commands/import cross-check only. Conditional donor reuse; no scheduler, interpreter entrypoint, game or host command executed.
- Reproduction/cross-check: Scheduled commands invoke actions/game_updater.py as an absolute source script, which immediately imports sibling config with no sys.path/package root setup. A clean ordinary Python script environment starts module search in actions, not donor root; ambient PYTHONPATH/install may mask it. Linux cron also concatenates unquoted interpreter/script paths although tracked donor directory contains spaces.
- Expected vs actual: Scheduled source invocation reaches its intended handler with preserved argv/package context; source can fail import or split script path before --scheduled handler.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/game_updater.py:12,818-819,837-840,864,1055-1059; sibling config/__init__.py. Direct script execution and package import assumptions differ; Linux string command lacks quoting.
- User impact: Adapted scheduled updates can never begin after apparently successful scheduling; platform scheduled execution UNTESTED/BLOCKED, no current shipped scheduler claimed.
- Recommended fix (not executed): Use explicit supported module/root context and platform-safe argument construction in adapted scheduler; verify clean environment and paths with spaces. Preserve original.
- Release blocker: Conditional donor scheduled launch gap only.


### F-176 — Minor / PARTIAL — OAuth unavailable-provider copy claims the team was notified without an acknowledged report path
- Found by: SECOND SOURCE REVIEW2026-10-05; src full error/caller read and root exact translator/state cross-check only. No OAuth, provider, alert or external message executed.
- Reproduction/cross-check: Unsupported/not-enabled provider error translator adds Our team has been notified. Login/callback callers only place translated message/hint in local UI state; inbound-error callback exits before its exchange effect. This source path has no operational report dispatch or acknowledgement.
- Expected vs actual: Error copy promises only confirmed actions, or provides truthful recovery/support route; source asserts completed team notification without its own evidence. Independent external monitoring is unavailable and not claimed absent globally.
- Location/root cause: src/lib/auth/oauth-errors.ts:62-68; src/routes/auth.index.tsx:163-175; src/routes/auth.callback.tsx:36-54. Pure message translation includes an operational success claim that callers do not establish.
- User impact: User may assume outage was reported and wait instead of using a working alternative/support. Actual provider error/platform alerting UNTESTED.
- Recommended fix (not executed): Remove unsupported reporting assurance or connect an acknowledged existing operational reporting path; verify ordinary error-copy contracts.
- Release blocker: No individually; auth failure guidance accuracy gap.


### F-177 — Minor / FAIL — Preserved Linux reminder registration failure leaves the generated notification script behind
- Found by: SECOND SOURCE REVIEW2026-10-05; support full donor source read and root exact scheduler/caller cross-check. Conditional donor reuse; no scheduler or reminder executed.
- Reproduction/cross-check: Follow the ordinary Linux registration path after _write_notify_script: absent systemd-run/at or unsuccessful registration returns an empty job ID. The caller returns failure without unlinking; only its exception path and other platform adapters remove failed scripts.
- Expected vs actual: Failed registration removes the newly generated artifact; actual normal Linux failure retains .jarvis/reminders/JARVISReminder_*.py containing the reminder message.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/reminder.py:252-285,314,325-331. Cleanup is tied to exceptions rather than all unsuccessful registration results.
- User impact: Repeated failed registration accumulates orphan notification files and retained reminder text. No current shipped Linux scheduler or physical behavior claimed.
- Recommended fix (not executed): In an adapted scheduler, clean up the newly created script whenever registration yields no job ID; verify failed and successful adapter results. Preserve original donor source.
- Release blocker: Conditional donor resource cleanup gap only.


### F-178 — Major / PARTIAL — Preserved messaging adapters claim delivery without verifying recipient or send result
- Found by: SECOND SOURCE REVIEW2026-10-05; support full donor source and root exact launch/send cross-check. Conditional donor reuse; external send UNTESTED. No messaging, clipboard, browser launch or desktop action executed.
- Reproduction/cross-check: Passively follow ordinary unavailable app, slow page or missing contact paths: Windows launcher and browser helper report launch success after key calls/webbrowser.open without outcome verification; send adapters continue fixed delays and Enter sequences, then unconditionally return Message sent.
- Expected vs actual: Bind the intended conversation and establish a delivery result, otherwise explicitly report unconfirmed; actual success follows completion of input calls alone.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/send_message.py:71-78,117-122,137-150,166-191,194-213. Fixed sleeps and blind keystrokes replace recipient and delivery acknowledgement.
- User impact: An adapted workflow can mislead users about delivery or type into an unintended active UI. No current shipped messaging behavior or actual wrong-recipient transmission claimed.
- Recommended fix (not executed): For separately authorized adaptation, verify conversation identity before input and delivery acknowledgement before success; retain explicit unconfirmed state when evidence is unavailable. Preserve immutable donor.
- Release blocker: Conditional blocker before reusing these external messaging adapters.


### F-179 — Minor / FAIL — Runtime test homes and manual browser fixture directories lack teardown
- Updater fixture extension: test_update.py:46-53,327-333 create temporary release roots without cleanup, while scoped patches themselves do register cleanup. Full passive module reread; no archive, signature, install or rollback test executed.
- Safety fixture extension: test_safety.py:50,157,171,215,245,265,439 allocate temporary directories without teardown. Uninstall cases remove some homes explicitly; this claim excludes those successful removals. Full passive source read; no boundary/security test executed.
- Computer fixtures: test_computer.py:22,155,263,269,404 use temporary directories without teardown, including decorator-time allocation. Exact full module reread; native tests not executed.
- File/Office fixture extension: test_files_documents.py:47,104,144 and test_sheets.py:72,128,146,160 allocate directories without teardown. No native Office or boundary test executed; meaningful existing ordinary file-engine evidence remains separately recorded.
- Structured browser fixtures: test_browser_control.py:37-53,224-252,260-279,304 retain temporary pages/profiles/workspaces; teardown stops some server/browser objects but does not remove their directories. Agent fixture directories at test_agent.py:41,293,308,368,389,405 likewise lack teardown. Same bounded test-resource family; passive reads only.
- Discovery/browser test extension: test_discovery.py:12,19,43,109,123,131,138,156 allocates directories with no cleanup; test_existing_browser.py:45-52,92-110,170-191 closes some sockets/processes but retains profile/site directories, and restart child cleanup occurs only on its successful path. Passive full-module review; no browser or filesystem action executed.
- Wake test extension: test_wake.py:41-50 creates a model/key fixture directory without tearDown/addCleanup; parity fixture:116-138 removes its directory only after every assertion succeeds. Success in ManifestTest and failure in parity retain their fixtures. Source only; no signing/tampering test executed. Use owned fixture cleanup that also handles failed setup/assertions.
- Second-pass extension: manual_installed_lifecycle.py:106-118 allocates two temporary directories and may copy the real agent home before checking whether an agent is already installed; the early refusal exits before finally:223-234. That normal refusal retains an unnecessary backup containing copied state. Passive source only; this audit did not run the installer or copy real agent state. Move admission checks before allocation/copy and own cleanup across all early exits in a future authorized test change.
- Found by: SECOND SOURCE REVIEW2026-10-05; complete conftest/manual browser fixture reread and exact cleanup search. Test resource defect; no new suite/browser run.
- Reproduction/cross-check: Inspect test import setup and manual Chrome fixture: both allocate tempfile.mkdtemp directories; neither file owns a removal hook/context. Manual proof only shuts down its server after the happy path, with no finally for early failure.
- Expected vs actual: Owned disposable directories and server are cleaned after success or failure; actual temporary test homes/page directories survive ordinary completion and manual exceptions skip server cleanup.
- Location/root cause: jarvis-runtime/tests/conftest.py:12-20; jarvis-runtime/tests/manual_existing_chrome.py:16-23,30-40. mkdtemp ownership and manual server lifetime have no teardown.
- User impact: Repeated testing accumulates disposable files; failed manual proof can retain its server until process exit. This does not imply product user-data leakage or current long-run production growth.
- Recommended fix (not executed): Use narrow owned temporary-directory teardown and finally for the manual fixture server, preserving evidence explicitly requested for failed runs; verify repeated isolated runs and early failure cleanup.
- Release blocker: No individually; test resource hygiene.


### F-180 — Minor / PARTIAL — Preserved native GPU metric path reports zero after unchecked NVML errors
- Found by: SECOND SOURCE REVIEW2026-10-05; support full donor module and root exact native-status/caller cross-check. Conditional donor reuse; hardware/library behavior UNTESTED, no GPU probe executed.
- Reproduction/cross-check: Follow ctypes NVML functions returning ordinary error statuses without throwing: init, handle and utilization return codes are ignored, zero-initialized _Util remains unchanged, and the function sets available true and returns zero. Consumers accept nonnegative GPU usage as valid.
- Expected vs actual: Failed reads produce unavailable/error telemetry; actual source publishes plausible 0% and can suppress high-load guidance.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/system_monitor.py:50-66,76-78,131,193. Native status is not checked; repeated pynvml initialization also has no balanced shutdown in this module.
- User impact: Adapted monitoring can display unavailable hardware as idle. No current shipped GPU measurement failure claimed.
- Recommended fix (not executed): Check every native status, return the existing unavailable sentinel on failure, and give NVML initialization/shutdown clear bounded ownership; verify mocked error and success results before native platform checks. Preserve original donor.
- Release blocker: Conditional donor diagnostic/resource accuracy gap only.

- UI corroboration2026-10-05: preserved imports/ocade-jarvis/source-original/ocade jarvis 25-09/ui.py:189-225 independently repeats this native-status defect: nvmlInit_v2 at204, handle lookup218 and utilization220 ignore status; zero-initialized util.gpu is returned221-222 as valid and _get_gpu invokes it312. Conditional source-only donor reuse, no GPU/hardware execution; same F180 family, not a new count.


### F-181 — Minor / FAIL — Direct existing-browser test invocation exits before defining the restart suite
- Safety module extension: test_safety.py:430-431 precedes IdentityRecoveryTest:434 and UninstallTest:452, so direct execution omits these suites; its advertised pytest runner includes them. Source only; no security/uninstall case executed.
- Computer test extension: test_computer.py:472-473 precedes CommandClassTest:476, MultiMonitorTest:484, WindowTest:500 and AccessibilityTest:514. Direct execution omits these late suites; advertised imported discovery includes them. Source only; native/security cases not executed.
- Document test extension: test_files_documents.py:98-99 precedes WriteExactlyTest:102, WordValidationTest:129 and RealWordTest:140, so direct invocation omits these while imported discovery includes them. Passive source only.
- Structured-browser module extension: test_browser_control.py:196-197 invokes unittest.main before RealBrowserTest:200 and UploadDownloadTest:255, omitting those suites in direct execution. Imported discovery sees them; no browser or boundary test executed.
- Agent module extension: test_agent.py:359-360 invokes unittest.main before RemovalSignalTest:363 and RotationTest:400. Direct script execution omits those late suites, while its advertised imported discovery form includes them. Passive definition-order proof only; removal/rotation/security tests not executed.
- Found by: SECOND SOURCE REVIEW2026-10-05; full test module and definition-order cross-check only. No browser or test invocation executed.
- Reproduction/cross-check: Inspect direct python jarvis-runtime/tests/test_existing_browser.py flow: unittest.main() at150-151 runs with default exit before execution reaches RestartTest at154-191. Imported discovery can see the suite because the main guard is false.
- Expected vs actual: Both supported direct and discovered test runs include the defined restart/reconnection case; actual direct run silently omits that case and may still exit successfully.
- Location/root cause: jarvis-runtime/tests/test_existing_browser.py:150-155,168-191. The entrypoint precedes later test definitions.
- User impact: Direct browser proof undercovers restart behavior. Import-based suite discovery is unaffected; no existing recorded discovered PASS is invalidated by this finding.
- Recommended fix (not executed): In a future authorized test change, place the direct entrypoint after all classes and compare collected case names for direct/discovered execution.
- Release blocker: No individually; browser proof coverage gap.


### F-182 — Minor / PARTIAL — Preserved bounded news helper returns while its provider worker keeps running
- Donor inner Live resource extension2026-10-05: core/gemini.py:338-357 acquires one of three Live slots, starts a daemon worker and releases the slot after join timeout even if still alive. _live_turn:289,301,306,312 allows connection plus response/trailing/exit work beyond caller wait; a normal slow connection can overlap subsequent sessions and REST fallback beyond the advertised slot cap. Exact passive source cross-check; no provider/session/worker executed. Give the owned worker end-to-end deadline/cancellation and retain the slot until finalization; preserve donor original. Actual cost/concurrency remains UNTESTED.
- Found by: SECOND SOURCE REVIEW2026-10-05; support full donor module and root timeout/worker cross-check only. Conditional donor reuse; no search, provider or worker executed.
- Reproduction/cross-check: Read _run_bounded: every invocation starts a daemon worker, joins for a deadline and returns its result slot even while alive. News waits six seconds for a Gemini request configured for thirty seconds and a fallback ladder. Repeated ordinary timed-out calls can overlap retained work.
- Expected vs actual: A bounded operation has bounded work ownership and accurately reports unfinished work; actual timeout bounds caller waiting alone and drops the worker handle.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/web_search.py:49-64,90-92,274-280. No cancellation or outstanding-worker cap/ownership exists in this helper.
- User impact: Adapted repeated news checks can retain overlapping threads/provider requests and discard later successful responses; real duration/cost/resource growth UNTESTED.
- Recommended fix (not executed): Use actual provider deadlines aligned with caller waiting or a narrowly bounded owned operation; explicitly handle unfinished results. Avoid a new generic pool unless existing bounded ownership cannot suffice. Preserve original donor.
- Release blocker: Conditional donor background resource gap only.


### F-183 — Major / PARTIAL — Advertised unittest lifecycle invocation bypasses pytest-only installed-agent isolation
- Found by: SECOND SOURCE REVIEW2026-10-05; lifecycle invocation/import setup, conftest overrides and production lifecycle targets cross-checked passively. Native test invocation UNTESTED and deliberately not executed.
- Reproduction/cross-check: test_agent.py:3 advertises python -m unittest discover. Its imports load ocade_agent directly, while the temporary HOME, singleton port and autostart-name overrides live only in pytest conftest.py. unittest discovery does not initialize pytest conftest hooks. Ordinary autostart/uninstall cases consequently retain production singleton/autostart targets absent external overrides.
- Expected vs actual: Advertised test entrypoints isolate every installed-agent resource before imports and lifecycle actions; actual isolation is runner-dependent and the advertised runner can use the real OCADE login entry/port/token.
- Location/root cause: jarvis-runtime/tests/test_agent.py:3,16-18,94-104; tests/conftest.py:12-20; ocade_agent.py:39,91-107,147,200-215. Unittest test setup changes XDG_CONFIG_HOME and its argument home but not Windows AUTOSTART_NAME, SINGLE_INSTANCE_PORT or imported production identity HOME.
- User impact: An unisolated advertised Windows test run can rewrite/remove the installed login entry or stop the real companion. This audit used isolated selected fixtures and did not perform this invocation; actual host effects are not claimed reproduced.
- Recommended fix (not executed): Make isolation explicit for every supported runner before lifecycle imports/actions, or restrict documented execution to a verified isolated runner. Verify resource targets with doubles before any native run.
- Release blocker: Yes for safely using the advertised native lifecycle proof on a customer machine.


### F-184 — Minor / PARTIAL — Follower tab adopts Offline ready before its own runtime has activated
- Found by: SECOND SOURCE REVIEW2026-10-05; src full authority/browser/runtime reads and root exact state/lock/delegate cross-check only. Two-tab runtime execution UNTESTED.
- Reproduction/cross-check: Ordinary source sequence: tab B queues install behind tab A's WebLock; A broadcasts ready, which B observes and publishes as ready. B's own activation has not run. isReady and install trust that observed stage, and install returns ready before joining its still-running promise. Its tab-local delegate can simultaneously report no model/still preparing.
- Expected vs actual: Local ready follows local adapter load; actual shared completed transfer state is treated as tab runtime readiness. B can later activate after lock transfer, so permanent loading loss is not claimed.
- Location/root cause: src/lib/brain/installation-authority.ts:315-316,363-369,382-384; installation-browser.ts:196-229,271; runtime-activation.ts:39-43,102,135-159; use-installation.ts:98,198,203. Shared broadcast stage is adopted without a local activation condition.
- User impact: Offline readiness UI/callers can briefly promise availability while generation remains unavailable in the follower tab; actual concurrency duration/platform effects UNTESTED.
- Recommended fix (not executed): Distinguish shared artifact verification/transfer state from each tab's loaded runtime; await local activation/in-flight work before local ready, preserving lock ownership and zero-download reopen behavior.
- Release blocker: Offline readiness consistency gap; native incidence unverified.


### F-185 — Minor / PARTIAL — Preserved saved audio selection can resolve to another endpoint with the same name prefix
- Found by: SECOND SOURCE REVIEW2026-10-05; support full donor audio module and root exact display/resolution cross-check only. Conditional donor reuse; physical audio UNTESTED, no hardware probe.
- Reproduction/cross-check: Ordinary source case: two different usable endpoints share the first24 characters; saved exact endpoint is absent. resolve accepts the first usable partial-prefix match within a host API before considering later APIs or documented missing-device default. Display-name expansion also picks a longer matching prefix without endpoint identity.
- Expected vs actual: Resolve the selected endpoint unambiguously or explicitly fall back/unavailable; actual plausible prefix substitutes for endpoint identity.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/audio_devices.py:176-189,348-359,397-414. Names and broad prefix matching lack stable endpoint binding/disambiguation.
- User impact: Adapted audio selection can use a different microphone/speaker than the saved choice. No current shipped audio switch or recording claimed; separate from existing probe/cache findings.
- Recommended fix (not executed): Carry endpoint/host identity where available and accept only unambiguous fallback; verify duplicate-prefix, exact-match and disconnect cases with doubles before platform proof. Preserve original donor.
- Release blocker: Conditional donor device-selection correctness gap only.


### F-186 — Minor / PARTIAL — OPFS sync write fallback leaves its owned handle open after write failure
- Found by: SECOND SOURCE REVIEW2026-10-05; src full store read and root exact ownership/caller cross-check only. Conditional worker fallback; no OPFS/API probing or resource stress executed.
- Reproduction/cross-check: Passively follow createWritable failure then successful createSyncAccessHandle acquisition: a normal truncate/write/flush exception skips sync.close and returns false. Neighboring SyncAccessWriter.close independently flushes and closes despite flush failure, demonstrating existing bounded ownership pattern.
- Expected vs actual: Owned sync handle is closed after both success and failure; actual error path drops the live handle without finally.
- Location/root cause: src/lib/brain/model-store.ts:285-308, especially299-306; existing safe close pattern171-180; model-vault.ts:281-284 calls writeFile for vault metadata. Cleanup is success-only in the fallback.
- User impact: When reachable in a worker/sync fallback, failed vault writes can retain an exclusive handle and interfere with retry/deletion until context exit. Current installer is main-thread; physical/browser leak and current fallback incidence UNTESTED.
- Recommended fix (not executed): Use narrow try/finally for the acquired handle, preserving best-effort flush and the failed result. Reuse the existing ownership pattern, verify mocked write failures before worker/platform proof.
- Release blocker: Conditional offline storage resource gap only.


### F-187 — Minor / FAIL — Screen-input regression overwrites the real clipboard despite using a fake GUI
- Found by: SECOND SOURCE REVIEW2026-10-05; exact test setup and clipboard statements reviewed passively. Test not executed.
- Reproduction/cross-check: test_safety ScreenInputTest uses FakeGui but its long-text test calls real pyperclip.copy with mine, then asserts product restores mine. It never captures/restores the pre-test clipboard. The module says no display is required, yet this test requires an operational native clipboard backend absent a separate mock.
- Expected vs actual: A fake-GUI unit test isolates clipboard behavior and leaves the host clipboard untouched; actual test replaces host clipboard state and validates restoration only to its replacement value.
- Location/root cause: jarvis-runtime/tests/test_safety.py:1-4,303-311,348-355. GUI is doubled but clipboard API is not, and original host state is not owned/restored.
- User impact: Running this case can lose a user's copied text or fail on a headless platform for fixture reasons. No clipboard mutation was performed by this audit.
- Recommended fix (not executed): Use the existing narrow mocking pattern for pyperclip copy/paste and verify restoration to fixture state; reserve native clipboard proof for an explicitly owned platform fixture with reliable teardown.
- Release blocker: No individually; test isolation and headless portability gap.


### F-188 — Major / PARTIAL — Resumed model transfer budgets concurrency against a new chunk size rather than retained ranges
- Found by: SECOND SOURCE REVIEW2026-10-05; src partial transfer read with exact policy/dispatch cross-check and root exact constants/source review. No download, concurrency execution or memory stress.
- Reproduction/cross-check: Ordinary source sequence: interrupted capable-device transfer retains8MiB checkpoint chunks; a subsequent data-saving plan chooses2MiB. Resume correctly retains8MiB ranges, but adaptive maximum uses new plan2MiB. Static64MiB policy permits32 rather than8 streams as throughput climbs, while dispatch window allows twice concurrency.
- Expected vs actual: Actual resumed chunk size controls stream/dispatch buffer limits; actual ceiling is derived from a different new plan size. Potential256MiB active chunk span and512MiB dispatch span are arithmetic upper spans, not measured heap allocations.
- Location/root cause: src/lib/brain/model-transfer.ts:278-283,395-397,603,649-663; download-plan.ts:95-100,173-174,202-204. Resume chunk identity and adaptive resource ceiling use different authorities.
- User impact: Ordinary interrupted transfers after changed browser/network preferences may exceed the intended buffer budget and pressure constrained tabs. Actual killed tab/resource consumption remains UNTESTED.
- Recommended fix (not executed): Compute bounds from retained chunkBytes and clamp initial/adapted concurrency consistently; verify ordinary resumed-plan budget cases without stress, preserving checkpoint offset correctness.
- Release blocker: Resource budget consistency gap for resumed offline installation; native incidence unverified.


### F-189 — Major / PARTIAL — Preserved confirmation response is not bound to its displayed request
- Found by: SECOND SOURCE REVIEW2026-10-05; support full confirm module and targeted donor UI, root exact state/signal/callback cross-check passively. Conditional donor reuse; no confirmation callback, operation or race fixture executed.
- Reproduction/cross-check: Ordinary overlapping-request source ordering: request A is displayed, request B replaces the global pending request before its queued UI signal is handled. The still-visible A banner sends only a boolean; resolve takes whichever pending request currently exists. The stored key is not included in display/answer binding.
- Expected vs actual: User response applies only to its displayed action; actual response can resolve a different latest pending action. Native timing/incidence UNTESTED.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/confirm.py:96-101,115-145; ui.py:5042-5047,5056-5063,5277-5280. Mutable singleton and asynchronous banner callbacks share no request generation/identity.
- User impact: An adapted donor interface may associate a normal response with the wrong operation. No current shipped action or irreversible operation claimed performed.
- Recommended fix (not executed): Carry request identity through display/resolve and reject stale responses, or explicitly reject overlapping pending requests; preserve timeout and unavailable-interface refusal. Preserve immutable original donor.
- Release blocker: Conditional blocker before reusing this donor confirmation interface.


### F-190 — Minor / PARTIAL — Sequential download fallback discards the currently selected or refreshed source
- Found by: SECOND SOURCE REVIEW2026-10-05; src full transfer review and root exact selection/fallback/helper cross-check. No download, refresh or provider executed.
- Reproduction/cross-check: Ordinary source sequence: source A fails, transfer rotates to usable B; B answers200 instead of honoring Range. Sequential fallback receives original request and fetches original sources[0] A again. Newly refreshed source arrays are likewise kept only in local selection state and discarded by the helper.
- Expected vs actual: Sequential mode fetches the current selected/refreshed source; actual static branch restarts at an obsolete original URL.
- Location/root cause: src/lib/brain/model-transfer.ts:217-224,233-248,503,532-539,692-704,839. Selected mutable source state is not passed across fallback.
- User impact: Preparation can falsely fail despite a valid alternative or refreshed no-Range source. Canonical delivery normally honors ranges; affected alternative-source incidence and production outage UNTESTED.
- Recommended fix (not executed): Pass the current selected source into sequential transfer, retaining source/refresh ownership; verify ordinary source-switch and refreshed-link no-Range cases with local doubles.
- Release blocker: Conditional alternate-source download recovery gap only.


### F-191 — Major / FAIL — Cache-write refusal discards a successful network page or first-load asset response
- Found by: SECOND SOURCE REVIEW2026-10-05 and actual unchanged service-worker fetch handler executed in an isolated VM with fake network/cache only. No browser/network/storage mutation.
- Reproduction/cross-check: work/ordinary-sw-cache-failure.mjs runs navigation and uncached static-asset paths with fresh basic200 responses; ordinary mocked cache.put rejection replaces navigation with the offline page and uncached JavaScript with Response.error/status0. Both same-handler controls with successful cache writes preserve fresh200 bodies. Results in work/ordinary-sw-cache-failure.json.
- Expected vs actual: Best-effort cache failure leaves a successful network response usable; actual cache refusal is caught as network failure and discards that response.
- Location/root cause: public/sw.js:267-296 awaits navigation cache.put before returning response;308-316 awaits keepAsset before returning response; keepAsset:42-49 can reject. Cache persistence and network delivery share one catch boundary.
- User impact: Storage/quota refusal can send an online user to an offline/stale page or break uncached lazy JavaScript despite successful network delivery. Fixture proves handler logic; native quota incidence UNTESTED.
- Recommended fix (not executed): Handle cache persistence refusal separately while returning the received network response; retain genuine network-failure fallback and no-store exclusions. Verify the same ordinary mocked cases plus legitimate browser storage evidence.
- Release blocker: Yes for resilient online navigation/asset delivery when cache persistence fails.


### F-192 — Major / PARTIAL — Vault activation and rollback report durable success after manifest write refusal
- Found by: SECOND SOURCE REVIEW2026-10-05; src full vault/authority review and root exact boolean write/activation cross-check. No storage fault fixture or browser mutation executed.
- Reproduction/cross-check: Ordinary source contract: existing durable v1 pointer, verified staged v2, subsequent store.writeFile returns false. save propagates false, but activate mutates its in-memory active/previous pointer then ignores save and returns true; rollback similarly returns prior version after ignored false. Next context load sees old durable pointer. Authority ignores metadata/activation success and continues runtime ready.
- Expected vs actual: Successful activation/rollback and ready follow a committed durable pointer or truthful error; actual success can coexist with refused persistence and revert after reload. No measured data loss claimed.
- Location/root cause: src/lib/brain/model-vault.ts:282-292,316-328,338-350; model-store.ts:285-308; installation-authority.ts:575-578,604-612,831-859. Persistence boolean is ignored at pointer and authority boundaries.
- User impact: Offline installation/update state may revert or repeat preparation after reload despite reported ready/rollback. Runtime in-memory operation may still work during the current context; storage/platform incidence UNTESTED.
- Recommended fix (not executed): Check and propagate save/metadata/activation results, restore prior pointers on refusal and publish ready only after commit; verify ordinary failed-write/reload cases with doubles before browser evidence.
- Release blocker: Yes for truthful durable offline installation/update readiness.


### F-193 — Minor / FAIL — Preserved streamed replies conflate truncated transport with completion or silently drop trailing text
- Found by: SECOND SOURCE REVIEW2026-10-05; support full donor client and root exact termination branches cross-check only. Conditional donor reuse; no HTTP/provider/voice operation.
- Reproduction/cross-check: Passively follow ordinary successfulHTTP content then EOF: OpenAI branch unconditionally yields done even without explicit terminal evidence, and treats length limit as completion. Ollama branch only flushes trailing buffer/tools on chunk.done, so EOF without it silently loses the retained final fragment and emits no terminal status.
- Expected vs actual: Distinguish complete, length-limited and interrupted outcomes while preserving observed text; actual adapters report success or omission inconsistently.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/llm_client.py:404-449,451-473,530-567. Transport iteration end is not tracked separately from semantic completion.
- User impact: Adapted voice/history can present partial replies as complete or omit unsent trailing content/tool output. No current shipped provider failure claimed.
- Recommended fix (not executed): Track terminal evidence, surface partial/interrupted or length-limited outcome, and flush retained observed text with its status; preserve immutable donor and verify ordinary mocked stream termination cases.
- Release blocker: Conditional donor response integrity gap only.


### F-194 — Major / PARTIAL — Service-worker upgrade activates despite a missing first-paint JavaScript cache entry
- Found by: SECOND SOURCE REVIEW2026-10-05 and unchanged install/activate handlers in a disposable mocked VM. No browser/network/storage mutation; native offline upgrade UNTESTED.
- Reproduction/cross-check: work/ordinary-sw-install-fixture.mjs supplies a cached shell referencing /assets/entry.js and makes that asset's ordinary cache.addAll reject. Install still calls skipWaiting, activation deletes old shell cache and claims clients. Fixture output in work/ordinary-sw-install-fixture.json. Source first-paint rationale identifies these entries as required to hydrate the cached shell.
- Expected vs actual: Core first-paint assets establish usable offline shell before replacement, or readiness truthfully remains incomplete; actual first-paint errors are treated identically to optional brand-image failures.
- Location/root cause: public/sw.js:103-116,131-138,148-163. Promise.allSettled groups firstPaint with OPTIONAL_PRECACHE and ignores all rejection results before activation/old-cache deletion.
- User impact: If a required new chunk is unavailable during upgrade and is not later cached at runtime, offline reopen can receive HTML without its hydration JavaScript. Online/runtime fetch may repair it; no current blank-page production incident claimed.
- Recommended fix (not executed): Separate required first-paint entries from optional artwork, preserve previous usable generation on incomplete required precache or expose incomplete offline readiness; verify transient missing-chunk/upgrade/offline reopen with legitimate browser evidence.
- Release blocker: Conditional blocker for dependable offline shell upgrade/reopen.


### F-195 — Minor / FAIL — Preserved model availability check accepts a different pulled Ollama tag
- Found by: SECOND SOURCE REVIEW2026-10-05; support full donor client and root exact availability/request cross-check only. Conditional donor reuse; no model/server call.
- Reproduction/cross-check: Configured llama3.2:3b and pulled list containing only llama3.2:1b: the literal matching expression accepts any same-base colon tag and returns available. Chat payloads still send the exact configured model. Exception branch also reports true as a nonblocking advisory rather than confirmed availability.
- Expected vs actual: Exact configured tag is present, with unknown separate from available; actual sibling model variant suppresses the missing-model warning.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/llm_client.py:196-218,285,512. Readiness matching removes variant identity while requests preserve it.
- User impact: Adapted setup can appear ready then fail to use its chosen model despite another variant being installed. No current shipped Ollama outage claimed.
- Recommended fix (not executed): Match exact normalized tags, applying default-tag normalization only when omitted, and distinguish unknown probe state from availability; preserve immutable donor and verify ordinary literal tag cases.
- Release blocker: Conditional donor readiness accuracy gap only.


### F-196 — Major / PARTIAL — Offline journal accepts request success before transaction commit and hides durable write refusal
- Found by: SECOND SOURCE REVIEW2026-10-05; src full journal review and root exact transaction/write/queue contract cross-check passively. No quota, crypto, account-switch or security reproduction.
- Reproduction/cross-check: Ordinary persistence source sequence: an IDB put request succeeds, then its transaction aborts during commit. run resolves on request.onsuccess without retaining transaction completion/abort/error handlers. Key/turn writes await that request-only outcome; inOrder also swallows rejection, and remember exposes no durable failure. In-memory buffer can still retain the turn in the current tab.
- Expected vs actual: Durable journal success follows transaction completion and storage failure is observable; actual late transaction refusal is invisible after request success.
- Location/root cause: src/lib/chat/unsynced-turns.ts:58-71,88,99-114,144-147. Transaction lifecycle is discarded while request lifecycle stands in for persistence.
- User impact: An offline turn/key may be absent after reload despite accepted write, risking loss when the tab closes before account sync. Actual commit-abort incidence/data loss UNTESTED; confidentiality was not probed.
- Recommended fix (not executed): Own transaction completion/abort/error and propagate durable status to normal UI while preserving the in-memory retry buffer; verify ordinary request-success/commit-abort and restart with isolated doubles before browser proof.
- Release blocker: Yes for reliable durable offline turn retention.


### F-197 — Minor / PARTIAL — Preserved speech model retry clears explicit offline flags globally
- TTS corroboration2026-10-05: core/tts.py:KokoroTTSEngine._init:275-297 repeats the broad offline-error keyword retry and clears the same three global flags at285-287 without restoring prior configuration; create_tts_player:434 can reach it. Exact root/support passive source cross-check only, no model/network/environment action. Same conditional donor policy/ownership family.
- Found by: SECOND SOURCE REVIEW2026-10-05; support full donor STT and root exact retry/environment cross-check only. Conditional donor reuse; no model/network/environment action executed.
- Reproduction/cross-check: Configured offline model initialization fails with a broad matching word such as offline/not found/cache. Retry removes HF_HUB_OFFLINE, TRANSFORMERS_OFFLINE and HF_DATASETS_OFFLINE from shared process environment and attempts initialization again. Prior values are not restored after success or retry failure.
- Expected vs actual: Explicit offline configuration is respected with truthful missing-cache recovery; actual retry changes global policy and may attempt download.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/stt.py:25-48, especially35-41. Broad dependency-error matching overrides persistent process configuration.
- User impact: Adapted speech setup may unexpectedly try network and change later model-loader behavior. Real download/runtime incidence UNTESTED; no current shipped action claimed.
- Recommended fix (not executed): Preserve explicit offline policy and separate missing-cache errors; allow download only under configured permission and scope/restore any necessary temporary environment. Preserve original donor.
- Release blocker: Conditional donor offline-policy accuracy gap only.


### F-198 — Major / PARTIAL — Late first-conversation creation takes the screen back after same-account navigation
- Same-account stale rollback extension2026-10-05: use-chat.ts:801,805,846 restores a previous transcript on delayed send refusal; removeMessage:854-868 restores A's previous transcript after deletion rejection even if B is selected; mutateConversations:892-898 restores an entire captured list after rejection, potentially overwriting newer successful row changes. Existing epoch/navigation ownership:250-267,949-960 is not checked by these rollback writes. Root exact passive cross-check; no deletion, account-isolation or concurrency execution. Guard transcript rollback with screen/epoch and scope list rollback to its owned row/operation or re-read; preserve newer user state.
- Found by: SECOND SOURCE REVIEW2026-10-05; src partial chat review and root exact epoch/create/persist/navigation cross-check. Same-account ordinary race only; no auth/account-isolation or concurrency execution.
- Reproduction/cross-check: Ordinary source ordering: send on New chat, allowance succeeds, conversation creation remains pending; user opens saved chat B or Temporary, advancing epoch. Creation resolves old A; old send unconditionally selects A and persists its old question before the next mine guard. Later selection should win.
- Expected vs actual: Post-await screen changes belong to the current epoch; actual stale creation updates selected conversation/list before ownership is checked. Already-created remote row can legitimately exist; no deletion recommended by this audit.
- Location/root cause: src/lib/chat/use-chat.ts:250-267,442-443,499,534-571,949-960; static a-send-belongs-to-one-screen.test.ts:33-51 checks earlier ordering but misses creation continuation. No guard immediately after createConversation.
- User impact: Normal navigation during first-send latency can unexpectedly jump to an abandoned conversation and store its old question. Actual browser incidence UNTESTED; no cross-account write claimed.
- Recommended fix (not executed): Check ownership immediately after creation before screen mutation/persistence, handle already-created empty rows truthfully, and guard subsequent awaited continuations; verify same-account delayed-create navigation with ordinary doubles.
- Release blocker: Yes for consistent chat navigation during first-send latency.


### F-199 — Minor / PARTIAL — Preserved speech STOP can be followed by more playback from the same utterance
- Found by: SECOND SOURCE REVIEW2026-10-05; support full TTS and root exact synthesis/queue/playback/STOP source cross-check. Conditional donor reuse; real speech UNTESTED, no audio/provider/STOP execution.
- Reproduction/cross-check: TTSPlayer.stop only stops current global playback and clears playing. Its active engine.speak continues synthesis/queue consumption: Kokoro can read the next chunk and call sd.play again; Edge synthesis can finish after STOP and start playback. No utterance cancellation token binds these stages.
- Expected vs actual: STOP suppresses pending/future audio of the interrupted utterance and status remains truthful; actual later chunks can resume while is_playing reports false.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/tts.py:80-85,111-118,331-345,398-422; ElevenLabs371-376 has analogous unbound synthesis/playback. Distinct from speaker-exception queue leak F-086.
- User impact: Adapted voice interface can continue speaking after normal STOP and show an idle state during renewed playback. No current shipped physical speech defect claimed.
- Recommended fix (not executed): Propagate per-utterance cancellation through synthesis, queued chunks and playback with owned cleanup/finished-state reporting; preserve immutable donor and verify ordinary cancellation doubles before platform proof.
- Release blocker: Conditional donor interruption reliability gap only.


### F-200 — Minor / FAIL — Preserved avatar phoneme state never returns to audio fallback after transcript exhaustion
- Found by: SECOND SOURCE REVIEW2026-10-05; support full donor viseme module and root exact frame-state cross-check only. Conditional donor reuse; rendered voice/audio UNTESTED, no playback or renderer executed.
- Reproduction/cross-check: Follow ordinary end of queued transcript: when queue is empty, frames retains last non-REST current phoneme indefinitely. Its condition keeps transcript mode active; a last MBP phoneme retains closure1 and forces openness0 during subsequent audible frames instead of audio-only fallback.
- Expected vs actual: Finished/late transcript falls back to actual audio-driven mouth state; actual stale phoneme persists until later text or reset.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/viseme.py:257-273, especially261-265,273; declared audio-only fallback rationale15-16. Non-REST current state doubles as an unbounded transcript-availability flag.
- User impact: Adapted voice avatar may hold a closed/stale mouth after final text while audio continues. No current shipped rendered failure claimed.
- Recommended fix (not executed): Expire consumed phonemes by duration and clear completed state into audio fallback; verify final MBP, transcript gaps and missing transcript with pure doubles before renderer proof. Preserve donor original.
- Release blocker: Conditional donor avatar accuracy gap only.


### F-201 — Minor / PARTIAL — Preserved wake restart reuses an old stop sentinel while reporting ready
- Found by: SECOND SOURCE REVIEW2026-10-05; support full donor wake module and root exact queue/start/stop/loop cross-check passively. Conditional donor reuse; no microphone, model or thread execution.
- Reproduction/cross-check: Ordinary stop/restart source ordering: stop enqueues None and clears model without joining; start reuses the same queue, publishes running/ready and starts a worker without draining old sentinel/frames. A new worker can consume the prior None and exit while ready remains true; generations can also overlap shared model state.
- Expected vs actual: Repeated start/stop owns one fresh detector generation and readiness follows its live worker; actual queue/model/worker ownership spans generations and exit on sentinel does not reset readiness.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/wake_word.py:132-160,184-186. Reused queue plus no bounded join/generation identity allows stale termination/readiness.
- User impact: Adapted wake can appear ready without detecting, or retain overlapping generations. Exact thread scheduling/native incidence UNTESTED, so PARTIAL rather than hardware failure proof.
- Recommended fix (not executed): Boundedly join the old worker and own stop/queue/model per generation; clear stale frames and publish actual worker readiness. Preserve donor and verify ordinary restart doubles before microphone proof.
- Release blocker: Conditional donor wake restart reliability gap only.


### F-202 — Minor / PARTIAL — Preserved dashboard reports firewall readiness after elevation launch without completion proof
- Found by: SECOND SOURCE REVIEW2026-10-05; support report independently cross-checked at the exact dashboard branch. Conditional donor reuse; no elevation, firewall or host configuration operation executed.
- Reproduction/cross-check: Follow an ordinary elevated batch launch that returns ShellExecuteW >32 but subsequently fails its rule command or finishes after two seconds. The elevated branch waits a fixed two seconds and reports completed setup/open port without observing process completion or rule state. Direct branch184-194 at least observes subprocess returncode; elevated branch does not.
- Expected vs actual: Readiness follows completed setup plus verified port/rule state; actual accepted elevation launch is treated as completed network configuration.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/server.py::_ensure_network_access:204-217; compare184-194. Nonblocking ShellExecuteW result and fixed sleep replace completion/result verification.
- User impact: Future adapted donor dashboard can tell phone users to connect while connectivity remains unavailable, misleading diagnosis. Native timing/rule failure incidence is UNTESTED, so PARTIAL.
- Recommended fix (not executed): Observe the owned elevated process with bounded completion/status and verify the intended rule/port before ready messaging. Preserve immutable donor source; verify ordinary delayed/failed completion doubles before separately authorized platform evidence.
- Release blocker: Conditional donor setup reliability gap only; not proof of a current deployed OCADE firewall failure.


### F-203 — Minor / PARTIAL — Preserved optional dashboard upload fallback checks FastAPI symbols instead of multipart availability
- Found by: SECOND SOURCE REVIEW2026-10-05; donor dashboard and caller independently cross-checked with installed FastAPI primary implementation. No import/runtime, dependency installation, upload or host action executed.
- Reproduction/cross-check: Conditional ordinary setup using main.py2069 suggested fastapi/uvicorn/cryptography packages without python-multipart: _UPLOAD_OK becomes true after importing FastAPI's UploadFile/File. _build_app then registers a multipart route; FastAPI requires the parser during Form/File dependency registration and raises if unavailable. Dashboard construction is caught by main and disabled. Full donor requirements.txt44 does include multipart, so this is not a normal complete-install failure claim.
- Expected vs actual: Optional missing multipart disables upload with the intended503 fallback while phone dashboard remains available; actual import-symbol check selects the route that fails construction before fallback is reachable.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/server.py:30-36,729-731,775-780 and main.py:2069-2079; requirements.txt:44. Cross-check: installed FastAPI dependencies/utils.py:103-129,523 invokes ensure_multipart_is_installed for Form/File. Read-only optional capability probe checks the wrong dependency.
- User impact: Future adapted optional dashboard setup can disable the whole phone UI when only file-upload support is missing. Exact installed-package combination/runtime construction UNTESTED, so PARTIAL; conditional preserved donor only.
- Recommended fix (not executed): Check actual compatible multipart parser availability before registering the multipart route, preserving the503 fallback and immutable donor. Verify separately authorized ordinary partial/full dependency setup without changing current product.
- Release blocker: Conditional donor optional-install reliability gap only; current deployed dashboard failure not established.


### F-204 — Minor / PARTIAL — Offline readiness banner counts future-window allowance before answering is available
- Found by: SECOND SOURCE REVIEW2026-10-05; ordinary readiness/display predicate independently cross-checked against existing source time-selection contract. No signing, counter, authorization or security probe executed.
- Reproduction/cross-check: Source condition: installed ready model, device identity, only a retained allowance with future notBefore, unexpired expiresAt and at least100 unconsumed/unreserved hundredths. canAnswerWithoutNetwork checks only wall-clock expiry and balance and returns true; actual generation reservation uses the existing time verifier and refuses not_yet_valid. Future leases are deliberately installed with allowFuture:true at offline-allowance.ts100-108. No constructed lease/runtime action executed.
- Expected vs actual: Offline banner promises answering only during a usable current allowance window; actual future-only allowance can display 'OCADE answers on this device.' followed by unavailable/refused generation.
- Location/root cause: src/lib/commercial/offline-allowance.ts:120-140; src/components/chat/ChatWorkspace.tsx:199-212,650-657; offline-counter.ts:535-569 and303-310; offline-lease.ts:197-203; use-generation-permit.ts:243-263. Duplicate display predicate omits notBefore and trusted-clock availability checks that reservation enforces.
- User impact: Misleading offline readiness and failed user attempt until the future window begins; source also lacks rollback-aware display parity. Current customer incidence/runtime reproduction UNTESTED, so PARTIAL. No allowance bypass alleged.
- Recommended fix (not executed): Reuse the existing current-window/time availability rules for display selection without weakening reservation verification; verify future/current/expired ordinary UI fixtures before separately authorized change.
- Release blocker: No individually; ordinary offline readiness UX gap with runtime evidence still pending.


### F-205 — Minor / PARTIAL — Preserved phone login lacks a meaningful key input label and announced async error
- Found by: SECOND SOURCE REVIEW2026-10-05; full donor login reported and exact input/viewport/error/CSS source independently cross-checked. No live login, credential, browser or physical screen-reader operation performed.
- Reproduction/cross-check: Inspect donor login key field: placeholder contains dots only and there is no associated label/aria-label. Error text target has neither alert role nor live announcement. Viewport requests user-scalable=no and card declares340px width without a responsive override. Conditional future adaptation must verify actual narrow layout/flex shrinking and browser zoom enforcement; overflow is not measured.
- Expected vs actual: Key input has a meaningful accessible name, async failure is announced and low-vision zoom/narrow phone views remain usable; actual input/error lacks semantic labeling/announcement and viewport asks to disable zoom.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/static/login.html:5,27-29,142-146. Placeholder-only input and bare async error container omit accessible semantics; fixed card sizing has no explicit viewport bound.
- User impact: Future adapted phone login can be difficult to identify/use with assistive technology and browsers honoring disabled zoom. Actual screen-reader/320px layout/physical Apple or Android behavior UNTESTED, so PARTIAL; immutable donor is not a current production page.
- Recommended fix (not executed): Provide an explicit meaningful key label, live/alert error semantics and error focus as appropriate; allow zoom and bound card width to available viewport. Preserve donor source and verify keyboard,320px+zoom and screen-reader error feedback before separately authorized adaptation.
- Release blocker: Conditional donor accessibility/mobile UX gap only; no current deployed login failure claimed.


### F-206 — Minor / PARTIAL — Preserved remote dashboard discards send failures and retains Active after socket close
- Found by: SECOND SOURCE REVIEW2026-10-05; exact donor helper/send/status/close branches independently cross-checked. Conditional reuse only; no browser command, wake, auth or network request executed.
- Reproduction/cross-check: Source condition: rejected network send or ordinary HTTP refusal/server restart after an Active status. doSend clears the input and appends user text before issuing a fetch whose promise/result is dropped; doWake similarly omits result handling. Socket close only appends a notice and never clears the existing Active pill.
- Expected vs actual: Rejected sends retain a retryable draft or explicit failed/pending command status and connection badge follows disconnection; actual no per-command failure UI and potentially stale Active remain.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/static/app.html:165-167,214,225-229,375-392. Raw fetch promises are discarded and close callback does not transition the status owner.
- User impact: Future adapted remote user can lose the composer draft and misread a failed/unacknowledged command or wake as accepted, with stale connected status. Text remains in local rendered transcript, so content is not irrecoverably erased; runtime reproduction UNTESTED/PARTIAL.
- Recommended fix (not executed): Await/check response.ok, show truthful pending/failure and retain/recover draft; update connection state on close/error using existing badge owner. Preserve immutable donor and verify ordinary delayed/refused sends and disconnect/reconnect UI in a separately authorized adaptation.
- Release blocker: Conditional donor remote UI reliability gap only; current deployed OCADE command failure not established.


### F-207 — Minor / PARTIAL — Preserved phone microphone start lacks session ownership across permission and worklet awaits
- Found by: SECOND SOURCE REVIEW2026-10-05; full donor remote page reported and exact start/stop/await branches independently cross-checked. No audio permission, microphone, browser, provider or race execution performed.
- Reproduction/cross-check: Source ordering: two quick mic taps see null _voiceWs before getUserMedia/context resume awaits complete; later sessions replace the singleton stream/context/socket references. A stop while onopen awaits worklet addModule does not prevent the stale callback assigning node and recording UI afterward. Acquired stream also has no cleanup if context construction fallback or resume fails before singleton ownership.
- Expected vs actual: One owned start/session generation, cancellation checked after awaits, and cleanup of every acquired resource on failure/stop; actual admission and cleanup references are installed late and stale callbacks remain unguarded.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/static/app.html:465-488,496-536,542-555. _voiceWs admission guard precedes asynchronous start but ownership follows it; stop cleans only current globals and callbacks have no generation check.
- User impact: Future adapted remote voice can retain an earlier microphone/context or show stale Voice live after stop. Exact native scheduling/capture incidence UNTESTED, so PARTIAL. Distinct from archived prototype F042 and donor camera F082; no current deployed microphone regression claimed.
- Recommended fix (not executed): Own pending-start/session identity and per-session resources immediately, check current generation after awaits, and reliably dispose partial initialization. Preserve immutable original and verify ordinary permission/worklet delays, stop and initialization failure before physical microphone proof.
- Release blocker: Conditional donor phone-voice lifecycle gap only.


### F-208 — Minor / PARTIAL — Online generation health records success at stream handoff before a later refusal or failure
- Found by: SECOND SOURCE REVIEW2026-10-05; ordinary observability response/stream contract independently source-cross-checked. No provider, network, credential or malformed-stream execution performed.
- Reproduction/cross-check: Source condition: accepted provider stream is handed off with HTTP200, then ordinary malformed/empty/failed stream reaches normalizedProviderStream refusal rather than final answer. handleOnlineIntelligence emits generation succeeded/errorClass none from HTTP status before completion; terminal stream refusal cannot amend this health record. Existing malformed-stream and early-observer tests cover these distinct events without final health parity assertions.
- Expected vs actual: Generation health distinguishes completed answer/refusal/failure, or initial event explicitly describes transport acceptance; actual generation outcome is succeeded based solely on response headers before async completion.
- Location/root cause: src/lib/intelligence/edge-handler.ts:625-642,833-855,531-572. Response200 handoff decides operation generation success outside the stream lifecycle. The documented609-613 time-to-headers latency is intentional and is not itself alleged incorrect.
- User impact: Operator success/error rates can conceal refused, malformed or interrupted answer streams. Actual provider incidence and aggregate production metrics UNTESTED, so PARTIAL.
- Recommended fix (not executed): Record terminal generation outcome at the existing stream completion owner, or explicitly name initial event transport acceptance and separately capture completion. Preserve enum-only/no-content diagnostics and correct time-to-headers metric; verify ordinary completed/refused/failed/cancelled stream health parity before an authorized change.
- Release blocker: No individually; ordinary operational diagnostics gap.


### F-209 — Minor / PARTIAL — Preserved memory recency uses day-only timestamps and can omit a fresh same-day correction
- Found by: SECOND SOURCE REVIEW2026-10-05; full donor memory manager reported and precise update/prompt/UI/trim ordering independently cross-checked. Conditional reuse, no memory mutation/runtime execution.
- Reproduction/cross-check: Ordinary source condition: more than six preferences inserted on the same day, then seventh preference updated later that day. Update writes only YYYY-MM-DD and replacement keeps insertion order; prompt sorts that day-only key and takes the first six, so fresh correction remains outside the advertised recent core selection. UI and trimming share the unresolved same-day order.
- Expected vs actual: Newest updated facts are selected/ordered by actual recency; actual same-day updates are indistinguishable and stable insertion order controls inclusion instead.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/memory/memory_manager.py:151-155,250-252,266-270,395-401 and100. Day-only timestamp plus stable sort loses within-day update order.
- User impact: Future adapted donor can omit a fresh preference correction from initial prompt and show misleading recent order. It remains retained in storage and may be retrievable through other paths; no irreversible loss claimed. Runtime/provider incidence UNTESTED/PARTIAL; distinct from F041 concurrent lost update.
- Recommended fix (not executed): Record precise sortable UTC update timestamps with legacy-date compatibility and deterministic ties. Preserve immutable original and verify same-day changes, core budgets, UI sorting and trim before separately authorized adaptation.
- Release blocker: Conditional donor memory fidelity gap only.


### F-210 — Major / PARTIAL — Chat saves partial text as a completed-looking answer after a terminal provider refusal
- Found by: SECOND SOURCE REVIEW2026-10-05; ordinary streaming UI/controller contract independently cross-checked. No provider/network/fault or concurrency execution performed.
- Reproduction/cross-check: Source condition: streamed nonempty text followed by ordinary provider/network refusal. use-chat accumulates partial answer and stores refusal, but only reports refusal in the empty-answer branch. Nonempty branch persists an ordinary assistant message with no incomplete/failure notice. Router explicitly emits refusal after partial output and normalized provider stream emits provider_failed on interruption.
- Expected vs actual: Retain visible delivered words with a clear interrupted/incomplete outcome and retry option; actual partial output becomes a normal saved assistant answer while terminal refusal is omitted from user status.
- Location/root cause: src/lib/chat/use-chat.ts:636-650,682-720; src/lib/intelligence/router.ts:133-162,195-197; src/lib/intelligence/edge-handler.ts:560-572. Refusal handling is conditional on empty accumulated answer rather than terminal stream outcome.
- User impact: Users can rely on silently truncated answers and later saved history presents them as ordinary completion. Actual provider/customer incidence UNTESTED/PARTIAL. Separate from F208 operator telemetry and F193 preserved donor transport; intentional user STOP needs distinct truthful handling.
- Recommended fix (not executed): Persist delivered partial text while exposing terminal refusal/incomplete status and appropriate retry; retain intentional user STOP semantics. Verify ordinary tokens-then-failure versus completed/empty/refused/user-stopped streams under separately authorized tests/change.
- Release blocker: Yes for truthful streamed answer completion; source contract confirmed, actual runtime/provider reproduction still pending.


### F-211 — Minor / PARTIAL — Preserved setup resolves requirements from caller directory instead of its own project
- Found by: SECOND SOURCE REVIEW2026-10-05; full donor setup reported and exact subprocess/requirements/HERE contract independently cross-checked. No setup, dependency installation, child process or asset mutation executed.
- Reproduction/cross-check: Ordinary invocation of the donor setup by absolute script path from another working directory. pip receives -r requirements.txt without an explicit cwd or absolute requirements path, so it reads caller-directory requirements or fails if absent. The script already computes HERE for its own assets; no chdir exists. Normal invocation from donor root is unaffected.
- Expected vs actual: Setup installs the selected project's own requirements regardless of caller working directory; actual requirements selection depends on unrelated caller directory.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/setup.py:21,27-29,74-76; HERE used for owned assets at60 but not requirements invocation. Relative input path lacks project ownership.
- User impact: Future adapted launcher/terminal setup can fail or install an unrelated requirements file. Actual installer/runtime incidence UNTESTED/PARTIAL; conditional preserved donor only.
- Recommended fix (not executed): Use HERE/requirements.txt or explicit owned subprocess cwd, preserving normal setup/assets behavior. Keep immutable donor and verify ordinary foreign/current directory command construction before any separately authorized installation.
- Release blocker: Conditional donor setup portability gap only.


### F-212 — Major / PARTIAL — Failed Library upload ignores compensating row-deletion refusal and leaves an unusable entry
- Found by: SECOND SOURCE REVIEW2026-10-05; ordinary Library save/rollback contract independently source-cross-checked. No storage upload, customer write, outage or authorization execution performed.
- Reproduction/cross-check: Source condition: Library index insertion succeeds, Storage upload fails, then compensating row delete returns an ordinary backend/transport error. Handler awaits but ignores deletion result and throws only original upload error. Retained index row references absent bytes and normal list includes it. No runtime fault injection/customer mutation executed.
- Expected vs actual: Failed save leaves neither row nor bytes, or reports and tracks a retryable repair state; actual rollback refusal is discarded and phantom index entry remains behind failed-save message.
- Location/root cause: src/lib/library/library.functions.ts:141-164, especially163; list61-71 and sign181-190. Index inserted before upload; compensation promise resolution is treated as successful removal without checking returned error. Pre-upload visibility interval is also source-observed but no additional impact counted.
- User impact: Persistent listed entry cannot open its missing object after a failed add, misleading users about Library contents and save outcome. Current outage/customer incidence UNTESTED/PARTIAL. Distinct from pagination F090 and deletion queue F098; no storage security claim.
- Recommended fix (not executed): Check compensation result and retain an explicit retry/repair state, or connect existing safe pending/sweep ownership with truthful listing. Verify ordinary upload-failure plus rollback-failure doubles before separately authorized product change.
- Release blocker: Yes for reliable truthful file retention/failed-save recovery; runtime cross-check pending.


### F-213 — Minor / PARTIAL — Preserved wake toggle commits enabled/asleep after detector start refuses
- Found by: SECOND SOURCE REVIEW2026-10-05; donor main and wake start readiness branches independently source-cross-checked. No detector/model/audio/runtime or preference mutation executed.
- Reproduction/cross-check: Ordinary source condition: model files/dependencies exist but model construction fails or is incompatible. Wake detector start returns False; _ui_wake_toggle persists enabled, ignores _ensure_wake_detector bool, marks assistant asleep and returns enabled. _wake_state can additionally substitute file readiness for detector readiness.
- Expected vs actual: Enable commits only after actual detector readiness, or explicitly reports degraded manual-only state; actual enabled/sleeping/ready-looking status can remain without a live detector.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/main.py:660,714-721; core/wake_word.py:44-60,137-144. Downloaded/dependency presence is conflated with live startup success and toggle discards the boolean.
- User impact: Future adapted wake user can put assistant asleep without functioning wake recognition; fallback WAKE NOW notification exists but does not make failed enable truthful. Actual local-engine/hardware incidence UNTESTED/PARTIAL. Distinct from F201 stale restart sentinel ownership.
- Recommended fix (not executed): Consume detector start result, commit enabled/asleep only when ready or label explicit degraded manual-only behavior; separate downloaded and running readiness. Preserve immutable donor and verify ordinary model-construction failure doubles before physical wake evidence.
- Release blocker: Conditional donor wake activation reliability gap only.


### F-214 — Minor / PARTIAL — Notification push read and final-status write failures become misleading delivery states
- Subscription-read extension2026-10-05: send.server.ts:160-165 ignores the subscription query error and treats null data as no opted-in browser, returning held. A backend read outage despite known subscriptions gets no failed/unavailable diagnostic or push attempt, and normal final-state write can persist held. Exact source cross-check; no customer/provider/database execution. Preserve genuinely empty subscription held behavior but distinguish failed reads and retry/diagnostics. Current incidence UNTESTED; same ordinary delivery-outcome reliability family, no extra count.

- Found by: SECOND SOURCE REVIEW2026-10-05 by root; ordinary delivery report and exact sender compensation/result update source cross-check. No notification, provider, database or customer write performed.
- Reproduction/cross-check: Source condition: selected available browser-push channel records initial sent through deliveryReport; actual pushToBrowsers then reports held/dead_letter, and ocade_set_notification_delivery RPC returns an ordinary error. Sender ignores this error and returns local new delivery while stored notification retains initial sent. No fault/runtime execution.
- Expected vs actual: History reflects acknowledged final provider outcome or explicit pending reconciliation; actual failed final-status persistence can leave sent for a refused/unsent notification.
- Location/root cause: src/lib/notifications/delivery.ts:65-71; src/lib/notifications/send.server.ts:86-106. Initial selection-derived sent is persisted before provider result; final update result.error is unchecked.
- User impact: Notification history can falsely claim browser push accepted despite failure/no subscribed browser. Current provider/backend incidence UNTESTED/PARTIAL. Distinct from email transport omission F079.
- Recommended fix (not executed): Use explicit pending outcome until provider completion and inspect/repair final-status write refusal with existing notification owner; verify ordinary failed-push plus failed-outcome-write fixtures before authorized change.
- Release blocker: No individually; truthful delivery history/reconciliation gap.


### F-215 — Minor / PARTIAL — Browser notification Off is reported after both deactivation acknowledgements fail
- Found by: SECOND SOURCE REVIEW2026-10-05; src reporter and root exact unsubscribe/UI outcome contract cross-check. No real subscription, RPC, provider, auth or security execution.
- Reproduction/cross-check: Source condition: existing subscription, unsubscribe RPC returns error and browser subscription.unsubscribe rejects or resolves false. turnPushOff ignores returned RPC error, swallows browser failure/false and returns off; caller sets toggle off and only reports thrown failure.
- Expected vs actual: Off reflects verified deactivation or explicit retryable partial/failure state; actual both backend and browser can remain active while UI reports off.
- Location/root cause: src/lib/notifications/push-device.ts:80-86; src/components/settings/NotificationsSection.tsx:172-182. Neither server result.error nor browser boolean/rejection is checked before off outcome.
- User impact: User can continue receiving browser alerts after choosing Off. Actual provider/browser incidence UNTESTED/PARTIAL; no account isolation or authorization failure alleged.
- Recommended fix (not executed): Inspect both deactivation results, reconcile actual remaining subscription and render truthful partial/error state with retry. Preserve intended unsubscription; verify ordinary false/error/success doubles before separately authorized change.
- Release blocker: No individually; notification preference outcome gap.


### F-216 — Minor / PARTIAL — Preserved live speaker exits silently on ordinary output failure while receive backlog remains unbounded
- Found by: SECOND SOURCE REVIEW2026-10-05; exact donor playback/receive/session task ownership independently source-cross-checked. Conditional reuse; no audio, provider, device or runtime execution.
- Reproduction/cross-check: Ordinary connected-session output write raises RuntimeError. _play_audio treats every such error as shutdown, breaks and closes normally; successful child completion does not cancel its TaskGroup siblings. Receive can keep adding audio to unbounded audio_in_queue with no remaining playback consumer.
- Expected vs actual: Actual output failure reports unavailable and triggers controlled session recovery/fallback with bounded backlog; actual sole consumer returns normally while connected receive/send/watch tasks continue.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/main.py:1711-1721,2101,2136-2146,1490-1491. Blanket RuntimeError shutdown classification loses genuine device/write failure and successful consumer exit has no supervisor/backlog bound.
- User impact: Future adapted live voice loses speech and can accumulate queued replies/resources. Runtime memory magnitude/native incidence UNTESTED/PARTIAL. Distinct from F086 separate donor TTS producer pipeline.
- Recommended fix (not executed): Distinguish shutdown cancellation from actual write failure, propagate failure to existing session recovery owner and bound/clear owned audio backlog. Preserve donor and verify ordinary failed/unplugged write doubles plus cleanup before physical audio proof.
- Release blocker: Conditional donor live-audio reliability/resource gap only.


### F-217 — Minor / PARTIAL — Preserved phone microphone relays while wake UI remains asleep without an explicit wake transition
- Found by: SECOND SOURCE REVIEW2026-10-05; donor phone/local microphone/typed-command state gates independently source-cross-checked. Conditional reuse only, no live permission, audio, network or security probe.
- Reproduction/cross-check: Source condition: already paired phone enables its microphone while desktop wake mode is Sleeping. Phone relay checks speaking/muted but not wake_enabled/awake before out_queue; local PC microphone and typed commands explicitly enforce asleep gate. Phone connection handler does not wake. Phone push-to-talk intent may differ, but no explicit wake transition/state contract is present in these branches.
- Expected vs actual: Shared sleeping behavior or an explicit documented phone push-to-talk wake transition with truthful status; actual phone stream can enter live send while UI remains asleep.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/main.py:1987-2008; compare1300-1312 and831-839; live send1289-1293. Phone relay bypasses ordinary shared sleep-state predicate without updating its owner.
- User impact: Future adapted voice status can differ by microphone path and responses may occur during Sleeping display. Intended phone push-to-talk policy/current native incidence UNRESOLVED/UNTESTED, so PARTIAL; no permission/account isolation claim.
- Recommended fix (not executed): Define shared phone/local sleep or explicit push-to-talk wake policy and transition UI/state before relay as appropriate. Preserve immutable donor and verify ordinary sleeping phone/local/text state parity before physical/provider evidence.
- Release blocker: Conditional donor voice-state consistency gap only.


### F-218 — Minor / PARTIAL — Unsaved notification preference claims to apply on this device although delivery reads only account state
- Found by: SECOND SOURCE REVIEW2026-10-05 by root; full preference sync and exact backend/UI/server consumers cross-checked. No preference, account, notification or provider mutation executed.
- Reproduction/cross-check: Ordinary preference save cannot reach the account and backend returns revision:null/error:null. saveNotificationPreferences returns session_only with 'This applies until you close this tab'; UI retains changed settings and labels local/session scope. Actual sends read account preferences in send.server.ts, and repository consumers show no local notification filtering/delivery owner using this session-only choice.
- Expected vs actual: Either session-only choice actually governs this device's notification presentation/delivery, or UI explicitly says it has not taken effect; actual unsaved form choice is promised as active while server continues persisted account/default policy.
- Location/root cause: src/lib/notifications/preference-sync.ts:110-132; supabase-backend.ts save catch; src/components/settings/NotificationsSection.tsx:77-93; send.server.ts:80-85,127-143. Session-only outcome has UI state but no operational consumer in the sole notification send path.
- User impact: Mute/quiet-hour/category change can appear effective locally despite failed save and unchanged notification behavior. Current customer/provider incidence UNTESTED/PARTIAL; no authorization or mandatory-alert suppression claim.
- Recommended fix (not executed): Report unsaved/not-applied truthfully unless an existing local presentation owner genuinely applies the choice; keep account synchronization and protected-category rules. Verify ordinary offline save and subsequent notification presentation before an authorized change.
- Release blocker: No individually; notification preference truthfulness gap.


### F-219 — Minor / PARTIAL — Preserved reconnect immediate-rebuild zero delay can remain zero through a later network outage
- Found by: SECOND SOURCE REVIEW2026-10-05; full donor main reported and every backoff reference/exact retry branches independently cross-checked. No provider, network, runtime or configuration operation executed.
- Reproduction/cross-check: Source condition: voluntary voice/device rebuild or rejected-handle retry sets self._conn_backoff=0; after reconnect an ordinary DNS/getaddrinfo failure uses min(previous*2,60), retaining zero, then sleeps zero before next retry. No successful-connect positive reset exists; API-key branch assigns a local _conn_backoff rather than the shared attribute.
- Expected vs actual: Immediate rebuild is separate from a positive bounded exponential outage delay, reset consistently after healthy connection; actual zero can persist through repeated network failures.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/main.py:2173,2191,2236,2240-2246,2265-2267. Retry state overloads immediate control-flow retry and error backoff; multiplication has no positive floor and reset targets are inconsistent.
- User impact: Future adapted donor can churn retries/logs/CPU during outage after ordinary reconnection. Actual frequency/provider resource magnitude UNTESTED/PARTIAL; current production reachability not established.
- Recommended fix (not executed): Separate immediate rebuild from positive retry budget, floor/reset ordinary outage backoff and consistently update the owned attribute. Preserve donor and verify ordinary rebuild-success-network-failure sequences with process/provider doubles before real runtime evidence.
- Release blocker: Conditional donor reconnect reliability/resource gap only.


### F-220 — Minor / PARTIAL — Committed message with lost acknowledgement appears twice while its local pending journal remains
- Found by: SECOND SOURCE REVIEW2026-10-05; exact ordinary pending/remote message reconciliation independently source-cross-checked. No database, network failure, account or security execution performed.
- Reproduction/cross-check: Source condition documented by the store: append commits but its response is lost, so local pending turn remains; subsequent transcript read succeeds before successful drain or after another retry fails. loadChatMessages concatenates remote records and waiting journal without shared-key deduplication. Remote read omits client_key, while pending temporary id is clientKey and saved id is database UUID.
- Expected vs actual: One visible/exported turn with accurate saved/pending state; actual same committed turn can appear as both saved remote and unsynced local until successful reconciliation.
- Location/root cause: src/lib/ocade-chat-store.ts:115-146,160-179,191-195; src/lib/ocade.functions.ts:163-177 omits client_key; use-chat.ts:347-355,395-400 independent read/flush and993-1000 export use merged records. Display merge discards existing common idempotency identity and blindly concatenates.
- User impact: Transient duplicate question/answer can reach transcript/export/model history until drain succeeds. Actual outage duration/customer incidence UNTESTED/PARTIAL; no duplicate database insert alleged. Distinct from journal replacement F095, durability F196 and same-account navigation F198.
- Recommended fix (not executed): Carry existing client_key through caller-owned reads and reconcile pending versus remote by that identity, keeping truly pending turns. Verify ordinary committed-response-loss/read-success and retry fixtures before separately authorized change.
- Release blocker: No individually; offline/online history reconciliation gap.


### F-221 — Minor / PARTIAL — Preserved Live reconnect labels generic1007 protocol errors as invalid API key
- Found by: SECOND SOURCE REVIEW2026-10-05; exact donor error branch and its own valid-key media-schema incompatibility comment independently source-cross-checked. No provider, protocol frame, key, reconfiguration or security execution.
- Reproduction/cross-check: Conditional source path: noncredential Live protocol/content exception containing1007 reaches reconnect branch after other optional retry branches. The code treats any1007 as API-key-invalid and prompts key re-entry. Its own send_realtime comment describes1007 from obsolete media_chunks schema rather than credential rejection. Exact current upstream incidence is unverified.
- Expected vs actual: Credential failures and ordinary protocol/content incompatibility have distinct diagnosis/recovery; actual generic numeric substring selects key-invalid guidance and reconfiguration.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/main.py:2228-2237; compare1284-1286. Substring1007 is used as credential proof without a typed/provider-auth failure check.
- User impact: Future adapted donor can request unnecessary key re-entry and obscure protocol diagnosis; existing setup rewrite F084 can further reset settings if that path is used. No current credential failure, provider response or settings loss reproduced; PARTIAL.
- Recommended fix (not executed): Classify explicit credential errors separately from transport/protocol content failures and preserve appropriate recovery guidance. Keep immutable donor and verify ordinary exception-classification doubles before separately authorized provider evidence.
- Release blocker: Conditional donor diagnostics gap only.


### F-222 — Minor / PARTIAL — Preserved vendor ZeroPadding unpad leaves an entirely zero-valued buffer unchanged
- Found by: SECOND SOURCE REVIEW2026-10-05; exact retained vendor function in disposable readable copy cross-checked with donor selected padding mode. Passive source only; no crypto/decryption/security or library runtime probe.
- Reproduction/cross-check: Source condition: positive sigBytes buffer whose bytes are all zero. ZeroPadding.unpad scans backwards and updates sigBytes only after a nonzero byte; if none exists the loop exits without changing length, unlike its ordinary trailing-zero removal path.
- Expected vs actual: Trailing-zero stripping treats an all-zero padded buffer consistently as zero remaining bytes; actual length remains unchanged. Zero-padding format itself is ambiguous for legitimate zero-suffixed content; this finding concerns the function's own edge-case behavior, not authentication or protocol safety.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/static/crypto-js.min.js:1, CryptoJS.pad.ZeroPadding.unpad; exact disposable formatted first-pass source work/support-crypto-formatted.js:1959-1974. Missing exhausted-loop sigBytes update. Donor app.html:186 selects Pkcs7, not ZeroPadding.
- User impact: Conditional unused vendor API returns inconsistent all-zero unpadding if later reused. No current dashboard/shipped call path, data corruption incidence or crypto vulnerability established; PARTIAL source evidence only.
- Recommended fix (not executed): Preserve immutable vendor/provenance; any separately authorized adapted dependency should verify supported API edge cases and an upstream-maintained replacement rather than silently editing the donor. Verify zero/nonzero/mixed boundaries and actual selected protocol compatibility first.
- Release blocker: No for current runtime; conditional unused vendor correctness edge case only.


### F-223 — Minor / PARTIAL — Preserved vendor Blowfish instances share expanded key tables across independently created ciphers
- Found by: SECOND SOURCE REVIEW2026-10-05; exact global table/reset/block branches in readable donor vendor source independently cross-checked. No encryption, decryption, key, security or library execution probe.
- Reproduction/cross-check: Passive source ordering: create instance A with keyA, then B with keyB, then continue A. Both reset routines write shared global H2 pbox/sbox and both block functions use that global, so A's later operations use last-created instance tables. Same-key reset cache can skip restoration. No computed ciphertext/runtime reproduction performed.
- Expected vs actual: Independent cipher instances retain their own expanded key state; actual global tables are overwritten by other instance reset.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/static/crypto-js.min.js:1, Blowfish global H2 and _doReset/encryptBlock/decryptBlock; exact disposable formatted support-crypto-formatted.js:3283,3304-3335,3340,3357. Global rather than instance-owned key expansion state.
- User impact: Conditional unused vendor API can return inconsistent cross-instance results if later reused. Current donor dashboard selects AES at app.html184-186 and no Blowfish consumers were found; no current deployed corruption or cryptographic vulnerability claim. PARTIAL source evidence only.
- Recommended fix (not executed): Preserve immutable vendor/provenance; verify an upstream-maintained per-instance implementation or avoid unsupported unused adapted surface under D028. Require actual supported protocol/byte compatibility and interleaved instance edge-case verification before separately authorized dependency adaptation.
- Release blocker: No for current runtime; conditional unused vendor instance correctness gap only.


### F-224 — Minor / PARTIAL — Recovery notification claims every session signed out despite a known revocation error
- Found by: SECOND SOURCE REVIEW2026-10-05; ordinary returned-error notification wording independently source-cross-checked. No recovery, credential, session, auth, SQL or security operation executed.
- Reproduction/cross-check: Source condition: factor-removal work proceeds but session revocation returns an error. Handler captures revokeError, then unconditionally attempts recovery notification saying 'Every session was signed out'; only afterward it returns the accurate partial failure that other sessions could not be signed out.
- Expected vs actual: Notification copy reflects acknowledged partial revocation outcome consistently with action response; actual definite success notice contradicts already-known returned error.
- Location/root cause: src/lib/security/recovery.functions.ts:174-190, especially182 and185-190. Notification is constructed/sent before branching on the captured revocation result.
- User impact: False reassurance/inconsistent retained notification can mislead recovering user about session cleanup. Notification persistence/delivery and actual hosted recovery incidence UNTESTED/PARTIAL; no takeover or revocation bypass execution claim. Distinct from F018 ignored factor-listing error.
- Recommended fix (not executed): Branch notification wording/send on acknowledged session revocation, preserving accurate completed factor-removal progress and unavailable response. Verify ordinary resolved-error/success notification payloads with doubles under separately authorized change.
- Release blocker: No individually; truthful recovery outcome messaging gap.


### F-225 — Minor / PARTIAL — Preserved donor file preview assumes selected files remain accessible during repaint
- Found by: SECOND SOURCE REVIEW2026-10-05; support donor UI read and root exact selection/render cross-check. Conditional donor reuse, no Qt execution or file mutation.
- Reproduction/cross-check: Source condition: select a valid local file, then it is removed, moved or inaccessible before the next repaint. _set_file retains its path; paintEvent invokes _paint_file whenever that path is truthy; unguarded path.stat raises OSError/FileNotFoundError.
- Expected vs actual: Unavailable selection produces an honest stale-file state and usable drop zone; actual exception escapes the paint callback before p.end. Native crash or later rendering behavior UNTESTED.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/ui.py:1172-1173,1190-1193,1201-1229,1257-1261. Render reads filesystem metadata without an error boundary or invalid-selection transition.
- User impact: Future donor adaptation can interrupt native attachment preview when ordinary filesystem availability changes. No current shipped native UI failure claimed.
- Recommended fix (not executed): In a separately authorized adaptation, catch metadata OSError and clear or mark selection unavailable, ensuring painter cleanup. Verify ordinary stale-selection doubles and real native repaint; preserve original donor.
- Release blocker: Conditional donor UI robustness gap only.

- Selection-slot corroboration2026-10-05: donor ui.py:4526-4533 also performs unguarded p.stat at4531 after a path is selected, so ordinary disappearance/unavailability can escape the native slot before preview state completes. Same conditional donor stale-file family; no filesystem/Qt operation and no new count.


### F-226 — Minor / PARTIAL — Preserved donor clipboard actions silently process only the first 800 characters
- Found by: SECOND SOURCE REVIEW2026-10-05; support UI read and root exact clipboard action/caller cross-check. Conditional donor reuse, no clipboard, Qt or model execution.
- Reproduction/cross-check: Source trace: retained clipboard text exceeds800 characters and user chooses Translate, Summarise, Explain or Fix. show_clipboard stores full text; _trigger formats command from only [:800]; downstream dispatch adds no truncation disclosure.
- Expected vs actual: Whole-selection processing or explicit processed-span/resource boundary; actual whole-text wording sends a silently truncated prefix. Preview ellipsis indicates only the58-character visual preview and does not disclose800-character processing limit.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/ui.py:2400-2404,2420-2430,5098-5102,5119-5121. Hard cap applied in command construction without an unavailable/partial state.
- User impact: Future adaptation can deliver incomplete translation, summary or grammar edits while user expects the copied selection. Clipboard remains intact; actual provider/native incidence UNTESTED.
- Recommended fix (not executed): Disclose bounded processed span or offer bounded chunking under separately authorized adaptation; preserve resource limits and original donor. Verify prefix/tail semantics with ordinary payload doubles and native UI later.
- Release blocker: Conditional donor completeness/UX gap only.


### F-227 — Minor / PARTIAL — Preserved donor plugin tests can overwrite newer configuration status with stale results
- Found by: SECOND SOURCE REVIEW2026-10-05; support donor UI read and root exact callback/worker cross-check. Conditional donor adoption, no plugin, Qt, provider or network execution.
- Reproduction/cross-check: Source condition: start slow TestA with configurationA, edit toB and start faster TestB. B completes, then A completes. Each click launches an unrestricted daemon with captured values; callback identifies namespace only and overwrites its status label. An old test can similarly overwrite Saved acknowledgement.
- Expected vs actual: Status belongs to current attempt/configuration or tests are serialized; actual last completion wins regardless of configuration age.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/ui.py:2604,2644-2652,2654-2688. No in-flight ownership, configuration version or attempt guard in emitted/completed status.
- User impact: Future adopted plugin settings can misleadingly report stale connection success/failure for newly entered settings. Race/native incidence UNTESTED; no present shipped plugin status claim.
- Recommended fix (not executed): Disable/serialize testing or tag attempt and configuration version and discard stale completions in separately authorized adaptation. Preserve original donor and verify ordinary reversed completion doubles before native integration.
- Release blocker: Conditional donor UI asynchronous-status gap only.


### F-228 — Minor / PARTIAL — Preserved donor desktop shortcut creation claims success without a usable verified launcher
- Found by: SECOND SOURCE REVIEW2026-10-05; support donor UI read and root exact platform/announcement cross-check. Conditional donor reuse, no shortcut, installation, process or settings action.
- Reproduction/cross-check: Windows source condition: pywin32 absent and wscript fallback returns nonzero without throwing; proc.wait result ignored and caller announces shortcut created without checking .lnk. Linux source condition: interpreter/script path contains spaces (tracked donor directory does); Exec concatenates unquoted tokens, changing launcher argv while creation announcement still succeeds.
- Expected vs actual: Success requires a correctly constructed verified launcher; failed generation is explicit. Actual Windows nonzero exit is accepted and Linux path boundaries are lost.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/ui.py:3293-3342,3444-3450,3517-3533. Fallback lacks status/artifact validation and Linux desktop Exec lacks argument quoting/escaping.
- User impact: Future adopted desktop shortcut can be absent or unable to launch despite success log. Native execution remains UNTESTED; distinct GUI shortcut flow from scheduled script quoting F175.
- Recommended fix (not executed): Check fallback returncode and generated artifact, encode desktop Exec arguments per platform rules in a separately authorized adaptation. Verify clean absence/failure and spaces/non-ASCII paths; preserve original donor.
- Release blocker: Conditional donor launcher correctness gap only.
- Autostart corroboration2026-10-05: donor ui.py:4636-4653 repeats unquoted Linux Exec={sys.executable} {script} at4646 then announces enabled4653. Spaces in the canonical donor script path similarly break launcher argv. Same conditional donor launch-fidelity family; no login-entry, registry, install or filesystem change and no new count.


### F-229 — Minor / PARTIAL — Preserved donor customization reopening leaves unsaved preview active after Cancel
- Found by: SECOND SOURCE REVIEW2026-10-05; support UI read and root exact preview/replacement/cancel cross-check. Conditional donor reuse, no Qt/theme mutation.
- Reproduction/cross-check: Source ordering: open customization, preview changed hue without Apply, reopen customization, then Cancel without editing new dialog. Reopening hides old overlay without reverting its palette; new dialog initializes selection and initial hue identically from saved configuration, so its Cancel equality check skips restoration.
- Expected vs actual: Cancel restores saved theme after an abandoned preview; actual stale unsaved global palette remains until another update or restart. Native UI incidence UNTESTED.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/ui.py:1693-1695,1798-1802,4929-4957. Replacement bypasses prior preview cleanup and new dialog does not own the retained palette mutation.
- User impact: Future donor UI adaptation can display a theme inconsistent with saved settings despite Cancel. No current shipped customization failure claimed.
- Recommended fix (not executed): Revert or deliberately transfer pending preview before replacing its dialog; centralize narrow close/reopen ownership in separately authorized adaptation. Verify reopen/Cancel and Apply sequences; preserve original donor.
- Release blocker: Conditional donor preview-state correctness gap only.


### F-230 — Minor / PARTIAL — Preserved donor phone-connected callback manipulates Qt widgets from its background event loop
- Found by: SECOND SOURCE REVIEW2026-10-05; support UI read and root exact event-loop/callback/GUI ownership cross-check. Conditional donor reuse, no phone connection, session, Qt or auth execution.
- Reproduction/cross-check: Source trace: main starts asyncio dashboard in runner daemon while Qt mainloop remains on main thread. Dashboard invokes connected callback directly; it calls UI facade, window method, then RemoteKeyOverlay.mark_connected, directly stopping timer and updating labels. No Qt signal marshals this path to GUI owner.
- Expected vs actual: GUI/timer updates run on their Qt owning thread; actual callback executes widget methods from background asyncio worker despite Call from any thread comment.
- Location/root cause: imports/ocade-jarvis/source-original/ocade jarvis 25-09/ui.py:2865-2883,4543-4545,5368-5369; main.py:2006-2008,2073-2076,2272-2281; dashboard/server.py:579-580,613-614,651-652. Direct callback crosses GUI thread boundary without queued signal/slot.
- User impact: Future adopted phone status UI may warn, fail rendering or destabilize Qt. Exact native warning/crash incidence UNTESTED; no current shipped dashboard failure claimed.
- Recommended fix (not executed): Route connected indication through existing Qt queued signal/slot ownership and guard overlay lifetime under separately authorized adaptation. Verify ordinary callback thread/lifetime doubles and native status later; preserve original donor.
- Release blocker: Conditional donor native UI thread-ownership gap only.


### F-231 — Minor / PARTIAL — Archived UI clears a second draft while its previous answer is pending
- Found by: SECOND SOURCE REVIEW of full archived App and InputBar members; conditional prototype correctness evidence only.
- Reproduction/cross-check: In preserved imports/UI OCADE JARVIS.zip, submit A; before its900-1600ms canned answer finishes, type B and press Enter or Send. Cross-check App sendMessage guard79, timeout91-102, onSend201 and InputBar Enter26-30/button68-72. Both controls remain enabled for a nonempty B while isTyping is true, and caller unconditionally clears the input after sendMessage returns. No archived browser build/launch or provider request executed; actual UI incidence UNTESTED.
- Expected vs actual: An unavailable send should retain B or queue it. Actual source returns at isTyping guard without appending B, then setInput('') discards B; only A receives an answer.
- Location/root cause: ZIP member src/App.tsx:78-102,198-203; src/components/InputBar.tsx:26-30,68-72. App owns busy state but InputBar receives no busy prop and unconditional caller clearing does not distinguish accepted/rejected sends.
- User impact: An adapted prototype can silently lose a user's new draft during pending output. Distinct from F043 inert/canned controls; no current shipped Chat regression claimed.
- Recommended fix (not executed): Preserve immutable archive. In any separately authorized adaptation, clear only an accepted draft and reflect busy send state or queue policy in both keyboard and button paths; verify a second draft during pending response remains available.
- Release blocker: No current release blocker solely from immutable prototype; verify before adaptation.


### F-232 — Minor / FAIL — Archived Orb graph uses negative angular distances for nodes beyond one revolution
- Found by: SECOND SOURCE REVIEW plus bounded pure arithmetic cross-check; no graph/UI execution or production defect claim.
- Reproduction/cross-check: Read complete archived OrbCanvas graph construction. spiralPt uses unwrapped PHI_ANGLE*i; buildGraph computes min(abs(ai-aj),2*pi-abs(ai-aj)). For k0/k3 delta7.199889689185959 yields negative minNorm about-0.9167 despite correct wrapped distance about0.9167, above0.28 threshold; radial distance is below70. Ordinary Python arithmetic cross-check confirms false proximity acceptance before the random0.55 gate.
- Expected vs actual: Angular proximity is a nonnegative shortest circular distance; k0/k3 fails0.28 cutoff. Actual unwrapped differences over2*pi produce negative distances and pass cutoff, connecting unrelated angular positions whenever other gates pass.
- Location/root cause: imports/UI OCADE JARVIS.zip member src/components/OrbCanvas.tsx:44-50,71-74,97-112 (spiralPt/buildGraph). Subtraction from2*pi assumes input already normalized to one revolution; construction violates that assumption.
- User impact: Preserved prototype can show unintended dense cross-connections and extra per-frame edge drawing. Actual rendered/mobile performance UNTESTED; no current served Orb regression claimed.
- Recommended fix (not executed): Preserve archive; any authorized adaptation should normalize angular difference modulo2*pi before the shortest-distance comparison and verify near-wrap/multiple-revolution graph pairs and bounded edge cost.
- Release blocker: No current release blocker solely from immutable prototype.


### F-233 — Minor / PARTIAL — Archived Orb draws edges and nodes in different canvas coordinate spaces on high-DPI displays
- Found by: SECOND SOURCE REVIEW and coordinate arithmetic, cross-checked against full OrbCanvas and canvas CSS; rendering UNTESTED.
- Reproduction/cross-check: Inspect archived canvas resize270-271: bitmap dimensions equal CSS dimensions times DPR, with no ctx.scale/setTransform anywhere in the complete member. Edges467-468 use projected bitmap coordinates, while nodes502/507/523, labels539 and orb544-546 divide positions by DPR before drawing on that same bitmap. CSS345-350 sets width/height100%. For CSS width800/DPR2, core edge endpoint is bitmap800 displayedCSS400, while orb center bitmap400 displaysCSS200. No browser/emulator launch or screenshot claimed.
- Expected vs actual: Nodes, connecting edges and central orb share one consistent coordinate system at DPR1/2/3. Actual source positions diverge by DPR; hover calculation414-416 follows edge projection rather than the visible divided node positions.
- Location/root cause: imports/UI OCADE JARVIS.zip: src/components/OrbCanvas.tsx:268-275,290-301,414-418,467-468,492-523,539,544-546; src/index.css:345-350. Mixed bitmap/CSS coordinates without context transform.
- User impact: An adapted prototype can show displaced graph/orb and inaccurate hover hit targets on high-DPI PC/mobile displays. Current production Orb is separately implemented; no current release regression claimed.
- Recommended fix (not executed): Keep immutable original. In an authorized adaptation, choose CSS coordinates with one DPR transform or use bitmap coordinates consistently, and verify aligned edge endpoints, orb center, hit targets and resize at multiple DPRs.
- Release blocker: No current release blocker solely from immutable prototype; adaptation fidelity requires verification.


### F-234 — Minor / PARTIAL — Archived Orb tooltip retains its old anchor while the hovered node moves
- Found by: SECOND SOURCE REVIEW of complete archived OrbCanvas; animation behavior inferred from explicit state update guard, no rendered incidence claim.
- Reproduction/cross-check: Hover a message node, then let spin/physics move it while cursor remains within its hit radius, or zoom/pan while it remains closest. draw recalculates closestSX/SY every frame410-424, but setHovered copies coordinates only when closestId changes426-435. React tooltip uses retained hovered.sx/sy at637; tooltipStyle621-629 reads no current projection.
- Expected vs actual: Tooltip anchor follows its currently hovered node. Actual source keeps the first coordinates until closest identity changes, despite every-frame projection updates.
- Location/root cause: ZIP member src/components/OrbCanvas.tsx:309-318,363-395,405-435,621-637. Identity-only state invalidation omits changed anchor coordinates.
- User impact: Conditional adapted prototype can display a detached tooltip during animation/zoom/pan. Exact native/browser incidence UNTESTED; separate from F233 DPR-space mismatch.
- Recommended fix (not executed): Preserve archive. Any adaptation should track the current projected anchor with bounded updates or direct owned positioning, while retaining hover clearing, cleanup and reduced-motion handling; verify same-node motion and resize.
- Release blocker: No current release blocker solely from immutable prototype.


### F-235 — Minor / PARTIAL — Archived color panel is clipped at a narrow mobile viewport
- Found by: SECOND SOURCE REVIEW and bounded layout arithmetic; no archived mobile browser rendering claimed.
- Reproduction/cross-check: At320px viewport, CSS sidebar width/min-width52 leaves268px main content. Theme panel width280/right18 requires298px. With main overflow:hidden, its computed left offset is-30px before any extra constraints. Cross-check full887-line stylesheet: no responsive media query/width clamp; App mounts panel inside jarvis-main209-215.
- Expected vs actual: Color controls remain fully visible/reachable on supported narrow viewport. Actual fixed panel extends beyond clipped main content; nominal panel left30px is outside that box.
- Location/root cause: imports/UI OCADE JARVIS.zip: src/index.css:186-188,327-335,768-780; src/App.tsx:209-215. Fixed280px panel plus18px inset exceeds narrow container, with no responsive override.
- User impact: A future adapted mobile prototype can clip customization controls. Actual touch/browser/Apple layout is UNTESTED; no current production responsive regression claimed.
- Recommended fix (not executed): Preserve original. Future authorized adaptation should bound panel width/insets to its container and verify320/360px, zoom, long content and keyboard access before integration.
- Release blocker: No current release blocker solely from immutable prototype.


### F-236 — Minor / PARTIAL — Archived animated UI ignores reduced-motion preference
- Found by: SECOND SOURCE REVIEW of all archived App/Orb/CSS/site config members, passive preference-consumer cross-check.
- Reproduction/cross-check: Set an environment's prefers-reduced-motion preference in a future prototype test. Full OrbCanvas draw loop changes spin/physics and always requests another animation frame309-318,363-395,610-618; fullCSS includes infinite voice/typing animations431/627/706 and entry transitions without a reduced-motion media rule; ChatArea16 always scrolls smoothly. Site configuration accessibility.ignoreReducedMotion=false is not consumed by its vite plugin configuration type72-74 or runtime sources. No preference setting/native/browser session altered here.
- Expected vs actual: Reduced-motion preference can suppress nonessential continuous/entrance motion and smooth scrolling. Actual archived sources have no preference branch or stylesheet override, despite scaffold configuration declaring ignoreReducedMotion:false.
- Location/root cause: imports/UI OCADE JARVIS.zip: .figma/make/site.json:6-9; vite.config.ts:72-74; src/components/OrbCanvas.tsx:309-318,610-618; ChatArea.tsx:15-17; src/index.css:431,459,527,627,706,781. Runtime animation ownership is independent of unused configuration flag.
- User impact: An adapted prototype may impose unwanted continuous motion on sensitive users and spend resources while animation is unnecessary. Actual preference/device behavior UNTESTED; current production paths separately reviewed.
- Recommended fix (not executed): Keep immutable provenance. An authorized adaptation should share actual preference state between CSS, canvas scheduling and scroll behavior, retaining voice feedback in a static accessible form; verify preference changes, cleanup and mobile resource use.
- Release blocker: No current release blocker solely from immutable prototype.


### F-237 — Minor / FAIL — Preserved historical audit still labels its whole record read-only despite embedded product fixes
- Found by: SECOND SOURCE REVIEW of dated historical audit; internal documentation consistency only, no new product change or runtime claim.
- Reproduction/cross-check: Compare docs/audits/2026-09-27-jarvis/OCADE-JARVIS-ERROR-AUDIT-01.md:114 ('No product source ... changed') with its embedded sections1901-1938 FIXED/implemented,2010-2027 dependency and runtime/test edits,2066-2076 changed test location,2096-2101 fixed uninstall,2150-2155 source-fix packaging. Top scope12-17 clarifies that later consolidation did not alter pre-existing modifications, but does not qualify the embedded master Mode statement as applying only to the initial audit phase.
- Expected vs actual: Historical evidence describes the scope and phase of mutations accurately. Actual preserved master header gives an unqualified no-product-change label while that same record explicitly documents implemented runtime/dependency/test/build fixes. Specific implementation evidence is retained, so no concealed or unauthorized current mutation is inferred.
- Location/root cause: Historical OCADE-JARVIS-ERROR-AUDIT-01.md:114 versus1904/1938,2013/2022-2027,2072-2076,2099/2101,2153-2155. Initial phase header was not scoped when later remediation evidence was appended/consolidated. The original preserved current-main-master-ledger-2026-09-26.md:8 contains the same unqualified Mode label; full mapped review confirms the same embedded fixes.
- User impact: A reviewer relying on the mode header can misclassify historical artifact provenance or mistake past remediation for this strictly read-only audit. Current f277408 work changes only the two allowed ledgers.
- Recommended fix (not executed): Under separately authorized historical-document work, add a dated phase clarification preserving original wording and exact evidence, distinguish initial audit/consolidation from intervening implementation, and cross-check reported SHAs/artifact lineage; no rewrite performed.
- Release blocker: No current product release blocker solely from historical phase-label ambiguity.


## Release blockers and totals

Recorded findings: Critical 0, Major 69, Minor 166; total 235. Findings: FAIL 110, PARTIAL 125. Counts include conditional preserved-donor and historical documentation defects; they are not all current-runtime release blockers. Coverage remains incomplete. Current readiness: **NOT RELEASE-READY** in checked wake, STOP, attachments, offline history, operator diagnostics and other explicitly marked blocker paths; whole-product readiness is not fully assessed.

## Resume checkpoint

Audit checkpoint2026-10-05: first pass974/974 complete; second pass562/974 complete (57.7%),412/974 remaining (42.3%), all BLOCKED; zero ordinary PENDING paths. Final ledger structure/count/inventory checks pass:235 unique findings (Critical0/Major69/Minor166;FAIL110/PARTIAL125),51 unique debloat opportunities,974 exact baseline inventory paths and88 root second-read hashes verified. Available independent ordinary work is exhausted. Remaining security-review dispatch, physical Apple/Android, active native control/voice/background, real customer/provider/account-isolation and privileged deployment evidence remains explicitly unavailable or untested. Whole requested audit is INCOMPLETE and NOT RELEASE-READY; no completion claim, commit, merge or push.

Disposable harness closure: interrupted only owned exec session54383; process exited after Ctrl+C. Subsequent passive listener inventory found no listeners on owned fixture ports8788/54321. No other process was stopped. Automated resume configuration was already PAUSED when inspected; no new automation or automatic-review workaround created.

Stop point: both ledgers reconciled against available source and evidence; latest HEAD/origin/main verified f277408aaaf5381c949bb62119d84f7fa57ffb09, tracked/cached product diffs empty and only the two allowed ledgers untracked. Ledger-only publication remains conditional on the user's entire-audit completion requirement, which is not met. Resume only newly available legitimate evidence; preserve completed inspections and do not retry rejected workflows.
