# OCADE Complete Claude-Parity and Superset Engineering Mission for Claude Opus 5

## 1. Mission and interpretation

Build OCADE as an original, commercially independent product with behavioral parity to the current Claude Chat, Claude Cowork, and Claude Code product family, then extend it with OCADE’s local intelligence, offline operation, commercial usage, verified computer control, privacy, and cross-device architecture.

“Clone” means:

- Match documented workflows, functions, task types, interaction patterns, execution capabilities, and cross-surface continuity.
- Reimplement behavior through OCADE’s existing authorities and original source.
- Do not copy Anthropic source, hidden APIs, copyrighted assets, prompts, branding, product copy, icons, layouts, or pixel-for-pixel trade dress.
- Do not expose Claude or Anthropic branding in the OCADE product.
- Use public documentation only as a behavior reference and parity benchmark.
- Preserve OCADE’s identity, monochrome visual system, commercial model, intelligence routing, permissions, receipts, and local-first advantages.

The repeated phrase “Claude, Claude Cowork, Claude Cowork” is interpreted as:

1. Claude Chat
2. Claude Cowork
3. Claude Code

The parity target includes individual, team, and enterprise capabilities, including organization administration, connectors, shared resources, auditability, Slack-style team delegation, and Microsoft 365-style work integrations.

## 2. Operating rules

1. Fetch the latest `origin/main` before implementation.
2. Treat historical SHAs and repository counts as evidence only.
3. Create one isolated branch from the fetched SHA.
4. Preserve unrelated user work.
5. Do not reset, clean, force-push, overwrite, or discard unknown changes.
6. Do not make implementation commits.
7. Keep ignored recovery snapshots outside Git.
8. Create one final commit only after every final gate passes together.
9. Fetch `origin/main` immediately before final integration and again before pushing.
10. Fast-forward `main`, push without force, and verify the remote SHA.
11. Before changing a subsystem, trace its authority, callers, routes, persistence, tests, Supabase schema, and native/extension boundaries.
12. Assign `KEEP`, `FIX`, `COMPLETE`, `MERGE`, `REPLACE`, or `REMOVE`.
13. Never create a second router, store, agent loop, permission engine, task manager, model installer, native bridge, auth system, billing stack, notification stack, admin stack, or design system.
14. Every visible control must work, be disabled with an exact truthful explanation, or be removed.
15. Do not stop at source existence. Prove real behavior.
16. Do not deploy to Cloudflare.
17. Do not require MotionSites, paid CI, a payment dashboard, paid hosting, or another unavailable service.
18. External provider capabilities remain hidden until genuinely configured and proven.
19. Never fabricate remote execution, customer evidence, benchmarks, security certification, provider readiness, push delivery, uptime, or incidents.
20. Repository-controlled problems must be solved before conclusion.

## 3. Current-reference parity authority

Claude’s public product changes frequently. At implementation start and immediately before release, regenerate a dated parity ledger from current official documentation.

Generate:

```text
docs/product-reference/OCADE_REFERENCE_PARITY.json
docs/product-reference/OCADE_REFERENCE_PARITY.md
```

Each capability record contains:

```ts
interface ProductParityRecord {
  id: string;
  referenceProduct: "chat" | "cowork" | "code" | "team" | "enterprise";
  capability: string;
  documentedSource: string;
  sourceCheckedAt: string;
  requiredSurfaces: ProductSurface[];
  currentOcadeAuthority?: string;
  disposition:
    | "PARITY"
    | "OCADE_SUPERSET"
    | "REPLACE_WITH_OCADE_AUTHORITY"
    | "PROVIDER_GATED"
    | "NOT_APPLICABLE_TO_OCADE";
  implementationState: "missing" | "partial" | "complete";
  requiredTests: string[];
  evidence: string[];
  reason: string;
}
```

Rules:

- Every currently documented reference capability receives one disposition.
- `NOT_APPLICABLE_TO_OCADE` is permitted only for provider-specific model names, Anthropic billing internals, proprietary identity, or infrastructure without a meaningful OCADE equivalent.
- `PROVIDER_GATED` is limited to capabilities requiring real external credentials or infrastructure.
- Provider-gated features still require complete contracts, configuration validation, deterministic fixtures, unavailable-state UI, and adapter tests.
- Provider-gated features are not advertised as active.
- Generated Markdown comes from JSON and is never hand-edited.
- Release fails if the report is stale, incomplete, or contradicts OCADE behavior.

## 4. OCADE product hierarchy

OCADE is one shared application and account across web, desktop, mobile, and extension surfaces.

### Primary modes

1. Chat
2. Cowork
3. Code

### Secondary views

- Projects
- Tasks
- Artifacts
- Global Search
- Customize
- Settings
- Organization administration, where authorized

### Canonical routes

| Area | Route |
|---|---|
| Chat | `/ocade` |
| Cowork | `/ocade/cowork` |
| Code | `/ocade/code` |
| Projects | `/ocade/projects` |
| Tasks | `/ocade/tasks` |
| Artifacts | `/ocade/artifacts` |
| Customize | `/ocade/customize` |
| Settings | `/settings` |
| Organization | `/organization` |
| Administration | `/admin` |

Migrate:

- `/ocade/work` to Cowork.
- Automations, monitors, inbox, notifications, and schedules into Tasks.
- Studio, templates, generated outputs, and live outputs into Artifacts.
- Models, devices, permissions, connectors, health, system, activity, knowledge, and labs into Settings or Customize.
- Search into a global overlay and contextual search.
- Future-product links out of OCADE’s operational rail.
- Demo routes out of the product entirely.

Generate a route-disposition ledger.

## 5. Remove the demo completely

Remove:

- `/demo`
- `/demo/ocade`
- `/demo/control`
- `/demo/settings`
- Timed demos.
- Demo timers.
- Demo stores and state.
- Demo entitlements.
- Demo usage rules.
- Demo flags.
- Demo copy.
- Demo navigation.
- Demo analytics.
- Demo fixtures and tests.
- Obsolete compatibility logic.
- Anonymous AI-generation bypasses.

