# OCADE JARVIS Mobile and Device Control Authority

## Principle

JARVIS should control devices through OCADE-owned execution components. MCPs, Playwright, Appium, Mobile MCP, and computer-control tooling are development/test tools; customers must not need those tools installed to use OCADE.

## Shared action architecture

- JARVIS plans work through one versioned action/task protocol.
- A single device-side action broker owns current authorization, cancellation, workspace boundaries, app identity, OS permissions, local execution, verification, and result settlement.
- Every action binds account, device, task, request, permission state, confirmation state when required, and idempotency identity.
- Permission and capability state are revalidated at execution time, not only when work is queued.
- STOP must propagate to active executors and cancel safely wherever technically possible.
- A task must not report success merely because a command was sent. It verifies the resulting state before saying Done.

## Control hierarchy

- Prefer direct/native APIs, operating-system intents, structured file operations, application scripting, or known app integration when those provide the safest accurate path.
- Use accessibility/UI automation when direct integration is unavailable.
- Use local visual understanding when structured UI data is insufficient.
- Use freshly observed coordinates only as the final fallback.
- Coordinate actions require a fresh observation after layout, window, orientation, viewport, scroll, app, tab, or focus changes.
- Multi-app tasks are first-class. One task may move between browser, file system, Excel, Gmail, an editor, CAD/engineering software, or other approved apps when required.

## Windows

- Windows 10 and 11 are supported targets.
- Customers install a small OCADE Device Agent rather than Python or developer dependencies.
- Installation should be guided and highly automated while respecting required Windows prompts and security boundaries.
- The agent may autostart as a lightweight supervisor and expose one OCADE tray identity.
- Users can stop/exit local control from the tray and disable the device from the website.
- Update, health check, rollback, uninstall, credential removal, and process shutdown are part of the product lifecycle.
- Professional applications, Office, IDEs, editing tools, CAD/engineering tools, and other software are controlled through the same safe hierarchy rather than being limited to a small hardcoded application list.

## macOS

- macOS follows the same website-first experience with a native trusted Device Agent when deep local control is implemented.
- Use native scripting and accessibility APIs, direct file operations, structured app integration, visual understanding, and fresh coordinates in that order where appropriate.
- Accessibility, Screen Recording, microphone, and other TCC permissions are requested only when needed and represented through a permission-health UI.
- Public distribution eventually requires proper signing/notarization.
- Playwright WebKit is useful browser-compatibility evidence, but it does not prove native macOS Device Agent behavior.
- Native macOS claims remain blocked until a legitimate real macOS environment provides physical/runtime evidence. The team should seek zero-cost legitimate environments where possible, but must not relabel emulation as native proof.

## Android companion

- The intended Android distribution path is a direct OCADE companion download from the OCADE domain rather than depending on Google Play.
- Installation is guided step-by-step. The surrounding setup should be automated, but Android-controlled install, overlay, accessibility, notification, screen-capture, or other sensitive permission prompts are not bypassed.
- The companion can expose an optional movable floating JARVIS mini-app/bubble when Android permissions support it.
- The collapsed bubble uses a restrained OCADE/JARVIS identity and little or no text.
- Tapping opens a clean mini surface with quick chat, composer, voice, active task, Stop, expand/open-OCADE, and other genuinely useful controls.
- Settings and complex account management open the website rather than overloading the bubble.
- The bubble can snap to the edge, hide cleanly, restore after restart when the user enabled it, and show a simple Needs permission state when necessary.
- Hiding the bubble does not automatically terminate an explicitly authorized background task. Stopping execution remains a separate clear action.
- The companion should periodically check permission health and safely recover what Android permits without repeated user setup.

## Android app control

- Use intents/native actions first, accessibility/structured UI next, vision next, and fresh coordinates last.
- Contact/message/call tasks verify the intended recipient before execution, especially when names are ambiguous.
- Notification reading/responding occurs only after the user grants the relevant access and only within the allowed app/action policy.
- Gallery/file tasks use supported content/document/media APIs when possible.
- Destructive media/file actions prefer Trash/reversible operations. Permanent deletion requires explicit user intent and confirmation.
- "Clean junk" favors safe cache/temp cleanup and explainable recommendations rather than deleting personal files based on a model guess.
- Mobile editing tasks may use supported share/import flows, app integrations, accessibility, and visual control. Long tasks checkpoint progress and verify output.
- Physical user input pauses automated UI control unless the user explicitly enables Co-work.

## iPhone and iPad

- OCADE remains PWA/web-first on iPhone and iPad.
- Use Apple-supported surfaces such as Home Screen PWA, Siri/Shortcuts/App Intents where available, Control Center shortcuts/controls where supported, share flows, notifications, and Remote PC.
- The product must not claim that a PWA can create an Android-style overlay over every iOS app or arbitrarily click every third-party application.
- The zero-cost phase may test iOS/Safari compatibility through Playwright WebKit, but that evidence is labeled emulation/compatibility rather than real iPhone proof.
- If a future native helper becomes justified and can be distributed through a legitimate Apple-supported mechanism without contradicting the owner's distribution requirements, it may be evaluated.
- When Apple blocks a desired local-control behavior, Remote PC or another supported workflow is used instead of faking local capability.

## Voice modes

- JARVIS starts text-only.
- The product supports text-to-text, text-to-voice, voice-to-text, and voice-to-voice interaction where platform/audio capabilities allow it.
- Voice input and spoken output are separate capabilities. One must not be disabled merely because the other is unavailable.
- "Hey OCADE" remains the preferred local wake phrase where wake functionality is actually supported.
- Pre-wake audio is not continuously uploaded to the cloud.
- Stop, Pause, Continue, Cancel/End, and interruption behavior work consistently across text, voice, web, mini-control, and device execution.

## Desktop Co-work

- Co-work is an explicit mode for alternating or coordinated user/JARVIS control.
- Normal automation pauses when physical mouse/keyboard input indicates the user is taking over.
- The UI may suggest Co-work when the user begins interacting during a long task.
- Co-work must not allow two uncontrolled actors to click/type over each other. It uses a clear control lease and current-state observation.

## Installation and updates

- Installation should feel as effortless as possible, with clear OCADE guidance and automatic setup around any unavoidable operating-system permission prompts.
- Public packages are signed/notarized where required to establish trust and reduce legitimate operating-system warnings.
- The product must not attempt to bypass or hide legitimate OS security warnings by unsafe means.
- Updates are verified, signed, health-checked, automatic when safe, and rollback-capable.
- Uninstall cleanly stops processes, removes OCADE credentials/local authority, disconnects cloud device identity, and leaves no hidden active controller.

## MCP orchestration and autonomous verification linkage — 2026-09-28

- Current implementation and verification governed by this document must also follow `docs/MCP_ORCHESTRATION_AND_AUTONOMOUS_FIX_LOOP.md`.
- When multiple MCPs can touch the same surface, one tool acts and the others observe or verify sequentially so browsers, devices, files, and operating-system state are not corrupted by competing automation.
- Long runs must checkpoint durable progress before context compaction, rate limits, restart, or handoff. Resumed work continues from the next unfinished item instead of repeating completed work.
- A failure is not closed by a code change alone. Reproduce it, fix the root cause, run targeted and nearby integration tests, verify with the strongest available real browser/device/physical evidence, attempt to break the fix, and then run the broader regression slice.
- If one MCP or environment is unavailable, mark only that evidence class blocked and continue every independent test. Never treat blocked or emulated evidence as a real-device pass.
