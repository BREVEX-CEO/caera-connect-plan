## A. Executive verdict

**OCADE has useful foundations for a universal computer operator, but it does not yet establish the complete promise in your request.**

It can discover installed applications, expose generic browser and desktop controls, perform structured file operations, run bounded local action sequences, and use native Office automation. Those are meaningful capabilities in active source.

The remaining problem is deeper than removing application names:

- Discovering an application does not prove which automation interfaces it supports.
- Sending an action does not prove the application performed it.
- Reading a file or screen does not prove the requested outcome is correct.
- Marking an action cancelled does not establish that it caused no effect.
- Keeping a backup does not make rollback safe after the user edits the file.
- Working unattended does not establish background operation without stealing focus.
- Having these mechanisms in source does not establish competitive performance.

**Deleting `ocade_sheets.py` or the Office scripts would remove valuable functionality without solving these problems.** Their selection and verification boundaries need improvement; their native capabilities should remain until a replacement proves parity.

The strongest product direction is:

> OCADE performs authorised work in the customer’s actual software, preserves the customer’s originals, survives interruptions, and returns independently checked outputs with a truthful account of what changed.

That could become a defensible advantage. It is not yet a measured advantage over competitors.

**Audit boundary:** I changed no files, ran no product tests/builds/apps/GUI/device agents, and performed no database or deployment operations. Findings below distinguish source facts, architectural limitations, suspected races, and unmeasured performance hypotheses.

---

## B. Verified source baseline

| Item | Observed baseline |
|---|---|
| Repository | `BREVEX-CEO/caera-connect-plan` |
| Checkout | `C:\Users\haans\Desktop\caera-connect-plan` |
| Branch | `ocade/p00-p22-implementation` |
| Start and final HEAD | `d22b0f70a5cfbffb867bd354d1606b6f544b33ab` |
| Remote implementation branch | Same SHA when inspected |
| Remote main | `d70484da2ddaa910d221ed7f2aa7858c2346fdbd` |
| Uncommitted files | `jarvis-runtime/ocade_sheets.py`, `scripts/e2e/mfa-journey.mjs`, `scripts/e2e/office-journey.mjs` |
| Dirty diff | 22 insertions, 5 deletions across those three files |
| Authority | Latest [PLAN.md](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:3), particularly Section 0 |
| Runtime evidence generated here | **None — UNTESTED by instruction** |

The branch and dirty-file list remained unchanged at the final check. I inspected the working-copy version of the spreadsheet discovery change; I did not overwrite or interfere with it.

### Coverage accounting

The recovered [coverage checkpoint](C:/Users/haans/Desktop/caera-connect-plan/docs/audit-checkpoints/20261010/coverage.json) covers **989 historical baseline paths**. Its baseline is `9b2fe3e40fd915dcf32316e5daa20ed7295f8ffb`.

Hash comparison against the current tracked tree produced:

| Historical checkpoint reconciliation | Paths |
|---|---:|
| Current tracked paths | **935** |
| Unchanged paths eligible for checkpoint reuse | **810** |
| Changed existing paths | **111** |
| New paths | **14** |
| Historical paths now removed | **68** |

Those numbers reconcile: `989 − 68 + 14 = 935`.

For text inventory:

| Counting scope | Files | Physical lines |
|---|---:|---:|
| Selected source/configuration text, excluding detected tests | 699 | 128,572 |
| Detected tests/verification fixtures | 160 | 39,097 |
| Combined selected text | 859 | 167,669 |
| Narrow application/runtime logic definition | **219** | **53,852** |

The narrow runtime definition includes application source, desktop runtime/action code, Android Java and public JavaScript; it excludes tests, development scripts, lockfiles, configurations, migrations and the two major generated TypeScript outputs.

**Fresh detailed source-reading coverage is conservatively at least 4,037 numbered lines across 17 runtime/authority files**, plus additional source searches, documentation, dependency and fixture inspection. Unchanged historical evidence was reused where hashes matched.

This is an inventory-backed, targeted architectural audit. **It is not a claim that all 53,852 runtime lines received a new complete semantic reread.** Consequently, “zero additional defects anywhere in the repository” and an exhaustive dead-code proof cannot be established from this audit.

---

## C. Hardcoded application inventory

### Correct interpretation of “zero hardcoded routing”

The correct target is:

> Production selects software and execution methods from discovered identity, supported capabilities, permissions and task requirements, rather than a developer-maintained product-name list.

It can still contain:

- File-format rules.
- Native object-model implementations.
- OS interfaces.
- Browser protocol implementations.
- Security exceptions.
- Compatibility tests.
- Product names in explanations and licence notices.

Changing filenames does not change routing, compatibility, safety or performance.

### Active production findings

The table groups related occurrences by their functional owner. It is the inventory of relevant bindings located by the tracked-source searches and detailed call tracing, subject to the coverage limits above.

