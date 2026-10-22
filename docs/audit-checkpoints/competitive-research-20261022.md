# Competitive research and gap-to-fix ledger — 22 October 2026 (phases.md Task 3E)

Dated research, read on 22 October 2026. Official claims are vendor statements, not independent
proof. Nothing here measures OCADE against these systems directly: **direct superiority is
UNVERIFIED** (no authorised accounts, keys or budget for Fable 5.1, GPT-6 Astra or the agent
products in this session; buying API access needs the owner's approval).

## The two named targets

|                                | Claude Fable 5.1 (Anthropic)                                                                                                                    | GPT-6 Astra (OpenAI)                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Released                       | September 2026; API id `claude-fable-5-1`; Mythos 5.1 is the same model with fewer safeguards, restricted access                                | 3 September 2026 (secondary sources; openai.com answered this session with HTTP 403)                                 |
| Effort settings                | Low, Medium, High, xHigh, Max (default High in Claude Code, Medium in Cowork and Claude.ai)                                                     | low, medium, high, xhigh, max per secondary sources; OpenAI's model-selection guide names Low, Medium and Extra high |
| Computer use (vendor-reported) | OSWorld 2.0 (Aug 2026 tasks) 77.9% partial / 41.7% strict                                                                                       | OSWorld 2.0 offline subset 72.6%; ScreenSpot-Pro 92.7%                                                               |
| Other published results        | Terminal-Bench 4.0 55.8%, GDPval-AA v2 1853, AutomationBench 31.4%, HLE 60.9% / 65.0% with tools; Browserbase: 82% of its hardest browser tasks | Artificial Analysis Intelligence Index 61.2 (Fable 5.1: 65.7), an independent aggregate                              |
| Price (API)                    | $10 / $50 per million input / output tokens; cache reads $0.25                                                                                  | $10 / $50 per million (secondary sources)                                                                            |
| Methods the vendors stress     | long unattended runs with verification loops; keeps its own records and resumes; fewer tokens at Low/Medium effort                              | operates software through the screen; reasoning effort is chosen per task                                            |

Sources: [Anthropic — Fable and Mythos 5.1](https://www.anthropic.com/claude-fable-and-mythos-5-1),
[OpenAI — model selection](https://developers.openai.com/api/docs/guides/model-selection),
secondary coverage of Astra: [computingforgeeks](https://computingforgeeks.com/gpt-6-astra-released-features-benchmarks/),
[DataCamp](https://www.datacamp.com/blog/gpt-6-astra),
[pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/14246/openai-launches-gpt-6-astra-pricing-benchmarks).
Limitations: vendor harnesses, highest effort settings, task sets OCADE does not run.

## What this means for OCADE

OCADE plans with `gemini-3.5-flash-lite` on staging (free tier). The base model is far below
either target in raw reasoning and screen grounding; a prompt cannot change that. OCADE can only
win on what the product adds around the model: completion the server verifies in the saved
file, originals kept, the named app used or the blocker said, fewer wasted model calls, and
files handed over that open. Each row below is a gap seen in OCADE's own real runs and what
was shipped for it on the implementation branch.

| Gap (evidence)                                                                                                                                                                                                         | Customer effect                       | Shipped fix                                                                                                                                                                                                        | Measured                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| A finished video was reported with a title card, closing card, captions, balanced audio and an editor project; the oracle found none of the cards, true peak +0.6 dBFS (clipping) and no `.mlt` (video run v2, 22 Oct) | a false completion                    | `measures` checks: lengths, frame sizes, page counts, triangles, loudness and true peak the device measures in the saved file must be in range; a file the result names must be one the device made, saw or listed | unit and real-Postgres tests; real rerun below |
| Each finish was refused for reading back helper scripts in `.jarvis/` and for files a script never touched (photo p3, video v2: 4 extra reads and an extra finish)                                                     | wasted model calls (RATE-21-01)       | the device lists every file a command touched (`wroteAll`); a read stays valid across a command that did not touch it; helper scripts are judged by what they made                                                 | tests; calls per task in the reruns below      |
| Finished files never reached the Library in the product: the planner read device results flat while the exchange nests them under `detail`; the benchmark runner hid it by returning the flat shape                    | completed cards without Open/Download | the planner reads `detail`; the runner now returns the product's shape; a browser journey proves list, Download (same bytes, own name) and Open                                                                    | `jarvis` journey 3/3 new checks PASS           |
| Generic quality prose did not help (Elite Work Standard 0/2 photo vs 2/2)                                                                                                                                              | —                                     | unified candidate with short measurable standards per kind of result (`ocade.prompt` = `unified`), off by default                                                                                                  | A/B below                                      |

Still open: screen grounding and long-horizon reasoning are model limits (Standard is a lite
model); High mode is unavailable on staging (`high_unavailable`, CF-04-01); direct comparisons
need owner-approved access.
