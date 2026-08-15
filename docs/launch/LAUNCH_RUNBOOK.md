# OCADE Launch Runbook — 28 August 2026

**Target:** 08:28 IST (02:58 UTC)

**Public SEO date:** 28 August 2026 only; do not publish the time in metadata
**Rule:** the clock does not turn a failed deployment into a launch

## Launch mechanism

Deploy and verify the production site early, behind the edge launch gate. Do not
schedule DNS registration or the first production deploy for the launch minute;
DNS, builds, caches and app-store review are not exact-time systems.

The gate lives in the Cloudflare Worker (`src/server.ts`), before the
application is imported and before static application assets can be served
(`assets.run_worker_first = true`). It opens only when BOTH hold:

1. Server/edge time is at or after `LAUNCH_AT_ISO` in
   `src/lib/launch/launch-window.ts`.
2. The Cloudflare Worker secret/var `OCADE_LAUNCH_READY` is exactly `true`,
   set by a named operator after the real checks below pass.

While locked, public requests get a minimal 503 pre-launch page saying only
“Planned launch 28 August 2026”, with `Cache-Control: no-store`,
`Retry-After` and `X-Robots-Tag: noindex, nofollow, noarchive`; `/robots.txt`
returns disallow-all and the sitemap is not served. `/api/health` stays
available for deployment verification and never reports the launch time.
Local development and approved internal preview hosts stay fully testable.

Once readiness is set, no further deploy, DNS change, cron job or client-side
countdown is required: the server clock opens the gate at the target instant.
An unready release stays locked rather than launching broken; the clock never
turns a failed deployment into a launch.

## T-7 days

- Domain, DNSSEC, MFA, support/privacy/security email and recovery verified.
- Company/provider and legal notices approved.
- Payment provider/store scope frozen; unsupported platforms removed from copy.
- Production RLS/storage isolation and rate limiting tested with two accounts.
- Signed installers/store builds installed on clean real devices.
- Backups, deletion, rollback, monitoring and breach contacts exercised.
- Product Hunt/directory drafts and assets prepared but not falsely published.

## T-24 hours

- Freeze release candidate commit and record its hash.
- Deploy production candidate and run a real sign-up, local mode, Private Sync,
  cloud consent, export/delete, payment sandbox/live-smoke as applicable.
- Verify privacy/terms/refund/support/account deletion from an incognito browser.
- Verify robots, sitemap, HTTPS, canonical URL, structured data and social image.
- Confirm app-store states; say “coming later” for every unavailable platform.
- Rehearse rollback and keep the prior known-good production version.

## T-30 minutes

- Incident, privacy, support and deployment owners online.
- No active severity-one/two issue; monitoring and logs healthy.
- Domain resolves from multiple networks; production page and downloads open.
- Payment receipt/refund and entitlement reconciliation verified if live.
- Final visible copy still says “planned”; no indexed page says “launched.”

## 08:28 IST gate

Proceed only if all required checks are independently green. Change visible copy
to “launched on 28 August 2026,” release the verified download/payment links and
submit prepared directory posts. Record exact operator, time, commit/deployment
ID and screenshots. If a required gate is red, keep “planned/delayed” copy and
announce a factual delay; do not backdate the launch later.

## After launch

- Watch auth, errors, latency, entitlement, payment and support for four hours.
- Request Search Console indexing and submit the sitemap.
- Verify directory links and correct any unsupported claims.
- At 24 hours, review incidents, refunds, privacy requests and capacity.
- Preserve the launch receipt; update structured data with the date only after
  the production service genuinely launched.
