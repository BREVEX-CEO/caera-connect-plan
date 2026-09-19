# OCADE — current mission state

## 1. The fifteen-finding audit is closed

Every finding in the read-only audit taken from `main` at
`bd1e4f6d2c4c3131afb074ec4658d1a653c2fb1f` has been reproduced where it could
safely be reproduced, repaired at its root, and covered by a regression that
would have failed on the old behaviour.

| ID | What was wrong | Where it was fixed | What proves it |
| -- | -------------- | ------------------ | -------------- |
| C1 | `http://ocade.in/`, `/auth` and `/library` answered 200 with the application over plain HTTP: the `www` redirect changed only the hostname and preserved the scheme. | `canonicalOriginRedirect` owns scheme and host together, and decides from the edge's own `cf-visitor` / `cf-ray` rather than from a URL `wrangler dev` rewrites. | `one-canonical-origin.test.ts` — nine checks including the plain-HTTP upgrade and the local-development loop it caused. |
| M1 | `authenticated` held INSERT/UPDATE/DELETE on `devices` and `browser_grants`; RLS cannot restrict which COLUMNS a permitted row may change, so an account could clear its own revoked row's `revoked_at` and re-admit a removed browser. | `20260920090000` — write grants revoked, both policies SELECT-only, removal restored to SECURITY DEFINER because it is now the only way to remove a device. | `device-registration-against-postgres.test.ts` — the un-revoke, the smuggled insert and the delete are each refused as `authenticated`; reading still works. |
| M2 | `ocade_grant_entitlement` requires `aal2` and nothing in the product could create a second factor — `startEnrollment` had no caller, so the one operational task the plan names was unreachable. | `components/settings/TwoStep.tsx`, rendered in Settings → Account; the admin screen says before the attempt when a grant would be refused. | `an-operator-can-act.test.ts`. |
| M3 | Help promised Offline "sends nothing anywhere" while an ordinary offline chat is stored in the account and its attachments copied to Library. | `routes/help.tsx` — where the thinking happens and where the chat is kept are stated separately, and temporary chat is named. | `the-product-says-what-it-does.test.ts`. |
| M4 | Regenerate deleted the replaced turns one parallel call each, so a failure part-way through removed turns from the middle of a transcript, irreversibly. | `ocade_delete_messages_from` (`20260920110000`) — one DELETE, all or none. | `regenerate-drops-turns-atomically.test.ts` — five checks against real PostgreSQL, including a refusal injected mid-set. |
| M5 | `send` captured its screen AFTER awaiting the permit, so switching account or conversation during that wait let the old send resume under the new screen; its `finally` also cleared a newer send's duplicate guard. | `use-chat.ts` — the epoch is captured before the first await, the permit is returned through the one settlement when the screen has moved, and the guard is released only by the send that took it. | `a-send-belongs-to-one-screen.test.ts`. |
| D1 | Delivery was recorded after the answer was persisted, so a storage failure un-charged an answer the person had already read. | `use-chat.ts` — `recordDelivery` sits where delivery happened. | Same suite. |
| D2 | A failed removal reported success: metadata was cleared whether or not the file went, and `uninstall` published "Removed" regardless. | `model-vault.ts` and `installation-authority.ts` — the store is asked what is left, and what is left is what is said. | `removal-says-what-happened.test.ts`, against a store that refuses to delete. |
| D3 | The registration advisory lock included the browser install id, so two different browsers of one account took different locks and both could claim the last device slot. | `20260920090000` — the lock is per account and kind, which is what the cap counts. | Same device suite (the key is asserted; PGlite is one connection, so true concurrency stays external). |
| D4 | Admin search filtered the 200 newest profiles in the browser, so the 201st customer did not exist as far as an operator was concerned. | `listAccountAccess` searches server-side by exact id or by email/name, with trigram indexes (`20260920100000`). | `an-operator-can-act.test.ts`, including the filter-grammar sanitiser. |
| D5 | Regenerate passed `false, false` for Thinking and Research and quietly answered a different question. | `use-chat.ts` — the choices ride with the turn. | `a-send-belongs-to-one-screen.test.ts`. |
| D6 | Five public links and a wordmark in one row made Pricing 425 px wide at 375 px, with Privacy off the screen. | `PublicPage.tsx` — the header wraps below `sm`. | The polish journey checks every public page at 375 px, and that Privacy is on screen. |
| D7 | The phone Settings sheet gave its height to a column of categories, and rows squeezed beside fixed-width inputs. | `settings-panel.tsx` and `rows.tsx` — a scrolling strip, and rows that stack. | `the-product-says-what-it-does.test.ts` plus the settings journey at phone width. |
| S1 | Help sent people to Data Controls to delete their account; the control is under Account. | `routes/help.tsx`. | `the-product-says-what-it-does.test.ts`. |
| N1 | `/library` and `/cowork` answered `index,follow`. | `_authenticated/route.tsx` carries `noindex` so a route added under it cannot forget. | Same suite. |

