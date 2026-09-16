# OCADE Application Flow Authority

## Public entry

A visitor opening `ocade.in` enters Chat immediately. The signed-out shell is usable for inspection, but attempting to Send opens the authentication flow. Public Pricing, About, Help, Terms, and Privacy remain reachable without authentication.

## Authentication flow

The sign-in surface offers Continue with Google and six-digit email OTP. Phone OTP is absent. Email OTP follows request → generic confirmation state → six-digit verification → authenticated return to the intended Chat context. The UI must not reveal whether an email address already belongs to an account.

After successful sign-in, the pending user intent is preserved and Chat becomes usable. On a device without an intentionally removed Offline installation, background Offline preparation begins automatically without blocking Online Chat.

## Empty Chat and New Chat

`/` and New Chat show the same clean empty workspace: small OCADE heading/greeting, compact optional suggestions, and the composer. No empty database conversation is created at this point.

The first accepted Send performs authentication check → usage permit → route selection → intelligence → settlement → persistence. Only then does the durable conversation appear in recent history. After the first exchange, OCADE generates a concise conversation title.

## Composer flow

The composer contains attachment `+`, text input, microphone dictation, `Auto | Online | Offline`, optional Thinking, and Send. Enter sends and Shift+Enter inserts a newline. During generation, Send becomes Stop.

Attachments may be selected, dragged, or pasted. Pending items show progress and allow remove, retry, reorder, and preview where applicable. Unsafe/unsupported files fail before intelligence with a clear short error.

Microphone dictation writes text into the composer. The customer reviews/edits and sends manually.

## Routing flow

### Auto

When the Internet and connected intelligence are healthy, Auto uses Online. If connectivity is absent and Offline is ready, Auto switches to Offline and shows a subtle Offline state. If Online fails before output begins and Offline is ready, Auto may fall back once without double-charging.

### Online

Online uses connected OCADE only. When connectivity is absent, the selector option is disabled and explains that Online needs Internet rather than failing after Send.

### Offline

Offline uses device intelligence only and sends zero provider traffic. If Offline is still preparing, show real progress. If the user explicitly removed it, show the removed state and Install Offline action. If it was never installed and the device currently lacks Internet, explain that one connected installation is required.

## Response flow

Answers stream progressively. Stop ends the current generation according to the server-defined settlement rule. Successful answers expose compact contextual controls for Copy, Regenerate, Delete, source links where applicable, and code-block Copy. Failed generations expose Retry without losing the user prompt.

Editing a user message keeps the earlier conversation, changes that prompt, and regenerates from that point. Regenerate replaces/branches the answer according to the canonical conversation behavior rather than stacking accidental duplicate answers.

## Conversation history flow

The sidebar loads recent conversations with a bounded state: skeleton/loading → populated history, empty history, or error with Retry. Recent conversations are grouped by useful time periods. Search filters or queries history without creating a second conversation store.

Rename updates the existing conversation. Delete requires a short confirmation. Individual export is available. Temporary Chat is clearly marked and never enters Supabase history.

## Offline conversation flow

While disconnected, Offline Chat continues using the local runtime when ready. Unsynchronized messages receive stable client ids and are kept in the minimal pending-sync journal. The transcript makes the pending state understandable without turning into a technical dashboard.

When connectivity returns, pending operations reconcile to Supabase exactly once. Successful reconciliation clears the pending journal entry; retry/reconnect cannot duplicate messages or usage events. Conflicts are resolved through the one canonical conversation authority rather than silently overwriting remote history.

## Library flow

Library shows All, Images, and Files with search and Add. It uses bounded loading/empty/error states. Chat attachments may be drawn from Library or uploaded directly through the same private storage authority.

A file that reaches intelligence is visibly associated with the relevant message. Generated/downloadable outputs may return to Library according to the existing product contract.

## Settings flow

The Account menu opens a compact responsive Settings surface with Account, Appearance, Notifications, Data Controls, Usage & Limits, Billing, and Advanced.

Account manages the active identity methods, sign-out, session/device controls that actually exist, and account deletion. Appearance manages theme, reduced motion, high contrast, and proven display preferences. Notifications shows only real notification capabilities. Data Controls handles export/deletion and Offline Intelligence install/remove. Usage & Limits explains allowance and reset state. Billing shows tier and upgrade information. Advanced exposes working session/device diagnostics and no permanent loaders.

Every Settings read/action ends in success, empty, or error/Retry. “Reading your allowance…” and “Reading your sessions…” may not remain indefinitely.

## Usage flow

Before generation, the customer sees a compact remaining-use indication and, when low, a subtle composer warning. At exhaustion, Send/generation is blocked with exact reset information and Upgrade while history, Library, Pricing, Billing, Settings, export, and account management remain usable.

## Offline installation flow

After first successful sign-in, background preparation begins unless `user_uninstalled` is set. The detailed state transitions are Waiting → Downloading → Verifying → Activating → Ready, with Repairing when targeted recovery is needed.

Interrupted downloads resume from verified progress. Restart/reopen continues rather than restarting. A normal OCADE deploy does not redownload a compatible verified release. Remove deletes runtime bytes and sets persistent suppression. Install Offline is the only action that clears suppression and starts a fresh installation.

## Web research flow

After core Chat is stable, a research request remains a Chat request. The same conversation, usage, cancellation, persistence, and source-citation authorities invoke the bounded research tool path and return sourced results to the same transcript.

## Error flow

Customer errors are short and actionable. Internal provider/database/stack information stays in protected diagnostics. Network loss preserves drafts and pending work. A route or async action must never trap the customer in an infinite loader or force a page reload when a bounded retry can recover.

## Responsive flow

Desktop uses the steady left sidebar and centered workspace. Tablet narrows/collapses the sidebar. Phone uses a drawer and full-width composer. The same functional flows remain available without horizontal overflow, inaccessible hover-only controls, or tiny touch targets.
