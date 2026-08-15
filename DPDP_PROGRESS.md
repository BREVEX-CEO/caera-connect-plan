# OCADE DPDP Progress

**Snapshot:** 15 August 2026
**Status:** engineering readiness tracker, not legal certification

The 14 November 2025 Indian commencement notification phases the DPDP Act and
Rules. OCADE’s planned 28 August 2026 launch comes before the final eighteen-month
phase, but the safer plan is to finish the product controls before collecting
public user data. A qualified Indian privacy lawyer must confirm applicability
and the exact launch obligations.

## Evidence found

| Control                 | Current evidence                                                                   | Status                                                        |
| ----------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Data minimization modes | Browser/device-local and Private Sync routing; cloud approval paths                | Implemented source; production proof pending                  |
| Account isolation       | RLS enabled on every inspected public table; policies exist                        | Live read-only evidence; policy behavior tests still required |
| File isolation          | `messenger` storage bucket is private with account-scoped policies                 | Present; bucket has no explicit MIME/size allowlist           |
| Consent/telemetry       | Failure telemetry is opt-in and off by default; no advertising/analytics SDK found | Present in source                                             |
| Public notice           | `/privacy` plus `docs/legal/PRIVACY_NOTICE.md`                                     | Draft; lawyer/provider/retention details pending              |
| Rights/grievance        | `/data-rights` local request builder and documented case flow                      | Preparation only; no receiving channel/backend                |
| Breach response         | `BREACH_RUNBOOK.md`                                                                | Draft; contacts and production drills pending                 |
| Children                | No approved age/parental flow                                                      | Blocker                                                       |
| Retention               | No complete approved schedule or tested deletion/backups map                       | Blocker                                                       |
| Vendor register         | Supabase/Cloudflare/auth/AI/payment/store categories identified                    | Exact production entities/terms/locations pending             |
| Privacy contact         | Intended email names supplied by owner                                             | Not verified or monitored                                     |

## Required before public data collection

- [ ] Incorporation/provider decision and correct data-fiduciary identity.
- [ ] Working grievance/privacy contact with named owner and tested delivery.
- [ ] Complete field-to-purpose-to-recipient-to-retention data inventory.
- [ ] Plain-language notice presented at collection and versioned consent record.
- [ ] Consent withdrawal as easy as consent where consent is used.
- [ ] Children/age policy and engineering enforcement.
- [ ] Authenticated access/correction/erasure flow plus locked-out-user process.
- [ ] Retention/deletion jobs, backup expiry and vendor deletion tests.
- [ ] Cross-border/vendor assessment for every enabled provider and model.
- [ ] Incident notification decision tree reviewed against then-current Rules.
- [ ] Staging privacy test with two accounts proving no cross-account reads.
- [ ] Storage bucket size/MIME restrictions designed and migrated without
      breaking required document types.
- [ ] Production rate limiting for account, rights and AI endpoints.

## Cookie/consent decision

Do not add a generic banner merely for essential auth, preference and offline
storage. There is no non-essential analytics/advertising tracker in the audited
source. If analytics, remarketing, session replay or a non-essential SDK is
added, keep it uninitialized until the applicable consent choice is recorded,
and update the notice, vendor register and withdrawal UI before deployment.

## Official baseline

- https://www.meity.gov.in/data-protection-framework
- https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa
- https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf
