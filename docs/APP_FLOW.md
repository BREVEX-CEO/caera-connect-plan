# OCADE App Flow

## Primary structure

```text
OCADE
├─ Chat        /
├─ Library     /library
├─ Cowork      /cowork
│  ├─ Cowork mode
│  └─ Jarvis mode
└─ Account
   └─ Settings
```

Recent conversations appear in the same left sidebar. There is no second dashboard/navigation system.

## Public routes

```text
/about
/help
/terms
/privacy
```

No pricing page and no marketing landing-page entry flow.

## Entry

### Signed out

```text
Visit /
→ show Chat shell immediately
→ user can inspect UI/history-empty state
→ user presses Send
→ open authentication
→ successful auth
→ send original pending message once
```

Do not discard or duplicate the pending message.

### Signed in

```text
Visit /
→ restore session
→ Chat
```

Deep links return to the requested authorized destination after authentication.

## Authentication

Primary:

```text
Continue with Google
```

Alternatives:

```text
Email → send 6-digit OTP → verify → Chat
Phone → choose country → enter number → send OTP → verify → Chat
```

Optional password management belongs under Account, not as screen clutter.

## Chat

```text
Chat
→ type / attach / speak
→ usage permit
→ Auto / OCADE / Offline routing
→ stream truthful answer
→ save conversation
→ generated/uploaded files appear in Library
```

When usage is exhausted, generation stops but the user can still browse chats, Library, Settings and Billing.

## Offline Intelligence

```text
first supported visit
→ check deliberate-removal state
→ check OPFS model manifest
   ├─ verified → Ready, no download
   ├─ partial → resume missing chunks
   ├─ corrupt → repair bad chunks
   └─ absent → parallel download
→ verify
→ Ready
```

A new OCADE deployment does not change this flow unless the model revision itself changed incompatibly.

## Library

```text
Library
→ All | Images | Files
→ search
→ open item
→ preview / download / delete
```

Data Controls can delete all uploaded files/images and export account data.

## Settings

Account menu → Settings modal/sheet:

```text
Account
Appearance
Notifications
Data Controls
Billing
Advanced
```

Advanced contains diagnostics/device/runtime detail only when needed.

## Cowork

Owned by `PLAN2.md`.

```text
Cowork
[ Cowork | Jarvis ]
```

Normal mode uses a simple command/task composer. Jarvis is voice/hands-free over the same runtime.

## Removed journeys

Do not route normal customers to standalone Code, Projects, Tasks, Artifacts, Customize, Devices, Search dashboard, old desktop/Copilot or old Jarvis/cinematic pages.
