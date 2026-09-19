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
- Code/coding-agent product;
- Projects;
- Tasks;
- Automations;
- Monitors;
- Organizations/team workspaces;
- native Windows/macOS/Android/iOS apps;
- public conversation sharing;
- separate side-conversation storage;
- live browser/computer-control product;
- live paid checkout;
- Paddle integration.

Cowork may remain only as a clean reserved placeholder until the owner explicitly starts a separate mission.

## Core features — current

### Chat

- `/` is the primary product.
- New Chat does not create an empty durable conversation before the first accepted Send.
- Streaming answers with Stop.
- Copy, Edit, Regenerate, Retry and Delete.
- Conversation search and useful history grouping.
- Immediate permanent conversation deletion after clear confirmation; Archive/Trash must not become parallel deletion concepts.
- Temporary Chat persists nothing.
- Markdown, tables, links, code blocks and code copy.
- Helpful / Not helpful reaction.
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
- Model bytes/chunks/checkpoints/model metadata use **OPFS only**.
- No Offline image upload, image reading or image understanding.
- Desktop and mobile browser support must be claimed only after real proof. Target supported environments include Chromium-family desktop/mobile and Safari on macOS/iOS where the current runtime genuinely works.

### Attachments and Library

- Library contains user-uploaded files and OCADE-generated files/results.
- Multiple supported attachments; current target ceiling is 100 MB per supported file, subject to safe total/request limits.
- Safe local extraction where possible.
- Treat uploaded bytes and extracted text as hostile/untrusted input.
- Temporary Chat attachments do not enter Library unless the customer explicitly saves them.
- Offline accepts only supported non-image content that the local path can genuinely process.

### Account and authentication

Target current methods:
- Google;
- six-digit email OTP;
- password sign-in.

MFA is optional for ordinary customers and required for privileged/admin operations. Users can see and revoke active sessions/devices.

Account deletion is immediate after strong confirmation and produces the required non-sensitive compliance receipt.

### Memory

Account memory is an optional account-level capability. When enabled, it may work automatically and quietly without cluttering Chat, but the user must be able to disable it and clear it from Data Controls. Do not create a second hidden uncontrolled profile database.

### Usage

- Free: 28 successful generations per 6h28m, no weekly cap.
- Pro: 140 per 6h28m + 700/week.
- Max: 1,400 per 6h28m + 7,000/week.
- Windows are anchored to the account.
- Online, Offline and Auto share one account-wide allowance across all devices.
- Failed/empty generations cost zero.
- Internal retry/failover does not add uses.

### Pricing

Keep Free / Pro / Max and weekly + monthly paid catalogue options.

Current approved displayed anchors:
- Pro weekly: 8 USD/EUR/GBP or ₹288.
- Pro monthly: 28 USD/EUR/GBP or ₹1,888.
- Max weekly: 28 USD/EUR/GBP or ₹1,888.
- Max monthly: 88 USD/EUR/GBP or ₹5,888.

Paid prices retain the CARCC numeric signature ending in 8/28.

**Paid plans are not open yet.** Upgrade must say so clearly. Do not charge customers and do not use Paddle.

### Notifications

- In-app channel first.
- Quiet hours.
- Preferences synchronized to the account.
- Users may control notification categories, including security/account/billing notification delivery preferences; records required for security/audit may still be retained where necessary for the product or law.

### Public and administration surfaces

Public: Chat shell, Pricing, About, Help, Terms, Privacy; add Status when its real incident/maintenance data is ready.

Help should evolve into a real Help Center with admin publishing while keeping a safe source fallback.

Admin is hidden and role-gated. Custom plan grants are admin/owner-only, audited and expiring.

## User flows

The canonical step-by-step flows live in `APP_FLOW.md`.

## Future features

No future capability is current merely because old schema/code once existed. A future feature is added only by a new owner-approved mission. Until then, keep the repository and UI focused on the current product.

## Technical constraints

- Website/browser only for the current mission.
- Fully responsive desktop/tablet/phone.
- Durable account data uses the canonical account backend.
- Offline model storage/download chunks are OPFS-only.
- No provider/model/vendor identity in normal client/customer surfaces.
- No duplicate model store, duplicate usage authority or duplicate Chat engine.
- Site updates must not redownload an unchanged verified Offline release.

## Success metrics and launch gates

The current mission is ready only when:
- no known repository-controlled Critical or Major launch blocker remains;
- required unit/database/integration/browser gates pass;
- real Online answers are proven in a disposable test account;
- real Offline answers are proven on supported hardware/browser environments;
- Auto behavior and exactly-once usage are proven;
- model install/resume/remove/reinstall and no-redownload-on-site-update are proven;
- every reachable current page/button/setting has browser coverage;
- 360–375 px mobile layouts have no horizontal overflow or blocked controls;
- no customer-visible provider/model/runtime identity leaks through UI, errors, bundle scans or public metadata;
- production source/deployment parity is verified.
