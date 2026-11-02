# Universal Local Computer Control and MCP Toolbox Routing — Corrected Reference

> **Status:** supporting research for [`plan.md`](../../plan.md) (v4). It is **not** an authority and not a work queue; `plan.md` decides. This revision (2 November 2026) replaces the uncorrected proposal adapted from `GEMINI(1).txt`; the original text remains in git history at commit `60ab8ed`. Section numbers 1–13 keep the original numbering so `plan.md` Appendix C references (`U§n`) stay valid.
>
> **How to read each section:** _Proposal_ summarises the original idea. _Assessment_ separates what is true, what is overstated and what is unsafe. _OCADE decision_ points to the plan. Sources are listed in §19. "Implemented" means present in the OCADE repository; it does not mean qualified on consumer hardware.

## Summary of corrections

| Original claim                                                                             | Correct position                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility control is a "0-error engine" that "cannot miss"                             | Accessibility trees are the best structured source **when an application exposes them**. Custom-drawn, canvas, game and some cross-platform UIs expose little. Elements can be ambiguous or change between versions. Errors are reduced, not eliminated. |
| Automation IDs are "permanent" and "never change"                                          | AutomationId and AX identifiers are provider-defined and may be missing, duplicated or changed between versions. Bind to role, name, ancestry and the current observation, and revalidate before each action.                                            |
| Control works in minimized or hidden windows "with 0% chance of missing"                   | Many providers do not act on minimized content, UI Automation actions may move focus by default (`AutoSetFocus`), and Windows restricts who may take the foreground. OCADE refuses or restores with consent; it never claims hidden-window control.      |
| stdio has "virtually zero" or "sub-millisecond" latency, so the whole loop is near-instant | Local IPC is cheap, but measured OCADE task time is dominated by model inference (56%) and cloud↔device waiting (~34%). Device execution is about 6%.                                                                                                    |
| A local small LLM plus a vector database should route and plan                             | Rejected: the owner requires the online authorised planner; it would add gigabytes to the installer; with ~40 operations a filtered TF-IDF shortlist suffices, unless measured recall falls below 98%.                                                   |
| The loop retries "thousands of times" until perfect                                        | Rejected: hard limits on steps, failures and verification attempts; an uncertain effect is never repeated automatically.                                                                                                                                 |
| Automatic privilege elevation (RunAs/sudo) on failure                                      | Rejected: only official UAC/macOS prompts approved by the person.                                                                                                                                                                                        |
| Headless browsers "bypass cookies and asset loading"                                       | Misleading. OCADE uses a real browser with a dedicated profile. It never extracts cookies or passwords and respects site authentication.                                                                                                                 |

## 1. Universal control without hardcoded application lists

**Proposal:** combine OS accessibility trees with dynamic shortcut/menu mapping per active process.

**Assessment:** the no-hardcoding principle is correct. Accessibility is the right _structured GUI_ source but not universal. Dynamic shortcut mapping is fragile: shortcuts vary by locale, version and focus.

**OCADE decision:** capability discovery + structured control. Application object models, files and documented command-line interfaces come before the GUI. Visual matching is a last resort. Implemented: Windows UIA and macOS AX bridges (`windows_worker.py`, `mac_worker.py`). Plan §8, §11; packages W3, W6, W7.

## 2. Professional-quality deliverables

**Proposal:** a local "creative director" LLM queries a vector database of expert blueprints and compiles an execution script.

**Assessment:** separating domain judgment from mechanical execution is sound. A local LLM and a vector database are unnecessary and conflict with owner decisions. Professional quality must be **verified**, not asserted.

**OCADE decision:** Gemini supplies domain judgment with short generic guidance. Deliverables are produced in editable standard formats (docx, xlsx, pptx, OTIO timeline, glTF) and checked by the independent verifier. Subjective quality gets human review. Plan §12, W5.

## 3. MCP toolbox routing and isolation

**Proposal:** strict namespace prefixes; embedding-based semantic router; state machine that exposes only one domain's tools at a time ("zero conflicts guaranteed").

