# CODEMAP
Auto-generated file index. Read this instead of exploring the repo. Open a file only when you need its code.

<!-- OVERVIEW:START -->
## Overview

- OCADE uses React, TanStack Start/Router, Vite, Tailwind, a Cloudflare Worker and Supabase. Start locally with `npm run dev` and check the runtime pin in `.node-version`.
- Routes and API entry points are under `src/routes/`. Shared UI lives under `src/components/`. JARVIS execution and device contracts live under `src/jarvis/`, `device-agent/` and `supabase/`.
- Run `npm run verify:full` for the portable gate. JARVIS suites use `npm run test:jarvis` and `npm run test:jarvis-db`. Check `.github/workflows/` for hosted verification.
- `AGENTS.md` holds engineering rules. `plan.md` is the requirements authority. `TASKS.md` is the execution ledger.
<!-- OVERVIEW:END -->

## Files (1002)

### ./
- `AGENTS.md` (49L) OCADE — Coding Agent Instructions
- `CLAUDE.md` (52L) CLAUDE.md
- `OCADE_Claude_Engineering_Lessons_and_Universal_Methods.md` (444L) OCADE — Claude Engineering Lessons, Root Causes, Planning Methods and
- `OCADE_SYSTEM_PROMPT_REDESIGNED.md` (131L) OCADE — Production System Instructions (Redesigned Candidate V2)
- `RELEASE_NOTES.md` (38L) Release notes
- `TASKS.md` (227L) TASKS — live execution ledger (plan.md remains authoritative)
- `THIRD_PARTY_NOTICES.md` (382L) Third-party notices
- `ToRemove.md` (177L) OCADE retirement manifest
- `eslint.config.js` (73L)
- `nitro.config.ts` (8L)
- `package.json` (91L)
- `plan.md` (1518L) OCADE BY CARCC — Complete Product, JARVIS & Windows/macOS PC Control Master Plan (v10)
- `tsconfig.json` (27L)
- `vite.config.ts` (384L) | buildCommit, defineOcadeConfig
- `wrangler.json` (41L)

### .claude/
- `launch.json` (11L)
- `settings.json` (33L)

### .claude/agents/
- `checker.md` (8L)
- `scout.md` (8L)
- `verifier.md` (8L)

### .github/
- `dependabot.yml` (34L) Dependency updates.

### .github/workflows/
- `ci.yml` (41L)
- `cloudflare-production.yml` (63L)
- `codeql.yml` (63L) GitHub CodeQL code scanning cannot upload results for a private GitHub
- `jarvis-cloud-validation.yml` (706L) Only implementation-branch, no-deploy, no-provider-secret validation.
- `jarvis-macos-package.yml` (147L)
- `jarvis-staging-evaluation.yml` (245L)
- `offline-artifact.yml` (75L)

