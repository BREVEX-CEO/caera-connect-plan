# Incident response runbook (OWN-049)

Who acts: the Primary Owner or an Owner. A second Owner approves any break-glass step.

## 1. Detect

- Alerts from `src/lib/ops/alert-rules.ts`: error rate, quota refusals, spend.
- A customer report through support.
- `ocade_service_control_events` and `ocade_admin_actions` show recent operator changes.

## 2. Contain (first 15 minutes)

1. Open the Owner console. Pause the narrowest switch that stops the harm: `jarvis_agent` (new tasks), `jarvis_execution` (work on customer computers), `jarvis_android` (companion). Give a reason of ten characters or more.
2. If you cannot act alone (second factor too old, or you must override a refusal), use break-glass: a second Owner calls `approveDualControl` (kind `break_glass`, scope = the switch name, at most 60 minutes). Then call `breakGlassServiceControl`. Both leave lines in `ocade_admin_actions`.
3. Revoke exposed credentials (see section 5). Do not paste secrets into chat or tickets.

## 3. Assess

- Read the audit trail (`listAudit`). Need an export? Use `exportAudit` with a second Owner's approval. The file is redacted and must be deleted by the date it returns (7 days).
- Decide the affected accounts, data and time range. Write them in the incident record (section 6).

## 4. Recover

- Fix and ship through the normal pipeline (CI green on the final SHA). No direct production edits.
- Resume switches one at a time with a reason. Watch the alerts for 30 minutes.

## 5. Credential leak

1. Rotate the key at the provider. 2. Update the secret in the host's secret store. 3. Run `npm run audit:history-secrets` and `npm run audit:artifact-secrets`. 4. Record what the key could reach.

## 6. Record and learn

Within 5 working days write: timeline, cause, customer impact, what worked, actions with owners. Store it with the incident. Notify affected customers as the law and `docs/SUPPORT_LEGAL_SECURITY.md` require.

## 7. Drill

Run a table-top drill every 6 months and after any major change to the switches: pick a scenario (leaked key, runaway spend, bad deploy), follow sections 1–6 with a second Owner, time each step, file the findings. The drill itself is an owner action; its date goes in `PROGRESS.md`.