| ID / evidence | Product or family; class | Callers and hardcoded behaviour | Impact and disposition | Safest migration and required proof |
|---|---|---|---|---|
| C01 — [spreadsheet discovery:220](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_sheets.py:220), especially 238–243 | Office-compatible automation; **C/E** | `Computer._sheet → sheets.edit → automation_server`. Constructs `<first ProgID component>.Application`; checks executable association. | No literal Excel launch route here, but an unjustified interface/naming assumption. **GENERALISE qualification.** | Resolve actual registered interfaces, qualify required workbook capabilities before mutation; test incompatible COM servers and changed associations. |
| C02 — [workbook executor:46](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/actions/ocade_workbook.ps1:46), 52–163 | Excel workbook object model; **C** | `edit_with_automation → office_job`. Uses `Workbooks`, `Worksheets`, `Range`, numeric formatting/chart enums and calculation methods. | Valuable specialised executor. Its object model is application-specific even with a discovered ProgID. **KEEP.** | Advertise the exact compatible capability family; preserve calculation, charts, formatting and macro safeguards in real fidelity tests. |
| C03 — [document editing:150](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_documents.py:150), [document executor:33](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/actions/ocade_document.ps1:33) | Word document object model; **C** | `Computer._doc → edit_document → automation_server → office_job`. Assumes `Documents`, ranges, styles and tables. | Discovered automation server is treated as Word-compatible. **KEEP executor; GENERALISE admission.** | Qualify document interfaces separately from workbook interfaces; test incompatible servers, localisation, partial saves and existing open documents. |
| C04 — [document styles:102](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_documents.py:102), [heading readback:24](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/actions/ocade_document.ps1:24) | Word styles; **C/D** | Validation translates supported styles to Word built-in IDs; readback examines local style names. | Numeric built-in IDs are legitimate adapter details. English heading-name matching can omit non-English headings. **GENERALISE readback.** | Identify headings by structural/built-in style identity; verify documents using non-English Office UI. |
| C05 — [spreadsheet formats:461](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_sheets.py:461), [direct editor:317](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_sheets.py:317) | `.xlsx`/`.xlsm`, OOXML; **D** | Typed spreadsheet tool supports these two formats; direct editing uses `openpyxl`. | Restricts this tool’s format scope, not all JARVIS application control. **KEEP explicit capability boundary.** | Add formats only with preservation and calculation evidence; do not silently treat `.ods`, `.xls` or `.xlsb` as equivalent. |
| C06 — [text extraction:53](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_documents.py:53) | PDF, DOCX, PPTX, spreadsheets; **D** | `file_extract` dispatches by format to parsers/XML extraction. | Reading PPTX does not establish presentation editing. **KEEP.** | Extend by actual format support and independent parser/fidelity tests. |
| C07 — [installed apps:156](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_computer.py:156), [app schema:76](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/protocol.ts:76) | All installed applications; **E**, with a discovery defect | Uses OS app records, shortcuts, application bundles and desktop entries. Filters names through an ASCII-only regex and caps results at 300. | Non-Latin names disappear; duplicate labels collapse identities; large inventories truncate. **GENERALISE identity.** | Use opaque discovered IDs with Unicode display labels, collision handling and explicit completeness/pagination. |
| C08 — [server app admission:333](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/task-authority.server.ts:333) | All installed applications; **E**, freshness limitation | `open_app` must match the server’s cached installed-name list. | Newly installed apps can be refused despite newer local discovery. **GENERALISE freshness.** | Bind discovery generation and stable identity through the existing device owner; verify install/uninstall and rename races. |
| C09 — [capability discovery:65](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_discovery.py:65), 124–175, 258–295 | COM, scripting and SDK surfaces; **E** | `app_info` inspects registry servers, associations and nearby scripting/API folders. | Heuristic discovery is useful but does not prove a callable compatible API. **KEEP and qualify.** | Return evidence and confidence for each interface; validate a harmless read capability before any effect. |
| C10 — [existing browser:25](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_existing_browser.py:25), 64–87 | Chromium family; **E/C** | Existing-browser discovery uses Chromium layout/debugging assumptions; setup URL is `chrome://inspect/#remote-debugging`. | Protocol-family support is legitimate, but this path does not establish Firefox/Safari existing-profile control. **KEEP explicit scope.** | Declare CDP capability; qualify discovered browser/version. Add other browser families only through supported consented interfaces. |
| C11 — [browser controller:390](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/actions/browser_control.py:390), [page observer:5](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/actions/ocade_page.js:5) | Web applications; **E** | Shared DOM observation, semantic references, Playwright actions and browser boundaries. | Generic website control, not an app-name workflow list. **KEEP.** | Preserve stale-reference, navigation, file-transfer and sensitive-submission tests. |
| C12 — [native accessibility:258](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_accessibility.py:258) | Native Windows applications; **E/F** | `ui_inspect/ui_act` use current UI Automation references and patterns. | No fixed application coordinates found in this owner. Some fallback actions can use foreground input. **KEEP; improve delivery contract.** | Explicitly distinguish background, foreground and unsupported delivery; verify focus/cursor invariants. |
| C13 — [screen fallback:1118](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_computer.py:1118) | Unfamiliar native applications; **E/F** | Uses current screenshots, observation IDs, geometry and fresh target-pixel checks. | Runtime coordinates are not canned coordinates. This remains foreground control with incomplete platform policy parity. **KEEP fallback.** | Require current target identity, final admission and truthful refusal; test layout/DPI/window changes. |
| C14 — [protected apps:71](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_protocol.json:71) | Password managers and protected Windows surfaces; **F** | Shared protected-process policy includes 19 executable identities. | Deliberate security exception, not supported-app routing. **KEEP.** | Replace only after generic protection proves equal or stronger coverage. Never delete to make the name count zero. |
| C15 — [command contract:28](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_protocol.json:28), [command policy:845](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_computer.py:845) | Interpreters, build tools, terminals; **F/E** | Names/aliases classify commands as inert, routine or confirmation-required. | Safety classification is different from selecting an app for the user. Executable provenance still matters. **KEEP; strengthen confinement.** | Preserve negative tests; avoid trusting a renamed/replaced executable solely because its basename matches. |
| C16 — [Android discovery:65](C:/Users/haans/Desktop/caera-connect-plan/android/src/in/ocade/app/Control.java:65), 120–132 | Android installed applications; **E** | PackageManager enumerates launcher activities; launch matches a display label. | Generic discovery, but label collisions and 300-name cap remain. Shared ASCII schema also limits names. **GENERALISE identity.** | Carry package/activity identity under existing device authority; test Unicode, duplicate labels and package visibility limits. |
| C17 — [browser labels:39](C:/Users/haans/Desktop/caera-connect-plan/src/lib/browser-install-id.ts:39), [session labels:23](C:/Users/haans/Desktop/caera-connect-plan/src/lib/security/user-agent.ts:23) | Chrome, Edge, Firefox, Safari, Opera, Brave and related browsers; **H/E** | Browser/session identification for customer-facing device context. | Does not select the execution app. **KEEP accurate labels.** | Verify unknown UA handling and privacy minimisation; no routing migration required. |
| C18 — [push hosts:181](C:/Users/haans/Desktop/caera-connect-plan/src/lib/notifications/web-push.ts:181) | Google, Mozilla, Apple push services; **F/E** | Push endpoint validation. | Security/network compatibility boundary. **KEEP.** | Preserve SSRF and endpoint-validation evidence. |
| C19 — [attachment detection:99](C:/Users/haans/Desktop/caera-connect-plan/src/lib/chat/attachments.ts:99) | Office/OpenDocument MIME and extensions; **D/H** | Attachment capability messaging/detection. | Format classification, not native-app routing. **KEEP.** | Keep explanations aligned with actual Chat versus JARVIS capabilities. |
| C20 — [spreadsheet explanations:332](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_sheets.py:332), 347, 404, 434 | Excel; **H** | Error messages say some operations “need Excel”. | Overstates a product requirement where the real requirement is a qualified calculation/object-model capability. **REPLACE wording after qualification.** | Describe the missing capability; do not promise an untested alternative. |
| C21 — [packaging contract:35](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/packaging/ocade-agent.spec:35) | Office scripts, browser and accessibility helpers; **E/H** | Packages the active scripts and hidden-import runtime modules. | These dependencies are active, not dead integrations. **KEEP.** | Any retirement must also update health checks, packaging and installed-agent verification. |

The protected list includes KeePass/KeePassXC, 1Password, Bitwarden, LastPass, Dashlane, Keeper variants, NordPass, RoboForm, Enpass, Proton Pass variants, Authy Desktop, Credential UI Broker, UAC consent, Windows Security, lock and logon surfaces.

### Tests and historical examples

| Evidence | Classification and finding |
|---|---|
| [Office journey:16](C:/Users/haans/Desktop/caera-connect-plan/scripts/e2e/office-journey.mjs:16), 271–276, 493 | **G.** Explicit Office expectations and COM cleanup belong to an Office compatibility fixture. The model is scripted by the fixture; this cannot prove general Gemini planning. |
| [live-test gate:30](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/tests/conftest.py:30) | **G.** Live GUI/Office tests require `OCADE_LIVE_TESTS=1`. Ordinary test execution can skip them. |
| [synthetic desktop fixture:538](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/tests/test_computer.py:538) | **G.** Current generic native-control fixture constructs WinForms controls. I found no active production Calculator route. Historical Calculator work must not be counted as current routing. |
| [discovery test:158](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/tests/test_discovery.py:158) | **G.** Notepad is a compatibility fixture, not production app selection. |
| [native pattern tests:1](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/tests/test_ui_act.py:1), [command tests:308](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/tests/test_computer.py:308) | **G/H.** DaVinci Resolve motivated general parsing/pattern fixes. Its name does not create a Resolve dispatch branch. |
| [browser journeys:29](C:/Users/haans/Desktop/caera-connect-plan/scripts/e2e/browsers-journey.mjs:29) | **G.** Chromium, Firefox, WebKit and device presets test website compatibility. WebKit on Windows is not physical Safari/macOS/iOS evidence. |
| Discovery comments mentioning Excel, Skype or Resolve | **H.** Explanations of discovery behaviour; not executable app-name routing. |
| Removed donor integrations | Historical evidence only. Section 0 and [ToRemove:68](C:/Users/haans/Desktop/caera-connect-plan/ToRemove.md:68) prohibit reimporting them. |

**Search result:** no explicit production product-name dispatcher was located for Photoshop, Illustrator, Premiere Pro, DaVinci Resolve, Blender, Fusion 360, AutoCAD, FreeCAD, VS Code, music players, email or messaging applications. That establishes neither native integration nor successful support for those applications.

**Counts:** zero confirmed forbidden named-app launch routes and zero confirmed canned app-specific GUI workflows in the inspected execution core; **two specialised native object-model executor families remain**. These are bounded findings, not a repository-wide proof that no undiscovered route exists.

---

## D. Specific answers: Sheets, Office and other professional software

### 1. Why does `ocade_sheets.py` exist?

It provides structured spreadsheet work without making the model click or type every cell:

