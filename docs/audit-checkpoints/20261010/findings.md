# Preserved audit findings — unfinished source review

Baseline: `9b2fe3e40fd915dcf32316e5daa20ed7295f8ffb`. No finding below is a implemented fix or fresh runtime PASS. Coverage is in coverage.json. The original scratch files remain intact.

## Saved checkpoint: root-findings.md

# Root audit findings — source evidence only

Baseline9b2fe3e40fd915dcf32316e5daa20ed7295f8ffb. Application untouched. Full per-file range/hash record in root-coverage.json.

## R-AUTH-001 configuration-only loader still loads auth stack

on-demand.ts36–39 imports client rather than lightweight configuration. Trace through auth-attacher.ts33 and start.ts registration before measuring impact. Keep singletonclient; narrow config import repair. Not a claimed fresh bundle measurement.

## R-AUTH-002 misleading generated headers / repeated fetch shim

auth-middleware.ts1 and client.server.ts1 claim generated despite similar browser comments stating handauthored. Verify generator references before removing header. Opaque API-key fetch shim duplicated in middleware/server/browser; purehelper only if import/bundle/headers/security parity is proved.

## R-AUTH-003 OAuth email rate errors misclassified

oauth-errors.ts89 tests generic email before rate-limit at98. Input email rate limit exceeded deterministically reaches already-linked wording by source analysis. Add exact-code-first and overlapping-message negative tests. No source execution during docs mission.

## Follow-up trace

auth-attacher.ts54 void promise has no rejection handler; network SDK return-vs-throw behavior and caller tests must be checked before assigning actual unhandled rejection. recovery-link.ts PKCE code is explicitly provisional; verify reset-password route and hosted password/assurance policy, do not infer valid recovery from a URL.

## R-SEC-004 regex caller scope is only a linter

caller-scoped-functions.ts53-78 regards auth.uid text or any scoped-helper reference as proof. Comments, unused results and non-enforcing branches can qualify. Keep useful regression signal; replace claims of authorization proof with deployed negative cross-user tests and full function control-flow review. Not evidence that a specific RPC is exploitable.

## R-SEC-005 distinct revocation events collide

sessions.functions.ts213 key includes surviving session and count only. Two sweeps from same session each removing one newly-created session collide despite comment202-205 claiming separate sweeps receive their own event. send.server.ts96-105 passes key to database recorder. Use durable mutation/event id returned by transaction, reused for retry; test A revokes B then A revokes C produces two events, retry same event one. Trace database upsert during backend review before closure.

## R-SEC-006 recovery has partial external side effects

recovery.functions.ts135-205 consumes code, deletes each factor, then revokes sessions. Failed individual deletion returns before session revocation; failed revocation leaves removed factor and live sessions. Source proves partial state, not exploit. Add durable recovery operation, deny protected mutations during recovery, resumable idempotent cleanup, independent factor/session rereads and precise UI states. RPC transport error at139-144 cannot prove code not spent if DB committed and reply lost; replace Nothing was used up with unknown/reconcile. Same commit uncertainty must cover issuing code sheets.

## R-SEC-007 password reproof comments and errors

reauthentication.ts101-106 asserts password sign-in refreshes same session; verify SDK/Auth server semantics before using this as design invariant. 122-123 maps every error (network, throttle, service) to wrong_password; distinguish bounded structured causes and preserve unknown outcomes. MFA discardUnverifiedFactors271-282 removes every unverified factor, including concurrently active enrolment on another tab/device; scope cleanup to owned attempt or explicit stale age and verify server state.

## R-SEC-008 notification side effects need durable delivery attempt

send.server.ts105-106 initiates push even when record RPC returns an existing id; browser tag limits presentation duplication but does not make provider requests exactly-once. Per-subscription updates219ff filter endpoint without user binding after initial read; account rebinding race requires trace of subscription uniqueness and transfer. Retry/backoff in request may delay completed security action; use existing durable delivery state rather than add a second notification authority. Initial channels calculation78 lies outside try despite never-throws contract; only actionable if config parser can throw.

## R-TEST-009 named failure case does not inject failure

