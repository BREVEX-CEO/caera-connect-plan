# OCADE Execution Memory

## Recovery purpose

This file is the concise recovery checkpoint for the active Chat-first production mission. After context loss, Auto Continue, usage reset, crash, or new Claude session, read `PLAN.md`, `CLAUDE.md`, and this file before changing code. Do not restart completed work or revive superseded plans.

## Current source baseline at documentation rewrite

- Repository: `BREVEX-CEO/caera-connect-plan`.
- Verified starting `main`: `328f0ab97b385aeacc9db0461ec1ffd59e755c57`.
- Product version in `package.json`: `0.1.0`.
- Existing source was previously debloated from 45,226 to about 42,884 `src` LOC and from 221 to 214 source files; future Phase 13 measurements must re-measure the actual current tree rather than assuming those counts remain exact.
- The previous final verification reported 15/15 gates, 789 unit/database tests, and 11 browser journeys, but much of that browser evidence used a loopback Supabase stub. The new plan explicitly requires live production proof for the critical paths.

## Live Supabase baseline

- Production project: `sazhgaisyhkdbrooycdv`.
- The project is currently healthy.
- The active Edge Function is `ocade-intelligence`, **version 7**, with JWT verification enabled (`ezbr_sha256` `4c52705e639e4db2c8e4838a51fcf49acd64611919ae0226ef0a680614c3122f`). Read from the live project rather than from an earlier note: this line said version 6 while a later section of the same file recorded the deployment to 7.
- The owner has already configured `GEMINI_API_KEY_PRIMARY`, `GEMINI_API_KEY_SECONDARY`, `GEMINI_API_KEY_TERTIARY`, and the required allowed-origin setting. Never ask the owner to paste those secret values into chat or source.
- Current active authentication methods for the product are Google and six-digit email OTP. Phone OTP is intentionally removed.
- The permanent owner/admin account is `caeracadane28@gmail.com` through the audited role/grant authority.
- The live private `library` Storage bucket remains required.
- The live schema still contains historical objects including recovery-code and other retired-family tables. Phase 11 must trace callers/data/policies before dropping anything; existing Auth users/sessions/customer/financial/legal/security evidence is protected.
- The current Supabase security advisor reports leaked-password protection disabled. This is not a blocker for the current Google/email-OTP passwordless flow on the owner’s current plan.
- Current performance-advisor findings include auth-RLS initialization patterns, multiple permissive policies, and indexes not yet observed as used. Investigate against real workloads before changing them.

## Private Offline release baseline

The owner has completed the private artifact preparation and upload.

```text
release id: ocr-2dc0ee44eb397906
byte length: 484220160
sha256: 2dc0ee44eb39790624623cf5e2a8cc21973c4839a67fed406dd3f9b2e6b7f800
private R2 bucket: ocade-private-models
private object: r/ocr-2dc0ee44eb397906/a
```

The artifact structure and full digest were verified, real Chromium WASM generation was proven by the owner, and the private R2 object length was verified. Remaining work is product/live delivery integration, real install/resume/repair/remove/reinstall proof, real WebGPU generation on capable hardware, forced WebGPU→WASM fallback proof, and final `ocade.in` Offline certification.

## Current known production problems

- Real Chat can display “OCADE could not verify your usage allowance. Nothing was sent and nothing was charged.” Treat this as the Phase 1 P0 contract/deployment bug.
- The repository contains newer intelligence work than the deployed Edge Function. Source, live function, database RPCs/types, and frontend must be reconciled before production parity is claimed.
- Billing can remain indefinitely on “Reading your allowance…”.
- Advanced can remain indefinitely on “Reading your sessions…”.
- Chat history can remain indefinitely on “Loading chats…”.
- Offline Intelligence can appear unavailable even though the owner-approved private release exists.
- Settings Notifications still describes recovery-code behavior even though the application recovery-code system was removed in the prior debloat.
- WebGPU is not yet accepted as real production proof. Capability detection is insufficient.

## Locked latest product decisions

- `/` opens Chat immediately. Signed-out visitors may inspect it, but Send requires sign-in.
- New Chat does not create an empty DB conversation. The first accepted/persisted Send creates the durable conversation.
- The selector is `Auto | Online | Offline`. Auto routes Online when connected/healthy and Offline when disconnected/ready. Online is disabled without Internet. Manual Offline sends zero provider traffic.
- Offline preparation begins automatically after successful sign-in unless the user explicitly removed it. Explicit Remove suppresses all automatic redownload until explicit Install Offline.
- Offline conversations synchronize to Supabase exactly once after reconnection using the minimum safe pending journal/idempotency needed to preserve unsynchronized work.
- Usage is one successful logical request = one use across Online and Offline. Free = 28/6h28m; Pro = 140/6h28m + 700/week; Max = 1,400/6h28m + 7,000/week.
- Chat includes the full interaction/attachment/dictation/temporary/export contract in `PRD.md` and `PLAN.md`.
- Settings categories are Account, Appearance, Notifications, Data Controls, Usage & Limits, Billing, and Advanced.
- UI remains near-black, clean, rounded, minimally glassed, responsive, and free of developer-dashboard clutter or permanent loaders.
- Web research is added through the existing Chat authority after core Chat is stable.
- Cowork remains frozen until this plan is complete.
- Production payment-provider onboarding remains owner-deferred and may not block this non-payment mission.

## This session's environment blockers

These are environment facts, not product findings, and they bound what
"proven" can mean for the work recorded below.

- Outbound HTTPS to `ocade.in` and to `sazhgaisyhkdbrooycdv.supabase.co` is
  refused by this session's network policy (proxy answers 403 to CONNECT). No
  live production HTTP journey, and no live REST call, can be run from here.
- The live Supabase **database** is reachable through the Supabase MCP tools, so
  live schema, RPC signatures, grants and live SQL execution are real evidence.
- Cloudflare is readable through its MCP tools (worker list, bundled code) but
  there is no token or upload path, so the frontend Worker cannot be deployed
  from this session. `npm run deploy:web` needs `CLOUDFLARE_API_TOKEN`.
- Consequence: browser proof here uses the real production build served by
  `wrangler dev` against the loopback Supabase stub. That is real product code
  in a real browser; it is not proof about the hosted project.

## Phase 1 — the allowance failure, root-caused and reproduced

