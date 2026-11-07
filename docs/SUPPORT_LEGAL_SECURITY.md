# OCADE security, privacy, support and commerce contracts

This document owns security, privacy, privileged operations, support access and commercial integrity. [Open work](../BLOCKED_TESTS.md) owns unresolved implementation and verification; [ARCHITECTURE.md](ARCHITECTURE.md) owns execution design; [TESTING.md](TESTING.md) owns proof and release procedures. These are requirements, not claims that every requirement is implemented.

The documentation mission changes no application source, schema, infrastructure, customer data, credentials or deployments. Source findings below were inspected against `f521e23529542d709a9627181341b0e904a8b0c3`; deployed enforcement requires separate evidence. Reproduce on the implementation baseline before fixing. Historical reports of failed TOTP enrolment are reproduction leads, not proof of a current failure.

## 1. Product and trust boundaries

OCADE is website-first at `ocade.in`. Chat supports Online and Offline Intelligence; JARVIS remains a separate Online-only conversational execution experience. Loss of online intelligence preserves checkpoints and reports unavailability; it must not silently route JARVIS to Chat's local model.

An ordinary web page does not gain authority over arbitrary applications, browser profiles or local files. User-selected file handles and origin-private storage stay within browser permissions. Native work requires the paired, signed Device Agent; Android requires its installed companion and OS permissions. No mandatory browser extension, developer MCP server, exposed debugging port or copied credential store is a customer prerequisite.

