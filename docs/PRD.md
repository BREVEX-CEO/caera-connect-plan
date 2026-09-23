# OCADE Product Requirements Document

## Product overview

**CARCC** is the company. **OCADE** is CARCC's AI product. The relationship is company → product, not a combined company name. Current branding must not use CARCC CADANE or CADANE.

Tagline: **Command the Next Era.**

OCADE is a website-first AI chatbot and AI workspace. The current mission is intentionally narrow: make the present Chat experience, Library, Settings, Offline Intelligence, usage, authentication and public surfaces extremely reliable before CARCC starts any separate future product mission.

## Target users

OCADE is for individuals, students, professionals, businesses and later larger organizations, but the current website must stay simple enough for an ordinary user. The interface hides infrastructure and model complexity while preserving strong security, privacy and predictable usage.

## Problem statement

People should not need separate AI products for connected answers and private on-device answers, nor should they need to understand providers, models, runtimes, storage engines or deployment systems. OCADE should provide one clean conversation experience that can work Online or Offline, keep the account consistent across devices, and remain understandable on desktop, tablet and phone.

## Goals

- Deliver a fast, simple Chat experience comparable in interaction quality to leading AI chat products.
- Make Auto, Online and Offline modes truthful and reliable.
- Keep Offline Intelligence reusable across normal website updates without redownloading a compatible verified release.
- Make mobile use first-class rather than a reduced version.
- Keep provider/model/vendor identities out of normal customer experience.
- Keep usage accounting simple: one successful answer equals one use.
- Keep the codebase lean, testable and easy to debug.

## Non-goals for the current mission

Do not build or describe as current product functionality:

- Do not build a Code or coding-agent product in the current mission.
- Do not build Projects in the current mission.
- Do not build Tasks in the current mission.
- Do not build Automations in the current mission.
- Do not build Monitors in the current mission.
- Do not build Organizations or team workspaces in the current mission.
- Do not build native Windows, macOS, Android or iOS apps in the current mission.
- Do not build public conversation sharing in the current mission.
- Do not build a separate side-conversation storage system in the current mission.
- Do not build live browser or computer control in the current mission.
- Do not open live paid checkout in the current mission.
- Do not include Paddle integration in the current mission.

Cowork may remain only as a clean reserved placeholder until the owner explicitly starts a separate mission.

## Core features — current

### Chat

- `/` is the primary product.
- New Chat does not create an empty durable conversation before the first accepted Send.
- Chat streams answers and exposes a working Stop action during generation.
- Chat supports Copy, Edit, Regenerate, Retry and Delete where each action is genuinely available.
- Chat supports conversation search and useful history grouping.
- Immediate permanent conversation deletion after clear confirmation; Archive/Trash must not become parallel deletion concepts.
- Ensure that Temporary Chat persists nothing.
- OCADE renders Markdown, tables, links and code blocks, with copy support for code.
- Users can mark an OCADE answer as Helpful or Not helpful.
- Persist source/citation information with the message when applicable.
- Highlight text or a word → **Ask OCADE**. This uses the current conversation context without creating a second persistent side-conversation system.
- Thinking is an optional user control.
- Web research is an optional Chat control using the same conversation, usage and intelligence authority.

### Intelligence modes

Visible selector: **Auto | Online | Offline**.

- Auto uses Online when connected and healthy.
- Auto uses Offline when connectivity is absent and Offline is ready.
- Auto may fall back to Offline only before Online has delivered meaningful output.
- Online never silently changes into Offline after output starts.
- Manual Offline makes zero Online Intelligence provider requests.
- Provider/model/vendor identity is never a normal customer-facing concept.

### Offline Intelligence

- Automatically begin preparation after first successful sign-in when Offline was not explicitly removed.
- Online Chat remains usable while preparation runs.
- Download may use Wi-Fi, hotspot or cellular. On cellular, warn clearly and allow the customer to continue.
- Verified compatible model releases survive normal website deploys, refreshes, restarts and sign-in cycles without redownload.
- Explicit Remove deletes the local model and prevents automatic reinstall.
- If a customer who removed Offline signs in again, show a clear reusable **Install / Cancel** prompt.
- Selecting Offline while it is removed/not installed immediately offers installation.
- Store all Offline model bytes, chunks, checkpoints and model metadata in **OPFS only**.
- Offline mode must not accept image uploads, read images or claim image understanding.
- Desktop and mobile browser support must be claimed only after real proof. Target supported environments include Chromium-family desktop/mobile and Safari on macOS/iOS where the current runtime genuinely works.

