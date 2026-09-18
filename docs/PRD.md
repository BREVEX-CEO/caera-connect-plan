# OCADE Product Requirements Document

## Product outcome

OCADE is a browser-first AI workspace whose current production mission is to make Chat, Library, Offline Intelligence, usage, Settings, and account control reliable before Cowork expands. The product must feel simple enough for a normal customer while its online/offline routing, usage enforcement, file handling, and synchronization remain production-grade underneath.

## Current launch surfaces

- Chat is the default root experience and must work for signed-in customers with Online and Offline intelligence.
- Library stores customer files and generated outputs privately and is reachable from Chat attachment flows.
- Settings contains Account, Appearance, Notifications, Data Controls, Usage & Limits, Billing, and Advanced.
- Pricing remains public and explains Free, Pro, and Max clearly even while live payment-provider onboarding is deferred.
- About, Help, Terms, and Privacy remain available as required public/legal pages.
- Hidden Admin remains available only to authorized administrators for safe Free/Pro/Max grant and revoke operations.
- Cowork remains a clean placeholder until this Chat-first mission is complete.

## Authentication

Signed-out visitors may inspect the main Chat shell but Send asks them to sign in. Active authentication methods are Google and six-digit email OTP through Supabase Auth and the configured SMTP provider. Phone authentication is removed completely. Existing Supabase users, identities, sessions, and refresh tokens must survive every cleanup.

## Chat requirements

Chat opens immediately at `/`. New Chat displays an empty composer without creating a database conversation. The first accepted Send creates/persists the conversation, and the first exchange generates a useful title automatically. Customers can later rename and delete with a short confirmation.

The sidebar provides New Chat, Chat, Library, Cowork placeholder, search, compact recent conversations grouped by useful time ranges, and Account at the bottom. It must not become a dashboard of unrelated modules.

The composer provides `+`, text input, microphone dictation, `Auto | Online | Offline`, an optional Thinking control, and Send/Stop. Enter sends and Shift+Enter creates a newline. The composer grows only to a sensible maximum and drafts survive ordinary navigation or recoverable failures.

User messages support Copy, Edit, Delete, and Share only when the real sharing flow exists. OCADE answers support Copy, Regenerate, Delete, Retry after failure, code-block Copy, Markdown, tables, links, and source references where applicable. Editing an earlier prompt preserves earlier context and regenerates from the edited point. Regenerate and Edit→successful regeneration each count as one new successful use.

Controls remain visually quiet until hover/tap where practical. Timestamps appear only when useful. Streaming is required and Send changes to Stop during generation.

Temporary/incognito Chat is supported as a secondary action and is never persisted. Individual conversation export is supported. Public-link sharing is deferred until the core Chat flow is fully reliable.

## Intelligence routing

The customer selector is `Auto | Online | Offline`.

Auto uses Online while the Internet and online boundary are healthy. If the browser loses connectivity and Offline is ready, Auto switches to Offline and subtly indicates that state. If Online fails before any provider output and Offline is ready, Auto may fall back to Offline. Online is disabled when connectivity is absent. Manual Offline makes zero provider requests.

Online OCADE uses the one server-side Supabase `ocade-intelligence` boundary. Offline uses the one owner-approved private OCADE runtime. Normal customers never see provider, model, WebGPU/WASM, artifact-format, key, or vendor names.

## Offline Intelligence requirements

After the first successful sign-in on a supported device, Offline preparation starts automatically as soon as practical while Online Chat remains usable. Downloading must be fast, adaptive, resumable, integrity-verified, restart-safe, and stored persistently on the device. A verified compatible installation is reused across site deploys, refreshes, browser restarts, and sign-in cycles.

If the user explicitly removes Offline Intelligence, OCADE remembers that decision and never automatically redownloads it. The UI says that Offline was removed and offers Install Offline. Only that explicit action clears the suppression.

WebGPU is preferred only where real generation succeeds. WASM is the automatic fallback before output. The customer sees only OCADE Offline readiness, not backend terminology.

Offline-created turns synchronize exactly once to Supabase when connectivity returns. Supabase remains canonical after sync; the local pending journal exists only to preserve unsynchronized work and is cleared/reconciled safely.

## Usage requirements

