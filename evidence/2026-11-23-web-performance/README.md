# Cold page loads in Chromium, 23 November 2026 (source `2196c1ae`)

`measure.py` (in this folder) loads six public routes five times each in a fresh Chromium context
against the local CI-shaped build served by `wrangler dev --local` (see
`../2026-11-23-accessibility/`) and records the median navigation timing, first and largest
contentful paint, used JS heap and bytes transferred. Output: `cold-load-chromium.json`.

Medians: largest contentful paint 149–280 ms, 345–417 kB transferred per cold load (gzip),
4.7–8.2 MB JS heap; `/` is the heaviest paint (280 ms) and `/ocade-jarvis` the heaviest transfer.

Limits: loopback server with no network latency, no CPU throttling, signed out, one machine. This is
a baseline for item 99/101 comparisons, not a field measurement; the first-visit script budget
(902,739 of 950,000 bytes) is enforced separately by `tests/web/surface_audit.py`.
