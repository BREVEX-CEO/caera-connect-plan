# OCADE product and interface requirements

This is the product authority: customers, boundaries, journeys, pages and options. [PLAN](../PLAN.md) alone orders implementation. [Design](JARVIS_DESIGN_SYSTEM.md), [architecture](ARCHITECTURE.md), [security](SUPPORT_LEGAL_SECURITY.md) and [testing](TESTING.md) own their respective contracts. Requirements below are targets, not claims they have shipped. Inspected source baseline: `f521e23529542d709a9627181341b0e904a8b0c3`.

## Product decision

CARCC is the company; OCADE is the product. OCADE is a website-first assistant that performs useful work on a customer's authorised computer and checks the result. Keep Chat and JARVIS separate, sharing account, Library, settings and visual language. Do not add separate Code, Projects, marketplace or automation-dashboard products for the initial release.

The initial activation audience is **Indian students and individual professionals** (latest binding owner decision). A small Windows/Office professional-operations cohort is a **prospective paid pilot**, not the only market. First-value proof is one naturally phrased request crossing multiple *installed* local PC applications, beginning with Excel → editable Word/PDF. Preserve three earlier validated-workflow hypotheses and evaluate paid repetition empirically. Perfect three repeatable workflows:

1. **Weekly spreadsheet reconciliation and report:** inspect the supplied workbook, reconcile agreed fields, preserve formulas/formatting and originals, save an editable copy, reopen it in installed Excel where applicable, verify totals and explain discrepancies.
2. **Client document and PDF pack:** assemble approved templates with supplied facts, preserve editable documents, generate PDFs, verify required sections/page rendering and deliver a named output folder. Sending to a client is a separate authorised action.
3. **Authorised browser status collection and local report:** collect permitted records from authenticated sites, record source/time and missing entries, reconcile the local report and verify the saved result. Hand authentication/access restrictions to the user; stop before final payments.

These are launch priorities, not hard-coded application controllers. Extend common discovery, broker and verification owners; retain specialised adapters only for measured fidelity, safety or latency advantages. Preserve useful donor capability and immutable provenance; a reuse percentage never justifies unsafe activation.

## Permanent product boundaries

- JARVIS uses server-side Online intelligence. Answer ordinary questions without artificial tasks; execute explicit work through the canonical broker. Never silently switch JARVIS to Chat Offline Intelligence.
- Chat retains Auto, Online and Offline. Preserve the approximately 0.6B browser model, OPFS persistence and ordinary update/reload survival. Installation is optional, never blocks first online use and discloses size/compatibility. Repair interrupted/corrupt bytes without unnecessary full reinstallation.
- Ordinary websites cannot control arbitrary native programs. Deep PC work requires the paired Device Agent; Android local control requires the installed companion and legitimate OS permissions. No mandatory browser extension or app-store dependency.
- Windows uses one tray presence. Android may use an optional floating bubble. iPhone/iPad use Safari/PWA, implemented Apple-sanctioned integrations and Remote PC; no system-wide overlay/arbitrary local-control promise. macOS native claims require actual platform proof.
- Users choose outcome, device and scope, not execution engines. Capability discovery does not grant permission. Page/document/model content cannot authorise actions.
- Preserve human authentication, scoped files, recoverable edits, server/RLS account isolation, reasoned privileged audit and immediate revocation. Never extract saved password/cookie stores or complete final purchases/payments. Screenshots are transient unless explicit retention is authorised.
- A model statement, click, HTTP response or file existence is insufficient completion evidence. Show verified, partial, failed, stopped or uncertain outcomes honestly. Reconcile uncertain external mutations before retry.

## Navigation and every route

Keep exactly **three primary customer destinations: Chat, JARVIS, Library**. Settings and Help are utilities. Owner Console/Staff Console appears only for server-authorised roles inside normal `ocade.in`; do not restore the retired admin origin. Keep existing `AppShell`, deep links and browser history. Settings is a dialog/sheet, not a new route.

Desktop: collapsible sidebar, readable conversation column, contextual task details. Phone: one navigation sheet and composer above keyboard/safe area, no duplicate bottom navigation. Signed-out root remains Chat with a short product explanation, three workflow examples, sign-in and truthful platform note; no competing marketing application or forced installation tour. Returning users reach their work promptly.