One successful logical generation equals one use. Failed requests equal zero. Internal retries and pre-output failover attempts add no extra use. The same account-wide allowance applies to Online and Offline.

Free receives 28 successful generations per exact 6h28m window with no weekly cap. Pro receives 140 per 6h28m and 700 per week. Max receives 1,400 per 6h28m and 7,000 per week.

A compact usage indicator appears in the sidebar, a subtle warning appears near Send when allowance is low, and Settings contains a dedicated Usage & Limits page with plan, remaining uses, reset times, weekly state where applicable, and a plain explanation of what consumes one use.

At zero remaining uses, new AI generation is blocked while history, Library, Settings, Pricing, Billing, export, and account controls remain usable. The UI shows the exact reset time and an Upgrade option.

## Attachments and Library

Chat supports multiple attachments up to 100 MB per intentionally supported file, subject to bounded total-message limits. Supported formats include images, PDF, common Office documents, CSV, text, common code/text formats, and safe archives only where bounded parsing can be guaranteed.

Customers can choose files, drag/drop, paste, monitor upload progress, remove, retry, reorder, preview, and download. Attachments must actually influence the intelligence request rather than being stored and ignored.

Every file is untrusted input. Validate user ownership, size, content signature/type, extraction limits, archive structure, and parser safety. Never execute uploaded content. Document prompt injection is treated as untrusted data rather than privileged instructions. Reject malformed, unsafe, or unsupported files with short truthful errors.

When practical, answers derived from files cite the relevant file/page/section/row/cell. Offline image understanding is not claimed; images require connected OCADE. Safe locally extracted text may be used by Offline mode.

## Voice and research

Microphone is dictation-first. The browser-native speech result is placed in the composer for review and is not auto-sent. Unsupported browsers hide or disable the control truthfully.

Web research is added only after core Chat is stable and is implemented through the existing Chat intelligence/tool authority with the same auth, usage, cancellation, persistence, and source-citation rules.

## Settings requirements

Account contains working identity/session/account actions only. Appearance contains dark/light, reduced-motion, high-contrast, and other proven display preferences. Notifications contains only notification channels/events that actually exist. Data Controls contains export/deletion controls and Offline Intelligence lifecycle. Usage & Limits is separate from Billing. Billing shows tier/upgrade information and never spins indefinitely. Advanced contains working session/device diagnostics only.

Every async view has a bounded loading state followed by success, empty, or error with Retry. Infinite “Loading…” and “Reading…” states are defects.

## Design requirements

Use a near-black/charcoal foundation, neutral grey/white text, restrained medium glassmorphism on important surfaces, soft rounded corners, clear hierarchy, minimal borders, and subtle purposeful motion. Do not use sharp enterprise boxes, excessive cards, cinematic scenes, or developer-dashboard density.

Desktop, tablet, and phone preserve the same core capabilities. The sidebar becomes a drawer on narrow screens; Settings becomes an appropriate sheet/full-height layout; the composer remains fully usable without horizontal overflow.

## Non-goals for this mission

Cowork/Jarvis expansion, native desktop apps, public conversation links, full memory, paid payment-provider onboarding, and speculative new product modules are not current implementation goals. They must not distract from shipping a dependable Chat-first product.

## Acceptance criteria

The mission is accepted only when the exact production release proves signed-in Send, real online answer, correct usage accounting, conversation persistence, attachment-to-model use, bounded async states, Library isolation, Offline install/reuse/remove/reinstall, no-Internet Chat, reconnect synchronization, WebGPU generation on supported hardware, WASM fallback, and responsive Settings/Chat without known repository-controlled defects.

## Repository-wide completion rule

This document is subordinate to the active implementation authority in `PLAN.md` and the engineering rules in `CLAUDE.md`, `docs/RULES.md`, and `docs/TESTING.md`. Complete the active plan, fix root causes with regression coverage, then run the separate adversarial enterprise-grade AI-platform QA pass before calling the product complete. After correctness is proven, apply `/ponytail ultra`, `/caveman ultra`, YAGNI, and KISS to remove safely unnecessary code and reduce duplicate authorities and maintenance surface. GitHub Actions is optional; required verification must still run through trusted local or agent execution and the existing direct production authorities.