**Assessment:**

- Namespaces are implemented (`fs.*`, `web.*`, `ui.*` and so on).
- Limiting the tools shown per turn improves selection; this is implemented (≤12 operations).
- Exposing **only one domain** at a time is too restrictive: real tasks mix files, web and UI in one step.
- "Zero conflicts" is not a property of routing. Conflicts are prevented by resource leases, the single dispatcher and the journal.

**OCADE decision:** deterministic trust/grant/health filters, then TF-IDF ranking, then ≤12 operations, with continuity for operations already in use. Plan §10, W4.

## 4. Local execution and performance

**Proposal:** stdio pipes "virtually zero latency"; dual local models for routing and creative work.

**Assessment:** stdio is the MCP-recommended local transport and is adequate. The dual-local-model proposal is rejected (§2, §3). Speed comes from fewer model calls, event-driven pickup and piggybacked dispatch (§14).

**OCADE decision:** plan §10, §15, W2.

## 5. Window movement, resizing and reliable targeting

**Proposal:** accessibility targeting survives resize, move, minimise and hiding.

**Assessment:**

- Resize and move are handled well by structured targeting, provided boxes are recomputed from a fresh observation.
- Minimised and hidden windows are **not** reliably controllable (see the summary of corrections).
- Two windows of one application must be distinguished by process ID, window handle/number and process start time, not by title.

**OCADE decision:** window leases (implemented); per-monitor DPI-aware transforms (W6); minimised windows are refused or restored with consent. Plan §8.

## 6. Three-tier execution architecture

**Proposal:** Tier 1 OS scripts, Tier 2 accessibility, Tier 3 web/API.

**Assessment:** the order is correct, but incomplete. It omits application object models and file-format operations, which are often faster and more reliable than any GUI. It also omits a governed long-running job tier for renders, exports and installs. Silent PowerShell execution of system changes (for example network settings) must be confirmed by the person.

**OCADE decision:** order of preference: native/file/format operations → documented command-line/scripting interfaces (confirmed when they have effects) → browser DOM → OS accessibility → visual fallback. Typed file primitives and `job.*` are added in W3. Plan §6, §8.

## 7. Professional workflow planning and verification

**Proposal:** mandatory discovery state; professional blueprints; closed-loop error recovery that rewrites scripts and may elevate privileges.

**Assessment:**

- Discovery before acting is correct, and it is the fix for 3 of 9 measured failures (checks compiled before observation).
- Blueprint retrieval is replaced by Gemini judgment plus verification.
- Error-driven repair is correct only when bounded and non-elevating.
- The "professional optimisation" example (registry tweaks, pagefile changes) is unsafe as a default and must never run without explicit, specific confirmation.

**OCADE decision:** discovery → request-bound contract → bounded repairs (≤2 verifier-driven). Plan §7, §9, W1, W4.

## 8. Illustrative semantic toolbox router

**Proposal:** a `sentence-transformers` router choosing one toolbox per prompt.

**Assessment:** a prototype only. It adds a model download, picks one domain per prompt (too coarse) and has no trust, permission or health filtering.

**OCADE decision:** rejected; the existing descriptor shortlist is used (plan §10).

## 9. External MCP ecosystem and routing patterns

**Proposal:** adopt community MCP servers (Windows computer use, Peekaboo, Open Interpreter, Filesystem, Microsoft 365/Google Workspace, Playwright, TinyFish, DaVinci Resolve).

**Assessment:**

- Directories list servers of very uneven quality and provenance. Installing them from a registry is a supply-chain risk.
- OCADE already implements equivalent first-party workers for the core roles.
- Cloud-office and CRM connectors need OAuth scopes and accounts.
- TinyFish is an external paid service.
- Application-specific bridges (for example DaVinci Resolve scripting) are capabilities of a particular installation and must be discovered, not assumed.

**OCADE decision:** first-party workers for core roles. External MCP servers only when pinned by executable and argument hash, reviewed and permission-scoped (implemented pinning; review procedure in W11). No automatic installation. Plan Appendix C.