### Attachments and Library

- Library contains user-uploaded files and OCADE-generated files/results.
- Support multiple attachments with a current target ceiling of 100 MB per supported file, subject to safe total-request limits.
- Extract supported document content locally when it can be done safely.
- Treat uploaded bytes and extracted text as hostile/untrusted input.
- Temporary Chat attachments do not enter Library unless the customer explicitly saves them.
- Offline accepts only supported non-image content that the local path can genuinely process.

### Account and authentication

Target current methods:

- Support Google sign-in as a current authentication method.
- Support six-digit email OTP as a current authentication method.
- Support password sign-in as a target authentication method.

MFA is optional for ordinary customers and required for privileged/admin operations. Users can see and revoke active sessions/devices.

Account deletion is immediate after strong confirmation and produces the required non-sensitive compliance receipt.

### Memory

Account memory is an optional account-level capability. When enabled, it may work automatically and quietly without cluttering Chat, but the user must be able to disable it and clear it from Data Controls. Do not create a second hidden uncontrolled profile database.

### Usage

- Free: 28 successful generations per 6h28m, no weekly cap.
- The Pro tier provides 140 successful uses per 6h28m window and 700 per week.
- The Max tier provides 1,400 successful uses per 6h28m window and 7,000 per week.
- Windows are anchored to the account.
- Online, Offline and Auto share one account-wide allowance across all devices.
- Failed or empty generations must cost zero uses.
- Internal retry/failover does not add uses.

### Pricing

Keep Free / Pro / Max and weekly + monthly paid catalogue options.

Current approved displayed anchors:

- Display Pro weekly at 8 USD/EUR/GBP or ₹288.
- Display Pro monthly at 28 USD/EUR/GBP or ₹1,888.
- Display Max weekly at 28 USD/EUR/GBP or ₹1,888.
- Display Max monthly at 88 USD/EUR/GBP or ₹5,888.

Paid prices retain the CARCC numeric signature ending in 8/28.

**Paid plans are not open yet.** Upgrade must say so clearly. Do not charge customers and do not use Paddle.

### Notifications

- Use in-app notifications as the first supported notification channel.
- Support quiet hours for optional notifications.
- Synchronize notification preferences to the account.
- Users control optional categories (mute, quiet hours). Security and account-recovery notices are always delivered in-app and always recorded, because muting them would hide account takeover. There is no billing category while paid checkout is closed.

### Public and administration surfaces

Public: Chat shell, Pricing, About, Help, Terms, Privacy; add Status when its real incident/maintenance data is ready.

Help should evolve into a real Help Center with admin publishing while keeping a safe source fallback.

Admin is hidden and role-gated. Custom plan grants are admin/owner-only, audited and expiring.

## User flows

The canonical step-by-step flows live in `APP_FLOW.md`.

## Future features

No future capability is current merely because old schema/code once existed. A future feature is added only by a new owner-approved mission. Until then, keep the repository and UI focused on the current product.

## Technical constraints

- Keep the current mission limited to the website/browser product.
- Make the website fully responsive across desktop, tablet and phone.
- Durable account data uses the canonical account backend.
- Keep Offline model storage and download chunks in OPFS only.
- Never expose provider, model or vendor identity in normal client/customer surfaces.
- Do not create a duplicate model store, usage authority or Chat engine.
- Site updates must not redownload an unchanged verified Offline release.

## Success metrics and launch gates

The current mission is ready only when:

- Confirm that no known repository-controlled Critical or Major launch blocker remains.
- Confirm that all required unit, database, integration and browser gates pass.
- Prove real Online answers with a disposable test account.
- Prove real Offline answers on supported hardware and browser environments.
- Prove Auto behavior and exactly-once usage accounting.
- Prove model install, resume, remove, reinstall and no-redownload behavior after normal site updates.
- Give every reachable current page, button and setting browser coverage.
- Confirm that 360–375 px mobile layouts have no horizontal overflow or blocked controls.
- Confirm that provider, model and runtime identity do not leak through UI, errors, bundle scans or public metadata.
- Verify production source and deployment parity before release.
