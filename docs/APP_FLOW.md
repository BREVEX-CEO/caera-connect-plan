# App Flow

## Purpose

This document defines how users move through OCADE: entry, authentication, primary navigation, core product journeys, redirects, overlays, empty/loading/error states, and recovery. It intentionally does not duplicate component styling from `docs/DESIGN.md` or implementation sequencing from `PLAN.md`.

## Navigation Model

OCADE uses one signed-in application shell with a narrow left rail on desktop and an equivalent compact mobile navigation pattern. The primary destinations are Chat, Cowork, Code, Projects, Tasks, Artifacts, Search, Customize, and Settings. The old More dashboard is removed; useful behavior from that surface belongs in the destination that owns it.

Search is available both as a destination and through Cmd/Ctrl+K global command/search. The shell may show restrained recent conversations or tasks without turning the rail into a large dashboard. Organization/account switching and profile controls live in the account area rather than the primary destination list.

## Entry Points

### First browser/device visit

`/` shows the commercial OCADE landing page. The page should immediately begin non-blocking Offline Intelligence preparation in the background when browser capability allows, without interrupting rendering or asking for a model-download onboarding dialog.

The landing page contains a focused sequence: OCADE value proposition; Chat/Cowork/Code; Offline Intelligence; browser and supported Windows control; Projects/Tasks/Artifacts; privacy/security; plans; FAQ; final Get started action; legal footer. The primary CTA is Get started and the secondary CTA is Sign in.

A tiny non-content device flag may remember that the landing page has already been seen. It must never contain conversation or account content.

### Returning authenticated visitor

Opening `/` skips the landing page and redirects to `/ocade`, which is Chat. If a valid authorized deep link was requested, authentication should return the user to that destination rather than forcing Chat.

### Returning previously-seen but signed-out visitor

Opening `/` redirects to `/auth`. The user is not repeatedly sent through the commercial landing page.

## Authentication Flow

### Register

Landing/Get started → `/auth` Create account intent → credentials/OAuth → email verification where required → authenticated session → `/ocade` Chat.

There is no onboarding wizard. The user can configure profile, appearance, Offline Intelligence, permissions and other preferences later in Settings without blocking access to Chat.

### Sign in

Landing/Sign in or returning signed-out root → `/auth` Sign in intent → credentials/OAuth → authenticated session → original authorized deep link if present, otherwise `/ocade` Chat.

### Verification and callback

Email verification/OAuth callback validates the session and resolves the intended destination. Success routes directly into the app. Failure stays in the auth family with a useful recovery action rather than a blank redirect.

### Password recovery

Forgot password → verified recovery flow → reset password → successful confirmation → Sign in or authenticated Chat according to the actual session state. Expired/invalid recovery links show a dedicated recovery state with a new-link action.

### Session expiry

When an active session expires, OCADE preserves unsent UI state where safely possible, stops privileged operations, shows a clear Session expired state, and offers reauthentication. Reauthentication returns to the previous authorized destination. Unsynchronized RAM-only offline turns require an explicit loss warning before the user abandons them.

### Logout

User menu → Sign out → revoke/clear the account session → `/auth`. Sign-out must not delete Offline Intelligence from OPFS and must not trigger another model download.

## Chat Flow

### New conversation

Chat → centered empty composer → user writes/attaches/selects intelligence mode → permit acquired → request enters `OcadeIntelligence` → response streams → successful meaningful output is persisted to Supabase and usage finalizes exactly once.

If Supabase is temporarily unavailable while Local-only generation is possible, the new turn may remain in open-tab memory. OCADE shows that it is unsynchronized and warns before close/reload/sign-out. On reconnection, the turn synchronizes exactly once.

### Existing conversation

Recent conversation/Search/Project link → authorized conversation → messages and attachments load with pagination → user continues normally. Branching or side-conversation actions preserve lineage rather than cloning unrelated history.

### Conversation lifecycle

Conversation menu → rename, archive, share, export, trash or delete. Trash supports the defined undo period subject to retention policy. Permanent delete removes authoritative user content but never removes Offline Intelligence model binaries.

### Incognito

User chooses Incognito from contextual controls → session is visibly marked Incognito → turns stay in memory only → no account memory or persistent conversation write → leaving/closing destroys the content after any necessary warning.

