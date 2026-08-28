# OCADE browser model weights

`sameOriginGgufUrl()` in `src/lib/brain/browser-catalogue.ts` looks for a tier's
weights at `/models/<path>` before falling back to the publisher's URL, and
`preferredWeightsUrl()` probes this location first. Putting the reviewed file
here is what makes a first launch independent of another company being
reachable.

## Why the file is not committed

The production tier is `qwen2.5-0.5b-instruct-q4_k_m.gguf`, 491,400,032 bytes.
Git is the wrong place for half a gigabyte of binary that never changes: it
would be cloned by everyone who touches the repository and re-uploaded on every
mirror.

Licensing is not the obstacle. Qwen2.5-0.5B-Instruct is Apache-2.0, which
permits redistribution, so OCADE may serve it from its own origin provided the
licence and attribution travel with it.

## Deploying it

Fetch the exact file named in `release/OCADE_BROWSER_MODEL_CATALOGUE.json`,
verify it against the `sha256` recorded there, and place it in this directory
before building — or serve it from a CDN path that answers on this origin.

The host must support HTTP range requests. `model-download.ts` resumes from the
bytes already on disk with `Range: bytes=<n>-`, and a host that ignores the
header makes every interrupted download start again from zero. It should also
send `content-length`, immutable caching (the filename carries the version, so
the bytes at a path never change), and `application/octet-stream`.

Nothing here is loaded by the JavaScript bundle. The weights are fetched at
runtime and stored in OPFS, so they never enter a build artefact.