The live database was cleared as a suspect first. Every RPC the ledger calls
exists in `sazhgaisyhkdbrooycdv` with a matching signature, granted to
`service_role` alone, and `ocade_acquire_generation_permit` was executed live
against the owner account: it granted a permit and the probe was released
again, leaving no residue.

The cause is one missing Worker binding. With `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` present but `SUPABASE_SERVICE_ROLE_KEY` absent,
`supabaseAdmin` throws on first use and every server function that needs it
fails at once. Reproduced in a real browser against the production build by
serving it without that one variable — all four reported defects appeared
together:

- Send → “OCADE could not verify your usage allowance.” and the typed question
  was discarded with it;
- Billing → the allowance read failed;
- Advanced → the sessions read failed and rendered nothing at all;
- Data Controls → “Offline Intelligence is not available in this version of
  OCADE yet.”, although the approved artifact exists.

The release gate could not see any of it: it asked only about the two public
values the browser also holds. That is why a dead deployment went green.

### Fixed in this phase

- `/api/health` reports `configuration.supabaseServer` — presence only, never a
  value — and `scripts/deploy.mjs` refuses a deployment whose health says the
  server secret is absent.
- A refused send returns the question and its attachments to the composer.
  `useChat.send` now answers whether the request was accepted.
- Billing, Advanced and the chat sidebar end in success, empty, or an error
  with Retry. One `Pending` component in `components/settings/rows.tsx` owns
  that shape; `UsageSection`'s duplicate `Row` was deleted.
- `docs/TRD.md` names the pinned online model again, which restores the
  documents-and-code agreement test Phase 0 broke.

Proven: 793 unit/database tests, all 11 browser journeys, and a before/after
browser run of the exact reproduction above.

## Production configuration — what is verified and what is not

The owner reports `SUPABASE_SERVICE_ROLE_KEY`, the `OCADE_LEASE_SIGNING_*`
secrets and the `OCADE_MODELS` → `ocade-private-models` binding as configured
and deployed. What this session can actually confirm:

- **Confirmed.** The R2 bucket `ocade-private-models` exists (APAC, Standard),
  created `2026-09-16T08:40:42Z`. Whether it still holds the object
  `r/ocr-2dc0ee44eb397906/a` at 484,220,160 bytes is **not** confirmable from
  here — Cloudflare's tools in this session expose buckets, not objects — and
  the bucket's creation date is newer than the upload recorded above, so the
  object must be re-verified before Offline is called done.
- **Confirmed, and a problem.** The deployed Worker bundle contains neither
  `supabaseServer` nor `Your chats could not be loaded`, so **production is
  running a build from before Phase 1 and Phase 2**. The secrets may well be
  set; the code that uses them correctly, and the health fields that would
  prove they are set, are not deployed yet.
- **Not confirmable.** Worker secret presence cannot be read from this session
  at all. Once the current build is deployed it is one request:
  `curl -s https://ocade.in/api/health` returns `configuration` with
  `supabasePublic`, `supabaseServer`, `modelDelivery` and `offlineLeases`.

`/api/health` reports all four now — presence only, never a value — and
`scripts/deploy.mjs` refuses a deployment that is missing any of them, naming
the ones that are missing. Proven both ways: served without the server secret
it reports `supabaseServer: false`; served with every binding present it
reports all four `true`.

Presence is not correctness. A wrong lease key pair still fails
`loadOfflineLeaseSigningAuthority`'s own sign-and-verify probe at issue time,
which is the right place for it. The health answer is the question a release
gate can ask from outside.

## Phase 2 — no wait without an ending, no control without a truth

Every remaining indefinite wait was found and ended, and each one failed the
same way: a read that threw left the screen exactly as it was.

- Library and Admin showed "Nothing here yet" when the read had failed, so an
  unreachable library was indistinguishable from an empty one. Both use
  `Pending` now.
- Opening a conversation emptied the transcript on failure, which read as a
  conversation nobody had written in. `useChat` reports `messagesFailed` and
  the transcript offers Retry. The read is also guarded against a slower answer
  for a conversation the person has already navigated away from.
- `/auth/challenge` set an error the spinner branch never rendered, so it span
  forever, on a screen somebody reaches while trying to get in.
- `/reset-password` set `ready` only after its first `await`, so a throw there
  left "Checking your reset link…" permanently.

Stale copy for systems that no longer exist is gone: the "Account and recovery"
notification category no longer promises recovery codes, three OAuth failure
hints no longer send people to phone sign-in, and Account no longer falls back
to a phone number. Both are now asserted by tests.

`scripts/check-dead-controls.mjs` gained rule 5b, `unbounded-wait`: a file that
shows a waiting message must also contain an ending for it — an alert region,
`Pending`, a `failed` state, or a stated `bounded-state:` reason. Verified to
fire against the original defect's exact shape.

## Phase 3 — the rest of the Chat interaction contract

Already present and re-proved: New Chat, generated title, rename, Copy, Edit
with branch regeneration, Regenerate, Retry, Stop, drafts, duplicate-Send
suppression, Markdown, tables, links, code-copy, Enter to send with
Shift+Enter for a newline, and a composer that grows to a bounded maximum.

Added this phase:

- **Search**, as a filter over the rows already loaded. It appears only once
  there are eight or more conversations, below which scrolling beats typing.
  A server round trip per keystroke would be slower than the answer and would
  need its own loading, empty and error states.
- **Grouped recent history** — Today / Yesterday / Previous 7 days / Older,
  bounded by the viewer's own local midnights so a chat from 23:50 last night
  reads as Yesterday rather than "14 hours ago". An unparseable timestamp
  groups as recent rather than being buried under Older.
- **Deletion asks once.** The menu item becomes "Delete for good" and changes
  tone; clicking away drops the half-made confirmation.
- **Per-conversation export** to Markdown, from the menu, for any conversation
  rather than only the open one. `saveFile` in `lib/utils.ts` is now the one
  place that builds and revokes an object URL — the account export under Data
  Controls uses it too.
- **Temporary chat**, beside the mode selector. It writes nothing anywhere: no
  conversation row, no message rows, no sync journal, and no delete calls for
  turns that were never written. Switching either way starts a clean
  transcript, because carrying turns across the boundary would either write
  what was promised not to be written or silently drop what the person can see.