- Operation validation.
- Spreadsheet inspection.
- Formula, fill, formatting, table and chart operations.
- Native automation where available.
- Direct file editing where appropriate.
- Backup and partial-effect reporting.
- Readback and basic spreadsheet-problem detection.

Its actual caller is [Computer._sheet:593](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_computer.py:593). This is an active feature owner.

### 2. Does it restrict JARVIS to Excel-compatible software?

**The spreadsheet editing tool restricts formats to `.xlsx` and `.xlsm`.** Other JARVIS controls remain available for other applications.

Its native branch also requires an Excel-compatible workbook object model. A spreadsheet application supporting the same file format does not necessarily support that API.

### 3. How does COM discovery work?

[automation_server:220](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_sheets.py:220):

1. Reads the extension’s default registry ProgID.
2. Takes the first component of that ProgID.
3. Appends `.Application`.
4. Resolves that COM server’s `LocalServer32`.
5. Compares the server executable with the file type’s open command.
6. Obtains a friendly application name for reporting.

This avoids a literal `Excel.Application` production lookup, but it substitutes a **ProgID naming convention** for interface discovery.

It also does not establish that the effective per-user file association and every required automation method agree.

### 4. Does it assume the discovered application supports Excel’s object model?

**Yes, once that server is selected.**

The PowerShell executor immediately uses workbook-specific properties and methods. It does not first establish a typed, qualified interface containing the required operations.

The document branch makes the analogous Word-compatible assumption.

### 5. What happens with alternative spreadsheet applications?

These are source-derived predictions, not executed compatibility results.

| Application | Current likely behaviour |
|---|---|
| LibreOffice | Its automation interfaces cannot be inferred to support this workbook COM API. If discovery returns no qualifying server, direct OOXML editing may be attempted; unsupported fidelity features cause refusal. |
| OnlyOffice | Same distinction: file compatibility is not automation compatibility. Desktop or browser execution requires separately discovered supported interfaces. |
| WPS Office | It may expose compatible automation in some installations, but this source does not qualify version/operation compatibility. Compatibility remains UNTESTED. |
| Google Sheets | The local Office path does not operate Google Sheets. Existing browser controls could operate its UI under the selected account’s permissions; that workflow is unverified here. |
| Unfamiliar spreadsheet app | No server leads to the limited file path; a server passing the naming/executable heuristic can be handed incompatible workbook operations and fail. |
| App using `.ods`, `.xls` or `.xlsb` | The typed spreadsheet edit tool refuses that format. A different supported API or generic control path would be needed. |

The implementation should **not automatically retry through another mutating mechanism after an ambiguous native failure**. First reconcile whether anything changed.

### 6. What can be generic?

| Capability | Appropriate generic boundary |
|---|---|
| Reading OOXML cells/formulas | Format parser |
| Writing supported cells/styles | Format editor with preservation restrictions |
| Formula recalculation | Qualified application calculation engine |
| Pivot refresh, external links, advanced charts | Qualified application/API operation |
| Macro-bearing or complex workbooks | Explicit preservation and macro-execution policy |
| PDF/text extraction | Format capability |
| Native app menus and fields | Accessibility capability |
| Browser spreadsheet application | DOM/API capability under account authority |

`openpyxl` is not a substitute for the application’s full calculation engine or every advanced workbook feature.

### 7. What would deletion break?

Deleting the Python owner breaks its imports and callers, including spreadsheet inspection/editing and shared backup/Office-job utilities used by document editing.

Deleting the workbook script removes native recalculation and application-owned editing. File editing would not provide full parity.

Deleting the document script removes the current native document editing path; the existing text extractor does not replace it.

**The four files total 996 physical lines and 49,167 working-copy bytes. They are not safe-removal savings.** The two PowerShell scripts alone total 321 lines and 14,986 bytes.

### 8. Could a typed capability interface preserve speed?

Yes. Extend the current discovery and broker owners with a small capability description:

- Discovered app identity and version.
- Interface/protocol identity.
- Supported operations and format constraints.
- Background/foreground delivery.
- Required permissions.
- Verification method.
- Qualification evidence and invalidation generation.

Then select the existing executor by qualified capability, not display name. This does not require another agent framework, plugin registry or customer-installed MCP.

### 9. How should spreadsheet output be verified?

Current readback is valuable but incomplete. For example, [workbook executor:187](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/actions/ocade_workbook.ps1:187) can return `ok = true` with `savedAndReopened = false`.

A complete verification contract should check:

- **Values:** independently recomputed expected totals from authorised inputs.
- **Formulas:** required formulas, references, fill coverage and errors.
- **Calculation:** completion of the selected engine’s calculation, not merely a method call.
- **Charts:** series, source ranges, type and expected presence.
- **Formatting:** targeted semantic/style properties.
- **Integrity:** reopenability, required package parts and preservation of unsupported features.
- **Scope:** originals and unrelated workbook content unchanged.
- **Receipt:** output identity/hash/version, predicates checked and unresolved limitations.

For user-open documents, do not close them merely to manufacture “reopened” evidence. Verify the saved artifact through a safe independent reader.

### 10. How should the route be selected?

Use task requirements and qualified capabilities:

1. Native API for required calculation/fidelity.
2. Direct format editing when its preservation envelope covers the task.
3. Supported browser/API route for browser applications.
4. Accessibility for supported native controls.
5. Fresh vision/foreground input where necessary and permitted.

Prefer the cheapest route that satisfies **both** outcome and safety requirements.

### Other software families

| Family | Current source position | Correct next step |
|---|---|---|
| Word documents | Native compatible object-model editing; generic text extraction | Qualify interface; improve localisation, style/table/layout verification and recovery |
| PowerPoint | PPTX text extraction; no dedicated slide-editing executor located | Discover supported presentation interface; verify slide structure, assets and rendered output |
| PDFs | Text extraction; generic file/control routes | Add only task-required generation/editing with page/render/form verification |
| IDEs/development | Generic files, commands, windows and browser tools | Use project CLI/build/test contracts; strengthen command containment; verify actual outputs |
| CAD/3D | Generic discovery/control; no qualified dedicated executor located | Discover supported scripting/API and verify geometry, units, assets and reopenability |
| Creative/video/audio | Generic paths; metadata and command capabilities do not prove editing fidelity | Verify timeline/layers/assets/export properties through the actual application |
| Unknown software | Generic discovery, UIA and vision entry points | Qualify capabilities; bind safe actions and application-specific outcome predicates dynamically |

---

## E. Universal-control architecture assessment

### Actual call chain

The active route is:

`User request → existing JARVIS agent → online intelligence transport → server-managed Gemini function tools → schema validation → task/permission authority → device action queue → authenticated device exchange → local executor → result/activity settlement → completion gate`

Key owners:

- [agent planning loop:787](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/agent.ts:787)
- [online model transport:41](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/live-deps.ts:41)
- [provider tool construction:324](C:/Users/haans/Desktop/caera-connect-plan/src/lib/intelligence/edge-handler.ts:324)
- [action validation:470](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/agent.ts:470)
- [task admission:319](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/task-authority.server.ts:319)
- [device segmentation:797](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/device.server.ts:797)
- [local execution:507](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_device.py:507)
- [completion authority:127](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/task-authority.server.ts:127)

JARVIS uses online intelligence explicitly. I found no offline-model fallback in this transport. Preserve Chat’s separate Auto/Online/Offline authority.

### Unknown-application chain

| Requirement | Assessment | Evidence/limit |
|---|---|---|
| Discover installed app | **PARTIAL** | OS discovery exists; Unicode, collisions, caps and stale server inventory limit it |
| Determine best app for the task | **PARTIAL / UNVERIFIED** | Model receives discovery data; no demonstrated outcome/fidelity-based selection contract |
| Discover APIs | **PARTIAL** | Registry/SDK heuristics and documentation exist; callable compatibility is not qualified |
| Understand menus/fields | **PARTIAL** | Windows UIA and Android accessibility; sparse/custom controls require fallback |
| Construct typed actions | **IMPLEMENTED IN SOURCE** | Validated action schemas and bounded sequences |
| Control without fixed aliases/coordinates | **PARTIAL** | Generic controls exist; actual unfamiliar-app success untested |
| Multiple apps/windows | **PARTIAL** | Window/browser operations exist; device-wide serialization and foreground paths remain |
| Recover from layout changes | **PARTIAL** | Stale references/geometry trigger fresh observations; no complete recovery guarantee |
| Verify meaningful outcome | **PARTIAL, INSUFFICIENT** | Later-read gate exists; semantic predicates are not mandatory |
| Reuse safely | **PARTIAL** | Typed recipe inputs and failure quarantine exist; recipe body/verifier remain prose |