reauthentication.test.ts86-93 says factor list unreadable but never sets factorsThrows=true; it tests empty successful list. Fix fixture and add returned-error vs thrown-error cases. Same-session assertion142-154 only observes supplied email/password and cannot prove provider session continuity. Recovery-functions tests remove middleware and validators by builder mock11-23; retain unit purpose and separately require real request/middleware/provider checks. No fresh tests executed in documentation stage.

## R-DOC-010 stale security comments

public-response.ts155-157 claims omitted path is non-isolated, but165 defaults to / which isolation.ts84-86 isolates. isolation.ts4-28 and upgrade.ts5-8 describe older landing/ocade topology; actual routing is auth exception. send.server introductory no-push claim contradicts actual push sender. Repair comments in Claude source stage and canonical PLAN to avoid obsolete instructions. CSP unsafe-inline remains enabled18; nonce/hash strategy must account for TanStack SSR hydration and wasm requirements rather than deleting allowance blindly.

## Saved checkpoint: runtime-findings.md

# Full runtime audit working findings

Baseline9b2fe3e40fd915dcf32316e5daa20ed7295f8ffb. Scope169 tracked files. No product changes/tests/builds/device interactions. Exact per-file range/status in runtime-coverage.json. Prior70 full reads have exact equal Git blob identity against f521e235 and explicit prior evidence; changed runtime README read anew. All other PENDING paths still require reading; no exhaustive audit claim yet.

## Provenance

Donor ZIP SHA25607be657ca2f0ba4665b27deac6a1779cf42db477d6a01cfae3b94ee4f90ca9e0.66 entries including directories;58 file entries,55 nonempty and3 empty. All55 nonempty raw ZIP bytes match source-original.sha256; empty modules have SHA256e3b0... known empty digest. ZIP LICENSE fully read, OCADE proprietary notice. Same notice in source-original, active runtime and intake variants explicitly preserves third-party licence priority61–72/111–112. OCADE notice alone does not establish Mark upstream commercial permission or chain-of-title. Current upstream researched Mark-LV CC BY-NC4.0 remains distinct evidence. Local checkout shallow=true; log --follow stops f277408 boundary and cannot establish earlier licence history. Remote historical research pending after full source gate. Immutable contents remain unchanged.

UI ZIP SHA256dfd6ba4154be014a02858aefbfd6086fa57c44dc7ca78ec7c6293516c149266b;38 entries. React19/Vite8/Tailwind4 Figma-Make design donor, no LICENSE entry. Paired images duplicate under assets/imports. Entry metadata and package manifest inspected; relevant code/art still pending. Do not copy into production assuming public/owner archive presence establishes every embedded asset right.

## Existing strengths and tests

Prior source-traced findings remain unchanged: identity rotation can claim ignored work; Android stale observation equality; semantic late-STOP omission and physical-input pause bypass; Office post-mutation failures missing maybeChanged; model-owned finish; Android memory-only result journal; actual batches currently reduce model predictions but retain cloud queue per action. Exact current lines/traces retained in work/runtime-review.md and current ARCHITECTURE baseline; to consolidate after all reads.

Fresh tests: browser_control tests full311 lines; semantic refs/nav/type/resize/scroll/name changes, card/password/CAPTCHA/OTP, purchase/sensitive gate, owned tabs and scoped upload/download. Existing-browser full191 lines uses fresh controlled Chromium user-data directory and debugging endpoint; this is not proof ordinary signed-in default-profile Chrome attachment works. No explicit multi-account chooser or independently identified final Google account fixture established here. Preserve generic capability, add exact account identity/grant fixture rather than fixed Google account index.

Manual installed lifecycle full240 lines includes real install/approval/tray/update/rollback/uninstall/reinstall and suspended-agent case. It refuses preexisting installed/running agent116–118, but allocates test dirs/copies real_home106–113 before guard and before try119, so refusal leaks those test/backup dirs. Later process enumeration/suspend216–218 uses process name; isolated machine/state is prerequisite, not permission to suspend a concurrent user's new agent. Refactor tests later to task-owned process identity. No test executed now.