### device-agent/windows/ocade_agent/
- `__init__.py` (1L) OCADE JARVIS Windows companion (plan.md §22).
- `__main__.py` (5L)
- `agent.py` (1235L) The companion's loop: ask for work, run it through the gateway, report | computer_busy, room_for_another_lane, handed_out, still_ours, default_home, LocalStop +17
- `bar.py` (587L) The companion's floating JARVIS bar (plan 14F.4): a small window over | write_json, describe, window_of, visible_marks, BarState, queue_instruction +9
- `capture.py` (466L) OCADE LIVE VISION: one continuous capture per target window, shared (p | Frame, Stream, Hub, polling, _throttled, _copy +9
- `catalog.py` (318L) The trusted MCP dictionary on this device (plan.md §6.4, P05). | _depth, scan, _file_sha256, pins_hold, bundled, load +7
- `command_worker.py` (338L) `shell`: one command the person confirmed, run in the workspace folder | _contain_children, _end_tree, _bounded, _exited, shell_run, job_start +7
- `device.py` (149L) This computer's identity and its signed, outbound-only exchange (plan. | _b64url, _Blob, _dpapi, Device
- `discovery.py` (812L) What is installed and what is open on this Windows computer (plan.md § | engines, ask_for_mac_permissions, installed_apps, _windows_apps, app_key, _ancestor_images +27
- `engine.py` (152L) The real office engines (plan.md §25.1 rung 1: documented app-native A | _office_com, office_available, _soffice, _libreoffice_convert, recalculate, export_pdf
- `gateway.py` (486L) The trusted MCP gateway (plan.md §6, §23.4, P05/P06). | effect_possible, now_utc, receipt, expectation_unmet, WorkerRejected, Gateway +2
- `held_input.py` (69L) Let go of keys and mouse buttons a cut-off action left held down (STOP | release_windows, release_mac, release_held
- `job_runner.py` (52L) Runs one job (see `jobs.py`): start the command, enforce its deadline, | main
- `jobs.py` (248L) Long-running commands as tracked jobs (W3, D18): renders, exports, ins | shell_argv, folder, _write, _read, process_start, _job_process +8
- `journal.py` (72L) The local action journal (plan.md §11, P15): intent before effect, rec | Journal
- `keys.py` (93L) One keyboard contract for every desktop (`ui.send_keys`). | _items, _press, windows_sequence, mac_events
- `mac_worker.py` (713L) `ui_bridge` on macOS: installed and open apps, Accessibility (AX), las | _evidence, _app_dirs, installed_apps, _started, _exe, open_windows +26
- `media_worker.py` (702L) The `media_engine` worker: audio, video and 3D scenes as typed operati | _engine, _probe, media_inspect, media_trim, media_preview, image_edit +7
- `office_worker.py` (762L) The actor: `fs_sandbox` and `sys_core` office operations as one MCP st | fs_list, _open_values, office_inspect_workbook, fs_read_text, fs_write_text, fs_replace_text +27
- `pinned_proxy.py` (159L) The actor browser's only way out: a loopback CONNECT proxy that pins e | PinnedProxy, _tunnel, _answer, _pipe
- `protocol.json` (3716L)
- `redact.py` (66L) Credentials never leave this computer inside evidence (requirement 176 | redact_text, redact
- `refs.py` (129L) Element references from `ui.inspect` (stable handles, P5) and what cha | _identity, remember, recall, listing, wait_for
- `sandbox.py` (306L) The workspace boundary (plan.md §25.4 fs_sandbox, P08). | Refused, _EffectScope, mark_effect, _tracked_result, guarded, resolve +8
- `scene_gl.py` (563L) A typed 3D scene, rendered by the browser engine OCADE already ships ( | f, v3, _rows, _place, _reach, _part_extent +8
- `skillforge.py` (111L) SKILLFORGE: what the person shows once, in one window, as ordered step | selector, _key, Demonstration, record
- `tray.py` (214L) The companion's Windows notification-area icon and macOS menu-bar cont | WindowsTray, MacTray, run_macos_status, Actions
- `vault.py` (215L) THE PERSON'S SIGN-INS, KEPT BY THE OPERATING SYSTEM (plan 14A REPO-55 | VaultUnavailable, origin_key, _Store, _Windows, _Keychain, store +2
- `verify_worker.py` (1314L) The independent verifier (plan.md §12, §27.2, P16) as its own MCP stdi | _digest, _pdf_renders, _text, _check, _parses, _gltf_mesh +30
- `vision.py` (141L) Image-based target checks for the last-resort click (concept 36, readi | remember, view, last_observation, changed, _small, match +1
- `watch.py` (126L) Watched folders (plan REPO-61/71): the person asked JARVIS to do somet | inside, listing, Watcher
- `web_worker.py` (1110L) `web_automation`: authorized websites through Playwright (plan.md §25. | _close_browser, _lifespan, _origin, _host, _allowed_url, _public_by_dns +28
- `windows_worker.py` (685L) `ui_bridge`: installed and open apps, UI Automation, and last-resort f | _evidence, _actable, _blocked, _not_in_front, _on_secure_desktop, _window_handle +22

### device-agent/windows/packaging/
- `check_frozen.py` (338L) Qualify frozen workers and the bundled visible browser with an empty d | facts, parent_edges, profile_processes, close_process_handles, wait_for_process_exit, fixture_directory +3
- `compare_browser_payloads.py` (50L) Compare full and visible-browser-only payloads installed by the same p | inventory, main
- `compare_builds.py` (23L) Two builds of the frozen companion from the same pinned inputs must be | digests
- `test_update.py` (104L) Signed update lifecycle of the FROZEN companion on a disposable runner | new_key, main

### device-agent/windows/tests/
- 50 test files: __init__.py ... web_fixture.py

### docs/
- 17 data files: ARCHITECTURE.md ... TEST_MATRIX.md

### docs/archive/
- `plan-v6-2026-11-07.md` (1672L) ARCHIVE — OCADE Master Engineering Plan v6, as of 7 November 2026 (com
- `plan-v7-2026-11-14.md` (1586L) OCADE — Master Engineering Plan (v7)

### docs/research/
- `OCADE_246_FULL_SOURCE_ARCHITECTURE_BLUEPRINT.md` (1343L) OCADE — 246-repository source architecture blueprint
- `OCADE_ARCHITECTURE_REVIEW_2026-11-08.md` (328L) OCADE architecture review and redesign plan (8 November 2026)
- `OCADE_REPOSITORY_LEDGER_246.md` (333L) OCADE repository ledger: the 246 repositories (14 November 2026)
- `OCADE_SOURCE_REVIEW_2026-11-14.md` (107L) Source review of the desktop, browser, CUA and runtime repositories (1
- `OCADE_complete_heading_and_concept_index.md` (304L) Complete Heading and Concept Index — Universal PC Controller / OCADE
- `UNIVERSAL_LOCAL_CONTROL_MCP_ROUTING_REFERENCE.md` (231L) Universal Local Computer Control and MCP Toolbox Routing — Corrected R

### release/
- `OCADE_OFFLINE_RELEASE.json` (20L)
- `sbom.cdx.json` (7475L)
- `third-party-licences.json` (361L)

### scripts/
- `autopilot.py` (89L) Bounded Stop hook. The ledger is not proof; Opus + actual CI must veri | state_path, block, invalid_ledger, run
- `build-offline-artifact.mjs` (250L) PREPARE ONE OFFLINE INTELLIGENCE RELEASE AND PUT IT WHERE OCADE SERVES | bucket, fail, fetchPart, checkContainer, previousVision, readFirst +1
- `check-generated-stability.mjs` (31L) Prove tracked generators are byte-stable without requiring a `.git` di
- `check-install-scripts.mjs` (25L) SUPPLY-05: only reviewed packages may run code at install time.
- `check-supabase-types.mjs` (247L) The checked-in Supabase types must describe the checked-in migrations. | tablesInMigrations, columnsInMigrations, columnsInTypes, tablesInTypes
- `ci-local.sh` (40L) Linux pre-push gate. Bootstrap Node/npm, the locked Python runtime, Ch
- `ci-macos-media.py` (62L) Pinned Intel macOS media tools for disposable CI; never part of the pr | main
- `codemap.py` (133L) Write CODEMAP.md: one line per source file with its purpose and top-le | files, describe, main
- `deploy.mjs` (721L) OCADE Cloudflare deployment and rollback controller (P27). | hasValue, readJson, validHealthUrl, validSupabaseBuildUrl, newestMigration, realRunner +12
- `generate-routes.mjs` (32L)
- `jarvis-e1.sh` (102L) Manual staging qualification only. The server runs as root; the compan
- `jarvis-live.mjs` (308L) One REAL JARVIS task against a hosted Supabase project (staging), end | must, timedRpc, agent, outputs
- `jarvis-no-hardcoded-journeys.mjs` (55L) Guard against fixed customer journeys in the JARVIS production control | scan
- `jarvis-protocol.ts` (21L) Writes the companion's copy of the JARVIS protocol from the one TypeSc
- `jarvis-staging-isolation.py` (36L) Protected staging smoke: record identity and presence flags, never cre
- `jarvis-traceability.mjs` (446L) The 84 architecture concepts of plan.md §3, each with its code owner,
- `launch-readiness.mjs` (121L) Commercial launch readiness (plan.md 214-234), computed only from | isEvidence, count
- `licence-inventory.mjs` (195L) Third-party redistribution rights (requirements 180, 182). | permitted
- `model-availability.ts` (60L) Before any model change (requirement 23): is the configured model actu | read
- `prove-offline-artifact.mjs` (487L) PROVE THAT THIS EXACT ARTIFACT ANSWERS A QUESTION AND READS AN IMAGE. | supportsMemory64, knownPicture, backslashes, sendError, parseRange, isCorrectArithmeticAnswer +1
- `quiet-check.py` (31L) Run an argv command, preserve its real exit code, and keep a local dia
- `sbom.mjs` (94L) SUPPLY-02: a software bill of materials (CycloneDX 1.5 JSON) for what | licences
- `scan-bundle-secrets.mjs` (124L) WHAT A STRANGER CAN READ. | files
- `verifier-flake.py` (77L) VERIFY-07: is the independent verifier stable on controlled fixtures? | R, one_run, main
- `verify-full.mjs` (50L) THE ONE GATE LIST.

### src/
- `cloudflare-entry.ts` (218L) | runErasureSweep, runScheduleSweep, WaitUntilContext, AssetBinding, CloudflareEnvironment, RuntimeRequest +5
- `nitro-virtual.d.ts` (5L)
- `opfs.d.ts` (21L) The OPFS synchronous access handle, which no shipped lib.dom describes | FileSystemSyncAccessHandle, FileSystemFileHandle
- `routeTree.gen.ts` (455L) noinspection JSUnusedGlobalSymbols | FileRoutesByFullPath, FileRoutesByTo, FileRoutesById, FileRouteTypes, RootRouteChildren, FileRoutesByPath +2
- `router.tsx` (20L) | getRouter
- `server.ts` (127L) | ServerEntry, getServerEntry, normalizeCatastrophicSsrResponse, recordSsrFailure, isH3SwallowedErrorBody
- `start.ts` (29L)

### src/components/admin/
- `ConsoleModules.tsx` (995L) | Reason, Section, StaffModule, StaffRow, StaffUsage, UsageSummary +8

### src/components/chat/
- `ChatWorkspace.tsx` (993L) | closeMore, ChatWorkspace, LowAllowanceNotice, AttachmentTray, TrayButton, IconButton
- `ConversationList.tsx` (426L) | ConversationList, groupConversations, MenuItem, RenameField
- `EnhancePrompt.tsx` (152L) | EnhancePrompt
- `MessageList.tsx` (383L) | MessageList, questionBefore, Turn, Controls, Action, copy +3

### src/components/legal/
- `LegalContent.tsx` (600L) | TermsContent, PrivacyContent
- `legal-document-meta.ts` (19L) Heading, date and summary for each published legal document.

### src/components/offline/
- `OfflineModeSetup.tsx` (205L) | OfflineModeSetup, Line, Button, offerDismissed, OfflineModeOffer

### src/components/security/
- `ConfirmIdentity.tsx` (223L) | needsFreshProof, Step, useConfirmIdentity

### src/components/settings/
- `AdvancedSection.tsx` (123L) | AdvancedSection
- `AnswerLanguage.tsx` (40L) | AnswerLanguage
- `BillingSection.tsx` (84L) | BillingSection
- `ByokSection.tsx` (775L) | ByokSection, Sources, Connection, AddConnection, ConnectionForm, priceText +1
- `DataControlsSection.tsx` (308L) | DataControlsSection, OnlineConsentSection, stated, ConversationsSection, ExportSection, LibrarySection +1
- `MemorySection.tsx` (174L) | Memory, readMemory, MemorySection
- `ModelSource.tsx` (35L) | ModelSource
- `NotificationsSection.tsx` (323L) | NotificationsSection, ChatApp
- `SignInMethods.tsx` (161L) | SignInMethods, label
- `TimeReclaimed.tsx` (130L) | TimeReclaimed
- `TwoStep.tsx` (374L) | TwoStep, messageOf
- `UsageSection.tsx` (213L) | UsageSection, OfflineRow, useDeviceRegistrationProblem, DevicesRows, WindowRow
- `rows.tsx` (184L) | Row, Action, Pending, Confirm, describeWhen, Toggle
- `settings-dialog.tsx` (492L) The Settings panel's contents, loaded when it first opens (see setting | SettingsDialog, AccountSettings, BubbleSetting, JarvisVoiceSetting, ResetJarvis, AppearanceSettings
- `settings-panel.tsx` (98L) SETTINGS IS A PANEL, NOT A SECTION OF THE SITE. | loadDialog, SettingsCategory, SettingsPanelValue, useSettingsPanel, SettingsPanelProvider

### src/components/shell/
- `AppShell.tsx` (424L) THE ONE SHELL. Sidebar, workspace, account. | Destination, AppShell, Sidebar, ConsoleLink, UsageMeter, AccountRow
- `AuthShell.tsx` (68L) | AuthShell
- `BrandMark.tsx` (26L) The supplied OCADE mark, optionally with its wordmark. | BrandMark
- `CommandPalette.tsx` (217L) | Command, Go, rankCommands, CommandPalette
- `ErrorBoundary.tsx` (95L) | Props, State, readableMessage, ErrorBoundary
- `PublicPage.tsx` (176L) The frame for the four pages that exist outside the product: About, He | keepFocusedControlVisible, PublicPage, BackToTop, PublicSection

### src/config/
- `company-facts.ts` (22L) Canonical current company and product facts.

### src/integrations/supabase/
- `auth-attacher.ts` (63L)
- `auth-middleware.ts` (94L) This file is automatically generated. Do not edit it directly.
- `client.server.ts` (47L) This file is automatically generated. Do not edit it directly. | createSupabaseAdminClient
- `client.ts` (80L) | createSupabaseClient
- `configuration-message.ts` (25L) The one sentence OCADE says when an account binding is absent. | missingSupabaseConfigurationMessage
- `configuration.ts` (84L) IS SUPABASE CONFIGURED? — answerable without building a Supabase clien | SupabaseBrowserConfiguration, resolveSupabaseBrowserConfiguration, getSupabaseBrowserConfiguration, isNewSupabaseApiKey, createSupabaseFetch
- `on-demand.ts` (40L) THE SAME BROWSER CLIENT, FETCHED WHEN IT IS FIRST NEEDED. | loadSupabaseClient, loadSupabaseConfiguration
- `types.ts` (3217L) | Json, Database, DatabaseWithoutInternals, DefaultSchema, Tables, TablesInsert +3

### src/jarvis/
- `AppsAndWebsites.tsx` (112L) | AppsAndWebsites
- `ControlMode.tsx` (43L) | ControlMode, ControlModePicker
- `JarvisBubble.tsx` (239L) THE FLOATING JARVIS BUBBLE, ON PHONES, EVERYWHERE BUT JARVIS ITSELF. | Bubble, Core
- `JarvisBubbleGate.tsx` (41L) Whether the phone JARVIS bubble is on screen. Kept tiny and in the roo | usePhoneWidth, JarvisBubble
- `JarvisPanels.tsx` (1777L) The rail's Conversations, and JARVIS's place in Settings. | Section, when, SectionPanel, Conversations, GrantHours, JarvisAccess +13
- `JarvisWorkspace.tsx` (954L) The OCADE JARVIS workspace: a compact rail, the conversation and the c | Turn, JarvisWorkspace, RailButton, Habits, Packages, BusinessWorkspace
- `LifeOS.tsx` (289L) | Item, Draft, LifeOS, ObligationList
- `MentionPicker.tsx` (100L) | MentionList
- `OpportunityEngine.tsx` (184L) | OpportunityEngine
- `PermissionGuide.tsx` (180L) | PermissionGuide
- `ProblemRadar.tsx` (156L) | dismissedKey, readDismissed, ProblemRadar, FindingList
- `Schedules.tsx` (429L) | Row, localZone, fieldValue, fieldInstant, describe, stopRule +5
- `Skills.tsx` (208L) | Skills, SkillForm
- `Watches.tsx` (158L) | Watches
- `bubble-state.ts` (69L) The phone bubble's device-local state: where it sits, whether it is sh | HandedQuestion, handOff, takeHandOff, Placement, readPlacement, writePlacement +1
- `preferences.ts` (47L) | JarvisPreferences, readPreferences, writePreferences, useJarvisPreferences
- `use-mentions.ts` (44L) | useMentionCandidates
- `use-voice.ts` (189L) | pickVoice, RecognitionEvent, DictationRecognition, browserDictation, stopRecognition, useJarvisDictation +2

### src/lib/
- `account-data.functions.ts` (42L) ACCESS AND ERASURE, AUTHENTICATED — PLAN.md §O. | adminClient
- `account.functions.ts` (236L) Account self-service — irreversible deletion. | AccountDeletionReceipt, deletionReference
- `after-hydration.ts` (24L) HYDRATION FIRST, THEN CLIENT-ONLY ROUTE CHECKS. | markHydrated, whenHydrated
- `appearance.tsx` (266L) THE ONE AUTHORITY FOR HOW OCADE LOOKS. | ThemeMode, TextSize, AppearancePrefs, AppearanceValue, readTheme, readTextSize +6
- `browser-install-id.ts` (54L) Locally-generated, random Browser Installation ID. | getBrowserInstallId, guessDeviceKind, browserLabel
- `error-page.ts` (30L) | renderErrorPage
- `health.ts` (146L) | VersionMetadataEnv, CloudflareRuntimeRequest, cloudflareRequestEnv, deploymentMetadata, configurationMetadata, releaseHealthResponse
- `media-type.ts` (42L) WHAT A FILE IS, DECIDED BY ITS OWN FIRST BYTES. | imageMediaType, isMediaType
- `ocade-chat-store.ts` (255L) WHERE A CHAT MESSAGE GOES: SUPABASE, AND NOWHERE ELSE. | ChatAttachmentMeta, ChatMessageRecord, PersistTarget, PersistResult, newClientKey, persistChatMessage +4
- `ocade.functions.ts` (381L) OCADE server functions — conversations and messages. | OcadeConversationRow
- `public-identity.ts` (34L)
- `read-bounded-request.ts` (36L) Read at most maxBytes from the wire; a missing or false Content-Length | readBoundedRequestText
- `release.ts` (11L) The release version. Its own module, with no imports, so the Cloudflar
- `session.ts` (102L) | AuthState, useSession
- `theme-boot.ts` (30L)
- `use-follow-bottom.ts` (29L) | useFollowBottom
- `use-modal-focus.ts` (59L) | useModalFocus
- `use-online.ts` (25L) | useOnline
- `utils.ts` (39L) | cn, saveFile, typedBeforeHydration
- `zod-jitless.ts` (8L) The CSP forbids eval, so zod's compiled fast path can never run here.

### src/lib/account/
- `data-classes.ts` (235L) WHAT AN ACCOUNT HOLDS, BY CLASS — THE ONE MAP THE EXPORT AND THE | AccountTable, OwnerColumn, AccountDataTable, AccountDataClassId, AccountDataClass, exportedTablesFor
- `data-rights.ts` (325L) ACCESS AND ERASURE, AS PLAN.md §O DEFINES THEM — THE PART THAT CAN BE | ExportedRow, AccountExportTable, AccountExportClass, AccountDataExport, PostgrestFailure, RowPage +9
- `erase.server.ts` (58L) ONE ERASURE OF AN ACCOUNT, used by the customer's own deletion and by | eraseAccount

### src/lib/admin/
- `access.functions.ts` (305L) MANUAL ACCESS, THROUGH THE AUTHORITY THAT ALREADY OWNS IT. | AdminAccountRow, StaffPermission, assertStaff, searchableAccountTerm, AdminAccountPage, adminFailure
- `refusal-log.ts` (8L) ADMIN-08: a refused staff or support change is recorded where operator | logRefusedChange
- `route-gate.ts` (23L) ONE STAFF GATE, USED BY THE CONSOLE ROUTE. | requireStaff
- `staff.functions.ts` (895L) THE OWNER AND STAFF CONSOLES' SERVER SIDE. | StaffRole, messageOf, ready, MyStaff, staffFailure, StaffMember +9

### src/lib/auth/
- `oauth-errors.ts` (129L) Plain-language messages for social sign-in failures. | FriendlyAuthError, label, describeOAuthError, readOAuthErrorFromUrl
- `otp.ts` (86L) One-time codes: what to say, and how often OCADE will send one. | secondsUntilResend, describeResend, friendlyOtpError
- `provider-availability.ts` (84L) WHICH WAYS IN EXIST — ASKED OF SUPABASE, NOT OF THE BUILD. | AuthProviderAvailability, GoTrueSettings, readAuthProviderAvailability, fetchAuthProviderAvailability
- `recovery-link.ts` (90L) WHAT PROVES SOMEBODY IS ALLOWED TO SET A NEW PASSWORD. | RecoveryEvidence, paramsOf, readRecoveryEvidence
- `safe-next.ts` (107L) WHERE OCADE IS ALLOWED TO SEND SOMEBODY AFTER THEY SIGN IN. | safeNext, rememberNext, rememberedNext
- `session-failure.ts` (137L) Why did the auth server not confirm this session? | AuthFailureKind, MaybeAuthError, statusIsRejection, isRetryableTransport, classifyAuthFailure, mayUseCachedSession +1
- `throttle.ts` (165L) How long OCADE makes someone wait after a failed attempt. | ThrottledAction, ThrottleState, emptyThrottle, delayAfter, secondsUntilAllowed, recordFailure +7

### src/lib/brain/
- `adapter.ts` (101L) The OCADE Brain adapter contract. | AdapterCapabilities, AdapterUnavailable, AdapterReady, AdapterAvailability, BrainMessage, BrainStreamHandlers +3
- `delivery-signature.ts` (95L) THE SIGNATURE THAT MAKES A PRIVATE ARTIFACT REACHABLE WITHOUT MAKING I | key, sign, equal, mintDeliveryPath, DeliveryVerdict, verifyDelivery
- `download-plan.ts` (401L) How fast to pull, in how many pieces, and from where. | DeviceSignals, TransferPlan, concurrencyCeiling, rungAtOrBelow, planTransfer, ThroughputSample +8
- `install-telemetry.ts` (49L) THE SHAPE OF AN INSTALL EVENT, AND NOTHING THAT STORES ONE. | InstallTelemetry
- `installation-authority.ts` (1152L) THE ONE THING THAT INSTALLS OCADE'S LOCAL INTELLIGENCE. | InstallStage, InstallState, InstallRemedy, CapabilityPath, CapabilityRung, InstallTarget +5
- `installation-browser.ts` (299L) The one installation authority this browser tab uses, wired to real th | probeBrowserCapabilities, resolveInstallTarget, acquireInstallLock, createBus, installationAuthority, activateBrowserRuntime
- `installation-state.ts` (162L) The published installation state, and NOTHING ELSE. | installState, subscribeToInstallState, publishInstallState, describeInstall, isErrorStage, isPreparing +1
- `model-store.ts` (376L) Where browser-side model weights live. | StoredModel, opfsAvailable, ModelFileWriter, WritableFileWriter, SyncAccessWriter, ModelStore
- `model-transfer.ts` (1068L) Moving a gigabyte onto a device that keeps changing its mind. | TransferFailure, TransferProgress, TransferCheckpoint, TransferRequest, TransferMetrics, TransferResult +5
- `model-vault.ts` (598L) Versioned model storage: staging, activation, rollback and removal. | VersionMeta, StoredVersion, InstallationView, LegacyStorage, VaultDeps, Manifest +6
- `offline-objects.server.ts` (130L) WHERE THE OFFLINE RELEASE'S TWO PRIVATE OBJECTS ARE, AND HOW ONE BYTE | R2Range, R2Object, R2Listed, R2Bucket, PartObject, matchParts +3
- `offline-release.functions.ts` (35L) WHAT A SIGNED-IN BROWSER IS TOLD ABOUT THE ARTIFACT, AND HOW IT REACHE | OfflineReleaseView
- `offline-release.ts` (105L) THE ONE ARTIFACT OFFLINE INTELLIGENCE INSTALLS, DESCRIBED WITHOUT NAMI | OfflineReleasePart, OfflineRelease, validParts, offlineRelease
- `runtime-activation.ts` (197L) Turning a chosen capability path into a running engine. | RuntimeProgress, activeRuntime, activateRuntimeForPath, startWasm, authorityBackedAdapter, disposeRuntime
- `sampler-settings.ts` (19L) THE SAMPLING VALUES OFFLINE INTELLIGENCE RUNS AT — DECIDED ONCE.
- `streaming-digest.ts` (305L) SHA-256 that can be fed in pieces, paused, written down, and picked up | DigestCheckpoint, StreamingSha256, sha256OfBlobStreaming
- `use-installation.ts` (245L) Reading — and starting — the one installation, from React. | authority, useInstallationState, InstallationControls, useInstallation, holdAllowanceWhenReady, offlineAllowedHere +1
- `wasm-threads.ts` (180L) How many processor threads OCADE's compatibility engine actually gets. | ThreadSignals, ThreadPlan, planThreads, readThreadSignals

### src/lib/brain/adapters/
- `browser-wasm.ts` (766L) | WllamaModule, ChatCompletionMessage, WllamaInstance, reasoningFilter, unfinishedTagLength, wantsJsonOnly +10

### src/lib/byok/
- `connections.ts` (284L) The browser's side of Settings > BYOK (plan 14B.1A). It reads the pers | ByokProtocol, ByokConnection, ByokModel, ByokState, token, setByokImages +4
- `refusals.ts` (34L) Why a person's own key did not answer, in their words (plan 14B.1B.5, | byokRefusal

### src/lib/chat/
- `answer-language.ts` (49L) ANSWER LANGUAGE (plan 14E.8 Preferences, 14B language setting): the pe | AnswerLanguage, key, readAnswerLanguage, saveAnswerLanguage, languageInstruction
- `attachments.ts` (238L) TURNING A FILE INTO SOMETHING OCADE CAN ACTUALLY READ. | PendingAttachment, isText, looksLikeImage, unreadable, readAttachment, weight +3
- `enhance-prompt.ts` (66L) ENHANCE PROMPT (plan 14E.2): a clearer version of the person's own dra | Enhancement, enhancePrompt
- `prompt-details.ts` (26L) The loss-of-detail check behind Enhance prompt (plan 14E.2.5): pure, s | lostDetails
- `unsynced-turns.ts` (233L) TURNS THE ACCOUNT HAS NOT RECEIVED YET, KEPT ENCRYPTED UNTIL IT HAS. | UnsyncedTurn, JournalRow, db, run, keyFor, inOrder +10
- `use-chat.ts` (1191L) | IntelligenceChoice, titleFrom, temporaryRecord, ChatState, ChatActions, useChat
- `use-dictation.ts` (113L) SPEAKING INSTEAD OF TYPING, USING WHAT THE BROWSER ALREADY HAS. | RecognitionResult, RecognitionEvent, Recognition, RecognitionConstructor, available, Dictation +1
- `use-shortcuts.ts` (62L) | useChatShortcuts

### src/lib/commercial/
- `device-identity.ts` (209L) | CurrentDeviceIdentity, DeviceRegistrationProblem, DeviceRegistrationFailed, deviceRegistrationProblem, observeAccount, watchDeviceRegistration +6
- `entitlement-resolver.ts` (63L) Resolve tier from the audited grant authority; anchor windows to profi | ResolvedEntitlement, resolveTierFor, Unlimited, unlimitedFor, accountAnchorFor
- `generation-gate.ts` (438L) THE ONE GATE ABOVE EVERY AI SURFACE. | GenerationSurface, DurablePermitOutcome, DurablePermitAcquisition, DurableWindowUsage, CommercialUsageLedger, AllowanceExhausted +6
- `offline-allowance.ts` (154L) | syncOfflineAllowance, canAnswerWithoutNetwork
- `offline-counter.ts` (589L) | DeviceKeyRow, LeaseRow, LeaseStateRow, EventRow, openDb, requestResult +18
- `offline-devices.ts` (108L) THE DEVICES THAT CAN ANSWER WITHOUT A NETWORK, AND HOW TO FREE A SLOT. | OfflineDevice, listOfflineDevices, revokeOfflineDevice
- `offline-lease.server.ts` (227L) | decoded, importOfflineLeasePrivateKey, signOfflineUsageLease, OfflineLeaseSigningAuthority, loadOfflineLeaseSigningAuthority, importDeviceEventPublicKey +2
- `offline-lease.ts` (310L) | OfflineUsageLeasePayload, SignedOfflineUsageLease, OfflineLeaseVerificationKey, OfflineLeaseRefusal, OfflineLeaseDecision, TrustedOfflineTimeInput +14
- `offline-usage.functions.ts` (303L) | first, signingAuthority, leasePayload
- `supabase-ledger.ts` (187L) Server-only RPC binding. Amounts cross the database boundary as intege | toHundredths, fromHundredths, firstRow, durableOutcome, windowKey, isAllowanceExhausted +1
- `usage-policy.ts` (196L) ONE SUCCESSFUL REQUEST IS ONE USE, ON EVERY TIER. | SESSION_WINDOW_MS, UsageWindowKind, TierAllowance, UsageWindow, windowFor, millisecondsUntilReset +5
- `usage.functions.ts` (227L) Authenticated usage operations. Account identity comes only from verif | generationGate, PermitGranted, PermitRefused, PermitResult, CommercialUsageView
- `use-commercial-usage.ts` (51L) ONE READ OF THE ALLOWANCE, SHARED BY EVERY SURFACE THAT SHOWS IT. | UsageWindowView, useCommercialUsage, tightestWindow, describeReset
- `use-generation-permit.ts` (385L) ONE BILLED REQUEST, FROM THE SURFACE'S POINT OF VIEW. | DeliveredWork, BilledRequest, withTimeout, formatResetAt, beginBilledRequest, unavailablePermit +3

### src/lib/intelligence/
- `OnlineConsent.tsx` (132L) ASKED ONCE, BEFORE ANYTHING IS SENT ONLINE (20261013091000). | OnlineConsentDialog
- `QualityControl.tsx` (99L) | QualityControl, HighConfirm
- `anthropic.ts` (277L) | Block, anthropicBody, record, anthropicResponse
- `byok-handler.ts` (744L) SETTINGS > BYOK, ON THE SERVER (plan 14B.1A.3-5, 14B.1B.5-7). | ByokDependencies, ListedModel, SpendingPolicy, statusOf, concat, boundedJson +19
- `contract.ts` (311L) | IntelligenceMode, IntelligenceBackend, IntelligencePermit, NormalizedMessage, NormalizedAssistantPart, NormalizedToolDefinition +19
- `edge-handler.ts` (1984L) | OnlineRequestBody, CustomerRoute, OnlineHandlerDependencies, json, cors, isServiceKey +28
- `gateway-address.ts` (150L) A CUSTOMER'S MODEL ADDRESS IS CHECKED BEFORE OCADE'S SERVER DIALS IT ( | AddressRefusal, gatewayAddress, v4, publicV4, v6, publicAddress +1
- `ocade-intelligence.ts` (27L) THE ONE ASSEMBLY POINT. Everything that generates goes through this ob | ocadeIntelligence
- `offline-transport.ts` (191L) Offline Intelligence, behind the same contract the online boundary use | toBrainMessages, createOfflineIntelligenceTransport
- `online-client.ts` (281L) | OnlineClientDependencies, browserAccessToken, refreshedAccessToken, defaults, isEvent, createOnlineIntelligenceTransport
- `online-consent-ask.ts` (21L) Where the transport asks the mounted consent dialog (OnlineConsent.tsx | setOnlineConsentAsk, askOnlineConsent
- `online-consent-version.ts` (2L) The version of the online-intelligence words agreed to; a new version
- `online-consent.functions.ts` (40L) The account's agreement to online intelligence (20261013091000). Onlin
- `online-models.ts` (95L) Owner correction, 19 October 2026: Standard is Gemini; High is opt-in | OnlineModelId, plannerModel, ProviderProtocol, PlannerProvider, plannerProvider, ProviderKeySlot +2
- `openai-responses.ts` (256L) | Item, responsesBody, record, responsesResponse
- `quality.ts` (6L) Customer choices, with no hidden provider names or automatic upgrade. | IntelligenceQuality
- `router.ts` (265L) | IntelligenceRouterOptions, linkedController, requestWithSignal, failureEvent, createOcadeIntelligence
- `use-intelligence-quality.ts` (15L) | useIntelligenceQuality
- `workers-ai.ts` (266L) | workersAiBody, record, workersAiResponse

### src/lib/jarvis/
- `authority.server.ts` (1564L) THE JARVIS TASK AUTHORITY (plan.md §23, P02/P03/P13/P16). | Admin, JarvisRefusal, call, addInstruction, TaskState, agentCounts +40
- `business-workspace.ts` (47L) | businessDraft
- `consent-needed.ts` (7L) The one refusal the JARVIS page answers by asking (the shared online-c
- `contracts.ts` (1684L) THE JARVIS PROTOCOL, ONCE (plan.md §4.2, §22.3, P01/P05). | outputPath, Target, mcpTarget, num, Operation, StepExpectation +8
- `device-match.ts` (35L) REPO-43: a task never moves between computers on its own. When the per | DeviceApps, has, appOnAnotherComputer
- `directory.ts` (119L) APPS & WEBSITES (plan 14E.6, 14E.8, REPO-19): one searchable directory | EntryKind, EntryState, DirectoryEntry, DeviceInput, directory, search
- `functions.ts` (713L) JARVIS for the signed-in person: Send, STOP, Take Over, Resume, confir | taskSessionId, admit, authority, guarded, live, scheduleRefusal
- `habits.ts` (22L) Repeated, verified outcomes of one person (R12-10): at least two, newe | habits
- `lanes.ts` (118L) | workspaceKey, resources, conflicts, assignLanes
- `lifeos.functions.ts` (71L)
- `lifeos.ts` (30L) | ObligationView, civilDate, obligationView, obligationSignal
- `mentions.ts` (146L) THE @ PICKER'S LOGIC (plan 14E.3), KEPT PURE SO IT CAN BE TESTED WITHO | ResourceKind, InstalledApp, deviceResources, permitted, MentionCandidate, mentionQuery +4
- `objective.ts` (11L) One accepted request budget across the composer, handoff and task auth
- `opportunity-engine.ts` (97L) | JobListing, listingUrl, reviewJobListing, labels, assessJobListing, jobApplicationDraft
- `packages.ts` (175L) | Product, Package, builtInSkills, productDraftAllows
- `planner.server.ts` (2115L) ONLINE PLANNING FOR EVERY CUSTOMER OUTCOME (plan.md §4.1, §23.3, P13). | McpServer, routeExternalTools, terms, rankBySimilarity, unseenAddress, observedSinceTakeOver +42
- `problem-radar.ts` (157L) PROBLEM RADAR (plan 28.1.3): deterministic checks over the person's ow | Severity, RadarSource, Finding, RadarInput, obligationSeverity, problemRadar
- `proof-passport.ts` (149L) PROOF PASSPORT (plan 28.1.7 T12-07): a portable record of what a JARVI | PassportStatus, PassportInput, passportStatus, canonical, sha256, buildPassport +2
- `scam.ts` (105L) ANTI-SCAM GUARDIAN (plan 28.2.6): explainable warning signs on pages J | ScamSign, scamSigns, flaggedSites
- `schedule-time.ts` (118L) WHEN A SCHEDULED JARVIS RUN HAPPENS, IN THE PERSON'S OWN TIME ZONE. | ScheduleRepeat, isTimeZone, Wall, wallTime, zonedInstant, nextOccurrence
- `schedules.server.ts` (138L) RUN WHAT PEOPLE SCHEDULED, ONCE PER OCCURRENCE (REPO-60/70, plan Part | Admin, Claimed, ScheduleSweep, SweepDeps, runDueSchedules
- `sensitive-values.ts` (79L) INTELLIGENT PRIVACY (plan 27.2.3 R12-03, 27.4.3): payment card numbers | luhn, ibanValid, id, maskSensitive, unmaskArguments
- `skillforge.ts` (215L) SKILLFORGE (plan 28.2.1, X01): what the person showed once in one app | Workflow, slug, proposeWorkflow, workflowBody, workflowOf, parameterValues +2
- `skills.functions.ts` (118L) | SkillRow
- `skills.ts` (33L) Skills in a JARVIS request (plan 14E.6.6): `/name` words name the pers | Skill, namedSkills, skillLines
- `supervisor.ts` (330L) Shared JARVIS decision and verification contracts (plan.md P13/P16). | Step, Milestone, milestonesFor, inDependencyOrder, milestoneProgress, Decision +8
- `time-reclaimed.ts` (121L) TIME RECLAIMED (plan 28.1.12 T12-12): what JARVIS finished for this pe | TaskRecord, countOutcomeChecks, record, Period, verified, recordsInPeriod +3
- `unfinished.ts` (25L) UX-30 Zeigarnik Effect: which conversations still hold unfinished JARV | OpenTask, unfinishedByConversation

### src/lib/library/
- `intake.ts` (220L) WHAT A LIBRARY UPLOAD IS ALLOWED TO BE (threat register O-04/O-15, sce | IntakeRefusal, libraryName, starts, isProgram, contains, ascii +6
- `library.functions.ts` (381L) | LibraryItemRow
- `resumable-upload.ts` (159L) RESUMABLE LIBRARY UPLOADS (plan 14E.4.3-4): large files go straight fr | b64, fingerprint, ResumeRecord, trustedUploadLocation, acknowledgedOffset, uploadResumable +1
- `tombstones.server.ts` (103L) Settle the bytes an account is owed a deletion for. | sweepTombstones
- `upload-fence.ts` (32L) UPLOAD-06: a deletion fences uploads begun before it. Pure functions, | timeOrderedId, uploadBeganAt, fencedUpload

### src/lib/notifications/
- `categories.ts` (118L) WHAT OCADE CAN NOTIFY SOMEBODY ABOUT, AND WHAT IT MAY NEVER SILENCE. | NotificationCategoryId, NotificationCategory, NotificationFrequency, isNotificationCategory, findNotificationCategory, isMutable
- `channels.ts` (99L) WHERE A NOTIFICATION CAN ACTUALLY GO, DERIVED RATHER THAN DECLARED. | NotificationChannelId, NotificationChannel, ChannelConfiguration, resolveChannels, deploymentChannelConfiguration
- `chat-hook.ts` (70L) CHAT-APP NOTIFICATIONS (plan REPO-20; owner rejected the deferral): a | ChatKind, chatHookKind, chatRequest, chatRetryAllowed
- `chat.functions.ts` (53L)
- `delivery.ts` (83L) WHAT "DELIVERED" MEANS, PER CHANNEL, IN WORDS THE PRODUCT CAN DEFEND. | DeliveryState, DeliveryReport, isDeliveryState, deliveryReport, parseDeliveryReport
- `history.ts` (93L) Reading the notification history, and changing the one thing a person | NotificationRecord, HistoryOutcome, listNotifications, markAllNotificationsRead, call, describe
- `preference-sync.ts` (132L) ONE PREFERENCE, IN ONE PLACE, AND AN HONEST ANSWER ABOUT WHETHER IT GO | PreferenceBackend, StoredPreferenceRow, SaveOutcome, LoadedPreferences, loadNotificationPreferences, saveNotificationPreferences
- `preferences.ts` (277L) WHAT A PERSON CHOSE TO BE TOLD, AND THE CHOICES OCADE REFUSES TO HONOU | QuietHoursPreference, CategoryPreference, NotificationPreferences, defaultPreferences, normalisePreferences, validHour +5
- `push-device.ts` (132L) BROWSER NOTIFICATIONS ON THIS DEVICE: TURNED ON HERE, BY THE PERSON, O | PushDeviceState, publicKey, appleWithoutHomeScreen, registration, pushDeviceState, signedInAs +5
- `send.server.ts` (278L) THE ONLY THING IN OCADE THAT MAY WRITE A NOTIFICATION. | NotificationToSend, SendOutcome, sendNotification, readPreferences, pushToBrowsers, postToChat +1
- `supabase-backend.ts` (80L) The preference backend, bound to Supabase. | supabasePreferenceBackend, describe
- `web-push.ts` (238L) WEB PUSH, DONE WITH THE PLATFORM'S OWN CRYPTOGRAPHY AND NOTHING ELSE. | Bytes, utf8, concat, hkdf, privateJwk, PushSubscriptionKeys +7

### src/lib/payments/
- `pricing.ts` (244L) THE CATALOGUE. Every plan OCADE sells, every price it displays, and th | PlanTier, PlanCadence, PlanId, CurrencyCode, PlanPrice, Plan +6

### src/lib/security/
- `assurance-middleware.ts` (181L) AAL ENFORCEMENT WHERE IT COUNTS: ON THE SERVER. | AssuranceRequiredError, readSessionAssurance, requireAssurance
- `assurance.ts` (199L) HOW SURE OCADE HAS TO BE THAT IT IS STILL YOU. | AssuranceLevel, proofAction, AssuranceRequirement, SessionAssurance, AssuranceRefusal, AssuranceDecision +2
- `csp-nonce.ts` (21L) The CSP nonce of the request being rendered, for the router's own inli | setRequestNonceSource, requestNonce, newNonce
- `identity.ts` (144L) SIGN-IN METHODS: CHANGING THE EMAIL, LINKING AND UNLINKING PROVIDERS. | LinkedIdentity, Client, client, describeIdentityError, listIdentities, canUnlink +2
- `isolation-upgrade.ts` (148L) Getting an already-loaded document onto the isolated side of the bound | IsolationOutcome, UpgradeDeps, upgradeIsolation, upgradeIsolationInBrowser
- `isolation.ts` (227L) Cross-origin isolation, on the routes that need it and nowhere else. | shouldIsolate, IsolationHeaders, isolationHeadersFor, needsFullNavigation, isolationUpgradeTarget, normalisePath +2
- `mfa.ts` (283L) THE ONE PLACE OCADE TALKS TO SUPABASE ABOUT SECOND FACTORS. | SecondFactor, EnrollmentStarted, Client, client, describeMfaError, listFactors +7
- `public-response.ts` (305L) | appCsp, loopbackBackend, connectSources, defaultSecurityHeaders, withPublicSecurityHeaders, isLoopback +2
- `rate-limit.server.ts` (36L) SEC-04: one per-person limit for server actions that start work or rea | admit
- `reauthentication.ts` (105L) PROVING, RIGHT NOW, THAT IT IS STILL YOU. | readSessionAssurance, checkAssurance, assuranceRefusalOf
- `recovery-codes.ts` (144L) RECOVERY CODES: HOW THEY ARE MADE, WRITTEN DOWN, AND CHECKED. | drawSymbols, generateRecoveryCode, generateRecoveryCodes, normalizeRecoveryCode, looksLikeRecoveryCode, hashRecoveryCode
- `recovery.functions.ts` (226L) RECOVERY CODES: ISSUED WITH THE SECOND FACTOR, REDEEMED WHEN IT IS LOS | randomBytes, RecoveryCodeStatus, RecoveryOutcome
- `secret-shape.ts` (86L) KEY-16: OCADE never asks for a key in a message, and warns before one | redactSecrets, redactConsole, secretShape, confirmSendWithSecret
- `session-middleware.ts` (48L) EVERY SIGNED-IN SERVER FUNCTION GOES THROUGH HERE. | SecondFactorRequired
- `session-standing.ts` (46L) Whether the session behind a verified token may use the account right | Standing, RpcClient, sessionStanding
- `sessions.functions.ts` (273L) WHO IS SIGNED IN TO THIS ACCOUNT, AND HOW TO STOP THEM. | AccountSession, callerSessionId, RevokeOutcome, callerSessionIsLive, auditSession
- `user-agent.ts` (63L) A USER-AGENT STRING, TURNED INTO SOMETHING A PERSON CAN RECOGNISE. | describeAgent

### src/lib/supabase/
- `read-all.ts` (68L) Reading a whole list from PostgREST, which is not what `select()` does | PageResult, readAllPages
- `rpc-null.ts` (29L) PASSING NULL TO A SQL PARAMETER THE TYPE GENERATOR CALLS NON-NULLABLE. | sqlNullable

### src/lib/telemetry/
- `operation-health.ts` (172L) WHAT THE PRODUCT IS DOING, IN A SHAPE THAT CANNOT CARRY ANYBODY'S WORK | HealthComponent, HealthOperation, ErrorClass, ProviderSlot, LatencyBucket, HealthOutcome +5

### src/lib/time/
- `trusted-clock.ts` (112L) THE CLOCK OCADE IS WILLING TO BELIEVE. | ReadWriteStore, readTrustedClockHighWater, observeNow, settleTrustedClock, hasTrustedClockStorage, safeLocalStorage

### src/routes/
- `__root.tsx` (432L) | RootShell, RootComponent, refreshOfflineAllowance, useOfflineWanted, BrowserBootstrap, NotFoundComponent +1
- `about.tsx` (96L) | AboutPage
- `auth.callback.tsx` (180L) | CallbackPage
- `auth.challenge.tsx` (286L) | ChallengePage
- `auth.index.tsx` (421L) | AuthPage, SubmitButton
- `auth.verify.tsx` (280L) | VerifyPage
- `help.tsx` (498L) | Category, textOf, HelpPage, Faq
- `index.tsx` (29L) | ChatPage
- `ocade-jarvis.tsx` (36L) | JarvisPage
- `pricing.tsx` (265L) WHAT OCADE COSTS, ON A PAGE ANYBODY CAN READ. | PricingPage, PlanCard, Action, Benefit
- `privacy.tsx` (33L) | PrivacyPage
- `reset-password.tsx` (286L) | ResetPasswordPage
- `robots[.]txt.ts` (44L)
- `sitemap[.]xml.ts` (56L) | escapeXml
- `terms.tsx` (33L) | TermsPage

### src/routes/_authenticated/
- `admin.tsx` (942L) | Module, ConsolePage, SecondFactorNotice, CustomersModule, CustomerDetail, CaseChoices +3
- `library.tsx` (395L) | Filter, LibraryPage, describeSize
- `route.tsx` (180L) | AuthedLayout, AuthedError

### src/routes/api/
- `jarvis.device.ts` (28L) The one door a paired JARVIS companion uses: enroll, ask for work, rep

### src/routes/api/offline/
- `bytes.$release.ts` (146L) THE ONLY DOOR TO THE ARTIFACT. | partObjects, bucket, parseRange

### supabase/
- `config.toml` (28L)

### supabase/functions/_shared/
- `boundary.ts` (571L) | namedPlatformKey, read, heldSlots, settle, observe, capabilityKey +8
- `workers-ai.ts` (77L) High is included-only. Unknown, paid, trial, missing or unreadable bil | hardFreePlan, highIncluded

### supabase/functions/ocade-byok/
- `index.ts` (113L) Settings > BYOK (plan 14B.1A): a signed-in person adds, tests, chooses

### supabase/functions/ocade-intelligence/
- `index.ts` (10L) OCADE Online Intelligence, as browsers reach it: a signed-in person's

### supabase/functions/ocade-intelligence-benchmark/
- `index.ts` (26L) STAGING ONLY: the owner-directed model comparison (plan.md §19.4, O2,

### supabase/functions/ocade-intelligence-service/
- `index.ts` (17L) OCADE Online Intelligence, as OCADE's own server reaches it: the plann

### supabase/migrations/
- 218 data files: 20260720120222_c726faf2-f6d1-4d0c-9e47-9673aa43118b.sql ... 20261124090000_a_person_chooses_whether_their_key_sees_images.sql

### supabase/rollback/
- 218 data files: 20260720120222_c726faf2-f6d1-4d0c-9e47-9673aa43118b_rollback.sql ... 20261124090000_a_person_chooses_whether_their_key_sees_images_rollback.sql

### tests/jarvis/
- tests: benchmark.py, contracts.test.ts, desktop_probe.py, e2e.test.ts, live_eval.py, skillforge.test.ts, test_eval_audit.py, test_eval_isolation.py, voice.test.ts

### tests/jarvis/db/
- 48 test files: account-deletion.test.sql ... watches.test.sql

### tests/security/
- 71 test files: adaptive-team.test.ts ... whole-turn.test.ts

### tests/source-research/
- tests: test_reader.py

### tests/web/
- tests: accessibility_audit.py, account_erasure_storage.mjs, account_switch.py, auth_negative.mjs, jarvis_ui_flow.py, objective_handoff.py, radar_autopilot_flow.py, session.mjs, stop_response.py, surface_audit.py, ux_laws_audit.py

### tools/source-research/
- `README.md` (200L) Exhaustive OCADE source research for Claude Code
- `audit_trees.py` (75L) Independently reconcile the lossless original Git-tree archive and pin | audit
- `materialize.py` (100L) Retry materialization without changing gitlinks, source files or prior | command, materialize
- `reader.py` (798L) Sequential immutable source research. Python standard library + Git on | encode, pack, load, sha, git, tree +7
