# Real-model A vs F — 21 October 2026

First measurement of JARVIS control architectures with the **real** staging model instead of frozen
planner outputs. Every model call went through the staging Online boundary (`ocade-intelligence`
on Supabase `auyapercxxptziyngycx`, Standard quality, `gemini-3.5-flash-lite`, primary key slot)
with a disposable staging account and permits minted for it. Every action ran on the product's
own device executor (`jarvis-runtime` `Computer` and Playwright browser session) behind
[`device_server.py`](../../../../experiments/architectures/device_server.py) in a Linux cloud
container (Xvfb, bubblewrap confinement, ffmpeg 6.1). Results were judged afterwards by
independent oracles that read only the files and pages the run left, never the model's claims.

- **A** is the product loop itself (`runJarvisTurn`, its prompt, tools, sequences, checks).
- **F** is [`engine-f.ts`](../../../../experiments/architectures/engine-f.ts): survey the work
  folder and named pages with no model call, then programs of typed product calls ending in an
  on-device `verify`, with no start or finish call. Two versions ran: **F-v1** (one untyped
  `run_program` tool, essay runs only) and **F-v2** (the product's typed browser/computer tools
  plus `verify`, same 30-call budget as A, all later runs).
- Runner: [`live.ts`](../../../../experiments/architectures/live.ts). There is no task authority
  in the runner, so a run's `completed` is only the model's claim; the oracle decides.
- Busy provider answers were waited out exactly as the product does (15 s, 30 s, only when the
  provider names a wait that fits); a busy answer with no wait ends the run, as it pauses the task
  in the product.

## Results (n per cell is tiny: this is evidence of behaviour, not a success rate)

| Task                          | Run                             | Wall s | Model s | Calls | Input tokens | Device s | Claimed       | Oracle                                                                                                                                                     |
| ----------------------------- | ------------------------------- | -----: | ------: | ----: | -----------: | -------: | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Essay 300 words + PDF         | A                               |   42.0 |    36.3 |     6 |          69k |      5.7 | completed     | **PASS** (342 body words, 4 headings, 2-page PDF)                                                                                                          |
|                               | F-v1                            |   12.9 |    11.4 |     2 |         4.9k |      1.4 | completed     | FAIL: 267 body words; helper script left                                                                                                                   |
|                               | F-v1 + request-bound word check |   23.3 |    19.7 |     3 |          12k |      3.5 | completed     | **PASS** (352 words); `make_essay.py` left in folder                                                                                                       |
| 2-min AI-technology edit      | A #1                            |  107.9 |    74.8 |    18 |         218k |     33.0 | completed     | FAIL: true peak −0.1 dBFS (limit −0.5); 9 work files left                                                                                                  |
|                               | A #2                            |  109.8 |    79.1 |    27 |         451k |     30.6 | completed     | FAIL: true peak **+0.2 dBFS** (clipping)                                                                                                                   |
|                               | F-v2 #1                         |  189.3 |    62.8 |    21 |         404k |    125.5 | —             | FAIL: provider rate limit, no video                                                                                                                        |
|                               | F-v2 #2                         |   78.7 |    50.8 |    15 |         209k |     27.0 | completed     | **PASS** (true peak −0.7, −16.4 LUFS); 14 work files left                                                                                                  |
|                               | F-v2 #3                         |  132.6 |    51.3 |    14 |         204k |     80.4 | completed     | FAIL: true peak −0.1 dBFS                                                                                                                                  |
| S25 vs iPhone 16 in EtherCalc | A #1                            |   52.9 |       — |    17 |            — |        — | —             | FAIL: provider rate limit                                                                                                                                  |
|                               | A #2                            |   72.5 |    61.0 |    23 |         289k |     11.4 | completed     | FAIL (strict): all facts and 4 formulas right, but each release date split across two cells                                                                |
|                               | F-v2 #1                         |   69.6 |    43.4 |    18 |         183k |     26.1 | —             | FAIL: provider busy with no wait                                                                                                                           |
|                               | F-v2 #2                         |   57.3 |    39.9 |    16 |         204k |     17.3 | **completed** | FAIL: **false completion** — every Difference formula shows 0 (imported text, not numbers); F's page check matched the digits elsewhere in the observation |

Video oracle (all four rendered videos): 120.02–120.03 s, 1280×720, 30 fps, H.264/AAC, 4 source
clips each, a real title card and closing card (plain background with text, read by OCR), 16–18
scene changes, captions on screen are the clips' own burned-in NASA captions (30–33 source caption
words read); **no run added captions of its own** (`captionWordsAdded` 1–4). No run produced a
project file an editor opens (only the run's own JSON or Python script). Contact sheets (one frame
every 10 s) are in [`previews/`](previews/). Raw run and oracle records are in [`runs/`](runs/).

## What this shows

1. **F does not beat A reliably.** F was faster where it was right (essay 23 s vs 42 s; video
   pass 79 s vs 108 s) and used fewer calls on the edit (14–15 vs 18–27), but on the browser and
   media tasks Flash-Lite wrote one exploratory call per reply under F exactly as under A, so the
   "compile once" premise did not hold, and F's own `verify` produced a false completion that the
   product's task authority would have had to catch. **A stays selected; F is not adopted.**
2. **Provider rate limits are the dominant real failure.** 3 of 12 runs ended on Gemini free-tier
   rate limits at roughly 15–20 calls per minute; the boundary correctly retried the same key and
   did not rotate keys to evade project quota (owner decision; logs show `errorClass: quota`,
   `providerSlot: primary`, `attempts: 1`). Fewer calls per task is therefore a correctness
   requirement, not only a cost one.
3. **Quality gaps neither architecture closes:** loudness true peak not limited (3 of 4 videos),
   no added captions, no editor-openable project, helper scripts and intermediate renders left in
   the person's folder (the product prompt tells JARVIS to write scripts to the work folder),
   spreadsheet dates split across cells.
4. Fixed during this run (product): `file_info` reported no media length off Windows although the
   prompt promises it (now via ffprobe when installed); `app_info` could not find command-line
   programs (now found on PATH by exact name, never run).

## Limits

Linux cloud container only; no Windows/macOS desktop apps (no Resolve, Premiere, CapCut, Word or
Excel) were available, so every edit was ffmpeg via Python. n = 1–3 per cell; no p95 is
meaningful. Shared free-tier quota across back-to-back runs biases later runs toward rate limits.
TEST 1 (image), TEST 3 (YouTube understanding) and the interruption/STOP/crash families were not
run in this record; see BLOCKED_TESTS.md.