**Thinking is live.** The offline model is Qwen3-0.6B Q4_K_M, which carries
Thinking and non-Thinking in one artifact and chooses between them through the
chat template. The owner ran the corrected proof against the real 484 MB
artifact and both verdicts passed: it loads and answers correctly, and the same
file deliberates and still answers correctly. `thinkingSuitable` is `true` on
that evidence and on nothing else.

Two defects were found on the way there, both in the proof rather than the
model. The first looked for a literal `<think>` in `content`, which wllama's
default `reasoning_format: deepseek` parses out — deliberation that had
definitely happened read as none. The second was worse: `PAGE` is a template
literal, so the backslash escaping a regex's closing slash was eaten before the
browser parsed anything, and the page died before defining `window.__prove`.
Tag handling uses string indexes now and the script refuses to start if the
embedded page contains a backslash at all.

The switch runs end to end: the Chat control sets `thinking` on the request, the
offline transport passes it to the adapter, and the adapter sets
`enable_thinking` on the chat template. `BrainStreamHandlers.think` had been in
the contract the whole time with the adapter hard-coding `false` past it.

**The control is offered only where it can be kept** — Offline, and only when
the release declares the capability. The online boundary has no such parameter,
so showing it under Auto or Online would be a switch that silently does nothing
on the route the request actually takes. Browser-proved in all three positions.

Two regressions the browser caught and that are fixed: the Temporary control
pushed the composer's control row past 375px, so it wraps now rather than
scrolling the page sideways; and the shell journey counted every
`aria-pressed` button on the page as an intelligence mode, so the selector
carries `role="group"` with a name and the assertion is scoped to it.

## Phase 4 — attachments, and files treated as hostile

The headline defect was already fixed in this tree and is still live in
production: the deployed Edge Function validates `attachments` and never passes
them to the provider, so an online answer was written as though no file
existed. The repository's `providerBody` folds them in, labelled. It reaches
customers when the function is redeployed at Phase 14.

Hardened here, each one a real gap rather than a hypothetical:

- **The read is bounded before it happens.** `file.text()` read an entire file
  into memory before a single character was truncated, so an accidentally
  attached multi-gigabyte log was a killed tab — and every byte past
  `MAX_TEXT_CHARS` was thrown away immediately afterwards anyway. One megabyte
  is sliced off the front, and truncation is still announced in the text.
- **A file is what its bytes are.** `File.type` is the operating system
  guessing from an extension, so arbitrary bytes named `.png` were base64'd and
  sent to the provider as a picture. Image magic bytes are checked for PNG,
  JPEG, GIF and WebP; anything else is refused by name.
- **SVG is read as markup, not as a picture.** It arrives as `image/svg+xml`
  and can carry script; the image branch would have sent it to a vision model
  as a photograph.
- **Archives are never opened**, which is the cheapest possible bound on a
  decompression bomb: there is no extraction step to limit.
- **Extracted text is data.** The citation instruction now tells the model in
  so many words that file contents are never instructions, and that a file
  asking it to change its behaviour should be reported rather than obeyed.

Browser-proved on the production build: an attached CSV visibly reaches the
answer, a renamed binary claiming to be an image is refused, and an archive is
refused rather than extracted. The loopback stub echoes a fragment of the
attached file so "the file changed the answer" is observable on screen rather
than merely recorded at the boundary.

## Phase 5 — one router, and a truthful selector

The router was already the single authority and already correct: `local_only`
never enters the online branch, `online` refuses rather than silently
degrading, and `automatic` may fall back only when the online attempt produced
nothing meaningful — the pre-output rule, carrying the same permit so one
request cannot be charged twice. Nothing about it needed rewriting.

What was missing was the connectivity half of the contract, all of it in the
composer:

- Online is disabled without a network, and the selection moves off it. A
  disabled button alone would leave somebody who had already chosen Online
  holding a mode whose only possible outcome is a refusal they cannot avoid.
- Auto says so: "No connection. OCADE answers on this device." It sits under
  the selector rather than in the shared notice line, because that line shows
  one thing at a time and a previous failure took precedence — written there
  first, it was never seen, and the browser caught it.
- `useOnline` is `navigator.onLine` through `useSyncExternalStore`: no polling,
  no state to keep in sync, correct during hydration. It answers "is there a
  network", not "is OCADE reachable" — the router still probes the boundary.

Browser-proved by toggling real connectivity: Online disabled, the selection
moved, the line shown, and manual Offline sending zero provider traffic —
proved by the boundary's own record of requests being unchanged, not by what
the screen said.

## Phase 6 — the Offline lifecycle

One real defect, and it was the opposite of subtle: **removal expired.** The
uninstall intent was compared against a 24-hour cooldown, so on the first visit
after a day OCADE quietly downloaded half a gigabyte again to a device whose
owner had explicitly removed it — no prompt, possibly on a metered connection.
`PLAN.md` and `CLAUDE.md` are both absolute on this, and a timestamp comparison
had quietly turned "until the user asks for it back" into "for a day". The
decision is permanent now; only `reinstall()` clears it, and only a person can
call that. Tested across a year of simulated clock, because the defect was
invisible to any test that did not wait.

The offline journey also **passed on "not available"**, which let it go green on
a build that could never install anything — the exact production defect this
mission opened with, reported as healthy. A published release means the
deployment can install, so the journey now refuses that claim outright.

The rest of the lifecycle — adaptive ranged transfer, checkpointing, resume,
authorization refresh, full digest verification, targeted repair, atomic
activation, install-once reuse — is implemented and covered by 145 unit tests
against the real transfer engine and vault.

**What remains external.** First install, interrupted resume, restart recovery,
targeted repair and explicit reinstall against the real private object cannot be
proved from this session: the 484 MB artifact is not here and R2 is reachable
only through `ocade.in`, which the network policy refuses. The delivery
signature path IS proved in the browser — unsigned, forged, expired and
malformed release ids are all refused.

## Phase 7 — WebGPU is real, and the claim that it was not had gone stale

A comment in this tree said the bundled binary was processor-only whatever it
was asked for, citing a measurement script that no longer exists. That was true
of an older wllama. The installed 3.5.1 `wllama.wasm` contains llama.cpp's full
`ggml-webgpu` backend — the symbols are in the binary
(`ggml-webgpu.cpp`, `webgpu_context_struct`, the shader decision tables) and
Emscripten's WebGPU bindings are in the glue. The claim had outlived its
evidence, and the ladder had no graphics rung at all.

