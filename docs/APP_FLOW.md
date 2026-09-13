# OCADE App Flow

## Signed-out entry

```text
ocade.in
→ Chat shell loads
→ user may inspect Chat/Pricing/About/Help/Terms/Privacy
→ Send or account-only action
→ /auth
```

## Sign-in

Primary choices:

```text
Continue with Google
or
Email → 6-digit OTP
or
Phone → country picker → 6-digit OTP
```

After successful authentication:

```text
restore intended destination
→ load account usage/entitlement
→ if Offline Intelligence is absent and the user has NOT intentionally uninstalled it and Internet exists
   → begin background preparation automatically
→ Chat is immediately usable online while preparation continues
```

## Chat routing

```text
User sends
→ validate auth
→ validate attachment/input
→ acquire one account-wide usage permit
→ choose route
```

### Auto / normal OCADE

```text
Internet + online OCADE healthy
→ online OCADE

online OCADE fails before output + Offline ready
→ Offline Intelligence fallback

no Internet + Offline ready
→ Offline Intelligence

no Internet + Offline absent
→ explain install/connect-once requirement
```

Exactly one successful answer consumes one use.

### Offline mode

```text
Offline selected
→ zero provider traffic
→ valid local allowance lease required
→ local runtime
→ successful answer
→ local usage event
→ reconcile later when Internet returns
```

## Images and documents

```text
Image + Internet
→ online OCADE

Image + no Internet
→ clear refusal: image understanding needs online OCADE

Typed/pasted text
→ online or offline depending selected route

Textual file offline
→ extract locally only if format is safely supported
→ otherwise require online OCADE
```

## New Chat

```text
New chat clicked
→ reset visible transcript/composer immediately
→ do NOT create empty DB conversation
→ first real Send
→ create/persist conversation
```

## Attachments

```text
+ / drag-drop / paste
→ validate type/size
→ preview chip
→ upload progress when cloud upload is required
→ user may remove/reorder before Send
→ retry failed upload
```

Maximum: 100 MB per intentionally supported attachment, subject to a bounded total-message limit.

## Usage exhaustion

```text
remaining = 0
→ block Auto/OCADE/Offline generation
→ show reset countdown + Upgrade
→ history remains readable
→ Library remains usable
→ Pricing/Billing/Settings remain usable
```

## Pricing and upgrade

```text
/pricing
→ Free / Pro / Max
→ weekly/monthly toggle
→ regional currency + manual override
→ Upgrade
→ Internet required
→ checkout
→ payment confirmation
→ subscription/entitlement
→ allowance updates
```

No payment is processed or queued offline.

## Manual access grant

```text
Hidden Admin
→ search user by email/id
→ view entitlement
→ grant Free/Pro/Max
→ optional start/end
→ reason
→ save
→ entitlement resolver updates account tier
```

Revoke follows the same authority. Auth users are never edited directly.

## Offline model preparation

### First normal install

```text
signed in
+ Internet
+ model absent
+ no user_uninstalled flag
→ background preparation starts automatically
→ progress shown near Account/sidebar
→ user can keep using online Chat
```

### Intentional uninstall

```text
user chooses Remove Offline Intelligence
→ delete local model artifacts
→ set user_uninstalled
→ no automatic reinstall on deploy/update/restart/sign-in
→ show:
   “You uninstalled OCADE Offline. Get it back for offline mode.”
   [Install Offline]
```

Only explicit Install clears the suppression.

### Offline but never installed

```text
no Internet + no model
→ show connect-once explanation
→ keep Install button/request visible
→ remember request
→ when Internet returns, start installation
```

## Download flow

```text
private OCADE model endpoint
→ authorised opaque shard manifest
→ adaptive parallel shard download
→ persist every completed shard immediately
→ verify each shard
→ resume after interruption/restart
→ repair only corrupt/missing shards
→ atomic activation in OPFS
→ Ready
```

## Whole-site offline

```text
Internet disappears
→ cached OCADE shell still opens
→ local-capable pages render
→ Offline Chat works when model ready
→ cached/local history/Library content available where intentionally stored
→ Pricing/About/Help/Terms/Privacy load from cache
→ cloud-only actions say Internet required
```

## Cowork

Cowork is not implemented during this mission.

If visible:

```text
Cowork
→ clean unavailable placeholder
```

No hidden Cowork runtime work is allowed before the owner starts a future mission.
