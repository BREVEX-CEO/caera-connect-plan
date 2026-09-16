# OCADE Durable Decisions

This file records owner-approved decisions that override older contradictory planning material. `PLAN.md` remains the execution authority.

- Chat is the current product mission and opens directly at `/`. Signed-out visitors may inspect the shell, but Send requires authentication.
- Cowork remains a clean placeholder and may not expand until the current Chat-first plan is complete and the owner starts a separate mission.
- Active authentication is Google plus six-digit email OTP through Supabase. Phone OTP is removed completely. Existing accounts/sessions are preserved.
- Online intelligence remains behind the one Supabase `ocade-intelligence` boundary using the already-configured primary, secondary, and tertiary Gemini secret slots. Normal customers never see provider/model/key/runtime identity.
- The customer intelligence selector is `Auto | Online | Offline`. Auto uses Online when available, uses Offline when connectivity is absent and Offline is ready, and may fall back before online output starts. Manual Offline makes zero provider requests.
- Offline conversations ultimately synchronize to Supabase exactly once. The browser may keep only the minimum pending journal needed to preserve unsynchronized work; Supabase remains canonical after reconciliation.
- Offline preparation begins automatically after first successful sign-in unless the user previously chose Remove. Explicit Remove persists and prevents every automatic redownload until the customer explicitly chooses Install Offline.
- The approved private Offline release is `ocr-2dc0ee44eb397906`, length `484220160`, SHA-256 `2dc0ee44eb39790624623cf5e2a8cc21973c4839a67fed406dd3f9b2e6b7f800`, delivered through private OCADE-controlled R2 and persisted through the existing one installer/OPFS lifecycle.
- WebGPU is preferred only when real generation succeeds on supported hardware; WASM is the automatic fallback before output. Both use the same artifact/lifecycle and are hidden behind the customer term OCADE Offline.
- One successful logical request consumes one use across Online and Offline. Failures consume zero and internal retries/failover do not add uses. Free = 28/6h28m, Pro = 140/6h28m + 700/week, Max = 1,400/6h28m + 7,000/week.
- Settings contains Account, Appearance, Notifications, Data Controls, Usage & Limits, Billing, and Advanced. Offline Intelligence lives within Data Controls/Intelligence rather than as a separate product surface.
- Billing and Pricing remain useful even while live payment-provider checkout is owner-deferred. Unavailable checkout must be honest and must never block the non-payment mission.
- Chat includes generated titles, rename, delete confirmation, search/grouped history, Copy/Edit/Delete, Regenerate, Retry, Stop, temporary chat, individual export, contextual Share only when real sharing exists, Markdown/tables/links/code copy, drafts, microphone dictation, Thinking, and duplicate-Send prevention.
- Attachments support multiple files, up to 100 MB each for intentionally supported types, drag/drop/paste, progress, remove, retry, reorder, preview/download, source-linked answers, ownership validation, and hostile-file/parser/archive protection. Uploaded content is never executed and document text is untrusted data.
- Offline image understanding is not claimed. Images require connected intelligence. Safe locally extracted text may feed Offline mode where supported.
- Web research belongs inside the existing Chat intelligence/tool authority after core Chat is stable; it does not create another Chat engine.
- Every asynchronous UI surface must leave loading and reach success, empty, error/Retry, cancelled, or genuine progress. Infinite “Loading…”/“Reading…” states are bugs.
- The visual authority is near-black/charcoal, neutral grey/white, restrained medium glassmorphism, rounded corners, minimal borders, clean typography, subtle purposeful motion, and responsive desktop/tablet/phone behavior. Sharp enterprise boxes, card walls, and cinematic scenes are rejected.
- Public/legal surfaces keep About, Help, Terms, Privacy, and Pricing. Native desktop apps and install-app promotion remain out of scope for this browser-first mission.
- The permanent owner/admin is `caeracadane28@gmail.com` through the audited role/grant authority; ordinary users must not be able to reach or self-grant Admin/entitlements.
- Supabase leaked-password protection is documented but is not a current launch blocker for the Google/email-OTP passwordless product on the owner’s current Supabase plan.
- Every engineering session uses `/ponytail ultra` and `/caveman ultra`, applies YAGNI/KISS, prefers one canonical authority, deletes safe dead/duplicate code, and fixes root causes rather than adding layers of patches.
