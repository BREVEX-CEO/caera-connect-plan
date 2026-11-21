# Stage 3 debloat report — 21 November 2026

Branch `ocade/p00-p22-implementation`. Measured on this machine; the hosted campaign re-measures
on the final SHA. Every number below was read, not estimated.

## What was removed or kept out

| Change                                                                                                                                                                           | Before                          | After                         | How it was checked                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| The 30 MB pinned Git-tree research archive moved out of the working tree (owner-approved conditional archival; restorable from `2b6aeec`, `evidence/source-research/ARCHIVE.md`) | tracked files 51,205,636 bytes  | 21,483,824 bytes (−58%)       | `git ls-tree -r -l` sums at `0fd244d~1` and at the head; `audit_trees.py` restores it on demand; no product, test or CI path reads it |
| `vision.watch` (screenshot polling loop) replaced by the shared capture stream                                                                                                   | one capture loop per watch call | one stream per window, shared | `test_capture.py`; `test_vision.py` keeps the change-region rules                                                                     |
| `capture.Hub.close_all` (written, never called)                                                                                                                                  | present                         | removed                       | vulture at 60% confidence lists nothing else in the companion beyond OS callback signatures                                           |
| Live-vision native capture: pywinrt's ten small MIT packages instead of `windows-capture` (which needs numpy and opencv-python, about 60 MB)                                     | —                               | ~0.5 MB of wheels             | `requirements.lock`, `release/third-party-licences.json`                                                                              |

## Size and speed facts at the head

| Measure                                                | Value           | Budget / note                                  |
| ------------------------------------------------------ | --------------- | ---------------------------------------------- |
| First visit to `/`: script bytes the browser downloads | 887,410         | budget 950,000 (`surface_audit.py`, Chromium)  |
| Built client JavaScript (65 chunks, all routes)        | 1,662,971 bytes | split per route; most load only on their route |
| Built client CSS                                       | 63,352 bytes    | one file                                       |
| `evidence/`                                            | 12 MB           | was 41 MB before the archival                  |
| npm packages in the lock (all, incl. dev)              | 512             | licence-checked: 274 shipped                   |
| Companion Python packages shipped                      | 74              | licence-checked, hash-pinned                   |

## Dead-code scans

- **Companion (vulture, ≥60% confidence):** only OS callback signatures and COM/Win32 attribute
  writes the scanner cannot see being read (Office `Visible`, tray window class fields, PyObjC
  selectors). Nothing else unused.
- **Website (knip 5, no config):** its "unused files" are framework and platform entry points it
  does not know (`src/server.ts`, `src/cloudflare-entry.ts`, the Edge Functions, `public/sw.js`,
  test-only scripts); its "unused exports" are exports used only by tests or inside their own
  module. No unreachable module was found. Turning those exports private is churn without a size
  or risk benefit, so they stay.

## Not done here (honest)

- Startup time and memory were not measured in a real customer browser or on a real customer
  computer; the hosted campaign and Stage 6 measure them.
- No bundle-size change from code removal: the scans found no dead module to remove.
