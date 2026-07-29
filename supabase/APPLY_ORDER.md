# OCADE — Supabase apply order and Lovable test checklist

**Status: READY TO APPLY THROUGH LOVABLE. Nothing here has been applied.**

Every OCADE surface backed by these tables currently renders an honest
"needs the database migration" state. None of them fabricate data, and applying
these migrations is the only step that turns them on.

---

## 1. Apply order

Apply **in this exact order** — later migrations reference earlier tables.

| #   | Migration                                          | Creates / alters                                                                                                                                                                               | Depends on                                                                            |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | `20260722090000_ocade_projects_outputs_memory.sql` | `ocade_projects`, `ocade_project_items`, `ocade_outputs`, `ocade_memory`; adds `ocade_conversations.project_id`, `user_settings.ocade_memory_enabled`; hardens conversation/message parent RLS | existing `ocade_conversations`, `ocade_messages`, `user_settings`, `set_updated_at()` |
| 2   | `20260722100000_ocade_subscriptions_usage.sql`     | `ocade_subscriptions`, `ocade_cloud_usage`, `ocade_consume_cloud_use()`                                                                                                                        | `set_updated_at()`                                                                    |
| 3   | `20260722110000_ocade_automations.sql`             | `ocade_automations`, `ocade_automation_runs`                                                                                                                                                   | `set_updated_at()`                                                                    |
| 4   | `20260724211500_ocade_automation_worker.sql`       | worker leases, cancellation/pause/deadline/approval state, append-only step receipts, 13 atomic lifecycle RPCs                                                                                 | migration 3                                                                           |

Migration 3 must come after 1 only for consistency of review; it has no hard FK
to projects. Migrations 1 and 2 are independent of each other. Migration 4 must
immediately follow migration 3: it replaces the temporary owner-CRUD run policy
with SELECT/INSERT plus RPC-only lifecycle mutations.

**Scope note.** These four are the only UNAPPLIED migrations. The 27
UUID-named files alongside them were generated and already applied by Lovable
before this work began; they are untouched here and deliberately have no
rollback or verification script — writing a rollback for an already-applied
migration would invite someone to run it. Each of the four above has a matching
`rollback/` and `verification/` script:

| Migration                         | Rollback | Verification |
| --------------------------------- | -------- | ------------ |
| `…_ocade_projects_outputs_memory` | ✅       | ✅           |
| `…_ocade_subscriptions_usage`     | ✅       | ✅           |
| `…_ocade_automations`             | ✅       | ✅           |
| `…_ocade_automation_worker`       | ✅       | ✅           |

### Prerequisite check (run first)

```sql
-- Must return one row, or migration 1 and 3 triggers will fail.
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname = 'set_updated_at';
```

### After applying

1. Run each verification script in `supabase/verification/` (same numeric order).
   Every query has an expected row count in its comments.
2. **Regenerate Supabase types.** The server functions currently reach these
   tables through a single documented bridge (`pendingFrom`) because the
   generated `Database` type does not know them yet. After regenerating types,
   that bridge can be deleted from:
   - `src/lib/ocade-projects.functions.ts`
   - `src/lib/ocade-automations.functions.ts`
   - `src/lib/ocade-usage.functions.ts`
   - `src/lib/automation-worker.supabase.ts`

   Nothing else changes — the queries are already written against the real
   column names.

### Rollback

Each migration has a matching transactional teardown in `supabase/rollback/`.
Apply them in **reverse** order (4 → 3 → 2 → 1). Rollback 4 first removes the
worker RPCs/receipts and restores the base run policy. Rollback 1 restores the
original conversation policy before dropping the added project column, so
foreign keys and policy expressions unwind cleanly. Conversations and messages
are never deleted — only the project link is removed.

---

## 2. Lovable test checklist

Work top to bottom. Every row is a real user path, not a UI-only check.

### 2.1 Projects and outputs — `/ocade/projects`

- [ ] Page loads without the "needs the database migration" panel
- [ ] Create a project → it appears in the list and is selected
- [ ] Rename it and save → name persists after a reload
- [ ] Add project instructions → persist after reload
- [ ] "Show archived" toggle hides/shows archived projects
- [ ] Archive → the project moves out of the default list; Restore brings it back
- [ ] Move an unfiled conversation into the project → it appears under Conversations
- [ ] Unfile it → it returns to the unfiled list
- [ ] Delete a project → confirmation dialog appears; after deleting, **its
      conversations still exist** and are unfiled (this is the important one)
- [ ] Open an output → preview shows content; Export downloads a file; Delete removes it

**Cross-tenant check (critical):** sign in as a second account and confirm none
of the first account's projects, outputs or conversations are visible.

### 2.2 Memory — `/settings/<memory section>`

- [ ] Memory is **OFF** by default for a fresh account
- [ ] Attempting to add a memory while OFF is refused (HTTP 409)
- [ ] Turn memory ON → add, edit, pin and delete entries; each persists
- [ ] "Clear all" removes every entry for that user only
- [ ] Deleting a memory does **not** delete any conversation
- [ ] "Remember this" adds an entry with source `user` — memory is never
      inferred silently, so nothing should appear that you did not type
