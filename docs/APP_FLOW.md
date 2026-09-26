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

1. JARVIS requests microphone permission when the user first enters JARVIS.
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