| Page / route                       | KEEP                                                                                                              | REMOVE / MERGE / ADD                                                                                                 | Final layout; code owner and acceptance                                                                                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat `/`                           | Transcript/history, attachments, dictation, modes, temporary chats, export, message actions                       | MERGE secondary Research/Thinking/Temporary into More; ADD honest attachment/mode mismatch and first-use explanation | History sidebar, transcript, one composer. `src/routes/index.tsx`, `src/components/chat/ChatWorkspace.tsx`, `ConversationList.tsx`, `MessageList.tsx`; test replay/edit/regenerate, attachment fidelity and Stop |
| JARVIS `/ocade-jarvis`             | Conversation, real Orb, current task, voice, target device, Stop/Take Over                                        | ADD result evidence and failed-state-read UI; dim decorative content during work                                     | Transcript + task card + expandable detail; `src/routes/ocade-jarvis.tsx`, `src/jarvis/JarvisWorkspace.tsx`, `JarvisPanels.tsx`, `JarvisTask.tsx`, `Orb.tsx`; lifecycle/reconnect tests                          |
| Library `/library`                 | All/Images/Files, search, Add, Open, Download, deletion                                                           | ADD reachable older results and receipt-backed output detail; confirm irreversible individual deletion               | Search/filter header and accessible file list; `src/routes/_authenticated/library.tsx`; failed versus empty read, authorised download and actual deletion outcome                                                |
| Console `/admin`                   | Customers/Cases/Staff/System/Audit, role filtering                                                                | No fake payment/revenue modules; no customer duplicate console                                                       | Search-led tables/detail panels; `src/routes/_authenticated/admin.tsx`, `src/components/admin/ConsoleModules.tsx`; real role/proof/revoke/audit tests                                                            |
| Sign in `/auth`                    | Google/email-code primary methods, configured password fallback                                                   | Keep failure/retry and destination; no provider selection                                                            | Narrow auth shell; `src/routes/auth.index.tsx`, `src/components/shell/AuthShell.tsx`; configured/unavailable methods                                                                                             |
| Verify `/auth/verify`              | Code, resend, change address                                                                                      | Prevent duplicate submit/stuck resend; preserve cooldown/error                                                       | Paste-friendly labelled input; `src/routes/auth.verify.tsx`; wrong/expired code and retry                                                                                                                        |
| Callback `/auth/callback`          | Completion and safe recovery                                                                                      | No settings; retry/sign-in only on failure                                                                           | Status screen; `src/routes/auth.callback.tsx`; malformed/expired and supported callbacks                                                                                                                         |
| MFA `/auth/challenge`              | Authenticator and recovery code                                                                                   | No bypass; preserve human proof                                                                                      | Single challenge/method switch; `src/routes/auth.challenge.tsx`; valid/invalid/reused proof                                                                                                                      |
| Recovery `/reset-password`         | New/confirm password, visibility/result                                                                           | Require verified recovery session; no fragment-only authority                                                        | Auth shell; `src/routes/reset-password.tsx`; forged/expired links and sign-in after reset                                                                                                                        |
| Help `/help`                       | Search, eight topics, FAQ, Back to top                                                                            | Search answers as well as questions; ADD real verified support destination                                           | Search then relevant answers; `src/routes/help.tsx`; answer-only query, keyboard accordion, no contact loop                                                                                                      |
| Pricing `/pricing`                 | Honest availability, limits, currency/cadence, sign-in                                                            | SIMPLIFY launch to Free + one paid pilot after billing approval; POSTPONE purchasable Max/weekly until real          | Compact comparison; `src/routes/pricing.tsx` and its existing pricing imports; preserve existing entitlements, no fake checkout/savings                                                                          |
| About `/about`                     | CARCC/OCADE identity and scope                                                                                    | SIMPLIFY founder-heavy content to purpose/company/support                                                            | Three factual sections; `src/routes/about.tsx`, `src/components/shell/PublicPage.tsx`                                                                                                                            |
| Privacy `/privacy`, Terms `/terms` | Necessary legal text and navigation                                                                               | Never delete obligations for visual cleanup                                                                          | Readable document; `src/routes/privacy.tsx`, `terms.tsx`, `src/components/legal/LegalContent.tsx`, `legal-document-meta.ts`; factual/legal review, links and consent-version consistency                         |
| 404                                | Open Chat                                                                                                         | REPLACE blanket data-safety assurance with “We could not find this page”                                             | `src/routes/__root.tsx` `NotFoundComponent`; unknown route signed-in/out                                                                                                                                         |
| Route/panel error                  | Retry/Open Chat and isolated fallback                                                                             | No raw stack/provider text or unsupported claim work stopped                                                         | `src/routes/__root.tsx` `ErrorComponent`, `src/components/shell/ErrorBoundary.tsx`; thrown errors, retry, retained draft                                                                                         |
| Root/authenticated layouts         | Providers and access boundary                                                                                     | Not navigation destinations                                                                                          | `src/routes/__root.tsx`, `src/routes/_authenticated/route.tsx`; redirects/focus/account switch/offline shell                                                                                                     |
| Machine endpoints                  | `/agent/$file`, `/api/jarvis/continue`, `/api/jarvis/device`, `/api/jarvis/enroll`, `/api/offline/bytes/$release` | No customer navigation entries                                                                                       | Matching `src/routes/agent.$file.ts` and `src/routes/api/` files; architecture/security owns protocol                                                                                                            |
| Crawler endpoints                  | `/robots.txt`, `/sitemap.xml`                                                                                     | Reconcile stale route hints after review                                                                             | `src/routes/robots[.]txt.ts`, `sitemap[.]xml.ts`; public-route alignment                                                                                                                                         |

