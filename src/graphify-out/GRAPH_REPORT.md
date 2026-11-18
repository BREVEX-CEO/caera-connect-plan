# Graph Report - src  (2026-11-18)

## Corpus Check
- 198 files · ~221,575 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: .css 2)

## Summary
- 1883 nodes · 5026 edges · 72 communities (68 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 88 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `723cdb82`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- auth.verify.tsx
- browser-wasm.ts
- authority.server.ts
- planner.server.ts
- ChatWorkspace.tsx
- data-rights.ts
- JarvisPanels.tsx
- generation-gate.ts
- installation-authority.ts
- contracts.ts
- staff.functions.ts
- routeTree.gen.ts
- auth.index.tsx
- edge-handler.ts
- __root.tsx
- contract.ts
- ModelVault
- byok-handler.ts
- client.server.ts
- ModelInstallationAuthority
- recovery.functions.ts
- reset-password.tsx
- offline-counter.ts
- useSession
- ref_tanstack_react_router
- use-generation-permit.ts
- use-chat.ts
- JarvisWorkspace.tsx
- attachments.ts
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
- MessageList.tsx
- Storage
- send.server.ts
- settings-dialog.tsx
- installation-authority.ts
- operation-health.ts
- BrowserWasmAdapter
- client.ts
- appearance.tsx
- usage-policy.ts
- use-voice.ts
- usage.functions.ts
- ErrorBoundary.tsx
- isRecord
- isolation.ts
- public-response.ts
- offline-release.functions.ts
- BrainAdapter
- intake.ts
- history.ts
- preference-sync.ts
- StreamingSha256
- use-dictation.ts
- FileSystemSyncAccessHandle
- gateway-address.ts
- help.tsx
- ConversationList.tsx
- library.functions.ts
- nitro-virtual.d.ts

## God Nodes (most connected - your core abstractions)
1. `loadSupabaseClient()` - 51 edges
2. `useSession()` - 39 edges
3. `runOnlineIntelligence()` - 35 edges
4. `Row()` - 34 edges
5. `cn()` - 34 edges
6. `planStep()` - 33 edges
7. `ModelInstallationAuthority` - 31 edges
8. `ChatWorkspace()` - 31 edges
9. `ModelVault` - 28 edges
10. `JarvisWorkspace()` - 28 edges

## Surprising Connections (you probably didn't know these)
- `Client` --calls--> `loadSupabaseClient()`  [EXTRACTED]
  src/lib/security/mfa.ts → src/integrations/supabase/on-demand.ts
- `DiscoveredLimit` --references--> `ProviderKeySlot`  [EXTRACTED]
  src/lib/intelligence/edge-handler.ts → src/lib/intelligence/online-models.ts
- `Client` --calls--> `loadSupabaseClient()`  [EXTRACTED]
  src/lib/security/identity.ts → src/integrations/supabase/on-demand.ts
- `defaults()` --indirect_call--> `getSupabaseBrowserConfiguration()`  [INFERRED]
  src/lib/intelligence/online-client.ts → src/integrations/supabase/configuration.ts
- `BrowserWasmAdapter` --implements--> `BrainAdapter`  [EXTRACTED]
  src/lib/brain/adapters/browser-wasm.ts → src/lib/brain/adapter.ts

## Import Cycles
- None detected.

## Communities (72 total, 4 thin omitted)

### Community 0 - "auth.verify.tsx"
Cohesion: 0.22
Nodes (26): loadSupabaseClient(), friendlyOtpError(), rememberNext(), delayAfter(), describeWait(), emptyThrottle(), loadThrottle(), recordFailure() (+18 more)

### Community 1 - "browser-wasm.ts"
Cohesion: 0.15
Nodes (17): AdapterAvailability, AdapterCapabilities, AdapterReady, AdapterUnavailable, BrainMessage, BrainStreamHandlers, BrainStreamResult, unavailable() (+9 more)

### Community 2 - "authority.server.ts"
Cohesion: 0.06
Nodes (52): Admin, advance(), allowDeviceRequest(), approveDevice(), BUSY_RETRY_MS, call(), canonical(), confirmAction() (+44 more)

### Community 3 - "planner.server.ts"
Cohesion: 0.06
Nodes (54): analyse(), ANALYST, batchable(), brief(), callPlanner(), canVerifyChecks(), clip(), commandsNotYetRun() (+46 more)

### Community 4 - "ChatWorkspace.tsx"
Cohesion: 0.15
Nodes (21): AttachmentTray(), ChatWorkspace(), grow(), send(), CHOICES, closeMore(), IconButton(), LowAllowanceNotice() (+13 more)

### Community 5 - "data-rights.ts"
Cohesion: 0.09
Nodes (29): Database, ACCOUNT_DATA_CLASSES, AccountDataClass, AccountDataClassId, AccountDataTable, AccountTable, exportedTablesFor(), OwnerColumn (+21 more)

### Community 6 - "JarvisPanels.tsx"
Cohesion: 0.14
Nodes (33): ACCESS, ArtifactItem(), Conversations(), DEVICE_LABELS, DeviceAccess(), duration(), Elapsed(), JarvisAccess() (+25 more)

### Community 7 - "generation-gate.ts"
Cohesion: 0.09
Nodes (14): AdminAccountRow, AcquireRequest, AcquireResult, AllowanceExhausted, DurablePermitAcquisition, DurablePermitOutcome, DurableWindowUsage, GENERATION_SURFACES (+6 more)

### Community 8 - "installation-authority.ts"
Cohesion: 0.12
Nodes (29): adaptConcurrency(), alignChunk(), ChunkRange, clamp(), CONCURRENCY_LADDER, concurrencyCeiling(), DeviceSignals, DownloadSource (+21 more)

### Community 9 - "contracts.ts"
Cohesion: 0.05
Nodes (39): TaskState, appPermission, dependencyApproval, dependencyName, deviceRequest, element, ENGINES, evidence (+31 more)

### Community 10 - "staff.functions.ts"
Cohesion: 0.07
Nodes (81): ACTION_NAMES, ALL_PERMISSIONS, AuditModule(), CaseReader(), CasesModule(), CONTROL_NAMES, ControlRow(), EmergencyControls() (+73 more)

### Community 11 - "routeTree.gen.ts"
Cohesion: 0.05
Nodes (39): COMPANY_FACTS, Route, Route, Route, Route, Route, escapeXml(), PUBLIC_PATHS (+31 more)

### Community 12 - "auth.index.tsx"
Cohesion: 0.13
Nodes (25): AuthShell(), describeOAuthError(), FriendlyAuthError, label(), providerLabel, readOAuthErrorFromUrl(), describeResend(), OTP_RESEND_COOLDOWN_SECONDS (+17 more)

### Community 13 - "edge-handler.ts"
Cohesion: 0.07
Nodes (25): IntelligencePrivacyPolicy, NormalizedAssistantPart, NormalizedMessage, NormalizedToolCall, NormalizedToolDefinition, NormalizedUsage, SERVICE_USER_HEADER, ALLOWED_SURFACES (+17 more)

### Community 14 - "__root.tsx"
Cohesion: 0.21
Nodes (8): markHydrated(), THEME_BOOT, BrowserBootstrap(), refreshOfflineAllowance(), RootComponent(), Route, useOfflineWanted(), FileRoutesById

### Community 15 - "contract.ts"
Cohesion: 0.06
Nodes (39): Enhancement, enhancePrompt(), INSTRUCTIONS, lostDetails(), assertIntelligencePermit(), IntelligenceBackend, IntelligenceCapabilities, IntelligenceEvent (+31 more)

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
Cohesion: 0.14
Nodes (5): checkpointFrom(), ModelInstallationAuthority, readIntentFromLocalStorage(), writeIntentToLocalStorage(), TransferProgress

### Community 20 - "recovery.functions.ts"
Cohesion: 0.07
Nodes (59): messageOf(), TwoStep(), begin(), finish(), makeCodes(), turnOff(), adminClient(), exportMyAccountData (+51 more)

### Community 21 - "reset-password.tsx"
Cohesion: 0.47
Nodes (4): paramsOf(), readRecoveryEvidence(), RecoveryEvidence, Route

### Community 22 - "offline-counter.ts"
Cohesion: 0.06
Nodes (85): browserLabel(), getBrowserInstallId(), guessDeviceKind(), CurrentDeviceIdentity, DeviceRegistrationFailed, DeviceRegistrationProblem, ensureCurrentDeviceIdentity(), forgetCurrentDeviceIdentity() (+77 more)

### Community 23 - "useSession"
Cohesion: 0.24
Nodes (15): AccountRow(), AppShell(), ConsoleLink(), Destination, DESTINATIONS, Sidebar(), UsageMeter(), BrandMark() (+7 more)

### Community 24 - "ref_tanstack_react_router"
Cohesion: 0.18
Nodes (16): PRIVACY_META, TERMS_META, PrivacyContent(), TermsContent(), BackToTop(), PUBLIC_LINKS, PublicPage(), PublicSection() (+8 more)

### Community 25 - "use-generation-permit.ts"
Cohesion: 0.17
Nodes (15): GenerationSurface, LeaseStateRow, OfflineGenerationReservation, OfflineUsageEventPayload, acquireGenerationPermit, finalizeGenerationPermit, generationGate(), releaseGenerationPermit (+7 more)

### Community 26 - "use-chat.ts"
Cohesion: 0.05
Nodes (59): citationInstruction(), buffer, claimUnsyncedTurn(), db(), forgetAllUnsyncedTurns(), forgetUnsyncedTurn(), inFlight, inOrder() (+51 more)

### Community 27 - "JarvisWorkspace.tsx"
Cohesion: 0.18
Nodes (12): Section, JarvisWorkspace(), OPEN_STATUSES, RailButton(), SECTIONS, Turn, askOnlineConsent(), MAX_OBJECTIVE_LENGTH (+4 more)

### Community 28 - "attachments.ts"
Cohesion: 0.20
Nodes (13): attach(), isText(), looksLikeImage(), MAX_ATTACHMENTS, MAX_TEXT_CHARS, MAX_TOTAL_BYTES, PendingAttachment, readAttachment() (+5 more)

### Community 29 - "installation-browser.ts"
Cohesion: 0.15
Nodes (18): CapabilityPath, acquireInstallLock(), activateBrowserRuntime(), createBus(), installationAuthority(), probeBrowserCapabilities(), resolveInstallTarget(), modelVault (+10 more)

### Community 30 - "bytes.$release.ts"
Cohesion: 0.18
Nodes (12): DELIVERY_TTL_MS, DeliveryVerdict, equal(), key(), sign(), verifyDelivery(), bucket(), parseRange() (+4 more)

### Community 31 - "runOnlineIntelligence"
Cohesion: 0.18
Nodes (7): IntelligencePermit, OnlineHandlerDependencies, providerBody(), providerSchema(), runOnlineIntelligence(), OnlineModelId, ProviderKeySlot

### Community 32 - "supervisor.ts"
Cohesion: 0.12
Nodes (21): actionIntent, ActionIntent, actionReceipt, ActionReceipt, effectPossible(), intent(), OPERATIONS, outcomeCheck (+13 more)

### Community 33 - "cloudflare-entry.ts"
Cohesion: 0.05
Nodes (48): AssetBinding, augmentRequest(), CloudflareEnvironment, email(), fetch(), nitroApp, nitroHooks, queue() (+40 more)

### Community 34 - "use-installation.ts"
Cohesion: 0.19
Nodes (19): InstallRemedy, InstallStage, InstallState, describeInstall(), IDLE_INSTALL_STATE, installState(), isErrorStage(), isPreparing() (+11 more)

### Community 35 - "pricing.tsx"
Cohesion: 0.16
Nodes (18): checkPrice(), CurrencyCode, currencyForRegion(), describePrice(), detectRegion(), Plan, PlanCadence, PlanId (+10 more)

### Community 36 - "getSupabaseBrowserConfiguration"
Cohesion: 0.23
Nodes (10): whenHydrated(), AuthFailureKind, cachedSessionIsCurrent(), classifyAuthFailure(), isRetryableTransport(), MaybeAuthError, mayUseCachedSession(), statusIsRejection() (+2 more)

### Community 37 - "CommercialGenerationGate"
Cohesion: 0.17
Nodes (6): CommercialGenerationGate, CommercialUsageLedger, windowKey(), checkAllowance(), UsageWindow, windowFor()

### Community 38 - "bubble-state.ts"
Cohesion: 0.20
Nodes (14): DEFAULT, HandedQuestion, handOff(), listeners, Placement, readPlacement(), takeHandOff(), useBubblePlacement() (+6 more)

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

### Community 43 - "MessageList.tsx"
Cohesion: 0.29
Nodes (11): Action(), CodeBlock(), Controls(), copy(), ImageAsWords(), Markdown, MessageList(), Prose() (+3 more)

### Community 45 - "send.server.ts"
Cohesion: 0.23
Nodes (14): ChannelConfiguration, deploymentChannelConfiguration(), NotificationChannel, resolveChannels(), DELIVERY_ATTEMPTS, DELIVERY_STATES, deliveryReport(), DeliveryState (+6 more)

### Community 46 - "settings-dialog.tsx"
Cohesion: 0.06
Nodes (88): needsFreshProof(), Step, AdvancedSection(), BillingSection(), SUMMARY, TIERS, AddConnection(), ByokSection() (+80 more)

### Community 47 - "installation-authority.ts"
Cohesion: 0.19
Nodes (12): readDeviceSignals(), InstallTelemetry, AuthorityDeps, AUTOMATIC_REASONS, CapabilityRung, INITIAL, InstallReason, NOT_SAVED (+4 more)

### Community 48 - "operation-health.ts"
Cohesion: 0.14
Nodes (15): buildHealthRecord(), ERROR_CLASSES, ErrorClass, HEALTH_COMPONENTS, HEALTH_OPERATIONS, HealthComponent, HealthObservation, HealthOperation (+7 more)

### Community 49 - "BrowserWasmAdapter"
Cohesion: 0.28
Nodes (5): BrowserWasmAdapter, isAllocationFailure(), rememberRefusal(), formatSize(), OfflineRelease

### Community 50 - "client.ts"
Cohesion: 0.30
Nodes (9): requireSupabaseAuth, createSupabaseClient(), createSupabaseAdminClient(), supabase, createSupabaseFetch(), isNewSupabaseApiKey(), missingSupabaseConfigurationMessage(), resolveSupabaseBrowserConfiguration() (+1 more)

### Community 51 - "appearance.tsx"
Cohesion: 0.26
Nodes (11): AppearanceContext, AppearancePrefs, AppearanceProvider(), load(), AppearanceValue, applyToDocument(), DEFAULTS, persist() (+3 more)

### Community 52 - "usage-policy.ts"
Cohesion: 0.22
Nodes (9): describeUsage(), MAX_MULTIPLE_OF_PRO, millisecondsUntilReset(), SESSION_WINDOW_MS, TierAllowance, UsageDisplay, UsageVerdict, UsageWindowKind (+1 more)

### Community 53 - "use-voice.ts"
Cohesion: 0.25
Nodes (8): browserDictation(), DictationRecognition, pickVoice(), RecognitionEvent, speakable(), stopRecognition(), useJarvisDictation(), useReadAloud()

### Community 54 - "usage.functions.ts"
Cohesion: 0.26
Nodes (12): CustomerDetail, accountAnchorFor(), ResolvedEntitlement, resolveTierFor(), Unlimited, unlimitedFor(), supabaseCommercialLedger(), CommercialUsageView (+4 more)

### Community 55 - "ErrorBoundary.tsx"
Cohesion: 0.25
Nodes (5): DEVELOPER_SHAPED, ErrorBoundary, Props, readableMessage(), State

### Community 56 - "isRecord"
Cohesion: 0.47
Nodes (9): boundedString(), isRecord(), normalizeProviderChunk(), parseBody(), providerQuota(), readProviderTurn(), untilPacificMidnight(), validCalls() (+1 more)

### Community 57 - "isolation.ts"
Cohesion: 0.23
Nodes (12): IsolationHeaders, isolationHeadersFor(), isolationUpgradeTarget(), needsFullNavigation(), NEVER_ISOLATED_PATH_PREFIXES, normalisePath(), shouldIsolate(), underPrefix() (+4 more)

### Community 58 - "public-response.ts"
Cohesion: 0.26
Nodes (11): getSupabaseBrowserConfiguration(), appCsp(), canonicalOriginRedirect(), connectSources(), defaultSecurityHeaders(), FIXED_INLINE_SCRIPTS, isLoopback(), loopbackBackend() (+3 more)

### Community 59 - "offline-release.functions.ts"
Cohesion: 0.36
Nodes (5): mintDeliveryPath(), OfflineReleaseView, readOfflineRelease, OFFLINE_LABEL, offlineRelease()

### Community 65 - "intake.ts"
Cohesion: 0.29
Nodes (9): ascii(), contains(), intakeRefusal(), isProgram(), REASONS, starts(), VBA_STREAM, zipEntries() (+1 more)

### Community 66 - "history.ts"
Cohesion: 0.26
Nodes (11): isNotificationCategory(), NotificationCategoryId, DeliveryReport, call(), describe(), HistoryOutcome, listNotifications(), markAllNotificationsRead() (+3 more)

### Community 67 - "preference-sync.ts"
Cohesion: 0.15
Nodes (14): CompositeTypes, Constants, DatabaseWithoutInternals, DefaultSchema, Enums, Json, Tables, TablesInsert (+6 more)

### Community 68 - "StreamingSha256"
Cohesion: 0.27
Nodes (4): H0, K, sha256OfBlobStreaming(), StreamingSha256

### Community 69 - "use-dictation.ts"
Cohesion: 0.20
Nodes (7): available(), Dictation, Recognition, RecognitionConstructor, RecognitionEvent, RecognitionResult, useDictation()

### Community 73 - "gateway-address.ts"
Cohesion: 0.36
Nodes (8): AddressRefusal, gatewayAddress(), INTERNAL_SUFFIXES, publicAddress(), publicV4(), resolvesPublic(), v4(), v6()

### Community 74 - "help.tsx"
Cohesion: 0.33
Nodes (6): CATEGORIES, Category, QUESTIONS, Route, SEARCHED, textOf()

### Community 76 - "ConversationList.tsx"
Cohesion: 0.52
Nodes (6): ConversationList(), groupConversations(), MenuItem(), RenameField(), setSupportShare, supportShareOf

### Community 78 - "library.functions.ts"
Cohesion: 0.23
Nodes (14): IntakeRefusal, addLibraryItem, deleteLibraryItem, LIBRARY_MAX_BYTES, LibraryItemRow, listLibraryItems, signLibraryItem, uuid (+6 more)

## Knowledge Gaps
- **3 isolated node(s):** `RFC-8188`, `RFC-8291`, `RFC-8292`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 477 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `loadSupabaseClient()` connect `auth.verify.tsx` to `cloudflare-entry.ts`, `history.ts`, `preference-sync.ts`, `getSupabaseBrowserConfiguration`, `NotificationsSection.tsx`, `staff.functions.ts`, `auth.index.tsx`, `settings-dialog.tsx`, `client.ts`, `recovery.functions.ts`, `reset-password.tsx`, `offline-counter.ts`, `useSession`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `runOnlineIntelligence()` (e.g. with `.callProvider()` and `.claimPermit()`) actually correct?**
  _`runOnlineIntelligence()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-8188`, `RFC-8291`, `RFC-8292` to the rest of the system?**
  _3 weakly-connected nodes found - possible missing edges._
- **Should `authority.server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05989110707803993 - nodes in this community are weakly interconnected._
- **Why does `buildHealthRecord()` connect `operation-health.ts` to `cloudflare-entry.ts`, `edge-handler.ts`, `offline-counter.ts`, `use-generation-permit.ts`, `runOnlineIntelligence`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `planner.server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06077694235588972 - nodes in this community are weakly interconnected._
- **Why does `useSession()` connect `useSession` to `auth.verify.tsx`, `pricing.tsx`, `ChatWorkspace.tsx`, `bubble-state.ts`, `JarvisPanels.tsx`, `NotificationsSection.tsx`, `staff.functions.ts`, `settings-dialog.tsx`, `__root.tsx`, `use-chat.ts`, `JarvisWorkspace.tsx`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._