# OCADE Launch Runbook — 28 August 2026

**Target:** 08:28 IST (02:58 UTC)

**Public SEO date:** 28 August 2026 only; do not publish the time in metadata
**Rule:** the clock does not turn a failed deployment into a launch

## Launch mechanism

Deploy and verify the production site before launch. The server entry checks a
fixed launch instant (`2026-08-28T02:58:00.000Z`) on every public request and
fails closed until `OCADE_LAUNCH_READY` is exactly `true`. Before then it returns
a no-store, no-index planned-launch page, blocks application APIs and serves a
`Disallow: /` robots policy. `/api/health` remains available for independent
deployment verification. Cloudflare static assets use `run_worker_first`, so a
direct asset URL cannot bypass the server gate.

Do not schedule DNS registration or the first production deploy for 08:28; DNS,
builds, caches and app-store review are not exact-time systems. Set the readiness
flag only after the gate below is green. The clock then opens the already-running
release on the first request at or after 08:28 IST without a DNS or deployment
change. If readiness remains false, the service remains closed after the planned
time rather than launching a failed release.

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
- Final visible copy still says “planned”; the prelaunch response is no-index and
  no indexed page says “launched.”
- Set Cloudflare Worker variable `OCADE_LAUNCH_READY=true` only when every
  required check is green. Keep it `false` otherwise.

## 08:28 IST gate

If all required checks were independently green and the readiness flag is true,
the server gate opens automatically at 08:28 IST. Verify the public response,
then change visible copy to “launched on 28 August 2026,” release only verified
download/payment links and submit prepared directory posts. Record exact
operator, time, commit/deployment ID and screenshots. If a required gate is red,
keep readiness false, retain “planned/delayed” copy and announce a factual delay;
do not backdate the launch later.

## After launch

- Watch auth, errors, latency, entitlement, payment and support for four hours.
- Request Search Console indexing and submit the sitemap.
- Verify directory links and correct any unsupported claims.
- At 24 hours, review incidents, refunds, privacy requests and capacity.
- Preserve the launch receipt; update structured data with the date only after
  the production service genuinely launched.
