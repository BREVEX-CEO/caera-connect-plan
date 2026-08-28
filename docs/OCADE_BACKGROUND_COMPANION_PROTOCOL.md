# The OCADE Background Companion protocol

What a native OCADE must implement so the website can hand model preparation to
it, and what the website will and will not trust it with.

## Why this exists

A browser tab cannot promise to keep downloading. Background Fetch is the one
web API that survives the tab closing and it exists in Chromium only; everywhere
else OCADE persists a checkpoint and resumes on the next visit. That is honest,
and it is worse than what an operating system does routinely:

| Platform                | Mechanism the companion should use                            |
| ----------------------- | ------------------------------------------------------------- |
| Android                 | `WorkManager` with a foreground service, or `DownloadManager` |
| iOS                     | `URLSession` with a background configuration                  |
| Windows / macOS / Linux | An ordinary long-lived process (the Tauri companion)          |

When a trusted companion is present, "we will resume when you come back" becomes
"it will be there when you come back". That is the whole of the benefit, and it
is why a companion that _cannot_ transfer in the background is deliberately not
used — see `backgroundTransfer` below.

## The four rules the website enforces

These are implemented in `src/lib/brain/background-bridge.ts` and covered by
`background-bridge.test.ts` and `installation-authority.test.ts`.

1. **Never two downloads of the same model.** Handoff transfers _ownership_. The
   installation authority returns without starting its own transfer, so the
   browser and the companion never both move the same bytes.
2. **One canonical identity.** The companion is told the exact `version`,
   `sha256` and `totalBytes` from OCADE's committed catalogue. "The native app
   already has a model" is not the same claim as "it has this model".
3. **Verification belongs to OCADE.** The companion reports a digest; the
   website compares it to the published one before anything is activated. A
   native process is more trusted than a CDN and is still not the authority.
4. **Uninstall reaches it.** Removing OCADE Intelligence removes what the
   companion holds, or the message is false on exactly the devices storing the
   most.

## Trust model

The companion listens on **loopback only** — `127.0.0.1:11801`. No remote
attacker can bind that; any other process on the same machine can. So:

- The website checks `product`, `protocol` and `backgroundTransfer` on every
  discovery, and treats anything unfamiliar as _absent_ rather than negotiating.
- The website does **not** send the desktop pairing secret. That secret is
  documented as never leaving the device, and handing it to an unauthenticated
  local listener would break that invariant to defend against a threat it does
  not address. The protocol carries an `x-ocade-pairing` header for a dedicated
  companion token when one exists.
- The real defence is rule 3: an artifact is held to its published digest on
  return, so a hostile listener that claims to have prepared the model is caught
  by exactly the check a hostile CDN is.

Every request carries `x-ocade-client: web` and `x-ocade-protocol: 1`.

## Endpoints

### `GET /ocade/companion/identity`

```json
{
  "product": "ocade-companion",
  "protocol": 1,
  "platform": "android",
  "backgroundTransfer": true
}
```

`backgroundTransfer` must be the truth about **this install**, not about the
platform in general. An iOS build without the background-transfer entitlement,
or an Android build denied battery exemption, must report `false` — the website
will then keep the work rather than hand it somewhere it will stall.

Must answer within ~1.5 s. The website treats a slow companion as an absent one,
because this probe sits on the path to first paint.

### `POST /ocade/companion/prepare`

```json
{
  "protocol": 1,
  "version": "qwen2.5-1.5b-instruct-q4_k_m",
  "sha256": "<64 hex characters>",
  "totalBytes": 1117320736,
  "sources": ["https://models.ocade.in/models/<version>/<file>", "..."]
}
```

Answer `{ "jobId": "..." }`. The `sources` array is OCADE's own ordered ladder;
work it in order and fail over the same way rather than substituting a source of
your own. Requests must be resumable (HTTP `Range`), and a job for a `version`
already in progress must return the **existing** `jobId` rather than starting a
second transfer.

### `GET /ocade/companion/progress/{jobId}`

```json
{
  "phase": "downloading",
  "version": "qwen2.5-1.5b-instruct-q4_k_m",
  "receivedBytes": 402653184,
  "totalBytes": 1117320736,
  "sha256": "<only once complete>",
  "artifactUrl": "<only once complete>"
}
```

`phase` is one of `idle`, `downloading`, `verifying`, `complete`, `failed`,
`cancelled`. Report `sha256` only when the artifact is finished and hashed — a
digest reported early will be compared against the published one and rejected.

### `POST /ocade/companion/cancel/{jobId}`

Stop the transfer, keep whatever is on disk resumable. Used when the user pauses
or the browser takes the work back.

### `POST /ocade/companion/uninstall`

Delete the model artifacts, any partial transfers and the metadata beside them.
Answer non-2xx if it could not be done — the website reports that honestly
rather than claiming a removal that did not happen.

**Do not delete** conversations, account data or unrelated app storage. "Remove
OCADE Intelligence" and "delete my account" are different requests.

## Implementation status

| Piece                                                                    | State                                                        |
| ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Web-side protocol, discovery, handoff, progress, verification, uninstall | Implemented, `background-bridge.ts`                          |
| Authority integration — exclusivity, activation only after digest match  | Implemented, `installation-authority.ts`                     |
| Test coverage of all four rules                                          | Implemented, 27 + 8 tests                                    |
| Android `WorkManager` companion                                          | **Not implemented.** Contract above is what it must satisfy. |
| iOS background `URLSession` companion                                    | **Not implemented.**                                         |
| Desktop companion endpoints in the Tauri build                           | **Not implemented.**                                         |

The website behaves correctly on a device with no companion — which is every
device today — by falling through to its own transfer. Nothing in the shipped
product claims a native handoff is happening unless a companion actually
answered.
