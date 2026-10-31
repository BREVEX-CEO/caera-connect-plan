# M1 / M2 media acceptance runs — 31 October 2026

Both runs used OCADE's real gateway, workers and separate verifier (`device-agent/windows/tests/qualify_media.py`).
**Who chose the steps:** the development AI agent (Claude, in this engineering session) wrote the scene data
and the edit decision list after reading OCADE's own observations. **The production Gemini planner did not
run** (live provider calls are BLOCKED, see the session report), so neither run is an autonomous JARVIS task.
The authoring scripts (`m1/author.py`, `m2/author.py`) are evidence only; nothing in production imports them.

## M1 — red-and-black supercar from an empty scene (`m1/`)

- Engine: `scene.render` — OCADE's typed signed-distance 3D scene, rendered on the bundled browser engine
  (WebGL2; here Chromium's software renderer, no GPU). No model, asset, texture or photo was imported:
  the car is 4 parts and 63 shapes with 12 materials, written as data.
- Deliverables: `supercar.png` (3840 × 2160) and `supercar.ocade-scene.json` (the editable project: change it
  and render again).
- Verifier: `scene_render` (the still names its project, the project's SHA-256 matches, the scene has a camera,
  light, material and geometry, and the size matches), `image_size` 3840 × 2160, `file_exists` — all true.
- Timing (`M1-supercar-report.json`): accepted 12:44:34Z; four preview renders at 960 × 540 (about 13 s each)
  while the scene was refined; the final run started 12:54:23Z and was verified and delivered 13:02:44Z
  (render 498.9 s, verification 1.8 s). The earlier final attempt (`failed-attempt-1.json`) failed after 31 s:
  a gateway defect reported every call longer than 30 s as `worker_lost`. Fixed and covered by a test.
- Honest quality review: a coherent stylized concept car (clear-coat reflections, carbon weave, ten-spoke
  wheels, red calipers, carved lamps, floor reflections, soft shadows). It is **not photorealistic**: the body
  is built from blended primitives, tyres have no sidewall detail, and the image is visibly CG. Visual acceptance
  against "photorealistic, exceptional detail": **PARTIAL**.

## M2 — 60-second cinematic car ad from real raw footage (`m2/`)

- Footage: Prelinger Archives, *The Corvair in Action* (1960) and *A Wonderful New World of Fords* (1960),
  both public domain, 640 × 480. Wikimedia Commons' modern 4K/1080p CC-licensed car footage was the first
  choice, but Wikimedia answered every download from this network with HTTP 429 for the whole session.
  The vehicles are 1960 Chevrolet and Ford models; the ad names no brand and is labelled a spec film.
- Discovery: `media.inspect` and `media.analyze` (shot boundaries, brightness, colour, motion, sound per shot).
  The development agent also looked at contact sheets: OCADE's planner has no vision input today, so a
  production planner could not "see" the shots. Recorded as a product gap.
- Edit (`media.render_timeline`): 11 shots with in/out points, slow motion, push-ins, smooth-left, whip-blur,
  zoom-in, dissolve and fade-through-white transitions, warm/cool grades, 2.39 letterbox, four titles, the M1
  3D render as a clearly labelled synthetic end card, and 25 generated sound layers (engine-like rumble and revs,
  whooshes and impacts on the cuts, splash noise, a riser, a ducked drone score). The films' own soundtracks are
  narration and were muted, so **there are no recorded engine sounds**.
- Verifier: `media_quality` — exact 60.000 s, ≥ 1920 × 1080, H.264 + stereo AAC, integrated loudness within
  −20…−9 LUFS, true peak ≤ −0.5 dBFS, no black or silent stretch inside the programme.
- See `M2-car-ad-report.json` for timing and the result; rejected cuts are kept with their reasons.
- Honest quality review: real cars doing real driving (dust slides, river crossings, a night reveal), but the
  source is 480p, so the 1080p picture is visibly soft and grainy; no 3D camera tracking was attempted (the
  only 3D element is the composited render).
