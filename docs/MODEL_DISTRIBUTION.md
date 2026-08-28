# Distributing OCADE's local intelligence

How the engine artifact reaches a device, why the pipeline is shaped this way,
and what an operator has to do to make a first run fast.

## The problem this shape solves

A first run has to move a gigabyte-class artifact onto a device before OCADE can
answer anything. Three things about that were wrong before:

1. **One third-party host was load-bearing.** The catalogue pointed at the
   publisher's URL and that was the only source. A corporate egress policy, a
   regional outage or a rate limit at that host was an OCADE outage, on the one
   screen where a visitor decides whether the product works.
2. **One connection carried it.** A single stream leaves most of a fast link
   unused and turns any interruption into lost progress.
3. **Nothing was resumable in a useful sense.** Progress was bytes on disk with
   no verification state beside them, so a resume still had to re-read
   everything to check it.

## The source ladder

`sourceLadder()` in `src/lib/brain/download-plan.ts` orders three sources, best
first. Every one of them is held to the **same committed SHA-256** — failover
changes where bytes come from and never whether they are checked, so a
misconfigured or hostile mirror cannot promote itself into the active model. It
can only fail.

| Order | Source | When it exists |
| --- | --- | --- |
| 1 | `ocade_cdn` | `VITE_OCADE_MODEL_CDN` is set |
| 2 | `same_origin` | the operator dropped the file into `public/models/` |
| 3 | `publisher` | always — this is what keeps a plain deployment working |

A deployment that configures nothing still works. That is deliberate: the CDN is
an optimisation, not a dependency, and a configuration mistake must not be able
to break first run.

## Configuring OCADE's own distribution

Set one environment variable at build time:

```
VITE_OCADE_MODEL_CDN=https://models.example-cdn.net
```

It must be `https` and absolute; anything else is ignored rather than used,
because a relative or plain-http value here would silently downgrade every first
run. The artifact is then expected at:

```
<base>/models/<version>/<artifact-file-name>
```

`<version>` is the tier's immutable identity from
`release/OCADE_BROWSER_MODEL_CATALOGUE.json`. Because the version is in the path,
**a different engine is a different URL**, which is what makes the next section
safe.

### Object storage layout (R2 or equivalent)

```
models/
  qwen2.5-1.5b-instruct-q4_k_m/
    qwen2.5-1.5b-instruct-q4_k_m.gguf
```

Upload the exact file the catalogue's digest was taken from. `npm run
model:distribution-check` verifies a local mirror's size and digest against the
committed catalogue and fails if they have drifted.

### Required response headers

| Header | Value | Why |
| --- | --- | --- |
| `cache-control` | `public, max-age=31536000, immutable` | The path carries the version, so a cached copy cannot be stale. A change produces a new URL. |
| `accept-ranges` | `bytes` | Resumability. Without it the transfer falls back to a whole-file stream, which works and loses an interrupted transfer's progress. |
| `access-control-allow-origin` | the site origin, or `*` | The transfer is a cross-origin `fetch`. |
| `access-control-expose-headers` | `content-range, content-length, accept-ranges` | The transfer reads `content-range` to discover the total size. |

`etag` and `content-encoding` are best left alone. The artifact is already
compressed; re-encoding it costs CPU at the edge and changes nothing on the
wire.

Range support is not optional in practice. `transferModel` asks for ranges,
detects a `200` as "this server ignores Range", and restarts sequentially — the
correct behaviour, and it throws away whatever an earlier attempt had. A
deployment serving its own weights should never be the reason that path is
taken.

### Self-hosted on this origin

Dropping the `.gguf` into `public/models/` gives an air-gapped or
egress-restricted install a first run with **no external request at all**.
`src/cloudflare-entry.ts` adds the immutable cache header and asserts
`accept-ranges` for anything under `/models/`.

## What the client does with it

- **Chunks, not a stream.** `planTransfer()` sizes chunks and picks a starting
  concurrency from what the device says about itself; `adaptConcurrency()` then
  moves it based on measured throughput, because the device's self-description
  is a guess and bytes per second is evidence.
- **Cellular is allowed.** A mobile connection gets fewer connections and
  smaller chunks. It never gets a postponement: the local engine is what makes
  OCADE work offline later, so refusing to prepare it would spend the user's
  time on nothing. `saveData` narrows the transfer further — restraint, not
  refusal.
- **Hashing happens during the download.** Chunks are fed to a running SHA-256
  in order as they land, so when the last byte arrives the digest is already
  computed. Nothing is ever re-read and the largest allocation is one chunk.
- **Checkpoints are cheap and honest.** The running digest is written down at
  chunk boundaries, so an interrupted transfer resumes hashing where it stopped
  rather than re-reading what is already on disk.

## Upgrades and rollback

Storage is versioned with a pointer (`src/lib/brain/model-vault.ts`):

```
activation = write the pointer          (one atomic write)
rollback   = write the pointer back     (one atomic write)
staging    = any version not pointed at (no special state)
```

A new version downloads into its own directory while the proven one keeps
answering. Nothing is copied or moved to promote a candidate, which is what
makes promotion genuinely atomic rather than "atomic if the copy finishes". A
candidate that fails verification is simply never pointed at, and one generation
behind the active version is kept so a bad upgrade has somewhere to fall back to.

## Background Fetch

Where the browser supports it, the transfer can be handed to the browser and
genuinely continues with the tab closed. Where it does not, **OCADE does not
claim it does** — validated progress is persisted and resumed on the next visit.
See `src/lib/brain/background-fetch.ts`.

The service worker writes the completed bytes into the same OPFS location and
deliberately does not hash them; the page verifies before anything is activated.
Verification exists in exactly one place.

## Measuring it

`src/lib/brain/install-telemetry.ts` records time to device check, download
throughput, retry and resume counts, verification time, load time and time to
ready — with no free-text field on any event, so there is nowhere for a prompt,
a conversation or a user identifier to be put. It stays on the device unless
something is explicitly wired to send it.
