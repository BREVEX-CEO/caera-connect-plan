# OCADE App Flow

## Pages and surfaces

### Public
- `/` — Chat shell; Send requires sign-in.
- `/pricing` — Free/Pro/Max information; paid checkout closed.
- `/about` — founder/company context: CARCC is the company, OCADE the product.
- `/help` — Help Center/current support guidance.
- `/terms`
- `/privacy`
- future `/status` only when real status data is published.

### Signed-in
- `/` — Chat.
- `/library` — uploaded and generated files.
- Settings — responsive dialog/surface from Account.
- `/admin` — hidden, role-gated owner/admin surface.
- `/cowork` may remain a reserved placeholder only; it is not a current functional product.

## Navigation

Desktop: compact left rail/sidebar with New Chat, Chat, Library, recent conversations, optional reserved Cowork placeholder, usage state and Account.

Mobile: drawer/sheet with the same current capabilities. No horizontal scrolling and no desktop-only control.

## First visit

1. Visitor lands on Chat.
2. They can inspect the shell and public pages.
3. Send or account-only action opens authentication.
4. After sign-in, return to the intended Chat context.
5. If Offline was never explicitly removed, background preparation begins without blocking Online Chat.

## Authentication

Offer:
- Continue with Google;
- email OTP;
- password sign-in.

Do not reveal whether an email account exists through useful enumeration copy.

Privileged actions may require an MFA challenge even when the account is already signed in.

## New Chat

1. Empty workspace + composer.
2. No empty durable conversation row yet.
3. User enters text/attachments and chooses Auto/Online/Offline plus optional Thinking/Research.
4. OCADE acquires one usage permit.
5. First accepted Send creates/persists the conversation/question as required.
6. Answer streams.
7. Delivery is recorded and usage settles exactly once.
8. Conversation receives a concise title.

## Intelligence selector

### Auto
Connected + Online healthy → Online.

No connectivity + Offline ready → Offline with a subtle customer-safe status.

Online pre-output failure + Offline ready → one fallback without a second use.

### Online
Needs Internet. When disconnected, disable it and explain why.

### Offline
Zero Online provider traffic. If not installed/removed:
- show **Install Offline** immediately;
- if the user previously removed it, show reusable **Install / Cancel** prompt on a later sign-in and whenever they choose Offline.

Offline refuses image upload/input.

## Offline installation

Normal first sign-in:
1. Determine whether customer previously removed Offline.
2. If not, begin preparation automatically.
3. Chat remains usable Online.
4. Download uses OPFS-only model storage and may use Wi-Fi, hotspot or cellular.
5. On cellular, warn and provide Continue; do not permanently block the transfer.
6. Download/checkpoint/resume → verify → activate → Ready.

Explicit Remove:
1. Ask concise confirmation.
2. Delete model data from OPFS.
3. Verify absence.
4. Record the non-model uninstall preference.
5. Publish Removed only after deletion succeeded.

Normal website updates never invalidate an unchanged verified model release.

## Message controls

User message:
- Copy
- Edit
- Delete
- highlight text/word → Ask OCADE

Assistant:
- Copy
- Regenerate
- Retry after failure
- Delete
- Helpful / Not helpful
- sources/citations when present

**Ask OCADE on highlight** uses the selected text plus current conversation context. It is not a separately persisted side-conversation product.

## Conversation management

- Search recent conversations.
- Rename.
- Archive only if retained as a simple organization action.
- Permanent Delete after explicit confirmation.
- Do not maintain a separate Trash/restore product if Delete is permanent.
- Export individual conversation when supported.
- Public share links are out of current scope.

## Temporary Chat

Temporary Chat:
- writes no conversation/message history;
- does not automatically add files to Library;
- disappears when the temporary session ends;
- does not enter account memory.

## Offline account work

If a saved chat is created while connectivity is unavailable:
1. answer locally;
2. mark unsynchronized work clearly;
3. place required pending work in the encrypted local reconciliation journal;
4. on reconnect, write exactly once to the account database;
5. retire the local pending record after authoritative success.

## Library

- All / Images / Files filters as actually supported.
- Add/upload.
- Search.
- Generated OCADE outputs may also appear here.
- Temporary attachments enter only after explicit Save.
- File operations have loading, empty, success, error and Retry states.

## Settings

Categories:
- Account
- Appearance
- Notifications
- Data Controls
- Usage & Limits
- Billing
- Advanced

Account: identity methods, MFA, sessions, sign out, delete account.

Data Controls: Offline Intelligence, memory controls, data deletion controls that currently exist.

Usage: plan, remaining uses, reset state, Offline devices.

Billing: current plan and Upgrade explanation; paid plans are not open.

Advanced: current signed-in sessions/device diagnostics only when real.

## Usage exhaustion

Generation locks at zero. History, Library, Settings, Pricing, account controls and non-generation surfaces stay usable. Show exact reset information.

## Admin grant

1. Authorized owner/admin opens hidden Admin.
2. Search server-side for target account.
3. Complete required MFA/AAL2.
4. Choose Pro/Max, duration and reason.
5. Confirm target.
6. Server applies audited expiring entitlement.
7. UI rereads authoritative result.

## Error contract

Every async flow ends in one of:
- success;
- empty;
- actionable error + Retry;
- cancelled;
- real bounded progress.

No indefinite “Loading…”/“Reading…”.

## Responsive contract

Every current capability works at desktop, tablet and phone widths. Mobile uses drawers/stacking instead of shrinking desktop controls into unreadable rows.
