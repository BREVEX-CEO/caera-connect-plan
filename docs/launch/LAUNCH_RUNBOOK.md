# OCADE Launch Runbook - 28 August 2026

**Target:** 08:28 IST (02:58 UTC)

**Public SEO date:** 28 August 2026 only; do not publish the time in metadata
**Rule:** the clock does not turn a failed deployment into a launch

## Launch mechanism

Deploy and verify the production site early, behind the edge launch gate. Do not
schedule DNS registration or the first production deploy for the launch minute;
DNS, builds, caches and app-store review are not exact-time systems.

The gate lives in the Cloudflare Worker (`src/server.ts`), before the application
is imported and before static application assets can be served
(`assets.run_worker_first = true`).

OCADE has launched, so the gate now opens whenever server/edge time is at or
after `LAUNCH_AT_ISO` in `src/lib/launch/launch-window.ts`. The Cloudflare
Worker variable `OCADE_LAUNCH_READY` no longer arms it — it can only CLOSE it,
and only when set to exactly `false`. A variable that is missing, empty or
misspelt leaves a live product serving, which is the only safe direction for a
flag to fail in once people are using the thing.

While locked, public requests get a minimal 503 prelaunch page saying only
"Planned launch 28 August 2026", with `Cache-Control: no-store`, `Retry-After`
and `X-Robots-Tag: noindex, nofollow, noarchive`; `/robots.txt` returns
disallow-all and the sitemap is not served. `/api/health` stays available for
deployment verification and never reports the launch time. Local development
and approved internal preview hosts stay fully testable.

Once readiness is set, no further deploy, DNS change, cron job or client-side
countdown is required: the server clock opens the gate at the target instant. An
unready release stays locked rather than launching broken.

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
- Confirm app-store states; say "coming later" for every unavailable platform.
- Rehearse rollback and keep the prior known-good production version.

## T-30 minutes

- Incident, privacy, support and deployment owners online.
- No active severity-one/two issue; monitoring and logs healthy.
- Domain resolves from multiple networks; production page and downloads open.
- Payment receipt/refund and entitlement reconciliation verified if live.
- Final visible copy still says "planned"; the prelaunch response is no-index and
  no indexed page says "launched."
- Leave `OCADE_LAUNCH_READY` unset or `true`. Set it to exactly `false` only to
  re-lock a launched product.

## Emergency re-lock

`OCADE_LAUNCH_READY` is a re-lock, not an arming switch. Set it to exactly
`false` on the production Worker and the gate closes on the next request with no
code deploy; remove it or set any other value and the product serves again.

Nothing else closes a launched gate, and nothing else needs to: the clock has
already passed the launch instant and cannot un-pass it. Record exact operator,
time, commit/deployment ID and reason for every re-lock, and lift it the same
way once the cause is fixed.

## After launch

- Watch auth, errors, latency, entitlement, payment and support for four hours.
- Request Search Console indexing and submit the sitemap.
- Verify directory links and correct any unsupported claims.
- At 24 hours, review incidents, refunds, privacy requests and capacity.
- Preserve the launch receipt; update structured data with the date only after
  the production service genuinely launched.
