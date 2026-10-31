# JARVIS intelligence-service migration and media acceptance — 31 October 2026

Base commit `70435fa`; produced by the commit that adds this folder. Environment: disposable Linux container (Node 22.22, Python 3.13, PostgreSQL 16.15 with the Supabase stand-in, Chromium 153 under Xvfb via the agent proxy, FFmpeg, LibreOffice). Staging was inspected read-only. No provider model was called.

- `media/IMG-photopea-*`: real Photopea (www.photopea.com) operated through OCADE's gateway web operations as a scripted run; independent checks in `IMG-photopea-report.json`. Source: NASA Goddard "Discover Supercomputer 1" (metadata copied; Copyright: None).
- `media/VID-*`: 60-second film rendered natively (FFmpeg/Pillow) from NASA Ames public-domain B-roll with original graphics and score — **not** a web-editor or autonomous OCADE run. `build_film.py` reproduces it; `verify_film.py` checks it through the gateway's `media.inspect` and `verify.checks`. Delivery encode CRF 24 (the CRF 18 master is not committed).

| File | SHA-256 |
| --- | --- |
| `media/IMG-photopea-01-opened.png` | `8ec82d1c2b5bde4603dd157ede054ec404dbf847eb075e1f464b0cc32a0e00ec` |
| `media/IMG-photopea-02-image-size.png` | `ec31e0fb7cf6fc1ee654900bfbe498a4423dee67c21be6f89388935d9d77e303` |
| `media/IMG-photopea-03-vibrance.png` | `db26537ea1c2712e7ec21366478ed561b9892b83c5dfd1455dd6467264440577` |
| `media/IMG-photopea-04-edited.png` | `92b112ca5a696ddb97a4fa84af8713bcde1d7bc5d96da0d68aee228b2f73f218` |
| `media/IMG-photopea-05-export-dialog.png` | `2e1fab4c113a33fdaa675feb169c444a952a05c214bd4c9fc1fa639061c23197` |
| `media/IMG-photopea-photo-4k.jpg` | `a4e567c6859df05bf87e293e83b4b075696084a1458284d9f28fa51f3739e71b` |
| `media/IMG-photopea-report.json` | `ae7a820e745240a3b18f38d3feda810f64b0ae54a42cf0e5ca5929d955514749` |
| `media/IMG-source-nasa-metadata.json` | `5b1bc4127a4eaaffda74cda62b91b58a76a451cbd376c6ee3caec73d6013deaa` |
| `media/VID-film-frames.jpg` | `de7d99c5da992f57965a684837eefdf4a251af75146cffe4719a4025bab80ae2` |
| `media/VID-film-report.json` | `790fa36a3a101a2e6fe0d4dec481f3e82f6714b05ef4e6c9a40886b6987eae40` |
| `media/VID-source-nasa-metadata.json` | `066a129540c577108de8f384c314df4fffb0594090a683afdeb8a30160bea1a2` |
| `media/VID-the-mind-of-the-machine.mp4` | `bf93e22538c285e66e7a80fc89ce99dd43cff66c6dd3f41db34c779e5908a735` |
| `media/build_film.py` | `9f13aa1e9e715d3d35bed64277672306cf0f62de2f5c385f05aeea8540c878cb` |
| `media/film-manifest.json` | `0acb28be07dc96c74bc2e4032ca8dd666928b7059ad223f3e7bd4c6188350597` |
| `media/verify_film.py` | `31bbe43eeba71e03736fcf60bd57a83482a932aca20f0cd5625df317b692db74` |
| `traceability.json` | `a5d60d7d13985988309c4c154af06e8868759c3ad5369c09df762c0a716e56b6` |
| `traceability.md` | `7385cdff616367412ecd204bf36816db2d6d5c0adfd21786cfe002f6a206b877` |
