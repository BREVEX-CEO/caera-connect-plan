# OCADE Agent Handbook

## Project overview

**CARCC** is the company and **OCADE** is CARCC's AI product. Current branding must not use CARCC CADANE or CADANE.

OCADE now has two active experiences: **Chat** and **OCADE JARVIS**. Chat remains the established conversational product with Auto, Online, and Offline Intelligence. JARVIS is a separate Online-only agentic experience at **/ocade-jarvis** that answers ordinary questions and performs browser-centered work when the user asks it to act.

JARVIS is additive and must not break, replace, or weaken Chat, Library, Settings, authentication, Offline Intelligence, usage, public/legal pages, or Admin.

## Authority order

1. The owner's current request is the highest authority.
2. PLAN.md defines the active JARVIS implementation mission.
3. docs/PRD.md defines product scope.
4. docs/TRD.md and docs/ARCHITECTURE.md define technical boundaries.
5. docs/APP_FLOW.md defines routes and user journeys.
6. docs/DESIGN.md and docs/UI UX Brief.md define UI.
7. docs/Backend Schema.md defines data/security rules.
8. docs/RULES.md, docs/TESTING.md, docs/DECISIONS.md, and docs/MEMORY.md define engineering rules, verification, decisions, and handoff state.
9. imports/ocade-jarvis/CLAUDE.md defines preservation rules for the original JARVIS source.

## Repository and stack

- The web product uses TypeScript, React 19, TanStack Router/Query/Start, Vite, and Tailwind CSS.
- The repository uses Node 22+ with npm.
- Supabase Auth, PostgreSQL, and Storage remain the account/data authority.
- Cloudflare Worker remains the website deployment authority.
- Existing Chat Offline Intelligence remains unchanged.
- The JARVIS ZIP is preserved under imports/ocade-jarvis/.
- The immutable extracted original belongs under imports/ocade-jarvis/source-original/.
- The working Python/runtime JARVIS engine belongs under jarvis-runtime/.
- The production JARVIS web UI belongs under src/jarvis/.
- Playwright and Playwright/MCP capability belong to the JARVIS browser-control layer.
- Existing PyAutoGUI/desktop modules are preserved for later capability wiring and must not be misrepresented as browser-only powers.

## Session startup

Run **/ponytail ultra** and **/caveman ultra** before reading, planning, editing, debugging, testing, reviewing, or resuming after compaction. Run them again in every fresh execution context.

Then read PLAN.md, docs/MEMORY.md, and only the canonical documents relevant to the task.

## Core architecture rules

- Keep one authority per responsibility.
- Preserve the original JARVIS ZIP and immutable extracted source exactly.
- Treat the working extracted JARVIS runtime as the primary JARVIS engine rather than selecting a tiny donor subset.
- Preserve useful original capabilities and replace only active GUI/API-key behavior, unsafe production behavior, or clearly rejected product behavior.
- Do not dump Python runtime files into the React src tree.
- Keep Chat and JARVIS logically separate while reusing approved account/auth/conversation infrastructure where documented.
- Keep JARVIS memory logically separate from Chat memory.
- Keep JARVIS usage accounting separate from Chat usage accounting.
- JARVIS is Online-only and must never route to the Chat Offline model.
- Never expose provider/model/vendor identities or provider keys to customers.
- Do not add another generic public plugin platform; the original plugin code remains preserved but unused.
- Do not expose the old phone dashboard as the final remote architecture.

## JARVIS product rules

- The canonical route is /ocade-jarvis.
- Signed-out users may view the surface, but execution requires sign-in.
- Ordinary questions receive ordinary answers without forcing a device-control workflow.
- Explicit work/control requests become JARVIS tasks.
- The JARVIS GUI uses the live orb/graph as its central visual system.
- The graph grows from real conversations, JARVIS memory, tasks, devices, and allowed-app data.
- Node selection reveals safe metadata/representation without automatically opening private underlying content.
- Voice supports Interrupt, Pause, Continue, and End controls.
- The default wake phrase is Hey OCADE where wake behavior is supported.
- Browser control supports isolated automation and an authorized real-browser path.
- Take Over and Stop must be real controls.
- Purchases/final payment actions are prohibited.
- Sensitive legal, financial, medical, security, and public-submission actions require confirmation.
- Deep computer/mobile control is not claimed complete until later phases are genuinely built and tested.

## Usage rules

- Chat keeps its current Free, Pro, and Max allowances.
- JARVIS uses separate Free, Pro, and Max allowances.
- JARVIS internal model/tool work may consume JARVIS usage.
- Failed or no-result internal work must be reconciled rather than blindly charged.
- The customer sees an understandable JARVIS usage meter rather than raw internal rows.

## Security rules

- Enforce RLS and server-side authorization for account-owned data.
- Bind actions to account, task/conversation, request, permission, and device identity.
- Use a global JARVIS master switch plus granular capability permissions.
- Keep device-sensitive permission state per device.
- Treat pages, screenshots, files, tool output, and model instructions as untrusted.
- Do not let prompt injection grant permissions or bypass confirmation.
- Never store provider/service secrets in client code.
- If a credential vault is later implemented, keep it encrypted and separate from conversational memory; never store one-time authentication secrets as long-term memory or payment card security codes.

## Development commands

Use the scripts already defined in package.json, including npm run build, npm run typecheck, npm run lint, npm run format:check, npm test, npm run verify:full, npm run audit:browser, npm run audit:online, npm run audit:offline, npm run audit:usage, npm run identity:check, npm run content-storage:check, and npm run audit:secrets.

GitHub Actions is optional and unavailable/red paid Actions are not product evidence.

## Testing rules

Add a regression before or alongside each integration. Keep existing Chat/Offline tests green.

Real JARVIS QA must test route/auth, normal answers, tasks, voice, usage, browser control, multiple tabs, Take Over, Stop, permissions, login takeover, responsive layouts, coordinate re-anchoring after resize/zoom, concurrency, cancellation, and prompt-injection boundaries.

Do not call a simulated or unavailable hardware path passed.

## Forbidden changes

- Do not delete or rewrite the original JARVIS ZIP or immutable source snapshot.
- Do not add Offline JARVIS.
- Do not expose provider/model/vendor identity or provider keys.
- Do not reintroduce CADANE branding.
- Do not add live payments while paid checkout remains closed.
- Do not perform purchases through JARVIS.
- Do not revive old product modules merely because historical migrations mention them.
- Do not describe unbuilt deep computer/mobile control as current functionality.
- Do not mention a desktop-wrapper architecture until the owner starts that mission.
- Do not weaken security, tests, accessibility, or evidence to reduce line count.