So there is one now, and it costs nothing in extra machinery, which is the only
reason it is allowed: the SAME artifact runs on the card or the processor
depending solely on `n_gpu_layers`. One file, one installer, one lifecycle, no
second customer-visible product — exactly the constraint `PLAN.md` sets.

- `CapabilityPath` gains `webgpu`, ahead of the two processor rungs.
- The rung is available only when the browser actually hands over an adapter.
  `navigator.gpu` existing is not the test; plenty of machines have it and no
  usable adapter.
- `n_gpu_layers` is the rung's decision, and zero on the processor rungs is not
  redundant: wllama defaults it to 99999, so a binary that DOES register a
  graphics backend would silently offload on the rung the ladder chose
  precisely because graphics was refused or had failed.
- Fallback needed no new code. A rung that will not start already moves the
  ladder down, before any output.

`scripts/prove-offline-artifact.mjs` now reports a graphics verdict and no
longer launches with `--disable-gpu`, which would have made that verdict
meaningless. `--cpu-only` reproduces the processor rung deliberately.

**What remains external.** Real generation on a graphics card, and a forced
WebGPU failure falling back to WASM, need both the artifact and GPU hardware.
Neither is in this session. The owner's command is unchanged:
`node scripts/prove-offline-artifact.mjs <artifact>` on a GPU machine, and
`--cpu-only` for the fallback side.

## Phase 8 — offline turns never actually synchronised

The pending journal had a writer and a reader and **nothing that drained it**.
A turn produced while the database was unreachable was held in the tab, shown
as unsynchronised, and lost when the tab closed. The module's own documentation
described a flush and an in-flight guard; the guard was unused and the flush did
not exist. The synchronisation this phase is about had never run.

`flushUnsyncedTurns` uploads everything waiting, oldest first, and retires a
turn only after the write returns — forgetting on failure would lose exactly
the work the journal protects. It runs on the `online` event and on mount,
because the common case is not a reconnect somebody watches: it is coming back
to a tab that regained its network in the background.

Exactly-once is the server's guarantee, not the drain's. Every turn carries the
`clientKey` it was written with and `appendOcadeMessage` refuses a second row
for that key, so a reconnect firing twice, two tabs draining together, and a
request that timed out after the server applied it all end with one row. The
in-flight claim only avoids duplicated effort. Tested against a mock that
enforces the server's guard rather than against the drain's own bookkeeping.

**The journal stays in memory, deliberately.** `CLAUDE.md` permits persisting
it, but `check-content-storage.mjs` encodes a considered decision to keep
conversation content out of browser storage on shared devices, and `PLAN.md`'s
own gate hedges with "where the chosen browser storage permits". The product
states the consequence instead of hiding it: the turn is marked unsynchronised,
and closing or signing out warns first. Revisit only with a decision to encrypt
at rest.

## Phase 9 — Usage & Limits is its own screen, and Billing is about plans

Settings had six categories where `PLAN.md` names seven, because Billing was
the usage breakdown under another name. There was no screen that answered "what
would upgrading give me".

- **Usage & Limits** is its own category: tier, the current 6h28m window, the
  weekly cap where the tier has one, remaining counts, reset times, and the
  rule that one successful request costs one use.
- **Billing** now names Free, Pro and Max with their real allowances, marks
  which one the account is on, and says plainly that paid plans are not open
  yet. No disabled Upgrade button — that is the same lie told more quietly.
- `settings-panel.tsx` had its own copy of `Row`; it uses the shared one now.

Two regressions the browser caught, both mine. The online journey read the
allowance from Billing, which no longer carries the count, and the final
journey's control-pressing loop re-navigated with `domcontentloaded` and
pressed the next control while the page was still hydrating — React reported a
hydration mismatch that came from the loop racing the framework, intermittently
and indistinguishably from a real defect. It waits for `networkidle` now.

## Phase 10 — Settings on the devices people use

The seven categories now open and work at desktop, tablet (820px) and phone
(375px) widths, with nothing scrolling sideways. Two harness faults surfaced
doing it, both about the phone layout rather than the product: the account menu
is inside a drawer that has to be opened first, and at phone width two asides
exist — the drawer and the one behind it — so only the visible account button
is the one a person could press.

Every control was already backed by a real handler and a truthful result;
`controls:check` and the dead-control gate cover that continuously, and the
recovery-code and phone-sign-in remnants went in Phase 2.

## Phase 11 — auth and isolation, proved against the live database

Every finding was traced rather than treated as a to-do list, and all three
advisor categories turn out to be the design working:

- **`rls_enabled_no_policy` on seven tables (INFO).** Permits, device leases and
  their keys, the offline usage ledger, and the recovery-code family. RLS on
  with no policy denies everyone — and the live project closes them a second
  time, more strongly: `authenticated` has **no table grant at all**. Proved
  live: a customer role selecting from `ocade_generation_permits` is refused
  with `42501` before RLS is consulted. `service-only-tables-stay-closed.test.ts`
  now fails any migration that grants one of them to `authenticated` or `anon`,
  so nobody "fixes" the advisory by opening what its absence protects.
- **`authenticated_security_definer_function_executable` (9, WARN).** These are
  the RPCs the admin surface must be able to call from a browser; they
  authorize internally. `ocade_grant_entitlement` and `ocade_revoke_entitlement`
  require a support-admin role AND `aal2`, and a grant to one's own account is
  refused outright. Proved live: acting as an ordinary signed-in customer with
  `aal2` claimed, the grant was refused.
- **Leaked-password protection (WARN).** Not a blocker — OCADE has no customer
  passwords on the Google + email-OTP path, and the feature is unavailable on
  the current plan.

Cross-account isolation proved live too: a customer role reading another
account's conversations sees none.

Nothing was dropped on an advisor's say-so. `PLAN.md` is explicit about tracing
callers first, and every one of these findings had a caller and a reason.

## Phase 12 — research, without a second Chat engine

OCADE does not crawl. Research is the connected provider's own grounded search,
turned on for one request: no fetch loop to bound, no server-side request
forgery surface pointed wherever a model asks, and no second Chat product. It
inherits the existing auth, permit, cancellation and persistence unchanged —
a researched answer costs exactly one use, proved in the browser.