test_computer full607 lines covers workspace/symlink, trash/delete, Linux confinement versus Windows/macOS direct runner, undo/conflicts, settings, apps, native screen/user takeover, UIA and multimonitor. cwd isolation is not native OS sandbox. GUI Calculator fixture531–553 launches/focuses/closes by title and can affect an already-open user Calculator: isolate task-owned application before real-machine execution. Preserve broad action-family parity; don't reduce suite to report workflows.

test_update full482 lines distinguishes fake health from real executable launch, ensures old installer launcher preserved across releases, prevents downgrade/repeated rollback, handles process crash/signature-publish race. test_wake full154 uses random weights for Python/Java parity; verifies signature and zero-model work when silent. This does not establish actual phrase recognition/noisy-room barge-in. Several tempfile-based suites lack cleanup of every created folder; future test hygiene improvement, not reason to execute cleanup during audit.

## Binary inspection

Active/donor ICO SHA256ea10c08932be8207a10bfd247dd8398242a1730d3ea1c89dbd7feba8d855828d, identical6-image directory16/32/48/64/128/256px32bpp. Metadata read; no visual appearance verdict. Wake NPZ SHA256ea062a9ec688b2bea49750eb4ecca2f9eaadd371f08e8c82e49b00a288c17584; all16 NPY headers read without loading executable pickle: float32 conv/bias,dense/bias,mean/std,threshold;int32 dilations. Manifest/signature read statically; no cryptographic runtime or audio test performed.

## Saved checkpoint: ui-findings.md

# Full UI/docs/scripts inspection findings

Baseline `9b2fe3e40fd915dcf32316e5daa20ed7295f8ffb`. Active mission: complete assigned135-file inspection; repository unchanged. This working note is not final product authority. Status/covered ranges and exact prior-blob comparisons are in ui-coverage.json. No source defect below is claimed reproduced by running product tests.

## Batch 1: carried reads and authentication (2026-10-09)

26 previously FULL_READ files carried forward only after exact Git blob equality from f521e235 to9b2fe3e; each row records blob, baseline and method. Four auth routes freshly read in complete numbered ranges: index1–394, callback1–180, verify1–280, reset-password1–286. Total30/135 full text reads; other105 remain pending, including binaries. Prior historical partial reads are not counted.

### U001 — Recovery instructions lead to no recovery-request control

Current source: reset-password219–226 tells user to ask for reset link from sign-in and sends to /auth. auth.index137–260 contains Google, email OTP and password handlers only; entire rendered surface278–394 provides no password-reset sender or recovery link. Password failure250 tells user to reset without a usable destination. Add a legitimate explicit Forgot password entry in the existing auth route or its existing form state, generic anti-enumeration delivery notice, local/provider rate-limit feedback, then return to same original safe destination after actual password update. Test signed-in/out, wrong address, unavailable email delivery, expired link, resend, network failure and duplicate press. Do not implement a second identity service.

### U002 — Recovery proof and target must be bound at mutation time

reset-password106–118 calls exchangeCodeForSession for URL classified recovery_code and sets linkValid solely from absence of exchangeError. submit140–184 calls updateUser({password}); it does not recheck recovery provenance, current user or currentPassword. PASSWORD_RECOVERY event independently opens the form68–71. Parent is cross-reading recovery-link and hosted/provider policy. This is a source enforcement gap/hypothesis, not demonstrated account takeover: need distinguish ordinary PKCE vs recovery exchange and test provider-side recovery restriction/recent-auth policy. Require a recovery attempt tied to verified auth identity and short-lived proof; account change/expiry closes form and clears sensitive draft. Fragment text alone already does NOT directly open the form; preserve that improvement.

### U003 — OAuth callback may complete a different existing session

auth.callback74–95 checks getSession first and returns after finish for any existing session. finish56–71 calls getUser (good token validation) but does not bind to requested login attempt/expected identity. A new callback code can therefore be ignored if a session is already present; whether this occurs depends on SDK auto-exchange ordering. Reproduce with explicit account switch, delayed SDK exchange and pre-existing session; never assert current Google account chooser automatically picks the wrong account without evidence. Preserve a nonsecret attempt ID/safe destination and verify the returned OCADE subject matches explicit switch intent before navigation. Do not conflate OCADE Supabase identity with the Google account used inside an external Drive tab.

### U004 — Callback and recovery client-load branches miss catches

auth.callback75 awaits client before its try76; listener load115 has no catch; finish called with void119/130 can reject.15-second fallback135 eventually shows connection advice, but unhandled promises/duplicate calls remain. reset-password65 listener load also lacks catch while separate checkTheLink branch handles failure. Consolidate narrow load lifecycle/generation/catches; keep bounded timeout and correct cancellation. callback166 returns /auth without explicitly carrying target; preserve intended safe destination in retry.

### U005 — OTP verify lacks pre-await ownership and target-reset handling

auth.verify108–119 awaits client before busy; parallel submissions during lazy load can both verify. Resend168–180 sets its own guard first, which is an existing improvement. Verify/resend remain independent, and component state initialised from identifier40/64 is not reset by an identifier-change effect. Define one attempt with email/nonce/generation; disable mutually incompatible requests, ignore late old-identifier completions, preserve pending request outcome without false success. Provider single-use/rate limit is the security authority; UI throttles are not a server defence.

### Existing verified source controls to preserve

Auth provider unavailable lookup intentionally keeps usable methods; not an auth bypass. Email/password failure avoids account existence disclosure. Google uses same-tab redirect (no popup is opened by this route). Busy disables submit/Google and successful redirect keeps busy. safeNext owns destinations. Callback getUser validates token;15s timeout and poll cleanup exist. OTP prevents native form default before await, validates six digits, records throttles, shows button countdown, and releases resend after throws. Password update handles thrown errors and same/expired messages; fragment recovery waits for provider event.

### Required Google Drive account-choice contract (to expand after executor cross-read)

Keep four identities distinct: OCADE signed-in subject; paired-device authority; browser profile/session; external Google account. User request to open Drive/report is not permission to choose first account. Resolve exact authorised profile and account when already specified; observe authentic destination/current account. If one explicitly selected identity appears uniquely in chooser, select via authorised UI; if intent remains ambiguous ask one focused question. Password/OTP/passkey/CAPTCHA/sensitive consent belongs to Take Over, never model credentials. Keep task/outcome waiting without discarding context; after user completion refresh observation, verify external account and destination before any private read/write. Wrong identity blocks sensitive work; account/profile change invalidates prior observation and scope decisions. Popup/new-tab/navigation failure preserves original task and offers one specific action; never auto-repeat external submit. Tests must include two Google accounts, exact selection, wrong existing login, blocked popup, tab replacement, denied consent, cancelled takeover and resumed verification. This is distinct from improving OCADE's own Google OAuth entry.

## Carried current source findings pending broader trace

- JARVIS read failure rendered blank or false sign-in (workspace/panels; runtime reviewer owns full paths).
- AdvancedSection revoke errors ignored; old revokeOne.data can mask later revokeRest result.
- JARVIS modal focus reuse missing while shell/settings already have shared hook.
- Orb continuous idle/dimmed rendering needs measured suspension/cache work; binding owner requires restrained cursor-reactive expanding real graph, not removal.
- use-voice speech onerror handling missing; current half-duplex cannot claim spoken barge-in. Audio interruption differs from task STOP.
- BrowserPanel same-task old frame retained without freshness after failed pull; cross-task task-ID guard already exists.
- accessibility checker can pass missing/zero roots; dead-control regex can misparse comment-like strings; harness prints BLOCKED but zero exit when no failures; readiness identity needs verification.

No final design or full-audit completion claim until all accessible assigned text/binaries are inspected and cross-traces reconciled.

## Additional findings reported after the saved checkpoint

### Root: stream lifecycle and notifications