## Cowork Flow

### Enter Cowork

Navigation → Cowork → Normal mode by default with a clear Normal/Jarvis selector. Both views connect to the same task runtime and do not create separate mission histories.

### Normal Cowork mission

User describes outcome → OCADE produces concise mission plan → user starts → task enters canonical state machine → safe read-only work proceeds → meaningful side effects request approval → action executes through browser/Windows/tool adapter → OCADE re-observes state → postcondition is verified → receipt is stored → mission continues or recovers → final result/artifact is presented.

During execution Pause, Take over and Stop remain prominent. The Command Center opens only when the user needs connection, permission, current-action, receipt or diagnostic detail.

### Jarvis Cowork mission

Cowork → Jarvis → large central OCADE orb with text/voice input → Listening / Thinking / Speaking / Working in browser / Working on computer / Waiting for permission / Paused / Complete states reflect the shared task state. Voice amplitude/frequency drives the listening animation; generated speech drives a distinct speaking animation; executing work uses a separate directional/action pattern.

When browser/computer observation is useful, it opens contextually as a split/side panel. Pause, Take over, Stop and Return to Normal remain accessible. Switching Normal ↔ Jarvis changes presentation only; task ID, history, usage, permissions, receipts and results remain identical.

### Cowork failure/recovery

If extension/host disconnects, element state goes stale, a window/tab changes, approval expires, a command fails, or the app reloads, Cowork stops unsafe continuation, reacquires current state, and resumes only from verified postconditions. It never replays a destructive step merely because the prior client response was lost.

## Code Flow

Navigation → Code → session/repository chooser → repository intake or existing linked repository → environment/repository/branch context displayed → user gives coding task → agent maps relevant files/symbols/tests → proposes/executes permitted edits → diagnostics/tests run → user reviews diff → optional preview/browser verification → authorized Git action → durable task/artifact receipt.

The working view can expose file tree, editor, diff/agent inspector and terminal contextually. Terminal/Git/host actions require the correct permission. When AI usage is locked, manual editing and non-AI repository inspection remain usable.

Host unavailable → browser-only Code capabilities remain available and host-required controls show a precise unavailable state rather than simulated success.

## Projects Flow

Projects → empty state or project list → New project → project workspace. A project connects chats, files, Code sessions, tasks, artifacts, memory, permissions and activity. Creating a project does not create duplicate copies of those records; it creates typed relationships.

Project actions include edit, archive, export and delete. Deletion follows ownership/retention rules and must not silently delete unrelated account data.

## Tasks Flow

Tasks → compact default task list → filter/search/sort as needed → New task. A task can be immediate, scheduled, recurring, monitoring-style, action-required or remote Dispatch work. The creation flow captures only the information required for the chosen task type.

Scheduled task → timezone-aware schedule → canonical task state → required executor availability check → run → approvals → receipts → completion/failure notification. If the action requires a browser extension or Windows host, the task clearly says so before execution.

Advanced board/timeline/analytics views are secondary and never replace the canonical task authority.

## Artifacts Flow

Artifacts → All/Yours/Shared filters → visual cards/list → open artifact → preview/editor + contextual provenance/version inspector. New artifact can begin from the dedicated action or be produced by Chat/Cowork/Code/Tasks.

Artifact version → edit/restore/export/share/delete while preserving lineage, integrity and the originating project/conversation/task/run relationships.

## Search Flow

Search destination or Cmd/Ctrl+K → query → server-authorized paginated results → result type identified → user opens conversation/project/task/artifact/file/command destination. Search never leaks content across user or organization boundaries.

No results has a purposeful empty state with query refinement. Search errors provide retry and do not masquerade as zero results.

## Customize Flow

Customize → Skills / Connectors / Plugins → Discover or Yours → search/filter → open capability → Add/Connect when genuinely available → required permissions/scopes → install/connect → capability appears in Yours and relevant tool registry.

Unavailable or unconfigured provider integrations are hidden or precisely marked unavailable. Revocation removes access and updates tool availability without deleting unrelated user content.

## Settings Flow