The 23 route files include layouts/endpoints. There are no standalone Settings, Devices, Activity, Security, Personalisation, Offline, Setup, Code or Projects routes to delete.

## Exact option ownership

### Chat: five composer groups

**Message/Send-or-Stop; attachments; dictation; mode; More.** More owns Research, Thinking and Temporary where supported; active options become removable chips. Explain unavailable combinations rather than silently changing the request. Attachment add/paste/reorder/remove preserves original bytes and distinguishes pending/failed/ready. History keeps New, search, archived visibility and Rename/Archive/Export/Delete. Messages retain Copy, user Edit/Delete and assistant Regenerate/Delete with correct transcript ownership. Clipboard/download failure is not success. Do not duplicate JARVIS controls in Chat.

### JARVIS panels

- **Conversations:** New, select, search where useful, latest task outcome, confirmed delete. Tasks stay attached to conversations.
- **Activity:** task/action history and scheduled work removal. MERGE into conversation task history only after schedules, cross-task events, retention, pagination and deep links remain reachable; until then retain the current third rail item. No second execution authority.
- **Devices:** connection/status/last seen, target, Remote PC Open/Stop, removal and policies. Keep browser/own-browser/apps/files/commands/screen/mouse-keyboard plus Background/Scheduled/Co-work permissions. Put rare choices under Advanced; unsupported desktop controls must not appear usable on Android. Website allow/deny and per-device app Always/Ask/Never remain inspectable/revocable even after contextual consent replaces a prominent Allowed Apps concept.
- **Permissions:** master JARVIS/browser/own-browser/memory retain backend semantics. Move orb colour to Appearance. Simplification never broadens consent/defaults.
- **Task:** current action/device/state; Stop whenever work may still execute; Take Over while foreground automation owns control; Continue after re-observation; Retry after reconciliation; Allow/Decline for necessary consent. Display “Stopping…” until authoritative acknowledgement and “Stop not confirmed” with local-stop recovery after timeout.
- **Result:** receipt-backed checks, location, limitations, Open/Download. Partial/uncertain is distinct from verified complete; generated text is not a receipt.
- **Live browser/Remote PC:** task/device identity, capture time and stale/disconnected state. Failed refresh may retain only explicitly labelled stale imagery, never “currently sees” without freshness evidence.

### Exactly five Settings sections

Keep `src/components/settings/settings-panel.tsx` as category owner and existing components/identity-proof dialog. No second settings router/framework.

