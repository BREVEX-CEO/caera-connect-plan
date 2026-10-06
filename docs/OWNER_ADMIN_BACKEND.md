# OCADE Owner, Admin, Staff and Operations Authority

## Canonical surface

The Owner Console and the Staff Console are pages of normal `ocade.in` (`/admin`), owner authority 2026-10-03 (PLAN.md Phases 53–54). `admin.ocade.in` is retired: it never went live, its route, code and session table are gone.

Normal customers must not see Owner/Admin/Staff wording, links, route hints or privileged data.

Primary Owner and every other Owner see "Owner Console"; granted staff see "Staff Console", with only the modules their permissions hold. The entry sits in the sidebar beneath Chat, OCADE JARVIS and Library, shown only when `ocade_my_staff()` (the caller's own row, from the database) answers.

Frontend hiding is never authorization. Server-side role/permission checks and RLS are mandatory.

### How the integrated console holds authority (implemented 2026-10-03, migration `20261003090000`)

- Staff authority rides the account's own site session. Every request asks the database: role and permission in `public.ocade_staff`, a session that has not been ended, the second factor answered in this session (all staff but a Primary Owner still setting it up, who may look and never change), and no factor added during this session (a stolen token cannot enroll its own authenticator and answer it). Changes also need a recent proof (`private.ocade_staff_require`) and a reason, and are audited.
- Removing a role takes effect at the database on the next request. An open console re-reads its access every 10 seconds and on focus; when it is gone the page returns to Chat and the sidebar entry disappears, with no explanation. Refresh or a new sign-in does not bring it back.
- Sessions arriving in an address are never taken up (PKCE). Chat answers render without raw HTML; the CSP forbids framing and limits connections to the configured backends.
- Trade-off, recorded: the retired separate origin also kept a token lifted from the chat page from reading staff data. The owner chose one origin; what replaces that protection is the second factor bound to the session, the in-session-factor refusal, recent proof for every change, the 10-second revoke, and the emergency staff sign-out.

### Unlimited use and ownership (2026-10-03)

- Owners (Primary and other Owners) are never stopped by a usage window; usage and cost telemetry are still recorded. The decision is made in `public.ocade_consume_commercial_work`, the one place every allowance (Chat, JARVIS, offline leases) is enforced.
- An owner gives any other account unlimited use until a date or until revoked (`ocade_grant_unlimited`), or returns it to normal limits (`ocade_revoke_unlimited`): owner-only, never oneself, recent code, reason, audit (`unlimited_granted`, `unlimited_revoked`). Use it for test accounts that would otherwise hit a legitimate limit; never a hidden bypass.
- The Primary Owner names other Owners (`backup_owner` in the database, "Owner" on screen) and hands Primary Owner over only to an existing Owner, with a recent code, a reason and an explicit confirmation; the former Primary Owner stays an Owner or leaves the staff, as chosen. There is always exactly one Primary Owner; the Primary Owner cannot be removed or demoted by an ordinary control.
- The initial Primary Owner is the verified account `caeracadane28@gmail.com`, bootstrapped once and held by its user id (`a7d48c60-…`). (The owner's 2026-10-03 note spelled it `carecadane28`; no such account exists.)

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


## Current simplification rule — 2026-10-06

Owner and Staff controls remain privileged operational surfaces rather than a second product. Keep only actions that are necessary for account, entitlement, security, device, support, audit and service operations. Hide modules the current role cannot use and remove duplicate status calculations or alternative authority paths once the canonical backend source is proven.

Privileged UI simplification must never move authorization into the browser. Server-side role, RLS, recent authentication, audit, revocation and last-owner protection remain mandatory even when the interface becomes smaller.

Customer-facing navigation must remain free of privileged hints. The normal product should not become more complex in order to expose administrative internals.

## Current execution authority — 2026-10-06

This document governs Owner and Staff backend authority and privileged UI, while `PLAN.md` is the single current execution roadmap. Older phase-range wording is historical context only. Newer Owner decisions in `PLAN.md` supersede older conflicting detail.
