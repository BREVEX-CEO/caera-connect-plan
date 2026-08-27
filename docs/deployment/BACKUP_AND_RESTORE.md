# Backups and restore

What can be recovered, what cannot, and how — written before it is needed
rather than after.

## What exists to restore from

| Layer               | Where it lives                                               | Recoverable?                        |
| ------------------- | ------------------------------------------------------------ | ----------------------------------- |
| Schema              | `supabase/migrations/` — 58 files, applied in filename order | **Yes**, from this repository alone |
| Schema verification | `supabase/verification/` — one per migration                 | **Yes**                             |
| Schema rollback     | `supabase/rollback/` — one per migration                     | **Yes**                             |
| Row data            | Supabase managed backups for project `sazhgaisyhkdbrooycdv`  | **Depends on the plan** — see below |
| Browser-vault data  | The user's own device, encrypted under a key we never hold   | **No, by design**                   |
| Model weights       | The user's own device (OPFS)                                 | Re-downloadable                     |

The schema is fully reproducible from this repository with no backup at all.
`npm run test -- db-twin` applies all 58 migrations to real PostgreSQL, runs
each verification script immediately after its own migration, then rolls every
one back in reverse against the full schema. That rehearsal runs on every
commit, so "the migrations still apply" is never a hope.

## What is NOT backed up, and must not be promised

**Browser Only and Private Sync vault contents are encrypted with a key that
exists only in the user's browser memory.** A Supabase backup contains their
ciphertext and nothing that can open it — see `src/lib/storage/vault.ts`. If a
user loses both their passphrase and their recovery kit, their vault is gone,
and no restore performed here changes that. That is the intended property, and
support must never imply otherwise.

## Managed backups: verify before relying on

Supabase's backup behaviour is a function of the project's plan, and this
repository cannot see it. Before launch, confirm in the dashboard for project
`sazhgaisyhkdbrooycdv`:

1. **Daily backups** — Settings → Database → Backups. Note the retention window.
2. **Point-in-time recovery** — a paid add-on, off unless enabled. If it is off,
   the worst case is losing everything written since the last daily backup.
3. **Where backups are stored** and whether the region satisfies whatever data
   residency the product has committed to (the project is `ap-southeast-2`).

Write the answers into this file. An unanswered question here is the same as no
backup.

## Restoring the schema

Never against production first. Supabase branches exist for this.

```bash
# 1. A branch, or a throwaway project. Not production.
supabase branches create restore-rehearsal

# 2. Apply every migration in declared order.
supabase db push --db-url "$BRANCH_DB_URL"

# 3. Prove it: each verification script must pass against the applied schema.
for f in supabase/verification/*_verify.sql; do
  psql "$BRANCH_DB_URL" -v ON_ERROR_STOP=1 -f "$f" || echo "FAILED: $f"
done
```

The same sequence runs locally with no Supabase account at all, against PGlite:

```bash
npx vitest run src/lib/__tests__/db-twin.test.ts
```

## Restoring row data

1. Restore the managed backup **into a branch**, never over production.
2. Check row counts on the tables that matter — `ocade_conversations`,
   `ocade_messages`, `user_private_records`, `vault_config`, `profiles`.
3. Prove isolation survived the restore:
   `npx vitest run src/lib/__tests__/user-isolation.test.ts`. A restore that
   loses RLS policies is worse than no restore.
4. Only then promote, and only during a window where writes are paused —
   otherwise the restore silently discards everything written since.

**`vault_config` deserves its own check.** Restoring an older copy of that table
after a passphrase rotation leaves users holding a key that no longer unwraps
their data. If a restore crosses a rotation, those accounts need the recovery
kit path, and they need to be told.

## Rolling back one migration

Each migration has a matching rollback. They are written to be run newest-first
and are rehearsed in that order by the twin.

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/rollback/<timestamp>_<name>_rollback.sql
```

Read it first. Some are destructive by nature: a rollback that drops a table
drops its rows, and the file says so where that is true.

## What to do first, in an actual incident

1. **Stop writes** before restoring anything. A restore under live traffic
   produces a database that is neither the backup nor the current state.
2. **Take a fresh backup of the broken state.** It is evidence, and sometimes
   the broken state contains the only copy of something.
3. **Restore into a branch and verify there.** Every step above.
4. **Then promote**, and record what was lost. Users are owed the truth about a
   gap, including its start and end time.

`BREACH_RUNBOOK.md` covers the case where the incident is a compromise rather
than a loss. If both, that runbook takes precedence: preserving evidence comes
before restoring service.
