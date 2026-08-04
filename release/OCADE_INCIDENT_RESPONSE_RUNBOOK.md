# OCADE production incident runbook

Status: source-complete procedure; no production monitoring, on-call assignment,
backup verification, restore drill, migration, deployment, or incident exercise
is claimed.

The machine-readable contract is
`release/OCADE_PRODUCTION_OPERATIONS.json`. Assign every `OWNER_REQUIRED` field
and attach live evidence before production launch.

## Declare and contain

1. Open one incident record in UTC. Name the incident commander and severity.
2. Preserve the alert, health response, deployed version, prior verified
   version, relevant structured events, and configuration hashes before making
   a change. Never copy credentials or user content into the record.
3. Stop new deployments. For a security or privacy incident, revoke affected
   sessions, extension/mobile pairings, signing keys, provider credentials, and
   execution grants as applicable. Do not erase evidence.
4. State the observed impact and evidence. Do not infer successful delivery,
   recovery, isolation, or data integrity from an accepted command.

## Triage

- Web failure: probe the exact HTTPS `/api/health` endpoint and compare
  `service`, `version`, and status with the release manifest. Review the
  Cloudflare deployment/version history and Worker observability.
- Relay failure: probe HTTPS `/health`, confirm the hardened container is
  running, and inspect only the structured allow-listed event fields. The relay
  has no durable message history; clients must recover through their
  reconnect/replay protections.
- Authentication or tenancy incident: disable affected access, preserve audit
  records, and run the prepared cross-tenant verification SQL in an authorized
  isolated environment before reopening.
- Bad release: use the separately approved rollback command with the explicitly
  recorded prior version. A zero exit is insufficient; the independent health
  probe must report the expected rollback version.
- Suspected data loss: stop writes where safely possible. Restore only into a
  separately authorized isolated project, run every verification script,
  reconcile critical records, and obtain owner approval before any cutover.

## Communicate and recover

SEV1 incidents are acknowledged within 5 minutes and updated every 15 minutes;
SEV2 within 15 and every 30; SEV3 within 60 and every 120. Communications must
separate facts, scope, mitigations, remaining risk, and next update time.

Recovery is complete only when the affected service is independently observed,
the expected version is live, security/tenant checks pass, queued or ambiguous
operations are reconciled without replay, and the incident commander records
the evidence. Keep the incident open when any check is unavailable.

## Review

Within five business days, record the UTC timeline, impact, detection gap,
technical and organizational causes, what limited impact, recovery evidence,
and corrective actions with named owners and dates. Test every corrective
control that can fail. Do not mark an action complete from documentation alone.