Useful generic behavior must migrate before deletion.

Old demo URLs return OCADE’s normal 404. Free is a real authenticated account plan, not a demo.

## 6. Canonical source architecture

```text
src/
  app/
    bootstrap/
    providers/
    routing/
    shell/
  features/
    auth/
    chat/
    cowork/
    code/
    projects/
    tasks/
    artifacts/
    customize/
    settings/
    organization/
    public/
    admin/
  core/
    commercial-usage/
    identity/
    intelligence/
    agent/
    orchestration/
    tools/
    permissions/
    tasks/
    memory/
    context/
    models/
    artifacts/
    protocol/
    notifications/
  platform/
    browser/
    desktop/
    mobile/
    edge/
    remote-executor/
  data/
    local/
    sync/
    supabase/
  shared/
    ui/
    hooks/
    types/
    utils/
    testing/
```

Keep platform roots:

```text
android/
ios/
mobile/
native/
extension/
supabase/
scripts/
public/
.github/
```

Migrate one dependency-closed subsystem at a time.

## 7. Shared Chat/Cowork composer and shell

Use one consistent shell:

- Conversation and task sidebar.
- New interaction.
- Search.
- Projects.
- Pinned and recent sessions.
- Chat/Cowork/Code switch.
- Current context title.
- Share/export.
- Usage state.
- Intelligence state.
- Executor/connection state.
- Automatic Offline Intelligence preparation state.
- One composer.
- Artifact/preview panel closed by default.
- Profile and organization switcher.
- Compact mobile navigation and accessible More sheet.

The composer adapts by mode rather than creating three disconnected applications.

## 8. Chat parity and OCADE upgrades

Implement:

- Conversation create, load, rename, delete, delete-all, share, export, search, and branching.
- Side conversations.
- Streaming, stop, retry, attachments, citations, web search, and tool use.
- Projects, project files, project instructions, and project memory.
- Account memory.
- Search past chats.
- Incognito conversations excluded from ordinary history and memory.
- Memory review, edit, pause, reset, import, export, and deletion.
- Artifacts, versions, repair, and tool connections.
- Voice.
- Connectors, skills, and plugins.
- Automatic, Online, and Local-only Intelligence.
- Commercial usage and offline leases.
- Cross-device continuity.
- Local-only zero-cloud-inference proof.
- Permission receipts and explicit action verification.

## 9. Cowork parity and OCADE upgrades

Cowork supports:

- Shared Chat/Cowork composer.
- Outcome delegation.
- Visible planning and task stages.
- Long-running and background work.
- Cross-device viewing and steering.
- Local files through the desktop companion.
- Managed-browser and extension work.
- Professional documents, spreadsheets, presentations, PDFs, research, and file organization.
- Subagents and parallel workstreams.
- Scheduled and recurring tasks.
- Projects.
- Approvals.
- Outputs and artifacts.
- Inline artifact editing.
- Live artifacts and version history.
- Connector-backed refresh.
- STOP, PAUSE, RESUME, TAKE OVER.
- Network-egress policy.
- Postcondition receipts.
- Mobile dispatch.
- Local continuation.
- Provider-neutral remote continuation when configured.

OCADE adds stronger permission-before-adapter enforcement, verified receipts, local execution, usage truth, and non-replay recovery.

## 10. Code parity and OCADE upgrades

Support:

- Desktop, web, terminal CLI, VS Code, and JetBrains boundaries.
- Local, SSH, and provider-neutral remote environments.
- Mobile Dispatch and Remote Control.
- Repository intake and maps.
- Search, symbols, references, diagnostics, patches, conflict handling, hashes, and undo.
- Integrated terminal, file editor, preview, dev-server preview, HTML/PDF preview.
- Git status, diff, branch, worktrees, commit, push, pull requests, and CI monitoring.
- Visual diff and inline review.
- Side chats and parallel sessions.
- Scheduled coding work.
- Permission modes.
- Hooks, skills, plugins, MCP, subagents, agent view, agent teams, shared task lists, and batch execution.
- Session handoff among terminal, desktop, web, and mobile.
- Cancellation and emergency stop.
- Verification before success.

AI edits require a commercial permit. Manual editing, inspection, diff, and terminal work remain available during usage lock.

## 11. Provider-neutral remote executor

```ts
type ExecutionEnvironmentKind = "local" | "ssh" | "remote";

interface RemoteExecutionRequest {
  accountId: string;
  organizationId?: string;
  taskId: string;
  environmentSpec: EnvironmentSpec;
  repositories: RepositoryReference[];
  attachments: ArtifactReference[];
  permissions: EffectivePermissionPolicy;
  networkPolicy: NetworkEgressPolicy;
  commercialPermit: GenerationPermit;
  idempotencyKey: string;
}

interface RemoteExecutor {
  capabilities(): Promise<RemoteExecutorCapabilities>;
  create(request: RemoteExecutionRequest): Promise<RemoteSession>;
  stream(sessionId: string): AsyncIterable<RemoteExecutionEvent>;
  checkpoint(sessionId: string): Promise<RemoteCheckpoint>;
  cancel(sessionId: string): Promise<void>;
  destroy(sessionId: string): Promise<void>;
}
```

Implement isolated environments, scoped repository authentication, setup scripts, network policy, resource limits, secrets bindings, streaming, checkpoints, cancellation, cleanup, artifacts, schedules, and stale-worker recovery.

Provide a deterministic local sandbox proof harness. Hide cloud continuation until a real provider passes production proof.

## 12. OCADE identity authority

Canonical identity:

> I am OCADE, an AI workspace built for Chat, Cowork and Code. I was created by the founder of CARCC CADANE.

Every backend uses one versioned OCADE identity authority.

Direct identity questions use deterministic handling. Capability explanations reflect live availability. Normal UI uses OCADE, OCADE Intelligence, Online Intelligence, Offline Intelligence, and Local Intelligence—not raw backend brands.

## 13. Commercial usage authority

### Free

- Exactly 28 successful logical AI uses per 6h28m.
- One pool across every AI surface and backend.
- No weekly Free limit.
- Raw used/remaining values are shown.

