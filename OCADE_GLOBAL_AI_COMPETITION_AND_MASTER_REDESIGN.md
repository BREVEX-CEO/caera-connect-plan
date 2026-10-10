# OCADE global AI competition and master redesign

Research baseline: **8–9 October 2026**, with dated 10 October deltas below. Final PR #74 documentation consistency review: **10 October 2026**. Source baseline: `f521e23529542d709a9627181341b0e904a8b0c3`, BREVEX-CEO/caera-connect-plan. This is dated analysis and evidence, not a competing implementation authority. [PLAN](PLAN.md) is the sole work queue. Application source, migrations, dependencies, infrastructure and deployed applications were not changed by this mission.

## Executive verdict

OCADE should become **the website-first assistant that finishes work in your existing applications and shows what it checked**. Start with small Windows-based agencies and operations teams: weekly Excel reconciliation, client document/PDF packs and authorised browser status collection. These are recurring paid outcomes with objective output checks, not three separate agent products.

Keep the existing architecture and improve its weakest contracts. The strongest advantage is a combination of low-friction website access, efficient local native execution, preserved editable outputs, recovery after failure and credible evidence. None of these ideas alone is unique. Muse, Hermes/Cua, UFO, OpenAdapt and others already pursue parts of this design. OCADE must establish superiority on the same customer tasks, including output quality, time, cost, interventions and recovery.

The inspected source has serious release-scope concerns: model-owned completion, rotation losing dispatched work, semantic STOP races, stale Android targeting, Office partial effects, cold offline activation, cross-tab encryption-key creation, granular RLS consistency, owner-transfer concurrency and incomplete export/erasure handling. These are source-traced findings, not runtime reproductions or fixes in this documentation mission. Current paid checkout was retired. A large historical test suite passed while its dependency-security audit failed. The product is not certified ready for broad paid autonomous control.

### Ratings out of 10

These are engineering judgements from the inspected subset, not measured product rankings or exhaustive audit scores. Unread source and unavailable hardware materially limit confidence. PLAN score refers to the old baseline, not a self-rating of this rewrite.

| Area                 | Score | Why                                                                                                |
| -------------------- | ----: | -------------------------------------------------------------------------------------------------- |
| Current product      |     5 | Coherent Chat/JARVIS/Library direction; checked recurring outcome not yet proved                   |
| Codebase             |     6 | Useful canonical modules and meaningful tests; race/ownership gaps and incomplete inspection       |
| Architecture         |     6 | Signed companion and shared authorities are valuable; settlement and transport need work           |
| Previous PLAN        |     3 | Long overlapping phases/addenda and absent-ledger prerequisites invite conflicting implementation  |
| JARVIS               |     5 | Broad tool capability; claimed completion can exceed independent proof                             |
| PC control           |     6 | Native Office/browser/UIA foundation; STOP/partial-save/installed parity still required            |
| Android              |     4 | Existing APK/bubble/accessibility; stale observations and volatile results undermine reliability   |
| Offline Intelligence |     6 | Model/OPFS/leases are substantive; cold start, repair and cross-tab key race need proof            |
| UI/UX                |     5 | Useful compact structure; missing async/focus/freshness states and costly idle visuals             |
| Security             |     5 | Signing/scope/permissions exist; granular RLS, execution trust and dependency issues remain        |
| Speed                |     4 | Existing model batching helps; each action still crosses server transport; no comparable benchmark |
| Reliability          |     4 | Unknown/partial effects, crash/rotation/retry and verification boundaries are incomplete           |
| Testing              |     6 | Extensive portable tests, but hidden incomplete aggregates and missing real-platform coverage      |
| Business model       |     4 | Attractive workflow hypothesis; willingness to pay/retention/margins unproved                      |
| Commercial readiness |     3 | Payments, licensing, release/security and customer evidence gates remain                           |
| Competitive position |     4 | Viable focused opportunity; no demonstrated general superiority over leading agents                |

## Research method and limits

Selected primary sources for relevance to execution, safety, speed, distribution, professional output and commercial entry. This includes product engineering documentation, repository code, academic benchmark definitions and a startup-directory discovery pass. Sources were consulted cumulatively on8–9 October 2026; dates below identify publication where known. Live pages without an explicit publication date are marked by this access window. Product announcements and vendor revenue claims are not independent evidence. No competitor product was installed, timed or benchmarked by this mission. This is a broad selected landscape, not an exhaustive worldwide census.

For repositories, inspect architecture/licence/current files before reuse. An open repository is not automatically permissively licensed. Do not import whole frameworks merely to acquire one useful idea. Competitor model/provider versions, hardware, reset policy and benchmark subset often differ; headline success percentages cannot rank them fairly.

## Competitive architecture comparison

All rows describe documented/source-supported capability or explicitly labelled inference. Proposed OCADE work references PLAN package IDs; it is not implemented superiority.

