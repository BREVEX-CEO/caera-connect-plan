# Deferred Gemini / universal-control issues

Owner direction 2026-10-03: the Gemini/OCADE universal-control implementation stays exactly as it is for this release; its open problems are recorded here and not re-coded now. Everything else in the release was finished and tested separately (`docs/FINAL_REPORT.md`).

"Gemini" here means the hidden Online intelligence that plans JARVIS work; customers never see the provider. The Device Agent (broker, validation, STOP, scope, confirmations) is not deferred: its defects found in these runs were fixed (F22–F28 in `docs/FINAL_MATRIX.md`).

## What works today (evidence, preview, 2026-10-03)

- Excel: a real workbook solved into a completed copy with formulas, Excel-calculated values and formats; the original byte-identical (6 steps).
- Dynamic API discovery: `app_info` found DaVinci Resolve's scripting SDK and README on this PC; JARVIS wrote Python against `DaVinciResolveScript`, read its own errors, introspected the objects with `dir()`, created a project, imported the clip, built a timeline and rendered a file — all through the broker, with confirmations shown for anything not routine.
- Busy computer: JARVIS names the task in the way and stops it when the person asks (`stop_task`).
- Calculator and Character Map audit tasks (earlier waves) and the device-question answers.

## Open issues (deferred)

| #   | Issue | Seen | Current mitigation | What a fix needs |
| --- | ----- | ---- | ------------------ | ---------------- |
| G1  | Route choice varies between runs of the same request: DaVinci Resolve went once through its scripting API and twice through the UI. | 3 real runs | Prompt rule "script first when app_info shows automation or a scripting folder" (`2ced6bcc`), not yet re-measured | Repeat runs; possibly make `app_info` return an explicit recommended route |
| G2  | Long UI-driven tasks hit the 30-model-step turn limit (`MAX_MODEL_STEPS`) before finishing. | 2 Resolve runs | The task stops honestly ("Stopped after too many steps") | A cheaper route (G1) or a resumable continuation across turns |
| G3  | Deep in a long task the model sometimes writes a tool call as text (`Called computer {...}`) instead of calling it. Root cause: earlier calls are echoed to it as assistant text, not as native function-call turns. | 1 run | F26: the exact form for a known tool is run through the same validation and never shown | Native tool-call/result turns in the intelligence contract |
| G4  | False completion: JARVIS reported the clip "cut to 5 seconds and exported" when the real export was 12.00 s long and `.mov` instead of the `.mp4` asked for; it had checked only that a file existed. | 1 run (verified with OpenCV and Windows properties) | F28: `file_info` gives a file's own properties (seconds, size, fps, pages) and the prompt requires each part of the request to be checked before "completed" | Re-measure; consider a server-side completion check for file outputs |
| G5  | Stale API knowledge: the model called `SetClipOutFrame`/`SetEnd` (do not exist in Resolve 18.6) and `SetProperty("End", …)`, which reported success but did not trim. | 1 run | It recovered by introspection, but trusted a call that did nothing | Read the app's README/docs (`docs`) before writing API calls; verify effect (G4) |
| G6  | Clicks outside the observed image (y = 930 on a 720-high frame), even with the frame size named in the observation. | 2 runs | F25: refused as outside the screen; the image frame is named | Model-side; coordinates are already validated |
| G7  | Over-caution: asked a second time before stopping the task in the way, after the person had said to stop it. | 1 run | F22b hint | Re-measure |
| G8  | Qt applications (Resolve) expose menus that UI Automation cannot open by Invoke; unnamed fields refuse set_value; the UI route is unreliable there. | 2 runs | F23 fixed the crashes; failures are now explained | Prefer scripting (G1); vision route |
| G9  | The model ran `Resolve.exe -nogui` while Resolve was already open (harmless; one instance). | 2 runs | Shown for confirmation first | Read `window_list` first (already in the prompt) |
| G10 | Real-model evidence not yet collected this wave for: an unfamiliar app task end to end with output verified, the person's own Chrome task, a coding repo bug fix, a multi-app workflow, STOP during a real-model action, the accessibility/vision fallback app. | — | Device Agent paths for each are covered by runtime tests and journeys (stand-in model) | Real runs after G1–G5 |

Matrix rows that depend on these (`docs/FINAL_MATRIX.md`): 5 (task part), 7, 10, 11, 12, 13, 14 — recorded there as DEFERRED (Gemini).