Sources travel with the answer, appended as Markdown links rather than carried
in a new event type, so Copy, export, persistence and the transcript keep them
without learning a second shape. Only `https` URIs are accepted from the
grounding metadata.

The control appears only where a request can reach the provider: not on manual
Offline, which sends no provider traffic at all, and not without a network.
Grounding is mutually exclusive with declared functions at the provider, so the
boundary sends one or the other — OCADE declares none today.

Three defects found on the way, all mine and all caught by the browser:

- The stub's new `const body` shadowed the REQUEST body in the same scope, so
  `JSON.parse(body)` hit a temporal dead zone and **every** boundary request
  parsed as `{}` and was refused as invalid. The symptom was a chat that would
  not answer at all.
- The research proof ran after the section that deliberately leaves the
  boundary failing, and did not reset it.
- Research beside Thinking, Temporary and the selector made the composer 49px
  too wide at 375px. The right-hand control group wraps now.

## Phase 13 — measured, and it is already lean

Before: `src` 41,946 lines across 215 files (152 excluding tests), 15 runtime
dependencies, 22 development. After: 41,938 lines, same file count, same
dependencies.

Eight lines. That is the honest result, and `PLAN.md` says so itself: "Reduce
complexity rather than chasing a cosmetic LOC number." The hunt found no dead
modules — the reachability gate proves 152 of 152 are reached from a route, an
entry or a worker — no unused dependency, and no duplicated subsystem. The
earlier debloat did the heavy work.

What it did find and remove:

- **15 exports nothing outside their own file imported.** They are private now,
  which shrinks the surface another module could couple to without changing a
  line of behaviour.
- **Seven genuinely dead imports and locals** that `noUnusedLocals` surfaced
  once those exports stopped being public: `ErrorInfo`, `useEffect`, `useRef`,
  `observeNow`, `clearAccountDataClass`, `defaultPreferences`,
  `EVERY_FREQUENCY`.

The meaningful complexity removed this mission was not in this phase. It was
the duplicate `Row` in two files, the object-URL code copied into a second
export path (now one `saveFile`), the offline journal's unused in-flight guard
(now the drain that never existed), the uninstall cooldown constant, and the
stale processor-only claim that had kept a whole graphics rung out of the
ladder.

## Phase 14 — certification, and what is genuinely owner-only

Verified on the exact merged tree: 826 unit and database tests, the 15-gate
`verify:full` matrix, and all 11 browser journeys on the production build (263
checks). `origin/main` is an ancestor of this branch, so the merge is a
fast-forward with nothing to reconcile.

**Supabase is current.** All 101 repository migrations are present in
`sazhgaisyhkdbrooycdv`; one appears under a different ledger name and its
objects were verified directly (`legal_consent_receipts`, both policies, both
indexes). Generated types were stale — they declared two organization helpers
the live project dropped — and are regenerated from the live database.

## The Edge Function is deployed. Version 7, and it matches this tree.

`ocade-intelligence` on project `sazhgaisyhkdbrooycdv` moved from version 6 to
**version 7** (`ezbr_sha256`
`4c52705e639e4db2c8e4838a51fcf49acd64611919ae0226ef0a680614c3122f`), deployed
through the authenticated Supabase MCP boundary because no CLI access token
exists in this environment.

Proven rather than assumed: the deployed source was read back afterwards and
diffed against the working tree, and all five files are byte-identical —
`supabase/functions/ocade-intelligence/index.ts`,
`src/lib/intelligence/edge-handler.ts`,
`src/lib/intelligence/online-models.ts`,
`src/lib/telemetry/operation-health.ts` and `src/lib/release.ts`. Version 6 is
therefore gone from production along with its three defects: the 1 MiB request
cap, attachments validated and then dropped, and no grounded research.

## Why the frontend was never deployable, and it was not the credentials

`npm run deploy:web` would have refused on any machine, with any token. Phase 2
removed the pre-launch gate from `cloudflare-entry.ts` — correctly, because the
product has launched and a permanently open gate is a branch nobody exercises —
but the deployment controller still required that gate's `x-ocade-edge-gate`
header to appear in the built Worker entry, and still demanded an
`OCADE_DEPLOY_EXPECT_ASSET_STATE` whose "locked" half had become unreachable.
Every deployment failed validation before Wrangler was called, so production sat
on a pre-Phase-1 build with no product defect behind it.

Fixed by deleting the stale half rather than resurrecting the gate: the built
entry check is gone, the environment variable is gone from the controller and
from `cloudflare-production.yml`, and the staged asset probe now asks the one
question that still has an answer — does this version serve its own client.
Driven end to end against the real controller with a stubbed Wrangler and edge,
it now reaches `verified` through upload → stage at 0% → staged health → staged
asset → promote → final health. `deploy-workflow-agrees-with-controller.test.ts`
keeps the workflow's environment and the controller's requirements in step.

## The frontend is deployed too, and Cloudflare did it, not the workflow

`ocade-web` is built and deployed by Cloudflare from `main` on every push,
about ninety seconds after it lands — observed twice. The live Worker bundle was
read back from Cloudflare and contains every marker of this tree: the
`supabaseServer` / `modelDelivery` / `offlineLeases` health configuration from
Phase 1, the Phase 9 `Usage & Limits` category, `thinkingSuitable`, the approved
release `ocr-2dc0ee44eb397906`, and grounded `research`. The pre-Phase-1 build
is gone, and with it the four defects in the original report.

So `cloudflare-production.yml` and `npm run deploy:web` are a SECOND deployment
authority for a job Cloudflare already does. Leave that for the owner to decide:
keeping both means two ways to change production, and the controller is the only
one that stages at zero traffic and verifies before promoting.

**What this session could not verify, and why.** Network egress to `ocade.in`
and `*.supabase.co` is blocked by this environment's policy, so
`https://ocade.in/api/health` was never read and no live smoke test was run.
Two things therefore remain unproven rather than proven: that the four
configuration booleans are all true at runtime, and the live Chat, usage,
attachment, grounded research, Library and Settings journeys.

**One step, from a machine that can reach the site:**

```powershell
irm https://ocade.in/api/health | ConvertTo-Json
```