### Pro

Internal capacity:

- 140 Standard Work Equivalents per 6h28m session.
- 700 per account-anchored week.

Customer UI shows percentages only.

### Max

Exactly 10× Pro:

- 1,400 internal session equivalents.
- 7,000 internal weekly equivalents.

Customer UI shows percentages only.

### Weighted work

```text
work =
  canonical_billable_input_tokens / 4000
  + customer_visible_output_tokens / 1000
  + unique_verified_read_tool_batches / 8
  + unique_verified_side_effect_actions / 4
  + versioned_non_text_media_work

final_work = round_up_to_0.01(max(0.25, work))
```

One logical customer request counts once. Failures, retries, fallback replay, internal tool loops, internal subagents, duplicate submissions, and pre-output cancellations do not consume incorrectly.

## 14. Commercial gate before intelligence

```text
Product surface
  → CommercialGenerationGate.acquire
  → backend-neutral permit
  → OcadeIntelligence
  → agent/tools
  → success: finalize
  → failure or pre-output cancellation: release
```

No AI surface bypasses the gate. Exhaustion blocks all backends before routing and cannot fall back locally.

## 15. Signed offline allowance

Default allocations:

| Plan | Allocation |
|---|---:|
| Free | 7 uses |
| Pro | 35 Standard Work Equivalents |
| Max | 350 Standard Work Equivalents |

Use Ed25519 leases, device-bound keys, atomic local counters, hash-chained events, trusted-time high-water marks, replay protection, reconciliation, refill, return, and next-window leases.

Deleting local storage destroys the local lease and requires reconnection; it does not reset account usage or delete Offline Intelligence.

## 16. Intelligence routing

- Local-only: WebGPU → WASM/wllama → Ollama → native/paired.
- Online: authenticated online provider.
- Automatic: eligible online provider with permitted local fallback.
- All use one permit.
- Local-only performs zero provider network activity.
- Successful local work consumes commercial usage.
- Complete failure releases usage.

## 17. Automatic Offline Intelligence preparation

After authenticated login:

```text
Session verified
  → inspect local model vault
  → verified compatible model exists
      → activate immediately
      → zero model-weight requests
  → missing/incomplete model
      → automatically begin or resume
      → show lower-left progress
```

Display:

> Preparing offline intelligence

No confirmation screen or Prepare button.

Pause, Cancel, Remove, and automatic-preparation preference persist. Login never overrides them. Logout never removes the model.

## 18. Model selection and release compliance

Technical selection ignores license/legal criteria and scores:

- Download and storage size.
- RAM/VRAM.
- WebGPU/WASM performance.
- Platform compatibility.
- Response quality.
- Tool accuracy.
- Time to first token.
- Generation speed.
- Stability.
- Crash/recovery behavior.

Run legal/distribution compliance afterward as a separate binary gate that does not change technical ranking.

## 19. Fast model download and zero-redownload

Use:

- Two to eight adaptive Range workers.
- Eight to 32 MiB chunks.
- Origin latency/throughput probes.
- Preconnect.
- Healthy-mirror selection.
- OPFS streaming.
- Worker hashing.
- Durable checkpoints.
- Chunk failover.
- Missing/changed-chunk-only downloads.
- Safe parallel runtime preparation.
- Automatic resume.

Never redownload valid chunks due to login, logout, refresh, browser restart, merge, deployment, service-worker update, OCADE update, usage lock/reset, or plan changes.

Benchmark 10, 25, 50, 100, 200, and 500 Mbps conditions.

## 20. Computer and browser control

Rust/Tauri is the canonical companion.

Windows retains one Python helper only for proven Windows UI Automation, semantic controls, editable fields, OCR, and coordinate fallback.

Migrate useful behavior from `native/ocade_control_engine`, then delete that duplicate authority.

macOS uses native Accessibility/capture/input adapters.

Remove Linux desktop-control product code and claims while preserving Linux-neutral web/server CI.

Browser control uses the extension/CDP or managed browser, never Python.

## 21. Enterprise and team parity

Implement:

- Organizations.
- Invitations.
- Membership lifecycle.
- Primary Owner, Owner, Admin, User, and custom roles.
- Groups.
- Seat entitlements.
- Domain verification.
- SSO/SAML and SCIM adapters.
- Organization instructions.
- Capability policy.
- Connector tool permissions.
- Shared/provisioned skills, plugins, and connectors.
- Enterprise search.
- Audit and compliance APIs.
- Analytics.
- Data export and retention.
- Slack-style delegation adapter.
- Microsoft 365-style adapter.
- Cross-organization isolation.

Provider-dependent functions remain hidden until configured and proven.

## 22. Pricing and payments

Public plans:

- Free.
- Pro weekly/monthly.
- Max weekly/monthly.

Approved anchors:

| Currency | Pro weekly | Pro monthly | Max weekly | Max monthly |
|---|---:|---:|---:|---:|
| USD | $8 | $28 | $28 | $88 |
| EUR | €8 | €28 | €28 | €88 |
| GBP | £8 | £28 | £28 | £88 |
| INR | ₹288 | ₹1,888 | ₹1,888 | ₹5,888 |

Team and Enterprise use separate organization catalogues and authoritative agreements.

Server authority controls price, cadence, currency, tax, entitlement, and webhook state. Checkout remains hidden until configured.

## 23. Supabase security and data authority

Inspect live schema and migration history first. Add forward-only migrations.

Prefer invoker functions, private internal mutations, safe `search_path`, fully qualified references, strict grants, RLS, ownership from `auth.uid()`, invoker views, and service-only privileged operations.

Enable leaked-password protection, regenerate database types, rerun advisors, and test anonymous, owner, other-user, organization, group-admin, organization-admin, and service roles.

## 24. Visual and product identity

OCADE-authored UI uses black, white, equal-channel grey/silver, and neutral transparency.

State uses label, icon, border, pattern, weight, shape, opacity, and motion.

User documents, screenshots, websites, photos, and artifact content retain original color only inside declared content islands.

Do not copy Claude’s exact layouts, copy, assets, typography, icons, or component geometry.