### Highest-priority source findings

**E01 — Completion does not prove correctness. Confirmed limitation.**

[completionGap:127](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/task-authority.server.ts:127) requires a later successful read and same-path reads after certain file edits. It does not validate expected values, content, fidelity or task predicates.

`file_info` qualifies as a read. Correct metadata can accompany an incorrect report.

The query also limits activity to the first 1,000 rows without an overflow refusal. The check and completed-state update are separate operations at 206–224. **Overflow and concurrent-admission risks require adversarial reproduction; they were not executed here.**

**E02 — Cancelled can be mistaken for “never changed anything”. Confirmed mismatch; race untested.**

[cancelJarvisAction:517](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/jarvis.functions.ts:517) can cancel a **claimed** action. [completionGap:152](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/task-authority.server.ts:152) excludes cancelled rows with no result.

A claimed action may already have caused an effect. Cancellation alone cannot establish otherwise.

Additionally, [late-result settlement:654](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/device.server.ts:654) stores a stopped acknowledgement containing the late status rather than the full late effect detail. Recovery needs those details for reconciliation.

**E03 — Undo can overwrite later user edits. Confirmed implementation behaviour.**

[_put_back:770](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_computer.py:770) copies the backup over the current path without comparing the current file with OCADE’s recorded post-edit version.

Undo closures are memory-only at 748. The backup retention loop also prunes by global recency rather than demonstrated reconciliation requirements.

**E04 — App permission denial is not enforced across all ways to touch that app. Confirmed scope limitation.**

[permissions:167](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/permissions.ts:167) checks app-specific Never permission for `open_app`. Native document operations, scripts and generic UI paths need resource/app identity enforcement too.

Running segments are checked for claimed action and running task at [device.server:694](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/device.server.ts:694), but that path does not re-evaluate every granular grant.

**E05 — Windows/macOS script execution is not a hard workspace sandbox. Confirmed limitation.**

[_direct:879](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_computer.py:879) explicitly states that nothing confines the program. Argument-path filtering cannot constrain file/network accesses performed inside an interpreter script.

The discovery README content is also absent from the server’s enumerated untrusted-read list: compare [discovery:171](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_discovery.py:171) with [READS_THE_WEB:42](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/task-authority.server.ts:42).

This is an architectural trust/containment gap, not an executed exploit claim.

**E06 — STOP checks are useful but not fully coupled to every final effect. Source-observed race window.**

The device admission lock prevents losing STOP while publishing a new segment token. Individual OS/COM/UI effects still occur after separate cancellation checks.

For Office, [office_job:276](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_sheets.py:276) starts PowerShell and subsequently monitors cancellation. Killing that child cannot undo an already committed Office effect.

Local STOP, remote acknowledgement and executor quiescence must remain distinct.

**E07 — Durable intent is incomplete. Confirmed limitation.**

[segment intent:485](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_device.py:485) persists action IDs. It does not itself record the full request digest/resource/postcondition contract.

The Python journal uses replacement-based writes without explicit file/directory durability barriers in the inspected helper. Atomic replacement alone is not power-loss durability.

**E08 — Recipe learning is useful but insufficiently qualified. Confirmed limitation.**

[save_recipe:400](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_discovery.py:400) supports typed input names, sanitisation and quarantine after two failures. However:

- Actions and verification remain strings.
- One app-major key can replace another task recipe.
- Unknown-version `"any"` recipes can remain eligible.
- Regex sanitisation cannot prove absence of all private data.
- Recipe admission inherits the weak completion gate.

### What is simulated?

The Office journey scripts model decisions through a fixture. That can prove transport/device/file integration when run, but not autonomous Gemini understanding of a new task.

Synthetic controls prove specific accessibility behaviours when executed. They do not prove unfamiliar professional software support.

No new runtime, hosted-provider or physical-device proof was produced in this audit.

---

## F. Gemini, Playwright and native-control architecture

**OCADE needs stronger capability selection within its existing broker, not a second broker framework.**

A minimal flow is:

```text
Goal + expected output + authorised scope
                  ↓
Fresh discovered identities and qualified capabilities
                  ↓
Gemini selects a bounded typed plan
                  ↓
Existing task/permission authority admits it
                  ↓
Local deterministic segment executes
                  ↓
Independent predicates check actual outputs
                  ↓
Durable receipt → completion or reconciliation
```

Selection should consider required fidelity, supported operations, permission scope, delivery mode, expected cost and available verification.

### Tool boundaries

| Mechanism | Appropriate use |
|---|---|
| Native API/object model | Supported application operations requiring speed or fidelity |
| CLI/scripting | Documented supported interface with bounded authority and verified output |
| File-format editing | Tasks inside the parser/editor’s preservation envelope |
| Playwright/CDP/DOM | Browser pages and browser-based applications |
| UI Automation/accessibility | Native application controls exposed by the OS |
| Vision/coordinates | Fresh observed GUI fallback where structured control is unavailable |

**Playwright cannot operate arbitrary native desktop windows.** Electron applications may expose browser surfaces, but that must be discovered and consented; browser automation does not automatically cover their native dialogs or host filesystem authority.

### Gemini Computer Use

