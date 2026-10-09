# OCADE visual and interaction system

One visual authority for Chat, JARVIS, Library, settings, public pages and console. [PRD](PRD.md) owns pages/options; [PLAN](../PLAN.md) owns implementation order; [TESTING](TESTING.md) owns evidence. These are targets, not claims that current source implements them. Preserve CARCC/OCADE identity without copying another product's protected branding.

## Chosen direction and code ownership

Deep neutral dark surfaces, clean light surfaces, readable neutral type, restrained blue active state, green verified success and red destructive/error state. No neon, fake terminal decoration, decorative metrics, rainbow graphs, metallic textures or permanent animated backgrounds.

Reuse `src/styles.css`, `src/shared/ui/tokens/monochrome.css`, `src/lib/appearance.tsx` and existing shell/row/dialog components. Do not add another theme package. Current primitive comments describe a monochrome invariant; `scripts/check-monochrome.mjs` already permits hue only through `--state-info`, `--state-success` and `--destructive`. Future implementation must reconcile the old comment with this semantic palette, retain those narrow exceptions and avoid scattered colour literals. Warnings use neutral text plus an icon/label. User document imagery is content, not product chrome.

## Exact palette

Hex sRGB values are normative. Define them once through the existing CSS variables; components consume semantic tokens. Do not introduce an alias containing an unapproved raw hue.

| Role / variable                      | Dark      | Light     | Use                                                 |
| ------------------------------------ | --------- | --------- | --------------------------------------------------- |
| Page `--background`                  | `#0B0B0B` | `#FAFAFA` | Canvas                                              |
| Surface `--card`                     | `#151515` | `#FFFFFF` | Composer/cards                                      |
| Raised `--popover`                   | `#1E1E1E` | `#F2F2F2` | Menus/dialogs                                       |
| Text `--foreground`                  | `#F5F5F5` | `#171717` | Body/headings                                       |
| Secondary `--muted-foreground`       | `#A3A3A3` | `#595959` | Labels/help/time                                    |
| Control outline `--input`            | `#6B6B6B` | `#737373` | Boundary when needed to identify a control          |
| Separator `--border`                 | `#2E2E2E` | `#D6D6D6` | Decorative divider, never sole interactive boundary |
| Active/focus/link `--state-info`     | `#76A9FF` | `#245DC1` | Text/icon/underline accompany colour                |
| Verified `--state-success`           | `#70CFA0` | `#176B44` | Independently checked outcome                       |
| Error/destructive `--destructive`    | `#FF8F8F` | `#B42318` | Error label/icon/action                             |
| Primary `--primary`                  | `#F5F5F5` | `#171717` | Neutral dominant action                             |
| Primary label `--primary-foreground` | `#0B0B0B` | `#FFFFFF` | Text on primary fill                                |

Semantic coloured text/icons sit on opaque neutral backgrounds. Do not put white text on dark-theme pale blue/red/green. A filled destructive control uses dark `#0B0B0B` text on dark-theme red, white text on light-theme red. Focus ring references `--state-info` with a neutral offset. Pending/warning are neutral and explicitly labelled. Keep Dark/Light, High contrast and Reduce motion; do not expose an unimplemented System preference.

### Calculated contrast

Calculated on 2026-10-09 using sRGB linearisation and `L = 0.2126R + 0.7152G + 0.0722B`; ratio `(Llighter + 0.05)/(Ldarker + 0.05)`. Each value is the minimum across Page/Surface/Raised above, with opaque backgrounds:

| Foreground      | Dark minimum | Light minimum | Required use                      |
| --------------- | ------------ | ------------- | --------------------------------- |
| Body            | 15.29:1      | 16.01:1       | At least 4.5:1 normal text        |
| Secondary       | 6.61:1       | 6.26:1        | At least 4.5:1 normal text        |
| Blue            | 7.06:1       | 5.50:1        | At least 4.5:1 text               |
| Green           | 8.83:1       | 5.82:1        | At least 4.5:1 text               |
| Red             | 7.60:1       | 5.87:1        | At least 4.5:1 text               |
| Control outline | 3.13:1       | 4.24:1        | At least 3:1 identifying boundary |

