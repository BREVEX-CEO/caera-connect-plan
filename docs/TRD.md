# OCADE Technical Requirements Document

## Technical direction

OCADE remains one repository with separate runtime boundaries for the web product and the JARVIS engine.

The existing JARVIS ZIP is preserved as source provenance and becomes the basis of the active working runtime.

## Frontend

- The OCADE website uses React 19, TypeScript, TanStack Router/Query/Start, Vite, and Tailwind CSS.
- The production JARVIS web UI lives under src/jarvis/.
- The canonical JARVIS route is /ocade-jarvis.
- The JARVIS orb/graph uses a performant browser rendering approach with reduced-motion fallback.
- The JARVIS UI remains responsive across desktop, tablet, and phone.

## JARVIS runtime

- The original ZIP remains unchanged under imports/ocade-jarvis/.
- The immutable extracted original lives under imports/ocade-jarvis/source-original/.
- The working Python/runtime engine lives under jarvis-runtime/.
- The working runtime initially preserves the meaningful original actions/, core/, memory/, dashboard/, voice, and related structure.
- The old active GUI is removed from the production path but remains in source-original.
- Active manual provider-key entry and plaintext provider-key configuration are removed from the working runtime.
- Generic plugin code remains preserved but unused/customer-hidden.
- The legacy phone dashboard remains preserved but is not the final active remote-control surface.

## Intelligence

- JARVIS is Online-only.
- JARVIS uses the existing approved server-side OCADE Online intelligence boundary.
- Provider keys never enter browser code or customer configuration.
- Provider/model/vendor identity is hidden from customer surfaces.
- JARVIS must not call the Chat Offline path.

## Browser automation

- Playwright and Playwright/MCP capability are built into the JARVIS browser-control layer.
- The runtime supports an isolated automation browser and an authorized real-browser path.
- The preferred hierarchy is DOM/accessibility semantics, Playwright/browser tooling, authorized browser integration, visual understanding, and coordinate fallback.
- Raw coordinates are never durable element identity.
- The controller re-observes after resize, zoom, responsive breakpoint changes, scroll-context changes, navigation, tab changes, and content reflow.
- Meaningful actions are verified by observing resulting state.
- Multi-tab tasks are supported.
- Take Over and Stop are explicit session controls.

## Existing desktop-control code

- Existing PyAutoGUI, computer-control, file-control, screen, app-launch, and related code is preserved.
- The web product must not claim those capabilities are usable from a normal hosted browser until a trusted execution path is active and tested.
- Browser-control work is completed before deeper device-control work begins.
- The owner has now explicitly approved the deeper-device mission; the trusted Windows/macOS Device Agent and browser extension are documented in PLAN.md Phases 13–23.

## Voice

- Typed and voice tasks share JARVIS context.
- Microphone permission is requested when the user first enters JARVIS.
- Voice supports Interrupt, Pause, Continue, and End.
- Wake behavior uses Hey OCADE by default where supported.
- Audio/voice states terminate cleanly on stop, error, permission denial, navigation, or sign-out.

## Backend and database

- Supabase remains the identity, PostgreSQL, and durable account-data authority.
- JARVIS conversations reuse the existing conversation/message authority with a clear JARVIS discriminator.
- JARVIS memory is a separate logical namespace from Chat memory.
- JARVIS usage is a separate usage kind/ledger from Chat.
- Detailed JARVIS activity has 90-day retention.
- Important task results remain durable independently of activity expiry.
- Per-device capability permissions are durable account-owned data with RLS/server authorization.

## Authentication

- The /ocade-jarvis surface may render signed out.
- Intelligence, account data, task execution, browser control, voice intelligence, and durable state require authentication.
- Authentication returns to the requested JARVIS route.

## Security

- Every action binds to account, JARVIS context, request, permission, and device identity.
- JARVIS treats web content, screenshots, tool output, uploads, and model-generated instructions as untrusted.
- Prompt injection cannot expand permissions.
- Sensitive submissions require confirmation.
- Final purchases are blocked.
- One-time authentication secrets are ephemeral.
- Any future encrypted credential vault remains separate from conversational memory.
- Payment card security codes are never stored.

## Usage

- Chat and JARVIS have separate plan allowances.
- JARVIS internal successful resource-bearing steps may consume JARVIS usage.
- Failed/no-result steps are reconciled.
- Usage is enforced server-side and account-wide.

## Deployment

- The website remains deployed through the current Cloudflare Worker authority.
- Supabase Edge Functions and migrations follow existing deployment discipline.
- JARVIS packaging must not leak secrets/provider identity into the public bundle.

## Hard constraints

- Do not break existing Chat/Offline behavior.
- Do not add Offline JARVIS.
- Do not expose provider keys.
- Do not delete the original ZIP or immutable snapshot.
- Do not claim unsupported desktop/mobile control.
- Preserve the completed web mission while implementing only the now-approved Device Agent/extension architecture in PLAN.md Phases 13–23.

## Approved deeper-device technical requirements

The next implementation follows PLAN.md Phases 13–23 and `docs/JARVIS_DEVICE_ROADMAP.md`.

### Shared protocol

Create one explicit versioned contract for website, Device Agent and browser extension. Every device command/result must bind account, device, task, request, permission and protocol version.

Each enrolled device receives a unique cryptographic credential automatically. Store only safe server-side verification material. Support credential rotation and immediate revocation.

### Desktop packaging

Support Windows 10/11 and modern macOS first. Package the active runtime so end users do not install Python or dependencies. Public builds require code signing/notarization. Auto-update from signed OCADE releases and rollback on failed health checks.

A minimal supervisor may autostart at OS login. Keep idle CPU/RAM/network negligible. One tray/menu-bar identity only.

### Browser extension

Use Manifest V3 or the current store-supported equivalent at implementation time. Request minimum permissions. Provide secure OCADE account state, connection status and links to OCADE/JARVIS. Never embed Online provider secrets or provider identity.

### Desktop execution

Preferred automation order is native API/scripting, direct scoped file/project operation, accessibility/structured UI, local vision, then freshly observed coordinates.

Only one UI-control lease exists per device at a time. User physical input cancels/pauses that lease until explicit Continue unless Co-work mode intentionally alternates control.

### Coding sandbox

Provide a lightweight OCADE-managed isolated execution environment where required. Prefer host-native virtualization/container capabilities, lazy installation and bounded CPU/RAM/storage. Do not require ordinary users to configure Docker Desktop manually.

### Background and checkpointing

Explicit background tasks persist durable checkpoints. Local-only safe steps may continue during network loss; Online-dependent work pauses. Reboot restores state and resumes only safe steps automatically.

### Voice

Startup is text-only. Microphone permission occurs on first Voice use. Optional PC wake-word detection remains local. Cloud audio must not run continuously before wake activation.

### Online capacity

Keep exactly three configured server-side capacity slots. Failover must distinguish slot-local failure from provider/project-wide quota. Never expose slot, provider, model or vendor identity to customers.

### Mobile

Android/iOS remain web/PWA-first. Implement Remote PC via existing authenticated task/device authorities. Do not technically represent unsupported OS-wide cross-app control as available.
