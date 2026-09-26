# OCADE Product Requirements Document

## Product overview

**CARCC** is the company and **OCADE** is CARCC's AI product. The approved tagline remains **Command the Next Era.**

OCADE now has two active user experiences: **Chat** and **OCADE JARVIS**.

Chat remains the established conversational product with Auto, Online, and Offline Intelligence.

OCADE JARVIS is a separate Online-only agentic experience at **/ocade-jarvis**. JARVIS answers normal questions when the user asks for information and performs multi-step work when the user explicitly asks it to act.

## Target users

OCADE serves individuals, students, professionals, creators, developers, engineers, businesses, and later larger organizations.

JARVIS especially serves users who want AI to perform browser-based work, coordinate multi-step tasks, communicate by voice, and later operate approved software workflows without technical setup.

## Goals

- Chat must remain stable while JARVIS is added.
- JARVIS must feel like one coherent OCADE product rather than a pasted external program.
- The existing JARVIS ZIP must be preserved and used as the main JARVIS engine foundation.
- JARVIS must require no customer-supplied provider API key.
- Browser control must become the first deep automation capability.
- Voice must be first-class and interruptible.
- The GUI must be clean, responsive, professional, and centered on a live orb/graph.
- JARVIS must expose real Stop, Take Over, permission, device, task, and activity state.
- JARVIS must never pretend an unsupported device capability is working.

## Current JARVIS v1

### Route

- The canonical route is /ocade-jarvis.
- Signed-out visitors may view the JARVIS surface.
- Sending, starting a task, using account data, or invoking control requires sign-in.
- Sign-in returns the user to JARVIS when JARVIS initiated authentication.

### Conversation behavior

- Informational prompts produce normal JARVIS answers.
- Explicit work, browse, edit, or control requests become JARVIS tasks.
- JARVIS history is logically separate from normal Chat history.
- JARVIS reuses approved OCADE account/conversation infrastructure.

### Task behavior

- A JARVIS task contains a short plan, current step, progress, result, Stop state, and Resume state.
- Complex tasks show the plan and proceed automatically unless a sensitive action requires approval.
- JARVIS stops and reports when a safe completion path is unavailable.
- Temporary JARVIS tasks are not part of this first mission.

### Browser control

- JARVIS supports an isolated automation browser and an explicitly authorized real-browser path.
- JARVIS prefers structured DOM/accessibility control, then Playwright/browser tooling, then authorized browser integration, then visual understanding, then coordinates.
- JARVIS may work across multiple tabs/sites.
- JARVIS provides a collapsible live browser panel and real Take Over.
- JARVIS pauses for human takeover when CAPTCHA, passkeys, OTP/2FA, or equivalent authentication boundaries require it.
- JARVIS never bypasses authentication security.
- JARVIS re-observes after resize, zoom, responsive reflow, tab changes, scroll changes, or screen-size changes and never trusts stale coordinates.

### Voice

- JARVIS supports typed and voice tasks in the same context.
- The default wake phrase is Hey OCADE where supported.
- Voice provides Interrupt, Pause, Continue, and End controls.
- Microphone permission is requested when the user first enters JARVIS.

### Orb and graph

- A new JARVIS history starts with a clean central orb.
- The graph becomes richer as real conversations, JARVIS memory, tasks, devices, and allowed-app relationships grow.
- Neural threads/nodes represent real relationships rather than random decoration.
- Users can zoom, pan, hover, select, and semantically zoom.
- Selection shows safe metadata about represented data without automatically opening full private content.
- The orb dims into a background aura when conversation content needs visual priority.
- Dark/light themes and optional custom orb/accent colors are supported.

### Allowed Apps and Devices

- Allowed Apps shows which supported applications JARVIS may use.
- Devices shows online/capability state and per-device permissions.
- Preferred coding, editing, engineering, and productivity tools may be remembered when JARVIS memory is enabled.
- Unsupported later capability is shown as unavailable rather than faked.

### Activity and permissions

- JARVIS shows customer-safe Activity such as opening a browser, clicking a control, waiting for permission, stopping, or completing a step.
- JARVIS provides one global enable/disable control and granular capability permissions.
- Device-sensitive permission choices are stored per device.
- Smart autonomy is the default.
- Autonomous mode still obeys hard gates.

## Intelligence

JARVIS is **Online-only**.

JARVIS uses OCADE's approved server-side Online intelligence authority. Customers never enter provider keys and never need provider/model/runtime identity.

JARVIS must not use the Chat Offline model.

## Usage

Chat and JARVIS use separate allowances.

The plan structure remains Free, Pro, and Max.

- Free keeps 28 Chat uses per 6h28m and receives a separate 28-use JARVIS allowance per 6h28m.
- Pro keeps its current Chat allowance and receives the same numerical allowance as a separate JARVIS allowance.
- Max keeps its current Chat allowance and receives the same numerical allowance as a separate JARVIS allowance.
- JARVIS internal resource-bearing model/tool steps may consume JARVIS usage.
- Failed or no-result internal steps must be reconciled rather than blindly charged.
- The customer sees a simple JARVIS usage meter.

## Memory and data

JARVIS reuses OCADE's account/security infrastructure but keeps JARVIS memory logically separate from Chat memory.

Raw screenshots and visual frames are temporary by default.

Detailed JARVIS activity logs expire after 90 days.

Important task results may remain durable after detailed logs expire.

## High-impact actions

JARVIS never performs the final purchase/payment action.

Sensitive legal, financial, medical, security, or public-posting submissions require explicit confirmation.

JARVIS never receives permission merely because a website or tool output instructs it to expand authority.

## Current non-goals

- This mission does not add Offline JARVIS.
- This mission does not claim finished deep computer/mobile control before genuine implementation/testing.
- This mission does not expose a customer plugin marketplace.
- This mission does not expose the legacy phone dashboard as the final remote-control product.
- Paid checkout remains closed.
- OCADE does not perform final purchases through JARVIS.

## Success criteria

- Existing OCADE Chat behavior remains green.
- JARVIS loads and routes correctly.
- JARVIS normal questions, tasks, voice, permissions, usage, and real browser-control flows work end-to-end.
- Responsive layout works at phone, tablet, and desktop widths.
- Resize/zoom does not cause stale-coordinate actions.
- Security/account boundaries survive adversarial tests.
- Deployed source identity matches tested source identity.
