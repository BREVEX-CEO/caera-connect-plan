# OCADE visual and interaction system

One visual authority for Chat, JARVIS, Library, settings, public pages and console. [PRD](PRD.md) owns pages/options; [PLAN](../PLAN.md) owns implementation order; [TESTING](TESTING.md) owns evidence. These are targets, not claims that current source implements them. Preserve CARCC/OCADE identity without copying another product's protected branding.

## Chosen direction and code ownership

Deep neutral dark surfaces, clean light surfaces, readable neutral type, restrained blue active state, green verified success and red destructive/error state. No neon, fake terminal decoration, decorative metrics, rainbow graphs, metallic textures or permanent animated backgrounds.

Reuse `src/styles.css`, `src/shared/ui/tokens/monochrome.css`, `src/lib/appearance.tsx` and existing shell/row/dialog components. Do not add another theme package. Current primitive comments describe a monochrome invariant; `scripts/check-monochrome.mjs` already permits hue only through `--state-info`, `--state-success` and `--destructive`. Future implementation must reconcile the old comment with this semantic palette, retain those narrow exceptions and avoid scattered colour literals. Warnings use the selected semantic warning text plus an icon/label, subject to P15 allowlist migration. User document imagery is content, not product chrome.

## Exact palette

The sole selected palette and its calculated examples are in [Selected visual system](#51-selected-visual-system). Earlier monochrome draft values are superseded. Map background/surface/raised/text/secondary/border/button values to the existing `--background`, `--card`, `--popover`, `--foreground`, `--muted-foreground`, `--input`, `--primary` and `--primary-foreground` owners. Keep `--border` decorative. Map focus/link/success/danger to the existing semantic state owners; P15 must extend the existing semantic allowlist deliberately for warning/action states and retest `check-monochrome.mjs`, rather than scatter raw hues or add a theme authority.

Use opaque on-surface text. White is the primary button label in both themes. Status colour always has a label or icon. High contrast removes transparency and strengthens focus/boundaries. System is the selected default theme target; explicitly mark it unavailable until implemented. Contrast calculations describe tokens, not rendered accessibility certification; measure final composites, opacity, hover, glass and forced colours in actual components.

## Type, spacing, shape and depth

- Use system fonts by default and a system monospace stack for actual code. Existing self-hosted font assets remain preserved pending the ToRemove parity/licence gate; no new font download or third-party request. Check non-Latin fallback for clipping.
- Type/line-height: metadata 12/16px; compact labels 14/20; body/inputs 16/24; section 20/28; page 28/36; signed-out introduction at most 36/44. Weights 400 body, 500 labels, 600 headings. Phone inputs at least 16px; reading column at most 760px, legal 720px; no justified text.
- Spacing: 4, 8, 12, 16, 24, 32, 48px. Phone gutters 12px at 320–480px, 20px at 768px, desktop 24px; 8px within controls, 16px related rows, 24–32px sections. Compact operator tables may use 12px padding with reachable actions.
- Radius: compact controls 10px, groups/cards 16px, dialogs/sheets 20px, composer 16px. Pills for compact chips/status only. Migrate existing radius variables deliberately; no arbitrary per-component shapes or card around every sentence.
- Controls: 44px normal height, 48px Stop/Take Over; 18–20px icon inside at least 44px hit area. Dense desktop table controls may be 32px with spacing/keyboard access; phone retains 44px product target. This is a usability choice, not a claim every smaller control violates a standard.
- Shadows: light panel `0 12px 32px rgba(0,0,0,0.12)`, light dialog `0 24px 64px rgba(0,0,0,0.18)`; dark panel `0 12px 32px rgba(0,0,0,0.32)`, dark dialog `0 24px 64px rgba(0,0,0,0.48)`. Ordinary content uses borders, not permanent elevation.
- Glass only for floating bubble, compact voice surface and optional dialog chrome: 92% neutral surface, maximum 12px blur, opaque content. Use opaque fallback for high contrast/reduced transparency/unsupported effects/low-performance devices. No large blurred transcript or scrolling pane.

## Responsive composition

Use the selected breakpoint table in section 5.2: below 768px a navigation sheet, 768px a 64px rail, 1024px a 248px sidebar, 1280px context as a sheet and at least 1440px an optional 320px context panel. Support 320 CSS px and 200% text zoom without two-dimensional page scrolling. Label local overflow regions for code/tables. Respect visual viewport and `env(safe-area-inset-*)`; mobile keyboard must not cover composer or Stop.

| Surface             | Layout                                                                                 | Primary action / secondary disclosure               |
| ------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Signed-out root     | Identity, one value sentence, three workflow examples, composer, sign-in/platform note | Ask/sign in; no autoplay or forced install          |
| Chat                | History sidebar, transcript, composer                                                  | Send/Stop; attachment/voice/mode; More secondary    |
| JARVIS idle         | Calm real-data Orb, short invitation, device readiness, composer                       | Ask; connect only when needed                       |
| JARVIS working      | Transcript and current-task card; expandable browser/evidence/history                  | Stop/Take Over visible without scrolling            |
| Library             | Search/filters/Add above accessible list                                               | Open; Download; confirmed Delete in More            |
| Settings            | Desktop category column/content; phone full-height sheet/category picker               | One local change; separate destructive proof        |
| Auth/MFA/recovery   | Narrow labelled form with local error                                                  | One submit; recovery/method switch secondary        |
| Help                | Search, eight topic groups, accessible answers/contact                                 | Find answer or real support                         |
| Pricing/About/legal | Restrained public shell and readable factual content                                   | Honest next step; no placeholder checkout           |
| Console             | Same tokens; searchable dense tables and role-filtered detail panels                   | Contextual audited action, no fake metrics          |
| 404/error           | Plain explanation and recovery                                                         | Open Chat/Retry; no unsupported data/STOP assurance |
| Windows tray        | Native concise menu/status; web owns rich experience                                   | Open, Stop, Pause/Resume, folder, Exit              |
| Android bubble      | 56px collapsed target, accessible state; expanded sheet fits viewport                  | Ask/voice, task/Stop, Open full                     |

A navigation sheet closes on successful selection including same-route conversation changes and restores focus. Sheets have visible Close, not gesture-only dismissal. Destructive actions never depend on swipe alone. Customer copy describes outcome/device/scope, never internal engine/provider/infrastructure names.

## Interaction and state contracts

**Async:** idle/pending/success/error/denied/empty/stale are distinct. Skeletons reserve real layout only while loading. Empty follows a successful zero-result read, never a failed query. Error states what happened, whether work is known to have stopped and the next useful action. Retain drafts and last good data where appropriate, explicitly labelled stale. No infinite spinner or optimistic success after refusal.

**Task:** readable Planning/Working/Waiting for you/Verifying/Stopping/Stopped/Failed/Partial/Uncertain/Verified complete must map to canonical protocol state, never a second frontend lifecycle. Percentages need a known meaningful denominator; use current stage/elapsed time otherwise. Uncertain is not green. Stop acknowledgement is not delayed by animation.

**Focus/dialogs:** reuse the existing `useModalFocus` and `ConfirmIdentity` contract: initial focus, contained Tab/Shift+Tab, valid Escape cancellation, nested-dialog ownership and focus return. Apply to JARVIS permissions, connection, mobile drawer and appropriate confirmation surfaces. Background controls cannot remain operable under modal UI. Menus need keyboard selection/close; tabs need roles/relationships/arrows. Use field errors, `aria-busy` and restrained status announcements, not every streamed token.

**Mutation:** explain irreversible scope and recovery; avoid repeated confirmation of the same authorised operation. Prevent duplicate submission, surface authoritative errors and make retry safe. Popup/clipboard failure provides a fallback, never “Done”. New UI does not broaden permissions.

**Voice:** one Orb plus text state; Listening is not proof output was spoken. Interrupt/End differ from task Stop. Keep typed fallback, service/output/permission error and privacy state visible. Follow [PRD](PRD.md) session/wake limits.

**Motion:** 120ms feedback, 180ms panel, at most 240ms sheet; existing `cubic-bezier(0.16,1,0.3,1)`, no bounce/loop. Reduce motion removes transforms/shimmer/Orb animation while preserving meaning. Focus outline 2px plus 2px neutral offset; never remove without equivalent visible replacement.

## Orb and performance

Keep `src/jarvis/Orb.tsx` as the single renderer, no donor GUI/second graph library. Real conversations/memory/tasks/devices/relationships supply graph data; decoration cannot imply stored knowledge. Preserve semantic list/detail, selection, pan/zoom and keyboard alternative. During reading/work reduce emphasis without hiding task state.

Suspend frame scheduling when hidden/backgrounded/reduced-motion/not usefully visible; use static idle with zero idle animation frames. Cache layout/style on resize/theme changes instead of every frame. Bound graph nodes/edges and expensive sorts, using representative largest fixtures before changing limits. Invisible expanded/focus transitions must not leave controls keyboard-focusable.

Measure before/after on the same device/build/viewport/graph: idle CPU, frame timing, heap trend, layout work and interaction latency. Keep existing release performance budgets; no claimed savings without measurements. Lazy features must not load unrelated admin/graph/offline work into first-use Chat.

## Acceptance

Inspect real screenshots in dark/light, normal/high contrast and reduced motion at 320/360/375/768/1280 CSS px. Check populated/empty/pending/error/denied/stale, 200% text zoom, keyboard-only, screen-reader labels, phone keyboard/safe areas, no clipping or hover-only critical actions. Browser emulation is not physical Android/iPhone proof.

Use existing accessibility/monochrome checkers and E2E settings/JARVIS/voice/polish journeys alongside actual rendered contrast/focus checks. Static heuristics do not certify accessibility. Any checker repair is a separately authorised source change; do not bypass gates for this documentation mission.

Validate first-task completion, finding Stop, understanding scope/result certainty, setup abandonment and repeated workflow use. Calm hierarchy and progressive disclosure are testable usability hypotheses, not investor/conversion guarantees. Change the narrow existing owners, prove parity and then retire duplicate styling.

## Final interaction contract and visual QA — 10 October 2026

**Locked visual direction:** quiet professional black/graphite/white/blue and equal-quality accessible light mode. Background dark `#090B0F`, surface `#11151C`, raised `#1A202B`, dark text `#F5F7FA`; light background `#F6F8FC`, white surface, light text `#0F172A`; primary blue dark `#2563EB`, light `#1D4ED8`. Decorative borders `#2C3544`/`#CBD5E1` must not be the sole boundary of interactive controls; test interactive `#64748B` and focused dark `#93C5FD` / light `#1D4ED8` for contrast against real adjacent surfaces. Prefer system typeface, 16px body/14px metadata/12px minimum auxiliary, a 4px spacing grid, 10/16/20px control/card/sheet radii, 44×44px minimum touch targets. No copied branding, gamer HUD, excessive neon/glass/blur or continuous decorative WebGL.

**Desktop:** 248px sidebar (64px collapsed), up to 760px readable transcript, optional contextual detail panel at ≥1440px. At 768px use a 64px rail; from 1024px use the sidebar and context sheets below 1440px; ≤767px use one navigation sheet and a composer above the on-screen keyboard/safe areas; 320px viewport must not clip or require horizontal scroll. At 200%/400% browser zoom reflow rather than truncating task/STOP. No redundant bottom navigation on mobile.

**Chat:** one history/transcript and composer with message input, attachment, dictation, Send/Stop, mode selector and More; no competing second chat engine. Enter respects IME composition; Shift+Enter newline; only auto-follow streaming when reader within ~80px of bottom; otherwise show Jump to latest. Preserve draft and files after permission/retry failure; avoid exposing prior-account callbacks or hidden attachments.

**JARVIS:** natural chat is primary. Small task card displays intended checked outcome, selected PC and external account, waiting/active/verification state, current checkpoint, Stop, Take Over, Pause/Resume where meaningful, optional Result/Recovery. Stop state is “Stopping” until device acknowledgement/quiescence is actually verified; an irreversible in-flight effect shows unknown status. Advanced execution traces/permissions/details are opt-in. A task may answer a progress question while working without losing its journal.

**Orb/graph:** 64px desktop / 48px phone ambient identity, graph 240–480px on demand with real user-owned conversations/tasks/devices/memories/approved relationships. Initial 60 visible nodes total, disclosure of omitted nodes and accessible semantic list, keyboard selection, pointer pan/zoom and touch pinch, subtle cursor reaction and reduced-motion state. Deactivate hidden rendering, idle animation and offscreen graph updates. No invented nodes or theatrical boot countdown.

**All routes and controls:** specify actual event handler, owner, keyboard focus, disabled/denied/pending/retry behaviours for Chat, JARVIS Conversations/Activity/Devices, Library, all five Settings groups (Account, Appearance, Notifications, Privacy & Security, Billing & Usage), integrated Owner/Staff consoles, sign-in/MFA/password/reset, signed install, Android bubble and phone remote tasks, notifications, billing, first visit and 404. Test true loading vs empty vs error; source-bound success vs click acknowledgement; skeleton matching content geometry; overlays and focus return; dark/light; accessibility and native file/data privacy.

**Visual test matrix:** record actual screenshot diffs for widths 320/360/390/480/768/1024/1280/1440/1920px, both themes, dark/light system preference, 200–400% zoom, screen-reader and keyboard-only navigation, touch, IME/landscape, focus ring, modal Escape/return, long source filenames, loading, empty, permission-denied, error, unknown effect, successful verified output. Motion defaults 120/180/240ms and stops when reduced-motion, background tab or graph hidden. Show elapsed time only from actual checkpoints, no fictional progress percentage. A plan and palette alone do not count as implementation or pixel-perfect proof.

## 11. Final pixel-level UI, full control ownership and Orb contract — binding 1A

This section refines existing design/architecture guidance with the latest source-specific details. Where provisional dimensions conflict, latest user decisions **1A / 2A / 3A** and the requirements below control; existing shipped behaviour remains evidence to recheck, not an implementation claim.

### 5.1 Selected visual system

Use these exact semantic tokens:

| Token                      | Dark      | Light     |
| -------------------------- | --------- | --------- |
| Background                 | `#090B0F` | `#F6F8FC` |
| Surface                    | `#11151C` | `#FFFFFF` |
| Raised                     | `#1A202B` | `#EDF2F8` |
| Primary text               | `#F5F7FA` | `#0F172A` |
| Secondary text             | `#B2BDCC` | `#475569` |
| Accent text                | `#60A5FA` | `#1D4ED8` |
| Primary button             | `#2563EB` | `#1D4ED8` |
| Button hover               | `#1D4ED8` | `#1E40AF` |
| Button pressed             | `#1E40AF` | `#1E3A8A` |
| Identifying control border | `#64748B` | `#64748B` |
| Focus                      | `#93C5FD` | `#1D4ED8` |
| Success text               | `#86EFAC` | `#166534` |
| Warning text               | `#FCD34D` | `#92400E` |
| Danger text                | `#FCA5A5` | `#B91C1C` |

The old subtle borders `#2C3544` and `#CBD5E1` may remain decorative separators. They must not be the sole identifying boundary for a control.

Calculated examples:

- White on `#2563EB`: 5.17:1.
- White on `#1D4ED8`: 6.70:1.
- `#64748B` against dark raised surface: 3.43:1.
- `#64748B` against white: 4.76:1.
- Selected success/warning/danger text pairs exceed 4.5:1.

These calculations do not replace checking rendered controls, overlays and forced-colour modes.

Use system fonts, body 16/24 px, secondary 14/20, auxiliary 12/16, headings 20/28, 28/36 and 36/44. Use a four-pixel spacing grid, control radius 10 px, card radius 16 px and sheet radius 20 px. Use existing Lucide icons with consistent stroke and accessible labels.

Targets are at least 44×44 px. Focus uses a two-pixel ring and two-pixel offset. Motion uses 120/180/240 ms only for meaningful transitions.

Default theme follows the system; both themes are fully supported.

### 5.2 Layout specification

| Width   | Required arrangement                                                                    |
| ------- | --------------------------------------------------------------------------------------- |
| 320     | 56 px header; 12 px content gutters; wrapped toolbar; no page-level horizontal overflow |
| 360/390 | Same structure; safe-area-aware composer and full usable STOP target                    |
| 480     | Single primary column; previews may widen inside their own surface                      |
| 768     | 64 px rail; sheets for navigation/context; 20 px content gutters                        |
| 1024    | 248 px sidebar; primary content fills remaining space                                   |
| 1280    | Sidebar plus maximum 760 px conversation column; context opens as a sheet               |
| 1440    | Optional 320 px context panel, only when requested                                      |
| 1920    | Same reading width; extra space does not stretch prose or enlarge the Orb               |

Collapsed desktop navigation is 64 px. Do not show multiple competing primary navigation systems.

Settings is at most 920 px wide and 720 px high, constrained by viewport margins. On phones it occupies the available visual viewport, with a 56 px header, labelled category strip and scrollable body.

The composer:

- Minimum height 48 px.
- Desktop maximum text area 240 px.
- Phone maximum is the smaller of 136 px and 30% of the visual viewport.
- Lives in the flex layout above the visual keyboard.
- Respects dynamic viewport height, safe areas and `visualViewport` changes.
- Never covers the last message, validation error or STOP.
- Keeps options/attachments independently wrappable.
- Preserves scroll anchor unless the reader is within 80 px of the bottom.

Enter submits only outside IME composition; Shift+Enter adds a newline. Mobile Enter defaults to newline, with explicit Send. Apply composition safeguards to Chat, JARVIS, rename and relevant confirmation fields.

### 5.3 Global control contract

Every reachable control receives:

`source owner → existing callback → proposed behaviour → permission → pending/error/unknown states → focus → keyboard/touch → responsive variant → independent acceptance test`.

All mutations capture request ID, account generation, resource ID and expected version before the first await. Disable conflicting operations on the same resource; keep STOP and safe navigation available.

Loading, error, empty and ready are distinct. Failed refreshes retain prior data labelled stale. Destructive dialogs initially focus Cancel and remain open after failure.

Use native semantics and proper modal focus management. Only the topmost dialog handles Escape. Hidden controls must be inert or removed, not merely transparent.

Implement WCAG 2.2 AA checks, including reflow, keyboard access, accessible authentication, status messages and unobscured focus. The 44 px product target is deliberate; it must not be misrepresented as the AA minimum. [W3C quick reference](https://www.w3.org/WAI/WCAG22/quickref/).

### 5.4 Route and control instructions

| Surface             | Existing owner/callback                                      | Required implementation                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell               | `AppShell`                                                   | Chat/JARVIS/Library primary navigation; Help/Settings utilities; server-authorised console entry; close mobile drawer after navigation and focus page heading                          |
| Account menu        | Existing Settings/sign-out/Upgrade callbacks                 | Upgrade only after verified useful value and operational billing; sign-out immediately invalidates local account generation                                                            |
| Chat composer       | `ChatWorkspace.send`, `useChat.stop`                         | Acquire operation ownership before allowance await; preserve draft on failure; STOP remains available throughout admission/stream/settlement                                           |
| Chat options        | Existing mode/research/thinking/temporary controls           | Clear incompatible options on mode change; show the actual Online/Offline mode without provider/model identifiers; temporary attachments/transcript must not leak into account storage |
| Attachments         | Existing `attach` and tray                                   | Per-file reading/ready/error states; bind asynchronous reads to original account/conversation; separate attachment success from Library-save failure                                   |
| History             | Existing open/rename/archive/export/delete callbacks         | Row-scoped pending/error; IME-safe rename; deletion reconciles uncertainty instead of restoring a stale whole list                                                                     |
| Turn actions        | `MessageList.Turn` callbacks                                 | Clipboard failure recovery; scoped edit/resend/delete; retain correct attachment association and operation identity                                                                    |
| JARVIS composer     | `JarvisWorkspace.send`, `interject`                          | Online-only; retain 8,000-character limit; working-task messages are interjections, not a second controller                                                                            |
| Task controls       | `stop`, `takeOverNow`, `resume`, confirmation callbacks      | Show Stopping until quiescence evidence; fresh observation on Continue; confirmation binds exact device/resource/digest                                                                |
| Panels              | `JarvisPanels`                                               | Conversations/Activity/Devices remain secondary; preserve selection/scroll; permissions reachable without extra primary navigation                                                     |
| Live view           | `BrowserPanel`                                               | Stop frame reads when hidden/collapsed; timestamp frames; retain stale frame with clear stale label; provide textual equivalent                                                        |
| Devices             | Existing target, permission, background and revoke callbacks | Never silently retarget; serialize switch saves; retain target/confirmation until removal acknowledged                                                                                 |
| Pairing             | `ConnectDevice.connect` and decline handler                  | Exact device/fingerprint/expiry; approval idempotent by enrolment; decline failure keeps dialog open; closing does not mean approval                                                   |
| Settings            | `settings-panel`                                             | Exactly Account, Appearance, Notifications, Privacy & Security, Billing & Usage; nested proof owns focus/Escape                                                                        |
| Notifications       | `NotificationsSection.apply`                                 | Serialize preference writes; separate account preference, OS permission and device push subscription; row creation does not prove delivery                                             |
| Data controls       | Existing export/delete/offline controls                      | Explicit class/cutoff/manifest; partial export truthful; logical removal separate from eventual physical erasure                                                                       |
| Auth                | Existing Google/email/password callbacks                     | Respect selected identity; safe return path; preserved draft; never auto-submit a held task after authentication                                                                       |
| OTP/MFA             | Existing verify/challenge/recovery callbacks                 | Length matches provider configuration; paste/autocomplete support; no code logging; stale proof cannot resume another action                                                           |
| Two-step setup      | `TwoStep.begin/finish/turnOff/makeCodes`                     | Real QR/manual key; verify before Enabled; partial enrolment/code issuance handled separately; codes revealed once                                                                     |
| Billing             | `BillingSection`, usage owner                                | Reconcile legacy tiers first; Free plus one clear monthly launch offer is a design default, not an owner-selected price; unavailable checkout remains explicitly unavailable           |
| Owner/Staff         | `ConsolePage`, existing mutation owners                      | Exact rights/customer/reason; fresh bound proof; immediate revocation; no separate admin origin; audit references for mutations                                                        |
| Help/legal/errors   | Existing routes                                              | Retain working Help search, finite callback/outage recovery, valid links and understandable empty/error states                                                                         |
| Tray/Android bubble | Existing local authorities                                   | Local STOP remains available offline; folder changes do not retarget active tasks; permission/readiness/update states remain distinct                                                  |

Specific source repairs include:

- JARVIS Enter handler needs composition protection.
- Pairing decline currently closes through `finally`, including failure.
- Device removal clears confirmation/target before acknowledgement.
- Notification preference writes need sequencing.
- Existing Upgrade placement precedes the required verified-value gate.
- Faded Orb controls can remain focusable.
- UI “stopped” must distinguish recorded cancellation from device quiescence.

### 5.5 Orb and graph

Keep `Orb.tsx` and `graph.ts` as owners.

Selected ambient sizes are **64 px desktop and 48 px phone**, replacing the historical larger provisional sizes. Use a static SVG idle illustration, subtle pointer response when active and no idle render loop.

Graph expansion is explicit. Show at most **60 nodes total**, not 60 per category. Provide count, lazy loading, grouping, pan/zoom/pinch, keyboard controls and a semantic list.

Use only authorised real conversations, tasks, devices, allowed apps/sites and appropriate memories. Filter before returning data and before rendering it.

| State           | Presentation                                     |
| --------------- | ------------------------------------------------ |
| Idle            | Static Orb; no implied active microphone         |
| Listening       | Visible microphone state and “Listening”         |
| Thinking        | Restrained transition and actual phase label     |
| Executing       | Task phase/checkpoint, no fake percentage        |
| Permission wait | “Waiting for your approval”; exact action        |
| Paused/takeover | “You have control”; input authority withdrawn    |
| Verifying       | “Checking the result”                            |
| Verified        | “Completed and checked”                          |
| Partial         | Completed and missing outcomes listed            |
| Unknown         | “Checking what happened”; resource fenced        |
| Failed          | Specific failure and safe next action            |
| Offline         | Separate planner/device connectivity explanation |
| Stopped         | Known applied effects and remaining uncertainty  |

STOP and active confirmation never fade. Pause rendering when hidden, backgrounded, reduced-motion or low-power conditions require it.

## Human-first onboarding and earned upgrade interaction — B11–B30

Design ownership is the *presentation* of the [PRD](PRD.md) flows, never a new task, permission, billing or content authority. This section does not change approved graphite/white/blue tokens, responsive breakpoints, 64px desktop/48px phone Orb, five settings categories, three destinations or reduced-motion contract.

| Surface | Primary user action | State/negative behaviour | Evidence gate |
| --- | --- | --- | --- |
| Public landing | Understand the one-sentence value; try working Chat or a **real** sample | No forced card or installer; avoid a false playable demo | Comprehension, working first input, keyboard/mobile QA |
| Example selection | Run verified fixture or upload/drag/paste supported file | Distinguish user data, fixtures, unsupported type and size; preserve privacy | Real completed output and proper file scope |
| Optional PC pairing | Install signed Agent, see readiness, pair and grant needed permission | Explain why/what/locality/revoke; show denial and repair honestly | Native signature, real OS permission and recovery |
| In-progress JARVIS | Follow actual step, current app and live approval; STOP/Take Over | Paused/disconnected/stale clearly labelled, no fictional percent | Event/receipt-bound control state and physical STOP proof |
| Verified task result | Open actual native file, inspect checks and repeat with fresh input | Partial or unknown never says Completed; real elapsed time only | Independent reopen/readback and version check |
| Upgrade invitation | View one optional approved pilot plan with capacity and exact total | Only after real checked value; no timers, forced card, hidden fee | Contract/merchant tests, user comprehension, cancellation |
| Returning customer | Find proven task history and consented repeat workflow | Missing file, version change, revoked grant or new account requires revalidation | New independent receipts and account isolation |

**Microcopy guidance:** direct outcome-first language. Explain a permission's practical need before offering an OS handoff; use “Working in Excel”, “Checking totals”, “Waiting for your permission”, “Could not confirm the final file”, “You can continue free”, and “Paid plan: [accurate capacity] for [full payable cost]” only where supported by actual state. Don't imply it saw a file/browser/screen that it did not access. Keep easy Exit, Back, Skip, STOP, cancellation and privacy controls; no fake popularity or guilt framing.

**Device and accessibility review:** at 320px, phone landscape, desktop and 200%/400% zoom, confirm the composer, readable price/limits, install consent, visible errors, STOP and final file remain usable with pointer, keyboard, switch/screen reader and reduced motion. Derive layout from existing components before adding new ones. No permanent carousel, animated popup or growth modal may obstruct an active task. Test control contrast, focus after dialog dismissal, IME composition and signed-out/failing-fetch states.
