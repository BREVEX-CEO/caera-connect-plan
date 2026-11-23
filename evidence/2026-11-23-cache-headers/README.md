# Cache headers on authenticated responses (TENANT-05), 23 November 2026

Local CI-shaped build served by `wrangler dev --local` (see `../2026-11-23-accessibility/`), each
path requested with `curl -D -`; output in `cache-headers.txt`.

| Response | Carries tenant data | Cache-Control seen |
| --- | --- | --- |
| `/_serverFn/*` (every server function, GET and POST) | yes | `private, no-store`, forced by `withPublicSecurityHeaders` even over a handler's own public TTL (`tests/security/csp.test.ts`) |
| `POST /api/jarvis/device` (companion door) | yes | `no-store` |
| Chat stream and JSON (`src/lib/intelligence/edge-handler.ts`) | yes | `no-store` / `no-store, no-transform` (source) |
| `/api/offline/bytes/$release` | the public model release, only after an entitlement check | `private, max-age=31536000, immutable` (source) |
| HTML pages such as `/` and `/library` | no: the session lives in the browser and pages fetch data through server functions | none; Cloudflare does not cache HTML without an explicit rule |

`GET /api/jarvis/device` answers 405 with no body data.