| Section                | Exact groups/options                                                                                                                                                                      | Implementation owner and change                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Account**            | Identity and supported profile fields; email change; linked methods/unlink; Sign out; typed-confirmation Delete account                                                                   | `settings-panel.tsx`, `SignInMethods.tsx`; MOVE MFA/recovery to Privacy & Security; no invented editable fields                                                           |
| **Appearance**         | Dark/Light; Reduce motion; High contrast; Show JARVIS bubble; Advanced Orb accent/reset within approved tokens                                                                            | `settings-panel.tsx`, `src/lib/appearance.tsx`, `src/jarvis/preferences.ts`, `JarvisPanels.tsx`; one preference authority                                                 |
| **Notifications**      | Device push; Task results; Product updates; Quiet hours with effective schedule; protected Security and Account/Recovery explanations; channel availability; recent notices/Mark all read | `NotificationsSection.tsx`, `src/lib/notifications/categories.ts`; consolidate optional master/category hierarchy, preserve backend policy; never false sent/read success |
| **Privacy & Security** | MFA setup/confirm/disable; recovery create/view/copy/download; sessions/revoke one/revoke others; conversation/library deletion; export; Offline status/install/remove/repair             | `TwoStep.tsx`, `AdvancedSection.tsx`, `DataControlsSection.tsx`; latest mutation errors visible, security proof preserved                                                 |
| **Billing & Usage**    | Plan; Chat/JARVIS allowances/reset; grant expiry; offline allocated capacity; registered offline browsers/remove; See plans; real portal only when implemented                            | `BillingSection.tsx`, `UsageSection.tsx`; retain entitlement authority and distinguish offline browser allocation from native execution device                            |

Options are capability-dependent, not all simultaneously visible. Sign out/account deletion, native device removal/offline browser removal/local-model removal have distinct consequences. Never show an unavailable payment portal or native feature as working.

## Setup, return and platform journeys

**First task:** open website → sign in when account authority is required → describe outcome → connect computer only if needed → confirm target/scope → execute → verify → open result. Native setup has three stages **Install, Pair, Verify readiness**, each with one primary action and resumable state. A website cannot silently install software or grant OS permissions.

**Return/reconnect:** restore account-scoped preferences, recheck device/permission/liveness and reconcile durable task state. Do not silently select another computer or replay a save/submit because acknowledgement was lost. Offline/revoked targets give a specific remedy.

**Windows tray:** Ready/Working/Waiting/Paused/Stopping/Offline; Open OCADE, Stop, Pause/Resume, work folder, Exit. No mandatory desktop mini-window. Exit/uninstall stops owned work and removes/revokes local authority according to security policy.

**Android:** one Set up OCADE action starts verified official-APK installation and guided returns from OS screens. Request overlay/accessibility/notifications/microphone/background permissions only for needed capabilities. After setup: readiness, Wake, Stop, Remove. Bubble collapsed shows OCADE/state; expanded provides ask/voice, task/Stop and Open full JARVIS. Drag/snap cannot hide Stop or survive revoked permission incorrectly. Complex settings remain in the main UI.

**Apple:** distinguish local web abilities from paired-PC work. Present Shortcuts/App Intents/share capabilities only when implemented/tested; browser-engine tests are not physical/native proof.

## Voice and conversational continuity

Reuse `src/jarvis/use-voice.ts`, `JarvisTask.tsx` `VoiceBar`, workspace/bubble integration and existing native owners. There must be one microphone/session owner, never competing speech services. Current browser recognition delivers final results and deliberately stops while browser speech synthesis speaks; this is **not proven natural spoken barge-in**.

Target states: Off, Starting, Listening, Processing, Speaking, Paused, Error. Text remains available. End/sign-out/route departure/revoked permission releases microphone/audio/timers; idempotent Start and generation checks prevent stale callbacks reviving a session. Handle speech-output error/cancellation as well as `onend`; bounded retry cannot reopen the microphone after End.

Keep Interrupt available during speech and task Stop independent of voice/model service. Spoken Stop uses the local safety path wherever recognition is active. Full-duplex barge-in requires echo/VAD/permissions/device proof before claiming support; retain explicit Interrupt as baseline. Native wake uses the bundled signed model; browser wake requires verified on-device recognition. Pre-wake audio stays local. Ordinary push-to-talk may use browser speech services with accurate privacy disclosure.

Status questions read task state; redirects update the current task through the canonical planner/broker; ambiguous targets receive one focused clarification. A reply never silently starts a conflicting foreground task. Preserve conversational context without repeatedly asking already-settled questions.

## Console, commerce and trust

