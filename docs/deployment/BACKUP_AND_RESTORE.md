# Backups, restore and rollback

What can be recovered, what cannot, and how — proven by something that runs,
not only described here.

## Recovery is rehearsed, not documented

`npm run recovery:prove` performs a full recovery against real PostgreSQL and
writes `release/OCADE_RECOVERY_REHEARSAL.json`. It is not a smoke test of a
runbook; it is the recovery itself, in the order an incident forces:

1. A live database with two accounts' data in it, across every table that
   declares an owner, plus Storage object rows.
2. A backup taken from it — rows only, nothing about the instance.
3. **Total loss.** A second, empty PostgreSQL that has never seen the schema,
   the policies, the extensions or the functions.
4. Schema rebuilt from `supabase/migrations/` alone.
5. Rows restored, parents before children, into truncated tables.
6. The proofs: identical rows by digest, every foreign key re-validated,
   sequences moved past the restored rows, row-level security back with the
   data, and one account still unable to read the other's rows.
7. The newest migration rolled back and re-applied on the restored database.

The rehearsal has already found two real defects that a written procedure had
been hiding: a backup scoped to `public` alone left every user-owned row
orphaned because `auth.users` was never included, and a schema rebuilt from
migrations is **not empty** — several migrations insert reference data, so a
restore must replace rather than append.

## What exists to restore from

| Layer               | Where it lives                                               | Recoverable?                        |
| ------------------- | ------------------------------------------------------------ | ----------------------------------- |
| Schema              | `supabase/migrations/` — 95 files, applied in filename order | **Yes**, from this repository alone |
| Schema verification | `supabase/verification/` — one per migration                 | **Yes**                             |
| Schema rollback     | `supabase/rollback/` — one per migration                     | **Yes**                             |
| Row data            | Supabase managed backups for project `sazhgaisyhkdbrooycdv`  | **Depends on the plan** — see below |
| Identities          | `auth.users` and the rest of the `auth` schema               | **Yes**, and they must be in scope  |
| Storage objects     | Bytes in Supabase Storage; ownership rows in `storage`       | **Both halves, or neither works**   |
| Model weights       | The user's own device (OPFS)                                 | Re-downloadable                     |

The schema is fully reproducible from this repository with no backup at all.
`npx vitest run --project database src/lib/__tests__/db-twin.test.ts` applies
all 95 migrations to real PostgreSQL, runs each verification script immediately
after its own migration, then rolls every one back in reverse against the full
schema.

## Storage is two halves and needs both

A file has bytes in Supabase Storage and a row in `storage.objects` saying
which bucket it is in, what it is called and who owns it. A database restore
that omits those rows leaves every customer file intact and unreachable — the
account can list nothing. The rehearsal covers the rows; the bytes are
Supabase's object storage and survive a database loss on their own.

There is no browser vault. `PLAN.md` Phase 2 made the account the single
persistent authority, so there is no device-held ciphertext that a restore
cannot reach and no passphrase whose loss destroys data.

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

## Restoring against a real project

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

Then restore the managed backup **into that branch**, and answer the same
questions the rehearsal answers locally: row counts on the tables that matter,
`auth.users` present, `storage.objects` present, RLS policies present, and a
cross-account read that returns nothing. A restore that loses RLS policies is
worse than no restore — it has good row counts and is a breach.

Only promote during a window where writes are paused; otherwise the restore
silently discards everything written since it was taken.

## Rolling back one migration

Each migration has a matching rollback. They are written to be run newest-first
and are rehearsed in that order by the twin.

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/rollback/<timestamp>_<name>_rollback.sql
```

Read it first. Some are destructive by nature: a rollback that drops a table
drops its rows, and the file says so where that is true. Some deliberately keep
data — the support-access rollback keeps its audit rows, because a rollback that
erased the record of who read what would be a rollback covering its own tracks.
A migration must therefore be re-appliable over what its rollback left behind,
and the rehearsal proves exactly that on the newest one.

## Rolling back the application

Three deployables, three answers:

| Deployable        | Rollback                                                                                                 | Proof                           |
| ----------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Cloudflare Worker | `npm run deploy:rollback` to a named prior immutable version id, separately approved and health-verified | `deployment-controller.test.ts` |
| Edge Function     | Redeploy the source recorded in `release/OCADE_EDGE_FUNCTION_RELEASES.json`                              | `npm run edge:rollback-prove`   |
| Database          | The rollback script for each migration, newest first                                                     | `npm run recovery:prove`        |

`npm run edge:release-check` says whether the working tree still produces the
deployed Edge Function source. "Ahead" is the ordinary state between a change
and its deployment; what must never appear is a deployed function this ledger
does not record. `npm run edge:rollback-prove` reconstructs the recorded source
out of git and re-hashes it, so the rollback target is something that has been
rebuilt rather than something written down.

## What to do first, in an actual incident

1. **Stop writes** before restoring anything. A restore under live traffic
   produces a database that is neither the backup nor the current state.
2. **Take a fresh backup of the broken state.** It is evidence, and sometimes
   the broken state contains the only copy of something.
3. **Restore into a branch and verify there.** Every step above.
4. **Then promote**, and record what was lost. Users are owed the truth about a
   gap, including its start and end time.

The root `BREACH_RUNBOOK.md` and `release/OCADE_INCIDENT_RESPONSE_RUNBOOK.md` cover the case where the incident is a compromise rather
than a loss. If both, that runbook takes precedence: preserving evidence comes
before restoring service.