Decorative separators deliberately do not qualify as identifying boundaries. Opacity, glass, selected/hover states and user-content backgrounds require final-composite measurement. These token calculations are not rendered WCAG certification. High contrast removes transparency and strengthens focus/boundaries. Verify actual components with keyboard, zoom and assistive technology.

## Type, spacing, shape and depth

- Keep self-hosted Inter with system fallback, no third-party font requests. JetBrains Mono is for actual code/preformatted content only. Add no display font. Check non-Latin system fallback for clipping.
- Type/line-height: metadata 12/18px; compact labels 14/20; body/inputs 16/24; section 20/28; page 28/36; signed-out introduction at most 36/44. Weights 400 body, 500 labels, 600 headings. Phone inputs at least 16px; reading column at most 760px, legal 720px; no justified text.
- Spacing: 4, 8, 12, 16, 24, 32, 48px. Phone gutters 16px, desktop 24px; 8px within controls, 16px related rows, 24–32px sections. Compact operator tables may use 12px padding with reachable actions.
- Radius: compact controls 10px, groups/cards 16px, dialogs/sheets 20px, composer 24px. Pills for compact chips/status only. Migrate existing radius variables deliberately; no arbitrary per-component shapes or card around every sentence.
- Controls: 44px normal height, 48px Stop/Take Over; 18–20px icon inside at least 44px hit area. Dense desktop table controls may be 32px with spacing/keyboard access; phone retains 44px product target. This is a usability choice, not a claim every smaller control violates a standard.
- Shadows: light panel `0 12px 32px rgba(0,0,0,0.12)`, light dialog `0 24px 64px rgba(0,0,0,0.18)`; dark panel `0 12px 32px rgba(0,0,0,0.32)`, dark dialog `0 24px 64px rgba(0,0,0,0.48)`. Ordinary content uses borders, not permanent elevation.
- Glass only for floating bubble, compact voice surface and optional dialog chrome: 92% neutral surface, maximum 12px blur, opaque content. Use opaque fallback for high contrast/reduced transparency/unsupported effects/low-performance devices. No large blurred transcript or scrolling pane.

## Responsive composition

Reuse existing breakpoints: below 768px navigation sheet; 768–1199px compact/collapsible shell; at least 1200px a 256px expanded sidebar. Support 320 CSS px and 200% text zoom without two-dimensional page scrolling. Label local overflow regions for code/tables. Respect visual viewport and `env(safe-area-inset-*)`; mobile keyboard must not cover composer or Stop.

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

Suspend frame scheduling when hidden/backgrounded/reduced-motion/not usefully visible; use static or low-frequency idle. Cache layout/style on resize/theme changes instead of every frame. Bound graph nodes/edges and expensive sorts, using representative largest fixtures before changing limits. Invisible expanded/focus transitions must not leave controls keyboard-focusable.

Measure before/after on the same device/build/viewport/graph: idle CPU, frame timing, heap trend, layout work and interaction latency. Keep existing release performance budgets; no claimed savings without measurements. Lazy features must not load unrelated admin/graph/offline work into first-use Chat.

## Acceptance

Inspect real screenshots in dark/light, normal/high contrast and reduced motion at 320/360/375/768/1280 CSS px. Check populated/empty/pending/error/denied/stale, 200% text zoom, keyboard-only, screen-reader labels, phone keyboard/safe areas, no clipping or hover-only critical actions. Browser emulation is not physical Android/iPhone proof.

Use existing accessibility/monochrome checkers and E2E settings/JARVIS/voice/polish journeys alongside actual rendered contrast/focus checks. Static heuristics do not certify accessibility. Any checker repair is a separately authorised source change; do not bypass gates for this documentation mission.

Validate first-task completion, finding Stop, understanding scope/result certainty, setup abandonment and repeated workflow use. Calm hierarchy and progressive disclosure are testable usability hypotheses, not investor/conversion guarantees. Change the narrow existing owners, prove parity and then retire duplicate styling.