Keep five modules **Customers, Cases, Staff, System, Audit**. Customers retain search/detail, usage/entitlements, scoped support cases, session/device revocation, factor recovery, temporary plan/unlimited grants, usage adjustments, suspend/restore and confirmed deletion. Staff retain verified-user invitations, roles/granular overrides, grant/revoke, ownership transfer and emergency sign-out. Cases retain reader/scope/reason/expiry/close. System exposes real service/execution controls; Audit preserves attributable history. Every mutation requires backend authority, required recent proof, reason and an auditable result; hidden controls are not authorisation.

Preserve Primary Owner, Backup Owner, Admin, Support, Billing, Developer/Operations and Read-only roles. No fake revenue/payment/subscription metrics. Payments are a later explicit integration: hosted/tokenised entry, no raw card storage, authenticated idempotent webhooks, append-only reversals, entitlement reconciliation and verified tax/consumer obligations. Existing usage ledgers survive pricing simplification; JARVIS final-payment prohibition remains.

Trust comes from scope, controllability, preserved work and checked results. Progressive disclosure, visible Stop, stable layout and retained drafts are design hypotheses to validate through observed first-task completion and repeat use, not conversion guarantees or demographic stereotypes. Avoid fake popularity, countdown pressure and unsupported enterprise/security claims.

## Acceptance and retirement

Extend existing E2E journeys in `scripts/e2e/` for Chat, JARVIS, settings, library, auth/MFA, voice, console and polish; locate exact filenames before editing, never create a parallel harness to match a shorthand name. Add narrow regression tests in the responsible existing module. Exercise signed-out, empty, populated, pending, denied, disconnected, failed and uncertain states across both themes, keyboard, zoom and phone keyboard/safe area; [TESTING](TESTING.md) owns commands/evidence.

Before removing any option/path, prove necessary functionality remains reachable, authorised, cancellable, recoverable and verified. Preserve deep links or provide a safe destination. A click, mocked response, visual disappearance or model claim is not task success. Product claims stay within available platform/workflow evidence.


## Owner-approved first-value and growth specification — 10 October 2026

**Positioning hypothesis:** “Control your computer naturally with AI.” Present a concise claim, one visually verified two-application example, “Try Chat” and optional “Connect PC” only when a native task requires it. No mandatory app install before first Chat, separate Code/Projects/dashboard product, obligatory extension or cloud desktop. Progress shows actual selected computer, authorisation, task milestones and checked outputs—not fake percentages.

**First PC task journey:** Sign in if needed → try conversation → request native task → show device/installed-app scope → download verified signed minimal Agent → pair account/device identity once → request precisely required OS permission → accept provided fixture or choose a scoped personal input → plan bounded outcome → run locally through native API/background routes where possible → independently reopen/check actual Excel/Word/PDF output → show editable files, integrity/preservation receipt, optional safe Repeat and truthful usage. Denial/revocation leaves user-owned files intact and returns a specific recovery action.

**PC selection:** automatically choose best *installed* app based on task and user preferences, explain it succinctly; ask one question where selecting a different file, computer, browser profile or Google account may affect the wrong target. If app is missing, offer an existing local alternative or official installation with explicit owner consent. A person actively using input retains keyboard/mouse; task-owned COM/CLI work may run in the background; global UI control pauses for Take Over. Stop always remains visible.

**Commercial loop:** free allowance sufficient for one useful genuine result, transparent predictable monthly subscription hypothesis, no active checkout claim while provider/merchant/legal requirements are unmet. Propose upgrading only *after* independently verified useful work, never forced during an unresolved task. Source-to-output history shows actual completed/partial outcomes and real measured time saved, and supports consented version-aware one-click repeat. Optional professional/team workflow sharing must separately authorise recipe metadata, file contents, accounts and output publication. Private outputs are not automatically shared. Do not use fake urgency, streak pressure or hidden recurring charges.

**High-value task support:** Native installed Office, browsers, IDE/compiler/Git, Blender/Fusion/creative/video, files, Android authorised actions, supported Mac and phone→paired-PC. Work with a new unfamiliar program by semantic discovery and safe fallback rather than per-app clone. Label unsupported OS/edition/action truthfully. Chat stays conversational and JARVIS online-only; microphone/barge-in controls distinguish conversation interruption from cancelling a task.

**Measure product-market fit:** first successful verified multi-app task, seconds-to-first-value, user takeover count, week-1 voluntary repeated tasks, paid conversion only after value, fully loaded cost per verified success, referrals from permissioned outputs and trust/support complaints. Segment India students versus professionals and prospective global markets separately; avoid unsubstantiated priced-market size claims.