| System and primary source                                                                                                                                                                        | Most valuable method/capability                                                              | Speed, execution and weakness                                                                                                                                       | OCADE decision and proof                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ChatGPT Work](https://learn.chatgpt.com/docs/enterprise/work-admin-faq)                                                                                                                         | Natural general interaction and integrated tools; approved cloud/local work boundaries       | Distribution and intelligence are formidable; local-device availability/admin policy still constrain execution. Internal architecture is not fully public           | KEEP simple conversation; ADD checked local editable deliverables P01/P18. Compare actual workbook quality/recovery and setup friction, not chat eloquence        |
| [Claude computer use/Dispatch](https://claude.com/resources/articles/dispatch-and-computer-use)                                                                                                  | Connectors first, computer use where needed; continuation of professional work               | Screen interaction remains slower than supported interfaces; research-preview/platform/awake-device limits apply                                                    | Adopt connector/native preference P10/P17 and honest handover. Test native fidelity plus interruption under the same workflow                                     |
| [Claude Code/Cowork](https://support.claude.com/en/articles/15520349-use-claude-cowork-on-web-desktop-and-mobile)                                                                                | Strong coding, professional reasoning and long-task interaction; specialised environments    | These are distinct products/surfaces, not proof of universal device privilege. No verified claim about a particular model causing OCADE regressions                 | Keep one OCADE task owner, source-bound tests and compact checkpoints P16/P19; do not create a separate coding-agent framework                                    |
| [Muse](https://introducing.muse.ai/) and [security design,8September2026](https://research.meta.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse)                                | Isolated execution cell, privilege separation, auth broker and Sentinel policy enforcement   | Security is architectural, not just a system prompt; current browser surface has structured boundaries. Announced future confidential compute is not shipped proof  | Adopt independent admission/egress/credential boundaries P01/P05/P11. Do not claim OCADE invented an independent verifier or that user-level scripts are isolated |
| [Grok Bot](https://docs.x.ai/grok-bot/computer-and-apps),14September2026; [launch](https://x.ai/news/introducing-grok-bot),11August2026                                                          | Persistent computer/app context and separate parallel working screens                        | Documentation says bots share a computer's files/cookies/credentials; separate screens do not constitute isolation                                                  | Keep persistent scoped workspace, but enforce one mutation owner and account separation P03/P08. Test concurrent tasks against shared documents                   |
| [Manus context engineering](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus),18July2025; [Browser Operator](https://manus.im/en/blog/manus-browser-operator) | Stable prompt prefix, cache-aware context, file-backed state and autonomous delivery         | Fewer repeated tokens can reduce cost; cloud/local browser modes have different session boundaries. Extension-based local operation is not OCADE's mandatory path   | Adopt compact durable checkpoints and bounded observation deltas P09/P16. Measure tokens and correct resume; keep OCADE extension-free                            |
| [Hermes Agent](https://github.com/NousResearch/hermes-agent), [computer use](https://hermes-agent.nousresearch.com/docs/user-guide/features/computer-use/)                                       | Reusable skills/memory and model-flexible tools; Cua bounded operation manifests             | Bounded execution is already a competitor feature. Skills and broad shell access require trust; browser profiles must not be treated as freely copyable credentials | Adopt sanitised versioned recipes and bounded actions P08/P10. Test invalidation and secret exclusion; do not copy its whole gateway/tool stack                   |
| [Gemini Live session management](https://ai.google.dev/gemini-api/docs/live-api/session-management),15September2026; [capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities) | Streaming audio, interruption and reconnect/resumption contracts                             | Connection/session lifecycle differs from durable tool execution; resumed conversation does not prove an earlier side effect did or did not occur                   | TEST one integrated voice transport P12, retain task journal separately; network-loss-during-effect, echo and explicit STOP tests                                 |
| [Copilot Studio computer use](https://learn.microsoft.com/en-us/microsoft-copilot-studio/computer-use)                                                                                           | Business automation through computer interaction within managed workflow tooling             | Enterprise distribution/governance advantages; platform, environment and licensing constrain fit                                                                    | Copy measurable business outcome and operator controls, not a second RPA platform; P05/P18/P20                                                                    |
| [Microsoft UFO](https://github.com/microsoft/UFO), [multi-action design](https://github.com/microsoft/UFO/blob/main/documents/docs/ufo2/core_features/multi_action.md)                           | Windows UIA/Win32/COM, app-aware semantic actions and batches                                | Authors report up to51% fewer model calls for their multi-action setting; this is not51% faster end-to-end work                                                     | KEEP native Office and ADD local batches P04/P08; compare network exchanges and verified time, model calls separately                                             |
| [Cua](https://github.com/trycua/cua), [driver design](https://cua.ai/docs/cua-driver/concepts/how-cua-driver-works)                                                                              | Typed targets, background/native routes, bounded execution and explicit outcome distinctions | Broad integration cannot erase OS limitations; signed assertions need a stated trust boundary                                                                       | Borrow effect/execution/verification separation P01/P08; evaluate narrow driver reuse only after licence/size/parity proof                                        |
| [Agent S](https://github.com/simular-ai/Agent-S)                                                                                                                                                 | Hierarchical reasoning/grounding and improved computer-use evaluations                       | Strong published benchmark work; sampling/reasoning can increase cost. Different OSWorld variants are not interchangeable                                           | TEST as an optional planning/grounding baseline, no framework adoption. Measure accuracy per dollar and failure recovery                                          |
| [UI-TARS](https://github.com/bytedance/UI-TARS-desktop)                                                                                                                                          | Structured events and hybrid browser/visual automation                                       | GUI grounding broadens reach but adds observation/inference cost and freshness risk                                                                                 | Keep vision fallback with generations P02/P10, never reusable coordinates; test custom canvases and stale observations                                            |
| [Stagehand](https://github.com/browserbase/stagehand)                                                                                                                                            | Observe/act/extract and cached browser operations                                            | Reusing structured work can reduce repeated inference; changed pages invalidate assumptions                                                                         | Add typed semantic recipes P10; verify actual submitted/read state and drift, not a selector merely resolving                                                     |
| [Browser Use](https://github.com/browser-use/browser-use), [browser harness](https://github.com/browser-use/browser-harness)                                                                     | Browser automation with a protected harness/core and model helpers                           | Browser focus is narrower than native Office/CAD; runtime trust and authenticated session handling remain important                                                 | Reuse core-versus-helper separation P08/P16; compare authorised browser reporting with equal session setup                                                        |
| [Skyvern](https://github.com/Skyvern-AI/skyvern)                                                                                                                                                 | Workflow-oriented browser automation using visual/structured information                     | Useful business workflows; AGPL licence requires review before incorporating code                                                                                   | Adopt workflow/failure concepts, not assume MIT-style reuse. P18 fixtures measure end result and intervention count                                               |
| [OpenAdapt](https://github.com/OpenAdaptAI/OpenAdapt)                                                                                                                                            | Demonstration-to-repeatable execution with independent state checks                          | Deterministic repeats can be fast; a synthetic MockMed timing is not clinical/production proof                                                                      | Safe local recipes and repeat runs P10/P18. Compare cold discovery, warm replay and UI drift separately                                                           |
| [OpenClaw](https://github.com/openclaw/openclaw)                                                                                                                                                 | Local gateway, channels and extensibility                                                    | Broad plugins/host tools increase trust surface; sandboxing depends on configuration                                                                                | Keep useful continuity; REMOVE need for a customer plugin ecosystem. Scope tools and validate untrusted results P16                                               |
| [Mobile-Agent](https://github.com/X-PLUG/MobileAgent)                                                                                                                                            | Mobile visual planning and GUI models                                                        | Research capabilities do not imply consumer APK privileges or iOS parity                                                                                            | Test visual fallback against Android state/permission changes P13; no research success-to-product guarantee                                                       |
| [Mobilerun](https://github.com/droidrun/mobilerun)                                                                                                                                               | Device/portal automation lineage from Droidrun                                               | Android/iOS routes have distinct setup and platform restrictions                                                                                                    | Borrow observation/step contracts where licensed; production APK must not require developer tooling P13/P14                                                       |
| [OS-Symphony](https://github.com/OS-Copilot/OS-Symphony)                                                                                                                                         | Milestones, reflection and structured handoff                                                | Recovery context is valuable; repeated reflection may add latency                                                                                                   | Durable intent/checkpoints with bounded recovery P03/P16, not reflection after every deterministic action                                                         |

### PhoneHarness: deeper source review

Three different repositories were identified. They must not be presented as one product.

**PhoneHarness/PhoneHarness**, revision`1cdc0d963641d517f5deb687adb37332cf844e70`, is the Android research harness associated with [paper2606.14832](https://arxiv.org/abs/2606.14832) and [project page](https://phoneharness.github.io). The paper reports75% and12.9percentage-point improvement on its annotated setting; these are author results, not OCADE measurements. Its mixed GUI/CLI/host-tool structure routes structured operations locally and delegates GUI subtasks where necessary. The [routing specification](https://github.com/PhoneHarness/PhoneHarness/blob/1cdc0d963641d517f5deb687adb37332cf844e70/skills/routing.yaml) usefully distinguishes completed effects from opening an intent/composer or bootstrapping a screen. The consumer lesson is to label prepared versus actually completed work.

[GUI delegation](https://github.com/PhoneHarness/PhoneHarness/blob/1cdc0d963641d517f5deb687adb37332cf844e70/phoneharness/tools/seed_gui_subtask.py) accepts a step budget, but a default is not a hard safety clamp. Nested controller success is not independent verification. OCADE should bound delegated work in its existing broker, preserve typed traces and return at uncertain state, confirmation or scope boundaries; no second planner/framework is required.

Verifier quality varies. The [smoke grader](https://github.com/PhoneHarness/PhoneHarness/blob/1cdc0d963641d517f5deb687adb37332cf844e70/benchmark/grader.py) can accept a missing output file from a successful final trace. The [hybrid runner](https://github.com/PhoneHarness/PhoneHarness/blob/1cdc0d963641d517f5deb687adb37332cf844e70/benchmark/run_hybrid_bench.py) includes real artefact/state checks but also email checks based on command text, calendar checks based on tool arguments and confirmation checks based on narrative words. These source observations do not invalidate the paper's aggregate result; they show why OCADE's release verifier must demand actual saved/submitted state and trusted user-origin consent.

Its reproducibility setup uses Termux, ADB-related tooling and an Android emulator; that is research infrastructure, not an invisible consumer APK architecture. No LICENSE file was present in the inspected complete tree, so copying implementation remains blocked pending permission. Adopt routing/effect distinctions, reproducible fixtures, bounded delegation and independent state predicates; reject customer Termux/ADB requirements, broad shell bridges and narrative-only success.

**[ShawnPana/phone-harness](https://github.com/ShawnPana/phone-harness)**, revision`88b3642ac4733c47daf12e0f2837bc789eda63c6`, is a separate MIT-labelled project using Mac iPhone Mirroring plus screen/OCR/HID, and Android ADB. Mirroring needs supported Mac/iPhone setup and a **locked** iPhone; unlocking interrupts mirroring. Camera/microphone/authentication and regional/platform restrictions matter. Some implementation touches private APIs, so do not present it as a supported public-API consumer integration. [Apple's official conditions](https://support.apple.com/en-us/120421) govern the proposed optional experiment; Safari/PWA remote-PC remains the initial iPhone product.

**[ZachDreamZ/universal-phone-harness](https://github.com/ZachDreamZ/universal-phone-harness)**, revision`bb1bfc9fad37bcc32ef650de830d402300255317`, is another MIT-labelled MCP/CLI/library using Android ADB/UIAutomator, iOS WebDriverAgent and mocks. Indexed actions carry observation generations; not every selector route requires them. Its verifier uses target preconditions, hashes and explicit assertions. These are useful narrow contracts, not mathematical zero-mistake or external-delivery proof. WDA is developer setup, not unrestricted PWA control.

PhoneHarness research coverage: primary harness9 files fully read,3 partially read,5 fetched but not read; ShawnPana README full and iOS adapter partial; universal harness verifier full and README partial. Remaining files were inventoried only. No hardware or benchmark run occurred.

### FatihMakes, Mark and JARVIS identity/licensing

The relevant project is **[FatihMakes/Mark-LV](https://github.com/FatihMakes/Mark-LV)**, not an assumed project called Faithmakes. Revision`c3e795af71bff38bb406c62a2e7a63869cdc8eb2` presents JARVIS and Gemini Live/local-tool/session concepts. Source inspection of `core/echo.py` found playback-reference/echo residual handling and explicitly deferred mid-sentence interruption pending hardware proof; do not credit production-verified barge-in from a feature list. `core/stt.py` optional engines are not proof of the active Live path. Two source files were fully read; README/licence/one-shot model boundary partially read; no installed/audio test.

The [current licence](https://github.com/FatihMakes/Mark-LV/blob/c3e795af71bff38bb406c62a2e7a63869cdc8eb2/LICENSE) is CC BY-NC4.0 and prohibits commercial use. Audit OCADE's exact preserved donor snapshot and each adapted file separately: current upstream terms do not establish old terms, and preservation is not redistribution permission. Reuse concepts such as removing redundant model calls and echo-tail handling; do not assume attribution permits commercial copying. This is a distribution gate, not a reason to stop independent safety repairs.

### Additional worldwide opportunities and business lessons

| Category / primary discovery sources                                                                                                                                                                    | Valuable principle                                                                                                    | Decision for OCADE                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Cyberdesk](https://www.ycombinator.com/companies/cyberdesk), [AutoComputer](https://www.ycombinator.com/companies/autocomputer), [Automat](https://www.ycombinator.com/companies/automat)              | Legacy desktop work and workflow learning remain serious startup categories; directory descriptions are vendor claims | Compete in one repeatable operations workflow, with recovery/fidelity proof; no assumption their private architecture is known                                |
| [Cursor](https://cursor.com/business/teams), [Replit](https://replit.com/blog), [Lovable](https://lovable.dev/blog/agent), [Emergent](https://emergent.sh/)                                             | Tight creation-to-output loop and natural-language development                                                        | Offer checked coding within existing scope; POSTPONE separate app builder/IDE product. Vendor revenue claims are not audited financial evidence               |
| [Glean](https://www.glean.com/press/glean-surpasses-300m-arr-unrivaled-enterprise-context-fuels-ai-adoption), [Harvey](https://www.harvey.ai/blog/helping-law-firms-and-companies-collaborate-at-scale) | Enterprise context and professional workflow depth can monetise strongly                                              | Begin narrow, build permissions and repeatability; do not target regulated legal/medical decisions without domain assurance. Glean's ARR is self-reported     |
| [n8n](https://n8n.io/pricing/), [Zapier Agents](https://zapier.com/agents), [Make](https://www.make.com/en/ai-agents), [Activepieces](https://www.activepieces.com/)                                    | Reusable business workflows and distribution through integrations                                                     | Charge for bounded useful work, not a confusing click count; future API only after stable contracts                                                           |
| [Intercom](https://www.intercom.com/pricing)                                                                                                                                                            | Outcome-linked pricing makes value legible                                                                            | Do not equate a vendor-defined resolution with verified external business effect; define OCADE outcome and refund terms explicitly                            |
| [Wispr Flow](https://wisprflow.ai/), [Granola](https://www.granola.ai/), [ElevenLabs](https://elevenlabs.io/agents), [Sarvam](https://docs.sarvam.ai/)                                                  | Frictionless speech and useful context; Indic voice is a real evaluation dimension                                    | TEST Indian English/Hindi-English and speaker/headset echo; no collection of competing speech services                                                        |
| [Gamma](https://gamma.app/), [Notion AI](https://www.notion.com/product/ai), [Perplexity Comet](https://www.perplexity.ai/comet)                                                                        | Attractive outputs and context where work already occurs                                                              | Editable finished artefacts and short receipts matter more than another generic dashboard                                                                     |
| [llama.cpp](https://github.com/ggml-org/llama.cpp), [wllama](https://github.com/ngxson/wllama)                                                                                                          | Local inference and browser portability                                                                               | KEEP current small model/WASM/OPFS; test acceleration against actual quality/memory/thermal constraints, do not replace for fashion                           |
| [Humane service shutdown FAQ](https://support.humane.com/hc/en-us/articles/34243204841997-Ai-Pin-Consumers-FAQ)                                                                                         | Cloud-dependent hardware can lose essential utility when service stops                                                | Avoid hardware capital cost; preserve local outputs, export and honest service-dependency boundaries. This fact is not a complete causal business post-mortem |

## Exactly what OCADE should change

**KEEP:** website/PWA; Chat/JARVIS separation; small offline model/OPFS; current online intelligence authority; signed public-key pairing; existing native broker; Office fidelity adapters; task checkpoints; explicit permissions; scoped files/backups; bundled signed wake; Windows tray; Android bubble; integrated owner/staff console; durable account authority; existing Workers/R2 release controller and valuable negative tests.

**REMOVE now from active documentation:** absent-ledger mandatory startup, fixed old phase-range instructions, conflicting wake-download instructions, unsupported readiness percentages and duplicate product/security/visual authorities. Two redundant Markdown files were merged then removed;12 legacy names become compatibility pointers. Product-code removal is not authorised now.

**REPLACE during implementation:** model-declared completion with receipt-gated settlement; repeated cloud dispatch with bounded device batches; stale coordinate identity with generations/fingerprints; admission-only STOP with final-point checks; ambiguous rotation with a non-dispatching handshake; memory-only mobile outcomes with durable reconciliation; network-first offline activation with local verified manifest lookup; coarse permission divergence with one database predicate; unordered export with table-specific traversal/consistency; silent partial erasure with a scheduled durable consumer.

**ADD:** scope-bound completion contracts, effect/execution/verification states, crash-safe journals, immutable recipe preconditions, precise unknown/partial reporting, event wakeups with durable reads, version-aware local skills, natural voice lifecycle, accessible async/error states, evidence-based workflow comparison, one capped paid pilot after payment/legal gates, and release tests that cannot hide incomplete coverage.

**POSTPONE:** foundation-model training, cloud desktop fleet, own hardware, giant marketplace, broad team product, standalone IDE/app builder, unrestricted iPhone local control and app-specific controller proliferation. Each has cost and evidence requirements that distract from the first paid outcome.

### Concrete source findings and repair ownership

| Finding                                                 | Current source trace                                                              | Fix/test owner                                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Completion can be model-owned                           | src/jarvis/agent.ts633–654; protocol verification prompt is not enforcement       | P01 task-authority receipt gate; lying/missing/wrong-task receipt tests                             |
| Rotation can consume dispatched commands                | ocade_identity.py199–240 vs device.server.ts587–589,698–790                       | P03 rotation-only operation, preserve immediate old-key revocation, queued/running/lost-reply tests |
| Each predicted action still crosses server              | agent.ts473–515,528–555; live-deps101; device.server698–790                       | P08 ocade_device loop/journal, protocol negotiation, local bounded steps                            |
| Semantic STOP and user-input pause holes                | ocade_computer313–361; ocade_accessibility237–303; Android Control274–323         | P02 final-effect cancellation/epoch and takeover; barrier-controlled race tests                     |
| Android observation ID lacks complete freshness         | Control334–396; OcadeAccessibility19–22                                           | P02/P13 event generations, geometry/target checks; scroll/rotate/overlay tests                      |
| Android results lost on process death                   | AgentService120–145                                                               | P03 durable intent/results and server acknowledgement reconciliation                                |
| Partial Office save can look unchanged                  | Excel140–193; Word100–122; ocade_computer641–651                                  | P04 maybeChanged before first mutation, preserve backups/unsaved state, reopen readback             |
| Cold offline start depends on live resolver             | installation-browser164; installation-authority566–602; runtime-activation125–159 | P07 verified local manifest first, valid lease separately, genuine cold offline browser test        |
| Repair may trust stale nonempty/verified state          | installation-authority599–602,1044–1057                                           | P07 forced length/digest verification after explicit corruption/repair                              |
| First encryption-key race and destructive error cleanup | unsynced-turns79–92,129–135                                                       | P07 atomic winning key and quarantined unreadable data, independent two-tab test                    |
| Granular staff denial versus broad RLS                  | latest migration's has_role; older usage/profile SELECT policies                  | P05 shared permission predicate, direct Data API test with same identity                            |
| Owner transfer/revoke race                              | latest transfer285–298 versus prior revoke375–386                                 | P05 common locks/rowcounts/exactly-one invariant; two real DB sessions                              |
| Export pagination/consistency                           | data-rights125–169,245                                                            | P06 AccountDataTable-specific keys/singletons, consistent snapshot or honest best-effort            |
| Erasure retry/unknown pending count                     | erase.server34–43; tombstones.server74–79                                         | P06 bounded consumer wired into cloudflare-entry:scheduled, count failure remains unknown           |
| Paid checkout retired                                   | entitlement-resolver and20260923100000 retirement                                 | P20 future forward billing design; never advertise current subscriptions                            |
| Missing UI pending/error/focus/freshness                | JarvisWorkspace119–145; JarvisPanels; AdvancedSection; JarvisTask preview         | P15 clear states, shared modal focus, timestamp/generation and error recovery                       |
| No actual spoken barge-in in current browser path       | use-voice249–265 stops recogniser during TTS                                      | P12 one coordinator, audio interruption distinct from task STOP, output error handling              |
| Gate may inspect zero targets / incomplete aggregate    | check-accessibility; e2e/harness                                                  | P19 fail-closed discovery and machine-readable incomplete result                                    |

All paths above are relative to the baseline repository and line numbers refer to that snapshot. The full source path and tests are in PLAN/Architecture/Testing. Source concerns need executable reproduction before a future implementation claim. No code was repaired here.

## How the unified product works

The person opens ocade.in, signs in and connects the computer once when native access is required. Chat answers questions and uses local intelligence when selected and available. JARVIS interprets an action request, agrees the outcome and scope, and sends admitted work to the paired device. The local broker uses a supported API, application object model or semantic interface first. It takes screenshots only when useful and uses fresh coordinates as a last resort. The verifier reopens/queries actual state before the task authority calls work completed.

A receipt records what changed, what was checked, what remains uncertain and how recovery works. It need not publish private file contents. A second read under the trusted broker catches mistaken completion; it does not magically protect against malicious same-user code or a compromised OS. Stronger claims require demonstrated containment or independent service/credential verification.

The local batch removes repeated transport waits, not all model time. Current OCADE already batches some model decisions. Compare network exchanges and end-to-end verified latency independently from model calls. Propose p95 local admission10ms, warm lookup5ms, dispatch bookkeeping20ms and STOP-to-admission closure50ms on a specified reference machine. These exclude app/network/model time; durable flush is still included in the complete task timing. Remote STOP is requested→acknowledged→quiescent. An unseen revoke is bounded by a proposed maximum5-second native lease; high-impact external effects require fresh authority. These are design targets awaiting tests.

Default browser restrictions remain real. Chrome136+ default-profile remote debugging cannot be assumed available. Legitimate structured attachment when available, OS semantic/visual control otherwise, or an explicitly separate managed profile with normal user sign-in are practical routes. No copied cookies/password databases. Normal Exit stops work but preserves pairing; explicit revoke removes authority. [Chrome policy](https://developer.chrome.com/blog/remote-debugging-port).

Offline Intelligence retains its current model and OPFS. Separate durable model identity from expiring download URLs; local verified bytes plus a valid lease must support cold offline startup. Browser storage can still be evicted, so offer honest status/repair/export instead of permanent-storage guarantees. Do not turn the small local model into an unproved universal planner. [Storage eviction limits](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

## Premium UI and page decisions

Choose deep neutral graphite with restrained blue focus/active states, green verified outcomes and red errors. Dark page/card/raised: `#0B0B0B/#151515/#1E1E1E`; light: `#FAFAFA/#FFFFFF/#F2F2F2`. Text: dark`#F5F5F5`, light`#171717`; secondary`#A3A3A3/#595959`; blue`#76A9FF/#245DC1`. No neon or permanent animated background. Glass appears only on small raised surfaces with opaque fallback and final-composite contrast checks. Normal text contrast is at least5.50:1 across the chosen opaque surfaces; identifying outlines at least3.13:1. These calculations are not rendered accessibility certification. [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Keep three main destinations: **Chat, JARVIS, Library**. JARVIS keeps Conversations, Activity, Devices; consolidate only when schedule/history access survives. Exactly five Settings groups: use the complete option inventory in [PRD](docs/PRD.md), with Account, Appearance, Notifications, Privacy & Security, Billing & Usage. Do not expose tool engines/provider keys or create a second device/settings app.

| Surface                        | KEEP                                                    | REMOVE/REPLACE                                                                    | ADD and proof                                                                 |
| ------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Landing/pricing/onboarding     | OCADE identity and simple entry                         | Unsupported universal claims, paid checkout fiction, setup wall before online use | One demonstrated checked workflow, compatibility and Connect only when needed |
| Chat/Offline                   | Auto/Online/Offline, history, model status              | JARVIS fallback ambiguity, network-first installed-model activation               | Cold offline readiness, repair/eviction/lease explanations                    |
| JARVIS composer/task           | Conversation plus action requests, STOP/Take Over       | Tool-selection plumbing, model-owned success, fake progress                       | Verified/partial/unknown states, compact evidence, meaningful target/scope    |
| Conversations/Activity/Devices | Resume/history, schedules and explicit device selection | Duplicate lifecycles, failed read shown as empty/signed-out                       | Retry, stale state, paired/offline/revoked distinctions                       |
| Browser/app permissions        | User policy, target and high-impact confirmation        | Mandatory extension/MCP, copied profile secrets                                   | Supported session route, time-stamped preview, per-capability scope           |
| Library/files                  | Folders, saved editable outputs, recovery               | Silent format degradation and unsupported saved claims                            | Source/output receipt, safe open/download/repeat, conflict-aware restore      |
| Account/security               | Identity/recovery/MFA/sign-in methods                   | Rejected mutation hidden behind stale success                                     | Latest operation state, clear error and accessible confirmation               |
| Appearance/accessibility       | Dark/light, high contrast, reduced motion               | Constant Orb work and theme proliferation                                         | Shared tokens, keyboard/zoom/touch/focus proof                                |
| Notifications/downloads        | Useful task/device events and actual install controls   | Duplicate settings and technical knobs                                            | Permission-denied recovery and honest browser/background limits               |
| Owner/staff                    | Integrated authorised console, granular roles/audit     | Retired separate origin/frontend identity checks                                  | Exactly-one owner, direct-RLS parity, reasoned expiring support access        |
| Billing/usage                  | Current grant/usage truth, owner unlimited authority    | Dead subscription actions                                                         | One capped paid pilot only after merchant/settlement proof                    |
| Android/tray                   | One tray, optional bubble, STOP/voice/Open OCADE        | Duplicate setup and hidden OS permission assumptions                              | Guided grants, durable outcomes, revoke/Doze/restart tests                    |
| Voice                          | Text fallback, local wake where supported               | Multiple recognisers, status question cancelling work                             | One lifecycle, echo-tested interruption, separate task STOP                   |
| 404/error/empty                | Safe routes back and accessible labels                  | Unverified assurance that data is intact                                          | Honest retry/offline/not-found explanation and focus restoration              |

The full PRD inventories14 human screen routes,2 layouts,5 machine endpoints,2 crawler endpoints and exceptional states. Every control requires success, pending, failure, blocked and keyboard/mobile treatment where applicable. Psychology is practical: familiar navigation lowers learning cost; one primary action lowers decision burden; progress and evidence build calibrated trust; reversible previews reduce fear; attractive editable results support sharing. Gen-Z appeal does not justify manipulated streaks, fake activity or privacy-invasive virality.

## Testing and low-budget execution

Use the existing CLI/tests before adding tooling. Playwright and browser developer tools cover browser behaviour/performance; native UIA/OS tools cover Windows; Appium is a developer actor for Android. GitHub provides source/CI provenance. Developer MCP integrations are optional access mechanisms, never customer prerequisites or substitutes for actual evidence.

Use Windows host hardware and a pinned Pixel6a API34 x86_64 Google APIs emulator,2–4vCPU and2–4GiB guest memory suited to host capacity, WHPX acceleration, stable snapshots and documented SDK/image versions. Do not simultaneously overcommit several emulators. PhoneHarness's ARM/API33 research image is a distinct reproduction environment, not automatically the fastest Windows choice. [Android acceleration](https://developer.android.com/studio/run/emulator-acceleration).

Free hosted testing can supplement local runs within current quotas; do not enable billing automatically. Firebase documents free daily virtual/physical test limits, but shared-device tests do not prove every OEM background/wake behaviour. [Firebase quotas](https://firebase.google.com/docs/test-lab/usage-quotas-pricing). Chromium/Firefox/WebKit testing is valuable compatibility evidence, not physical Safari/iPhone proof. [Playwright browsers](https://playwright.dev/docs/browsers). Apple native testing/distribution has hardware, account and signing requirements; use legitimate borrowed/available hardware before buying services. [Apple account capabilities](https://developer.apple.com/help/account/basics/about-your-developer-account).

Required negative matrix includes permission withdrawal at the final effect, stale observations, duplicate/reordered messages, save-with-lost-ack, process kill, key rotation, offline expiry/eviction, cross-tab key race, account switching, direct RLS, concurrent owner changes, partial deletion/export, malformed recipes, hostile webpages, untrusted scripts, package signatures, clock/suspend/reboot and billing event replay. Real Excel/Word must reopen outputs; CAD/Blender/video tests must preserve native editable projects. A screenshot of a button being clicked is insufficient.

Benchmark30 parameterised tasks per initial workflow, held-out variations and cold/warm repeats. Record verified success, false verified success, p50/p95 total time, model/API cost, screenshots/network exchanges, user interventions, setup time, recovery time, fidelity and customer willingness to pay. Suggested pilot target≥95% verified success within the declared narrow scope, zero falsely verified completions and no critical safety violation; small samples cannot establish universal reliability. Use [OSWorld](https://github.com/xlang-ai/OSWorld), [BrowserGym](https://github.com/ServiceNow/BrowserGym) and [AndroidWorld](https://github.com/google-research/android_world) as supplementary benchmark disciplines, not replacement for OCADE customer tasks.

## India, international markets and economics

**Initial customer:** small Windows/Office-heavy agencies and operations professionals repeatedly compiling reports and client packs. Avoid competing first on generic chat, regulated decisions or expensive enterprise procurement. Start with personal introductions and professional communities; observe actual weekly work with consent, choose one recurring process, demonstrate a checked editable result and invite repeat use.

**India:** test a solo pilot at₹999/month with strict measured cloud/voice limits. Support Indian English and selected Hindi-English flows only after accuracy/echo testing. Value is time saved and reduced reporting errors, not an abstract agent count. Payment method/merchant approval and taxes/refunds must be established. Stripe accounts in India are invitation-only in the cited support policy; Razorpay AutoPay is a potential approved route, not an existing OCADE integration. [Stripe India](https://support.stripe.com/questions/stripe-accounts-are-invite-only-in-india), [Razorpay AutoPay](https://razorpay.com/upi-autopay/).

**International:** test US$19/month for the same capped solo outcome, localise examples/support and measure willingness to pay separately. Do not assume Indian purchasing power, payment methods, compliance or acquisition channels transfer unchanged. Team price ideas₹2,999/US$59 are deferred hypotheses until actual membership, workspace isolation, delegated approval and seat billing exist. No paid checkout is currently established in source.

Free users should obtain useful Chat/offline value and one bounded JARVIS demonstration. Conversion follows a successfully checked task and an understandable allowance, not forced installation or surprise billing. Start10 design partners, seek5 paid pilots after legal/merchant readiness and require4weeks of repeated use before broad acquisition. Track first-task verified activation, week4 repeated workflow use, paid cohort retention, support minutes, refunds and contribution margin. Referral credit requires explicit sharing, successful useful work and anti-abuse limits. No automatic social posting/customer content exposure.

Proposed gross-margin floor is70% after variable inference/audio/hosting/payment/support/refund costs. At₹999, that allows roughly₹300 variable cost before fixed costs/tax treatment; atUS$19, roughlyUS$5.70. These are arithmetic budgets, not actual margins. Measure p95 expensive tasks, not just average cheap ones. If support or cloud cost exceeds the allowance, constrain scope, improve local execution or change price; do not promise unlimited work.

| Ambition                              | Illustrative arithmetic, not forecast                                  |
| ------------------------------------- | ---------------------------------------------------------------------- |
| US$1B annual revenue atUS$20/month    | About4.17million continuously paying customers, before churn/discounts |
| US$1B atUS$100/month business revenue | About833,333 equivalent paying accounts                                |
| US$10B atUS$100/month                 | About8.33million equivalent accounts                                   |

A credible ladder is5paid repeat users→50retained users→repeatable acquisition/support→positive unit economics→larger paid cohorts→teams/API only when requested. Global labour/software markets are large, but the reachable early market depends on supported tasks, trust, distribution and demonstrated willingness to pay. Do not convert broad-market potential into an OCADE revenue forecast. Current research does not establish product-market fit.

Selected positioning: **“Control your computer naturally with AI.”** Supporting line: **“Your programs do the work on your PC. OCADE helps plan, run and check the result.”** Earlier positioning candidates are superseded. Until execution evidence exists, landing copy must say what is currently supported rather than imply universal success. Short consented demos should show the original request, native editable output, elapsed time and checks/exceptions. YouTube's niche-community research supports testing focused creator/professional channels, not a guaranteed viral formula. [YouTube research,10September2026](https://blog.youtube/culture-and-trends/youtube-culture-trends-modern-mainstream-research/). Deloitte's India survey is directional, not population-wide willingness-to-pay evidence. [India survey](https://www.deloitte.com/in/en/about/press-room/from-learning-to-application-ai-confidence-builds-across-indias-workforce.html).

Privacy/legal requirements must be reviewed against the actual launch market and phased law dates; this report does not certify compliance. India's published data-protection rules and EU transparency obligations inform consent, retention, deletion, provider disclosure and AI interaction labelling. [MeitY rules](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf), [EU Article50 guidance](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act). Honest required licence notices cannot be suppressed merely to hide provider names in ordinary UI.

## Stronger ideas that fit one architecture

1. **Difference-first recurring work:** show changed inputs, changed outputs and exceptions before overwriting anything. Reuse digest/precondition/receipt contracts; test stale inputs and user edits. Value: less review time and fear.
2. **Recovery from reality:** after a crash, inspect the saved workbook/submitted record and resume only missing work. Reuse journal plus verifier; test every effect/ack boundary. Value: fewer duplicate sends and repeated manual recovery.
3. **Exception-only review:** deterministic checks clear routine rows; humans review ambiguous business rules or unmatched records. Never conceal unchecked rows. Value: scalable trusted reporting.
4. **Recipe canaries:** after an app update, run a harmless disposable fixture before enabling a learnt recipe. Reuse version metadata and tests. Value: detect drift before customer damage.
5. **Private portable receipts:** share redacted evidence of output checks, not the underlying customer data. Validate disclosure consent and recipient access. Value: handoff/accountability, with a possible later verification API.
6. **A workload passport:** one task retains its goal, permissions, evidence and recovery across phone/desktop without transferring credentials. Existing account/device/task authority supplies it; no new distributed agent network.

Defensibility would come from consented workflow failure/recovery knowledge, version-tested recipes, good native fidelity, trusted distribution and retained customer routines. Raw user data hoarding, a fancy Orb or an LLM wrapper is not a durable moat.2026 prioritises trustworthy Windows workflows;2027 expands tested platforms/teams only after retention;2028 considers APIs/marketplace only after paid demand and governance. These are stage gates, not promises about future competitor capabilities.

## Why repeated AI coding fixes can regress

No evidence here proves that a named Claude model is inherently responsible. The source/document environment supplies more concrete causes: overlapping authority/addenda, absent-ledger startup rules, multiple lifecycle interpretations, preflight-only cancellation, loss of effect state across errors, tests that mock the problematic boundary, and treating a passing portable suite as release proof.

Anthropic's [long-running harness work](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) also treats context continuity and concrete progress verification as harness responsibilities; a broad prompt alone is inadequate. The remedy is procedural and architectural: current authority→exact source state→reproduce→one root-cause owner→targeted regression→sibling paths→deliberate break attempt→real workflow→release/rollback evidence→coherent merge. A fresh context resumes the first dependency-ready OPEN package; it does not rewrite the product from memory. Short prompts work when detailed contracts live in stable documents. Ponytail Ultra belongs after behaviour/parity proof, not before understanding safety or source provenance.

## Independent design review and corrections

Three reviewers delivered a pre-writing feasibility challenge before the draft authorities. One defined final independent challenge then reviewed PLAN/product/runtime/security/testing. No infinite review loop was used. Corrections applied: one canonical protocol schema; separate effect/execution/verification; explicit signing negotiation; immediate old-key rejection; actual desktop journal owner; model-call versus network-batch measurement; locked iPhone Mirroring; local versus unseen remote revocation and lease expiry; trusted-device verification claim; table-specific export traversal; actual scheduled erasure entrypoint; Exit versus revoke; voice playback versus task STOP; one voice/display mapping; baseline versus distribution gate; solo-only pilot; final frozen tests after billing and cleanup; consistent PARTIAL status.

Existing source defects remain OPEN; document review does not repair them. Physical device/provider/merchant/signing/licence gates remain evidence-dependent. The final report's validation/publication record is below; never infer deployed changes from its commit.

## Exact implementation sequence and continuation prompt

P00-A records baseline and unlocks safe isolated repairs; P00-B clears distribution. P01–P07 fix completion, STOP/freshness, rotation/journals, partial saves, account authority, export/erasure and offline reliability. P08–P12 add local segments, event recovery, safe recipes, signed companion/browser flow and voice. P13–P17 cover honest platforms, complete UI, bounded intelligence and professional native apps. P18 proves recurring workflows. P19 establishes the test gate; P20 adds approved commerce; release-scope cleanup and a final P19 rerun precede P21 promotion. P22 governs ongoing proof-based simplification and gated expansion.

> Read AGENTS.md and PLAN.md, fetch current main and resume the first dependency-ready OPEN package. Reproduce defects, reuse existing authorities, implement the smallest root-cause fix and test related paths plus an adversarial case. Record source/local/deployed/physical evidence separately. Preserve functionality, licences, STOP, recovery and account isolation. Do not add a parallel framework, treat model success as proof, or deploy beyond explicit authorisation. Continue independent work and report exact blockers.

## Read-only deployed observation and historical CI

On9 October 2026 a direct read of [public health](https://ocade.in/api/health) returned status ok, commit `f521e23529542d709a9627181341b0e904a8b0c3`, deployment `259c2af8-9c9d-42b3-ae0b-e6f21d6fb9db` and scope liveness. Configuration flags were present. This establishes only the endpoint's reported identity/liveness; no customer workflow, hosted RLS, model provider, signing or payment success follows from it. No deployment was performed.

Inspected historical [CI run37600604126](https://github.com/BREVEX-CEO/caera-connect-plan/actions/runs/37600604126) recorded115test files/1,253tests and15portable gates passing, then failed the production dependency audit with critical/high findings concerning seroval/source-map-js (GHSA-p6vx-979v-rg4c, GHSA-jp82-f5mq-hwhp, GHSA-68fv-2mgg-jv7q). Verify current advisory dependency paths before choosing fixes; no guessed patched version is prescribed. The subsequent baseline commits removed documentation only. Current CI ignores documentation paths, and production deployment is workflow_dispatch; a skipped docs CI is not a new product PASS. This mission did not run the product test suite or mutate infrastructure.

## Complete baseline Markdown disposition inventory

All 41 baseline Markdown files were inventoried;32 were fully read by the documentation reviewer and9 large evidence/strategy documents partially inspected. Other reviewers read relevant authorities too. This is not a claim of every historical audit byte reviewed. Two files were actually removed after merging their requirements;12 legacy files are compatibility pointers because immutable migrations/source comments still name them. Historical evidence stays in place with a banner; imports remain unchanged. The new report makes40 retained Markdown files after the two deletions.

| Path                                                                                         | Original purpose/reference                                                             | Actual disposition and preservation                                                                                                                            | Baseline read coverage         |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| AGENTS.md                                                                                    | Agent engineering authority; CLAUDE, PLAN, pinned-model test comment                   | REWRITE short rules/authority map; deleted-ledger requirements replaced by current evidence index                                                              | Full                           |
| CLAUDE.md                                                                                    | Claude loader/rules; check-model-identity exception, artifact scripts, source comments | REWRITE thin AGENTS loader; preserve unique tool/identity constraints in canonical owner or allowed historical file                                            | Full                           |
| ELITE_PRODUCT_STRATEGY.md                                                                    | Prior dated strategy; AGENTS/CLAUDE/PLAN                                               | KEEP IN PLACE AS HISTORICAL evidence with explicit banner; new research supersedes strategy authority. Partial reading prevents destructive removal.           | Partial; parent strategy owner |
| FINAL_AUDIT_LEDGER.md                                                                        | Dated audit evidence and unresolved claims; PLAN                                       | KEEP historical evidence with baseline/status disclaimer; current work queue in PLAN must reproduce each applicable finding                                    | Partial                        |
| PLAN.md                                                                                      | 56 phases plus addenda; many source/migration/test comments                            | REWRITE one dependency-safe queue; preserve old SHA and complete phase/addendum mapping below                                                                  | Full, all 2143 baseline lines  |
| ToRemove.md                                                                                  | Retirement history/proposals; migrations, PLAN, AGENTS                                 | REWRITE pending manifest only; preserve completed history in Git; reconcile conflicting superseded-migration deployment instruction                            | Full                           |
| docs/APP_FLOW.md                                                                             | Journeys; auth callback/Chat comments and historical migrations                        | MERGED; retained a short compatibility pointer. MERGE INTO PRD journeys; short compatibility pointer if retaining comment-reference resolution                 | Full                           |
| docs/ARCHITECTURE.md                                                                         | Technical authority                                                                    | REWRITE canonical protocol/platform/storage contract; absorb technical duplicates, keep source/schema as truth                                                 | Full                           |
| docs/BILLING_AND_GLOBAL_COMMERCE.md                                                          | Deferred provider/commerce boundaries                                                  | MERGED AND DELETED. Product requirements in PRD; commerce/security obligations in SUPPORT_LEGAL_SECURITY; exact old contents preserved at baseline SHA.        | Full                           |
| docs/Backend Schema.md                                                                       | Backend summary; immutable migration comment                                           | MERGED; retained a short compatibility pointer. MERGE INTO ARCHITECTURE source/schema map; pointer preserves old reference, migrations unchanged               | Full                           |
| docs/COMPANY_PRODUCT_AUTHORITY.md                                                            | Company/product ownership; AGENTS                                                      | MERGED AND DELETED. Product requirements in PRD; commerce/security obligations in SUPPORT_LEGAL_SECURITY; exact old contents preserved at baseline SHA.        | Full                           |
| docs/CONTROL_INVENTORY.md                                                                    | Old page/control/test inventory; IMPLEMENTATION_LEDGER                                 | ARCHIVE historic evidence; PRD now owns current route/options, TESTING owns executed coverage; do not reuse old check counts                                   | Full                           |
| docs/DECISIONS.md                                                                            | Decision history; auth/shell/settings/intelligence source comments                     | REWRITE short current decisions with supersedes IDs and historical SHA; never competing phase plan                                                             | Full                           |
| docs/DEFERRED_GEMINI_ISSUES.md                                                               | Dated provider/run failures; PLAN/FINAL_AUDIT/FINAL_MATRIX                             | KEEP evidence; label historical hypotheses and route current reproduction to PLAN; failures not automatically current                                          | Full                           |
| docs/DESIGN.md                                                                               | Duplicate visual direction; UsageSection comment                                       | MERGED; retained a short compatibility pointer. MERGE INTO JARVIS_DESIGN_SYSTEM; pointer for source comment                                                    | Full                           |
| docs/DONOR_CAPABILITY_LEDGER.md                                                              | Provenance/reuse mapping; source-is-preserved test and ELITE                           | KEEP provenance, not active work queue; do not delete or rewrite preserved claims as current success                                                           | Partial                        |
| docs/FINAL_MATRIX.md                                                                         | Historical frozen matrix; FINAL_AUDIT/IMPLEMENTATION/DEFERRED                          | KEEP historical evidence; TESTING owns current gates; preserve counters and original failures                                                                  | Partial                        |
| docs/IMPLEMENTATION_LEDGER.md                                                                | Historical repairs/evidence; MEMORY                                                    | KEEP historical evidence; current bugs must be reproduced, not inferred from dated rows                                                                        | Partial                        |
| docs/JARVIS_DESIGN_SYSTEM.md                                                                 | Visual authority; checker/styles/settings/Orb                                          | REWRITE canonical palette/layout/focus/motion/acceptance; edited by this reviewer                                                                              | Full                           |
| docs/JARVIS_DEVICE_ROADMAP.md                                                                | Device/platform roadmap; AGENTS/runtime comment                                        | MERGED; retained a short compatibility pointer. MERGE INTO ARCHITECTURE contract + PLAN work order; pointer preserves source reference                         | Full                           |
| docs/MCP_ORCHESTRATION_AND_AUTONOMOUS_FIX_LOOP.md                                            | Developer coordination/testing rules; AGENTS/runtime README/historic reports           | MERGED; retained a short compatibility pointer. MERGE INTO TESTING and AGENTS; pointer for historical reports if needed                                        | Full                           |
| docs/MEMORY.md                                                                               | Handoff/history, deployment instructions; identity-checker exception                   | REWRITE current navigation plus explicit historical boundaries; retain technical identity exception content if necessary; deployment instructions single owner | Full                           |
| docs/MOBILE_DEVICE_CONTROL.md                                                                | Platform/bubble/wake; AGENTS/JarvisBubble comment                                      | MERGED; retained a short compatibility pointer. MERGE INTO ARCHITECTURE + PRD platform journeys; pointer for source reference                                  | Full                           |
| docs/OWNER_ADMIN_BACKEND.md                                                                  | Roles/privileged operations; AGENTS/MEMORY and applied migrations                      | MERGED; retained a short compatibility pointer. MERGE INTO SECURITY + ARCHITECTURE contracts; PRD retains five modules/options; pointer for migrations         | Full                           |
| docs/PRD.md                                                                                  | Product authority; root/Library/Chat/settings/migration comments                       | REWRITE all current routes/options and boundaries; edited by this reviewer                                                                                     | Full                           |
| docs/RULES.md                                                                                | Duplicate implementation/auth rules; admin/provider-availability comments              | MERGED; retained a short compatibility pointer. MERGE INTO AGENTS + SECURITY; pointer for existing source references                                           | Full                           |
| docs/SUPPORT_LEGAL_SECURITY.md                                                               | Security/support/privacy authority                                                     | REWRITE canonical permissions/data/incident/legal constraints, absorb owner-specific security                                                                  | Full                           |
| docs/TESTING.md                                                                              | Test/evidence authority; measure-loc and isolation test comments                       | REWRITE one gate/evidence/release runbook, absorb toolchain and orchestration                                                                                  | Full                           |
| docs/TESTING_TOOLCHAIN.md                                                                    | Developer tool list/platform tests; AGENTS/runtime README                              | MERGED; retained a short compatibility pointer. MERGE INTO TESTING; preserve physical-versus-emulator proof distinctions; pointer for immutable history        | Full                           |
| docs/TRD.md                                                                                  | Duplicate technical requirements; root/library/online source + migrations              | MERGED; retained a short compatibility pointer. MERGE INTO ARCHITECTURE; pointer for source/migration refs; remove stale 'Fix TOTP' as current claim           | Full                           |
| docs/UI UX Brief.md                                                                          | Duplicate experience direction; AuthShell/ChatWorkspace comments                       | MERGED; retained a short compatibility pointer. MERGE INTO PRD + JARVIS_DESIGN_SYSTEM; pointer for source refs                                                 | Full                           |
| docs/UI_REFERENCE_CHECKLIST.md                                                               | Visual QA checklist; help source comment                                               | MERGED; retained a short compatibility pointer. MERGE INTO JARVIS_DESIGN_SYSTEM acceptance; pointer for source ref                                             | Full                           |
| docs/audits/2026-09-27-jarvis/OCADE-JARVIS-ERROR-AUDIT-01.md                                 | Historical detailed error evidence; sibling reports                                    | KEEP immutable historical evidence; not active authority and no new PASS inferred                                                                              | Partial                        |
| docs/audits/2026-09-27-jarvis/OCADE-JARVIS-ERROR-AUDIT-02.md                                 | Follow-up attack findings; sibling history                                             | KEEP historical evidence                                                                                                                                       | Partial                        |
| docs/audits/2026-09-27-jarvis/OCADE-JARVIS-current-main-final-report-2026-09-27.md           | Historical 855-check/52-finding summary at4c6893e; references sibling ledger/handoff   | KEEP dated conclusions; old extension recommendation superseded, physical/source labels preserved                                                              | Full                           |
| docs/audits/2026-09-27-jarvis/OCADE-JARVIS-current-main-implementation-handoff-2026-09-27.md | Historical detailed handoff and finding specifications                                 | KEEP historical evidence; do not make a second active implementation plan                                                                                      | Partial                        |
| docs/audits/2026-09-27-jarvis/OCADE-JARVIS-current-main-master-ledger-2026-09-26.md          | Historical evidence and all52findings                                                  | KEEP historical evidence; reference baseline before reuse                                                                                                      | Partial                        |
| imports/ocade-jarvis/CLAUDE.md                                                               | Donor preservation/adaptation authority                                                | KEEP unchanged; immutable imports excluded from cleanup                                                                                                        | Full                           |
| imports/ocade-jarvis/README.md                                                               | Intake provenance and approved adaptation boundaries                                   | KEEP unchanged; root current authority clarifies superseded instructions                                                                                       | Full                           |
| imports/ocade-jarvis/source-original/ocade jarvis 25-09/README.md                            | Original source package capability/security/licensing description                      | KEEP unchanged, no formatting or source mutation                                                                                                               | Full                           |
| jarvis-runtime/README.md                                                                     | Active runtime entrypoint; obsolete phase and toolchain refs                           | REWRITE short entrypoint and links to canonical ARCHITECTURE/TESTING/PLAN, preserve bundled wake/tray/Online-only boundaries                                   | Full                           |
| OCADE_GLOBAL_AI_COMPETITION_AND_MASTER_REDESIGN.md                                           | New owner-requested permanent research/report                                          | ADD dated research/evidence and disposition report; non-authoritative rationale, PLAN remains work order                                                       | Parent-owned new file          |

All prior phase1–56 requirements are mapped in [Decisions](docs/DECISIONS.md). Deleted ledger history and exact original links are preserved there. No evidence establishes that deletion meant all findings were fixed. The old baseline remains recoverable without reinstating its conflicting instructions.

## Complete current-source inspection inventory

Baseline Git tree: **990 tracked files**. Conservative aggregate: **738 not fully read / inventory only**, **184 full source read / not runtime proof**, **68 partial / selected source or test regions**. Every baseline path is listed below. Full means substantive source read reported by the responsible reviewer; partial includes selected regions/test inventories. Unclassified paths are deliberately left not fully read rather than inferring coverage from fetching/searching. Binary assets are not treated as read source. All runtime/installed/physical/provider behaviour remains UNTESTED by this documentation mission except the separately recorded public liveness read.

Assigned backend inventory:634 files, 48 full/17 partial/569 not substantively read. Runtime:62 assigned files plus9 additional tests fully read;23 test/support files incomplete. UI: exact full/partial paths incorporated below. Overlap is deduplicated. These counts do not mean the requested entire-code audit is complete; the complete outstanding inventory is an explicit remaining implementation audit obligation.

| Baseline path                                                                                               | Inspection status                         |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `.claude/launch.json`                                                                                       | NOT FULLY READ / inventory only           |
| `.env.example`                                                                                              | NOT FULLY READ / inventory only           |
| `.gitattributes`                                                                                            | NOT FULLY READ / inventory only           |
| `.github/dependabot.yml`                                                                                    | NOT FULLY READ / inventory only           |
| `.github/workflows/ci.yml`                                                                                  | FULL SOURCE READ / not runtime proof      |
| `.github/workflows/cloudflare-production.yml`                                                               | FULL SOURCE READ / not runtime proof      |
| `.github/workflows/codeql.yml`                                                                              | NOT FULLY READ / inventory only           |
| `.github/workflows/offline-artifact.yml`                                                                    | NOT FULLY READ / inventory only           |
| `.gitignore`                                                                                                | NOT FULLY READ / inventory only           |
| `.node-version`                                                                                             | NOT FULLY READ / inventory only           |
| `.nvmrc`                                                                                                    | NOT FULLY READ / inventory only           |
| `.prettierignore`                                                                                           | NOT FULLY READ / inventory only           |
| `.prettierrc`                                                                                               | NOT FULLY READ / inventory only           |
| `AGENTS.md`                                                                                                 | FULL SOURCE READ / not runtime proof      |
| `CLAUDE.md`                                                                                                 | FULL SOURCE READ / not runtime proof      |
| `ELITE_PRODUCT_STRATEGY.md`                                                                                 | PARTIAL / selected source or test regions |
| `FINAL_AUDIT_LEDGER.md`                                                                                     | PARTIAL / selected source or test regions |
| `LICENSE`                                                                                                   | NOT FULLY READ / inventory only           |
| `PLAN.md`                                                                                                   | FULL SOURCE READ / not runtime proof      |
| `ToRemove.md`                                                                                               | FULL SOURCE READ / not runtime proof      |
| `android/AndroidManifest.xml`                                                                               | FULL SOURCE READ / not runtime proof      |
| `android/build.py`                                                                                          | FULL SOURCE READ / not runtime proof      |
| `android/res/values/strings.xml`                                                                            | FULL SOURCE READ / not runtime proof      |
| `android/res/xml/accessibility.xml`                                                                         | FULL SOURCE READ / not runtime proof      |
| `android/res/xml/network.xml`                                                                               | FULL SOURCE READ / not runtime proof      |
| `android/src/in/ocade/app/AgentService.java`                                                                | FULL SOURCE READ / not runtime proof      |
| `android/src/in/ocade/app/Boot.java`                                                                        | FULL SOURCE READ / not runtime proof      |
| `android/src/in/ocade/app/Bubble.java`                                                                      | FULL SOURCE READ / not runtime proof      |
| `android/src/in/ocade/app/Control.java`                                                                     | FULL SOURCE READ / not runtime proof      |
| `android/src/in/ocade/app/Identity.java`                                                                    | FULL SOURCE READ / not runtime proof      |
| `android/src/in/ocade/app/MainActivity.java`                                                                | FULL SOURCE READ / not runtime proof      |
| `android/src/in/ocade/app/OcadeAccessibility.java`                                                          | FULL SOURCE READ / not runtime proof      |
| `android/src/in/ocade/app/WakeModel.java`                                                                   | FULL SOURCE READ / not runtime proof      |
| `android/src/in/ocade/app/WakeService.java`                                                                 | FULL SOURCE READ / not runtime proof      |
| `android/test/WakeParity.java`                                                                              | FULL SOURCE READ / not runtime proof      |
| `docs/APP_FLOW.md`                                                                                          | FULL SOURCE READ / not runtime proof      |
| `docs/ARCHITECTURE.md`                                                                                      | FULL SOURCE READ / not runtime proof      |
| `docs/BILLING_AND_GLOBAL_COMMERCE.md`                                                                       | FULL SOURCE READ / not runtime proof      |
| `docs/Backend Schema.md`                                                                                    | FULL SOURCE READ / not runtime proof      |
| `docs/COMPANY_PRODUCT_AUTHORITY.md`                                                                         | FULL SOURCE READ / not runtime proof      |
| `docs/CONTROL_INVENTORY.md`                                                                                 | FULL SOURCE READ / not runtime proof      |
| `docs/DECISIONS.md`                                                                                         | FULL SOURCE READ / not runtime proof      |
| `docs/DEFERRED_GEMINI_ISSUES.md`                                                                            | FULL SOURCE READ / not runtime proof      |
| `docs/DESIGN.md`                                                                                            | FULL SOURCE READ / not runtime proof      |
| `docs/DONOR_CAPABILITY_LEDGER.md`                                                                           | PARTIAL / selected source or test regions |
| `docs/FINAL_MATRIX.md`                                                                                      | PARTIAL / selected source or test regions |
| `docs/IMPLEMENTATION_LEDGER.md`                                                                             | PARTIAL / selected source or test regions |
| `docs/JARVIS_DESIGN_SYSTEM.md`                                                                              | FULL SOURCE READ / not runtime proof      |
| `docs/JARVIS_DEVICE_ROADMAP.md`                                                                             | FULL SOURCE READ / not runtime proof      |
| `docs/MCP_ORCHESTRATION_AND_AUTONOMOUS_FIX_LOOP.md`                                                         | FULL SOURCE READ / not runtime proof      |
| `docs/MEMORY.md`                                                                                            | FULL SOURCE READ / not runtime proof      |
| `docs/MOBILE_DEVICE_CONTROL.md`                                                                             | FULL SOURCE READ / not runtime proof      |
| `docs/OWNER_ADMIN_BACKEND.md`                                                                               | FULL SOURCE READ / not runtime proof      |
| `docs/PRD.md`                                                                                               | FULL SOURCE READ / not runtime proof      |
| `docs/RULES.md`                                                                                             | FULL SOURCE READ / not runtime proof      |
| `docs/SUPPORT_LEGAL_SECURITY.md`                                                                            | FULL SOURCE READ / not runtime proof      |
| `docs/TESTING.md`                                                                                           | FULL SOURCE READ / not runtime proof      |
| `docs/TESTING_TOOLCHAIN.md`                                                                                 | FULL SOURCE READ / not runtime proof      |
| `docs/TRD.md`                                                                                               | FULL SOURCE READ / not runtime proof      |
| `docs/UI UX Brief.md`                                                                                       | FULL SOURCE READ / not runtime proof      |
| `docs/UI_REFERENCE_CHECKLIST.md`                                                                            | FULL SOURCE READ / not runtime proof      |
| `docs/audits/2026-09-27-jarvis/OCADE-JARVIS-ERROR-AUDIT-01.md`                                              | PARTIAL / selected source or test regions |
| `docs/audits/2026-09-27-jarvis/OCADE-JARVIS-ERROR-AUDIT-02.md`                                              | PARTIAL / selected source or test regions |
| `docs/audits/2026-09-27-jarvis/OCADE-JARVIS-current-main-final-report-2026-09-27.md`                        | FULL SOURCE READ / not runtime proof      |
| `docs/audits/2026-09-27-jarvis/OCADE-JARVIS-current-main-implementation-handoff-2026-09-27.md`              | PARTIAL / selected source or test regions |
| `docs/audits/2026-09-27-jarvis/OCADE-JARVIS-current-main-master-ledger-2026-09-26.md`                       | PARTIAL / selected source or test regions |
| `docs/design-references/grok/Screenshot (122).png`                                                          | NOT FULLY READ / inventory only           |
| `docs/design-references/grok/Screenshot (123).png`                                                          | NOT FULLY READ / inventory only           |
| `docs/design-references/grok/Screenshot (124).png`                                                          | NOT FULLY READ / inventory only           |
| `docs/design-references/grok/Screenshot (125).png`                                                          | NOT FULLY READ / inventory only           |
| `docs/design-references/grok/Screenshot (126).png`                                                          | NOT FULLY READ / inventory only           |
| `docs/design-references/grok/Screenshot (127).png`                                                          | NOT FULLY READ / inventory only           |
| `docs/design-references/grok/Screenshot (128).png`                                                          | NOT FULLY READ / inventory only           |
| `docs/design-references/grok/Screenshot (129).png`                                                          | NOT FULLY READ / inventory only           |
| `docs/design-references/grok/Screenshot (130).png`                                                          | NOT FULLY READ / inventory only           |
| `docs/design-references/grok/Screenshot (131).png`                                                          | NOT FULLY READ / inventory only           |
| `docs/design-references/grok/Screenshot (132).png`                                                          | NOT FULLY READ / inventory only           |
| `docs/email/magic-link-or-otp.html`                                                                         | NOT FULLY READ / inventory only           |
| `eslint.config.js`                                                                                          | NOT FULLY READ / inventory only           |
| `imports/UI OCADE JARVIS.zip`                                                                               | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/CLAUDE.md`                                                                            | FULL SOURCE READ / not runtime proof      |
| `imports/ocade-jarvis/LICENSE`                                                                              | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/README.md`                                                                            | FULL SOURCE READ / not runtime proof      |
| `imports/ocade-jarvis/ocade jarvis 25-09.zip`                                                               | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original.sha256`                                                               | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/.gitignore`                                        | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/LICENSE`                                           | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/README.md`                                         | FULL SOURCE READ / not runtime proof      |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/background_monitor.py`                     | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/browser_control.py`                        | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/code_helper.py`                            | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/computer_control.py`                       | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/computer_settings.py`                      | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/desktop.py`                                | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/dev_agent.py`                              | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/file_controller.py`                        | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/file_processor.py`                         | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/flight_finder.py`                          | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/game_updater.py`                           | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/open_app.py`                               | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/proactive.py`                              | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/reminder.py`                               | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/screen_processor.py`                       | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/send_message.py`                           | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/system_monitor.py`                         | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/weather_report.py`                         | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/web_search.py`                             | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/actions/youtube_video.py`                          | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/config/__init__.py`                                | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/config/jarvis.ico`                                 | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/__init__.py`                                  | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/action_loader.py`                             | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/audio_devices.py`                             | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/avatar.py`                                    | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/avatar_mesh.py`                               | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/confirm.py`                                   | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/echo.py`                                      | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/face_model.obj`                               | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/gemini.py`                                    | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/hotkey.py`                                    | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/installer.py`                                 | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/llm_client.py`                                | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/plugin_loader.py`                             | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/prompt.txt`                                   | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/stt.py`                                       | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/tts.py`                                       | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/undo.py`                                      | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/viseme.py`                                    | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/core/wake_word.py`                                 | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/__init__.py`                             | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/server.py`                               | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/static/app.html`                         | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/static/crypto-js.min.js`                 | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/dashboard/static/login.html`                       | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/main.py`                                           | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/memory/__init__.py`                                | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/memory/config_manager.py`                          | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/memory/memory_manager.py`                          | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/plugins/__init__.py`                               | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/plugins/_template.py`                              | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/requirements.txt`                                  | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/setup.py`                                          | NOT FULLY READ / inventory only           |
| `imports/ocade-jarvis/source-original/ocade jarvis 25-09/ui.py`                                             | NOT FULLY READ / inventory only           |
| `jarvis-runtime/.gitignore`                                                                                 | NOT FULLY READ / inventory only           |
| `jarvis-runtime/LICENSE`                                                                                    | NOT FULLY READ / inventory only           |
| `jarvis-runtime/README.md`                                                                                  | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/actions/browser_control.py`                                                                 | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/actions/ocade_excel.ps1`                                                                    | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/actions/ocade_page.js`                                                                      | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/actions/ocade_word.ps1`                                                                     | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/config/__init__.py`                                                                         | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/config/jarvis.ico`                                                                          | NOT FULLY READ / inventory only           |
| `jarvis-runtime/ocade_accessibility.py`                                                                     | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/ocade_agent.py`                                                                             | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/ocade_computer.py`                                                                          | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/ocade_device.py`                                                                            | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/ocade_discovery.py`                                                                         | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/ocade_documents.py`                                                                         | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/ocade_egress.py`                                                                            | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/ocade_existing_browser.py`                                                                  | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/ocade_identity.py`                                                                          | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/ocade_protocol.json`                                                                        | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/ocade_settings.py`                                                                          | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/ocade_sheets.py`                                                                            | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/ocade_update.py`                                                                            | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/ocade_wake.py`                                                                              | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/packaging/macos/build.sh`                                                                   | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/packaging/macos/entitlements.plist`                                                         | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/packaging/ocade-agent.spec`                                                                 | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/packaging/release.py`                                                                       | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/packaging/windows/ocade-agent.iss`                                                          | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/requirements-agent.txt`                                                                     | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/tests/command_cases.json`                                                                   | PARTIAL / selected source or test regions |
| `jarvis-runtime/tests/conftest.py`                                                                          | PARTIAL / selected source or test regions |
| `jarvis-runtime/tests/manual_existing_chrome.py`                                                            | PARTIAL / selected source or test regions |
| `jarvis-runtime/tests/manual_feed_update.py`                                                                | PARTIAL / selected source or test regions |
| `jarvis-runtime/tests/manual_installed_lifecycle.py`                                                        | PARTIAL / selected source or test regions |
| `jarvis-runtime/tests/manual_real_update.py`                                                                | PARTIAL / selected source or test regions |
| `jarvis-runtime/tests/manual_tray_probe.py`                                                                 | PARTIAL / selected source or test regions |
| `jarvis-runtime/tests/test_agent.py`                                                                        | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/tests/test_browser_control.py`                                                              | PARTIAL / selected source or test regions |
| `jarvis-runtime/tests/test_computer.py`                                                                     | PARTIAL / selected source or test regions |
| `jarvis-runtime/tests/test_discovery.py`                                                                    | PARTIAL / selected source or test regions |
| `jarvis-runtime/tests/test_existing_browser.py`                                                             | PARTIAL / selected source or test regions |
| `jarvis-runtime/tests/test_files_documents.py`                                                              | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/tests/test_safety.py`                                                                       | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/tests/test_sheets.py`                                                                       | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/tests/test_ui_act.py`                                                                       | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/tests/test_update.py`                                                                       | PARTIAL / selected source or test regions |
| `jarvis-runtime/tests/test_wake.py`                                                                         | PARTIAL / selected source or test regions |
| `jarvis-runtime/wake/manifest.json`                                                                         | FULL SOURCE READ / not runtime proof      |
| `jarvis-runtime/wake/manifest.sig`                                                                          | NOT FULLY READ / inventory only           |
| `jarvis-runtime/wake/ocade_wake_v1.npz`                                                                     | NOT FULLY READ / inventory only           |
| `nitro.config.ts`                                                                                           | NOT FULLY READ / inventory only           |
| `package-lock.json`                                                                                         | NOT FULLY READ / inventory only           |
| `package.json`                                                                                              | FULL SOURCE READ / not runtime proof      |
| `public/apple-touch-icon.png`                                                                               | NOT FULLY READ / inventory only           |
| `public/brand/ocade-og.png`                                                                                 | NOT FULLY READ / inventory only           |
| `public/favicon.ico`                                                                                        | NOT FULLY READ / inventory only           |
| `public/fonts/OFL-Inter.txt`                                                                                | NOT FULLY READ / inventory only           |
| `public/fonts/OFL-JetBrainsMono.txt`                                                                        | NOT FULLY READ / inventory only           |
| `public/fonts/inter-latin.woff2`                                                                            | NOT FULLY READ / inventory only           |
| `public/fonts/jetbrains-mono-latin.woff2`                                                                   | NOT FULLY READ / inventory only           |
| `public/icons/ocade-192.png`                                                                                | NOT FULLY READ / inventory only           |
| `public/icons/ocade-512.png`                                                                                | NOT FULLY READ / inventory only           |
| `public/manifest.webmanifest`                                                                               | NOT FULLY READ / inventory only           |
| `public/offline.html`                                                                                       | NOT FULLY READ / inventory only           |
| `public/sw.js`                                                                                              | NOT FULLY READ / inventory only           |
| `release/OCADE_OFFLINE_RELEASE.json`                                                                        | NOT FULLY READ / inventory only           |
| `scripts/build-offline-artifact.mjs`                                                                        | NOT FULLY READ / inventory only           |
| `scripts/check-accessibility.mjs`                                                                           | FULL SOURCE READ / not runtime proof      |
| `scripts/check-bounded-reads.mjs`                                                                           | FULL SOURCE READ / not runtime proof      |
| `scripts/check-content-storage.mjs`                                                                         | NOT FULLY READ / inventory only           |
| `scripts/check-dead-controls.mjs`                                                                           | FULL SOURCE READ / not runtime proof      |
| `scripts/check-generated-stability.mjs`                                                                     | NOT FULLY READ / inventory only           |
| `scripts/check-model-identity.mjs`                                                                          | FULL SOURCE READ / not runtime proof      |
| `scripts/check-monochrome.mjs`                                                                              | FULL SOURCE READ / not runtime proof      |
| `scripts/check-reachability.mjs`                                                                            | NOT FULLY READ / inventory only           |
| `scripts/check-supabase-types.mjs`                                                                          | NOT FULLY READ / inventory only           |
| `scripts/db-twin.mts`                                                                                       | NOT FULLY READ / inventory only           |
| `scripts/deploy.d.mts`                                                                                      | NOT FULLY READ / inventory only           |
| `scripts/deploy.mjs`                                                                                        | PARTIAL / selected source or test regions |
| `scripts/e2e/admin-journey.mjs`                                                                             | NOT FULLY READ / inventory only           |
| `scripts/e2e/android-journey.mjs`                                                                           | NOT FULLY READ / inventory only           |
| `scripts/e2e/approve-device.mjs`                                                                            | NOT FULLY READ / inventory only           |
| `scripts/e2e/auth-journey.mjs`                                                                              | NOT FULLY READ / inventory only           |
| `scripts/e2e/browsers-journey.mjs`                                                                          | NOT FULLY READ / inventory only           |
| `scripts/e2e/bubble-journey.mjs`                                                                            | NOT FULLY READ / inventory only           |
| `scripts/e2e/carry-on-journey.mjs`                                                                          | NOT FULLY READ / inventory only           |
| `scripts/e2e/chat-journey.mjs`                                                                              | NOT FULLY READ / inventory only           |
| `scripts/e2e/controls-journey.mjs`                                                                          | NOT FULLY READ / inventory only           |
| `scripts/e2e/final-journey.mjs`                                                                             | NOT FULLY READ / inventory only           |
| `scripts/e2e/harness.mjs`                                                                                   | FULL SOURCE READ / not runtime proof      |
| `scripts/e2e/jarvis-journey.mjs`                                                                            | NOT FULLY READ / inventory only           |
| `scripts/e2e/library-journey.mjs`                                                                           | NOT FULLY READ / inventory only           |
| `scripts/e2e/live-usage-journey.mjs`                                                                        | NOT FULLY READ / inventory only           |
| `scripts/e2e/mfa-journey.mjs`                                                                               | NOT FULLY READ / inventory only           |
| `scripts/e2e/office-journey.mjs`                                                                            | NOT FULLY READ / inventory only           |
| `scripts/e2e/offline-journey.mjs`                                                                           | NOT FULLY READ / inventory only           |
| `scripts/e2e/online-journey.mjs`                                                                            | NOT FULLY READ / inventory only           |
| `scripts/e2e/polish-journey.mjs`                                                                            | NOT FULLY READ / inventory only           |
| `scripts/e2e/pricing-journey.mjs`                                                                           | NOT FULLY READ / inventory only           |
| `scripts/e2e/push-journey.mjs`                                                                              | NOT FULLY READ / inventory only           |
| `scripts/e2e/settings-journey.mjs`                                                                          | NOT FULLY READ / inventory only           |
| `scripts/e2e/shell-journey.mjs`                                                                             | NOT FULLY READ / inventory only           |
| `scripts/e2e/supabase-stub.mjs`                                                                             | NOT FULLY READ / inventory only           |
| `scripts/e2e/usage-journey.mjs`                                                                             | NOT FULLY READ / inventory only           |
| `scripts/e2e/visual-journey.mjs`                                                                            | NOT FULLY READ / inventory only           |
| `scripts/generate-routes.mjs`                                                                               | NOT FULLY READ / inventory only           |
| `scripts/measure-loc.mjs`                                                                                   | NOT FULLY READ / inventory only           |
| `scripts/prove-offline-artifact.mjs`                                                                        | NOT FULLY READ / inventory only           |
| `scripts/scan-bundle-secrets.mjs`                                                                           | NOT FULLY READ / inventory only           |
| `scripts/verify-full.mjs`                                                                                   | FULL SOURCE READ / not runtime proof      |
| `scripts/wake/__pycache__/make_data.cpython-312.pyc`                                                        | NOT FULLY READ / inventory only           |
| `scripts/wake/make_data.py`                                                                                 | NOT FULLY READ / inventory only           |
| `scripts/wake/sign_manifest.py`                                                                             | NOT FULLY READ / inventory only           |
| `scripts/wake/synthesize.ps1`                                                                               | NOT FULLY READ / inventory only           |
| `scripts/wake/train.py`                                                                                     | NOT FULLY READ / inventory only           |
| `src/cloudflare-entry.ts`                                                                                   | FULL SOURCE READ / not runtime proof      |
| `src/components/admin/ConsoleModules.tsx`                                                                   | PARTIAL / selected source or test regions |
| `src/components/chat/ChatWorkspace.tsx`                                                                     | PARTIAL / selected source or test regions |
| `src/components/chat/ConversationList.tsx`                                                                  | PARTIAL / selected source or test regions |
| `src/components/chat/MessageList.tsx`                                                                       | PARTIAL / selected source or test regions |
| `src/components/legal/LegalContent.tsx`                                                                     | NOT FULLY READ / inventory only           |
| `src/components/legal/legal-document-meta.ts`                                                               | NOT FULLY READ / inventory only           |
| `src/components/security/ConfirmIdentity.tsx`                                                               | NOT FULLY READ / inventory only           |
| `src/components/settings/AdvancedSection.tsx`                                                               | FULL SOURCE READ / not runtime proof      |
| `src/components/settings/BillingSection.tsx`                                                                | FULL SOURCE READ / not runtime proof      |
| `src/components/settings/DataControlsSection.tsx`                                                           | FULL SOURCE READ / not runtime proof      |
| `src/components/settings/NotificationsSection.tsx`                                                          | FULL SOURCE READ / not runtime proof      |
| `src/components/settings/SignInMethods.tsx`                                                                 | FULL SOURCE READ / not runtime proof      |
| `src/components/settings/TwoStep.tsx`                                                                       | PARTIAL / selected source or test regions |
| `src/components/settings/UsageSection.tsx`                                                                  | PARTIAL / selected source or test regions |
| `src/components/settings/rows.tsx`                                                                          | FULL SOURCE READ / not runtime proof      |
| `src/components/settings/settings-panel.tsx`                                                                | FULL SOURCE READ / not runtime proof      |
| `src/components/shell/AppShell.tsx`                                                                         | PARTIAL / selected source or test regions |
| `src/components/shell/AuthShell.tsx`                                                                        | NOT FULLY READ / inventory only           |
| `src/components/shell/BrandMark.tsx`                                                                        | NOT FULLY READ / inventory only           |
| `src/components/shell/ErrorBoundary.tsx`                                                                    | FULL SOURCE READ / not runtime proof      |
| `src/components/shell/PublicPage.tsx`                                                                       | NOT FULLY READ / inventory only           |
| `src/config/company-facts.ts`                                                                               | NOT FULLY READ / inventory only           |
| `src/integrations/supabase/auth-attacher.ts`                                                                | NOT FULLY READ / inventory only           |
| `src/integrations/supabase/auth-middleware.ts`                                                              | FULL SOURCE READ / not runtime proof      |
| `src/integrations/supabase/client.server.ts`                                                                | FULL SOURCE READ / not runtime proof      |
| `src/integrations/supabase/client.ts`                                                                       | NOT FULLY READ / inventory only           |
| `src/integrations/supabase/configuration-message.ts`                                                        | NOT FULLY READ / inventory only           |
| `src/integrations/supabase/configuration.ts`                                                                | NOT FULLY READ / inventory only           |
| `src/integrations/supabase/on-demand.ts`                                                                    | NOT FULLY READ / inventory only           |
| `src/integrations/supabase/types.ts`                                                                        | NOT FULLY READ / inventory only           |
| `src/jarvis/JarvisBubble.tsx`                                                                               | PARTIAL / selected source or test regions |
| `src/jarvis/JarvisBubbleGate.tsx`                                                                           | NOT FULLY READ / inventory only           |
| `src/jarvis/JarvisPanels.tsx`                                                                               | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/JarvisTask.tsx`                                                                                 | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/JarvisWorkspace.tsx`                                                                            | PARTIAL / selected source or test regions |
| `src/jarvis/Orb.tsx`                                                                                        | PARTIAL / selected source or test regions |
| `src/jarvis/__tests__/agent.test.ts`                                                                        | PARTIAL / selected source or test regions |
| `src/jarvis/__tests__/carry-on.test.ts`                                                                     | PARTIAL / selected source or test regions |
| `src/jarvis/__tests__/device-exchange.test.ts`                                                              | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/__tests__/device-protocol.test.ts`                                                              | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/__tests__/docs.test.ts`                                                                         | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/__tests__/execution-controls.test.ts`                                                           | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/__tests__/graph.test.ts`                                                                        | PARTIAL / selected source or test regions |
| `src/jarvis/__tests__/jarvis-rules.test.ts`                                                                 | PARTIAL / selected source or test regions |
| `src/jarvis/__tests__/jarvis-schema-against-postgres.test.ts`                                               | PARTIAL / selected source or test regions |
| `src/jarvis/__tests__/live-control.test.ts`                                                                 | PARTIAL / selected source or test regions |
| `src/jarvis/__tests__/rest-adapter.ts`                                                                      | PARTIAL / selected source or test regions |
| `src/jarvis/__tests__/schedule-time.test.ts`                                                                | PARTIAL / selected source or test regions |
| `src/jarvis/__tests__/schedules.test.ts`                                                                    | PARTIAL / selected source or test regions |
| `src/jarvis/__tests__/source-is-preserved.test.ts`                                                          | PARTIAL / selected source or test regions |
| `src/jarvis/agent.ts`                                                                                       | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/background-model.server.ts`                                                                     | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/background.server.ts`                                                                           | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/bubble-state.ts`                                                                                | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/changes.ts`                                                                                     | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/device.server.ts`                                                                               | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/docs.server.ts`                                                                                 | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/graph.ts`                                                                                       | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/jarvis.functions.ts`                                                                            | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/live-control.ts`                                                                                | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/live-deps.ts`                                                                                   | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/permissions.ts`                                                                                 | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/preferences.ts`                                                                                 | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/protocol.ts`                                                                                    | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/schedule-time.ts`                                                                               | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/schedules.server.ts`                                                                            | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/stop-everywhere.ts`                                                                             | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/task-authority.server.ts`                                                                       | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/task-row.ts`                                                                                    | FULL SOURCE READ / not runtime proof      |
| `src/jarvis/use-voice.ts`                                                                                   | FULL SOURCE READ / not runtime proof      |
| `src/lib/__tests__/a-failed-server-function-reaches-its-caller.test.ts`                                     | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/auth-middleware.test.ts`                                                                 | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/auth-provider-availability.test.ts`                                                      | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/browser-label.test.ts`                                                                   | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/closed-paths-against-postgres.test.ts`                                                   | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/content-security-policy.test.ts`                                                         | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/content-storage-gate.test.ts`                                                            | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/database-suites-are-serialised.test.ts`                                                  | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/deploy-workflow-agrees-with-controller.test.ts`                                          | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/ocade-is-a-website.test.ts`                                                              | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/one-account-cannot-see-another.test.ts`                                                  | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/one-canonical-origin.test.ts`                                                            | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/public-response-security.test.ts`                                                        | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/release-configuration-gate.test.ts`                                                      | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/route-parents-render-children.test.ts`                                                   | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/security-definer.test.ts`                                                                | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/service-only-tables-stay-closed.test.ts`                                                 | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/service-worker.test.ts`                                                                  | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/sitemap-lists-only-real-pages.test.ts`                                                   | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/supabase-configuration.test.ts`                                                          | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/supabase-live-hardening-sql.test.ts`                                                     | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/supabase-sql-discipline.test.ts`                                                         | NOT FULLY READ / inventory only           |
| `src/lib/__tests__/the-product-says-what-it-does.test.ts`                                                   | NOT FULLY READ / inventory only           |
| `src/lib/account-data.functions.ts`                                                                         | FULL SOURCE READ / not runtime proof      |
| `src/lib/account.functions.ts`                                                                              | FULL SOURCE READ / not runtime proof      |
| `src/lib/account/__tests__/a-deletion-leaves-a-record.test.ts`                                              | NOT FULLY READ / inventory only           |
| `src/lib/account/__tests__/data-rights-map.test.ts`                                                         | NOT FULLY READ / inventory only           |
| `src/lib/account/__tests__/data-rights.test.ts`                                                             | NOT FULLY READ / inventory only           |
| `src/lib/account/__tests__/deletion-checks-every-step.test.ts`                                              | NOT FULLY READ / inventory only           |
| `src/lib/account/data-classes.ts`                                                                           | PARTIAL / selected source or test regions |
| `src/lib/account/data-rights.ts`                                                                            | FULL SOURCE READ / not runtime proof      |
| `src/lib/account/erase.server.ts`                                                                           | FULL SOURCE READ / not runtime proof      |
| `src/lib/admin/__tests__/admin-device-removal.test.ts`                                                      | NOT FULLY READ / inventory only           |
| `src/lib/admin/__tests__/admin-operations-schema.test.ts`                                                   | NOT FULLY READ / inventory only           |
| `src/lib/admin/__tests__/an-operator-can-act.test.ts`                                                       | NOT FULLY READ / inventory only           |
| `src/lib/admin/__tests__/customer-detail-outage.test.ts`                                                    | NOT FULLY READ / inventory only           |
| `src/lib/admin/__tests__/customer-operations.test.ts`                                                       | NOT FULLY READ / inventory only           |
| `src/lib/admin/__tests__/jarvis-execution-control.test.ts`                                                  | NOT FULLY READ / inventory only           |
| `src/lib/admin/__tests__/owner-staff-on-site.test.ts`                                                       | NOT FULLY READ / inventory only           |
| `src/lib/admin/__tests__/staff-authority.test.ts`                                                           | NOT FULLY READ / inventory only           |
| `src/lib/admin/access.functions.ts`                                                                         | PARTIAL / selected source or test regions |
| `src/lib/admin/route-gate.ts`                                                                               | NOT FULLY READ / inventory only           |
| `src/lib/admin/staff.functions.ts`                                                                          | PARTIAL / selected source or test regions |
| `src/lib/after-hydration.ts`                                                                                | NOT FULLY READ / inventory only           |
| `src/lib/agent/__tests__/release.test.ts`                                                                   | NOT FULLY READ / inventory only           |
| `src/lib/agent/release.functions.ts`                                                                        | NOT FULLY READ / inventory only           |
| `src/lib/agent/release.ts`                                                                                  | NOT FULLY READ / inventory only           |
| `src/lib/appearance.tsx`                                                                                    | NOT FULLY READ / inventory only           |
| `src/lib/auth/__tests__/auth-surfaces.test.ts`                                                              | NOT FULLY READ / inventory only           |
| `src/lib/auth/__tests__/safe-next.test.ts`                                                                  | NOT FULLY READ / inventory only           |
| `src/lib/auth/__tests__/session-failure.test.ts`                                                            | NOT FULLY READ / inventory only           |
| `src/lib/auth/__tests__/throttle.test.ts`                                                                   | NOT FULLY READ / inventory only           |
| `src/lib/auth/oauth-errors.ts`                                                                              | NOT FULLY READ / inventory only           |
| `src/lib/auth/otp.ts`                                                                                       | NOT FULLY READ / inventory only           |
| `src/lib/auth/provider-availability.ts`                                                                     | NOT FULLY READ / inventory only           |
| `src/lib/auth/recovery-link.ts`                                                                             | NOT FULLY READ / inventory only           |
| `src/lib/auth/safe-next.ts`                                                                                 | NOT FULLY READ / inventory only           |
| `src/lib/auth/session-failure.ts`                                                                           | NOT FULLY READ / inventory only           |
| `src/lib/auth/throttle.ts`                                                                                  | NOT FULLY READ / inventory only           |
| `src/lib/brain/__tests__/a-model-already-here-needs-no-room.test.ts`                                        | NOT FULLY READ / inventory only           |
| `src/lib/brain/__tests__/a-phone-that-cannot-hold-the-model.test.ts`                                        | NOT FULLY READ / inventory only           |
| `src/lib/brain/__tests__/a-refused-browser-prepares-nothing.test.ts`                                        | NOT FULLY READ / inventory only           |
| `src/lib/brain/__tests__/a-verified-model-survives.test.ts`                                                 | FULL SOURCE READ / not runtime proof      |
| `src/lib/brain/__tests__/an-update-does-not-redownload.test.ts`                                             | FULL SOURCE READ / not runtime proof      |
| `src/lib/brain/__tests__/delivery-signature.test.ts`                                                        | NOT FULLY READ / inventory only           |
| `src/lib/brain/__tests__/download-plan.test.ts`                                                             | NOT FULLY READ / inventory only           |
| `src/lib/brain/__tests__/install-once.test.ts`                                                              | NOT FULLY READ / inventory only           |
| `src/lib/brain/__tests__/model-vault.test.ts`                                                               | NOT FULLY READ / inventory only           |
| `src/lib/brain/__tests__/offline-release.test.ts`                                                           | NOT FULLY READ / inventory only           |
| `src/lib/brain/__tests__/one-chat-never-hears-another.test.ts`                                              | NOT FULLY READ / inventory only           |
| `src/lib/brain/__tests__/reasoning-filter.test.ts`                                                          | NOT FULLY READ / inventory only           |
| `src/lib/brain/__tests__/removal-is-permanent.test.ts`                                                      | NOT FULLY READ / inventory only           |
| `src/lib/brain/__tests__/removal-says-what-happened.test.ts`                                                | NOT FULLY READ / inventory only           |
| `src/lib/brain/__tests__/streaming-digest.test.ts`                                                          | NOT FULLY READ / inventory only           |
| `src/lib/brain/__tests__/wasm-threads.test.ts`                                                              | NOT FULLY READ / inventory only           |
| `src/lib/brain/adapter.ts`                                                                                  | NOT FULLY READ / inventory only           |
| `src/lib/brain/adapters/browser-wasm.ts`                                                                    | PARTIAL / selected source or test regions |
| `src/lib/brain/delivery-signature.ts`                                                                       | FULL SOURCE READ / not runtime proof      |
| `src/lib/brain/download-plan.ts`                                                                            | NOT FULLY READ / inventory only           |
| `src/lib/brain/install-telemetry.ts`                                                                        | NOT FULLY READ / inventory only           |
| `src/lib/brain/installation-authority.ts`                                                                   | PARTIAL / selected source or test regions |
| `src/lib/brain/installation-browser.ts`                                                                     | FULL SOURCE READ / not runtime proof      |
| `src/lib/brain/installation-state.ts`                                                                       | NOT FULLY READ / inventory only           |
| `src/lib/brain/model-store.ts`                                                                              | PARTIAL / selected source or test regions |
| `src/lib/brain/model-transfer.ts`                                                                           | PARTIAL / selected source or test regions |
| `src/lib/brain/model-vault.ts`                                                                              | PARTIAL / selected source or test regions |
| `src/lib/brain/offline-release.functions.ts`                                                                | FULL SOURCE READ / not runtime proof      |
| `src/lib/brain/offline-release.ts`                                                                          | FULL SOURCE READ / not runtime proof      |
| `src/lib/brain/runtime-activation.ts`                                                                       | FULL SOURCE READ / not runtime proof      |
| `src/lib/brain/sampler-settings.ts`                                                                         | NOT FULLY READ / inventory only           |
| `src/lib/brain/streaming-digest.ts`                                                                         | NOT FULLY READ / inventory only           |
| `src/lib/brain/use-installation.ts`                                                                         | FULL SOURCE READ / not runtime proof      |
| `src/lib/brain/wasm-threads.ts`                                                                             | NOT FULLY READ / inventory only           |
| `src/lib/browser-install-id.ts`                                                                             | NOT FULLY READ / inventory only           |
| `src/lib/chat/__tests__/a-send-belongs-to-one-screen.test.ts`                                               | NOT FULLY READ / inventory only           |
| `src/lib/chat/__tests__/attachments.test.ts`                                                                | NOT FULLY READ / inventory only           |
| `src/lib/chat/__tests__/offline-turns-reach-the-account.test.ts`                                            | NOT FULLY READ / inventory only           |
| `src/lib/chat/__tests__/regenerate-drops-turns-atomically.test.ts`                                          | NOT FULLY READ / inventory only           |
| `src/lib/chat/attachments.ts`                                                                               | NOT FULLY READ / inventory only           |
| `src/lib/chat/unsynced-turns.ts`                                                                            | FULL SOURCE READ / not runtime proof      |
| `src/lib/chat/use-chat.ts`                                                                                  | PARTIAL / selected source or test regions |
| `src/lib/chat/use-dictation.ts`                                                                             | NOT FULLY READ / inventory only           |
| `src/lib/chat/use-shortcuts.ts`                                                                             | NOT FULLY READ / inventory only           |
| `src/lib/commercial/__tests__/device-identity.test.ts`                                                      | NOT FULLY READ / inventory only           |
| `src/lib/commercial/__tests__/device-registration-against-postgres.test.ts`                                 | NOT FULLY READ / inventory only           |
| `src/lib/commercial/__tests__/entitlement-resolver.test.ts`                                                 | NOT FULLY READ / inventory only           |
| `src/lib/commercial/__tests__/every-ai-surface-is-gated.test.ts`                                            | NOT FULLY READ / inventory only           |
| `src/lib/commercial/__tests__/gate-against-postgres.test.ts`                                                | NOT FULLY READ / inventory only           |
| `src/lib/commercial/__tests__/generation-gate.test.ts`                                                      | NOT FULLY READ / inventory only           |
| `src/lib/commercial/__tests__/ledger-against-postgres.test.ts`                                              | NOT FULLY READ / inventory only           |
| `src/lib/commercial/__tests__/offline-allowance.test.ts`                                                    | NOT FULLY READ / inventory only           |
| `src/lib/commercial/__tests__/offline-capacity-against-postgres.test.ts`                                    | NOT FULLY READ / inventory only           |
| `src/lib/commercial/__tests__/offline-closure.test.ts`                                                      | NOT FULLY READ / inventory only           |
| `src/lib/commercial/__tests__/offline-counter.test.ts`                                                      | NOT FULLY READ / inventory only           |
| `src/lib/commercial/__tests__/offline-lease.test.ts`                                                        | NOT FULLY READ / inventory only           |
| `src/lib/commercial/__tests__/service-role-authority.test.ts`                                               | NOT FULLY READ / inventory only           |
| `src/lib/commercial/__tests__/supabase-ledger.test.ts`                                                      | NOT FULLY READ / inventory only           |
| `src/lib/commercial/__tests__/usage-policy.test.ts`                                                         | NOT FULLY READ / inventory only           |
| `src/lib/commercial/__tests__/use-generation-permit.test.ts`                                                | NOT FULLY READ / inventory only           |
| `src/lib/commercial/device-identity.ts`                                                                     | FULL SOURCE READ / not runtime proof      |
| `src/lib/commercial/entitlement-resolver.ts`                                                                | FULL SOURCE READ / not runtime proof      |
| `src/lib/commercial/generation-gate.ts`                                                                     | FULL SOURCE READ / not runtime proof      |
| `src/lib/commercial/offline-allowance.ts`                                                                   | PARTIAL / selected source or test regions |
| `src/lib/commercial/offline-counter.ts`                                                                     | PARTIAL / selected source or test regions |
| `src/lib/commercial/offline-devices.ts`                                                                     | NOT FULLY READ / inventory only           |
| `src/lib/commercial/offline-lease.server.ts`                                                                | FULL SOURCE READ / not runtime proof      |
| `src/lib/commercial/offline-lease.ts`                                                                       | PARTIAL / selected source or test regions |
| `src/lib/commercial/offline-usage.functions.ts`                                                             | FULL SOURCE READ / not runtime proof      |
| `src/lib/commercial/supabase-ledger.ts`                                                                     | FULL SOURCE READ / not runtime proof      |
| `src/lib/commercial/usage-policy.ts`                                                                        | FULL SOURCE READ / not runtime proof      |
| `src/lib/commercial/usage.functions.ts`                                                                     | FULL SOURCE READ / not runtime proof      |
| `src/lib/commercial/use-commercial-usage.ts`                                                                | NOT FULLY READ / inventory only           |
| `src/lib/commercial/use-generation-permit.ts`                                                               | NOT FULLY READ / inventory only           |
| `src/lib/error-capture.ts`                                                                                  | NOT FULLY READ / inventory only           |
| `src/lib/error-page.ts`                                                                                     | NOT FULLY READ / inventory only           |
| `src/lib/health.ts`                                                                                         | NOT FULLY READ / inventory only           |
| `src/lib/intelligence/__tests__/edge-handler.test.ts`                                                       | NOT FULLY READ / inventory only           |
| `src/lib/intelligence/__tests__/offline-transport.test.ts`                                                  | NOT FULLY READ / inventory only           |
| `src/lib/intelligence/__tests__/online-boundary.test.ts`                                                    | NOT FULLY READ / inventory only           |
| `src/lib/intelligence/__tests__/online-client.test.ts`                                                      | NOT FULLY READ / inventory only           |
| `src/lib/intelligence/__tests__/pinned-model.test.ts`                                                       | NOT FULLY READ / inventory only           |
| `src/lib/intelligence/__tests__/router.test.ts`                                                             | NOT FULLY READ / inventory only           |
| `src/lib/intelligence/contract.ts`                                                                          | NOT FULLY READ / inventory only           |
| `src/lib/intelligence/edge-handler.ts`                                                                      | FULL SOURCE READ / not runtime proof      |
| `src/lib/intelligence/ocade-intelligence.ts`                                                                | NOT FULLY READ / inventory only           |
| `src/lib/intelligence/offline-transport.ts`                                                                 | NOT FULLY READ / inventory only           |
| `src/lib/intelligence/online-client.ts`                                                                     | NOT FULLY READ / inventory only           |
| `src/lib/intelligence/online-models.ts`                                                                     | NOT FULLY READ / inventory only           |
| `src/lib/intelligence/router.ts`                                                                            | NOT FULLY READ / inventory only           |
| `src/lib/library/__tests__/an-upload-is-hostile-input.test.ts`                                              | NOT FULLY READ / inventory only           |
| `src/lib/library/__tests__/library-schema.test.ts`                                                          | NOT FULLY READ / inventory only           |
| `src/lib/library/library.functions.ts`                                                                      | FULL SOURCE READ / not runtime proof      |
| `src/lib/library/tombstones.server.ts`                                                                      | FULL SOURCE READ / not runtime proof      |
| `src/lib/media-type.ts`                                                                                     | NOT FULLY READ / inventory only           |
| `src/lib/notifications/__tests__/delivery-state.test.ts`                                                    | NOT FULLY READ / inventory only           |
| `src/lib/notifications/__tests__/notification-preferences.test.ts`                                          | NOT FULLY READ / inventory only           |
| `src/lib/notifications/__tests__/notification-schema.test.ts`                                               | NOT FULLY READ / inventory only           |
| `src/lib/notifications/__tests__/notification-senders.test.ts`                                              | NOT FULLY READ / inventory only           |
| `src/lib/notifications/__tests__/preference-sync.test.ts`                                                   | NOT FULLY READ / inventory only           |
| `src/lib/notifications/__tests__/push-subscriptions.test.ts`                                                | NOT FULLY READ / inventory only           |
| `src/lib/notifications/__tests__/web-push.test.ts`                                                          | NOT FULLY READ / inventory only           |
| `src/lib/notifications/categories.ts`                                                                       | NOT FULLY READ / inventory only           |
| `src/lib/notifications/channels.ts`                                                                         | NOT FULLY READ / inventory only           |
| `src/lib/notifications/delivery.ts`                                                                         | NOT FULLY READ / inventory only           |
| `src/lib/notifications/history.ts`                                                                          | NOT FULLY READ / inventory only           |
| `src/lib/notifications/preference-sync.ts`                                                                  | NOT FULLY READ / inventory only           |
| `src/lib/notifications/preferences.ts`                                                                      | NOT FULLY READ / inventory only           |
| `src/lib/notifications/push-device.ts`                                                                      | NOT FULLY READ / inventory only           |
| `src/lib/notifications/send.server.ts`                                                                      | NOT FULLY READ / inventory only           |
| `src/lib/notifications/supabase-backend.ts`                                                                 | NOT FULLY READ / inventory only           |
| `src/lib/notifications/web-push.ts`                                                                         | NOT FULLY READ / inventory only           |
| `src/lib/ocade-chat-store.ts`                                                                               | PARTIAL / selected source or test regions |
| `src/lib/ocade.functions.ts`                                                                                | NOT FULLY READ / inventory only           |
| `src/lib/payments/__tests__/pricing.test.ts`                                                                | NOT FULLY READ / inventory only           |
| `src/lib/payments/pricing.ts`                                                                               | FULL SOURCE READ / not runtime proof      |
| `src/lib/public-identity.ts`                                                                                | NOT FULLY READ / inventory only           |
| `src/lib/release.ts`                                                                                        | NOT FULLY READ / inventory only           |
| `src/lib/security/__tests__/assurance.test.ts`                                                              | NOT FULLY READ / inventory only           |
| `src/lib/security/__tests__/caller-scoped-functions.test.ts`                                                | NOT FULLY READ / inventory only           |
| `src/lib/security/__tests__/identity.test.ts`                                                               | NOT FULLY READ / inventory only           |
| `src/lib/security/__tests__/mfa.test.ts`                                                                    | NOT FULLY READ / inventory only           |
| `src/lib/security/__tests__/reauthentication.test.ts`                                                       | NOT FULLY READ / inventory only           |
| `src/lib/security/__tests__/recovery-codes.test.ts`                                                         | NOT FULLY READ / inventory only           |
| `src/lib/security/__tests__/recovery-functions.test.ts`                                                     | NOT FULLY READ / inventory only           |
| `src/lib/security/__tests__/second-factor-enforced.test.ts`                                                 | NOT FULLY READ / inventory only           |
| `src/lib/security/__tests__/user-agent.test.ts`                                                             | NOT FULLY READ / inventory only           |
| `src/lib/security/assurance-middleware.ts`                                                                  | FULL SOURCE READ / not runtime proof      |
| `src/lib/security/assurance.ts`                                                                             | FULL SOURCE READ / not runtime proof      |
| `src/lib/security/caller-scoped-functions.ts`                                                               | NOT FULLY READ / inventory only           |
| `src/lib/security/identity.ts`                                                                              | NOT FULLY READ / inventory only           |
| `src/lib/security/isolation-upgrade.ts`                                                                     | NOT FULLY READ / inventory only           |
| `src/lib/security/isolation.ts`                                                                             | NOT FULLY READ / inventory only           |
| `src/lib/security/mfa.ts`                                                                                   | NOT FULLY READ / inventory only           |
| `src/lib/security/public-response.ts`                                                                       | PARTIAL / selected source or test regions |
| `src/lib/security/reauthentication.ts`                                                                      | NOT FULLY READ / inventory only           |
| `src/lib/security/recovery-codes.ts`                                                                        | NOT FULLY READ / inventory only           |
| `src/lib/security/recovery.functions.ts`                                                                    | FULL SOURCE READ / not runtime proof      |
| `src/lib/security/session-middleware.ts`                                                                    | FULL SOURCE READ / not runtime proof      |
| `src/lib/security/sessions.functions.ts`                                                                    | FULL SOURCE READ / not runtime proof      |
| `src/lib/security/user-agent.ts`                                                                            | NOT FULLY READ / inventory only           |
| `src/lib/session.ts`                                                                                        | NOT FULLY READ / inventory only           |
| `src/lib/supabase/read-all.ts`                                                                              | NOT FULLY READ / inventory only           |
| `src/lib/supabase/rpc-null.ts`                                                                              | NOT FULLY READ / inventory only           |
| `src/lib/telemetry/operation-health.ts`                                                                     | NOT FULLY READ / inventory only           |
| `src/lib/time/__tests__/trusted-clock.test.ts`                                                              | NOT FULLY READ / inventory only           |
| `src/lib/time/trusted-clock.ts`                                                                             | NOT FULLY READ / inventory only           |
| `src/lib/use-modal-focus.ts`                                                                                | NOT FULLY READ / inventory only           |
| `src/lib/utils.ts`                                                                                          | NOT FULLY READ / inventory only           |
| `src/nitro-virtual.d.ts`                                                                                    | NOT FULLY READ / inventory only           |
| `src/opfs.d.ts`                                                                                             | NOT FULLY READ / inventory only           |
| `src/routeTree.gen.ts`                                                                                      | NOT FULLY READ / inventory only           |
| `src/router.tsx`                                                                                            | FULL SOURCE READ / not runtime proof      |
| `src/routes/__root.tsx`                                                                                     | PARTIAL / selected source or test regions |
| `src/routes/_authenticated/admin.tsx`                                                                       | PARTIAL / selected source or test regions |
| `src/routes/_authenticated/library.tsx`                                                                     | FULL SOURCE READ / not runtime proof      |
| `src/routes/_authenticated/route.tsx`                                                                       | FULL SOURCE READ / not runtime proof      |
| `src/routes/about.tsx`                                                                                      | FULL SOURCE READ / not runtime proof      |
| `src/routes/agent.$file.ts`                                                                                 | NOT FULLY READ / inventory only           |
| `src/routes/api/jarvis/continue.ts`                                                                         | NOT FULLY READ / inventory only           |
| `src/routes/api/jarvis/device.ts`                                                                           | NOT FULLY READ / inventory only           |
| `src/routes/api/jarvis/enroll.ts`                                                                           | NOT FULLY READ / inventory only           |
| `src/routes/api/offline/bytes.$release.ts`                                                                  | NOT FULLY READ / inventory only           |
| `src/routes/auth.callback.tsx`                                                                              | PARTIAL / selected source or test regions |
| `src/routes/auth.challenge.tsx`                                                                             | PARTIAL / selected source or test regions |
| `src/routes/auth.index.tsx`                                                                                 | PARTIAL / selected source or test regions |
| `src/routes/auth.verify.tsx`                                                                                | PARTIAL / selected source or test regions |
| `src/routes/help.tsx`                                                                                       | PARTIAL / selected source or test regions |
| `src/routes/index.tsx`                                                                                      | FULL SOURCE READ / not runtime proof      |
| `src/routes/ocade-jarvis.tsx`                                                                               | FULL SOURCE READ / not runtime proof      |
| `src/routes/pricing.tsx`                                                                                    | FULL SOURCE READ / not runtime proof      |
| `src/routes/privacy.tsx`                                                                                    | FULL SOURCE READ / not runtime proof      |
| `src/routes/reset-password.tsx`                                                                             | PARTIAL / selected source or test regions |
| `src/routes/robots[.]txt.ts`                                                                                | FULL SOURCE READ / not runtime proof      |
| `src/routes/sitemap[.]xml.ts`                                                                               | FULL SOURCE READ / not runtime proof      |
| `src/routes/terms.tsx`                                                                                      | FULL SOURCE READ / not runtime proof      |
| `src/server.ts`                                                                                             | NOT FULLY READ / inventory only           |
| `src/shared/ui/tokens/monochrome.css`                                                                       | FULL SOURCE READ / not runtime proof      |
| `src/start.ts`                                                                                              | NOT FULLY READ / inventory only           |
| `src/styles.css`                                                                                            | FULL SOURCE READ / not runtime proof      |
| `supabase/config.toml`                                                                                      | NOT FULLY READ / inventory only           |
| `supabase/functions/_shared/boundary.ts`                                                                    | FULL SOURCE READ / not runtime proof      |
| `supabase/functions/ocade-intelligence-service/index.ts`                                                    | NOT FULLY READ / inventory only           |
| `supabase/functions/ocade-intelligence/index.ts`                                                            | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260720120222_c726faf2-f6d1-4d0c-9e47-9673aa43118b.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260720120249_bdd4f1d3-d4c4-4c34-b081-2d6c4097ba27.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721133830_b2cbc094-c460-48f3-b83d-6bf036acccc9.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721134240_2c1ea44a-fced-47ea-bcfd-35f528884460.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721134445_4eb84b03-6a68-40d0-9807-4579160d5272.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721134651_2bb0cf70-367a-4f56-b3f1-316e2169dee8.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721135143_0b16767c-014b-4e5c-8b9e-12375fdee710.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721135426_7ca3c6c6-09f8-4e19-aef2-ef225349c77b.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721135930_79977e44-6466-46ea-af1e-3e10bb1cc131.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721141946_382eee61-77fa-42d8-9b79-9c9c9b3195a3.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721142438_03071f4a-d755-4453-beea-10cd60c22e02.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721143021_71e195af-3680-4c89-be7c-b2d308c7ffcd.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721143529_267f9320-a8a8-4201-b074-064407905a75.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721144246_5e085aff-3cc9-4e69-a5cd-340b3e874977.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721144308_04ad5189-98bd-4055-987a-7d896a04cdd8.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721145409_97b93532-2d8c-4c35-a0ab-5d247f340a7a.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721145434_8280eace-1160-442d-88f7-1684c92485be.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721150351_1689e8de-f040-4796-bcd0-4976fea56113.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721150416_6c740641-3749-4958-8ca7-a5393e3feaf7.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721150450_7b63e109-84a8-4afe-94b1-e6420072c5f5.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721151128_8b196716-a97b-49aa-b37b-1e8b09d89101.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721151159_0c408ff6-94e9-427b-accf-8a37f4396eb6.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721151224_c158c078-599f-4d26-8144-6221fddac054.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721152101_c4b8b4e6-6d39-478f-a986-7da88cc3431f.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721152140_8be97c93-e5a2-494b-bf54-f83f9ae0f6e9.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721153321_92abb662-0ac2-4900-a2b6-5724104dd1bb.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260721160854_4e78525e-e484-4a81-b704-7df889e6d4e5.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260722090000_ocade_projects_outputs_memory.sql`                                      | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260722100000_ocade_subscriptions_usage.sql`                                          | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260722110000_ocade_automations.sql`                                                  | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260724211500_ocade_automation_worker.sql`                                            | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260730190000_ocade_controlled_rollout_gates.sql`                                     | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260803172048_07f01536-9981-4240-abe2-06d98cc07387.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260806120000_ocade_attachment_deletion.sql`                                          | FULL SOURCE READ / not runtime proof      |
| `supabase/migrations/20260815123219_b6afc017-4c53-405f-b498-96cb9cfb16f3.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260815123309_e4ac318c-6878-44d5-99d8-3aa45bab8f57.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260815123358_a5f5c31d-c096-4e93-a7db-8a0912f4566c.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260815123622_6d8f7052-38cb-4117-a197-5e7a74161b69.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260815193752_harden_security_definer_execute.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260815213627_ocade_billing_support_ledger.sql`                                       | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260815215000_ocade_billing_support_privilege_hardening.sql`                          | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260816082730_5e025ed8-1236-4e91-a86b-01fc1d248b99.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260816091131_cf164c67-50c9-4dff-96ac-9035b8f7bdb8.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260816094050_f439d6e0-528d-45e2-a4f5-7914e07c7b2f.sql`                               | PARTIAL / selected source or test regions |
| `supabase/migrations/20260817153000_atomic_device_revocation.sql`                                           | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260823090000_payment_webhook_audit.sql`                                              | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260823110000_atomic_payment_webhook_state.sql`                                       | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260823111000_payment_entitlement_invoker.sql`                                        | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260823140000_legal_consent_receipts.sql`                                             | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260824112227_live_supabase_security_hardening.sql`                                   | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260824112646_rls_and_foreign_key_performance.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260824112850_consolidate_permissive_rls_policies.sql`                                | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260824113306_fix_automation_enqueue_ambiguity.sql`                                   | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260824114319_provision_messenger_storage_bucket.sql`                                 | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260824184500_restore_has_role_authenticated_execute.sql`                             | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260825180000_expand_support_ticket_categories.sql`                                   | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260826023255_a405ac19-3482-43c6-b2de-ce2af897b3bd.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260827120000_has_role_answers_only_about_the_caller.sql`                             | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260827170000_record_demo_consumed_on_the_account.sql`                                | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260827180000_the_consent_table_was_built_twice.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260902090000_retire_demo_consumed_marker.sql`                                        | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260902100000_free_pro_max_catalogue.sql`                                             | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260902110000_commercial_usage_windows.sql`                                           | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260902120000_mfa_recovery_credentials.sql`                                           | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260902130000_account_session_authority.sql`                                          | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260904090000_notification_preferences_and_history.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260904120000_ocade_organizations_and_membership.sql`                                 | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260904130000_revoke_default_privilege_writes.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260904140000_organization_ownership_before_account_deletion.sql`                     | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260904150000_high_risk_organization_actions_require_recent_strong_auth.sql`          | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260904160000_organization_capability_and_tool_policies.sql`                          | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260904170000_admin_operations_read_surfaces.sql`                                     | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260904180000_status_incidents_and_maintenance.sql`                                   | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260904190000_support_article_publishing.sql`                                         | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260905090000_conversation_share_links.sql`                                           | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260907003328_commercial_generation_permits.sql`                                      | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260907011350_offline_usage_leases.sql`                                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260907073536_claim_generation_transport.sql`                                         | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260909120000_ocade_message_client_key.sql`                                           | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260909130000_ocade_side_conversations.sql`                                           | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260909140000_ocade_project_files_and_folders.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260909150000_ocade_output_provenance.sql`                                            | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260909160000_ocade_message_citations_and_reactions.sql`                              | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260909170000_devices_platform.sql`                                                   | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260909180000_ocade_approvals.sql`                                                    | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260909190000_ocade_tasks_and_comments.sql`                                           | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260909200000_ocade_monitors_and_browser_policy.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260910090000_policy_capability_account_storage.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260910100000_conversation_storage_is_the_account.sql`                                | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260910110000_one_read_policy_per_role.sql`                                           | FULL SOURCE READ / not runtime proof      |
| `supabase/migrations/20260910120000_index_every_cascade_path.sql`                                           | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260910130000_confirm_before_granting_workspace_access.sql`                           | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260910140000_conversation_trash_and_restore.sql`                                     | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260910150000_a_task_can_belong_to_a_project.sql`                                     | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260910160000_support_content_needs_a_case_grant.sql`                                 | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260910170000_index_the_support_access_foreign_key.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260911090000_one_entitlement_authority_and_admin_grants.sql`                         | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260911120000_a_plan_change_reaches_the_subscription_row.sql`                         | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260912090000_one_library_for_everything_a_person_keeps.sql`                          | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260912120000_remove_the_database_of_the_products_ocade_is_not.sql`                   | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260913050000_two_organization_helpers_outlived_their_product.sql`                    | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260918081533_profiles_usage_authority.sql`                                           | PARTIAL / selected source or test regions |
| `supabase/migrations/20260918132426_offline_signing_retry.sql`                                              | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260919090000_atomic_browser_device_registration.sql`                                 | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260920090000_device_revocation_is_not_client_writable.sql`                           | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260920100000_an_operator_can_find_any_account.sql`                                   | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260920110000_regenerate_drops_turns_atomically.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260923090000_close_client_write_paths.sql`                                           | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260923100000_retire_trash_payments_and_side_threads.sql`                             | FULL SOURCE READ / not runtime proof      |
| `supabase/migrations/20260925140000_drop_orphan_enums.sql`                                                  | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260926090000_ocade_jarvis_web.sql`                                                   | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260927090000_jarvis_device_identity.sql`                                             | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260929090000_jarvis_execution_control.sql`                                           | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260929100000_admin_device_removal.sql`                                               | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260929110000_scoped_jarvis_controls.sql`                                             | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260930090000_enrolled_accounts_need_their_second_factor.sql`                         | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260930091000_admin_changes_need_a_recent_second_factor.sql`                          | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260930092000_enrollment_cap_per_source.sql`                                          | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260930092500_an_ended_session_stops_at_once.sql`                                     | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260930093000_one_staff_authority.sql`                                                | PARTIAL / selected source or test regions |
| `supabase/migrations/20260930093500_a_staff_refusal_reads_correctly.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260930094000_staff_can_turn_off_a_lost_second_factor.sql`                            | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260930095000_jarvis_schedules.sql`                                                   | NOT FULLY READ / inventory only           |
| `supabase/migrations/20260930096000_android_devices.sql`                                                    | NOT FULLY READ / inventory only           |
| `supabase/migrations/20261001090000_staff_authority_only_in_the_console.sql`                                | FULL SOURCE READ / not runtime proof      |
| `supabase/migrations/20261001091000_web_push_subscriptions.sql`                                             | NOT FULLY READ / inventory only           |
| `supabase/migrations/20261001092000_retire_browser_extension.sql`                                           | NOT FULLY READ / inventory only           |
| `supabase/migrations/20261001093000_push_follows_the_session.sql`                                           | NOT FULLY READ / inventory only           |
| `supabase/migrations/20261001094000_a_claimed_permit_is_settled_by_the_server.sql`                          | FULL SOURCE READ / not runtime proof      |
| `supabase/migrations/20261001095000_a_factor_added_after_signing_in_needs_a_new_sign_in.sql`                | NOT FULLY READ / inventory only           |
| `supabase/migrations/20261001095100_the_console_needs_a_sign_in_after_a_new_factor.sql`                     | FULL SOURCE READ / not runtime proof      |
| `supabase/migrations/20261001095200_two_step_set_up_in_this_sign_in.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/migrations/20261001096000_staff_act_within_their_own_reach.sql`                                   | FULL SOURCE READ / not runtime proof      |
| `supabase/migrations/20261001096100_a_profile_address_is_the_sign_in_address.sql`                           | NOT FULLY READ / inventory only           |
| `supabase/migrations/20261002090000_owner_customer_operations.sql`                                          | FULL SOURCE READ / not runtime proof      |
| `supabase/migrations/20261003090000_owner_and_staff_consoles_on_ocade_in.sql`                               | FULL SOURCE READ / not runtime proof      |
| `supabase/migrations/20261006090000_cases_name_their_reader_and_conversation.sql`                           | FULL SOURCE READ / not runtime proof      |
| `supabase/migrations/20261007090000_action_results_are_events.sql`                                          | FULL SOURCE READ / not runtime proof      |
| `supabase/rollback/20260720120222_c726faf2-f6d1-4d0c-9e47-9673aa43118b_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260720120249_bdd4f1d3-d4c4-4c34-b081-2d6c4097ba27_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721133830_b2cbc094-c460-48f3-b83d-6bf036acccc9_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721134240_2c1ea44a-fced-47ea-bcfd-35f528884460_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721134445_4eb84b03-6a68-40d0-9807-4579160d5272_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721134651_2bb0cf70-367a-4f56-b3f1-316e2169dee8_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721135143_0b16767c-014b-4e5c-8b9e-12375fdee710_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721135426_7ca3c6c6-09f8-4e19-aef2-ef225349c77b_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721135930_79977e44-6466-46ea-af1e-3e10bb1cc131_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721141946_382eee61-77fa-42d8-9b79-9c9c9b3195a3_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721142438_03071f4a-d755-4453-beea-10cd60c22e02_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721143021_71e195af-3680-4c89-be7c-b2d308c7ffcd_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721143529_267f9320-a8a8-4201-b074-064407905a75_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721144246_5e085aff-3cc9-4e69-a5cd-340b3e874977_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721144308_04ad5189-98bd-4055-987a-7d896a04cdd8_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721145409_97b93532-2d8c-4c35-a0ab-5d247f340a7a_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721145434_8280eace-1160-442d-88f7-1684c92485be_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721150351_1689e8de-f040-4796-bcd0-4976fea56113_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721150416_6c740641-3749-4958-8ca7-a5393e3feaf7_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721150450_7b63e109-84a8-4afe-94b1-e6420072c5f5_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721151128_8b196716-a97b-49aa-b37b-1e8b09d89101_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721151159_0c408ff6-94e9-427b-accf-8a37f4396eb6_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721151224_c158c078-599f-4d26-8144-6221fddac054_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721152101_c4b8b4e6-6d39-478f-a986-7da88cc3431f_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721152140_8be97c93-e5a2-494b-bf54-f83f9ae0f6e9_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721153321_92abb662-0ac2-4900-a2b6-5724104dd1bb_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260721160854_4e78525e-e484-4a81-b704-7df889e6d4e5_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260722090000_ocade_projects_outputs_memory_rollback.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260722100000_ocade_subscriptions_usage_rollback.sql`                                   | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260722110000_ocade_automations_rollback.sql`                                           | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260724211500_ocade_automation_worker_rollback.sql`                                     | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260730190000_ocade_controlled_rollout_gates_rollback.sql`                              | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260803172048_07f01536-9981-4240-abe2-06d98cc07387_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260806120000_ocade_attachment_deletion_rollback.sql`                                   | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260815123219_b6afc017-4c53-405f-b498-96cb9cfb16f3_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260815123309_e4ac318c-6878-44d5-99d8-3aa45bab8f57_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260815123358_a5f5c31d-c096-4e93-a7db-8a0912f4566c_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260815123622_6d8f7052-38cb-4117-a197-5e7a74161b69_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260815193752_harden_security_definer_execute_rollback.sql`                             | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260815213627_ocade_billing_support_ledger_rollback.sql`                                | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260815215000_ocade_billing_support_privilege_hardening_rollback.sql`                   | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260816082730_5e025ed8-1236-4e91-a86b-01fc1d248b99_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260816091131_cf164c67-50c9-4dff-96ac-9035b8f7bdb8_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260816094050_f439d6e0-528d-45e2-a4f5-7914e07c7b2f_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260817153000_atomic_device_revocation_rollback.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260823090000_payment_webhook_audit_rollback.sql`                                       | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260823110000_atomic_payment_webhook_state_rollback.sql`                                | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260823111000_payment_entitlement_invoker_rollback.sql`                                 | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260823140000_legal_consent_receipts_rollback.sql`                                      | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260824112227_live_supabase_security_hardening_rollback.sql`                            | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260824112646_rls_and_foreign_key_performance_rollback.sql`                             | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260824112850_consolidate_permissive_rls_policies_rollback.sql`                         | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260824113306_fix_automation_enqueue_ambiguity_rollback.sql`                            | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260824114319_provision_messenger_storage_bucket_rollback.sql`                          | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260824184500_restore_has_role_authenticated_execute_rollback.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260825180000_expand_support_ticket_categories_rollback.sql`                            | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260826023255_a405ac19-3482-43c6-b2de-ce2af897b3bd_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260827120000_has_role_answers_only_about_the_caller_rollback.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260827170000_record_demo_consumed_on_the_account_rollback.sql`                         | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260827180000_the_consent_table_was_built_twice_rollback.sql`                           | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260902090000_retire_demo_consumed_marker_rollback.sql`                                 | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260902100000_free_pro_max_catalogue_rollback.sql`                                      | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260902110000_commercial_usage_windows_rollback.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260902120000_mfa_recovery_credentials_rollback.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260902130000_account_session_authority_rollback.sql`                                   | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260904090000_notification_preferences_and_history_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260904120000_ocade_organizations_and_membership_rollback.sql`                          | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260904130000_revoke_default_privilege_writes_rollback.sql`                             | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260904140000_organization_ownership_before_account_deletion_rollback.sql`              | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260904150000_high_risk_organization_actions_require_recent_strong_auth_rollback.sql`   | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260904160000_organization_capability_and_tool_policies_rollback.sql`                   | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260904170000_admin_operations_read_surfaces_rollback.sql`                              | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260904180000_status_incidents_and_maintenance_rollback.sql`                            | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260904190000_support_article_publishing_rollback.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260905090000_conversation_share_links_rollback.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260907003328_commercial_generation_permits_rollback.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260907011350_offline_usage_leases_rollback.sql`                                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260907073536_claim_generation_transport_rollback.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260909120000_ocade_message_client_key_rollback.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260909130000_ocade_side_conversations_rollback.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260909140000_ocade_project_files_and_folders_rollback.sql`                             | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260909150000_ocade_output_provenance_rollback.sql`                                     | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260909160000_ocade_message_citations_and_reactions_rollback.sql`                       | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260909170000_devices_platform_rollback.sql`                                            | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260909180000_ocade_approvals_rollback.sql`                                             | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260909190000_ocade_tasks_and_comments_rollback.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260909200000_ocade_monitors_and_browser_policy_rollback.sql`                           | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260910090000_policy_capability_account_storage_rollback.sql`                           | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260910100000_conversation_storage_is_the_account_rollback.sql`                         | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260910110000_one_read_policy_per_role_rollback.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260910120000_index_every_cascade_path_rollback.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260910130000_confirm_before_granting_workspace_access_rollback.sql`                    | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260910140000_conversation_trash_and_restore_rollback.sql`                              | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260910150000_a_task_can_belong_to_a_project_rollback.sql`                              | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260910160000_support_content_needs_a_case_grant_rollback.sql`                          | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260910170000_index_the_support_access_foreign_key_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260911090000_one_entitlement_authority_and_admin_grants_rollback.sql`                  | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260911120000_a_plan_change_reaches_the_subscription_row_rollback.sql`                  | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260912090000_one_library_for_everything_a_person_keeps_rollback.sql`                   | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260912120000_remove_the_database_of_the_products_ocade_is_not_rollback.sql`            | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260913050000_two_organization_helpers_outlived_their_product_rollback.sql`             | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260918081533_profiles_usage_authority_rollback.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260918132426_offline_signing_retry_rollback.sql`                                       | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260919090000_atomic_browser_device_registration_rollback.sql`                          | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260920090000_device_revocation_is_not_client_writable_rollback.sql`                    | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260920100000_an_operator_can_find_any_account_rollback.sql`                            | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260920110000_regenerate_drops_turns_atomically_rollback.sql`                           | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260923090000_close_client_write_paths_rollback.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260923100000_retire_trash_payments_and_side_threads_rollback.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260925140000_drop_orphan_enums_rollback.sql`                                           | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260926090000_ocade_jarvis_web_rollback.sql`                                            | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260927090000_jarvis_device_identity_rollback.sql`                                      | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260929090000_jarvis_execution_control_rollback.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260929100000_admin_device_removal_rollback.sql`                                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260929110000_scoped_jarvis_controls_rollback.sql`                                      | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260930090000_enrolled_accounts_need_their_second_factor_rollback.sql`                  | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260930091000_admin_changes_need_a_recent_second_factor_rollback.sql`                   | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260930092000_enrollment_cap_per_source_rollback.sql`                                   | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260930092500_an_ended_session_stops_at_once_rollback.sql`                              | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260930093000_one_staff_authority_rollback.sql`                                         | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260930093500_a_staff_refusal_reads_correctly_rollback.sql`                             | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260930094000_staff_can_turn_off_a_lost_second_factor_rollback.sql`                     | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260930095000_jarvis_schedules_rollback.sql`                                            | NOT FULLY READ / inventory only           |
| `supabase/rollback/20260930096000_android_devices_rollback.sql`                                             | NOT FULLY READ / inventory only           |
| `supabase/rollback/20261001090000_staff_authority_only_in_the_console_rollback.sql`                         | NOT FULLY READ / inventory only           |
| `supabase/rollback/20261001091000_web_push_subscriptions_rollback.sql`                                      | NOT FULLY READ / inventory only           |
| `supabase/rollback/20261001092000_retire_browser_extension_rollback.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/rollback/20261001093000_push_follows_the_session_rollback.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/rollback/20261001094000_a_claimed_permit_is_settled_by_the_server_rollback.sql`                   | NOT FULLY READ / inventory only           |
| `supabase/rollback/20261001095000_a_factor_added_after_signing_in_needs_a_new_sign_in_rollback.sql`         | NOT FULLY READ / inventory only           |
| `supabase/rollback/20261001095100_the_console_needs_a_sign_in_after_a_new_factor_rollback.sql`              | NOT FULLY READ / inventory only           |
| `supabase/rollback/20261001095200_two_step_set_up_in_this_sign_in_rollback.sql`                             | NOT FULLY READ / inventory only           |
| `supabase/rollback/20261001096000_staff_act_within_their_own_reach_rollback.sql`                            | NOT FULLY READ / inventory only           |
| `supabase/rollback/20261001096100_a_profile_address_is_the_sign_in_address_rollback.sql`                    | NOT FULLY READ / inventory only           |
| `supabase/rollback/20261002090000_owner_customer_operations_rollback.sql`                                   | NOT FULLY READ / inventory only           |
| `supabase/rollback/20261003090000_owner_and_staff_consoles_on_ocade_in_rollback.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/rollback/20261006090000_cases_name_their_reader_and_conversation_rollback.sql`                    | FULL SOURCE READ / not runtime proof      |
| `supabase/rollback/20261007090000_action_results_are_events_rollback.sql`                                   | FULL SOURCE READ / not runtime proof      |
| `supabase/verification/20260720120222_c726faf2-f6d1-4d0c-9e47-9673aa43118b_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260720120249_bdd4f1d3-d4c4-4c34-b081-2d6c4097ba27_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721133830_b2cbc094-c460-48f3-b83d-6bf036acccc9_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721134240_2c1ea44a-fced-47ea-bcfd-35f528884460_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721134445_4eb84b03-6a68-40d0-9807-4579160d5272_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721134651_2bb0cf70-367a-4f56-b3f1-316e2169dee8_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721135143_0b16767c-014b-4e5c-8b9e-12375fdee710_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721135426_7ca3c6c6-09f8-4e19-aef2-ef225349c77b_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721135930_79977e44-6466-46ea-af1e-3e10bb1cc131_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721141946_382eee61-77fa-42d8-9b79-9c9c9b3195a3_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721142438_03071f4a-d755-4453-beea-10cd60c22e02_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721143021_71e195af-3680-4c89-be7c-b2d308c7ffcd_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721143529_267f9320-a8a8-4201-b074-064407905a75_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721144246_5e085aff-3cc9-4e69-a5cd-340b3e874977_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721144308_04ad5189-98bd-4055-987a-7d896a04cdd8_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721145409_97b93532-2d8c-4c35-a0ab-5d247f340a7a_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721145434_8280eace-1160-442d-88f7-1684c92485be_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721150351_1689e8de-f040-4796-bcd0-4976fea56113_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721150416_6c740641-3749-4958-8ca7-a5393e3feaf7_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721150450_7b63e109-84a8-4afe-94b1-e6420072c5f5_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721151128_8b196716-a97b-49aa-b37b-1e8b09d89101_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721151159_0c408ff6-94e9-427b-accf-8a37f4396eb6_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721151224_c158c078-599f-4d26-8144-6221fddac054_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721152101_c4b8b4e6-6d39-478f-a986-7da88cc3431f_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721152140_8be97c93-e5a2-494b-bf54-f83f9ae0f6e9_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721153321_92abb662-0ac2-4900-a2b6-5724104dd1bb_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260721160854_4e78525e-e484-4a81-b704-7df889e6d4e5_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260722090000_ocade_projects_outputs_memory_verify.sql`                             | NOT FULLY READ / inventory only           |
| `supabase/verification/20260722100000_ocade_subscriptions_usage_verify.sql`                                 | NOT FULLY READ / inventory only           |
| `supabase/verification/20260722110000_ocade_automations_verify.sql`                                         | NOT FULLY READ / inventory only           |
| `supabase/verification/20260724211500_ocade_automation_worker_verify.sql`                                   | NOT FULLY READ / inventory only           |
| `supabase/verification/20260730190000_ocade_controlled_rollout_gates_verify.sql`                            | NOT FULLY READ / inventory only           |
| `supabase/verification/20260803172048_07f01536-9981-4240-abe2-06d98cc07387_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260806120000_ocade_attachment_deletion_verify.sql`                                 | NOT FULLY READ / inventory only           |
| `supabase/verification/20260815123219_b6afc017-4c53-405f-b498-96cb9cfb16f3_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260815123309_e4ac318c-6878-44d5-99d8-3aa45bab8f57_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260815123358_a5f5c31d-c096-4e93-a7db-8a0912f4566c_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260815123622_6d8f7052-38cb-4117-a197-5e7a74161b69_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260815193752_harden_security_definer_execute_verify.sql`                           | NOT FULLY READ / inventory only           |
| `supabase/verification/20260815213627_ocade_billing_support_ledger_verify.sql`                              | NOT FULLY READ / inventory only           |
| `supabase/verification/20260815215000_ocade_billing_support_privilege_hardening_verify.sql`                 | NOT FULLY READ / inventory only           |
| `supabase/verification/20260816082730_5e025ed8-1236-4e91-a86b-01fc1d248b99_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260816091131_cf164c67-50c9-4dff-96ac-9035b8f7bdb8_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260816094050_f439d6e0-528d-45e2-a4f5-7914e07c7b2f_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260817153000_atomic_device_revocation_verify.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/verification/20260823090000_payment_webhook_audit_verify.sql`                                     | NOT FULLY READ / inventory only           |
| `supabase/verification/20260823110000_atomic_payment_webhook_state_verify.sql`                              | NOT FULLY READ / inventory only           |
| `supabase/verification/20260823111000_payment_entitlement_invoker_verify.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/verification/20260823140000_legal_consent_receipts_verify.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/verification/20260824112227_live_supabase_security_hardening_verify.sql`                          | NOT FULLY READ / inventory only           |
| `supabase/verification/20260824112646_rls_and_foreign_key_performance_verify.sql`                           | NOT FULLY READ / inventory only           |
| `supabase/verification/20260824112850_consolidate_permissive_rls_policies_verify.sql`                       | NOT FULLY READ / inventory only           |
| `supabase/verification/20260824113306_fix_automation_enqueue_ambiguity_verify.sql`                          | NOT FULLY READ / inventory only           |
| `supabase/verification/20260824114319_provision_messenger_storage_bucket_verify.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/verification/20260824184500_restore_has_role_authenticated_execute_verify.sql`                    | NOT FULLY READ / inventory only           |
| `supabase/verification/20260825180000_expand_support_ticket_categories_verify.sql`                          | NOT FULLY READ / inventory only           |
| `supabase/verification/20260826023255_a405ac19-3482-43c6-b2de-ce2af897b3bd_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260827120000_has_role_answers_only_about_the_caller_verify.sql`                    | NOT FULLY READ / inventory only           |
| `supabase/verification/20260827170000_record_demo_consumed_on_the_account_verify.sql`                       | NOT FULLY READ / inventory only           |
| `supabase/verification/20260827180000_the_consent_table_was_built_twice_verify.sql`                         | NOT FULLY READ / inventory only           |
| `supabase/verification/20260902090000_retire_demo_consumed_marker_verify.sql`                               | NOT FULLY READ / inventory only           |
| `supabase/verification/20260902100000_free_pro_max_catalogue_verify.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/verification/20260902110000_commercial_usage_windows_verify.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/verification/20260902120000_mfa_recovery_credentials_verify.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/verification/20260902130000_account_session_authority_verify.sql`                                 | NOT FULLY READ / inventory only           |
| `supabase/verification/20260904090000_notification_preferences_and_history_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260904120000_ocade_organizations_and_membership_verify.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/verification/20260904130000_revoke_default_privilege_writes_verify.sql`                           | NOT FULLY READ / inventory only           |
| `supabase/verification/20260904140000_organization_ownership_before_account_deletion_verify.sql`            | NOT FULLY READ / inventory only           |
| `supabase/verification/20260904150000_high_risk_organization_actions_require_recent_strong_auth_verify.sql` | NOT FULLY READ / inventory only           |
| `supabase/verification/20260904160000_organization_capability_and_tool_policies_verify.sql`                 | NOT FULLY READ / inventory only           |
| `supabase/verification/20260904170000_admin_operations_read_surfaces_verify.sql`                            | NOT FULLY READ / inventory only           |
| `supabase/verification/20260904180000_status_incidents_and_maintenance_verify.sql`                          | NOT FULLY READ / inventory only           |
| `supabase/verification/20260904190000_support_article_publishing_verify.sql`                                | NOT FULLY READ / inventory only           |
| `supabase/verification/20260905090000_conversation_share_links_verify.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/verification/20260907003328_commercial_generation_permits_verify.sql`                             | NOT FULLY READ / inventory only           |
| `supabase/verification/20260907011350_offline_usage_leases_verify.sql`                                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260907073536_claim_generation_transport_verify.sql`                                | NOT FULLY READ / inventory only           |
| `supabase/verification/20260909120000_ocade_message_client_key_verify.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/verification/20260909130000_ocade_side_conversations_verify.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/verification/20260909140000_ocade_project_files_and_folders_verify.sql`                           | NOT FULLY READ / inventory only           |
| `supabase/verification/20260909150000_ocade_output_provenance_verify.sql`                                   | NOT FULLY READ / inventory only           |
| `supabase/verification/20260909160000_ocade_message_citations_and_reactions_verify.sql`                     | NOT FULLY READ / inventory only           |
| `supabase/verification/20260909170000_devices_platform_verify.sql`                                          | NOT FULLY READ / inventory only           |
| `supabase/verification/20260909180000_ocade_approvals_verify.sql`                                           | NOT FULLY READ / inventory only           |
| `supabase/verification/20260909190000_ocade_tasks_and_comments_verify.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/verification/20260909200000_ocade_monitors_and_browser_policy_verify.sql`                         | NOT FULLY READ / inventory only           |
| `supabase/verification/20260910090000_policy_capability_account_storage_verify.sql`                         | NOT FULLY READ / inventory only           |
| `supabase/verification/20260910100000_conversation_storage_is_the_account_verify.sql`                       | NOT FULLY READ / inventory only           |
| `supabase/verification/20260910110000_one_read_policy_per_role_verify.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/verification/20260910120000_index_every_cascade_path_verify.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/verification/20260910130000_confirm_before_granting_workspace_access_verify.sql`                  | NOT FULLY READ / inventory only           |
| `supabase/verification/20260910140000_conversation_trash_and_restore_verify.sql`                            | NOT FULLY READ / inventory only           |
| `supabase/verification/20260910150000_a_task_can_belong_to_a_project_verify.sql`                            | NOT FULLY READ / inventory only           |
| `supabase/verification/20260910160000_support_content_needs_a_case_grant_verify.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/verification/20260910170000_index_the_support_access_foreign_key_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260911090000_one_entitlement_authority_and_admin_grants_verify.sql`                | NOT FULLY READ / inventory only           |
| `supabase/verification/20260911120000_a_plan_change_reaches_the_subscription_row_verify.sql`                | NOT FULLY READ / inventory only           |
| `supabase/verification/20260912090000_one_library_for_everything_a_person_keeps_verify.sql`                 | NOT FULLY READ / inventory only           |
| `supabase/verification/20260912120000_remove_the_database_of_the_products_ocade_is_not_verify.sql`          | NOT FULLY READ / inventory only           |
| `supabase/verification/20260913050000_two_organization_helpers_outlived_their_product_verify.sql`           | NOT FULLY READ / inventory only           |
| `supabase/verification/20260918081533_profiles_usage_authority_verify.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/verification/20260918132426_offline_signing_retry_verify.sql`                                     | NOT FULLY READ / inventory only           |
| `supabase/verification/20260919090000_atomic_browser_device_registration_verify.sql`                        | NOT FULLY READ / inventory only           |
| `supabase/verification/20260920090000_device_revocation_is_not_client_writable_verify.sql`                  | NOT FULLY READ / inventory only           |
| `supabase/verification/20260920100000_an_operator_can_find_any_account_verify.sql`                          | NOT FULLY READ / inventory only           |
| `supabase/verification/20260920110000_regenerate_drops_turns_atomically_verify.sql`                         | NOT FULLY READ / inventory only           |
| `supabase/verification/20260923090000_close_client_write_paths_verify.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/verification/20260923100000_retire_trash_payments_and_side_threads_verify.sql`                    | NOT FULLY READ / inventory only           |
| `supabase/verification/20260925140000_drop_orphan_enums_verify.sql`                                         | NOT FULLY READ / inventory only           |
| `supabase/verification/20260926090000_ocade_jarvis_web_verify.sql`                                          | NOT FULLY READ / inventory only           |
| `supabase/verification/20260927090000_jarvis_device_identity_verify.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/verification/20260929090000_jarvis_execution_control_verify.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/verification/20260929100000_admin_device_removal_verify.sql`                                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20260929110000_scoped_jarvis_controls_verify.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/verification/20260930090000_enrolled_accounts_need_their_second_factor_verify.sql`                | NOT FULLY READ / inventory only           |
| `supabase/verification/20260930091000_admin_changes_need_a_recent_second_factor_verify.sql`                 | NOT FULLY READ / inventory only           |
| `supabase/verification/20260930092000_enrollment_cap_per_source_verify.sql`                                 | NOT FULLY READ / inventory only           |
| `supabase/verification/20260930092500_an_ended_session_stops_at_once_verify.sql`                            | NOT FULLY READ / inventory only           |
| `supabase/verification/20260930093000_one_staff_authority_verify.sql`                                       | NOT FULLY READ / inventory only           |
| `supabase/verification/20260930093500_a_staff_refusal_reads_correctly_verify.sql`                           | NOT FULLY READ / inventory only           |
| `supabase/verification/20260930094000_staff_can_turn_off_a_lost_second_factor_verify.sql`                   | NOT FULLY READ / inventory only           |
| `supabase/verification/20260930095000_jarvis_schedules_verify.sql`                                          | NOT FULLY READ / inventory only           |
| `supabase/verification/20260930096000_android_devices_verify.sql`                                           | NOT FULLY READ / inventory only           |
| `supabase/verification/20261001090000_staff_authority_only_in_the_console_verify.sql`                       | NOT FULLY READ / inventory only           |
| `supabase/verification/20261001091000_web_push_subscriptions_verify.sql`                                    | NOT FULLY READ / inventory only           |
| `supabase/verification/20261001092000_retire_browser_extension_verify.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/verification/20261001093000_push_follows_the_session_verify.sql`                                  | NOT FULLY READ / inventory only           |
| `supabase/verification/20261001094000_a_claimed_permit_is_settled_by_the_server_verify.sql`                 | NOT FULLY READ / inventory only           |
| `supabase/verification/20261001095000_a_factor_added_after_signing_in_needs_a_new_sign_in_verify.sql`       | NOT FULLY READ / inventory only           |
| `supabase/verification/20261001095100_the_console_needs_a_sign_in_after_a_new_factor_verify.sql`            | NOT FULLY READ / inventory only           |
| `supabase/verification/20261001095200_two_step_set_up_in_this_sign_in_verify.sql`                           | NOT FULLY READ / inventory only           |
| `supabase/verification/20261001096000_staff_act_within_their_own_reach_verify.sql`                          | NOT FULLY READ / inventory only           |
| `supabase/verification/20261001096100_a_profile_address_is_the_sign_in_address_verify.sql`                  | NOT FULLY READ / inventory only           |
| `supabase/verification/20261002090000_owner_customer_operations_verify.sql`                                 | NOT FULLY READ / inventory only           |
| `supabase/verification/20261003090000_owner_and_staff_consoles_on_ocade_in_verify.sql`                      | NOT FULLY READ / inventory only           |
| `supabase/verification/20261006090000_cases_name_their_reader_and_conversation_verify.sql`                  | FULL SOURCE READ / not runtime proof      |
| `supabase/verification/20261007090000_action_results_are_events_verify.sql`                                 | FULL SOURCE READ / not runtime proof      |
| `tsconfig.json`                                                                                             | NOT FULLY READ / inventory only           |
| `vite.config.ts`                                                                                            | NOT FULLY READ / inventory only           |
| `vitest.config.ts`                                                                                          | NOT FULLY READ / inventory only           |
| `wrangler.json`                                                                                             | NOT FULLY READ / inventory only           |

## Documentation validation and publication record

Validated on 9 October 2026 before publication:

- All 40 retained Markdown files checked: 93 local Markdown links and heading anchors resolve. Source/path reference checks resolved the explicit current file references; legacy pointer files preserve source-comment names.
- Existing model-identity audit passed. Active rewritten documents formatted with the lockfile-matching Prettier 3.9.5; PLAN/CLAUDE and runtime/history exclusions follow repository formatting policy.
- Git whitespace check passed. All changed/deleted/new paths are Markdown. All non-Markdown tracked blobs and immutable imports remain unchanged from the source baseline.
- Twelve historical document bodies were compared against the baseline after removing only the new historical banner: unchanged. Two redundant documents were merged and removed; exact old versions remain in Git.
- Three pre-writing feasibility reviews and one final independent challenge per reviewer completed. The report records required corrections and remaining product/evidence blockers.
- No application tests, product fixes, dependency installations, builds, migrations, paid provider calls, deployments or infrastructure changes were performed. The separate public health read is liveness only.

The authorised publication is a documentation-only fast-forward of main after a fresh remote check. The enclosing Git commit supplies the immutable publication SHA; the delivered report copy and final response record the independently verified remote SHA after push. Documentation completion does not close OPEN implementation packages or the incomplete full-code/hardware audit.

## PR #74 recovered audit provenance — 10 October 2026

The older per-path inspection table above is a **historical 9 October snapshot**, not the latest pending-file list. The [recovered checkpoint](docs/audit-checkpoints/20261010/coverage.json) is the current source-coverage continuation record: 989 baseline paths, 957 complete text reads, six empty/generated classifications and 26 structural/binary inspections, zero pending baseline paths. Recovery reused 435 saved +262 carried +292 new records, checked the preserved original hashes/ranges and current unchanged bytes (with recorded newline-only equivalence), and reviewed the 10 changed PR documents. The original dirty checkpoint remains intact. This publication adds one documentation-only checkpoint to the original 10-Markdown PR so its audit-evidence merge gate is reviewable; product-tree bytes remain unchanged. Binary/source coverage is not licence clearance, installed-app proof or a competitor result. No research or source audit was restarted.

## 10 October 2026 supplemental world-research findings — source-verified, not measured OCADE outcomes

The earlier extensive worldwide catalogue remains the research authority. These extra implementation checks answer specific unresolved decisions without pretending every company or repository has been audited or that OCADE is already faster:

| Source / scope                                                                                                                                                                       | Engineering fact from published documentation                                                                                          | OCADE KEEP / ADD / REJECT decision and test                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Google Chrome 136 remote debugging](https://developer.chrome.com/blog/remote-debugging-port)                                                                                        | Remote-debugging switches no longer work against the standard default Chrome data directory.                                           | **REJECT** silent default-profile CDP attachment; **KEEP** intended existing-profile native/accessibility control, **ADD** explicit managed profile if necessary; test chosen account. |
| [Microsoft UI Automation](https://learn.microsoft.com/en-us/windows/win32/winauto/entry-uiauto-win32)                                                                                | UIA enables programmatic semantic UI element access but depends on providers and actual app exposure.                                  | **KEEP** UIA/native before screenshot mouse; **TEST** custom controls, final target freshness and concurrent GUI ownership.                                                            |
| [Adobe Photoshop UXP scripts](https://developer.adobe.com/photoshop/uxp/scripting/)                                                                                                  | Installed script API supports documented one-off and repeatable operations and has version/runtime boundaries.                         | **ADD** optional scoped app-family capability detection; **REJECT** general-purpose always-on Photoshop agent; reopen native project.                                                  |
| [Gemini Live API session lifecycle](https://ai.google.dev/gemini-api/docs/live-api/session-management)                                                                               | Streaming voice session reconnection and resumption are distinct from persistent external work state.                                  | **KEEP** existing task database/journal as truth; **TEST** voice reconnect, account switch, late audio and explicit STOP.                                                              |
| [adewaskar/jarvis README](https://github.com/adewaskar/jarvis/blob/main/README.md)                                                                                                   | Developer prototype uses a local bridge and effectful-tool gating and warns its media/audio rights need separate clearance.            | **ADOPT** useful small voice/render lifecycle concepts behind OCADE owners; **REJECT** donor framework/customer Claude subscription login and wholesale demo assets.                   |
| [Browser Use repository](https://github.com/browser-use/browser-use), [Stagehand docs](https://docs.stagehand.dev/v3), [Skyvern architecture](https://github.com/Skyvern-AI/skyvern) | Different browser agents mix per-step models and structured supported browser operations; hosted browsers can require cloud execution. | **KEEP** local PC browser authority and deterministic DOM first; compare documented behaviour with real equal-state fixtures, not marketing screenshots.                               |

**Research gaps not closed by prose:** vendor internal implementation of closed-source competitors, exact current licences of each transitive asset/model, installed Windows/Android/macOS/iOS hardware paths, provider/STT data retention and comparable real-world speed/quality remain RESEARCHED or UNAVAILABLE until tested. At implementation time, benchmark ChatGPT Work, Claude, Gemini, Manus, Grok Bot, Muse, Hermes, OpenClaw, PhoneHarness, Microsoft UFO, Cua, UI-TARS, Stagehand, Browser Use and other relevant discovered products against the _same independently verified customer job_ where access/permission permits. Do not add another framework just because its repository is popular; pick one best technique per task interface and prove accuracy, cost and user value. Unique features without actual demand are postponed instead of permanently omitted or prematurely built.

## Post-publication October 10 technical research addendum — on-device Windows agents

- **WindowsWorld**, [ACL publication](https://aclanthology.org/2026.findings-acl.750/) and [research repository](https://github.com/HITsz-TMG/WindowsWorld), adds a process-centric assessment of 181 tasks across 17 applications; reported roughly 78% multi-app and low results among evaluated agents. **OCADE decision:** adopt comparable intermediate outcome checkpoints and real Windows fixture design; do not reuse a simulated percentage as an OCADE win.
- **Microsoft UFO2**, [Microsoft Research](https://www.microsoft.com/en-us/research/publication/ufo2-the-desktop-agentos/), describes app-native APIs combined with UIA/vision and multi-action planning. **OCADE decision:** reuse ideas within the _single_ existing native broker; measure amortised dispatch, shared GUI input safety and app version compatibility; do not fork another agent engine.
- **Microsoft Execution Containers (MXC)**, [official developer release](https://blogs.windows.com/windowsdeveloper/2026/10/07/microsoft-execution-containers-policy-driven-containment-for-ai-agents/) dated 7 October 2026, describes process and Windows 11 session-level local isolation; [public early SDK repo](https://github.com/microsoft/mxc) warns some generated profiles are overly permissive and unsuitable as guaranteed security boundaries. **OCADE decision:** conditional local feasibility/security experiment for scripted workloads, not mandatory installation, supported-device claim or cloud fallback. Keep rigorous OS/edition/policy deny tests; do not confuse the public SDK's warnings with the general availability claims of the platform component.

## 2026-10-10 competitor technical deltas, licences and 38 capability winners

This dated research is a source-backed comparison, not an executed head-to-head win. Explicit UNKNOWN/UNTESTED findings are preserved.

### 2.1 Corrections to earlier positioning

**Local execution is already competitive.** ChatGPT Work documents connected local computer access and separate local/cloud policy boundaries. OCADE must not claim that phone-to-PC work or local execution is unique. [OpenAI Work administration](https://learn.chatgpt.com/docs/enterprise/chatgpt-work-overview#enable-and-govern-local-computer-access-with-work-cloud).

Manus My Computer documents local terminal execution, local folder authorisation, command approvals and remote delegation to an awake PC. Local execution still consumes cloud orchestration credits. [Manus My Computer](https://manus.im/blog/manus-my-computer-desktop), [desktop credit accounting](https://help.manus.im/en/articles/14134826-understanding-credit-consumption-in-the-manus-desktop-app).

Claude’s connected desktop and cloud surfaces must be profiled separately. Its current Dispatch documentation says it is unavailable to new users; existing access requires the desktop application, computer and internet connection to remain available. [Claude Dispatch](https://support.claude.com/en/articles/13947068-assign-tasks-from-anywhere-in-claude-cowork).

Meta’s September announcement documents Muse computer use for Mac and conversational voice with background tasks. “Any app” is a vendor coverage claim, not reproduced application fidelity. [Meta Connect announcement](https://about.fb.com/de/news/2026/09/meta-connect-2026/).

### 2.2 Highest-threat comparison

`D` means documented by the vendor; `U` means unresolved in inspected evidence. All comparable performance and reliability results remain **UNTESTED**.

| Dimension         | ChatGPT Work/Codex               | Claude                             | Manus                         | Hermes                              | Muse                             |
| ----------------- | -------------------------------- | ---------------------------------- | ----------------------------- | ----------------------------------- | -------------------------------- |
| Customer job      | Connected work/code              | Documents, development, delegation | Local/cloud task work         | Configurable personal agent         | Personal productivity            |
| Platforms         | Local/cloud configurations       | Desktop/web/mobile                 | Windows/Mac/mobile delegation | CLI/gateway backends                | Web/mobile/Mac                   |
| Observation       | Executor-dependent               | Connectors/browser/screens         | Files/terminal; GUI details U | Configured tools                    | Browser; Mac details U           |
| Actions           | Executor-dependent               | Connector/browser/GUI              | CLI/local tools               | Registered tools                    | Connectors/permitted Mac control |
| Planner/executor  | Separate orchestration/execution | Cloud/local surfaces               | Cloud brain/local compute     | Agent loop/tool registry            | Agent/Sentinel boundary          |
| Independent proof | U workflow-specific              | U durable predicates               | U durable receipts            | U outcome contract                  | U outcome receipts               |
| STOP              | Policy-dependent; quiescence U   | Stop available; quiescence U       | Comprehensive quiescence U    | Interrupt/kill tools                | Takeover; global STOP U          |
| Permissions       | Managed policy hierarchy         | App approvals/policies             | Allow Once/Always Allow       | Configurable approvals              | Allow/deny/ask mediation         |
| Persistence       | Surface-dependent                | Cloud sessions/persistent thread   | Projects/scheduled tasks      | SQLite sessions                     | Cloud files/memory               |
| Uncertain replay  | U external-effect contract       | U                                  | U                             | U                                   | U                                |
| Memory            | Surface-specific details U       | Shared/remembered context          | Detailed mechanism U          | Bounded memory/skills               | Inspect/edit/forget              |
| Voice             | Task-specific contract U         | Unified task voice                 | Phone voice delegation        | Supported voice channels            | Realtime conversation            |
| Integrations      | Managed tools/hooks              | Connectors/MCP/plugins             | Local/cloud integrations      | MCP/gateways                        | Partner connectors               |
| Administration    | Enterprise controls              | Organization/group policies        | Fleet detail U                | Operator configuration              | Enterprise detail U              |
| Offline           | Executor-specific                | Intelligence needs internet        | Planner remains cloud         | Local-model support                 | Offline U                        |
| Workflow latency  | Unmeasured                       | Unmeasured                         | Unmeasured                    | Unmeasured                          | Unmeasured                       |
| Comparable cost   | Unmeasured                       | Unmeasured                         | Credit-metered; unmeasured    | Provider/hardware-dependent         | Unmeasured                       |
| Installation      | Connected executor               | Desktop for local resources        | Desktop and folder consent    | Runtime/tool configuration          | App/Mac permission               |
| Copying rights    | No grant established             | No grant established               | No grant established          | MIT upstream; dependencies separate | No grant established             |
| Reproduction here | Not executed                     | Not executed                       | Not executed                  | Not executed                        | Not executed                     |

The additional distinctions come from [Claude computer use](https://support.claude.com/en/articles/14128542-let-claude-use-your-computer-in-cowork), [Claude organization controls](https://support.claude.com/en/articles/13455879-use-claude-cowork-on-team-and-enterprise-plans), [Hermes architecture](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture/), [Hermes security](https://hermes-agent.nousresearch.com/docs/user-guide/security/) and [Muse security architecture](https://research.meta.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse).

Unknown properties must not become negative competitor claims. Test them when legitimate access is available.

### 2.3 Donor dispositions

| Reference                            | Evidence identity                                                   | OCADE disposition                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adewaskar/jarvis`                   | `1c4016afdf86f7043efc6882ceffef84ad0d8783`; MIT code                | Independently adapt beneficial voice/rendering mechanisms inside existing owners. Reject wholesale bridge, private Chrome coupling, SDK/task authority and cinematic assets |
| `PhoneHarness/PhoneHarness`          | `1cdc0d963641d517f5deb687adb37332cf844e70`; licence not established | Architectural research only; no copying                                                                                                                                     |
| `ShawnPana/phone-harness`            | `88b3642ac4733c47daf12e0f2837bc789eda63c6`; MIT                     | Consider narrow typed-operation ideas after component review                                                                                                                |
| `ZachDreamZ/universal-phone-harness` | `bb1bfc9fad37bcc32ef650de830d402300255317`; MIT                     | Adapt freshness/budget principles; reject optional verification as success and uncertain-write automatic retry                                                              |
| `FatihMakes/Mark-LV`                 | `c3e795af71bff38bb406c62a2e7a63869cdc8eb2`; CC BY-NC                | Preserve immutable provenance; commercial copying blocked without permission                                                                                                |

Code licences do not automatically clear music, voices, models, fonts, artwork, services or third-party dependencies.

### 2.4 Capability winners: one coherent pattern per concern

“Winner” below means the selected engineering approach, not a measured victory over its inspiration.

|   # | Capability       | Selected OCADE approach                              | Package |
| --: | ---------------- | ---------------------------------------------------- | ------- |
|   1 | Conversation     | Existing account-owned Chat lifecycle                | P05     |
|   2 | Planning         | Bounded existing online planner                      | P16     |
|   3 | Research         | Source-linked, dated, scoped retrieval               | P16     |
|   4 | Long tasks       | One durable task with milestones                     | P01/P03 |
|   5 | Persistence      | Server state plus local intent/result journal        | P03     |
|   6 | Memory           | Scoped facts with provenance and deletion            | P10/P16 |
|   7 | Recipes          | Typed, verified, version-aware repeats               | P10     |
|   8 | Browser          | Supported semantic control with identity checks      | P11     |
|   9 | Desktop          | Native APIs first; fresh GUI fallback                | P02/P17 |
|  10 | Mobile           | Android permissions; honest Apple limits             | P13/P14 |
|  11 | Files            | Resource identity, copies and readback               | P04     |
|  12 | Excel            | Native fidelity plus independent recomputation       | P04/P17 |
|  13 | Word/PDF         | Native structure and rendered-layout examination     | P17     |
|  14 | PowerPoint       | Native objects and export/layout checks              | P17     |
|  15 | CAD              | Installed SDK and geometry/unit checks               | P17     |
|  16 | Blender          | Version-matched API and reopened scene checks        | P17     |
|  17 | Creative editing | Native layers/profiles/source preservation           | P17     |
|  18 | Video/audio      | Native timeline and independent render inspection    | P17     |
|  19 | Coding           | Local scoped repository, tests and publication gate  | P17     |
|  20 | Voice            | One generation-owned duplex lifecycle                | P12     |
|  21 | Multimodal       | Exact consented inputs; minimal retention            | P16     |
|  22 | Connectors       | Account-bound capabilities behind existing broker    | P17     |
|  23 | Schedules        | Durable occurrence IDs and current authority         | P09     |
|  24 | Background work  | Independent resources; no competing GUI input        | P08/P09 |
|  25 | Remote devices   | Explicit paired PC and durable delivery              | P03/P11 |
|  26 | Takeover         | Immediate withdrawal of GUI ownership                | P02     |
|  27 | Authentication   | Four separate identities and human secrets           | P05/P11 |
|  28 | Permissions      | Server grants plus final local admission             | P02/P05 |
|  29 | Recovery         | Reconciliation before uncertain retry                | P03/P04 |
|  30 | Verification     | Approved predicates; model cannot certify itself     | P01     |
|  31 | Efficiency       | Local segments and cached capability descriptions    | P08/P16 |
|  32 | Performance      | Separate measured timing/resource budgets            | P08/P19 |
|  33 | Collaboration    | Explicit recipe/output grants without private inputs | P22     |
|  34 | Administration   | Integrated, server-authorised console                | P05     |
|  35 | Subscription     | Predictable monthly offer and durable settlement     | P20     |
|  36 | Onboarding       | Useful Chat, then native pairing when needed         | P11/P15 |
|  37 | Offline          | Existing signed wllama/OPFS owner                    | P07     |
|  38 | Distribution     | Signed install/update/repair/uninstall               | P11/P21 |

Retain the wider researched families—Google, xAI, OpenClaw, Microsoft UFO/Copilot Studio, Cua, Agent S, UI-TARS, browser-use, Stagehand, Skyvern, OpenAdapt, Cyberdesk, n8n, Activepieces, Zapier, Make, coding agents, mobile frameworks and voice providers—in the existing research record. Update only material missing facts, changed licences or findings that change these decisions.

### 2.5 Claims OCADE must earn

The intended advantage is:

> **Complete useful work in installed applications, preserve editable originals, check the result, and recover honestly with little human effort.**

For each named competitor and workflow, compare:

- Independently verified success and file fidelity.
- Total elapsed time and p95 where sample size supports it.
- Model calls, tokens and actual task cost.
- Human approvals, corrections and installation effort.
- CPU, RAM, network and private data transmitted.
- STOP, crash, sleep and uncertain-write recovery.
- Native-source editability and collateral changes.

Competitor access unavailable means **UNAVAILABLE**, not an OCADE victory.