All four of `supabasePublic`, `supabaseServer`, `modelDelivery` and
`offlineLeases` must be true. If one is false, the named binding is missing in
Cloudflare and the feature behind it is broken in production.

GitHub Actions is also failing for this repository — every run since at least
16 September ends in two seconds with no logs, which is a runner or billing
condition at the account level rather than anything in this tree. It predates
this work, and it means the deployment workflow could not run even if it were
wanted.

Hardware-only proof that remains external, recorded rather than fabricated:
real generation on a graphics card and a forced WebGPU failure falling back to
WASM (`node scripts/prove-offline-artifact.mjs <artifact>`, and `--cpu-only`
for the fallback side), and the private-object install, resume, repair and
reinstall journey against the real 484 MB release.

Still open for Phase 14: both halves of the release are deployed and current —
`ocade-intelligence` at version 7 byte-identical to this tree, and `ocade-web`
carrying this tree's build. What remains is evidence rather than deployment: the
`/api/health` configuration read and the live Chat, usage, attachment, grounded
research, Library and Settings journeys, none of which can run from a session
whose egress to `ocade.in` and `*.supabase.co` is blocked.

## The device cap, the meter, and the proof that could only run once

The live journey DID run against production on 18 September, and the database
still held its leavings: two devices, a signed 700-hundredth lease, a
conversation with three turns and four permits, plus two `diagnostic-probe`
permits from an earlier session. The two devices mattered more than the rest —
an account is allowed two active devices of a kind, nothing in the product gives
one back, and so the proof had exhausted the cap on the way to passing. A third
insert was attempted here against the live database and refused with SQLSTATE
23514, which is the second run of that proof, reproduced.

Cleaned: 2 devices (cascading their grants, keys, lease and allocation), 1
conversation, 3 messages, 4 permits and 2 usage rows. Kept: all five auth users,
including both test accounts — the proof needs one and deleting an account to
tidy up is not a cleanup — and every row belonging to the three real accounts,
apart from one `diagnostic-probe` permit that a session had left on the owner's
account. `.live-offline-debug.mjs` is not in the working tree, on any branch, or
anywhere in this repository's history; it was a scratch file in a previous
session's container and there was nothing to delete.

**The proof cleans up after itself now.** `live-usage-journey.mjs` clears the
account's devices before it starts and removes what it created in a `finally`,
so a run that fails half way cannot cost the next one its slots. Its assertions
moved from absolute counts to deltas off whatever the account opens with, which
is what makes a second run possible at all.

**Registration failure was swallowed whole.** `ensureCurrentDeviceIdentity`
threw one message for every failure, and the background top-up that calls it
caught everything and said nothing. An account at its device limit therefore had
no offline answers in that browser and no explanation anywhere. The refusal is
classified now (`device_limit` from 23514, `unavailable` for the rest),
published, read by Usage & Limits and by the offline refusal, and recorded once
as a `buildHealthRecord` line whose every field is an enumerated value — it
cannot carry an account, a prompt, a device name or a key. The stub enforces the
same cap as the trigger, so `usage-journey` meets the refusal in a real browser;
lifting the stub's cap makes that check fail, which is how it was proved not to
be vacuous.

**The meter promised requests the gate would refuse.** A signed offline block is
charged to the account when it is issued — the live data says so: 800
hundredths used against one 700 block and one answer — but `readCommercialUsage`
subtracted the unspent part back out before displaying it. With seven of
twenty-eight held on a device, the twenty-second online request was refused
while the sidebar still said seven left. The subtraction is gone; where those
requests went is a row in Usage & Limits instead.

**Every visit re-sent every event this browser had ever signed.** Nothing
removed a lease locally and the server verifies an event chain from its first
sequence, so reconnect was O(every block ever held) — about four a day on a
profile in daily use. An expired block whose events the server has is now
forgotten, and only then.

Also corrected here: a claim of mine that did not survive its own test. Moving
the allowance re-read into the `finally` was described as fixing a stale meter
after a failed generation. The online journey, run with the old placement
deliberately restored, passed anyway — a failure changes nothing net, so the
meter was never wrong. The settlement belongs in the `finally` regardless (three
exits settled, a fourth would not have), and that is the only claim made for it.

Recorded rather than fixed, each with its trigger:

- `ocade_return_offline_usage` has no production caller. Unspent offline
  capacity comes back at the session reset because a Free lease expires exactly
  then; a paid tier's WEEK window would hold it for a week. Returning it at
  expiry is not safe as things stand — a device that spent while disconnected
  reports after expiry, and the capacity would have been given back twice.
  Trigger: the first paid account in production.
- Nothing in the product frees a device slot. The RPC exists
  (`revoke_device_for_current_user`, granted to `authenticated`) and no screen
  calls it, so a person on their third browser is told the truth and can do
  nothing about it. Trigger: owner approval for a device list in Settings.
- `install-telemetry.ts` keeps a sixty-event ring and a listener set that
  nothing reads or subscribes to. Deleting it reaches into the install path this
  session cannot prove end to end. Trigger: the next session that can run the
  offline install journey against the real release.

Still unproven from here, and unchanged: this environment's egress to
`ocade.in` and `*.supabase.co` is blocked, so no browser journey ran against
production. The Supabase management boundary is reachable, which is how the
cleanup and the cap reproduction were done against the live database.

## Checkpoint discipline

Implementation work uses one isolated completion branch from the latest `origin/main`. After each phase passes its gate, update this file with the exact completed state, create a descriptive checkpoint commit, push the branch, and verify the remote SHA. Never merge an incomplete phase to `main`.

The final release fast-forwards `main` without force only after the complete plan passes together on the reconciled tree. Record final Git SHA, deployed frontend, Edge version/source, migration state, Offline release, live-versus-simulated proof, cleanup measurements, and genuine owner-only blockers.

## Owner engineering approach — permanent working memory

The owner is a non-coder and expects implementation agents to make sound technical choices independently, explain outcomes directly, and stop only for genuinely owner-only credentials or external actions. Prompts and reports should use complete sentences rather than one-word bullet labels.

Every implementation session starts with `/ponytail ultra` and `/caveman ultra`. Work follows `PLAN.md` to completion, fixes root causes rather than symptoms, aggressively hunts hidden bugs and race conditions, and adds regression coverage for reproduced failures.

