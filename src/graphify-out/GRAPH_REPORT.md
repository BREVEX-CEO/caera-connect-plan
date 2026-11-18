# Graph Report - src  (2026-11-18)

## Corpus Check
- 198 files · ~221,575 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: .css 2)

## Summary
- 1887 nodes · 5030 edges · 80 communities (76 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 88 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `67938ddb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- loadSupabaseClient
- browser-wasm.ts
- authority.server.ts
- planner.server.ts
- ChatWorkspace.tsx
- data-rights.ts
- JarvisWorkspace.tsx
- DataControlsSection.tsx
- installation-authority.ts
- contracts.ts
- ConsoleModules.tsx
- routeTree.gen.ts
- JarvisPanels.tsx
- edge-handler.ts
- __root.tsx
- contract.ts
- ModelStore
- byok-handler.ts
- client.server.ts
- ModelInstallationAuthority
- recovery.functions.ts
- admin.tsx
- offline-lease.ts
- ref_react
- ref_tanstack_react_router
- ModelVault
- use-chat.ts
- server.ts
- assurance-middleware.ts
- installation-browser.ts
- use-generation-permit.ts
- runOnlineIntelligence
- supervisor.ts
- cloudflare-entry.ts
- use-installation.ts
- pricing.tsx
- device-identity.ts
- CommercialGenerationGate
- offline-counter.ts
- notifications/preferences.ts
- NotificationsSection.tsx
- online-models.ts
- web-push.ts
- unsynced-turns.ts
- staff.functions.ts
- send.server.ts
- settings-dialog.tsx
- ocade-intelligence.ts
- operation-health.ts
- settings-panel.tsx
- client.ts
- online-client.ts
- usage-policy.ts
- SignInMethods.tsx
- usage.functions.ts
- ocade-chat-store.ts
- ChatActions
- isolation.ts
- public-response.ts
- appearance.tsx
- model-vault.ts
- offline-allowance.ts
- generation-gate.ts
- supabase-ledger.ts
- offline-usage.functions.ts
- intake.ts
- history.ts
- preference-sync.ts
- StreamingSha256
- use-dictation.ts
- health.ts
- IntelligenceQuality
- FileSystemSyncAccessHandle
- gateway-address.ts
- help.tsx
- sitemap[.]xml.ts
- ConversationList.tsx
- router.tsx
- read-all.ts
- nitro-virtual.d.ts

## God Nodes (most connected - your core abstractions)
1. `loadSupabaseClient()` - 51 edges
2. `useSession()` - 39 edges
3. `runOnlineIntelligence()` - 35 edges
4. `Row()` - 34 edges
5. `cn()` - 34 edges
6. `planStep()` - 33 edges
7. `ChatWorkspace()` - 31 edges
8. `ModelInstallationAuthority` - 31 edges
9. `Action()` - 28 edges
10. `JarvisWorkspace()` - 28 edges

## Surprising Connections (you probably didn't know these)
- `ChatPage()` --calls--> `ChatWorkspace()`  [EXTRACTED]
  src/routes/index.tsx → src/components/chat/ChatWorkspace.tsx
- `ByokSection()` --indirect_call--> `readByok()`  [INFERRED]
  src/components/settings/ByokSection.tsx → src/lib/byok/connections.ts
- `defaults()` --indirect_call--> `getSupabaseBrowserConfiguration()`  [INFERRED]
  src/lib/intelligence/online-client.ts → src/integrations/supabase/configuration.ts
- `Client` --calls--> `loadSupabaseClient()`  [EXTRACTED]
  src/lib/security/identity.ts → src/integrations/supabase/on-demand.ts
- `JarvisPage()` --calls--> `JarvisWorkspace()`  [EXTRACTED]
  src/routes/ocade-jarvis.tsx → src/jarvis/JarvisWorkspace.tsx

## Import Cycles
- None detected.

## Communities (80 total, 4 thin omitted)

### Community 0 - "loadSupabaseClient"
Cohesion: 0.05
Nodes (90): messageOf(), TwoStep(), begin(), finish(), makeCodes(), turnOff(), AuthShell(), attachSupabaseAuth (+82 more)

### Community 1 - "browser-wasm.ts"
Cohesion: 0.06
Nodes (40): AdapterAvailability, AdapterCapabilities, AdapterReady, AdapterUnavailable, BrainAdapter, BrainMessage, BrainStreamHandlers, BrainStreamResult (+32 more)

### Community 2 - "authority.server.ts"
Cohesion: 0.06
Nodes (51): Admin, advance(), allowDeviceRequest(), approveDevice(), BUSY_RETRY_MS, call(), canonical(), confirmAction() (+43 more)

### Community 3 - "planner.server.ts"
Cohesion: 0.06
Nodes (54): analyse(), ANALYST, batchable(), brief(), callPlanner(), canVerifyChecks(), clip(), commandsNotYetRun() (+46 more)

### Community 4 - "ChatWorkspace.tsx"
Cohesion: 0.09
Nodes (42): AttachmentTray(), ChatWorkspace(), attach(), grow(), send(), CHOICES, closeMore(), IconButton() (+34 more)

### Community 5 - "data-rights.ts"
Cohesion: 0.07
Nodes (37): CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums, Tables, TablesInsert (+29 more)

### Community 6 - "JarvisWorkspace.tsx"
Cohesion: 0.09
Nodes (32): EnhancePrompt(), Action(), CodeBlock(), Controls(), copy(), ImageAsWords(), Markdown, MessageList() (+24 more)

### Community 7 - "DataControlsSection.tsx"
Cohesion: 0.14
Nodes (38): AddConnection(), ByokSection(), Connection(), ConnectionForm(), Sources(), ConversationsSection(), DataControlsSection(), ExportSection() (+30 more)

### Community 8 - "installation-authority.ts"
Cohesion: 0.08
Nodes (41): adaptConcurrency(), alignChunk(), ChunkRange, clamp(), CONCURRENCY_LADDER, concurrencyCeiling(), DeviceSignals, DownloadSource (+33 more)

### Community 9 - "contracts.ts"
Cohesion: 0.05
Nodes (38): TaskState, dependencyApproval, dependencyName, deviceRequest, element, ENGINES, evidence, exe (+30 more)

### Community 10 - "ConsoleModules.tsx"
Cohesion: 0.14
Nodes (41): ACTION_NAMES, ALL_PERMISSIONS, CaseReader(), CasesModule(), CONTROL_NAMES, ControlRow(), EmergencyControls(), GRANTABLE_ROLES (+33 more)

### Community 11 - "routeTree.gen.ts"
Cohesion: 0.05
Nodes (38): Route, Route, Route, Route, ChatPage(), Route, Route, AboutRoute (+30 more)

### Community 12 - "JarvisPanels.tsx"
Cohesion: 0.11
Nodes (34): ACCESS, ArtifactItem(), DEVICE_LABELS, DeviceAccess(), duration(), Elapsed(), PREVIEW_TYPES, Section (+26 more)

### Community 13 - "edge-handler.ts"
Cohesion: 0.08
Nodes (29): NormalizedAssistantPart, NormalizedToolCall, NormalizedUsage, SERVICE_USER_HEADER, ALLOWED_SURFACES, backoff(), BLOCKED_FINISH, boundedString() (+21 more)

### Community 14 - "__root.tsx"
Cohesion: 0.09
Nodes (24): BubbleSetting(), DEVELOPER_SHAPED, ErrorBoundary, Props, readableMessage(), State, DEFAULT, HandedQuestion (+16 more)

### Community 15 - "contract.ts"
Cohesion: 0.11
Nodes (25): assertIntelligencePermit(), IntelligenceBackend, IntelligenceCapabilities, IntelligenceEvent, IntelligenceGenerationFailure, IntelligenceGenerationResult, IntelligenceGenerationSuccess, IntelligenceMode (+17 more)

### Community 16 - "ModelStore"
Cohesion: 0.09
Nodes (8): ModelFileWriter, ModelStore, modelStore, opfsAvailable(), StoredModel, SyncAccessWriter, WritableFileWriter, TransferDeps

### Community 17 - "byok-handler.ts"
Cohesion: 0.12
Nodes (23): allowedTest(), answerText(), at(), boundedJson(), ByokDependencies, calledTool(), COLOURS, concat() (+15 more)

### Community 18 - "client.server.ts"
Cohesion: 0.13
Nodes (24): needsFreshProof(), AdvancedSection(), supabaseAdmin, eraseAccount(), AccountDeletionReceipt, DELETE_CONFIRMATION, deleteAccountInput, deleteMyAccount (+16 more)

### Community 20 - "recovery.functions.ts"
Cohesion: 0.14
Nodes (21): ONLINE_CONSENT_VERSION, isSameOriginWrite(), drawSymbols(), generateRecoveryCode(), generateRecoveryCodes(), hashRecoveryCode(), looksLikeRecoveryCode(), normalizeRecoveryCode() (+13 more)

### Community 21 - "admin.tsx"
Cohesion: 0.14
Nodes (25): AuditModule(), AdminAccountPage, AdminAccountRow, adminFailure(), assertStaff(), grantAccountAccess, listAccountAccess, revokeAccountAccess (+17 more)

### Community 22 - "offline-lease.ts"
Cohesion: 0.16
Nodes (26): LeaseRow, decodeBase64(), OFFLINE_LEASE_ALGORITHM, OFFLINE_LEASE_VERSION, offlineClosureSigningBytes(), offlineEventSigningBytes(), OfflineLeaseDecision, OfflineLeaseRefusal (+18 more)

### Community 23 - "ref_react"
Cohesion: 0.16
Nodes (19): LowAllowanceNotice(), Step, AccountRow(), ConsoleLink(), Destination, DESTINATIONS, Sidebar(), UsageMeter() (+11 more)

### Community 24 - "ref_tanstack_react_router"
Cohesion: 0.17
Nodes (17): PRIVACY_META, TERMS_META, PrivacyContent(), TermsContent(), BrandMark(), BackToTop(), PUBLIC_LINKS, PublicPage() (+9 more)

### Community 25 - "ModelVault"
Cohesion: 0.23
Nodes (5): artifactName(), ModelVault, sanitiseSegment(), validMeta(), versionPath()

### Community 26 - "use-chat.ts"
Cohesion: 0.18
Nodes (21): Conversations(), citationInstruction(), ChatState, IntelligenceChoice, MODE_FOR, temporaryRecord(), titleFrom(), useChat() (+13 more)

### Community 27 - "server.ts"
Cohesion: 0.16
Nodes (14): renderErrorPage(), readBoundedRequestText(), newNonce(), setRequestNonceSource(), fetch(), getServerEntry(), isH3SwallowedErrorBody(), normalizeCatastrophicSsrResponse() (+6 more)

### Community 28 - "assurance-middleware.ts"
Cohesion: 0.19
Nodes (17): adminClient(), exportMyAccountData, streamAccountExport(), AssuranceDecision, assuranceFromClaims(), AssuranceRefusal, AssuranceRequirement, decideAssurance() (+9 more)

### Community 29 - "installation-browser.ts"
Cohesion: 0.16
Nodes (18): CapabilityPath, acquireInstallLock(), activateBrowserRuntime(), createBus(), installationAuthority(), probeBrowserCapabilities(), resolveInstallTarget(), modelVault (+10 more)

### Community 30 - "use-generation-permit.ts"
Cohesion: 0.16
Nodes (18): GenerationSurface, finalizeOfflineGeneration(), LeaseStateRow, OfflineGenerationReservation, releaseOfflineGeneration(), OfflineUsageEventPayload, acquireGenerationPermit, finalizeGenerationPermit (+10 more)

### Community 31 - "runOnlineIntelligence"
Cohesion: 0.17
Nodes (8): IntelligencePermit, completedTurnEvents(), OnlineHandlerDependencies, providerBody(), providerSchema(), runOnlineIntelligence(), OnlineModelId, ProviderKeySlot

### Community 32 - "supervisor.ts"
Cohesion: 0.12
Nodes (21): actionIntent, ActionIntent, actionReceipt, ActionReceipt, effectPossible(), intent(), OPERATIONS, outcomeCheck (+13 more)

### Community 33 - "cloudflare-entry.ts"
Cohesion: 0.14
Nodes (19): AssetBinding, augmentRequest(), CloudflareEnvironment, email(), fetch(), nitroApp, nitroHooks, queue() (+11 more)

### Community 34 - "use-installation.ts"
Cohesion: 0.19
Nodes (19): InstallRemedy, InstallStage, InstallState, describeInstall(), IDLE_INSTALL_STATE, installState(), isErrorStage(), isPreparing() (+11 more)

### Community 35 - "pricing.tsx"
Cohesion: 0.17
Nodes (19): checkPrice(), CurrencyCode, currencyForRegion(), describePrice(), detectRegion(), Plan, PlanCadence, PlanId (+11 more)

### Community 36 - "device-identity.ts"
Cohesion: 0.19
Nodes (16): browserLabel(), getBrowserInstallId(), guessDeviceKind(), CurrentDeviceIdentity, DeviceRegistrationFailed, forgetCurrentDeviceIdentity(), getOfflineCurrentDeviceIdentity(), observeAccount() (+8 more)

### Community 37 - "CommercialGenerationGate"
Cohesion: 0.17
Nodes (6): CommercialGenerationGate, CommercialUsageLedger, windowKey(), checkAllowance(), UsageWindow, windowFor()

### Community 38 - "offline-counter.ts"
Cohesion: 0.32
Nodes (19): appendEvent(), DeviceKeyRow, ensureOfflineDeviceKey(), forgetOfflineUsageLease(), identityKey(), installOfflineUsageLease(), listOfflineUsageEvents(), openDb() (+11 more)

### Community 39 - "notifications/preferences.ts"
Cohesion: 0.16
Nodes (18): BY_ID, findNotificationCategory(), NOTIFICATION_CATEGORIES, NotificationCategory, NotificationFrequency, URGENT_ONLY, NotificationChannelId, CategoryPreference (+10 more)

### Community 40 - "NotificationsSection.tsx"
Cohesion: 0.24
Nodes (17): NotificationsSection(), apply(), resolveChannels(), loadNotificationPreferences(), saveNotificationPreferences(), appleWithoutHomeScreen(), forgetPushOnThisBrowser(), movePushToThisSession() (+9 more)

### Community 41 - "online-models.ts"
Cohesion: 0.12
Nodes (13): IntelligencePrivacyPolicy, NormalizedMessage, NormalizedToolDefinition, OnlineRequestBody, ProviderFeature, DEFAULT_ENDPOINT, DEFAULT_ONLINE_MODEL, HIGH_ONLINE_MODEL (+5 more)

### Community 42 - "web-push.ts"
Cohesion: 0.18
Nodes (17): RFC-8188, RFC-8291, RFC-8292, b64url, Bytes, concat(), encryptForBrowser(), hkdf() (+9 more)

### Community 43 - "unsynced-turns.ts"
Cohesion: 0.19
Nodes (17): buffer, db(), forgetAllUnsyncedTurns(), forgetUnsyncedTurn(), inFlight, inOrder(), JournalRow, keyFor() (+9 more)

### Community 44 - "staff.functions.ts"
Cohesion: 0.15
Nodes (15): StaffPermission, AuditEntry, customerChange(), MyStaff, readCustomer, reason, ServiceControl, StaffInvite (+7 more)

### Community 45 - "send.server.ts"
Cohesion: 0.23
Nodes (14): isMutable(), ChannelConfiguration, deploymentChannelConfiguration(), NotificationChannel, DELIVERY_ATTEMPTS, DELIVERY_STATES, deliveryReport(), DeliveryState (+6 more)

### Community 46 - "settings-dialog.tsx"
Cohesion: 0.26
Nodes (14): BillingSection(), AccountSettings(), AppearanceSettings(), CATEGORIES, JarvisVoiceSetting(), ResetJarvis(), SettingsDialog(), JarvisAccess() (+6 more)

### Community 47 - "ocade-intelligence.ts"
Cohesion: 0.17
Nodes (8): Enhancement, enhancePrompt(), INSTRUCTIONS, lostDetails(), OcadeIntelligence, ocadeIntelligence(), createOfflineIntelligenceTransport(), createOnlineIntelligenceTransport()

### Community 48 - "operation-health.ts"
Cohesion: 0.14
Nodes (15): buildHealthRecord(), ERROR_CLASSES, ErrorClass, HEALTH_COMPONENTS, HEALTH_OPERATIONS, HealthComponent, HealthObservation, HealthOperation (+7 more)

### Community 49 - "settings-panel.tsx"
Cohesion: 0.19
Nodes (13): ModelSource(), loadDialog(), MERGED, NO_PANEL, SETTINGS_CATEGORIES, SettingsCategory, SettingsDialog, SettingsPanelContext (+5 more)

### Community 50 - "client.ts"
Cohesion: 0.29
Nodes (10): requireSupabaseAuth, createSupabaseClient(), createSupabaseAdminClient(), supabase, createSupabaseFetch(), getSupabaseBrowserConfiguration(), isNewSupabaseApiKey(), missingSupabaseConfigurationMessage() (+2 more)

### Community 51 - "online-client.ts"
Cohesion: 0.17
Nodes (9): boundary(), sseData(), browserAccessToken(), defaults(), isEvent(), OnlineClientDependencies, readSse(), refreshedAccessToken() (+1 more)

### Community 52 - "usage-policy.ts"
Cohesion: 0.16
Nodes (12): SUMMARY, TIERS, ALLOWANCES, describeUsage(), MAX_MULTIPLE_OF_PRO, millisecondsUntilReset(), SESSION_WINDOW_MS, TierAllowance (+4 more)

### Community 53 - "SignInMethods.tsx"
Cohesion: 0.40
Nodes (12): label(), SignInMethods(), unlink(), canUnlink(), Client, client(), describeIdentityError(), LinkedIdentity (+4 more)

### Community 54 - "usage.functions.ts"
Cohesion: 0.24
Nodes (12): CustomerDetail, accountAnchorFor(), ResolvedEntitlement, resolveTierFor(), Unlimited, GENERATION_SURFACES, supabaseCommercialLedger(), CommercialUsageView (+4 more)

### Community 55 - "ocade-chat-store.ts"
Cohesion: 0.25
Nodes (13): claimUnsyncedTurn(), releaseUnsyncedTurn(), rememberUnsyncedTurn(), unsyncedTurns(), flushUnsyncedTurns(), loadChatMessages(), newClientKey(), persistChatMessage() (+5 more)

### Community 57 - "isolation.ts"
Cohesion: 0.23
Nodes (12): IsolationHeaders, isolationHeadersFor(), isolationUpgradeTarget(), needsFullNavigation(), NEVER_ISOLATED_PATH_PREFIXES, normalisePath(), shouldIsolate(), underPrefix() (+4 more)

### Community 58 - "public-response.ts"
Cohesion: 0.23
Nodes (11): appCsp(), canonicalOriginRedirect(), connectSources(), defaultSecurityHeaders(), FIXED_INLINE_SCRIPTS, isLoopback(), loopbackBackend(), OFFLINE_RECONNECT_SHA256 (+3 more)

### Community 59 - "appearance.tsx"
Cohesion: 0.26
Nodes (11): AppearanceContext, AppearancePrefs, AppearanceProvider(), load(), AppearanceValue, applyToDocument(), DEFAULTS, persist() (+3 more)

### Community 60 - "model-vault.ts"
Cohesion: 0.18
Nodes (10): TransferCheckpoint, InstallationView, LEGACY_PREFIXES, LegacyStorage, Manifest, safeLocal(), StoredVersion, VaultDeps (+2 more)

### Community 61 - "offline-allowance.ts"
Cohesion: 0.35
Nodes (10): ensureCurrentDeviceIdentity(), syncOfflineAllowance(), trustedOfflineTimeNow(), reconcileOfflineUsage, hasTrustedClockStorage(), observeNow(), readTrustedClockHighWater(), ReadWriteStore (+2 more)

### Community 62 - "generation-gate.ts"
Cohesion: 0.20
Nodes (8): AcquireRequest, AcquireResult, DurablePermitAcquisition, DurableWindowUsage, GenerationPermit, ReleaseReason, WindowUsage, PlanTier

### Community 63 - "supabase-ledger.ts"
Cohesion: 0.17
Nodes (3): AllowanceExhausted, DurablePermitOutcome, ONE_USE

### Community 64 - "offline-usage.functions.ts"
Cohesion: 0.24
Nodes (10): EventRow, OFFLINE_BLOCK_INCREMENT, OfflineUsageLeasePayload, SignedOfflineUsageEvent, allocateOfflineUsage, closeOfflineUsageForRevokedDevice, first(), leasePayload() (+2 more)

### Community 65 - "intake.ts"
Cohesion: 0.26
Nodes (10): ascii(), contains(), IntakeRefusal, intakeRefusal(), isProgram(), REASONS, starts(), VBA_STREAM (+2 more)

### Community 66 - "history.ts"
Cohesion: 0.26
Nodes (11): isNotificationCategory(), NotificationCategoryId, DeliveryReport, call(), describe(), HistoryOutcome, listNotifications(), markAllNotificationsRead() (+3 more)

### Community 67 - "preference-sync.ts"
Cohesion: 0.31
Nodes (6): Json, LoadedPreferences, PreferenceBackend, SaveOutcome, StoredPreferenceRow, NotificationPreferences

### Community 68 - "StreamingSha256"
Cohesion: 0.27
Nodes (4): H0, K, sha256OfBlobStreaming(), StreamingSha256

### Community 69 - "use-dictation.ts"
Cohesion: 0.20
Nodes (7): available(), Dictation, Recognition, RecognitionConstructor, RecognitionEvent, RecognitionResult, useDictation()

### Community 70 - "health.ts"
Cohesion: 0.27
Nodes (9): cloudflareRequestEnv(), CloudflareRuntimeRequest, configurationMetadata(), deploymentMetadata(), HEALTH_HEADERS, releaseHealthResponse(), VersionMetadataEnv, OCADE_COMMIT (+1 more)

### Community 71 - "IntelligenceQuality"
Cohesion: 0.29
Nodes (5): NormalizedAttachment, HIGH_USAGE_WARNING, HIGH_WARNING_INTERVAL_MS, HIGH_WARNING_VERSION, IntelligenceQuality

### Community 73 - "gateway-address.ts"
Cohesion: 0.36
Nodes (8): AddressRefusal, gatewayAddress(), INTERNAL_SUFFIXES, publicAddress(), publicV4(), resolvesPublic(), v4(), v6()

### Community 74 - "help.tsx"
Cohesion: 0.28
Nodes (8): CATEGORIES, Category, Faq(), HelpPage(), QUESTIONS, Route, SEARCHED, textOf()

### Community 75 - "sitemap[.]xml.ts"
Cohesion: 0.36
Nodes (5): COMPANY_FACTS, Route, escapeXml(), PUBLIC_PATHS, Route

### Community 76 - "ConversationList.tsx"
Cohesion: 0.52
Nodes (6): ConversationList(), groupConversations(), MenuItem(), RenameField(), setSupportShare, supportShareOf

### Community 77 - "router.tsx"
Cohesion: 0.40
Nodes (4): requestNonce(), shared, getRouter(), routeTree

### Community 78 - "read-all.ts"
Cohesion: 0.50
Nodes (3): LIST_CAP, PageResult, readAllPages()

## Knowledge Gaps
- **3 isolated node(s):** `RFC-8291`, `RFC-8188`, `RFC-8292`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 481 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `loadSupabaseClient()` connect `loadSupabaseClient` to `history.ts`, `preference-sync.ts`, `device-identity.ts`, `NotificationsSection.tsx`, `ConsoleModules.tsx`, `client.ts`, `admin.tsx`, `SignInMethods.tsx`, `ref_react`, `assurance-middleware.ts`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `runOnlineIntelligence()` (e.g. with `.callProvider()` and `.claimPermit()`) actually correct?**
  _`runOnlineIntelligence()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-8291`, `RFC-8188`, `RFC-8292` to the rest of the system?**
  _3 weakly-connected nodes found - possible missing edges._
- **Should `loadSupabaseClient` be split into smaller, more focused modules?**
  _Cohesion score 0.05014749262536873 - nodes in this community are weakly interconnected._
- **Why does `ModelInstallationAuthority` connect `ModelInstallationAuthority` to `installation-authority.ts`, `use-installation.ts`, `installation-browser.ts`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `browser-wasm.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05789235639981909 - nodes in this community are weakly interconnected._
- **Why does `OfflineRelease` connect `browser-wasm.ts` to `ChatWorkspace.tsx`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._