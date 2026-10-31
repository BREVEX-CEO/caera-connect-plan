# Architecture readiness evidence — 31 October 2026

Branch `ocade/p00-p22-implementation`. Ledger: `architecture-ledger.md` / `.json`, generated and
validated by `node scripts/jarvis-traceability.mjs --write evidence/2026-10-31-architecture`.

**Verdict: ARCHITECTURE NOT READY (G12 no-go).** 46 PASS, 25 PARTIAL, 3 FAIL, 8 BLOCKED, 2 UNTESTED of 84.
Per plan.md §5, no customer acceptance task (3D car, 30-second ad) was run.

## Staging checks (live)

- Credentials: the session's service-role key works against project `auyapercxxptziyngycx` (PostgREST RPC);
  an RPC without a key is refused (401).
- Migration `20261030120000`: functions callable, timing columns present (24 functions previously matched
  the repo file line for line).
- Real UI (`ui/`): local web server against staging, synthetic account `ocade-jarvis-test@example.com`:
  sign in (01), JARVIS page (02), pair this computer's companion by its code (03), grant file access (04),
  send a request (05). The request ends with "JARVIS's online planner is unavailable right now. Nothing was
  started." Both attempts acquired a JARVIS usage permit and released it (`ocade_generation_permits`:
  2 × released), so nothing was charged.

## Why live Gemini (G9) is blocked

The deployed `ocade-intelligence-service` authenticates the server by **exact string match** of the
`apikey` header against the keys injected into the function (`SUPABASE_SECRET_KEYS`, `SUPABASE_SECRET_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`). The request body passed validation; the identity step answered
`authentication_required` (health log `errorClass: auth`, `providerSlot: none`). The session's key is the
project's legacy service-role JWT (same `iat` as the dashboard anon key) and is valid for PostgREST, so the
function's injected key list does not contain this exact string — most likely it holds the new `sb_secret_…`
keys. No Gemini request was sent; spend ₹0.

Fix, either:
1. put the project's **secret key** (`sb_secret_…`, Project Settings → API Keys) in this environment's
   `SUPABASE_SERVICE_ROLE_KEY` secret and start a new session (the server client accepts that format), or
2. approve redeploying the service with a check that verifies service-role credentials cryptographically.
