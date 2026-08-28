# Provisioning models.ocade.in

The remaining steps to put OCADE's engine on OCADE-controlled distribution.
Everything in the application is finished and verified; what is left needs
Cloudflare credentials, which this repository does not and should not hold.

## Status, stated plainly

| Piece                                                                                   | State                                                   |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Client source ladder — CDN, then this origin, then the publisher                        | **Done.** `download-plan.ts`, `installation-browser.ts` |
| Versioned immutable paths, Range, chunked parallel transfer, resume, incremental digest | **Done.** `model-transfer.ts`                           |
| Immutable cache headers and `accept-ranges` for self-hosted artifacts                   | **Done.** `cloudflare-entry.ts`                         |
| Verification command that proves a real origin                                          | **Done.** `npm run model:cdn-verify`                    |
| R2 bucket `ocade-models`                                                                | **Not provisioned.** Needs credentials.                 |
| Custom domain `models.ocade.in`                                                         | **Not provisioned.** Needs DNS + Cloudflare.            |
| Artifact uploaded                                                                       | **Not uploaded.** 1,117,320,736 bytes.                  |
| `VITE_OCADE_MODEL_CDN` set in the production environment                                | **Not set.**                                            |

Until those four are done the product works: the source ladder falls back to
the publisher, and `npm run model:cdn-verify` reports "not configured" and exits
0 rather than pretending otherwise.

## What to create

### 1. The bucket

```
Cloudflare dashboard → R2 → Create bucket
  Name:     ocade-models
  Location: Automatic
```

### 2. The object

The artifact is the exact file the committed catalogue's digest was taken from —
`release/OCADE_BROWSER_MODEL_CATALOGUE.json`. Upload it to the versioned path,
because **the version in the path is what makes immutable caching safe**:

```
models/qwen2.5-1.5b-instruct-q4_k_m/qwen2.5-1.5b-instruct-q4_k_m.gguf
```

```bash
# Confirm the bytes first. A file that does not match the committed digest will
# be downloaded in full by every visitor and then deleted, which is the most
# expensive failure in the whole system.
sha256sum qwen2.5-1.5b-instruct-q4_k_m.gguf
# expect 6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e

npx wrangler r2 object put \
  ocade-models/models/qwen2.5-1.5b-instruct-q4_k_m/qwen2.5-1.5b-instruct-q4_k_m.gguf \
  --file ./qwen2.5-1.5b-instruct-q4_k_m.gguf \
  --content-type application/octet-stream \
  --cache-control "public, max-age=31536000, immutable"
```

**Never replace an object in place.** A new engine is a new `version`, and
therefore a new path. Replacing the bytes behind an immutably-cached URL leaves
some visitors on the old file and some on the new, with one of the two failing
its digest.

### 3. The domain

```
R2 → ocade-models → Settings → Custom Domains → Connect Domain
  models.ocade.in
```

Cloudflare creates the DNS record and terminates TLS. HTTP/2 and HTTP/3 are on
by default; nothing to configure.

### 4. CORS

R2 → `ocade-models` → Settings → CORS Policy:

```json
[
  {
    "AllowedOrigins": ["https://ocade.in", "https://www.ocade.in"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["range"],
    "ExposeHeaders": ["content-range", "content-length", "accept-ranges", "etag"],
    "MaxAgeSeconds": 86400
  }
]
```

`ExposeHeaders` matters more than it looks: the client reads `content-range` to
discover the artifact's total size. Without it the transfer cannot plan its
chunks.

### 5. Point the build at it

```
VITE_OCADE_MODEL_CDN=https://models.ocade.in
```

Cloudflare Pages/Workers → Settings → Environment variables, **Production**.
It must be `https` and absolute; the client refuses anything else rather than
silently downgrading first run.

### 6. Prove it

```bash
npm run model:cdn-verify -- --base https://models.ocade.in
```

This is not a formality. It checks the things that are each independently
wrong on a fresh bucket:

- the origin answers, and the size matches the committed catalogue;
- `cache-control` is immutable with a long max-age;
- `accept-ranges: bytes` is advertised **and** a ranged request really returns
  206 — a proxy that advertises ranges and answers 200 is a real configuration,
  and the one that turns every interruption into a restart;
- CORS allows the site and exposes `content-range`;
- four concurrent ranges return correct lengths and reassemble in order;
- a read starting mid-file works, which is what a resume is.

`npm run model:cdn-verify -- --write` records the result to
`release/OCADE_MODEL_CDN_VERIFICATION.json`.

## Costs

R2 has no egress fee, which is the reason to use it here: the artifact is ~1.1
GB and a popular first-run week is measured in terabytes.

|                  |                                                             |
| ---------------- | ----------------------------------------------------------- |
| Storage          | $0.015 / GB-month → about **$0.017/month** for one artifact |
| Class A (writes) | negligible; one upload per engine version                   |
| Class B (reads)  | $0.36 per million; one first run is a few hundred requests  |
| Egress           | **$0**                                                      |

## What is deliberately not automated

No credentials are committed, and no script in this repository creates buckets,
DNS records or environment variables. Provisioning production infrastructure is
an operator action with an audit trail attached to a person, and a repository
that could do it silently is a repository whose compromise provisions
infrastructure silently.