## 25. Donor disposition

Verify and disposition all 2,126 files in `.incoming/OCADE_PRIMARY_LOGIC.rar`.

Do not execute or bulk-import donor code. Preserve required notices and provenance. Remove the raw RAR from the final tracked product and releases without rewriting history.

## 26. Repository, performance, accessibility, and localization

Repository:

- Node 22.
- Exact npm package authority.
- `package-lock.json` only.
- Deterministic installs and generators.
- Zero type errors, lint warnings, formatter drift, and unexpected stderr.
- Clean tree after every final gate.
- Browser-safe bundles.
- Secret/license scans and SBOM.

Performance:

- Total JS ≤4,200 KiB.
- Eager JS ≤850 KiB.
- Largest eager chunk ≤450 KiB.
- CSS ≤145 KiB.
- LCP <2.5 seconds.
- CLS <0.1.
- TBT <200 ms.

Responsive widths:

- 320, 375, 768, 1024, 1440, and 1920 px.

Locales:

- `en-US`
- `en-GB`
- `en-IN`
- `hi-IN`
- `de-DE`
- `fr-FR`
- `es-ES`
- `ja-JP`

## 27. Execution phases

1. Refresh Git, repository, donor, Supabase, build, test, and product-reference baselines.
2. Generate the current official-feature parity ledger.
3. Generate the 2,126-file donor ledger.
4. Establish deterministic npm installation and generators.
5. Remove demo behavior.
6. Establish architectural boundaries.
7. Establish monochrome tokens and color gates.
8. Implement OCADE identity.
9. Implement commercial usage.
10. Implement signed offline usage.
11. Place the commercial gate above intelligence.
12. Consolidate intelligence routing.
13. Select the local model and run the separate release gate.
14. Complete automatic preparation and fast zero-redownload transfers.
15. Implement secure online intelligence.
16. Consolidate permissions and command safety.
17. Unify task and executor lifecycle.
18. Implement the remote-executor contract and harness.
19. Repair Supabase security.
20. Complete authentication and organization identity.
21. Rebuild the shell and routes.
22. Complete Chat.
23. Complete Cowork.
24. Complete Code.
25. Complete Projects, memory, search, and incognito.
26. Complete Tasks, schedules, background work, and Dispatch.
27. Complete Artifacts and live artifacts.
28. Complete skills, plugins, connectors, hooks, and agents.
29. Consolidate Windows/macOS control and remove Linux desktop control.
30. Complete extension, browser, mobile, PWA, offline, and voice.
31. Complete Team/Enterprise administration and compliance.
32. Complete external work-surface adapters.
33. Complete pricing, payments, localization, public claims, performance, and accessibility.
34. Regenerate parity and checklist ledgers.
35. Run the final verification matrix.
36. Create the sole final commit, fast-forward `main`, push, and verify.

# 27A. Launch-critical add-on requirements

These requirements are added without removing or weakening any preceding requirement.

## A. IndexedDB deletion and OPFS model isolation

The repository currently separates structured data into IndexedDB and model artifacts into OPFS, but two implementation details must be corrected:

- ModelVault’s active/previous pointers and version metadata currently depend on `localStorage`.
- The WebGPU runtime can maintain a secondary IndexedDB model cache.
- Global sign-out currently uses a broad `localStorage.clear()`.

Create one explicit local-data deletion authority. Do not scatter deletion calls across Settings components.

```ts
type LocalDataClass =
  | "chats"
  | "messages"
  | "projects"
  | "tasks"
  | "artifacts"
  | "memory"
  | "search_index"
  | "sync_cache"
  | "outbox"
  | "notifications"
  | "preferences"
  | "device_lease"
  | "all_account_data";

interface LocalDataDeletionResult {
  deletedClasses: LocalDataClass[];
  deletedRecords: number;
  modelBefore: VerifiedModelIdentity | null;
  modelAfter: VerifiedModelIdentity | null;
  modelNetworkRequests: 0;
}
```

Settings → Privacy and Data must provide:

- Delete one chat.
- Delete selected chats.
- Delete all chats on this device.
- Delete local projects/tasks/artifacts where supported.
- Delete local memory.
- Delete local search indexes and caches.
- Delete notification history.
- Delete all local account data.
- Separate account-wide deletion where applicable.
- Clear descriptions of local-only versus every-device deletion.
- Typed confirmation for broad deletion.
- Accurate completion, partial-failure, and retry states.

Absolute storage boundary:

```text
IndexedDB account/product data deletion
  ≠ OPFS model deletion

Only Settings → Remove Offline Intelligence
  → model-vault uninstall authority
  → OPFS model deletion
```

Required changes:

- Move authoritative active-model pointer, rollback pointer, verified version metadata, hashes, and chunk inventory into the OPFS model-vault namespace or another model-owned OPFS sidecar.
- Do not keep the only authoritative active version in `localStorage` or an account-data IndexedDB.
- Replace broad `localStorage.clear()` with scoped session/account cleanup.
- Keep model-owned device preferences separate from account-private data.
- If WebGPU requires a runtime cache in IndexedDB, treat it as disposable compiled/runtime state, never the canonical weight source.
- After IndexedDB deletion, rebuild any necessary runtime cache from the verified OPFS artifact with zero network requests.
- Account deletion and sign-out preserve Offline Intelligence unless the user separately chooses Remove Offline Intelligence.
- Deleting the offline commercial lease may disable offline generation until reconnection, but it must not affect model readiness or storage.
- Deleted cloud-synced data receives tombstones so stale devices cannot silently recreate it.
- Local-only deletion does not create cloud tombstones unless the user chose every-device deletion.

After every IndexedDB deletion:

- Verified model bytes remain unchanged.
- Active model version remains unchanged.
- Model verification remains valid.
- Installation state does not return to preparing.
- No model-origin `fetch`, `HEAD`, Range request, preconnect, or mirror probe occurs.
- No verified model chunk is downloaded.
- Runtime activation reuses OPFS immediately.
- Automatic preparation does not restart.

