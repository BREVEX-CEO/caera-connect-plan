# OCADE Owner, Admin, Staff and Operations Authority

## Canonical surface

Use `admin.ocade.in` as the privileged operations surface with secure OCADE SSO.

Normal customers must not see Owner/Admin/Staff wording, links, route hints or privileged data.

Primary Owner sees Owner Console.
Backup Owner sees Owner Console with the primary-owner protection described below.
Granted staff sees Staff Console with only granted modules/actions.

Frontend hiding is never authorization. Server-side role/permission checks and RLS are mandatory.

## Identity model

The primary owner account is bootstrapped once to a stable server-side user identity after verification. Do not hardcode email authorization in React/client code.

Staff grants entered by email resolve to a verified stable user UUID before authorization is stored.

Owner remains able to use normal OCADE Chat/JARVIS/Library like any customer.

Owner product entitlement may be unlimited while usage/cost telemetry continues internally.

## Roles

- Primary Owner: full operational authority.
- Backup Owner: same normal operational authority but cannot remove/demote Primary Owner.
- Admin: broad delegated operations but cannot create/remove/promote Owners.
- Support.
- Billing.
- Developer/Operations.
- Read-only.
- Granular permission overrides on top of roles.

Only Primary Owner may promote Backup Owner. Require fresh 2FA, explicit confirmation, written reason and audit.

## 2FA and assurance

OCADE's currently failing TOTP enrollment is a release bug and must be fixed first.

During bootstrap, Primary Owner may view the console, but privileged/sensitive mutations remain locked until required authentication assurance is satisfied.

After repair, Owner/Admin/Staff privileged work requires 2FA according to action sensitivity. Sensitive actions require recent assurance.

Never display passwords, MFA secrets, raw tokens, provider secrets or full payment credentials.

## Staff grant workflow

Owner Console:
1. enter existing user's email;
2. server resolves verified account to stable UUID;
3. choose role;
4. choose granular permissions;
5. review;
6. Grant Staff;
7. write audit event;
8. invalidate/reissue authorization so changes are immediate across active sessions.

If account does not yet exist, create a pending invitation. Staff sets/recover its own credentials. Role activates only after verified account creation.

Staff cannot raise its own privileges.

Disabling staff immediately revokes privileged sessions/permissions while the person's normal OCADE account may remain.

Provide emergency “Revoke all staff privileged sessions”.

## Dashboard modules

Build real modules only:
- Overview;
- Customers;
- Staff;
- Usage;
- Devices;
- JARVIS Tasks;
- Security;
- Support;
- System Health;
- Audit.

Payment-specific modules stay hidden until payment-provider work resumes.

No fake/demo operational metrics. If data has no real authority, hide it or show truthful unavailable state.

## Button/function completeness rule

Every visible actionable control must have:
- real backend authority;
- role/permission check;
- loading state;
- disabled state;
- success state;
- customer/operator-safe error;
- retry/recovery behavior where applicable;
- audit event where required;
- unit/integration regression;
- real browser/UI verification;
- adversarial authorization test.

A rendered button with no proven backend/result path is incomplete.

## Customer management

Based on permission, Owner/Admin/Support can search by approved identifiers and view safe operational state.

Supported actions include:
- plan/entitlement view/change where currently supported;
- usage adjustment;
- supported reset-window action;
- complimentary access;
- revoke sessions;
- remove devices;
- disable/recover account;
- support context;
- account deletion workflow where legally/product supported.

Never rewrite historical financial/usage records. Use append-only adjustments/reversals.

## Conversation privacy

Conversations remain private and are not a general staff browsing surface.

Owner may create a case-specific, reasoned, audited temporary grant to named Support staff for one scoped account/conversation, with expiry. Staff receives no automatic broad conversation visibility.

Where product/legal policy supports it, customer security/account history should expose meaningful privileged-access events without leaking internal security notes.

## Device operations

Owner/admin device removal must stop any active task locally before credential authority disappears.

Required test:
active physical action -> remove device -> local cancellation -> process/input stops -> credential revoked -> task cancelled -> late result rejected -> cannot execute again.

## Emergency controls

Provide a global JARVIS device/mobile execution STOP that leaves ordinary Chat/account access usable.

Safety controls are server-authoritative, reasoned and audited.

If execution-control state cannot be read, physical execution fails closed.

## Audit

Every privileged mutation should record, where relevant:
- actor;
- role;
- target;
- action;
- previous state;
- new state;
- reason;
- timestamp;
- session/device context.

Audit is append-only and not a substitute for authorization.

## Security tests

Use Primary Owner + Staff + Customer A + Customer B.

Test:
- hidden privileged surface for customers;
- direct URL attempts;
- privilege escalation;
- staff self-promotion;
- stale session after revoke;
- immediate permission changes;
- cross-account reads;
- 2FA freshness;
- device removal;
- conversation case grant/expiry;
- audit completeness;
- emergency controls.

Every phase reports commercial-launch readiness percentage.
