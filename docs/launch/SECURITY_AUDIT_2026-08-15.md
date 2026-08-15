# OCADE Security and Compliance Audit — 15 August 2026

**Method:** read-only source inspection, live Supabase metadata inspection, clean
dependency install, build/typecheck and private Lovable preview observation.

## Confirmed controls

- GitHub repository and Lovable project are private; Lovable is unpublished.
- All 60 inspected public Supabase tables have RLS enabled and at least one policy.
- `messenger` object bucket is private and storage policies are present.
- Chat endpoint verifies a Supabase bearer token and conversation ownership.
- Chat endpoint validates JSON, content size, attachment count/type/size and
  enforces privacy mode plus cloud entitlement/allowance.
- Native bridge is disabled by default and includes signed-request, origin,
  replay and rate policy.
- No committed live `.env` or obvious credential value was found in the static
  pattern scan; dependency install reported zero known npm vulnerabilities.
- Failure telemetry is opt-in and no advertising/third-party analytics SDK was found.

## Gaps and blockers

- The current Lovable preview shows a load failure despite a successful clean
  build/typecheck. Prior preview history identifies missing Supabase environment
  bindings as a recurring cause. The new source guard preserves public pages and
  fails auth closed, but production bindings still require live verification.
- The private `messenger` bucket has no explicit file-size or MIME allowlist.
  Design a migration from actual required file types, test it, then apply with
  explicit approval; do not guess and break uploads.
- The AI chat route has allowance enforcement but no independently verified
  production-grade burst/abuse limiter. Use Cloudflare and/or an atomic
  account-side limiter; an in-memory serverless counter is not sufficient.
- Authenticated lookup policies with broad authenticated reads need a data-class
  review to prove they contain no personal/private content.
- A two-account RLS/storage isolation test against staging has not been retained.
- No complete provider register, retention schedule, deletion/backups proof,
  live rights backend, age/children control or breach exercise exists.
- Desktop signing/notarization/update proof and mobile store signing/privacy
  declarations are absent or unverified. The Tauri bundle still identifies as
  “CAERA Companion” and lacks configured signing identities.
- Current PWA manifest has only a 48×48 favicon, not the usual 192/512 install
  icon set. Offline shell is not proof all functionality works offline.
- Payment code is an entitlement/provider abstraction and tests, not a live
  Stripe/Razorpay/PayPal checkout.
- Canonical URL and social-share image remain intentionally unset until the
  owner controls the final domain and approved artwork.

## Safe changes in this branch

- corrected product/privacy/licence claims;
- added public company/founder/product pages and honest pre-launch structured data;
- added origin-aware robots and sitemap endpoints;
- linked legal pages from landing/sign-in;
- added Privacy, Terms, DPDP, breach and rights-process drafts;
- added missing-Supabase configuration detection so public pages stay available
  while authentication remains disabled; and
- removed browser-reachable references to Node-only `process` and `Buffer`
  globals from the local-runtime server function; and
- avoided live database, deployment, payment, account and publication changes.