Add network-spy tests covering every approved model origin plus runtime E2E with real IndexedDB and OPFS.

## B. Real TOTP MFA and secure recovery

Complete MFA through the existing Supabase Auth authority. Do not build a second login system.

Use current Supabase enrollment, challenge, verification, factor-list, assurance-level, unenrollment, and server-admin factor APIs. Supabase requires the application to enforce AAL in the UI, APIs, and database—not merely render a setup screen. [Supabase MFA guidance](https://supabase.com/docs/guides/auth/auth-mfa)

Implement:

- TOTP enrollment in Settings → Security.
- QR code.
- Manual secret.
- Friendly factor name.
- Verification before activation.
- Multiple TOTP factors.
- Backup-factor recommendation.
- Active/inactive state from live factor data.
- Login challenge before protected application access.
- Challenge retry, expiry, rate limiting, and cancellation.
- AAL1-to-AAL2 transition.
- AAL2 enforcement for enrolled users.
- Organization policy requiring MFA where configured.
- AAL2 requirement for security, billing, ownership, organization deletion, connector administration, and other high-risk actions.
- Disable/unenroll only after recent reauthentication and AAL2.
- Session refresh after factor changes.
- Security events and audit trail.
- Recovery codes.
- Recovery-code regeneration.
- Recovery-code revocation.
- Lost-factor recovery.
- Global session revocation after recovery/reset.

Supabase does not currently expose customer recovery codes through its normal TOTP client API. OCADE recovery codes therefore act only as secure factor-reset credentials, not as a parallel login factor:

1. User first completes genuine Supabase TOTP enrollment and reaches AAL2.
2. Server generates high-entropy single-use codes.
3. Plaintext codes are shown/downloaded exactly once.
4. Store only server-peppered keyed hashes, never plaintext.
5. Recovery begins only after a valid Supabase AAL1 session.
6. Recovery code is checked and consumed atomically by a rate-limited server function.
7. The recovery session cannot access OCADE data.
8. The server removes the lost Supabase factor through the admin factor API.
9. All active sessions are revoked.
10. User signs in again and must enroll and verify a replacement TOTP factor before full application access.
11. Recovery action is audited without storing the code.

Test setup, incorrect code, replay, lockout, login challenge, backup factor, recovery, code regeneration, factor removal, session revocation, cross-device behavior, RLS AAL enforcement, and organization-required MFA.

## C. Session and high-risk action security

Complete the existing Security page rather than adding another security product.

Add:

- List real authenticated sessions, not only registered device rows.
- Identify the current session.
- Revoke one other session.
- Revoke all other sessions.
- Revoke all sessions.
- Show last activity, device, browser/app, and approximate location only when safely available.
- Reauthenticate before email change, password change, MFA reset, billing changes, ownership transfer, exports, and destructive account actions.
- Verify `session_id` against `auth.sessions` for highly sensitive server operations.
- Keep JWT lifetime appropriately bounded.
- Refresh authorization claims after role, group, MFA, or entitlement changes.
- Link and unlink sign-in providers only with reauthentication.
- Verify changed email before replacing the authoritative login.
- Never use editable user metadata for authorization.
- Audit password, provider, MFA, session, device, and recovery changes.

## D. Notification preferences and real delivery

Extend the current notification abstraction and existing Inbox/Notifications authorities.

Create one canonical notification system with:

- Notification categories:
  - approvals
  - task outcomes
  - automation
  - security
  - account
  - billing
  - support
  - organization
  - product updates
  - status incidents
- In-app, email, web-push, APNs, and FCM channel preferences where configured.
- Per-category channel selection.
- Immediate, grouped, and digest frequency where applicable.
- Global mute for optional notifications.
- Quiet hours and timezone.
- Security, billing, legal, emergency-stop, and account-recovery events remain recorded and are not silently discarded by optional-product mute settings.
- Save confirmation and cross-device preference synchronization.
- Permission status and revocation handling.
- Push pre-permission explanation.
- Notification preview.
- Explicit decline.
- Enable-later path in Settings.
- Foreground and background delivery behavior.
- Deep-link allowlist and authentication recheck.
- Read/unread state.
- Mark one read.
- Mark all read.
- Notification history.
- Delivery state.
- Duplicate collapse and idempotency.
- Expired token cleanup.
- Device-token rotation.
- Retry and dead-letter handling.
- Minimal secure payloads with no prompt, attachment, secret, payment credential, or private local path.
- Server-side audience authorization immediately before send.

Provider adapters:

- Web Push/VAPID.
- FCM for supported Android paths.
- APNs for supported Apple paths.
- Transactional email transport.
- In-app Realtime delivery.

Never claim push works because an abstraction exists. Require:

- Configured provider credentials.
- Successful provider response.
- Real Android device receipt.
- Real iPhone/iPad device receipt.
- Real browser web-push receipt.
- Foreground, background, terminated-app, revoked-permission, expired-token, and deep-link tests.

If a channel is unconfigured, hide its enable control or show an exact unavailable state.

## E. Transactional email authority

Invitations, billing recovery, notification email, support, security alerts, MFA recovery, status subscriptions, and account recovery all depend on real email delivery.

Complete one email authority with:

- Verified sender domain.
- SPF, DKIM, and DMARC readiness evidence.
- Environment separation.
- Template versioning.
- Locale-aware templates.
- Secure, expiring links.
- No secrets or raw sensitive content.
- Bounce and complaint processing.
- Unsubscribe handling for optional email.
- Mandatory transactional classification.
- Idempotency.
- Rate limiting.
- Delivery receipts.
- Retry and dead-letter handling.
- Test inbox proof.
- No claim of email delivery until a real message is received.

## F. User and team management

Extend the current read-only admin account view and existing role authorities.

Implement:

- Organizations/workspaces.
- Invite by email.
- Pending invitations.
- Expiring signed invitation tokens.
- Resend.
- Revoke.
- Accept into the correct organization.
- Existing-account and new-account invitation paths.
- Duplicate and already-member handling.
- Roles and permissions.
- Role changes.
- Groups.
- Group membership.
- Search and filtering.
- Deactivate member.
- Reactivate member where policy permits.
- Remove member.
- Transfer owned resources or preserve them under organization ownership.
- Ownership-transfer safety.
- Last-owner protection.
- Primary-owner transfer.
- Session and permission invalidation after removal/role change.
- Cross-organization isolation.
- Audit trail.
- Notification/email delivery.
- Bulk actions through the canonical data table.
- Server/RLS authorization for every mutation.

UI visibility is not authorization. Direct API and forged-browser attempts must fail.

## G. Complete admin panel

Extend existing `/admin` authorities with:

- Organization overview.
- Organization settings.
- Members and invitations.
- Roles and groups.
- Capability policies.
- Connector/tool policies.
- Usage overview.
- Commercial-usage windows.
- Billing and seat overview.
- Payment-event state.
- Audit log.
- Authorized exports.
- Notification delivery status.
- Security settings.
- Support operations.
- Status/incidents management.
- Help-content management.
- Organization danger zone.
- Organization deletion.
- Typed confirmations.
- Recent reauthentication and AAL2.
- Last-owner and outstanding-billing protections.
- Strict server-side role checks.
- Cross-organization query isolation.

Ordinary users receive neither the route content nor the underlying data.

## H. Complete commercial plans and payments

Migrate the existing payment authority. Do not create another stack.

Remove:

- `FREE_LAUNCH_MODE`.
- `trial_2d`.
- `std_8d`.
- `month_1m`.
- `year_1y`.
- Legacy public one-time cadence.
- Legacy trial/demo UI.
- Legacy public plan descriptions.

Preserve historical records and map them to archived catalog versions.

Customer flow:

```text
Choose plan
  → server resolves market catalogue
  → display exact amount, currency, cadence, tax and renewal terms
  → customer explicitly confirms
  → provider-hosted checkout
  → provider sends signed webhook
  → raw-body signature verification
  → atomic idempotent event application
  → authoritative entitlement
  → plan becomes active
  → commercial limits update
  → all devices reconcile
```

A redirect or success URL never grants entitlement.

Implement:

- Free, Pro, Max.
- Weekly/monthly paid subscriptions.
- Upgrade.
- Downgrade.
- Renewal.
- Cancellation.
- Cancellation at period end.
- Failed payment.
- Explicitly versioned grace policy, if retained.
- Expiry.
- Full refund.
- Partial refund with proportional/explicit entitlement policy.
- Dispute and chargeback.
- Reversal.
- Plan change.
- Provider-specific webhook verification using the provider’s real protocol and raw request body.
- Do not treat the current generic HMAC test twin as proof of live-provider verification.
- Persistent idempotency.
- Replay protection.
- Duplicate protection.
- Out-of-order protection.
- Atomic payment, subscription, entitlement, and usage update.
- Correct account and organization attribution.
- Sandbox/live isolation.
- Server-controlled amount, currency, cadence, and plan.
- No raw payment credentials.
- Provider-hosted payment-method management.
- Billing history.
- Invoices and receipts.
- Provider invoice downloads.
- Next payment amount/date.
- Tax/VAT display.
- Billing contact.
- Failed-payment recovery.
- Cancellation confirmation and effective date.
- Refund/help route.
- Pending-webhook state.
- Confirmation state.
- Direct return into OCADE after authoritative activation.
- Cross-device entitlement propagation.
- Legal/checkout policy version and acceptance timestamp.

Before payment disclose:

- Plan.
- Amount.
- Currency.
- Frequency.
- Automatic renewal.
- Cancellation terms.
- Refund terms.
- Known taxes.
- Terms and Privacy.

No dark patterns, fake discounts, preselected paid upgrade, hidden renewal, or misleading trial language.

Do not enable live charging until:

- Sandbox checkout passes.
- Webhook matrix passes.
- Provider configuration passes.
- Price IDs match the committed catalogue.
- Tax configuration is proven.
- Legal entity and production credentials exist.
- No-charge gates pass.
- A controlled real low-value transaction, entitlement activation, cancellation, and refund are proven.

Payment and plan changes never remove, modify, invalidate, reinstall, or redownload Offline Intelligence.

## I. Mobile commercial completion

Provide:

- Current plan.
- Cadence.
- Renewal date.
- Billing history.
- Invoice/receipt access.
- Failed-payment state.
- Refund help.
- Tax display.
- Subscription-management link.
- Cross-device entitlement refresh.
- Store/provider purchase restoration where applicable.
- Clear web-versus-store billing authority.
- Server-side reconciliation.
- No duplicate entitlement across provider channels.

Do not expose native purchase controls until applicable platform/store requirements, products, receipts, server verification, and physical-device purchase tests pass.

## J. Public Security surface

Create canonical `/security`.

Include:

- Encryption in transit and at rest.
- Device-local IndexedDB encryption.
- OPFS model-storage explanation.
- Local/online data-flow distinction.
- Data storage and residency.
- Access controls.
- MFA.
- Organization policy.
- Permission and receipt architecture.
- Browser/native security boundaries.
- Responsible vulnerability-disclosure route.
- Verified security contact.
- Incident disclosure/history when real.
- Subprocessor/provider information where required.
- Penetration-test information only after a real assessment.
- Certification logos only after certification.

Never claim SOC 2, ISO, GDPR certification, HIPAA compliance, a penetration test, zero incidents, or security badges without evidence.

Add `/security` to public navigation and sitemap only when its contact paths are genuine.

## K. Real status system

Replace hard-coded prelaunch rows with a status data authority.

Implement:

- Component catalogue.
- Real probes.
- Operational state.
- Degraded and outage states.
- Incident creation and updates.
- Timestamped incident history.
- Maintenance scheduling.
- Uptime samples and calculated history.
- Status-update subscriptions.
- RSS/Atom or equivalent machine feed.
- Public API/feed.
- Administrator incident controls.
- Subscriber notifications.
- Independent status deployment/domain configuration.
- Provider-neutral status backend.
- No prompt or customer-data exposure.

Do not invent historical uptime or incidents. Begin measurements from the first verified observation.

Until independent hosting is configured, `/status` may show current OCADE-origin checks but must state that it is not independent. Independent-status claims and subscriptions remain hidden.

Remove obsolete demo references and hard-coded launch dates from status copy.

## L. Help Center completion

Extend the existing FAQ/support authority.

Canonical structure:

- `/support` — Help Center home.
- `/support/$slug` — article.
- `/faq` — redirect or curated view backed by the same article authority.
- Existing authenticated support-ticket flow remains the escalation authority.

Add:

- Searchable articles.
- Search suggestions.
- Categories.
- Featured/popular articles based on real metrics or editorial selection.
- Article pages.
- Stable slugs.
- Version applicability.
- Platform applicability.
- Last-updated date.
- Related articles.
- Helpful/not-helpful feedback.
- Feedback abuse controls.
- Support escalation with article context.
- Locale support.
- Search indexing.
- Broken-link and stale-version checks.
- Admin publishing workflow.
- Draft/published state.
- No duplicate FAQ database or support system.

## M. OcadeDataTable completion

Extend the existing component without replacing it.

Add typed generic support and:

- Sortable column headers.
- Visible direction and accessible sort state.
- Multi-type sorting.
- Column show/hide.
- Persisted column order and visibility per user/table.
- Row selection.
- Select-all for current page.
- Authorized select-all for current result set.
- Bulk actions.
- Contextual row actions.
- Filters.
- Visible active-filter chips.
- Clear filters.
- Configurable rows per page.
- Total and visible result range.
- Server-side pagination/sort/filter mode.
- Frozen identifying column for wide tables.
- Responsive card/priority-column fallback where a table cannot fit.
- CSV export of the current authorized result set.
- Formula-injection-safe CSV encoding.
- Loading skeletons.
- Partial/error/retry states.
- Empty state.
- Keyboard navigation.
- Screen-reader selection and sort announcements.

Preserve existing search, sorting, pagination, and empty-state behavior while migrating current table consumers.

Never export rows the current user cannot retrieve under server policy.

## N. Accessibility runtime proof

Static implementation is not final proof.

Run and record:

- NVDA with Chrome on Windows.
- VoiceOver with Safari on macOS.
- Keyboard-only flows.
- 200% zoom.
- High text scaling.
- Focus order.
- Modal/drawer focus trap and return.
- Route-change focus.
- Screen-reader announcements.
- Tables and bulk selection.
- MFA setup and challenge.
- Checkout and cancellation.
- Notifications permission and preferences.
- Data deletion confirmations.
- Admin member management.
- Mobile touch targets.
- Reduced motion.
- Reduced transparency.
- No color-only meaning.

Fix every discovered problem and repeat the exact failed journey.

## O. Data-rights, account deletion, and ownership safety

Extend existing privacy/data-rights authorities:

- Export local data.
- Export synchronized account data.
- Machine-readable export.
- Delete one data class.
- Delete the account.
- Revoke sessions before destructive account completion.
- Handle owned Storage objects before Auth deletion.
- Bound remaining JWT validity and validate `session_id` for sensitive operations.
- Preserve legal-consent receipts where legally required.
- Remove or anonymize billing data according to retention requirements.
- Transfer organization ownership before owner deletion.
- Prevent deletion of the last organization owner.
- Do not delete Offline Intelligence during account deletion.
- Clear account-private local data without touching OPFS model storage.
- Produce a deletion receipt without exposing deleted content.

## P. Add-on checklist ledger

Create:

```text
release/checklists/OCADE_REMAINING_PRODUCT_GAPS.json
release/checklists/OCADE_REMAINING_PRODUCT_GAPS.md
```

The ledger contains only applicable gaps discovered from:

- This add-on.
- Fresh repository inspection.
- Live Supabase inspection.
- Real runtime testing.
- Physical-device testing.
- Provider configuration testing.

Schema:

```ts
type GapStatus =
  | "MISSING"
  | "IMPLEMENTED"
  | "TESTED"
  | "RUNTIME-PROVEN"
  | "EXTERNALLY-BLOCKED"
  | "NOT-APPLICABLE";

interface RemainingProductGap {
  id: string;
  area: string;
  requirement: string;
  discoveredFrom: string;
  existingAuthority: string | null;
  disposition: "FIX" | "COMPLETE" | "MERGE" | "REPLACE" | "REMOVE";
  status: GapStatus;
  implementationEvidence: string[];
  testEvidence: string[];
  runtimeEvidence: string[];
  externalBlocker?: {
    dependency: string;
    exactReason: string;
    repositoryWorkComplete: boolean;
    unavailableUiVerified: boolean;
  };
  lastVerifiedAt: string;
}
```

Status rules:

- `MISSING`: applicable behavior is absent or materially incomplete.
- `IMPLEMENTED`: connected implementation exists and focused source tests pass.
- `TESTED`: focused and integration tests pass.
- `RUNTIME-PROVEN`: real product behavior and postconditions were observed.
- `EXTERNALLY-BLOCKED`: every repository-controlled part is complete, but a specifically named credential, provider, independent host, or physical platform is unavailable; affected UI is hidden or truthful.
- `NOT-APPLICABLE`: the requirement genuinely does not apply, with a concrete reason.

Do not mark `IMPLEMENTED` from file existence.

Generate Markdown from JSON.

Fail verification for:

- Missing authority.
- Missing reason.
- Unsupported status transition.
- Runtime claims without evidence.
- External blocker without completed repository work.
- External blocker whose UI still claims availability.
- Duplicate gap.
- Stale generated report.

After the add-on is complete:

1. Regenerate this remaining-gap ledger.
2. Regenerate the original complete product checklist against the final tree.
3. Require zero applicable `MISSING` items.
4. Require every shipped capability to reach `RUNTIME-PROVEN`.
5. Provider-dependent features may remain `EXTERNALLY-BLOCKED` only when hidden or truthfully unavailable.
6. Do not conclude from source existence.

## 28. Final verification matrix

### Repository and donor

- Fresh clone.
- Two deterministic `npm ci` runs.
- Lock consistency.
- Typecheck.
- Zero-warning lint.
- Format.
- Routes and generated reports.
- Production build.
- Clean worktree.
- Secret/license scan.
- SBOM.
- No donor archive or extraction.
- Exactly 2,126 donor dispositions.

### Demo removal

- No demo route, timer, entitlement, flag, UI, copy, fixture, or anonymous generation bypass.

### Identity

- OCADE identity across every backend and fallback.
- No raw model/provider branding in normal UI.
- Technical questions remain truthful.

### Automatic preparation and storage isolation

- Automatic authenticated preparation.
- Persistent Pause/Cancel/Remove behavior.
- Verified model activation with zero model requests.
- IndexedDB chat deletion leaves OPFS model intact.
- All-IndexedDB deletion leaves OPFS model intact.
- Account deletion leaves OPFS model intact.
- Sign-out leaves OPFS model intact.
- Active model version survives local-data deletion.
- Runtime cache rebuilds from OPFS without network.
- Only Remove Offline Intelligence deletes model files.

### Commercial usage and offline leases

- Free 28.
- Pro/Max session and weekly percentages.
- Exact windows.
- Every backend and surface.
- Concurrency and idempotency.
- Failure/cancellation rules.
- Signed leases.
- Clock rollback.
- Multi-device reconciliation.
- Lock/reset/upgrade without model redownload.

### Product parity

- Chat, Cowork, Code, Projects, Tasks, Artifacts, Search, Customize, Enterprise, extension, native, mobile, and remote-harness journeys.
- No fake or dead controls.

### Authentication and MFA

- Sign-up, verification, login, OAuth, recovery, logout, and deletion.
- TOTP enrollment, QR/manual key, verify, challenge, recovery codes, backup factor, regeneration, replay rejection, factor reset, session revocation, and AAL2 policies.
- Session-specific revocation and high-risk reauthentication.
- No account data before MFA completion.

### Notifications and email

- Preference categories and channels.
- Quiet hours and mute.
- In-app state/history.
- Web Push.
- FCM.
- APNs.
- Transactional email.
- Permission decline/revocation.
- Expired tokens.
- Secure payloads.
- Real device/browser/email receipts before availability claims.

### Team and admin

- Invitations, expiry, resend, revoke, acceptance.
- Roles, groups, deactivation, removal, ownership transfer.
- Cross-organization isolation.
- Admin route/data denial.
- Audit trails.
- Typed danger-zone confirmations.

### Payments

- Canonical catalogue.
- Weekly/monthly.
- Real provider-specific signature validation.
- Raw-body verification.
- Replay, duplicate, and ordering.
- Upgrade/downgrade/renewal/cancel/failure/grace/expiry/refund/dispute/reversal.
- Atomic entitlement.
- Cross-device activation.
- Billing history/invoices.
- No-charge proof.
- No live checkout without complete configuration.
- No model changes during billing events.

### Public trust and support

- `/security`.
- Real status probes.
- Incident and maintenance workflow.
- Truthful independent-host state.
- Help search, articles, feedback, related content, and escalation.
- No fabricated security, incident, uptime, or certification claim.

### Data tables

- Sorting, direction, filters, persistence, selection, bulk actions, pagination, range, frozen column, CSV safety, loading, errors, keyboard, and screen reader.

### Accessibility

- NVDA/Chrome.
- VoiceOver/Safari.
- Keyboard.
- 200% zoom.
- Focus.
- Announcements.
- Touch.
- Reduced motion/transparency.
- No color-only meaning.

### Supabase security

- RLS and grants.
- Invoker/private function boundaries.
- MFA AAL policies.
- Two-user and two-organization matrices.
- Password protection.
- Types current.
- Advisors resolved.

### Performance and CI

- Bundle and Core Web Vitals budgets.
- Zero unexpected console/network errors.
- Full and shuffled tests.
- No unexplained shipped-feature skip.
- Local CI parity.
- No false hosted-CI claim.

## 28A. Final add-on checklist gate

Before final integration:

- `OCADE_REMAINING_PRODUCT_GAPS.json` has no applicable `MISSING`.
- No shipped feature remains merely `IMPLEMENTED`.
- Every shipped feature is `RUNTIME-PROVEN`.
- Every `EXTERNALLY-BLOCKED` item names the exact unavailable provider, credential, independent host, or physical platform.
- Every externally blocked control is hidden or truthfully unavailable.
- Original complete checklist is regenerated against the final tree.
- Original complete checklist has zero applicable missing items.
- IndexedDB/OPFS separation proof passes in the production browser harness.
- MFA recovery does not create a parallel auth system.
- Push, live payment, independent status, and transactional email are not claimed without real receipts.
- No duplicate auth, billing, notification, admin, storage, table, support, or design authority exists.

## 29. Final integration

Only after every final gate passes together:

1. Confirm no implementation commit exists.
2. Review every intended change and deletion.
3. Confirm no secret, donor extraction, RAR, model chunk, browser profile, cache, log, screenshot, credential, or machine-specific artifact is staged.
4. Fetch `origin/main`.
5. If it advanced, safely reapply uncommitted work to the new base.
6. Rerun the complete matrix.
7. Create one final verified commit.
8. Fetch `origin/main` again.
9. If it advanced again, rebase the single commit and rerun everything.
10. Fast-forward `main`.
11. Push without force.
12. Verify remote SHA and tested tree.
13. Publish final evidence containing:
    - Final SHA.
    - Commands and results.
    - Product parity ledger.
    - Donor ledger.
    - Remaining-gap ledger.
    - Original regenerated checklist.
    - IndexedDB/OPFS isolation proof.
    - MFA and session proof.
    - Notification and delivery proof.
    - Team/admin proof.
    - Payment/no-charge proof.
    - Public Security and status proof.
    - Help Center proof.
    - Accessibility proof.
    - Usage and offline-lease proof.
    - Model selection and transfer proof.
    - Supabase/RLS proof.
    - Native/browser proof.
    - Monochrome and performance proof.
    - Genuine external blocker facts.

No later cleanup, formatting, generated-files, CI-fix, payment-fix, or checklist-fix commit is allowed.