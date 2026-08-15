# OCADE Data-Rights and Grievance Process

**Status:** pre-launch design; no live submission channel yet

## Public flow

1. The public `/data-rights` page prepares a request locally in the browser.
2. It clearly says nothing is uploaded or submitted.
3. Before launch, replace that temporary state with a verified monitored channel
   and publish its service hours and acknowledgement target.
4. Never ask users to send Aadhaar, PAN, passwords, payment credentials or OTPs.

## Internal case flow

1. Record a case ID, received time, request type, jurisdiction and owner.
2. Acknowledge receipt without exposing account data.
3. Verify identity proportionately using existing account control first.
4. Search every mapped system/vendor for relevant data.
5. Apply legal holds and document any lawful refusal or limitation.
6. Access/correct/delete/withdraw/grievance action is independently reviewed.
7. Respond through the verified channel, state what happened and explain appeal.
8. Record completion, vendor confirmations and backup-expiry date.
9. Retain only the evidence required to demonstrate handling.

## Engineering gates before activation

- account-side authenticated request option and a fallback for locked-out users;
- rate limiting, spam controls and CSRF protection for any web form;
- case access restricted to trained privacy/support staff;
- audit log that does not contain the full request or identity document;
- export formats, correction paths and deletion jobs tested in staging;
- Supabase, object storage, logs, analytics, payment and support vendors included;
- nomination and grievance escalation reviewed for the DPDP framework; and
- response deadlines configured per jurisdiction after lawyer approval.

## Request template

```text
OCADE data-rights request
Request: [access / correction / deletion / withdrawal / grievance]
Account reference: [email or account ID used with OCADE]
Details: [specific data or issue]
Preferred response channel: [safe email]
Country/region: [location]
Please explain any identity verification needed before I send sensitive data.
```
