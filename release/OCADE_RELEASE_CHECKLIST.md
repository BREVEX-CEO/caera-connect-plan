# OCADE release checklist

Status: prelaunch web gate deployed; production release externally blocked.

The Cloudflare prelaunch Worker was deployed to `ocade.in` on 15 August 2026.
No package was signed, notarized, published to a store, or installed on a
device. The web application remains closed behind the production launch gate.

## Source gate

1. Confirm branch and intended release commit.
2. Run `npm run typecheck`, `npm run lint`, `npm run test -- --run`, and
   `npm run build`.
3. Run `npm run performance:budget`.
4. Run `npm run release:source-check`.
5. Confirm `/api/health` returns HTTP 200 from the built worker and reports the
   intended version.
6. Review the complete diff and secret scan. Generated build output and local
   environment files must not be committed.

## External release evidence

- Web: run `npm run operations:check` and `npm run deploy:check`, configure
  values in platform secret storage, record the prior verified version, then
  run the separately approved `npm run deploy:web`. Probe `/api/health`,
  authentication, OCADE Chat, Projects, Usage, and error pages. A zero
  deployment exit without the independent versioned health response is not
  success.
- Launch gate: the production Worker must deploy with `OCADE_LAUNCH_READY`
  absent or `false`. Confirm the public origin returns the 503 pre-launch page,
  `/robots.txt` disallows everything, no application bundle is reachable, and
  `/api/health` still answers 200. Set `OCADE_LAUNCH_READY=true` only after the
  runbook readiness gate passes; the edge clock then opens the product at the
  target instant with no further deploy.
- Supabase: follow `supabase/APPLY_ORDER.md`, run every verification file, test
  cross-tenant denial, and regenerate database types.
- Desktop: build on each target OS, sign/notarize, test clean install, updater
  signature refusal, update, forced rollback, crash recovery, and emergency
  stop before enabling the companion adapter.
- Android and iOS: build with external signing identities, validate store
  archives, install on real devices, and prove pairing, biometric approval,
  notification delivery, revocation, offline recovery, and emergency stop.
- Extension: load unpacked for real-browser verification, then sign and publish
  through the Chrome and Edge stores; retest the installed store package.
- Operations: assign every `OWNER_REQUIRED` role in
  `OCADE_PRODUCTION_OPERATIONS.json`, connect health/metrics/alerts, and execute
  both an incident exercise and an isolated database restore drill. Preserve
  the evidence required by the operations contract.

## STOP RELEASE

Stop the release if any source gate fails, a signing identity is missing, a
secret appears in source or build output, a migration or rollback is untested,
an updater key is a placeholder, a capability reports success without runtime
evidence, or any entry in `OCADE_RELEASE_BLOCKERS.json` lacks its required
evidence.
