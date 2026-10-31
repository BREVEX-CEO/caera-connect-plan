# Phase 2: live Gemini browser tasks on staging (31 October 2026)

Every run used `scripts/jarvis-live.mjs` with the production task authority, the deployed
`ocade-intelligence-service` (Gemini), a companion paired on this Linux container and a
visible Chromium window on Xvfb. The harness passes ONLY the person's prompt and grants. It
holds no site, step, selector, file name or workflow. Gemini chose the site, every operation
and every selector. The goal checks came from Gemini and were settled by the separate verifier.

## Setup

- **Grants:** each run granted `files`, `screen`, `browser` and the sites
  `www.photopea.com`, `pixlr.com`, `online-video-cutter.com` and `www.kapwing.com`. This is
  the person's allow-list. Gemini picked among these sites itself.
- **Confirmations (`--confirm-effects`):** every `web.click` and `web.upload` is an external
  effect. The test operator confirmed each one as the person would. Each confirmation is
  listed in `report.json` under `confirmations` as a user intervention.
- **Accounts:** each run used a fresh synthetic staging account
  (`ocade-jarvis-p2-*@example.com`).
  - The Free plan allows 28 planner requests per 8-hour window.
  - The first account ran out of requests (`photo-run1`).
  - No plan or entitlement was changed.
- **Inputs:** synthetic test inputs only.
  - `street.jpg` is an ffmpeg test pattern, 1280x720.
  - `clip.mp4` is 20 s of H.264 at 1280x720 with a 440 Hz mono AAC tone.

## Results

The **Elapsed**, **Model**, **Exec** and **Wait** columns are seconds:

- Elapsed is from acceptance to the end.
- Model is the total Gemini latency.
- Exec is the time the companion spent executing.
- Wait is the time spent waiting for the person.

| Run | Outcome | Steps | Elapsed | Model calls | Model | Exec | Wait | Confirms |
|---|---|---|---|---|---|---|---|---|
| video-run1 | blocked: Gemini's `media_quality` check (stereo, broadcast loudness) cannot pass for a mono source | 26 | 187.1 | 27 | 91.8 | 16.7 | 4.6 | 4 |
| video-run2 | completed and verified, but the final cut was made by local `media.trim` after `web.fill` failed on the editor's time widget | 14 | 112.4 | 15 | 60.1 | 12.5 | 1.7 | 1 |
| video-run3 | blocked: the browser path ran, but the edited time was not committed by the app, so the download was 20 s | 25 | 176.1 | 26 | 82.7 | 20.0 | 3.7 | 4 |
| **video-run4** | **PASS through the browser editor**, verified | 13 | **81.1** | 14 | 35.8 | 10.5 | 1.3 | 2 |
| photo-run1–4 | infrastructure defects (below); allowance used up | — | — | — | — | — | — | — |
| photo-run5 | allowance used up after opening the photo, Brightness/Contrast dialog values set | 27 | 189.0 | 28 | 84.7 | 10.5 | 12.7 | 7 |
| photo-run6 | stalled re-opening the Image menu (stall guard stopped it) | 23 | 172.4 | 24 | 72.3 | 14.1 | 14.3 | 10 |
| photo-run7 | reached Image > Adjustments > Vibrance by visible text and set values, then stalled | 17 | 110.4 | 17 | 45.5 | 11.3 | 10.6 | 9 |
| photo-run8 | hung: a click receipt was over the server's 64 KiB stored-receipt limit; stopped with STOP (`trace.txt`) | 8 | — | 8 | 21.8 | — | — | — |
| photo-run9 | receipt fix confirmed live; stalled on menu navigation | 23 | 176.8 | 24 | 86.5 | 13.2 | 9.5 | 6 |

### video-run4: what Gemini did

1. It chose `online-video-cutter.com` and opened it.
2. It uploaded `clip.mp4`; the person confirmed the upload.
3. It took a screenshot and read the editor.
4. It typed `08` into the end-seconds field.
5. It clicked Save; the person confirmed the click.
6. It downloaded the result to `OCADE output/clip.mp4`.
7. It called `finish`, and the verifier checked `media_duration`.

Independent cross-check of the output:

- **Duration:** 8.1 s, because the editor snaps to a frame; this is within the verifier's tolerance.
- **Format:** H.264 1280x720 with AAC.
- **Content:** the frame at 7.5 s matches the source frame (mean difference 0.65/255).
- **Original:** `clip.mp4` is unchanged (SHA-256 `b34a64a3…`).
- **Files:** the output is `video-run4/clip.mp4`, with the contact sheet `output-contact-sheet.png`.

## Infrastructure defects found by these runs and fixed (generic, with regression tests)

1. **Planner history.** One web page read (about 17 KB) was larger than the 12 KB history
   budget, so Gemini saw no history at all and kept restarting. Now:
   - every step stays in the history;
   - only the newest observation is shown in full;
   - older observations are clipped.

   Test: `contracts.test.ts`.
2. **Repeated labels.** Controls with the same label got selectors that matched several
   elements. Each listed control now gets a fresh `data-ocade=cN` reference. Test: WEB-007b.
3. **Oversized page reads.** Page reads could be larger than the gateway's 16 KB evidence
   cap. The observation now fits itself to the cap, giving up page text first. Test: WEB-002b.
4. **Capability router continuity.** After `web.open`, `web.click` was sometimes not offered.
   Once an operation has been used, its whole role stays offered. Test: `contracts.test.ts`.
5. **Upload read-back.** A web app that clears its file input after reading it made a
   successful upload report `matches: false`. The file names are now captured on `change`.
   Test: WEB-006b.
6. **Editable widgets.**
   - `contenteditable` widgets were not listed as controls.
   - `web.fill` read-back assumed an `<input>`.
   - App widgets that commit only on real keystrokes and blur ignored the typed value.

   Editable widgets are now listed, typed into and blurred. Test: WEB-003b.
7. **Seeing after a click.** Gemini could not see a canvas app's state after a click.
   `web.click` now returns a 30 KB preview image of the page. Test: WEB-007c.
8. **Receipt size.** A receipt over the server's stored limit (`pg_column_size ≤ 65536`) was
   refused, and the companion retried forever. The gateway now leaves the preview out when it
   would not fit. Test: `test_gateway`.
9. **Planner prompt.**
   - The prompt said "exactly ONE function" although batches are supported.
   - The goal prompt now says to check only what the person asked for.
   - The planner now does the work the way the person says (for example, in a browser).

## Not fixed and still open

- **Browser photo editing: FAIL in 9 runs.**
  - Photopea draws its menus as unmarked elements.
  - Gemini reached the photo, menus and dialogs, but looped on menu toggles.
  - Each click needs its own confirmation and planner call, so the work does not fit in the
    Free plan's 28 requests.
  - This is a limit of the model and the allowance, not of a component found broken.
  - Not retried further, to avoid spending provider calls without a new fix.
- **Retry loop on refused receipts.** The companion still retries forever when the server
   refuses a receipt with a non-409 error. The gateway now keeps receipts inside the limit,
   but a server-side mapping of permanent refusals to 409 would end the loop for other causes.
- **Screenshot flake.** One local web test run hit Chromium's "Unable to capture screenshot"
  once, out of six runs.
- **Platform scope.** All of this ran on Linux with Xvfb. It says nothing about native
  Windows or macOS. It is not full platform readiness or commercial launch readiness.