Current Google documentation describes browser, mobile and desktop environments. It also documents optional prompt-injection detection, rather than making that protection automatic. These are model/tool capabilities, not a complete local executor or permission system. [Google Computer Use documentation](https://ai.google.dev/gemini-api/docs/computer-use.md)

Current OCADE constructs ordinary function declarations in its provider request. I found no active `computer_use` provider configuration in that path.

A future evaluation should:

- Confirm compatibility with the selected server-managed model.
- Translate suggestions into existing typed actions.
- Keep final authority, STOP and verification outside the model.
- Explicitly enable applicable safety settings.
- Compare outcomes and cost before changing the default.

Do not automatically replace fast native operations with screenshot-driven model calls.

---

## G. Performance and latency audit

### Existing speed advantages

OCADE already has:

- Structured workbook/document jobs.
- Bounded local sequences of up to 12 actions.
- Capability caching.
- Structured DOM and accessibility observations.
- Event-assisted planner waits.
- Local STOP checks independent of model inference.

Therefore “Gemini is called for every cell or click” is not universally true. Some workflows can already batch deterministic work.

### Evidence-backed costs and hypotheses

| Source | Observed mechanism | Performance implication |
|---|---|---|
| [agent:787](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/agent.ts:787), [live-deps:42](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/live-deps.ts:42) | Model loop permits up to 30 iterations; each model request performs billing admission/settlement | Planning/broker overhead grows with model turns; actual cost unmeasured |
| [agent sequence:579](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/agent.ts:579) | Local segment support exists | Reuse it; expand only where dependencies and safety permit |
| [device:460](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_device.py:460) | One-second busy wait; five-second dormant wait | Wake latency can dominate a millisecond local operation |
| [agent wait:427](C:/Users/haans/Desktop/caera-connect-plan/src/jarvis/agent.ts:427) | Event wait with two-second fallback; 400 ms polling fallback | Already partly event-driven; measure lost-event and read-query cost |
| [device frame:520](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_device.py:520) | Browser actions can trigger a frame even without an observation frame | Potential unnecessary capture/encoding/upload |
| [screen:1200](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_computer.py:1200) | 300 ms delay after GUI input, then observation | Adds explicit latency to simple actions |
| [window:1048](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_computer.py:1048) | 400 ms focus wait and another 300 ms wait | Window switching can add roughly 700 ms of explicit waits |
| [browser scroll:445](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/actions/browser_control.py:445) | Fixed 300 ms wait | Prefer a relevant settled-state condition where available |
| [discovery README:171](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_discovery.py:171) | Reads entire README before slicing returned text | Returned size is bounded; file I/O is not bounded by that slice |
| [COM scan:69](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_discovery.py:69) | Registry scan cached by executable basename | Warm speed benefit; installation/version invalidation is incomplete |
| [installed apps:196](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_computer.py:196) | Discovery subprocess timeout up to 30 seconds | Cold/refresh discovery can be expensive |
| [Office job:276](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_sheets.py:276) | PowerShell process per Office job | Startup overhead; batching operations within the existing job helps |
| [workbook:134](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/actions/ocade_workbook.ps1:134), [browser:431](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/actions/browser_control.py:431) | Some operations activate/select or bring tabs forward | Background guarantees do not hold universally |
| [device:443](C:/Users/haans/Desktop/caera-connect-plan/jarvis-runtime/ocade_device.py:443) | One active segment owns the device | Safe conservative ownership; independent-resource parallelism is not established |

These are costs visible in code, **not measured percentages of end-to-end latency**.

Do not remove waits indiscriminately. Replace them with a specific readiness condition and a bounded fallback, then prove correctness.

### Measurement boundaries

Instrument the existing owners with correlated task/action IDs:

| Layer | Start/end measurement |
|---|---|
| AI planning | Model request admission → complete usable typed plan |
| Server/broker | Action admission → durable queue/claim |
| Delivery | Queue/claim → device receives/admission |
| Local dispatch | Final local admission → OS/API handoff |
| Application execution | Handoff → app-owned state reaches required condition |
| Verification | Verification begins → predicates checked and receipt persisted |
| End-to-end | User submission → verified completion |

Use monotonic clocks for same-process spans. Do not subtract unsynchronised server/device wall clocks as precise latency.

The existing [Testing budgets:191](C:/Users/haans/Desktop/caera-connect-plan/docs/TESTING.md:191) propose p95 admission 10 ms, cached discovery 5 ms, handoff 20 ms and local STOP 50 ms. These remain **targets**.

Measure warm/cold states, payload sizes, app versions, failure rates, p50/p95/p99 where sample counts support them, model calls and cost per **correctly completed** task.

Millisecond dispatch is plausible for a simple pre-authorised local action. It is not a credible universal target for reasoning, networking, app startup, recalculation, rendering or entire workflows.

---

## H. Competitor comparison

Research date: **11 October 2026**.

All capabilities below are **officially documented or vendor-described**. I did not independently execute competitors. Marketing demonstrations, persistent sessions and tool acknowledgements are not equivalent to verified correctness or crash-safe recovery.

Exact current subscription prices were not established consistently; I report verified value models where available and otherwise mark pricing unknown.

### Execution, capability and product positioning

| Product / developer | Environments and architecture | Browser/native/background capability | Persistence, permissions and verification | UX/value and OCADE comparison |
|---|---|---|---|---|
| **Hermes Agent — Nous Research** | macOS, Windows, Linux; tool-capable models; bundled Cua Driver integration | Documents background native control and separate browser tools; display/session limitations apply | Manual/smart approvals or reviewed bounded manifests; structured diagnostics. Universal business-output verification not established | Desktop/gateway onboarding and reusable state. OCADE must prove comparable background delivery and simpler supported installation. [Official computer-use docs](https://hermes-agent.nousresearch.com/docs/user-guide/features/computer-use) |
| **Manus — Manus AI** | Persistent cloud computer plus local desktop modes; current Studio downloads for Windows and Apple Silicon macOS | Local files/tools, browser workflows, phone-to-desktop interaction; own-workspace Computer Use is vendor-described | Local command/folder approval controls documented; cross-device continuation. Exact crash/effect reconciliation unknown | Broad deliverables and polished cross-device UX. Local execution is no longer an OCADE-exclusive advantage. [Desktop](https://manus.im/desktop), [My Computer](https://help.manus.im/en/articles/14178443-what-is-the-my-computer-feature-capable-of), [cloud computer](https://www.manus.im/features/cloud-computer) |
| **OpenClaw** | Gateway/paired-node desktop; macOS default provider and optional CUA; Windows/Linux CUA plugin documented as experimental | Typed target/observation/delivery descriptors; background window routes with explicit limitations; browser routes vary | Pairing, scopes, provider generations, stale-reference refusal and takeover semantics; documentation explicitly separates acknowledged input from visible outcome | Configurable local/cloud platform. OCADE should match target identity/refusal quality without requiring customers to configure extensions/MCP. [Computer use](https://docs.openclaw.ai/nodes/computer-use), [Chrome profile route](https://docs.openclaw.ai/tools/chrome-extension) |
| **Grok Bot — xAI** | Persistent account-owned cloud computer; separate screens per Bot; local Mac/Windows commands separately enabled | Cloud browser/desktop work continues while laptop/app closes. Local commands do not establish unrestricted local native GUI support | Shared files/browser sessions; human takeover for sensitive steps; recovery/reset with possible recent-change loss | Persistent personal-agent experience. OCADE’s potential edge is work in the actual local application with stronger scoped receipts. [Computer and apps](https://docs.x.ai/grok-bot/computer-and-apps) |
| **ChatGPT / ChatGPT Work — OpenAI** | Chat/tools and local/cloud Work environments; local desktop computer use on macOS and Windows in supported regions | macOS background experience; Windows foreground desktop. Signed-in Chrome and built-in/cloud browsers have different authority | App/file/tool permissions, review and takeover; cloud Work does not automatically inherit local files/logins | Integrated consumer/knowledge-work UX and remote steering. OCADE must outperform on outcomes, not claim unique local access. [Computer use](https://learn.chatgpt.com/use-cases/use-your-computer-with-codex), [environment modes](https://learn.chatgpt.com/docs/environments/modes) |
| **Codex — OpenAI** | Local checkout/worktree and cloud coding environments; computer use available in desktop product | Coding, shell/files, browser and desktop workflows; same platform-specific foreground/background distinction | Persistent chats/workspaces and approval/sandbox boundaries; tests can verify coding results, not automatically every desktop task | Strong repository workflow and review UX. OCADE needs project-native verification and safe professional cross-app execution. [Environment modes](https://learn.chatgpt.com/docs/environments/modes), [local security](https://learn.chatgpt.com/docs/enterprise/chatgpt-work-local-security) |
| **Claude / Cowork / Claude Code — Anthropic** | Chat, cloud Cowork sessions with connected desktop access, and coding agent. Native computer use documented on Windows/macOS; Linux product availability is not equivalent to native CU support | Connector → browser → screen hierarchy; macOS 15+ background windows; Windows CU available | Per-app approval/blocking; direct computer use explicitly has no sandbox between agent and apps. Cloud tasks persist; local access needs desktop online | Mature knowledge-work and coding UX; paid-plan availability documented. OCADE must match method selection and app authority, then prove better receipts/fidelity. [Cowork](https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork), [computer use](https://support.claude.com/en/articles/14128542-let-claude-use-your-computer-in-cowork) |
| **Muse / Meta AI — Meta** | Muse personal agent with persistent isolated Linux VM/browser; Meta AI ecosystem is a separate distribution surface | Cloud browser/task work documented. Customer-local arbitrary Windows/macOS app control not established by reviewed material | Goals, plans, persistent workspace and user intervention described; detailed local permission/recovery contracts unknown | Consumer onboarding, proactive goals and distribution are major strengths. OCADE should focus on local professional outcomes rather than matching ecosystem breadth. [Muse](https://ai.meta.com/muse), [current releases](https://ai.meta.com/events/), [Meta AI](https://ai.meta.com/meta-ai/assistant/) |
| **Gemini / Gemini Computer Use — Google** | Model/tool layer; current documentation supports browser/mobile/desktop environments | Generates actions for caller-controlled execution; native APIs and background delivery remain executor responsibilities | Safety configuration and optional injection detection; caller must enforce authority, state and verification | Infrastructure source for OCADE, not a turnkey equivalent product. OCADE’s orchestration must add durable local authority and outcome proof. [Official documentation](https://ai.google.dev/gemini-api/docs/computer-use.md) |
| **Microsoft Copilot / Copilot Studio** | Configured Windows machines through Power Platform; model selection and machine connections | Desktop/web GUI automation without application APIs; configured machine/session determines delivery | Credential policies, supervision and enterprise controls; maker credentials can confer maker access. Universal semantic verification not established | Strong enterprise administration/integration; requires configured agent/machine workflow. OCADE could compete on minimal consumer setup and unknown-app discovery. [Computer use](https://learn.microsoft.com/en-us/microsoft-copilot-studio/computer-use) |
| **Perplexity Comet** | AI browser and assistant; browser context is central | Multi-site browser work and background assistants documented. General native CAD/Office control not established | Pause/user control and enterprise/browser security surfaces; crash-safe external-effect reconciliation unknown | Browser is documented as free to download; assistant entitlements differ. OCADE’s potential edge is local native output fidelity beyond browsing. [Official changelog](https://www.perplexity.ai/changelog/what-we-shipped-october-3rd), [enterprise browser](https://enterprise-prod.perplexity.ai/enterprise/comet) |
| **Genspark Super Agent / Claw / GenTeam** | Super Agent cloud deliverables; Claw cloud or local Windows/macOS; GenTeam also describes own-computer/OpenClaw routes | Browser, files, services and scheduled work. These distinct products should not be collapsed into universal native GUI support | Claw memory/schedules; local workspace is explicitly soft guidance, not a hard boundary | Local Claw uses account credits without a separate cloud-computer subscription; cloud computer has its own plan. OCADE can differentiate through enforceable scope and conflict-safe recovery. [Claw](https://www.genspark.ai/helpcenter/genspark-claw), [GenTeam](https://www.genspark.ai/genteam/), [Super Agent](https://www.genspark.ai/alternative/claude-cowork) |
| **Devin — Cognition** | Cloud brain and isolated Devbox with shell/browser/editor; enterprise deployment options | Coding and web interaction; not evidence of general control of the customer’s installed native applications | Enterprise isolation/access controls and development environment persistence; task tests support code verification | Developer-focused setup and output. OCADE must prove actual project build/test/export outcomes; native local scope is a potential difference. [Architecture](https://docs.devin.ai/enterprise/deployment/overview), [environment setup](https://docs.devin.ai/onboard-devin/repo-setup) |
| **Browser Use** | Open-source local browser library plus hosted agents/cloud browsers | Browser automation via agent or Playwright/Puppeteer/CDP; no general native desktop capability in this product scope | Run/session APIs; caller-controlled lifecycle. Independent task predicates and external-effect reconciliation remain separate concerns | Developer-oriented infrastructure/service. OCADE should reuse its own browser owner unless a measured unmet requirement justifies a dependency. [Quickstart](https://docs.browser-use.com/cloud/quickstart) |
| **Open Interpreter** | Current desktop app plus separate provider-agnostic terminal agent; Windows/macOS installation documented | Desktop clicks/typing/menus, browser and workspace documents described | Review before submissions/sends/deletes/overwrites; workspace and provider configuration. Strong crash/background guarantees unknown | BYO provider/local-model options and skills/integrations. OCADE could win on managed setup and proven task contracts, not generic “runs code locally”. [Desktop](https://www.openinterpreter.com/docs/desktop), [installation](https://www.openinterpreter.com/docs/desktop/install), [terminal](https://www.openinterpreter.com/docs/terminal/quickstart) |
| **Cua Driver / Cua SDK** | Infrastructure for macOS, Windows and Linux; native driver and separate local/remote sandbox SDK | Window-targeted accessibility/background input; foreground escalation/refusal where required | Explicit target/delivery contracts, structured refusals and app-owned-state harness evidence described | Not a complete competing assistant. Useful reference for delivery semantics; adoption requires licence, packaging, safety and performance review. [Driver architecture](https://cua.ai/docs/cua-driver/concepts/how-cua-driver-works), [platform limits](https://cua.ai/docs/cua-driver/concepts/platform-support) |

### What the research establishes

- Hermes and OpenClaw make background targeting, capability descriptors and structured refusals important comparison points.
- Manus, Grok Bot, Cowork, Muse and Claw make persistence and cross-device continuity established product expectations.
- OpenAI and Anthropic document local desktop control; calling them cloud-only would be incorrect.
- Current Gemini Computer Use is broader than an older browser-only description.
- Browser Use and Comet are primarily browser competitors; Devin and Codex have strong coding-specific capabilities.
- A desktop app’s existence does not prove all native-control routes on every OS.

Hermes publishes local dispatch latency claims, but I did not find a comparable measured OCADE run. Vendor timings, edited demonstrations and benchmark leaderboard scores cannot establish a winner on your workflow.

**No competitor in this report has been independently tested by me. No fair OCADE-versus-competitor winner is established.**

---

## I. Strategy to outperform competitors

### Defensible gap-to-change map

| Competitor advantage | OCADE weakness / root cause | Required change and existing owner | Retirement opportunity | Evidence needed to claim superiority |
|---|---|---|---|---|
| Hermes/OpenClaw/Cua background targets | UIA fallback, screen input, Office selection and tab activation can use foreground | Target/delivery contract in `ocade_accessibility`, browser owner and native adapters | Foreground fallback only where background parity is proven | Frontmost app, cursor and user typing remain unchanged while target output changes correctly |
| Manus/Grok/Cowork/Muse persistence | IDs/status do not fully describe unknown effects or safe restart | P03 journal plus P01 reconciliation in existing device/task owners | Memory-only recovery assumptions | Crash/disconnect after each mutation boundary; no lost effect or duplicate submission |
| OpenAI/Claude consumer handoff | Discovery names, setup and permission states can be confusing | P10 identity/freshness; P11/P15 guided setup and truthful states | Duplicate lifecycle only after caller/behaviour proof | Time to first correct task, permission comprehension, intervention count |
| Comet/Browser Use browser efficiency | Potential extra captures, reads and cloud turns | P08/P09/P16 using existing DOM/session/action owners | Redundant captures/polls after measured replacement | Same tasks, correctness and accounts; lower time/cost without safety regression |
| Devin/Codex/Claude Code verification | Generic run/read lacks mandatory project outcome contract | P01/P17 use actual build/test/artifact checks | Source-string assertions where stronger unique proof replaces them | Correct patch, expected tests, no unrelated edits, reproducible output |
| Microsoft enterprise controls | App/resource grants not checked consistently at all effects | P02/P05/P11 bind actual resources and grant revision | Coarse authority only after semantic parity | Deny/revoke/takeover adversarial tests across every execution route |
| Genspark broad deliverables | Native professional coverage lacks qualified interfaces and fidelity evidence | P04/P17/P18 retain specialised executors and add proven capabilities | Only replaced, measured adapters | Reopenable correct files with preserved charts/styles/assets and fewer interventions |

OCADE’s existing advantages are **source-level assets**: local executor ownership, native Office paths, original-copy protection, structured actions and explicit STOP/recovery intent. They are not yet comparative wins.

### Fair benchmark proposal

Freeze candidate SHA, competitor version/plan, models, tools, hardware, applications, account state and task inputs. Keep results separate by local, cloud and physical-device environment.

| Track | Tasks | Independent outcome checks |
|---|---|---|
| Unfamiliar software | Apps selected after candidate freeze, including Unicode labels and custom controls | Required app-owned state and saved artifact |
| Reporting | Spreadsheet → document → PDF; changed inputs each repeat | Recomputed totals, formulas, styles, charts, pages and original preservation |
| Browser | Multi-site research, forms, downloads, authenticated account boundaries | Correct records/files; wrong-account and injection attempts refused |
| Coding | Existing project change, build/test and browser validation | Reproducible patch/output and no unrelated edits |
| Creative/CAD | Layer/timeline/geometry change and export | Units, assets, duration/dimensions, reopenability and targeted visual checks |
| Interrupted work | Network loss, provider outage and process crash | Reconciled effects, durable receipt, no blind replay |
| Cross-device | Phone request to paired PC and takeover | Correct device/account, fresh authority and truthful connection state |
| Co-work | User types in another app while work proceeds | No focus/cursor theft; correct target effect or explicit refusal |

Report success rate, false completion, output correctness, p50/p95/p99 latency, model calls/tokens/cost, interventions, recovery success, fidelity loss, safety violations and setup effort.

Use held-out tasks and multiple runs. Count timeouts, refusals and failures; do not rank only successful demonstrations. Separate general-agent and specialised-workflow tracks.

Existing executable benchmarks can provide additional coverage, but freeze their exact release and evaluator. Current OSWorld versions differ; scores across releases are not interchangeable. WindowsWorld provides professional cross-application context, not OCADE readiness evidence. [OSWorld releases](https://github.com/xlang-ai/OSWorld-V2), [WindowsWorld paper](https://arxiv.org/abs/2604.27776)

**Strongest differentiator:** independently verified recurring professional work in the customer’s actual local software, with safe interruption and preservation. Start by proving that, then expand unfamiliar-software coverage.

---

## J. Debloat and removal manifest

| Disposition | Files/functions | Callers/dependencies and loss if removed | Replacement/deletion gate |
|---|---|---|---|
| **KEEP** | `ocade_sheets.py`, workbook script | `_sheet`; document owner reuses backup/job helpers. Loss: structured spreadsheet work and native calculation | Qualified capability selection and equivalent fidelity before any retirement |
| **KEEP** | `ocade_documents.py`, document script | `_doc`, extraction/comparison paths. Loss: document extraction/editing | Format/API and rendering parity |
| **KEEP** | Browser controller/page observer | Device browser dispatch; existing and managed session paths | Preserve both modes, navigation, stale refs and sensitive boundaries |
| **KEEP** | Accessibility and screen fallback | Generic unfamiliar-app control | Never remove accessibility or fresh vision merely to reduce LOC |
| **KEEP** | Protected-app rules, signing, journals, backups, notices | Security, installation and recovery authority | Equal or stronger replacement proof |
| **GENERALISE** | `installed_apps`, `_app_named`, server `open_app`, Android discovery | Identity currently label-based | Unicode/opaque IDs, collisions, freshness, version changes |
| **GENERALISE** | `automation_server`, `app_info`, `_com_servers` | API selection/discovery | Interface qualification and correct invalidation |
| **REPLACE** | Weak completion-read predicate | Both terminal task paths and recipe admission | Mandatory expected predicates, unresolved-effect handling and atomic settlement |
| **REPLACE** | Unconditional `_put_back` restoration | Sheet, document and file undo closures | Post-edit conflict check; preserve later edits; durable recovery identity |
| **REPLACE** | Blind timing waits where unnecessary | GUI/window/browser actions | Specific readiness condition, measured correctness and bounded fallback |
| **REPLACE** | Prose-only verification in recipes | Model reuse of discovered workflows | Typed predicate references and versioned qualification |
| **CONDITIONAL REMOVE** | [generated training cache](C:/Users/haans/Desktop/caera-connect-plan/scripts/wake/__pycache__/make_data.cpython-312.pyc) | Source training entrypoints remain; no explicit runtime/package caller found in targeted trace | Confirm provenance and package exclusion; source training and bundled wake artifact unchanged |
| **NOT PROVEN REMOVE** | Other registries/helpers/dependencies | No new unused application integration or duplicate executor proved | Full caller/package trace and replacement evidence required |

### Defensible savings

- Generated cache candidate: **11,020 bytes**, zero source LOC. Already recorded at [ToRemove:50](C:/Users/haans/Desktop/caera-connect-plan/ToRemove.md:50).
- Accepted runtime deletion savings: **0 LOC / 0 bytes established here**.
- Office scripts: **321 lines / 14,986 bytes active**, not removable savings.
- Four Office-related files: **996 lines / 49,167 bytes active**, not removable savings.
- Unnecessary duplicate implementations: **none newly proved**.

For the cache candidate, rollback is restoration of Git blob `a67431da7ca70c67520fad9bf42ba6f329f39630`. Verify the source training entrypoint and signed shipped wake artifacts remain unchanged.

Do not remove `openpyxl`, `pypdf`, Playwright or UI Automation: inspected active callers use them. The dependency declarations and packaging manifest support their current role.

There is no benefit in extracting another shared abstraction solely because document code imports a backup/job helper from the spreadsheet owner. Change ownership only if it reduces a demonstrated coupling problem.

---

## K. PLAN.md gap analysis

**PLAN already specifies the central goal.** Section 0 explicitly rejects named application routing, requires discovered capabilities and preserves justified safety/native exceptions. No replacement master plan is needed.

Some historical package work records lag current source. For example, typed recipe inputs and segment intent now exist even where older records describe them as missing. Current code still needs acceptance proof.

| Package / authority | Current audit assessment | Remaining requirement |
|---|---|---|
| [P00:349](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:349) | Baseline and provenance records exist; current supply-chain gate not run | Exact candidate dependency/licence/package evidence |
| [P01:380](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:380) | **PARTIAL:** shared completion owner exists | Semantic predicates, unknown-effect reconciliation, overflow/concurrency safety |
| [P02:413](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:413) | **PARTIAL:** local cancellation and stale checks | Final effect admission, grant changes, takeover and quiescence proof |
| [P03:448](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:448) | **PARTIAL:** intent/results and rotation paths | Full durable effect identity, late-result preservation and crash reconciliation |
| [P04:480](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:480) | **PARTIAL:** native/file paths, originals and partial-effect metadata | Interface qualification, conflict-safe rollback and full fidelity verification |
| [P05:511](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:511) | Domain changes recorded; not independently accepted here | Account/staff/transfer gates and consistent effect scope |
| [P06:539](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:539) | Export/erasure work recorded; outside detailed universal-core reread | Complete bounded reconciliation evidence |
| [P07:568](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:568) | Separate local model/OPFS authority preserved in architecture | Cold offline proof; never use Chat Offline as JARVIS fallback |
| [P08:598](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:598) | **IMPLEMENTED IN SOURCE, PARTIAL CONTRACT:** `segment_v1`, ≤12 actions | Typed output dependencies, per-effect authority and measured parity |
| [P09:627](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:627) | **PARTIAL:** event-assisted planner waits; device polling remains | Measure delivery first; add wake improvement through existing owner if justified |
| [P10:652](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:652) | **PARTIAL:** discovery, caches, typed inputs, quarantine | Stable identity, qualified APIs, cache invalidation and typed verification |
| [P11:682](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:682) | **PARTIAL:** companion/browser/package owners exist | Installed lifecycle, consented browser-family coverage and final campaign |
| [P12:710](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:710) | Voice improvements recorded; live voice not tested | Barge-in, wake/provider failure and language acceptance |
| [P13:742](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:742) | Android generic controls and journal code present | Real permission/input/rotation/restart proof; no desktop-equivalence claim |
| [P14:769](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:769) | Native Apple acceptance unresolved | Physical Apple evidence and supported native control; WebKit cannot substitute |
| [P15:793](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:793) | UX/state improvements present in records/source | Truthful receipts, setup, STOP/pause/unknown states and usability evidence |
| [P16:823](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:823) | Online-only tool planning and bounded loop exist | Qualified tool choice, trusted boundaries, model-call/token measurements |
| [P17:851](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:851) | Generic professional entry points; dedicated fidelity coverage limited | Supported APIs plus actual Office/CAD/creative/project outcomes |
| [P18:880](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:880) | Flagship requirements documented; fixture journeys insufficient | Real provider, changed-input repeats, independent multi-app checks |
| [P19:908](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:908) | Acceptance framework exists; no campaign executed here | Candidate freeze; meaningful tests, real workflows, adversarial and hardware gates |
| [P20:941](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:941) | **DEFERRED** | Preserve owner’s non-payment acceptance prerequisite |
| [P21:970](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:970) | **DEFERRED** | Production approval, exact candidate and rollback gates |
| [P22:1004](C:/Users/haans/Desktop/caera-connect-plan/PLAN.md:1004) | Donor retirement recorded; further deletion proof limited | Remove only after measured replacement/parity |

The clearest active contradictions are weak outcome verification, cancelled/unknown effect conflation, rollback over later edits, incomplete resource authority, and unqualified automation selection.

---

## L. Prioritised engineering roadmap for Claude

This is a future sequence within existing PLAN packages. It authorises no implementation during this audit.

| Order | Files/functions | Smallest correct change | Acceptance criteria |
|---|---|---|---|
| **1 — P04/P03** | `ocade_computer._remember/_put_back/_unfinished`; spreadsheet backup owner | Record OCADE’s post-edit identity and refuse destructive undo if current content differs. Preserve conflict copies and originals. | Normal undo works; later user edits survive; renamed/deleted paths fail safely; partial-save case stays truthful |
| **2 — P01/P03** | `completionGap`, `changeTask`, cancellation and late-result settlement | Separate proven never-started, committed, failed and unknown effects. Preserve full late outcomes. Require reconciliation before completion/retry. | Timeout after committed effect cannot disappear; false/no-op output fails; late receipt retained; no duplicate effect |
| **3 — P01** | Existing protocol/task authority and settlement | Add task-required output predicates; make completion consume durable verified evidence atomically with admission ownership. | Wrong totals/content/chart fails despite a successful read; >1,000 activities fail safely; concurrent enqueue/finish race covered |
| **4 — P02/P05/P11** | `permissions`, device admission, local executor boundaries | Bind actual resource/app identity and current authority to every effect; enforce grant revocation and STOP at final supported boundary. | Denied app cannot be reached through UI/script/native route; takeover invalidates pending input; quiescence reported accurately |
| **5 — P02/P11/P16** | `_run/_direct`, discovery README handling, trust tracking | Close untrusted-script admission gaps; use enforceable confinement for unattended arbitrary code, or explicit reviewed authority for unconstrained execution. | Poisoned SDK/file/page cannot grant authority; no out-of-scope access; executable replacement tested |
| **6 — P10** | `installed_apps`, schema, `_app_named`, server inventory, Android launch | Stable opaque IDs, Unicode labels, collision/completeness and discovery generations | Unknown Unicode app installed after pairing can be discovered and safely selected; stale identity refuses |
| **7 — P04/P10/P17** | `automation_server`, `app_info`, native scripts | Qualify workbook/document interfaces and operation capabilities before mutation | Incompatible COM server refused without change; Excel fidelity preserved; alternatives honestly qualified or unsupported |
| **8 — P08/P10/P16** | Existing sequence and recipe owners | Typed local dependencies/predicates; recipes reference qualified capability versions and safe inputs | Deterministic repeated work uses fewer model turns; changed version/input triggers appropriate qualification |
| **9 — P09/P15/P16** | Exchange/wait/frame/discovery owners | Instrument first; then eliminate measured redundant captures, waits and wake delays | Lower latency/cost with equal output correctness, STOP and reconnect behaviour |
| **10 — P11/P13/P14/P17** | Accessibility/browser/platform delivery owners | Explicit background/foreground/refusal contract; expand only measured platform gaps | User co-work invariant; real Windows/Android/Apple evidence as applicable |
| **11 — P18/P19** | Existing real workflow and acceptance harnesses | Real Gemini tasks, changed-input recurring reports and held-out unfamiliar apps | Independently correct artifacts, interruption recovery, account/device isolation and fair comparisons |
| **12 — P22** | Existing ToRemove candidates | Retire replaced code and generated cache only after proof | Caller/package parity, rollback evidence and measured savings |

**Safest first implementation change:** the rollback conflict guard. It is narrow, removes a concrete data-loss behaviour, reuses the existing owner and can be verified without adding a framework.

The next urgent change is preservation/reconciliation of cancelled and late effects. Faster execution should follow reliable authority and completion, because accelerating an unsafe or falsely completed workflow worsens the product.

---

## M. Final scoreboard

| Metric | Result |
|---|---|
| Current tracked inventory | **935 paths** |
| Runtime/application logic inventory | **219 files / 53,852 physical lines** |
| Conservative fresh detailed runtime reading | **17 files / at least 4,037 lines** |
| Historical unchanged paths eligible for reuse | **810** |
| Specialised native executor families | **2:** workbook and document object models |
| Physical Office-related files | **4**, containing both specialised and generic helpers |
| Confirmed forbidden product-name launch routes | **0 located in inspected core** |
| Confirmed canned application GUI workflows | **0 located in inspected core** |
| Implicit application-interface assumptions | **2 families**, sharing one discovery heuristic |
| Protected executable identities | **19**, intentional safety exceptions |
| Unnecessary duplicate implementations proved | **0** |
| Conditional removal candidates | **1 generated cache**, 11,020 bytes |
| Accepted runtime code savings | **0 established** |
| Unknown-software capability | **PARTIAL; meaningful safe completion UNVERIFIED** |
| Competitive superiority | **UNVERIFIED** |
| Runtime/benchmark tests run during audit | **0, as instructed** |

### Completion percentage

An official universal-control PLAN acceptance percentage is **not defensibly computable** from the current records: package work records are not a frozen, current-candidate acceptance ledger.

For a transparent advisory **source-maturity score**, use 11 equally weighted requirements:

- Installed discovery: 0.5
- Qualified capability selection: 0.5
- Typed bounded execution: 1
- Generic execution coverage: 0.5
- Effect authority: 0.5
- STOP/takeover: 0.5
- Durable recovery: 0.5
- Independent semantic verification: 0.5
- Background/co-work: 0.5
- Safe reuse: 0.5
- Measured competitive performance: 0

**Score: 5.5/11 = 50%.** This means partial mechanisms exist; it is **not “PLAN is 50% completed,” release readiness, or a measured success rate**. No runtime acceptance gate was newly verified here because execution was prohibited.

### Top five obstacles to speed

1. Model/network/billing turns around work that could execute deterministically.
2. Device wake/polling delay.
3. Repeated screenshots and observations.
4. Fixed waits, foreground switching and process startup.
5. No measured latency attribution or safe independent-resource parallelism.

### Top five obstacles to unfamiliar software

1. Label-based discovery with Unicode, collision and freshness limitations.
2. API discovery without interface qualification.
3. Missing task-specific outcome predicates.
4. Incomplete authority/containment across execution routes.
5. Recovery and background guarantees weaker than the universal promise.

### Three strongest potential advantages

1. Native professional fidelity in the customer’s actual installed software.
2. Independently checked outputs with safe original preservation and recovery.
3. Minimal website/phone-to-PC workflow using one installed execution owner.

### Required acceptance before declaring victory

- Real unknown applications selected after candidate freeze.
- Unicode/duplicate/stale app discovery.
- Compatible and incompatible Office/API qualification.
- Independently checked calculations, charts, document structure and file integrity.
- STOP before admission, during execution and after committed effects.
- Grant revocation and takeover across native/browser/script/UI routes.
- Crash/restart/lost reply and late-effect reconciliation.
- Undo that preserves later user edits.
- Injection, wrong-account/device, sensitive-surface and out-of-scope attempts.
- Focus-preserving co-work or explicit foreground refusal.
- Real provider and physical-platform workflows.
- Comparable measured competitor tasks, including failures and total cost.

**Answer to your final question:** OCADE can currently attempt unfamiliar-software control through generic discovery and execution paths. It cannot yet establish that it understands arbitrary unfamiliar software, controls it quickly and safely, verifies meaningful work independently, and outperforms competitors.

To reach that goal, preserve the useful native and generic executors, qualify discovered capabilities, enforce authority at effects, reconcile unknown outcomes, make completion predicate-based, make rollback conflict-safe, then measure real held-out workflows. Removing useful Office code or renaming modules would not achieve it.