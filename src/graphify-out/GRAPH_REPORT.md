# Graph Report - src  (2026-11-18)

## Corpus Check
- 199 files · ~221,580 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: .css 2)

## Summary
- 1885 nodes · 5027 edges · 71 communities (67 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 88 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7b130c91`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- auth.verify.tsx
- browser-wasm.ts
- authority.server.ts
- planner.server.ts
- ChatWorkspace.tsx
- data-rights.ts
- JarvisWorkspace.tsx
- DataControlsSection.tsx
- installation-authority.ts
- contracts.ts
- staff.functions.ts
- routeTree.gen.ts
- auth.index.tsx
- edge-handler.ts
- ref_react
- contract.ts
- ModelVault
- byok-handler.ts
- client.server.ts
- ModelInstallationAuthority
- recovery.functions.ts
- loadSupabaseClient
- offline-counter.ts
- ref_react
- ref_tanstack_react_router
- TwoStep.tsx
- use-chat.ts
- server.ts
- assurance-middleware.ts
- installation-browser.ts
- bytes.$release.ts
- runOnlineIntelligence
- supervisor.ts
- cloudflare-entry.ts
- use-installation.ts
- pricing.tsx
- getSupabaseBrowserConfiguration
- CommercialGenerationGate
- bubble-state.ts
- notifications/preferences.ts
- NotificationsSection.tsx
- online-models.ts
- web-push.ts
- unsynced-turns.ts
- Storage
- send.server.ts
- settings-dialog.tsx
- ocade-intelligence.ts
- operation-health.ts
- ByokSection.tsx
- client.ts
- graphify-probe.ts
- usage-policy.ts
- SignInMethods.tsx
- usage.functions.ts
- ChatActions
- isolation.ts
- public-response.ts
- intake.ts
- history.ts
- preference-sync.ts
- StreamingSha256
- use-dictation.ts
- health.ts
- FileSystemSyncAccessHandle
- gateway-address.ts
- help.tsx
- ConversationList.tsx
- start.ts
- library.functions.ts
- nitro-virtual.d.ts

## God Nodes (most connected - your core abstractions)
1. `loadSupabaseClient()` - 51 edges
2. `useSession()` - 39 edges
3. `runOnlineIntelligence()` - 35 edges
4. `cn()` - 34 edges
5. `Row()` - 34 edges
6. `planStep()` - 33 edges
7. `ModelInstallationAuthority` - 31 edges
8. `ChatWorkspace()` - 31 edges
9. `ModelVault` - 28 edges
10. `JarvisWorkspace()` - 28 edges

## Surprising Connections (you probably didn't know these)
- `Client` --calls--> `loadSupabaseClient()`  [EXTRACTED]
  src/lib/security/identity.ts → src/integrations/supabase/on-demand.ts
- `CustomerDetail` --references--> `Unlimited`  [EXTRACTED]
  src/lib/admin/staff.functions.ts → src/lib/commercial/entitlement-resolver.ts
- `defaults()` --indirect_call--> `getSupabaseBrowserConfiguration()`  [INFERRED]
  src/lib/intelligence/online-client.ts → src/integrations/supabase/configuration.ts
- `installationAuthority()` --calls--> `ModelInstallationAuthority`  [EXTRACTED]
  src/lib/brain/installation-browser.ts → src/lib/brain/installation-authority.ts
- `transferModel()` --calls--> `StreamingSha256`  [EXTRACTED]
  src/lib/brain/model-transfer.ts → src/lib/brain/streaming-digest.ts

## Import Cycles
- None detected.

## Communities (71 total, 4 thin omitted)

### Community 0 - "auth.verify.tsx"
Cohesion: 0.19
Nodes (27): describeResend(), friendlyOtpError(), OTP_RESEND_COOLDOWN_SECONDS, OTP_SENT_NOTICE, secondsUntilResend(), delayAfter(), describeWait(), emptyThrottle() (+19 more)

### Community 1 - "browser-wasm.ts"
Cohesion: 0.09
Nodes (24): AdapterAvailability, AdapterCapabilities, AdapterReady, AdapterUnavailable, BrainAdapter, BrainMessage, BrainStreamHandlers, BrainStreamResult (+16 more)

### Community 2 - "authority.server.ts"
Cohesion: 0.07
Nodes (49): ONLINE_CONSENT_VERSION, Admin, advance(), allowDeviceRequest(), approveDevice(), BUSY_RETRY_MS, call(), canonical() (+41 more)

### Community 3 - "planner.server.ts"
Cohesion: 0.05
Nodes (58): analyse(), ANALYST, batchable(), brief(), callPlanner(), canVerifyChecks(), clip(), commandsNotYetRun() (+50 more)

### Community 4 - "ChatWorkspace.tsx"
Cohesion: 0.12
Nodes (27): AttachmentTray(), ChatWorkspace(), attach(), grow(), send(), CHOICES, closeMore(), IconButton() (+19 more)

### Community 5 - "data-rights.ts"
Cohesion: 0.09
Nodes (28): ACCOUNT_DATA_CLASSES, AccountDataClass, AccountDataClassId, AccountDataTable, AccountTable, exportedTablesFor(), OwnerColumn, AccountDataExport (+20 more)

### Community 6 - "JarvisWorkspace.tsx"
Cohesion: 0.06
Nodes (69): Action(), CodeBlock(), Controls(), copy(), ImageAsWords(), Markdown, MessageList(), Prose() (+61 more)

### Community 7 - "DataControlsSection.tsx"
Cohesion: 0.32
Nodes (15): ConversationsSection(), DataControlsSection(), ExportSection(), LibrarySection(), OfflineIntelligenceSection(), OnlineConsentSection(), stated(), Action() (+7 more)

### Community 8 - "installation-authority.ts"
Cohesion: 0.11
Nodes (30): adaptConcurrency(), alignChunk(), ChunkRange, clamp(), CONCURRENCY_LADDER, concurrencyCeiling(), DeviceSignals, DownloadSource (+22 more)

### Community 9 - "contracts.ts"
Cohesion: 0.05
Nodes (38): appPermission, dependencyApproval, dependencyName, DEVICE_SILENCE_MS, deviceRequest, element, ENGINES, evidence (+30 more)

### Community 10 - "staff.functions.ts"
Cohesion: 0.07
Nodes (81): ACTION_NAMES, ALL_PERMISSIONS, AuditModule(), CaseReader(), CasesModule(), CONTROL_NAMES, ControlRow(), EmergencyControls() (+73 more)

### Community 11 - "routeTree.gen.ts"
Cohesion: 0.05
Nodes (42): COMPANY_FACTS, Route, Route, Route, Route, Route, Route, Route (+34 more)

### Community 12 - "auth.index.tsx"
Cohesion: 0.15
Nodes (21): AuthShell(), describeOAuthError(), FriendlyAuthError, label(), providerLabel, readOAuthErrorFromUrl(), ASSUME_AVAILABLE, AuthProviderAvailability (+13 more)

### Community 13 - "edge-handler.ts"
Cohesion: 0.10
Nodes (24): IntelligencePrivacyPolicy, NormalizedAssistantPart, NormalizedAttachment, NormalizedMessage, NormalizedToolCall, NormalizedToolDefinition, NormalizedUsage, ALLOWED_SURFACES (+16 more)

### Community 14 - "ref_react"
Cohesion: 0.08
Nodes (24): loadDialog(), MERGED, NO_PANEL, SETTINGS_CATEGORIES, SettingsCategory, SettingsDialog, SettingsPanelContext, SettingsPanelProvider() (+16 more)

### Community 15 - "contract.ts"
Cohesion: 0.08
Nodes (27): assertIntelligencePermit(), IntelligenceBackend, IntelligenceCapabilities, IntelligenceEvent, IntelligenceGenerationFailure, IntelligenceGenerationResult, IntelligenceGenerationSuccess, IntelligenceMode (+19 more)

### Community 16 - "ModelVault"
Cohesion: 0.06
Nodes (20): ModelFileWriter, ModelStore, modelStore, opfsAvailable(), StoredModel, SyncAccessWriter, WritableFileWriter, TransferDeps (+12 more)

### Community 17 - "byok-handler.ts"
Cohesion: 0.12
Nodes (23): allowedTest(), answerText(), at(), boundedJson(), ByokDependencies, calledTool(), COLOURS, concat() (+15 more)

### Community 18 - "client.server.ts"
Cohesion: 0.16
Nodes (19): supabaseAdmin, eraseAccount(), AccountDeletionReceipt, DELETE_CONFIRMATION, deleteAccountInput, deleteMyAccount, deletionReference(), sweepTombstones() (+11 more)

### Community 19 - "ModelInstallationAuthority"
Cohesion: 0.15
Nodes (5): checkpointFrom(), ModelInstallationAuthority, readIntentFromLocalStorage(), writeIntentToLocalStorage(), TransferProgress

### Community 20 - "recovery.functions.ts"
Cohesion: 0.14
Nodes (21): OfflineReleaseView, isSameOriginWrite(), drawSymbols(), generateRecoveryCode(), generateRecoveryCodes(), hashRecoveryCode(), looksLikeRecoveryCode(), normalizeRecoveryCode() (+13 more)

### Community 21 - "loadSupabaseClient"
Cohesion: 0.23
Nodes (11): attachSupabaseAuth, loadSupabaseClient(), loadSupabaseConfiguration(), paramsOf(), readRecoveryEvidence(), RecoveryEvidence, Client, ResetPasswordPage() (+3 more)

### Community 22 - "offline-counter.ts"
Cohesion: 0.05
Nodes (96): browserLabel(), getBrowserInstallId(), guessDeviceKind(), CurrentDeviceIdentity, DeviceRegistrationFailed, ensureCurrentDeviceIdentity(), forgetCurrentDeviceIdentity(), getOfflineCurrentDeviceIdentity() (+88 more)

### Community 23 - "ref_react"
Cohesion: 0.25
Nodes (14): LowAllowanceNotice(), AccountRow(), ConsoleLink(), Destination, DESTINATIONS, Sidebar(), UsageMeter(), DeviceRegistrationProblem (+6 more)

### Community 24 - "ref_tanstack_react_router"
Cohesion: 0.17
Nodes (17): PRIVACY_META, TERMS_META, PrivacyContent(), TermsContent(), BrandMark(), BackToTop(), PUBLIC_LINKS, PublicPage() (+9 more)

### Community 25 - "TwoStep.tsx"
Cohesion: 0.30
Nodes (18): messageOf(), TwoStep(), begin(), finish(), makeCodes(), turnOff(), client(), currentAssurance() (+10 more)

### Community 26 - "use-chat.ts"
Cohesion: 0.14
Nodes (32): citationInstruction(), claimUnsyncedTurn(), forgetUnsyncedTurn(), releaseUnsyncedTurn(), unsyncedTurns(), ChatState, MODE_FOR, temporaryRecord() (+24 more)

### Community 27 - "server.ts"
Cohesion: 0.20
Nodes (13): cloudflareRequestEnv(), deploymentMetadata(), releaseHealthResponse(), readBoundedRequestText(), newNonce(), setRequestNonceSource(), fetch(), getServerEntry() (+5 more)

### Community 28 - "assurance-middleware.ts"
Cohesion: 0.17
Nodes (19): adminClient(), exportMyAccountData, streamAccountExport(), AssuranceDecision, assuranceFromClaims(), AssuranceLevel, AssuranceRefusal, AssuranceRequirement (+11 more)

### Community 29 - "installation-browser.ts"
Cohesion: 0.14
Nodes (20): CapabilityPath, CapabilityRung, acquireInstallLock(), activateBrowserRuntime(), createBus(), installationAuthority(), probeBrowserCapabilities(), resolveInstallTarget() (+12 more)

### Community 30 - "bytes.$release.ts"
Cohesion: 0.18
Nodes (13): DELIVERY_TTL_MS, DeliveryVerdict, equal(), key(), mintDeliveryPath(), sign(), verifyDelivery(), bucket() (+5 more)

### Community 31 - "runOnlineIntelligence"
Cohesion: 0.10
Nodes (18): IntelligencePermit, backoff(), completedTurnEvents(), DiscoveredLimit, errorClassForStatus(), handleOnlineIntelligence(), normalizedProviderStream(), OnlineHandlerDependencies (+10 more)

### Community 32 - "supervisor.ts"
Cohesion: 0.11
Nodes (21): TaskState, actionIntent, ActionIntent, actionReceipt, ActionReceipt, intent(), OPERATIONS, outcomeCheck (+13 more)

### Community 33 - "cloudflare-entry.ts"
Cohesion: 0.15
Nodes (18): AssetBinding, augmentRequest(), CloudflareEnvironment, email(), fetch(), nitroApp, nitroHooks, queue() (+10 more)

### Community 34 - "use-installation.ts"
Cohesion: 0.13
Nodes (26): readDeviceSignals(), InstallTelemetry, AuthorityDeps, AUTOMATIC_REASONS, INITIAL, InstallReason, InstallRemedy, InstallStage (+18 more)

### Community 35 - "pricing.tsx"
Cohesion: 0.17
Nodes (19): checkPrice(), CurrencyCode, currencyForRegion(), describePrice(), detectRegion(), Plan, PlanCadence, PlanId (+11 more)

### Community 36 - "getSupabaseBrowserConfiguration"
Cohesion: 0.22
Nodes (11): getSupabaseBrowserConfiguration(), whenHydrated(), AuthFailureKind, cachedSessionIsCurrent(), classifyAuthFailure(), isRetryableTransport(), MaybeAuthError, mayUseCachedSession() (+3 more)

### Community 37 - "CommercialGenerationGate"
Cohesion: 0.09
Nodes (19): AdminAccountRow, AcquireRequest, AcquireResult, AllowanceExhausted, CommercialGenerationGate, CommercialUsageLedger, DurablePermitAcquisition, DurableWindowUsage (+11 more)

### Community 38 - "bubble-state.ts"
Cohesion: 0.24
Nodes (13): DEFAULT, HandedQuestion, handOff(), listeners, Placement, readPlacement(), useBubblePlacement(), writePlacement() (+5 more)

### Community 39 - "notifications/preferences.ts"
Cohesion: 0.17
Nodes (18): BY_ID, findNotificationCategory(), isMutable(), NOTIFICATION_CATEGORIES, NotificationCategory, NotificationFrequency, URGENT_ONLY, NotificationChannelId (+10 more)

### Community 40 - "NotificationsSection.tsx"
Cohesion: 0.24
Nodes (17): NotificationsSection(), apply(), loadNotificationPreferences(), saveNotificationPreferences(), defaultPreferences(), appleWithoutHomeScreen(), forgetPushOnThisBrowser(), movePushToThisSession() (+9 more)

### Community 41 - "online-models.ts"
Cohesion: 0.12
Nodes (12): boundary(), sseData(), ProviderFeature, DEFAULT_ENDPOINT, DEFAULT_ONLINE_MODEL, HIGH_ONLINE_MODEL, plannerModel(), PlannerProvider (+4 more)

### Community 42 - "web-push.ts"
Cohesion: 0.18
Nodes (17): RFC-8188, RFC-8291, RFC-8292, b64url, Bytes, concat(), encryptForBrowser(), hkdf() (+9 more)

### Community 43 - "unsynced-turns.ts"
Cohesion: 0.19
Nodes (17): buffer, db(), forgetAllUnsyncedTurns(), inFlight, inOrder(), JournalRow, keyFor(), keys (+9 more)

### Community 45 - "send.server.ts"
Cohesion: 0.23
Nodes (14): ChannelConfiguration, deploymentChannelConfiguration(), NotificationChannel, resolveChannels(), DELIVERY_ATTEMPTS, DELIVERY_STATES, deliveryReport(), DeliveryState (+6 more)

### Community 46 - "settings-dialog.tsx"
Cohesion: 0.18
Nodes (27): needsFreshProof(), Step, useConfirmIdentity(), AdvancedSection(), BillingSection(), SUMMARY, TIERS, Memory (+19 more)

### Community 47 - "ocade-intelligence.ts"
Cohesion: 0.33
Nodes (7): EnhancePrompt(), Enhancement, enhancePrompt(), INSTRUCTIONS, lostDetails(), ocadeIntelligence(), createOfflineIntelligenceTransport()

### Community 48 - "operation-health.ts"
Cohesion: 0.15
Nodes (14): buildHealthRecord(), ERROR_CLASSES, ErrorClass, HEALTH_COMPONENTS, HEALTH_OPERATIONS, HealthComponent, HealthObservation, HealthOperation (+6 more)

### Community 49 - "ByokSection.tsx"
Cohesion: 0.22
Nodes (17): AddConnection(), ByokSection(), Connection(), ConnectionForm(), Sources(), ModelSource(), useSettingsPanel(), ByokConnection (+9 more)

### Community 50 - "client.ts"
Cohesion: 0.09
Nodes (27): requireSupabaseAuth, createSupabaseClient(), createSupabaseAdminClient(), supabase, createSupabaseFetch(), isNewSupabaseApiKey(), missingSupabaseConfigurationMessage(), resolveSupabaseBrowserConfiguration() (+19 more)

### Community 52 - "usage-policy.ts"
Cohesion: 0.10
Nodes (12): Database, DurablePermitOutcome, describeUsage(), MAX_MULTIPLE_OF_PRO, millisecondsUntilReset(), ONE_USE, SESSION_WINDOW_MS, TierAllowance (+4 more)

### Community 53 - "SignInMethods.tsx"
Cohesion: 0.40
Nodes (12): label(), SignInMethods(), unlink(), canUnlink(), Client, client(), describeIdentityError(), LinkedIdentity (+4 more)

### Community 54 - "usage.functions.ts"
Cohesion: 0.27
Nodes (13): accountAnchorFor(), ResolvedEntitlement, resolveTierFor(), Unlimited, unlimitedFor(), supabaseCommercialLedger(), acquireGenerationPermit, CommercialUsageView (+5 more)

### Community 56 - "ChatActions"
Cohesion: 0.10
Nodes (6): ChatActions, HIGH_USAGE_WARNING, HIGH_WARNING_INTERVAL_MS, HIGH_WARNING_VERSION, IntelligenceQuality, useIntelligenceQuality()

### Community 57 - "isolation.ts"
Cohesion: 0.23
Nodes (12): IsolationHeaders, isolationHeadersFor(), isolationUpgradeTarget(), needsFullNavigation(), NEVER_ISOLATED_PATH_PREFIXES, normalisePath(), shouldIsolate(), underPrefix() (+4 more)

### Community 58 - "public-response.ts"
Cohesion: 0.22
Nodes (12): appCsp(), canonicalOriginRedirect(), connectSources(), defaultSecurityHeaders(), FIXED_INLINE_SCRIPTS, isLoopback(), loopbackBackend(), OFFLINE_RECONNECT_SHA256 (+4 more)

### Community 65 - "intake.ts"
Cohesion: 0.26
Nodes (10): ascii(), contains(), IntakeRefusal, intakeRefusal(), isProgram(), REASONS, starts(), VBA_STREAM (+2 more)

### Community 66 - "history.ts"
Cohesion: 0.26
Nodes (11): isNotificationCategory(), NotificationCategoryId, DeliveryReport, call(), describe(), HistoryOutcome, listNotifications(), markAllNotificationsRead() (+3 more)

### Community 67 - "preference-sync.ts"
Cohesion: 0.15
Nodes (14): CompositeTypes, Constants, DatabaseWithoutInternals, DefaultSchema, Enums, Json, Tables, TablesInsert (+6 more)

### Community 68 - "StreamingSha256"
Cohesion: 0.20
Nodes (7): TransferCheckpoint, VersionMeta, DigestCheckpoint, H0, K, sha256OfBlobStreaming(), StreamingSha256

### Community 69 - "use-dictation.ts"
Cohesion: 0.20
Nodes (7): available(), Dictation, Recognition, RecognitionConstructor, RecognitionEvent, RecognitionResult, useDictation()

### Community 70 - "health.ts"
Cohesion: 0.32
Nodes (6): CloudflareRuntimeRequest, configurationMetadata(), HEALTH_HEADERS, VersionMetadataEnv, OCADE_COMMIT, OCADE_RELEASE_VERSION

### Community 73 - "gateway-address.ts"
Cohesion: 0.36
Nodes (8): AddressRefusal, gatewayAddress(), INTERNAL_SUFFIXES, publicAddress(), publicV4(), resolvesPublic(), v4(), v6()

### Community 74 - "help.tsx"
Cohesion: 0.28
Nodes (8): CATEGORIES, Category, Faq(), HelpPage(), QUESTIONS, Route, SEARCHED, textOf()

### Community 76 - "ConversationList.tsx"
Cohesion: 0.27
Nodes (7): ConversationList(), groupConversations(), MenuItem(), RenameField(), setSupportShare, supportShareOf, typedBeforeHydration()

### Community 77 - "start.ts"
Cohesion: 0.21
Nodes (8): renderErrorPage(), requestNonce(), shared, getRouter(), routeTree, csrfMiddleware, errorMiddleware, startInstance

### Community 78 - "library.functions.ts"
Cohesion: 0.15
Nodes (19): AppShell(), addLibraryItem, deleteLibraryItem, LIBRARY_MAX_BYTES, LibraryItemRow, listLibraryItems, signLibraryItem, uuid (+11 more)

## Knowledge Gaps
- **3 isolated node(s):** `RFC-8188`, `RFC-8291`, `RFC-8292`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 479 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `loadSupabaseClient()` connect `loadSupabaseClient` to `auth.verify.tsx`, `history.ts`, `preference-sync.ts`, `getSupabaseBrowserConfiguration`, `NotificationsSection.tsx`, `staff.functions.ts`, `auth.index.tsx`, `settings-dialog.tsx`, `ref_react`, `client.ts`, `SignInMethods.tsx`, `offline-counter.ts`, `ref_react`, `TwoStep.tsx`, `assurance-middleware.ts`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `runOnlineIntelligence()` (e.g. with `.callProvider()` and `.claimPermit()`) actually correct?**
  _`runOnlineIntelligence()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-8188`, `RFC-8291`, `RFC-8292` to the rest of the system?**
  _3 weakly-connected nodes found - possible missing edges._
- **Should `browser-wasm.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09191919191919191 - nodes in this community are weakly interconnected._
- **Why does `ModelVault` connect `ModelVault` to `use-installation.ts`, `installation-browser.ts`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `authority.server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06918238993710692 - nodes in this community are weakly interconnected._
- **Why does `useSession()` connect `ref_react` to `pricing.tsx`, `ChatWorkspace.tsx`, `bubble-state.ts`, `DataControlsSection.tsx`, `NotificationsSection.tsx`, `JarvisWorkspace.tsx`, `staff.functions.ts`, `settings-dialog.tsx`, `ref_react`, `SignInMethods.tsx`, `loadSupabaseClient`, `use-chat.ts`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._