## Customer first-value, conversion and professional launch requirements — final 1A/2A/3A

The initial audience is **Indian students and independent professionals**. The first demonstration must complete one independently checked task using the customer's installed **Excel → Word/PDF** environment, with 2+ substantive local application steps, preserved editable originals, a truthful result receipt, meaningful speed/cost measurements and a safe reusable workflow. PowerPoint, IDE/Git, CAD, Blender and media remain scheduled, not removed.

**UI:** 64 px desktop / 48 px phone ambient Orb with graph only on request; small conversation-first task card, explicit STOP/Take Over and accessible state truth. Billing/upsell only after a genuinely useful verified result, and only after legally and technically approved checkout. Do not promise immediate revenue, success or universal application coverage.

### Evidence-based acquisition and subscription discovery

2. Measure their existing completion/correction time.
3. Run the checked multi-app demonstration.
4. Test voluntary reuse and willingness to pay.
5. Measure 7/30-day retention, verified success, support burden, refunds and contribution.
6. Validate agencies/teams separately.
7. Expand only when repeated customer value and sustainable economics are demonstrated.

Selected positioning:

> **Control your computer naturally with AI.**
> Your programs do the work on your PC. OCADE helps plan, run and check the result.

Use real demonstrations and truthful limitations. Do not publish universal superiority or guaranteed-revenue copy.

**Exit gates:** free trial usable without PC install for normal Chat; official Device Agent only when local work needed; verified flagship result before optional monthly upgrade invitation; customer data sharing by explicit scope; 7/30-day retention, customer-reported friction, task verification accuracy and marginal task cost measured. Revenue remains a business hypothesis, not a guaranteed technical outcome.


## First-launch evidence, conversion and capital-efficient growth execution

The owner's commercial ambition is a **scale target, not a credible launch-time revenue promise**. Build a scalable, valuable product rather than adding cost or deceptive conversion gimmicks to chase a projection. The first-stage constraints are India-first students and individual professionals, almost no launch capital, user's own Windows PC, free first-use Chat and a paid subscription proposition *only after verified value*.

1. **Research with real customers:** recruit small consented cohorts covering students writing reports/assignments, freelancers producing client files, coding professionals, and separate agencies. Record installed Office/browser/IDE availability, hardware, weekly jobs, existing work duration, sensitivity, requested outputs and willingness to pay before selecting broad launch pricing.
2. **One repeatable flagship:** verify that one natural language request actually modifies local Excel, produces editable Word and checked PDF when requested, preserves originals and produces an understandable proof card. Record the software edition, outcome examiners, real wait/approval/correction time and customer-reported trust.
3. **Simple upgrade:** useful free allowance plus one predictable monthly proposal with visible limits, support cost and genuine paid benefits. Don't launch live checkout until merchant, tax, refund/legal and exactly-once-successful-output settlement gates pass. The current retired checkout is not evidence that payments work.
4. **Organic distribution:** privacy-safe, user-opted professional outputs, team sharing, a demonstrable repeat-workflow improvement and consented multi-app product demonstrations. Never expose raw private inputs, force sharing, create spam referrals or claim artificial results.
5. **Retention:** one-click *repetition after fresh permission/resource checks*, editable native files, verified history and actual measured time saved. Diagnose abandonment by setup step, application coverage, false-success incidents and unclear pricing rather than using streak manipulation.
6. **Unit economics:** account-wide concurrency and abuse safeguards, cost per independently verified completion (including internal retries, model spend, support, hosting, transfer, refunds and native installation/update), plan contribution margin, gross margin and retention cohorts. Never count failed/empty outputs as paid usage.
7. **Release experiment gates:** publish sample size and uncertainty for first-task verified success, conversion after proven value, repeat 7/30-day work use, refunds, support load and p95 completion time. Scale acquisition only after satisfactory trust, retention and sustainable variable margins; a larger subscriber base does not compensate for negative per-customer economics.

**Do not ship unverified promises:** 'billions at launch', 'every app works', 'zero bugs', 'fastest in the world' or 'beats every competitor' are not acceptance criteria. Pursue an exceptional product through actual completed local tasks, fair benchmarks, user willingness to pay and a sustainable paid service.
