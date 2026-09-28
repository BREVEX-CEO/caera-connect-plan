# OCADE Support, Legal Surfaces, Privacy, and Security UX

## Help and support

- OCADE should include a first-party Help/Support experience on the OCADE domain rather than forcing users to search external technical documentation.
- Help search is the primary discovery experience.
- Help categories include Getting Started, Chat, JARVIS, Devices, Mobile, Billing, Privacy & Security, and Troubleshooting.
- Important setup and recovery flows use short visual step-by-step guidance.
- JARVIS may answer questions about using OCADE from approved help documentation.
- Customer-facing errors link to the relevant help article when that article is likely to solve the problem.

## Error handling

- Normal users see a short plain-language problem statement, the current state, and the next useful action.
- Actions may include Retry, Reconnect, Fix automatically, Grant permission, Open Settings, Reinstall/Repair, or Open Help.
- Raw Python, JavaScript, provider, Cloudflare, Supabase, database, or stack-trace detail does not appear in the normal error UI.
- Advanced diagnostics may expose safe technical detail to users who deliberately request it.
- Repeated production errors generate redacted diagnostics and stable incident identifiers.
- Safe automatic repair should be used where it cannot expand permissions or cause destructive changes.

## Monitoring

- Error monitoring should group repeated failures into operational incidents.
- Production diagnostics exclude secrets, raw passwords, MFA secrets, full payment details, provider keys, and unnecessary local filesystem/user information.
- Owner dashboard should surface high-frequency or high-severity incidents with affected surface, version, first/last occurrence, impact, and recovery status.

## Legal/customer policy surfaces

- Terms of Service, Privacy Policy, Acceptable Use Policy, Refund/Cancellation Policy, device-control disclosure, and required commerce/privacy notices are readable on the OCADE domain.
- Consent/tick boxes are used only where consent or acknowledgement is materially required rather than adding checkbox friction everywhere.
- Checkout shows required terms/tax/refund information before final purchase.
- Device control clearly explains that JARVIS can act on the user's computer/device within granted permissions and may make mistakes.
- OCADE does not market software as unhackable, guaranteed bug-free, or capable of bypassing operating-system security restrictions.

## Privacy and credentials

- Collect only the data necessary for product functionality, security, billing, support, and lawful operations.
- Do not sell conversation content to advertisers.
- If future monetization includes advertising or data-supported services, that change requires a separately approved privacy/product decision and must not silently repurpose private conversations.
- Passwords, MFA secrets, payment-card security codes, provider keys, authentication tokens, and other secrets are never stored in conversational memory.
- One-time authentication secrets remain ephemeral.
- Activity/log retention follows a defined schedule and should minimize raw screenshots and sensitive local data.

## Security operations

- Provide a security vulnerability reporting channel.
- Maintain an incident-response procedure.
- Customer/device permissions are stored as explicit policy/evidence where needed.
- Owner/staff high-impact actions are audited.
- Privileged admin actions use least privilege and stronger authentication.
- Security claims used in marketing should be backed by current evidence.

## MCP orchestration and autonomous verification linkage — 2026-09-28

- Current implementation and verification governed by this document must also follow `docs/MCP_ORCHESTRATION_AND_AUTONOMOUS_FIX_LOOP.md`.
- When multiple MCPs can touch the same surface, one tool acts and the others observe or verify sequentially so browsers, devices, files, and operating-system state are not corrupted by competing automation.
- Long runs must checkpoint durable progress before context compaction, rate limits, restart, or handoff. Resumed work continues from the next unfinished item instead of repeating completed work.
- A failure is not closed by a code change alone. Reproduce it, fix the root cause, run targeted and nearby integration tests, verify with the strongest available real browser/device/physical evidence, attempt to break the fix, and then run the broader regression slice.
- If one MCP or environment is unavailable, mark only that evidence class blocked and continue every independent test. Never treat blocked or emulated evidence as a real-device pass.
