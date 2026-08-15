# OCADE Privacy Notice — Pre-launch Draft

**Status:** lawyer review, service-provider verification and contact activation required

**Last updated:** 15 August 2026
**Not effective:** do not publish as final or collect production users under this draft

## 1. Proposed data fiduciary

Before incorporation and a written IP/data-controller transition, Haans Antoni
operates the CAERA CADANE brand and is the proposed data fiduciary for OCADE.
Before launch, replace this paragraph with the verified provider name, legal
form, registered address, grievance officer/contact and privacy contact. Do not
publish a CIN, GSTIN or company founding date until issued and verified.

## 2. Scope

This notice covers the OCADE website, account, optional Private Sync, web/cloud
features, desktop/mobile applications, support and security operations. A local
file that never leaves the device is not collected by the provider merely
because local OCADE software processed it.

## 3. Data categories

OCADE may process:

- account identifiers, authentication methods and security events;
- profile, preferences, privacy mode and consent records;
- registered-device identifiers, pairing approvals and entitlement status;
- conversations, messages, projects, settings and files selected for Private
  Sync or a user-approved cloud operation;
- prompt/request content sent to a disclosed cloud model, search or live-data
  provider when the user permits that operation;
- subscription, tax region, payment status and provider references (not full
  card or UPI credentials, which should remain with the payment provider);
- support, grievance and data-rights correspondence; and
- minimized security, abuse-prevention and opt-in failure telemetry designed to
  exclude raw user content.

The final data map must name every production field, recipient, location,
purpose, lawful basis/notice, retention period and deletion path.

## 4. Storage and execution modes

- **Device/browser local:** supported content remains on the device.
- **Private Sync:** selected account data is stored in the configured Supabase
  project under account-scoped row-level security.
- **Cloud assisted:** minimum necessary data may go to a disclosed provider only
  when the selected privacy mode, consent/approval and entitlement permit it.

OCADE must never describe Private Sync or cloud-assisted processing as “entirely
on your machine.” Sign-in, sync, live web data, payments, remote device features
and cloud models require a network. Local capability depends on device support
and installed models.

## 5. Purposes

Data may be used to provide the selected feature, authenticate and secure the
account, sync selected data, enforce device and usage entitlements, prevent
abuse, process payments, diagnose opted-in failures, answer support/rights
requests and comply with law. No sale of personal data or targeted advertising
is planned. A new incompatible purpose requires a new notice and, where
required, a new consent.

## 6. Recipients and international processing

Potential recipients include Supabase, Cloudflare, selected authentication and
AI/search providers, payment processors, Apple/Google stores, professional
advisers and authorities when lawfully required. Before enabling a recipient,
record its exact legal entity, role, processing location, terms, retention,
security, subprocessors, transfer safeguards and deletion support.

## 7. Retention

The following periods are not yet approved and must not be invented:

| Record                 | Launch requirement                                                   |
| ---------------------- | -------------------------------------------------------------------- |
| Account/profile        | Retain while needed for the account plus a documented closure window |
| Private Sync content   | User-controlled deletion plus a documented backup-expiry window      |
| Security/audit events  | Short, risk-justified period with restricted access                  |
| Payment/tax records    | Period required by applicable accounting and tax law                 |
| Support/rights records | Period needed to prove response and resolve disputes                 |

Subscription expiry must not by itself erase or lock supported local data.

## 8. Rights, withdrawal and grievances

Depending on applicable law, a person may request access/a summary, correction,
erasure, withdrawal of consent, grievance handling and nomination. Requests must
be acknowledged, identity must be proportionately verified, actions must be
logged and the response/escalation deadline must be published. Never ask a user
to email Aadhaar, PAN, passwords, payment credentials or one-time codes.

The current public data-rights page only prepares request text locally; it does
not transmit a request. Activate and test a monitored channel before launch.

## 9. Children

Age eligibility, parental consent/verification and the product decision on
children are unresolved. Do not target or knowingly onboard children until a
lawyer approves the rule and the engineering controls match it.

## 10. Cookies, local storage and analytics

The audited source contains no advertising or third-party analytics SDK. OCADE
uses essential local storage for authentication, preferences, security and
offline operation. No non-essential analytics or marketing technology may be
enabled until it is inventoried, documented and gated by the legally required
choice. Failure telemetry remains off until the user opts in.

## 11. Security and incidents

Controls include authentication, account-scoped RLS, private storage, signed
native requests, request/attachment limits and privacy-mode routing. These
reduce risk but do not guarantee absolute security. Incidents follow
[BREACH_RUNBOOK.md](../../BREACH_RUNBOOK.md). Before launch, verify backups,
deletion, breach contacts, vendor notification paths and production monitoring.

## 12. Contacts and changes

Inbound delivery to `support@ocade.in`, `privacy@ocade.in`,
`security@ocade.in` and `legal@ocade.in` was verified on 15 August 2026 through
Cloudflare Email Routing to `CAERACADANE28@gmail.com`. Branded outbound sending
from those aliases is not yet verified; responses may originate from the Gmail
address until a separate authenticated outbound mail service is configured.

Material changes require a dated notice and, where required, renewed consent.

## Official research baseline

- [Digital Personal Data Protection Act, 2023](https://www.meity.gov.in/data-protection-framework)
- [Digital Personal Data Protection Rules, 2025](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa)
- [14 November 2025 commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf)

The commencement notification phases provisions over immediate, one-year and
eighteen-month periods. OCADE’s planned August 2026 launch precedes the final
substantive phase, but the product should be designed to the target standard now.