Prefer the existing authenticated browser through legitimate supported attachment or OS control. An isolated product-managed browser profile is a separate sign-in context; never promise automatic reuse of the normal profile's cookies. Chrome's default-profile debugging restrictions must not be bypassed. See [Chrome's documented restriction](https://developer.chrome.com/blog/remote-debugging-port) and [browser file permissions](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API).

| Boundary            | Required authority                                                            | Never treat as authority                                       |
| ------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Account request     | Verified identity, live session and required assurance                        | Body-supplied user id, UI visibility or user-editable metadata |
| Staff operation     | Current granular permission, scoped target, assurance and audit               | Broad role alone or cached menu                                |
| Device action       | Enrolled device, account/task binding, capability and current control state   | Model instruction or Realtime notification                     |
| Native mutation     | Granted scope, execution ownership, fresh precondition and cancellation check | Unrestricted script or stale screenshot                        |
| Completion          | Independent durable postcondition matching the request                        | Tool success, finish message, file existence or HTTP 200       |
| Payment entitlement | Audited grant today; verified billing lifecycle when added                    | Checkout redirect, client price or model assertion             |

## 2. Identity, sessions and assurance

Reuse `src/integrations/supabase/auth-middleware.ts`, `src/lib/security/session-middleware.ts`, `assurance-middleware.ts`, `assurance.ts`, `sessions.functions.ts` and `recovery.functions.ts`. Sensitive service-role functions still bind every query to the verified caller or explicitly authorised target.

`requireSession` checks database session/factor standing and currently caches it for five seconds per isolate. Document that bound; do not call revocation instantaneous. Privileged mutation and device admission cannot rely on a stale display cache. A valid JWT signature does not prove its session is live. Expiry, revocation, factor changes and account suspension must constrain server functions, SQL/RLS and admitted device work.

Keep PKCE, constrained redirects, recovery-code protection and account-isolated storage. Test sign-in, enrolment, factor challenge, recovery, reauthentication and OAuth return paths together. A factor added during a stolen session cannot bootstrap privilege in that session. The Primary Owner's documented read-only bootstrap exception must never unlock privileged changes.

CAPTCHA, OTP, passkey, authenticator, protected elevation, UAC and equivalent boundaries remain human-controlled. Routine safe sub-actions within an authorised task do not need repeated approval. Final purchase/payment execution by JARVIS remains prohibited. Sensitive publication, destructive/security changes and new scope need the applicable confirmation.

Never display/log passwords, recovery secrets, provider keys, raw tokens, cookies or MFA seeds. Customer errors give a safe next action; internal diagnostics use redacted stable codes. Logs exclude private prompt/file content by default.

## 3. Database and direct API enforcement

RLS, table privileges and RPC execution grants are separate controls. Enumerate all three. Service-role access bypasses RLS: its callers need explicit scope checks. `SECURITY DEFINER` functions need a narrow justified purpose, fixed search path, explicit grants and ownership checks. Views preserve intended isolation. Never authorise from `user_metadata`.

**Current source gap:** `20261003090000_owner_and_staff_consoles_on_ocade_in.sql` makes `private.ocade_staff_has` respect grants/denials, but `public.has_role` still answers from broad roles. Usage SELECT in `20260910110000_one_read_policy_per_role.sql` and profile admin SELECT in `20260816094050_f439d6e0-528d-45e2-a4f5-7914e07c7b2f.sql` use that broad helper. Console denial therefore does not establish direct database denial.

The PLAN repair requires a forward policy change, preserving customer self-access. Replace each inappropriate broad read permission with its actual granular permission; trace callers before changing `has_role` globally. Extend `src/lib/admin/__tests__/staff-authority.test.ts`, `owner-staff-on-site.test.ts` and direct-access integration coverage with an admin denied `customers.read`/`usage.read`. Test application, REST, SQL and RPC with the same session, including Customer A/B, anonymous, expired, revoked, AAL1 and valid AAL2.

An unavailable permission/session lookup is not permission. The publishable key is not privileged; service-role/signing material must never enter browser bundles. Deleting an identity must not leave an already-issued token able to recreate content.

## 4. Owner and Staff Console

The canonical privileged surface is `/admin` on normal `ocade.in`. The separate `admin.ocade.in` origin/session table is retired. Owners see Owner Console; authorised staff see only permitted Staff Console modules. Customers see no privileged entry or data. Hiding controls is presentation, not authorisation.

Use verified stable user identities. Bootstrap ownership once through the controlled database procedure; never authorise by an email in React. Invitations activate after verified identity resolution. Roles remain Primary Owner, other Owner (`backup_owner`), Admin, Support, Billing, Developer/Operations and Read-only, with granular overrides. Staff cannot grant itself authority. Only Primary Owner promotes another Owner or transfers primary ownership.

Changes need permission, fresh assurance when applicable, reason, high-impact confirmation and append-only audit. A server-spent confirmation must name the exact customer for session ending, second-factor reset, usage adjustment, suspension/restoration and deletion; a direct Data API call cannot substitute another customer. Long action identities retain a SHA-256 digest of the entire action rather than discarding the target after 120 characters. Server and database use the same Unicode character boundary. This binds the action kind and target; it does not claim that the database recomputes the server's full input-payload digest. Other privileged actions still require their own target/payload review. Record actor, target, action, previous/new state where appropriate, timestamp, reason and session/device context without secrets. Role removal constrains new backend decisions; the console refresh is not the security boundary.

**Current source gap:** ownership transfer in `20261003090000_owner_and_staff_consoles_on_ocade_in.sql` validates before unlocked updates; revoke in `20260930093000_one_staff_authority.sql` can delete that destination concurrently. Promotion does not check affected rows. Exactly one Primary Owner is a required invariant, not a source-proven guarantee.

The PLAN repair serialises all owner-changing transactions with one lock discipline, revalidates locked rows and checks promotion/final invariant before commit. Add two-session transfer-versus-revoke, transfer-versus-transfer and demotion races to PostgreSQL staff tests. Rollback must not restore the unsafe mutation path; disable ownership changes if compatibility cannot be maintained.

Keep real overview, customer, staff, usage, device, task, security, support, health and audit modules only. Payment modules stay hidden until provider-backed. No fake revenue or empty-success state after failed reads. Each visible action needs enforcement, pending/error/retry state, truthful result and audit proof.

Owner/unlimited grants retain usage/cost telemetry. Reuse `ocade_account_unlimited`, `ocade_grant_unlimited`, `ocade_revoke_unlimited` and the existing commercial authority. No hidden test-account bypass. Adjustments/reversals append history.

## 5. Device admission and native control

Extend the existing `src/routes/api/jarvis/enroll.ts`, `device.ts`, `src/jarvis/device.server.ts`, `protocol.ts`, `permissions.ts`, task authority and runtime broker. Enrolment announces a key; authenticated approval binds it to an account. Verify protocol, signed body, timestamp/replay protection, device status and scope before dispatch. Never give a device the service role.

Use outbound authenticated communication, without port forwarding or unauthenticated LAN listeners. A future persistent transport changes delivery mechanics only after parity; it shares signatures, task ownership, admission, acknowledgements and revocation with existing exchange. Realtime wakes an authoritative scoped read.

An action binds account, conversation, task, device, capability, arguments/scope, idempotency identity, expiry, permission revision, control/cancellation epoch and verification requirements. The model proposes; the broker admits. Reject unknown versions/fields and oversized inputs before expensive processing. Page/file/tool content cannot grant permission, widen paths or override STOP.

One owner controls a mutable application/document. Parallel reads must not steal focus or mutate shared state. Physical input pauses UI automation unless explicit Co-work grants a bounded hand-off. Continue reobserves. Navigation, resize, scroll, focus, tab, monitor/DPI, popup and content changes invalidate targeting.

## 6. STOP, revocation and uncertain results

Local STOP cancels current/queued work through device cancellation authority, not solely a cloud poll. Task-owned subprocesses and input need bounded cancellation/cleanup; do not kill unrelated applications.

Remote STOP progresses from requested to acknowledged to verified quiescence. A partition prevents guaranteed immediate delivery. Show last contact and unresolved state; never report success on send. Architecture defines lease expiry and offline failure behaviour for physical work. Unreadable safety control blocks further admission.

Device removal requests cancellation, records revocation and prevents admission. If disconnected, revoke server authority immediately and retain stop intent, without claiming local quiescence. Late results cannot resurrect cancelled tasks. Key rotation must survive lost responses without losing commands; after committed rotation the old key is immediately rejected, and persisted pending-key recovery handles lost replies.

A save/send with lost acknowledgement requires durable-journal reconciliation and independent destination inspection. Return unknown/partial when side effects cannot be established; do not blindly repeat. Compensation is action-specific and authorised, never a universal undo promise.

## 7. Files, scripts and observations

Granted workspace/folder scope is the default; broader scope must be explicit. Resolve canonical paths, symlinks, junctions, network paths and renamed targets at mutation time. Lightweight discovery is permitted; continuous deep inspection/upload of personal files is not.

Preserve originals and produce completed copies unless overwrite is explicit. Deletion defaults to Trash/Recycle Bin where supported; permanent deletion needs stronger confirmation. Verify formulas, formatting, macros, document/project structure and reopen, not merely existence. Partial Office/creative saves remain partial.

A work-directory setting is not a script sandbox. Prefer typed operations. Scripts require admitted purpose, path/network/credential scope, process ownership, timeout and cancellation. Never claim unrestricted commands are isolated; stronger isolation needs adversarial proof.

Prefer relevant semantic observations before screenshots. Retain screenshots/private output only for the authorised purpose and documented duration. Sanitised recipes contain application/version, semantic targets, verification and recovery, never credentials, private contents/screenshots or persistent coordinates. Version/UI changes invalidate assumptions.

### 7.1 Threat model (requirement 170)

Each threat names the control that holds and the test that fails if it stops holding.

| Threat                                                           | Control                                                                                                                                                                                                                      | Regression test                                                                                                                                                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Malicious website: DNS rebinding, redirects to private addresses | Every actor-browser connection goes through `pinned_proxy.PinnedProxy`: one resolution, every answer checked, connection only to a checked address                                                                           | `tests/test_pinned_proxy.py`, `tests/test_web_rebind.py`, `tests/test_web_scope.py`                                                                                                     |
| Malicious website: off-site actions and downloads                | Pages are bound to one origin; a download from another origin is cancelled and never saved (`download_off_origin`)                                                                                                           | `tests/test_web_scope.py`, `tests/test_download_mark.py`                                                                                                                                |
| Malicious download                                               | Saved only under OCADE output, never opened or run; the system internet mark is kept (`Zone.Identifier` / `com.apple.quarantine`) so SmartScreen and Gatekeeper still judge it                                               | `tests/test_download_mark.py`, WEB-005 in `tests/test_web.py`                                                                                                                           |
| Prompt injection in customer files or pages                      | Observations are framed as untrusted data; only operations offered under the current grants can be returned; the database re-checks each grant and risk; external effects need the person's confirmation of the exact effect | `tests/jarvis/contracts.test.ts` (unoffered name refused), `tests/jarvis/db/authority.test.sql` (`permission_required`, `risk_not_supported`), `tests/security/confirmation.test.ts`    |
| Untrusted MCP tool                                               | Pinned executable and script hashes, exact tool list, sanitized environment, read/write risk fixed by the manifest; output is bounded, redacted text and never a status                                                      | `tests/test_catalog.py`                                                                                                                                                                 |
| Compromised or broken bundled worker                             | Exact `tools/list` match or rejection; malformed, oversized or noisy results are `unknown`, never success; a lost worker after dispatch is `maybeChanged`                                                                    | `tests/test_gateway.py` (`test_worker_offering_an_unlisted_tool_is_rejected`, `test_stdout_noise_does_not_become_a_result`, `test_worker_dying_mid_write_is_unknown_and_maybe_changed`) |
| Credentials leaking through evidence                             | Every receipt and every external tool's output is redacted on the device before it leaves                                                                                                                                    | `tests/test_redact.py`, `tests/test_catalog.py`                                                                                                                                         |
| Stolen device credentials                                        | The private key is sealed with DPAPI on Windows (owner-only file elsewhere); every request is signed, fresh and admitted once by the database; the owner can remove the device, which refuses its signatures at once         | `tests/security/device-door.test.ts`, `tests/jarvis/db/device-admission.test.sql`, `tests/jarvis/db/authority.test.sql` (replay, revocation)                                            |
| Stolen or ended browser session                                  | Expired tokens are refused before any network call; a token whose session was ended, or that owes a second factor, is refused by the database; the account always comes from the verified session                            | `tests/security/session.test.ts`, `tests/jarvis/db/session-account.test.sql`                                                                                                            |

Residual risks that need real-machine evidence (qualification): DPAPI key binding to the Windows user, Gatekeeper and SmartScreen behaviour on the marked files, and a Windows script re-run that has only the copy-only containment.

## 8. Offline Intelligence and local data

Keep the small local model, OPFS vault, browser runtime and single installation authority. Ordinary updates preserve verified artifacts. Browser data is origin-scoped and may be cleared/evicted; never promise permanence. Canonical-origin handling prevents separate www/scheme installations.

Existing owners are `src/lib/brain/installation-authority.ts`, `installation-browser.ts`, `model-vault.ts`, `model-store.ts`, `model-transfer.ts` and `runtime-activation.ts`. Do not add a parallel downloader. Separate immutable release identity/digest/length from temporary delivery permission. With usable account context and lease, a verified local artifact must initialise from a cold offline document without fetching a release URL.

**Current gaps:** remote target resolution precedes vault reading; Repair trusts verified metadata plus nonzero length. Repair must force integrity verification and replace invalid bytes; normal healthy reopen retains its fast path. Test interruption, metadata loss, truncation, wrong digest, space shortage, eviction, missing runtime assets, restart, Remove and account switching. A transfer-only fetch spy is insufficient.

Delivery uses `src/routes/api/offline/bytes.$release.ts` and `delivery-signature.ts` with private R2. The current signed URL is a time-limited bearer capability bound to release/expiry, not an unshareable personal proof. Exclude it from logs/analytics/support receipts. Explain expiry/resume. Local bytes can be inspected by their owner; opaque naming is not DRM. Preserve required licence/provenance obligations while normal UI uses OCADE branding.

Keep signed leases and device-signed usage/closure in `src/lib/commercial/offline-lease.ts`, `offline-lease.server.ts`, `offline-usage.functions.ts` and `offline-counter.ts`. Enforce account/device binding, validity, trusted time, signature/key rotation and monotonic usage. Revocation cannot instantly erase disconnected issued authority; bound duration/capacity and reconcile. Do not refund another device's unreported spend.

**Current gap:** `src/lib/chat/unsynced-turns.ts:keyFor` separately reads/generates/writes the key. Independent first-use tabs can overwrite it; `load` deletes undecryptable rows. Use an atomic durable winner or scoped lock plus durable recheck; retain recoverable ciphertext. Prove both tabs' turns survive restart. This remains a temporary journal, not another conversation authority.

## 9. Privacy, export, erasure and retention

Conversations are private; staff have no general transcript browsing right. `20261006090000_cases_name_their_reader_and_conversation.sql` provides grants naming reader and conversation. Require reason, expiry, appropriate owner authorisation and audit. Revocation/expiry constrain direct access. Expose meaningful customer access history where policy permits without internal security notes.

Maintain `src/lib/account/data-classes.ts`: export/delete covers active classes, cascades, attachments and retained exceptions. Explain retained audit/security/legal records and backups without promising instant erasure everywhere.

**Current gaps:** `data-rights.ts:readTable/readCascadedTable` uses unordered offset pages yet may claim completeness. Use stable keyset traversal plus an explicit consistency boundary. `account/erase.server.ts` can proceed after one sweep leaves pending tombstones. An autonomous retry consumer was not established by this review. `library/tombstones.server.ts` also converts a failed final count to zero pending.

Keep shared erasure, trigger-created tombstones and owner-scoped paths. Add bounded monitored retry through the existing scheduling boundary after inspecting `src/cloudflare-entry.ts` and scheduled jobs; do not add a second scheduler blindly. Obligations survive identity deletion until Storage confirms. Track attempts/error/next retry and operator visibility. Unavailable count is unknown/error, never zero.

Receipts distinguish database deletion, pending files, identity deletion, retained exceptions and completion time. Retry partial erasure idempotently; revoke sessions/devices and cancel work. Recovery cannot resurrect intentionally deleted content. Tests live in [TESTING.md](TESTING.md).

## 10. Commercial authority and future billing

Current source has **no live paid checkout implementation**. `20260923100000_retire_trash_payments_and_side_threads.sql` retires subscription/payment/invoice/webhook tables/functions. `src/lib/commercial/entitlement-resolver.ts` resolves audited grants or Free; owner/unlimited grants are separate database decisions. `src/lib/payments/pricing.ts` is a catalogue, not payment evidence.

Keep grants and hide nonfunctional payment controls/metrics. Billing is a future ADD in PLAN, dependent on actual provider/merchant availability and owner-only legal/payment commitments. Do not revive historical payment tables by assumption.

The minimal future contract is one subscription covering purchased Chat/JARVIS entitlements, with separate server-enforced usage where specified. Require hosted/tokenised payment entry; never store card numbers/security codes. Server selects approved plan/currency/amount. Verify webhooks over exact bytes, deduplicate provider event identities and reconcile out-of-order delivery against provider state.

Purchase, renewal, cancellation, failed collection, grace, refund, dispute and reversal need explicit transitions and dated receipts. Append adjustments. Checkout return cannot grant service. Durably persist events before acknowledgement; unresolved events need bounded retry/reconciliation. Define behaviour during provider outages without treating uncertainty as cancellation. Tax, invoices, local currency, UPI and refund terms require current provider/legal verification.

Usage remains server-authoritative through `generation-gate.ts`, `supabase-ledger.ts`, `usage.functions.ts`, `edge-handler.ts` and `supabase/functions/_shared/boundary.ts`. Acquire before provider work; keep idempotency and server-owned settlement. Customer charging is separate from deterministic internal actions/retries. Failed-before-output, cancelled, duplicate, partial-output and unknown settlement need explicit commercial treatment and tests.

Do not change approved public prices or promise margins from unmeasured estimates. Measure provider, infrastructure, support, failed-work and refund cost per verified workflow. Offline inference does not eliminate delivery/support/recovery cost.

## 11. Hosting, secrets and signed updates

Current hosting is Cloudflare **Workers with static assets and R2**, not Pages-only. Preserve Worker-first assets, canonical HTTPS, restricted previews, backend-scoped CSP, framing restrictions and runtime isolation headers. `public-response.ts`, `isolation.ts`, `public/sw.js` and `src/cloudflare-entry.ts` must agree. Authenticated API/server-function responses are not offline-cache material.

Secrets stay server-side, never source, built assets, debug output or screenshots. Signing needs key identifiers, rotation/overlap/expiry, revoked-key behaviour and recovery. Never weaken signature verification to pass an update. Sign exact packaged bytes; install atomically, recover interruptions and retain a verified compatible prior version. Rollback must not reintroduce a known compromised build.

Keep `scripts/deploy.mjs` and the manual production workflow. Web, Edge Function, schema, artifact and native/Android releases are separate. Health identifies routing/version liveness, not RLS, provider quality, workflow correctness or physical safety. [TESTING.md](TESTING.md) owns full release/rollback procedure.

## 12. Incident response and support

Use existing global/device-family execution controls and emergency staff-session revocation; retain ordinary account/Chat access where safe. Incident sequence: record release/incident identity; stop dangerous admission; request/verify cancellation; revoke compromised authority; preserve minimal redacted evidence; assess affected accounts/actions; recover compatible version; reconcile uncertain effects; communicate verified impact; retest before reopening. Actions are scoped and audited.

Help explains Chat/JARVIS, connect-once setup, supported browser control, tray/bubble, legitimate Apple paths, voice/wake, permissions, STOP/Take Over, offline storage/removal, MFA/recovery and case access. Keep normal UI concise.

Terms/Privacy match shipped observations/uploads, retention, support access, permissions, offline limits and billing. Never claim unrestricted Apple control, unhackability, guaranteed task timing, zero defects or real-device proof from emulation. Never ask Android users to disable Play Protect. Pre-wake audio stays local; revocation stops capture and required OS indications remain visible.

Sentry creation and paid leaked-password protection remain deferred. Existing logs/audit still need incident detection and an owner. Review public/legal text when behaviour changes; these are engineering contracts, not jurisdiction-specific legal advice.

## 13. Local customer-PC execution, scripts and ethical billing — 10 October 2026

**Execution location:** OCADE's online AI, account identity, minimal task coordination and verified authorised external websites/email/GitHub may use network/cloud services; native document edits, code builds, CAD, media rendering, local GUI operations and file processing remain on the _selected authenticated customer PC_. Do not silently upload projects to hosted workspaces or replace an offline PC with default cloud execution. A remote smartphone selects an enrolled PC and sees actual waiting/offline status. JARVIS still requires online AI for new decisions and cannot silently use the Chat local model as a fallback.

**Script/code containment:** bind the actual bytes executed, interpreter/application version, argument schema, approved input/output roots and enforced network/process capabilities. A content hash proves which file is run, not isolation from the rest of the OS. No arbitrary model-supplied shell, network, filesystem traversal or privilege escalation; fail closed when sandbox rights cannot be enforced rather than claim unavailable confinement. User-approved scopes and credentials remain separate from project/document content and web instructions. No copying Chrome cookies into a managed browser.

**Human-owned authority:** passwords, OTP, passkeys, CAPTCHA, operating-system UAC and destructive/payment approval remain the user's action. Give direct STOP independent of AI; revocation, app/profile identity and final mutation control generations are verified at the device. Short leases bound future admission under a partition, never undo in-flight OS effects. A signed device receipt authenticates the device but not the impartiality of a compromised executor; independently reread provider/server state where possible.

**Ethical conversion and privacy:** a free allowance and transparent monthly subscription may be introduced only after merchant/legal/tax/refund approval and cost proof. Upsell after a real verified benefit, not fabricated scarcity or compulsive streaks. Opt-in professional workflow sharing cannot leak privately supplied files, chats, source-code, screenshots, tokens or external account IDs to team/referrals. Audit staff and unlimited owner entitlement server-side, with safety limits preserved independently of pricing. Each audio/voice provider and donor project needs separate source, asset, retention and commercial rights inspection.