- `src/lib/intelligence/router.ts:188` and `:210` manually advance nested generators. Outer cleanup at223-225 only detaches/deletes; it does not close those iterators or abort on consumer return. `online-client.ts:128` releases the SSE lock without cancelling; `offline-transport.ts:109` queues tokens without a bound. Trace hook cleanup and reproduce before assigning production severity. Proposed fix: one owned cancellation scope, close active iterator in finally, cancel reader, bound/coalesce callback queue, test consumer-return/unmount/probe cancellation. Keep privacy, permit and pre-output fallback checks.
- `online-client.ts:27` signs out locally on any refresh error, including potentially transient connectivity failures; distinguish invalid credentials from unknown network outcome. `isEvent` at81 validates type only; require bounded event/frame sizes and field validation. Tests cover malformed/truncated SSE, CRLF, auth retry and basic cancellation, but not these lifecycle cases.
- `notifications/channels.ts:67` marks push available from public key alone, while the sender needs a private key too. `preferences.ts:239` uses chosen channels as an on/off flag and sends all available channels; frequency does not control sender execution. Trace UI intent and any deployed queue before claiming grouped/digest/quiet-hour release works.
- `push-device.ts:101` swallows unsubscribe failure during sign-out. Verify old-account push cannot reach the next user on a shared device. `web-push.ts:213` has no explicit request deadline. Preserve provider allowlist, manual redirects, encryption and VAPID; test transport budgets and payload-size limits.

### Backend reviewer

- Current staff tests preserve broad `has_role` admin SELECT and test overrides through helpers/RPC, without a direct negative customers.read/usage.read case or concurrent owner transfer/revoke proof.
- `src/lib/admin/staff.functions.ts:615` grants case access before `sendNotification(...).catch(...)`; sender returns failures rather than throwing. An access-grant notification can silently fail. Require durable event/outbox or explicit failed outcome before asserting access is never silent.
- July migrations newly read are historical schemas/privileges, including messenger/Ficia/tenant policies and obsolete subscription terms. Trace later retirement/surviving policies; do not report historical weaknesses or old pricing as current. Preserve migrations until a tested replacement baseline proves replay and upgrade parity.

### UI reviewer

- `ConfirmIdentity` has setup generation protection but lacks proof-submit resolver binding: an old proof can finish a newly opened prompt. This is a UI intent-binding issue; no server bypass has been proved. `TwoStep` globally labels removal of factors[0] as Turn off, and factor-read failure lacks Retry.
- `ChatWorkspace.tsx:342` empty-state logic excludes message loading/read failure and can suppress retry UI. Enter handling465-469 lacks IME isComposing guard. Attachment async work232-288 lacks account/conversation/temporary generation binding. Same-route mobile New chat may leave drawer open. Sign-out errors/pending feedback and menu keyboard handling need repair.
- Workspace has no unmount cleanup calling chat.stop; the hook must own this. Send clears draft then awaits without catch; verify hook rejection contract before claiming lost draft. UI Stop calls chat.stop. Next source read is use-chat.ts, in full.
- `MessageList.tsx:47` scrolls on every streaming change, displacing a reader browsing older messages. Follow only near bottom, add Jump to latest. Attachment links188-195 open bare Library rather than exact object; temporary/failed-save attachments may have no saved object. Touch affordances and copy-success feedback need work. Keep safe Markdown renderer/remote image suppression.
- Small documentation pointers preserve migration/source references. Historical deferred Gemini issues preserve route drift, step limits, tool-turn/media completion, stale APIs, coordinates, STOP permission, Qt accessibility, existing app detection and missing real-model workflow proof.

### Runtime reviewer

- Donor ZIP SHA begins07be657c; all55 nonempty archive entries matched the preserved58-entry manifest (3 empty). ZIP holds an OCADE proprietary notice; runtime/source notices preserve third-party rights. This does not prove chain of title from Mark. Shallow history limits provenance; current Mark CC BY-NC requires separate historical licence investigation. No donor execution or copying authorised.
- Donor discovery imports plugin/action modules before validating/enabled checks; installer uses unpinned dependencies and can declare ready after pip failures. Reject these production patterns.
- Donor confirmation holds one replaceable closure without action ID; stale UI can resolve a newer action. Undo is in-memory and not durable/conflict-safe. Echo explicitly lacks mid-sentence interruption pending hardware validation. STT can relax offline flags for a model download. Camera/monitor selection needs explicit privacy controls.
- Donor prompt asks to obey tool-result instructions and guess ambiguous targets. Preserve immutable provenance; write independent trusted-data/account-choice rules. Weather capability opens a search rather than providing an independently verified weather API result.
