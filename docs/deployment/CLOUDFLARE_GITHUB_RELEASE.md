# OCADE Cloudflare release from GitHub

**Status:** prepared, not enabled until the required GitHub environment and secrets exist.

GitHub is the source of truth for the web application. Lovable can reflect commits from the connected repository, but Cloudflare production does not publish every edit automatically. Production uses a protected manual workflow so an accidental edit cannot replace the live site.

## One-time setup

In GitHub, create an environment named `cloudflare-production`. Add these environment secrets:

- `CLOUDFLARE_API_TOKEN`: a least-privilege Cloudflare token that can edit the `ocade.in` Worker and zone.
- `CLOUDFLARE_ACCOUNT_ID`: the Cloudflare account identifier.

Keep `OCADE_LAUNCH_READY` and any Supabase values as encrypted Cloudflare Worker secrets or dashboard-managed variables. `wrangler.json` has `keep_vars: true`, so a normal release preserves those dashboard-managed values.

GitHub Actions must also be able to start. A billing or spending-limit block prevents both tests and deployment.

## Releasing a verified main commit

1. Let the `CI` workflow pass on `main`.
2. In Cloudflare, copy the last verified Worker version ID. This is the recovery target if the new release fails.
3. In GitHub Actions, run **Cloudflare production deployment**.
4. Enter `I_APPROVE_OCADE_PRODUCTION_DEPLOY`, the copied recovery version ID,
   and choose `locked` before the launch instant or `open` after it.
5. The workflow rebuilds and reruns the main release gates.
6. The controller uploads an immutable Worker version without changing traffic, attaches it at zero percent, and smoke-tests that exact version through Cloudflare's version-override header.
7. The same staged version must also prove that its real hashed JavaScript entry
   is either fail-closed or launch-open, exactly matching the selected release
   state. This prevents framework or static-asset routing from bypassing the
   edge gate.
8. Only after both staged probes pass does the controller promote it to 100
   percent and independently verify `https://ocade.in/api/health` again.

The health endpoint includes the immutable Cloudflare Worker version ID. A stale deployment with the same package version therefore cannot satisfy the post-deployment check.

This process updates the web Worker. Android, iOS, Windows and macOS packages still require their own build and signing pipelines; they are not rebuilt by a web deployment.

## Launch gate

The deployed Worker remains responsible for the public launch gate. The intended opening instant is 28 August 2026 at 8:28 AM Asia/Kolkata. Before that instant, public routes return the prelaunch response and `noindex`; the health endpoint stays available for monitoring.

The gate is deterministic, but an external outage, an expired domain, a changed secret, a failed deployment or a Cloudflare incident can still prevent availability. A human readiness check should therefore be completed before launch.
