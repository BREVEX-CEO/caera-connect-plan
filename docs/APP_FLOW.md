# OCADE App Flow

## Primary navigation

The active product navigation includes Chat, OCADE JARVIS, Library, and the existing account/settings entry points.

JARVIS opens at **/ocade-jarvis**.

The JARVIS sidebar uses compact icons by default and expands when needed. Its sections are Conversations, History, Tasks, Activity/Logs, Allowed Apps, and Devices.

Permissions open in a focused drawer/modal.

## Signed-out JARVIS flow

1. A visitor may open /ocade-jarvis and see the JARVIS interface.
2. The visitor may explore the non-sensitive visual surface.
3. When the visitor tries to send, speak to intelligence, start a task, use account data, or control anything, OCADE requests authentication.
4. After successful authentication, OCADE returns the user to /ocade-jarvis.

## JARVIS idle flow

1. JARVIS opens to a clean central orb when there is no active conversation.
2. The orb begins visually simple for a new JARVIS user.
3. Real conversations, JARVIS memories, tasks, devices, and allowed-app relationships gradually add nodes and neural threads.
4. The user may pan, zoom, hover, and select graph structures.
5. Selecting a graph structure shows safe metadata about the represented data without automatically opening private underlying content.

## Normal question flow

1. The user types or speaks a normal informational question.
2. JARVIS treats it as a conversation rather than manufacturing a control task.
3. JARVIS uses the approved Online intelligence path.
4. The answer appears in the JARVIS conversation.
5. The orb remains a restrained background visual when text needs priority.

## Work/task flow

1. The user asks JARVIS to perform work.
2. JARVIS creates a Task with a concise plan.
3. JARVIS begins automatically unless permission or sensitive confirmation is required.
4. The Task view shows current step, progress, activity, Stop, and Resume state.
5. JARVIS observes each meaningful result before continuing.
6. If the plan fails safely, JARVIS stops and explains the blocker.
7. The durable result remains after detailed activity logs expire.

## Browser-control flow

1. JARVIS selects an isolated browser or uses the user's authorized real browser according to the task.
2. JARVIS chooses the strongest semantic control method automatically.
3. The user may open a collapsible live browser panel.
4. JARVIS may work across multiple tabs/sites.
5. JARVIS re-observes after navigation, resize, zoom, tab changes, responsive reflow, and scroll changes.
6. JARVIS never uses stale coordinates as if the page had not moved.
7. The user may select Take Over to pause automation and act manually.
8. Resume starts from a freshly observed state.
9. CAPTCHA, passkeys, OTP/2FA, and equivalent boundaries pause for user participation.
10. Sensitive submissions request confirmation.
11. Final purchase/payment actions remain unavailable.

## Voice flow

1. JARVIS opens text-only and requests microphone permission only when the user first presses Voice.
2. The user may type or use voice in the same JARVIS context.
3. Hey OCADE is the default wake phrase where supported.
4. Voice mode animates the orb.
5. Explicit Interrupt, Pause, Continue, and End controls are available.
6. Ordinary orb clicks do not act as hidden speech-interrupt controls.
7. Ending voice returns to the same JARVIS conversation/task.

## Allowed Apps flow

1. Allowed Apps shows applications or web services JARVIS knows how to use.
2. Web/browser capabilities may become active during the first mission.
3. Later desktop/mobile capabilities are shown only when genuinely available.
4. The user controls which capability is allowed.
5. JARVIS may remember preferred tools when memory is enabled.
6. JARVIS asks when multiple tools are plausible and no reliable preference resolves the ambiguity.

## Devices flow

1. Devices shows account-owned endpoints and capability state.
2. Device-sensitive permissions are managed per device.
3. The user may disable JARVIS globally while retaining granular settings.
4. Unsupported control is shown as unavailable rather than simulated.

## Error and cancellation flow

Every async JARVIS operation terminates in success, bounded progress, stopped/cancelled, permission required, blocked, retryable error, or terminal error.

No JARVIS task may remain in an endless spinner or ambiguous active state.

## Device setup flow

1. The user requests a capability that needs deep PC control.
2. OCADE offers Set up this PC.
3. One installer handles the trusted Device Agent setup automatically.
4. The same signed-in OCADE account enrolls the device without user-managed codes/tokens.
5. OCADE creates a unique cryptographic device identity, records the device and shows a new-device security notification.
6. Required OS permissions are requested in simple customer language.
7. The device becomes available in Devices.

## Desktop-control flow

1. A task chooses the strongest supported native/direct control method.
2. One task obtains the device UI-control lease.
3. JARVIS re-observes before coordinate fallback and after meaningful state changes.
4. Physical user mouse/keyboard input pauses JARVIS.
5. Continue re-observes before resuming.
6. High-impact/system-changing actions request approval.
7. STOP JARVIS immediately releases active automation.

## Browser-extension flow

1. OCADE uses its safe browser context by default.
2. When an existing authenticated Chrome session is required, JARVIS uses the official authorized extension path.
3. The extension controls only its authorized tab/session.
4. CAPTCHA, OTP, passkey and equivalent boundaries hand control to the person.

## Background/recovery flow

1. An explicitly started/scheduled task may continue after the website closes.
2. Safe local-only steps may continue through temporary network loss.
3. JARVIS checkpoints before boundaries and pauses Online-dependent work.
4. Reconnect/reboot restores state.
5. Safe next steps may resume automatically; sensitive next steps request approval.

## Mobile Remote PC flow

1. Android/iPhone/iPad opens OCADE as web/PWA.
2. The user selects a paired PC in Devices/Remote PC.
3. Mobile can start, stop, observe and control the PC task.
4. The phone browser may be minimized; execution continues on the PC Agent.
5. Unsupported mobile OS-wide control is not simulated.

## Voice update

JARVIS opens text-only. Microphone access is requested on first Voice use, not on route entry. Optional PC `Hey OCADE` requires explicit Background/Wake Mode for closed-browser operation.

## Latest company/product flows — 2026-09-28

- The default customer navigation should remain intentionally small. Chat, JARVIS, Library, shared Settings/Account, Help/Support, and contextually useful conversation history are the core customer flows.
- Do not add a separate Code page. When a user asks for code, Chat/JARVIS returns code in conversation; when the user asks JARVIS to act, JARVIS may use the approved IDE, terminal, repository, or workspace on the selected device.
- Do not add a separate Projects page unless later evidence proves it is necessary. Files, repositories, workspace context, conversations, and Library should carry project context first.
- JARVIS tasks are shown primarily inside JARVIS. Active tasks show current stage, truthful progress, Stop, Take Over, and optional detail expansion rather than forcing the user into a separate dashboard.
- Co-work is an optional JARVIS control mode. If physical user input occurs during normal automation, JARVIS pauses. Co-work can then deliberately coordinate control instead of allowing conflicting input.
- The free plan shows exact remaining uses and reset information. Paid plans primarily show plan name and a clean percentage/bar.
- Help/Support is a first-party OCADE flow with search, setup guides, billing, privacy/security, device help, and troubleshooting.
- Owner/admin operations live on the secured OCADE admin domain and are never reachable merely by discovering a hidden customer route.
- Android companion install begins from the OCADE site, guides installation/permissions, then offers the optional floating JARVIS mini-app. Settings and complex account flows open the website.
- iPhone/iPad remain PWA/web-first with Apple-supported Shortcuts/Control Center/notifications/Remote PC paths. WebKit compatibility tests must not be represented as physical-iPhone proof.
