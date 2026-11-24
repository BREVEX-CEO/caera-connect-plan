# AUTH-06 sign-in timing — 24 November 2026

Disposable local Supabase stack (`supabase@2.122.0`, auth server from that release), loopback,
synthetic accounts, `probe.mjs` (12 alternating password sign-ins each, wrong password for an
existing account vs. an unknown account):

```json
{"wrong":56.1,"unknown":2.6,"statuses":[400]}
```

Median milliseconds. The answer text and status are identical (`auth_negative.mjs` AUTH-06), but
the time is not: the auth server checks the password hash only when the account exists. The
browser talks to the auth server directly with the public key, so OCADE's own code cannot pad
this path. Mitigation in this repository: `sign_in_sign_ups = 30` per 5 minutes per IP in
`supabase/config.toml` bounds the probing rate. Remaining (owner/provider): CAPTCHA on sign-in, or
an auth-server release that hashes a dummy password for unknown accounts. Not measured on staging.