## 2. What the adversarial pass found afterwards

Run against the reconciled tree with the purpose of breaking the product.

- **An upload was decoded before it was measured.** `addLibraryItem` checked the
  100 MB ceiling on the decoded bytes and put no bound on the base64 carrying
  them, so the only thing between one request and an arbitrary amount of memory
  in the isolate was the decode itself. Bounded in the validator now.
- **And the object was stored under the caller's own content type.** The Library
  opens an object by minting a signed URL and handing it to a new tab, so a file
  stored as `text/html` was an attacker-chosen document served from the
  project's storage domain through OCADE's own screen. An image is stored as the
  format its first bytes are; everything else as bytes to download.
- **An erasure left no proof it happened.** `deleteMyAccount` wrote its
  compliance line with the user id in it, after the user had been deleted — so
  the foreign key refused the insert every time and the `catch` swallowed it.
  Reproduced against PostgreSQL, then fixed to the anonymised row the constraint
  exists to produce.
- **A defect in this session's own work**, found by re-reading the diff: the
  atomic regenerate took its boundary from the anchor turn, which for a turn held
  in the tab is a time THIS BROWSER wrote. A slow clock would have deleted turns
  nobody asked to replace. The boundary comes from a stored row now.
- **The HTTPS upgrade broke local development**, found by the browser proofs
  rather than by reading: `wrangler dev` rewrites the request URL to the routed
  hostname over http, so every local session redirected to itself.
- **A refused provider attempt held its connection open** in the edge handler.
- **Two flaky checks**, fixed at the root: the device-cap proof waited a flat
  3.5 seconds for a background registration, and the final sweep's press loop
  produced React hydration reports by interrupting hydration.

Checked and found sound, so nothing was changed: the offline delivery route and
its signature, `safeNext`, attachment ingestion, the service worker's caching
rules, the router's no-fallback-after-output guarantee, and every `catch` in the
codebase (each carries a comment; none is silently empty).

## 3. Verification on the exact reconciled tree

`npm run verify:full` — 15 gates, all passing: routes:stable, typecheck, lint,
format:check, test (927), build:stable, audit:secrets, supabase:types-check,
content-storage:check, reads:check, controls:check, a11y:check,
monochrome:check, identity:check, reachability:check.

Browser journeys against a served production build: 312 checks across eleven
journeys — shell 26, auth 19, chat 38, usage 22, pricing 22, online 30, offline
25, library 18, settings 24, polish 34, final 54.

## 4. Deployment state

Applied and verified against the live Supabase project `sazhgaisyhkdbrooycdv`:
the three new migrations, each checked with its own verification script through
the management boundary. The checked-in `types.ts` is byte-identical to the
types generated from the live schema. `ocade-intelligence` is at version 8 and
its files match this tree.

The Cloudflare Worker — the frontend, and therefore C1's redirect and every UI
repair — is NOT deployed from here: `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` are absent and this environment has no egress to
Cloudflare. `node scripts/deploy.mjs --check` states the same blockers. The
applied migrations are compatible with the currently deployed frontend, which
reads those tables and mutates them only through the two RPCs.

## 5. What remains, and it is genuinely external

- **The Cloudflare deploy of this tree**, which is the owner's to run.
- **Real Gemini delivery, a real Offline install and real WebGPU/WASM
  generation** on real hardware. No egress to `ocade.in` or `*.supabase.co` from
  here, and no GPU.
- **True database concurrency** — PGlite is one connection, so two simultaneous
  requests for the last device slot or the last use cannot be interleaved.
- **Paid checkout**, which has no provider onboarding yet.
- **Leaked-password protection** is disabled on the Supabase project. It is a
  dashboard toggle and an owner decision; every other advisor finding was traced
  and is intentional (seven service-role-only tables with RLS on and no policy,
  and eleven SECURITY DEFINER functions that each enforce their own
  authorization, both asserted by tests).

## Permanent execution rules

At the start of every new, resumed, context-compacted, Auto Continue,
implementation, debugging, testing or release session, activate `/ponytail ultra`
and `/caveman ultra`.

Reproduce a defect before fixing it, repair the root cause, and add a regression
that would have failed on the old behaviour. Keep one canonical authority per
responsibility. Never weaken security, privacy, usage accounting, device limits,
Offline integrity, authentication, accessibility or customer-facing honesty to
make a test green.

Distinguish live, browser, database and code-verified evidence from stubs,
simulations and external proof, and never claim real-device, GPU, provider,
payment or production behaviour that was not actually executed.

GitHub Actions is optional because paid Actions availability is not assumed. Its
unavailability is not permission to skip verification: run the equivalent
through trusted local or agent execution and the existing Cloudflare and
Supabase paths.

After correctness is proven, simplify: delete dead code, duplicate authorities,
stale compatibility paths, unused exports and unnecessary dependencies. Never
reduce line count by removing required tests, validation, security controls,
accessibility behaviour or reliability logic.
