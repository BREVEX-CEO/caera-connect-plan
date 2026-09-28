# OCADE JARVIS UI Reference Checklist

## Reference intent

The supplied orb image is a visual reference, not a literal screen to copy.

The final OCADE JARVIS interface should be cleaner, more responsive, more accessible, and more functionally grounded than the reference.

## Orb checklist

- The screen has one clear central orb focal point.
- A new account starts with a simple graph state.
- Real data growth adds threads/nodes over time.
- Nodes/edges correspond to real JARVIS relationships.
- Cursor response is subtle and professional.
- Pan and zoom remain smooth.
- Semantic zoom reveals detail progressively.
- Selection shows safe metadata rather than automatically opening private content.
- Conversation overlays dim the orb rather than permanently removing it.
- Reduced-motion mode remains functional.
- Custom accent colors are optional and monochrome remains default.

## Navigation checklist

- The sidebar is compact by default.
- The sidebar can expand/collapse.
- Conversations, History, Tasks, Activity/Logs, Allowed Apps, and Devices are available.
- Plugins are not customer-facing.
- Permissions use a focused drawer/modal.

## Voice checklist

- Voice uses the same orb.
- Interrupt, Pause, Continue, and End are visible.
- Ordinary orb clicks do not secretly interrupt speech.
- Permission denial has a clear recovery path.

## Task/browser checklist

- Active task status is concise.
- Stop is prominent.
- Take Over is prominent during browser automation.
- A live browser panel is collapsible.
- Resize/reflow does not break the layout.
- The UI does not imply unsupported desktop/mobile control.

## Theme checklist

- Dark theme is polished.
- Light theme is equally usable.
- Glass is restrained.
- Typography is readable.
- There is no unnecessary neon or sci-fi decoration.
- Mobile layouts have no horizontal overflow.

## Latest JARVIS UI ZIP reconciliation

- Preserve `imports/UI OCADE JARVIS.zip` unchanged.
- Treat it as the latest primary visual/code reference.
- Reuse useful components/patterns inside `src/jarvis/` instead of creating a second application.
- Remove prototype fake replies, random nodes, fake metrics/statuses, placeholder alerts, duplicate theme controls and decorative browser-window buttons.
- Do not expose Plugins.
- Use Conversations, Tasks, Activity, Allowed Apps and Devices.
- Reuse OCADE Settings.
- Implement a real round 3D aura graph with real data relationships.
- Maintain reduced-motion and semantic/nonvisual graph access.
- Test phone widths without horizontal overflow.

## 2026-09-28 reference reconciliation checklist

- Confirm no separate Code page exists unless explicitly reinstated by a later owner decision.
- Confirm no unnecessary Projects page duplicates conversation/workspace/Library context.
- Confirm JARVIS tasks are accessible in JARVIS without forcing a permanent extra navigation destination.
- Confirm sidebar/navigation presents only genuinely useful destinations and does not duplicate History/Conversations.
- Confirm black/white/silver dominate, blue indicates active/enabled state, and glass is restrained outside JARVIS.
- Confirm orb/graph behavior is preserved from the donor reference while fake data/metrics/prototype scaffolding are absent.
- Confirm settings auto-save, use short descriptions, and avoid excessive options.
- Confirm free-tier exact usage and paid-plan progress-bar usage presentation.
- Confirm skeleton loading on chat/history/settings/dashboard surfaces and stable layout without large jumps.
- Confirm thin theme-aware scrollbars, soft corners, spacing, keyboard/focus, reduced motion, and no mobile horizontal overflow.
- Confirm active tasks show truthful stage/progress with prominent Stop and Take Over.
- Confirm Help contains long guidance that was intentionally removed from normal product UI.
- Confirm Android bubble UI is compact and opens complex settings on the website.
- Confirm no UI claims unsupported iOS/macOS physical control based only on WebKit.

## MCP orchestration and autonomous verification linkage — 2026-09-28

- Current implementation and verification governed by this document must also follow `docs/MCP_ORCHESTRATION_AND_AUTONOMOUS_FIX_LOOP.md`.
- When multiple MCPs can touch the same surface, one tool acts and the others observe or verify sequentially so browsers, devices, files, and operating-system state are not corrupted by competing automation.
- Long runs must checkpoint durable progress before context compaction, rate limits, restart, or handoff. Resumed work continues from the next unfinished item instead of repeating completed work.
- A failure is not closed by a code change alone. Reproduce it, fix the root cause, run targeted and nearby integration tests, verify with the strongest available real browser/device/physical evidence, attempt to break the fix, and then run the broader regression slice.
- If one MCP or environment is unavailable, mark only that evidence class blocked and continue every independent test. Never treat blocked or emulated evidence as a real-device pass.