After the plan is complete, run an independent enterprise-grade AI-platform QA pass that actively tries to break the product across browser flows, integration boundaries, auth and cross-account isolation, Supabase/RLS, usage accounting, online/offline routing, storage/reconnect, multiple devices, Cloudflare deployment parity, malformed/fuzzed inputs, concurrency, failure injection, accessibility, responsive behavior, and AI-behavior evaluations.

GitHub Actions is optional because the owner does not assume paid Actions availability. The project must not stop merely because remote Actions cannot run. Required tests and release proof should run through trusted local or agent execution and the existing direct Cloudflare/Supabase paths without weakening security or coverage.

After correctness is proven, perform a final Ponytail/YAGNI/KISS debloat pass. Prefer fewer maintained lines, fewer dependencies, fewer wrappers, fewer duplicate authorities, and fewer moving parts because that lowers bug surface and makes the code easier to understand and maintain. Never remove necessary tests, validation, security, accessibility, or reliability behavior solely to reduce line count.

## The twenty-six-defect audit, worked in its stated order

Every finding in `PLAN.md` was reproduced before it was changed, and the fixes
below are recorded with the evidence that actually exists for each — not with
the evidence that would exist if this session had egress it does not have.

**A signed-out screen and a signed-in one are the same tab.** `useChat` kept
the conversation id, the transcript, the streaming answer and the in-flight
reads across a change of account, so signing out and back in as somebody else
could show the first person's words, or have a late read restore them after a
clear. One counter now says whose screen is on the display: every asynchronous
continuation captures it before it awaits and drops what it is holding when it
no longer matches. The same counter closes the conversation-switch race — an
answer that arrives for a conversation nobody is looking at is discarded rather
than appended to whatever replaced it — and it is bumped by New chat, Temporary,
Delete and the account change alike. The first settled answer from the session
hook is recorded rather than acted on, because "not known yet" is not "signed
out": treating it as a change wiped the screen of somebody who had just opened a
conversation, which the chat journey caught.

**The current question was sent to the model twice, on every request.**
`setMessages` writes the transcript synchronously, and the question was then
appended to it again when the request was built. The stub now records the exact
outbound sequence and the online journey asserts it, because nothing visible on
screen can show this.

**Regenerate deleted before it asked.** Edit, Regenerate and Retry dropped the
turns they were replacing — from the screen AND from the account — and only then
asked the allowance for permission. With nothing left, the person lost their
question and got nothing in its place, and a reload confirmed the loss. The
deletion now runs after the permit and before anything is written, inside the
one `try` whose `finally` settles, so there is still exactly one settlement. The
usage journey exhausts the allowance, presses Regenerate and proves the turns
survive both the refusal and a reload.

**Two Sends in one tick were two charges.** The guard read React state, which
the caller that set it cannot see until the next render. A ref is written and
read synchronously; the usage journey clicks Send twice inside one page
evaluation — two Playwright clicks are two ticks and cannot reproduce it — and
proves one question and one charge.

**A file could not be asked about again.** Stored messages keep a name and a
size, so Regenerate re-asked a question about a document with no document. The
bytes are kept for the life of the tab and resent; when they are gone, OCADE
says the file must be attached again rather than answering as though there had
never been one.

**Settlement recorded itself as done before it happened.** `settled = true` was
set before the network call and the failure was swallowed, so a delivered answer
could stay uncharged and an empty reservation stayed held until its window
expired. It is marked settled only on a confirmed server acceptance now, retries
three times, and records an enumerated health line when it finally cannot.

### The defect that turned off every error path in the product

`removeMessage` swallowed a failed deletion, so private text somebody deleted
came back on the next reload. Fixing the `catch` was not enough, and proving it
is what showed why: with the stub told to refuse the delete, the server returned
500, the browser logged the 500 — and the client half of the call RESOLVED, with
`{}`.

The handlers signalled failure by throwing a `Response`. The framework's client
resolves that; it rethrows a thrown `Error`. Fourteen handlers did it, which
means every `try`/`catch` around a server function in this codebase was
unreachable code: the rollbacks, the "history could not be read, try again"
states, the conversation-mutation failures, all of it. One line per handler had
turned the product's error handling off, and no test could see it because
nothing failed in a test.

All fourteen throw `Error` now. `a-failed-server-function-reaches-its-caller.test.ts`
keeps them that way, and the chat journey proves it end to end by making the
database refuse a deletion and checking the turn stays on screen with the person
told why.

### Offline, devices and isolation

**The engine ran single-threaded on the wrong document.** Cross-origin isolation
was applied to `/ocade`, which is deliberately a 404; Chat is `/`. Isolation is
now the default for every document except `/auth`, and crossing that boundary is
a real navigation rather than a router transition — `needsFullNavigation` had
existed for this the whole time and nothing consulted it. The shell journey
asserts `crossOriginIsolated` and `SharedArrayBuffer` on the chat document, and
asserts the sign-in document is NOT isolated after being reached from chat.

**Registering a browser could cost a device slot for ever.** The device row and
its grant were two client writes with a compensating delete whose own failure
was ignored. One security-definer function writes both in one transaction,
refuses past the cap with the code the browser turns into a sentence, and
refuses to re-admit a browser whose device was removed.
`device-registration-against-postgres.test.ts` proves each of those against real
PostgreSQL, including the atomicity claim, by making the second write fail
inside the database and looking at what is left.

That function also replaced the Web Locks requirement, so a browser without
`navigator.locks` — which used to register nothing and say nothing — registers
normally. The lock is the database's advisory lock, held by the transaction, and
it covers every tab and device rather than one browser.

**The device cap had no way out, and now has one.** Usage & Limits lists the
devices holding this account's offline places, marks the current browser, and
removes one with a confirmation. Removing the current browser reports what it
spent without a network, deletes its signed blocks locally, and then returns the
unspent capacity through `ocade_return_offline_usage` — which had no production
caller at all. Both halves are proved against PostgreSQL: a partial spend returns
only the unspent part, and a retried return credits once.

A device removed from a DIFFERENT browser is deliberately not returned: that
browser may hold a signed block it has not reported, and crediting the account
before those events arrive would hand it the same requests twice. Its block
expires on its own. Trigger for revisiting: a server-side expiry sweep that can
accept late events against a closed lease.

