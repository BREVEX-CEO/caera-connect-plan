# OCADE operations: support, incidents, status and recovery

This is the runbook for the people who operate OCADE (requirement 181). It names only
controls that exist in this repository. Commercial launch, production deployment and any
step that spends money still need the owner's separate approval (plan.md §11).

## 1. Support procedure

1. **Receive.** A customer writes to the support address in Terms §25, or opens Help.
   Never ask for a password, a one-time code, an API key or a recovery code; if one is
   sent, tell the customer to change it and delete the message.
2. **Identify.** Find the account in the Owner/Staff Console, Customers. You see account,
   usage and security facts; you never see conversations or files.
3. **Diagnose on the computer.** For JARVIS problems, ask the customer to run
   `ocade_agent diagnose` and send its output. It lists what to fix (pairing, folder,
   server, browsers, engines, add-on tools, workers, macOS permissions, STOP, the newest
   crash report) and shows no file contents, keys or tokens. A crash report under
   `crash-reports/` in the companion's folder holds only the release, platform, error type
   and code locations; the customer chooses whether to attach it.
4. **Read a conversation only under a case.** If the problem needs the conversation, the
   customer shares it with `Share with support` for 1 to 72 hours, or you open a case in
   the console. The customer is told, every read is written to the audit record, and access
   ends when the case closes or expires.
5. **Act through the console only.** Ending sessions, resetting a second factor, giving back
   usage, suspending, deleting: each asks for a recent code, a reason of at least ten
   characters, and is written to the audit record.
6. **Close.** Close the case with what was done. An unresolved defect goes into plan.md
   Appendix D with its cause and status.

## 2. Incident response

Severity: **critical** = wrong or unauthorised effects on customer computers, data exposure,
or a compromised key; **high** = JARVIS or sign-in unavailable for many customers;
**normal** = everything else.

1. **Record** the time, the release (`/api/health` reports it) and what was seen.
2. **Stop dangerous admission.** Owner/Staff Console → System → Emergency pause:
   - _New JARVIS tasks_ stops new tasks; running tasks continue.
   - _Work on customers' computers_ stops every dispatch at once, including detached jobs.
   - _Android companion_ stops the phone companion.
     A pause needs `execution.manage`, a recent code and a reason; it applies on the next
     request, and customers see that JARVIS is paused.
3. **Revoke compromised authority.** A stolen device key: the customer removes the device in
   Settings → Devices, or staff with `devices.manage` remove it in the console (Customers →
   the account → Remove device, with a recent code and a reason). Its tasks stop, the customer
   is told, and its signatures are refused at once.
   Stolen customer sessions: _End sessions_. Compromised staff: _Sign all staff out_ and
   remove the member. A leaked server key: rotate it in the hosting provider, then redeploy.
4. **Preserve minimal evidence.** Health records (`ocade.health` log lines) hold only
   enumerated values. Do not copy customer content into tickets or chat.
5. **Assess** affected accounts and actions from the audit record and task states. Steps
   whose effect is unknown are already marked so; they are never re-run automatically.
6. **Recover** (section 4), then **reconcile** unknown effects with the customers concerned.
7. **Communicate** verified impact only (section 3), then **retest** before resuming the pause.

## 3. Service status communication

- **In the product:** a paused service, an unreachable computer and a waiting task each
  show their own plain state; nothing claims success it did not observe.
- **Health:** `GET /api/health` returns the release and whether the web service is answering.
- **Customers by message:** use the _Account_ notification category for incidents that
  affected an account, and _Security_ for anything that needs the customer to act (change a
  password, review devices). Say what happened, what was affected, what OCADE did, and what
  the customer should do; never speculate.
- A public status page does not exist yet; until it does, post incident notices on the
  website after the owner approves the wording.

## 4. Recovery

- **Database.** Backups are the hosting provider's. The restore procedure is exercised by
  `tests/jarvis/db/restore.sh` in CI on a disposable database (full dump, restore, row-level
  security and data fingerprint checks, a corrupt dump refused). Every migration after the
  task-authority baseline has a rollback in `supabase/rollback/`, proven by
  `tests/jarvis/db/rollback-roundtrip.sh`. Apply a rollback only to staging first.
- **Website.** Redeploy the previous release (`npm run deploy:rollback`; owner approval
  required for production).
- **Companion.** A damaged update falls back to the previous valid release automatically;
  `ocade_agent rollback-update` restores it on request. `ocade_agent stop` sets a local STOP
  that nothing overrides until the person starts the companion again.
- **A task.** Take Over pauses it, Continue resumes it from its checkpoint with a fresh
  controller, and STOP ends it; unknown effects wait for the person's answer.

## 5. Releases

Each release adds an entry to `RELEASE_NOTES.md`: version, date, what changed for customers,
known limitations, and the database migrations staging and production must apply.

**Background planner queue (once per Cloudflare account, before the first deploy that binds it).**
`wrangler.json` binds the Cloudflare Queue `ocade-jarvis-planner` as `JARVIS_PLANNER` and consumes
it in `src/cloudflare-entry.ts`. JARVIS planning turns then run in the consumer instead of inside the
companion's request. A deploy fails until the queue exists. The owner creates it with:

```bash
npx wrangler queues create ocade-jarvis-planner
```

Queues are on the Workers free plan (10,000 operations a day). Without the binding, planning runs
inline as before.