## 10. Conceptual architecture: brain, sensors, hands

**Proposal:** plain-language model; claims of unbeatable speed with "zero cloud APIs".

**Assessment:** the analogy is useful. The "zero cloud" claim contradicts OCADE's online planner by design, and superiority claims are untested.

**OCADE decision:** brain = online Gemini under RTAA; sensors and hands = RTVC on the device. Plan §6–§8.

## 11. Continuous feedback and adaptive control

**Proposal:** continuous sense–act–critic at "sub-millisecond" rates; serialise the whole accessibility tree every N ms; optimise "until a 1000% perfect outcome".

**Assessment:**

- Continuous polling of whole trees wastes CPU and tokens. Event subscriptions (UIA events, macOS AXObserver) plus on-demand reads are better.
- Every model decision costs seconds, not milliseconds.
- Unbounded optimisation is unsafe.

**OCADE decision:** event-driven world-state cache on the device; deltas to the model; bounded loop; guarded step lists for deterministic stretches. Plan §7, §8.

## 12. Receding-horizon control architecture

**Proposal:** compute the next micro-action, observe, repeat; "immutable" IDs; production-ready sample controller.

**Assessment:** receding-horizon control is the right model and is implemented as a bounded loop. Its cost is one model call per step, which OCADE reduces with read batching and guarded step lists. The sample controller is not production code: it attaches by process name, has no lease, permission check, STOP fence or journal, and treats a readback match as task success.

**OCADE decision:** plan §7; sample code rejected.

## 13. Dynamic planning and human interruption

**Proposal:** a three-stage defence (structural locking, telemetry catch, strategy pivot) handles user edits "perfectly".

**Assessment:** the stages are reasonable but not perfect. OCADE pauses mutations while the person's input is newer than its own (implemented on Windows and macOS), detects document and focus changes through leases, and replans from fresh state without overwriting the person's edits.

**OCADE decision:** plan §8 (questions 24, 29), W6, W7.

## 14. Local communication options compared

| Path                               | Mechanism                                               | Assessment                                                                                                               | Decision                                          |
| ---------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Gateway ↔ local workers            | MCP over stdio                                          | Recommended by the MCP specification for local servers; process isolation; simple lifecycle                              | **Keep**                                          |
| Gateway ↔ local workers            | Named pipes / Unix sockets                              | Similar latency; adds endpoint security and lifecycle work; no measured benefit                                          | Reject                                            |
| Gateway ↔ local workers            | MCP Streamable HTTP on localhost                        | Designed for remote/multi-client servers; adds an attack surface                                                         | Reject for local workers                          |
| Large binaries (previews, renders) | base64 inside JSON-RPC                                  | ~33% size overhead plus encode/decode                                                                                    | Replace with workspace file handles + sha256 (W2) |
| Cloud → device                     | Exponential backoff polling (1→30 s)                    | Measured cause of idle pickup delay                                                                                      | Replace                                           |
| Cloud → device                     | Content-free wake nudge via Supabase Realtime broadcast | Free plan: 200 concurrent connections, 100 messages/s; authority unchanged because the device still makes a signed claim | **Adopt with polling fallback** (W2)              |
| Cloud → device                     | Holding Worker requests open (long-poll)                | The Worker would still have to poll the database; uses request budget                                                    | Reject unless Realtime fails                      |

## 15. Adaptive planning architectures compared

| Approach                                                                       | Accuracy              | Latency                  | Safety                              | Decision               |
| ------------------------------------------------------------------------------ | --------------------- | ------------------------ | ----------------------------------- | ---------------------- |
| Fixed script from one plan                                                     | Breaks on change      | Low                      | Poor                                | Reject                 |
| One model call per micro-action                                                | Highest adaptivity    | Highest cost and latency | Good                                | Current baseline       |
| **Bounded receding horizon + read batching + guarded step lists + milestones** | High (to be measured) | Lower                    | Good: local guards, per-step policy | **Adopt**, gated by E1 |
| Hierarchical multi-agent (planner + sub-agents)                                | Unproven here         | Higher                   | Duplicate authority risk            | Reject                 |