**Settings said Ready and unavailable at the same time.** The artifact's
lifecycle and this browser's offline allocation were two authorities on one
screen. Readiness is stated once now, from both, and the device-limit case says
where to go and what to do.

**A device-limit refusal could be shown to the wrong account.** The published
answer was module state with no account on it. It carries one now, and a screen
asks on behalf of the account that is signed in.

**The first sign-in could leave Offline permanently broken.** Preparation ran on
every visit, signed in or not; the release lookup is authenticated, so a
signed-out bootstrap could only fail — into a stage nothing retries. It waits for
an account now, which also restarts it when one arrives through an emailed code
without a page load. Separately, a lookup that could not be MADE no longer
reports that Offline Intelligence does not exist in this version of OCADE.

### Truth at the edges

**Two origins served the same product.** `www.ocade.in` and `ocade.in` both
answered 200, and a browser gives each origin its own sessions, storage, service
worker and model vault — up to and including a second 484 MB download for the
same person on the same machine. The Worker answers `www` with a 308 to the
apex, before the asset binding and before Nitro.

**The sitemap named twelve pages that do not exist** — `/company`, `/compare`,
`/blog`, `/careers`, `/press`, `/status` and the rest — and left out `/about` and
`/help`, which do. It also built its URLs from the request host, so the `www`
origin advertised `www` URLs. It lists the real public pages at the canonical
origin now, and `sitemap-lists-only-real-pages.test.ts` reads the generated route
tree and fails in both directions if they ever disagree again.

**The policy permitted posting to every HTTPS host on the internet.**
`connect-src` is now OCADE itself, the configured Supabase project over both
schemes it uses, and Cloudflare's beacon. The loopback grants went with the local
runtime they were for, which no longer exists.

Deliberate debt, with its trigger: `script-src` still carries `'unsafe-inline'`.
The only inline script OCADE writes is the theme boot; the other two are the
framework's, and pinning their hashes would break the site on a framework
update. TanStack supports `ssr.nonce`, but `getRouter()` takes no arguments and
runs in the browser too, so supplying a per-request nonce needs plumbing that
can reach it without a module-level holder shared across concurrent requests.
Trigger: the first framework release where the router can read the request, or
an XSS finding, whichever comes first.

**Dead weight removed rather than documented.** The install telemetry kept a
sixty-event ring and a listener set that nothing read or subscribed to; with it
went the thread-outcome accessor that had no caller and the permit timeout's
leaked timer.

### What this session could not prove, and why

Egress to `ocade.in` and `*.supabase.co` is denied by policy in this environment,
so nothing here is live production proof: no health read, no signed-in journey
against the hosted project, no real Gemini answer. The Supabase MANAGEMENT
boundary is reachable, which is how the migration was applied, the function
verified in the live catalogue, the advisors read and the types regenerated.

The live advisor warnings were traced rather than accepted: every SECURITY
DEFINER function `authenticated` can execute enforces its own authorization —
the entitlement pair requires a support admin AND `aal2`, `has_role` refuses to
answer about another user, and the purge only touches the caller's own rows. The
seven "RLS enabled, no policy" tables are service-role-only by design and
`service-only-tables-stay-closed.test.ts` asserts it.

Still external, unchanged: real WebGPU generation, the 484 MB install and its
resume/repair/reinstall journey on real hardware, multi-device revocation in
production, and paid checkout.

## The adversarial pass, and what it actually found

Run after the plan's findings were closed, against the reconciled tree, with
the purpose of breaking the product rather than confirming it.

**It found two faults in this session's own work**, which is the point of
re-reading a diff adversarially rather than re-reading the tests. Abandoning a
transcript read left `loadingMessages` true for ever: the guard that drops the
stale result also skips the `finally` that cleared it. It is invisible today
only because every caller empties the transcript too and the list is not
rendered when empty — a latent trap, not a defence, and one line at the source
fixed it. And pressing Stop before the first token said "OCADE could not answer
that", which is untrue; stopping is a decision, and a refusal or a genuinely
empty answer still says so.

**Cross-account isolation is now proved rather than assumed.** Nine checks run
under `SET ROLE authenticated` with a JWT claim — the way PostgREST executes a
customer's request, and the only way the policies are in force at all. A
conversation and its messages are invisible to another account, cannot be
renamed, deleted or added to by one, and cannot be claimed by inserting a row
that names somebody else as owner. Usage is unreadable across accounts and an
account cannot grant itself a tier. A control read proves the suite is not
passing because nothing is readable.

**Losing local storage is survivable.** The offline journey clears IndexedDB and
localStorage with the account untouched, then proves the conversations come back
from Supabase, a transcript inside one reads again, the composer still works,
and nothing is left promising something it cannot deliver.

**Failure injection is real now.** The stub can be told to refuse a write, which
is how the swallowed-deletion defect was caught and how it stays caught.

Checked and found sound, so nothing was changed: the unsynced-turn journal
(claim/release per tab, with a unique index on `(user_id, client_key)` as the
real exactly-once guarantee, and a SELECT-before-INSERT that answers the common
replay without a failed write); attachment ingestion (image size cap, magic-byte
check, SVG read as text rather than base64'd into a vision model, text bounded
BEFORE it is read, total budget at the request boundary); and every live
SECURITY DEFINER function `authenticated` can execute.

Not reachable from here and unchanged as external proof: true database
concurrency — PGlite is one connection, so the row locking that makes two
simultaneous requests for the last use safe cannot be exercised — real WebGPU
generation, the 484 MB install on real hardware, multi-device revocation in
production, and paid checkout.

## Measured cleanup

`src` moved from 42,459 to 43,602 lines and 221 to 227 files across this
session. That is growth, and it is honest to say what it bought: four new test
files, the device management the plan required, one migration's client, and the
comments that record why each defect existed. Product code excluding tests went
30,818 to 31,519.

A whole-repository audit for over-engineering found one dead export (a zod
schema nothing validated with), no unused dependency — the four with no source
import are used by `vite.config.ts` or a dynamic `import()` — no
single-implementation interface, no wrapper that only delegates and no dead
function. The deletions this session are the install telemetry ring, the thread
outcome accessor that had no caller, the Web Locks branch the database replaced,
and the compensating-delete protocol the transaction replaced.
