# OCADE Personal-Data and Security Breach Runbook

**Status:** pre-launch operational draft; lawyer and incident-owner approval required

## 0–15 minutes: contain and preserve

1. Open an incident record with UTC/IST time, reporter and initial scope.
2. Assign incident commander, security lead, privacy/legal lead and recorder.
3. Stop active exposure using the narrowest reversible control: revoke a key,
   disable an endpoint/provider, isolate a deployment or suspend a compromised
   account. Do not delete evidence or broadly wipe systems.
4. Preserve relevant immutable logs, deployment hashes, policy versions and
   provider event IDs with access restricted to the incident team.
5. Rotate exposed credentials through the owning provider and record exactly
   what was invalidated. Never paste secrets into the incident document.

## 15–60 minutes: establish facts

- What system, data classes, users, countries and time window are affected?
- Was confidentiality, integrity or availability harmed?
- Is the exposure ongoing? Can another account reproduce it?
- Were children, credentials, financial data, private files or control actions involved?
- Which vendors/processors must be notified under contract?
- Are backups, logs, support tools, local devices or object storage affected?

Use read-only queries first. Preserve receipts for every containment action.

## 1–4 hours: risk and notification decision

The privacy/legal lead reviews the then-current DPDP Act/Rules, CERT-In
directions, contracts and affected-country laws. Record who decided, the facts
available, deadlines, recipients and reasons. Do not wait for perfect certainty
before escalating a possible statutory deadline.

Prepare separate factual notices for authorities, affected people, processors
and internal teams. State what happened, likely consequences, containment,
protective steps and contact. Do not speculate, blame or promise zero risk.

## Recovery

1. Patch the root cause in an isolated branch and add a regression test.
2. Review RLS/storage policies, auth sessions, CORS/origins, rate limits, uploads,
   vendor access and logs relevant to the incident.
3. Deploy through normal review with a rollback plan.
4. Independently verify the exposed path is closed and authorized paths work.
5. Monitor for recurrence and unauthorized credential/session use.

## Aftercare

- Provide a user support and grievance path.
- Complete vendor/authority follow-ups and deletion requests.
- Write a blameless post-incident review with cause, impact, timeline and actions.
- Track corrective actions to owners and dates; test them in the next exercise.
- Retain incident evidence only under the approved security/legal schedule.

## Contacts to activate before launch

| Role                       | Name/channel                                   | Status  |
| -------------------------- | ---------------------------------------------- | ------- |
| Incident commander         | Owner to assign                                | Blocker |
| Privacy/grievance lead     | Owner to assign                                | Blocker |
| Indian privacy counsel     | Owner to retain                                | Blocker |
| Supabase escalation        | Project support path to record                 | Blocker |
| Cloudflare escalation      | Account support path to record                 | Blocker |
| Public security contact    | Intended domain email not yet active           | Blocker |
| CERT-In/authority workflow | Lawyer/security lead to verify current process | Blocker |

Run one planted staging breach exercise before launch and retain the timeline,
decisions, notification draft and recovery proof.