## 16. Routing approaches compared

| Approach                                   | When it helps                                      | Assessment for OCADE (~40 operations) |
| ------------------------------------------ | -------------------------------------------------- | ------------------------------------- |
| Expose all tools                           | Very small catalogs                                | Too much context                      |
| **Deterministic filters + TF-IDF + top-K** | Tens of tools                                      | **Adopt**; measure recall ≥98%        |
| Embedding retrieval                        | Hundreds of tools or paraphrase-heavy descriptions | Add only if measured recall fails     |
| LLM pre-router                             | Very large heterogeneous catalogs                  | Extra model call per turn; reject     |

## 17. Native interfaces vs GUI automation vs vision

| Need                                   | Best mechanism                                    | Why                                           |
| -------------------------------------- | ------------------------------------------------- | --------------------------------------------- |
| File transforms, bulk organisation     | Native file operations                            | Deterministic, fast, verifiable by hash       |
| Spreadsheets, documents, presentations | Format libraries / application object models      | Preserve structure and formulas; no UI timing |
| Media and 3D                           | Command-line/scripting interfaces as tracked jobs | Long-running, resumable, measurable outputs   |
| Web applications                       | DOM via Playwright                                | Structured, origin-bound, readable            |
| Desktop apps with accessible controls  | UIA / AX patterns                                 | No pointer movement; readback possible        |
| Canvas, games, custom-drawn UIs        | Visual matching with confidence, foreground only  | No structure available; last resort           |

## 18. Professional creative tasks — what can and cannot be verified

**Automatically verifiable:**

- Files exist and parse.
- Durations, frame rates and codecs.
- Audio presence.
- Blank-frame detection.
- Geometry statistics.
- Material and object counts.
- Re-opening of editable projects.
- Edits confined to requested regions.

**Partially verifiable:**

- Composition and colour statistics.
- Shot variety.

**Not automatically verifiable:**

- "Cinematic", "premium" or "professional" aesthetic quality. This needs blind human review.

**Runner limits:** headless Blender rendering works with Cycles on CPU. Eevee needs EGL/Mesa and is unverified on GitHub runners. Free runners are CPU-only with a 6-hour job limit.

**OCADE decision:** plan §20.3.

## 19. Sources

Primary or vendor sources where available. Third-party items are marked and must be rechecked before they are relied on.

- MCP transports (stdio, Streamable HTTP): https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
- UI Automation `AutoSetFocus` (actions set focus by default): https://learn.microsoft.com/en-us/windows/win32/api/uiautomationclient/nf-uiautomationclient-iuiautomation2-put_autosetfocus
- UI Automation Window pattern: https://learn.microsoft.com/en-us/windows/win32/api/uiautomationclient/nn-uiautomationclient-iuiautomationwindowpattern
- `SetForegroundWindow` foreground restrictions: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow
- Supabase Realtime limits: https://supabase.com/docs/guides/realtime/limits
- Gemini rate limits (per project, not per key): https://ai.google.dev/gemini-api/docs/rate-limits
- Gemini 4 Argon model page (computer use listed as Preview): https://ai.google.dev/gemini-api/docs/models/gemini-4-argon
- Gemini thinking levels (Gemini 3 generation; verify for the authorised model): https://firebase.google.com/docs/ai-logic/thinking
- Blender command-line arguments: https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html
- GitHub-hosted runner images (windows-2022/2025, macos-15, macos-15-intel): https://github.com/actions/runner-images
- `CGWindowListCreateImage` unavailable in the macOS 15 SDK; ScreenCaptureKit replacement (third-party build reports): https://trac.macports.org/ticket/70756
- Free-tier Flash-Lite limits (third-party, unverified): https://www.scriptbyai.com/gemini-api-free-tier-limits/
- Blender headless Eevee/Cycles (community): https://devtalk.blender.org/t/blender-2-8-unable-to-open-a-display-by-the-rendering-on-the-background-cycles/8607/18
