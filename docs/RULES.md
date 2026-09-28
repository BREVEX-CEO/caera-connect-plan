# OCADE Project Rules

## General rules

- Every change must follow the owner request, PLAN.md, and canonical documents.
- CARCC is the company and OCADE is the product.
- Chat and JARVIS remain separate experiences with protected regression boundaries.
- Do not invent capability that has not been implemented and tested.

## JARVIS source rules

- Never modify or delete the uploaded original ZIP.
- Never modify or delete the immutable source-original snapshot.
- Use the extracted working runtime as the primary JARVIS engine.
- Preserve useful original functionality rather than rewriting it merely for style.
- Remove active old GUI/API-key behavior only after the new path works.
- Preserve the generic plugin subsystem but keep it unused/customer-hidden.
- Preserve the old phone dashboard but do not expose it as the final remote-control product.

## Code organization rules

- Keep React/TypeScript web code under the existing web source structure.
- Keep active Python/runtime JARVIS code outside the React src tree.
- Create a shared protocol/contract only when real cross-runtime communication requires it.
- Avoid duplicate routers, usage authorities, memory authorities, provider clients, and permission systems.

## Intelligence rules

- JARVIS is Online-only.
- Never route JARVIS through Offline Intelligence.
- Never ask customers for provider API keys.
- Never expose provider/model/vendor identity in normal customer UI.

## Browser-control rules

- Prefer semantic DOM/accessibility control over visual coordinates.
- Use Playwright/browser tooling before coordinate fallback.
- Re-observe after resize, zoom, navigation, tab changes, scroll changes, or responsive reflow.
- Never reuse stale screen coordinates.
- Verify the result of meaningful actions before continuing.
- Pause for CAPTCHA/passkeys/OTP/2FA when human authentication is required.
- Never bypass security challenges.
- Never perform the final purchase action.

## UI rules

- Keep JARVIS minimal, professional, monochrome-first, and responsive.
- Use the orb/graph as a real data visualization.
- Do not create random decorative data relationships.
- Keep Activity customer-safe.
- Keep Stop and Take Over prominent during automation.
- Respect reduced motion and accessibility.

## Data rules

- Reuse approved OCADE account/conversation authorities where documented.
- Keep JARVIS memory logically separate from Chat memory.
- Retain detailed JARVIS activity for 90 days.
- Keep raw visual frames temporary unless explicitly retained for a valid user purpose.
- Never store provider secrets or payment card security codes.
- Keep one-time authentication secrets ephemeral.

## Usage rules

- Chat and JARVIS use separate plan allowances.
- JARVIS resource-bearing internal work may consume JARVIS usage.
- Failed/no-result work must not be blindly charged.

## Testing rules

- Add tests before or alongside integration work.
- Keep the original source snapshot outside autofix/format/dependency-upgrade passes.
- Keep all existing Chat/Offline verification green.
- Distinguish live proof, browser proof, local proof, database proof, blocked cases, and untested cases.

## Forbidden practices

- Do not delete preserved source to reduce LOC.
- Do not merge Chat into JARVIS.
- Do not add Offline JARVIS.
- Do not fake desktop/mobile control.
- The owner has started the deeper-device mission; implement only the approved Device Agent/extension architecture in PLAN.md Phases 13–23 and docs/JARVIS_DEVICE_ROADMAP.md.
- Do not weaken permission, security, validation, accessibility, or test boundaries for convenience.

## Deeper-device rules

- PLAN.md Phases 0–12 remain protected completed-baseline rules; Phases 13–23 extend them.
- Read `docs/JARVIS_DEVICE_ROADMAP.md` before editing Device Agent, extension, deep-control, wake/background or mobile-remote code.
- Never replace useful completed browser behavior merely to implement desktop control.
- Public Device Agent builds must be signed/notarized; development-only unsigned builds must not be represented as production.
- Device enrollment may be effortless, but every device still needs a unique revocable cryptographic identity.
- Never persist the user's account password as a device-control credential.
- One task owns mouse/keyboard/UI control per device at a time.
- Physical user input pauses UI automation.
- Never bypass UAC/admin-password/CAPTCHA/OTP/passkey or equivalent human-security boundaries.
- Whole-computer file access is not the silent default.
- Prefer Trash/Recycle Bin; permanent deletion requires confirmation.
- A Chrome extension must use minimum required permissions and must not inject into unrelated tabs.
- Provider/model/vendor/key identities remain customer-hidden.
- Three Online capacity slots are operational redundancy, not a quota-evasion mechanism.
- JARVIS opens text-only; microphone permission is requested on first Voice use.
- PC wake-word detection stays local before activation.
- Mobile remains web/PWA-first; do not fake unsupported OS-wide third-party-app control, persistent overlays or background behavior.

## Latest engineering/product rules — 2026-09-28

- Use full-sentence requirements and reports. Do not compress important behavior into ambiguous one-word checklist items.
- Reproduce historical bugs on latest main before fixing them. Do not assume an audit finding is still current merely because it existed on 2026-09-27.
- Fix root causes and shared authorities rather than layering patches around symptoms.
- Use automatic safe defaults to reduce customer choice stress; do not convert every backend option into a UI setting.
- Keep normal UI clean and move long explanations into Help.
- Never expose provider/model/vendor/key identities, customer/staff plaintext passwords, MFA secrets, raw tokens, full card data, or processor/provider secrets to ordinary product/admin UI.
- Never bypass CAPTCHA, OTP, passkey, UAC, Android security prompts, Apple platform restrictions, or equivalent human/security boundaries.
- A legitimate OS warning should be reduced through proper signing/trust/reproducible packaging, not hidden by unsafe bypasses.
- Use the MCP/testing stack as test instrumentation only. Shipping JARVIS uses OCADE-owned runtimes.
- One UI automation actor controls a target at a time; independent tools verify in separate passes.
- Use Caveman and Ponytail only on active production code. Preserve immutable donor/import snapshots byte-for-byte.
- Delete or rename code only after ToRemove.md evidence and relevant tests.
- Do not claim "zero bugs", "unhackable", "real iPhone proof", or similar absolutes that evidence cannot support.
- Merge product implementation only when no known Critical or Major release blocker remains for shipped capabilities and final deployment identity is verified.

## Multi-MCP operating rules — 2026-09-28

- Do not launch every MCP simultaneously. Assign one active controller per target surface.
- Do not let Playwright and physical desktop automation control the same browser at the same time.
- Do not let Appium and Mobile MCP drive the same emulator/device at the same time.
- Use DevTools primarily as a browser observer/debugger while Playwright acts.
- Record durable checkpoints before long-context limits, rate limits, restarts, or handoffs.
- Continue independent tests when one tool is blocked.
- Never convert a blocked test into a pass.
- Never fix by repeatedly rerunning a flaky test until it happens to turn green.
- Require real visual QA for material UI changes.
- Use the full autonomous fix loop in `docs/MCP_ORCHESTRATION_AND_AUTONOMOUS_FIX_LOOP.md`.