Settings groups Models, Devices, Permissions, Connections, Intelligence, Usage, Billing, Appearance, Voice, Notifications, Privacy, Security, Sessions, Data, Support and account deletion. Each group owns its specialist controls so Chat/Cowork/Code remain uncluttered.

### Offline Intelligence controls

Settings/Models → current installation state. If installed and verified: Pause is not shown because no transfer is active; Remove Offline Intelligence is available. Removing deletes only model data and sets deliberate-removal suppression. The next visit does not reinstall automatically. The user can later choose Install Offline Intelligence to explicitly restart preparation.

If download is active: progress, Pause and Cancel are available. Resume continues from verified chunks. Corruption repair downloads only missing/corrupt chunks.

### Usage

Settings/Usage → Free shows the applicable 28 successful uses / 388-minute window state. Paid plans show percentage and reset time rather than raw internal capacities. Exhaustion disables new AI generation but does not block reading, manual file editing, Projects, Tasks, Artifacts, Settings or Billing.

### Account deletion

Settings/Data or Account danger area → reauthentication/MFA as required → explain effects → confirm → server-authoritative deletion workflow. Ordinary account data is removed according to legal/retention rules. Offline Intelligence remains on-device unless the user separately removes it.

## Organization and Admin Flow

Workspace/account switcher → organization → members, invitations, groups, seats, policies, settings, usage/billing overview and audit history according to role. Dangerous changes require recent AAL2 and server-side authorization.

Platform Admin → customer lookup → immutable user/account resolution → authorized operation. Support content access, when needed, requires a time-bound read-only support grant with case/reason/scope/expiry and immutable access events. Email is only a lookup aid, never the mutation identity.

## Payment and Grant Flow

Payments are implemented last. Pricing/upgrade → server resolves plan/catalogue/currency/amount → provider-hosted checkout → signed webhook or server reconciliation → normalized immutable billing event → idempotent state application → authoritative subscription/entitlement → UI updates across devices.

Return/success URLs never grant access. Payment failed/pending/success states are truthful views over server-authoritative status.

Refund/dispute/chargeback events update financial and entitlement state through the same canonical event authority. Manual Admin grant → locate by email if needed → resolve immutable Auth user ID → require recent AAL2 + role + reason + optional start/end → create audited grant → effective entitlement updates atomically. A grant is never represented as a fake payment.

## Public, Legal and Trust Pages

Applicable public pages include Privacy Policy, Terms of Service, Cookie Policy, Cookie Preferences when non-essential cookies exist, Refund Policy, Cancellation Policy, Disclaimer, Accessibility Statement, Data Processing Agreement, Acceptable Use Policy, Security, Responsible Disclosure, Help Center/Support and a truthful Status surface. Community Guidelines exist only if a real community feature ships. Shipping and physical-return pages are not applicable to the software-only product unless the business model changes.

## Required UX States

Every major feature must intentionally design and route Loading, Empty, No results, Error, Success, Permission denied, Offline, Reconnecting, Session expired and Recovery states. Public routing additionally requires intentional 404, 403, 500 and Maintenance experiences. Billing requires Payment success, Payment failed and Payment pending. None may fall through to a blank page or browser-default failure.

## Redirect Rules

- First unseen `/` → landing.
- Returning authenticated `/` → `/ocade` unless preserving an authorized deep link.
- Returning seen signed-out `/` → `/auth`.
- Successful auth/verification → intended deep link or `/ocade`.
- Logout → `/auth`.
- Removed historical routes → explicit redirect to the canonical replacement or intentional not-found state; never silently retain a duplicate implementation.
- Unauthorized organization/admin/share route → 403 or safe account-scoped destination; never reveal resource existence through content leakage.

## Modal, Drawer and Overlay Rules

Use overlays only for short, focused actions such as confirmation, permission, command search, connection setup, compact creation or destructive confirmation. Long workflows belong in pages/panels. Right-side inspectors are contextual and collapsible. Keyboard focus must enter, remain within and return correctly from modal content.

## Mobile Flow

Mobile preserves the same information architecture with responsive navigation. Safe-area insets, virtual keyboards, back navigation, OAuth return, deep links and touch targets must work. Browser/Windows control features that cannot run on the current mobile environment remain truthful; mobile may observe/dispatch work to a compatible paired executor when implemented and authorized.
