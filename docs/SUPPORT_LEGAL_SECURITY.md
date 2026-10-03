# OCADE Support, Legal and Security UX

## Help

Help should contain longer setup/security explanations so normal product surfaces remain concise.

Cover:

- Chat and JARVIS difference;
- JARVIS Online-only behavior;
- Device Agent/tray;
- existing-browser work;
- Android install/bubble;
- Apple-supported paths;
- voice/Hey OCADE;
- permissions;
- Stop/Take Over;
- offline Chat model storage/removal;
- account security/2FA;
- support contact/cases.

Do not expose provider/vendor/model identities.

## Errors

Customer errors are actionable and nontechnical.

Internal diagnostics use stable redacted codes/logs.

Never expose stack traces, provider keys, MFA secrets, raw tokens or sensitive system data.

## Authentication boundaries

CAPTCHA, OTP, passkey, UAC/admin-password and equivalent platform security boundaries remain human-controlled.

The current TOTP enrollment rejection must be treated as a product defect until reproduced/fixed/tested.

## Device safety

STOP is always obvious during active execution.

Device removal and global emergency controls must stop active execution, not only future work.

Physical execution fails closed if server safety-control state cannot be verified.

## Conversation privacy

Conversations are private by default.

Temporary Support access is case-specific, named, reasoned, time-bounded and audited.

## Legal/payment

JARVIS never completes final payment/purchase.

Payment-provider implementation remains deferred in the current coding mission.

Terms/Privacy must describe shipped behavior accurately, including device control, screenshots/transient data, mobile permissions and support access.

## Security claims

Do not claim unhackable, zero bugs or physical-device proof from simulation.

Use evidence-backed language.

## Incident response

Owner Console should support global JARVIS execution stop and staff-session emergency revoke.

Critical incidents remain auditable.

## Deferred tooling

Sentry project creation and paid leaked-password protection are currently deferred/non-blocking. Do not fake their availability.

## Master Phase 1–49 authority

Implementation order, phase gates, donor reuse, per-function completeness, MCP evidence and commercial-launch readiness reporting follow the unified `PLAN.md` Phase 1–49 roadmap. On a fresh clone Claude begins at Phase 1, preserves working behavior, repairs evidence-backed gaps, and continues through Phase 49.