- [ ] With memory OFF, "Remember this" surfaces the 409 message rather than
      appearing to succeed

### 2.1b Mobile approvals — producer and consumer

The approval queue is shared between the Desktop Copilot (which raises requests)
and the mobile companion (which answers them). It is stored on the device, so
none of this needs a migration — but it does need checking end to end.

- [ ] Pair a phone, then propose a `confirm`/`high` action in the Copilot →
      a matching request appears under "Approvals waiting for you"
- [ ] The request summary contains **no** file path, password or payment text —
      it is redacted before storage because approvals show on a lock screen
- [ ] Approve on the phone → the desktop sees the decision
- [ ] Leave a request until it lapses → it flips to `expired` **on next read**,
      even if no tab was open while it lapsed, and an "expired" alert fires once
      (not on every subsequent read)
- [ ] Reload mid-approval → the request is still waiting, not lost
- [ ] Revoke the device → pending approvals are cleared, so a revoked phone's
      decision can never land afterwards

### 2.2b Conversation deletion clears BOTH stores

Deleting a conversation must remove the record _and_ the message bodies held on
the device. With a vault privacy mode the text never reached the server, so
removing only the server row would leave the content on disk while reporting
"Conversation deleted".

- [ ] Set Privacy → chats to **Browser Only**, hold a short conversation
- [ ] Delete it → the toast names how many on-device messages were removed
- [ ] Reload: the conversation is gone from the list AND its messages are gone
      from local storage (check the vault store, not just the UI)
- [ ] Repeat with **Private Sync** → deletion still succeeds, count may be 0
- [ ] Simulate a vault failure (lock the vault first) → the toast says the
      on-device copy could NOT be deleted, instead of reporting success

### 2.3 Automations — `/ocade/automations`

- [ ] Create an automation → appears in the list
- [ ] Preview shows the plan, highest risk, and needs-approval state
- [ ] Add a step that types protected text → preview shows **blocked**, and a run
      records status `blocked` and never executes
- [ ] Dry run → run recorded with `dry_run = true`, nothing executed
- [ ] Run requiring approval → status `awaiting_approval`; Approve moves it to
      `pending`; Deny moves it to `cancelled`
- [ ] Cancel a pending run → status `cancelled`
- [ ] "Stop all" cancels every non-terminal run at once
- [ ] Pause → the Run button is disabled; Resume re-enables it
- [ ] Run history survives a reload
- [ ] **Never double-start:** with a run already `pending`/`awaiting_approval`/
      `running`, pressing "Run now" again returns the SAME run id — no second
      row appears in history
- [ ] **Never double-start (race):** open `/ocade/automations` in two tabs and
      press "Run now" in both within a second → still exactly one in-flight run.
      The database index `ocade_automation_runs_one_in_flight_idx` settles it if
      both pass the application check
- [ ] Dry run is exempt → previewing repeatedly while a real run is in flight
      still works and never blocks it
- [ ] After the in-flight run reaches `succeeded`/`failed`/`cancelled`/`blocked`,
      a new run can start again (a blocked run must not wedge the automation)

### 2.4 Subscriptions and allowance — `/settings/usage`

- [ ] Allowance bar shows used / remaining out of 28 and the next reset time
- [ ] The reset time is the next fixed 8-hour boundary (00:00 / 08:00 / 16:00 UTC)
- [ ] A **successful cloud** request increments usage by exactly 1
- [ ] A **failed** or **cancelled** request does **not** increment usage
- [ ] A **local** request never increments usage (this is the key economics rule)
- [ ] With allowance exhausted, the page offers the local alternative
- [ ] Plan panel shows the four durations, 2 desktop + 2 mobile devices
- [ ] With an expired plan: local data, local inference and export all still work;
      cloud and premium are disabled

### 2.5 Chat regression (must not break)

- [ ] Existing cloud chat still streams and persists
- [ ] `browser_only` privacy still prompts for cloud approval (HTTP 428)
- [ ] Attaching a PDF / DOCX / XLSX extracts text on-device with a progress toast
- [ ] Attaching a corrupt file reports "damaged", not empty text
- [ ] Citations appear as source cards; a fabricated `[S9]` marker is not rendered
- [ ] Cancelling mid-stream preserves the partial answer

### 2.6 Security spot-checks

- [ ] No `service_role` key is present in any client bundle
- [ ] RLS: every verification script's cross-tenant query returns 0
- [ ] Screenshot/audit/replay paths contain no credential values

---

## 3. What remains blocked after this checklist

Applying these migrations completes the **web** surface. These stay blocked on
artifacts outside Lovable:

| Area                    | Blocking artifact                                                                 |
| ----------------------- | --------------------------------------------------------------------------------- |
| Tauri desktop companion | Visual Studio Build Tools (C++ workload) for `link.exe`; then signing certificate |
| Browser extension       | Load unpacked in Chrome + `icons/icon128.png`; then store listing                 |
| Android / iOS companion | `npx cap add android ios` + Android Studio / Xcode; then store accounts           |
| OCADE Cloud inference   | A server-side provider credential (never committed, entered securely)             |

Until each of those is done, the matching OCADE surface continues to report
itself unavailable with a reason. That is deliberate: OCADE never claims a
capability it has not proven.
