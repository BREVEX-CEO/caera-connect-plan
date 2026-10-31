"""M2 edit decision list, authored by the development agent (Claude) after reading OCADE's shot
analysis and contact sheets of the two public-domain films. Emits edit.json."""
import json
C, F = "Corvairi1960.mp4", "Wonderfu1960.mp4"
dirt = {"contrast": 1.18, "saturation": 1.2, "gamma": 0.94, "temperature": 5400, "sharpen": 0.7, "vignette": 0.45}
water = {"contrast": 1.15, "saturation": 1.15, "gamma": 0.95, "temperature": 7200, "sharpen": 0.7, "vignette": 0.45}
night = {"contrast": 1.1, "saturation": 1.05, "gamma": 0.98, "sharpen": 0.6, "vignette": 0.5}
push = lambda a=1.0, b=1.08, x=0.0: {"zoomFrom": a, "zoomTo": b, "panX": x}
clips = [
 {"source": C, "in": 363.0, "out": 367.5, "grade": dirt, "motion": push(1.0, 1.12)},                       # A dust burst toward lens
 {"source": C, "in": 368.0, "out": 370.8, "speed": 0.6, "grade": dirt, "motion": push(1.04, 1.1)},          # B wheel, slow
 {"source": C, "in": 113.0, "out": 118.0, "speed": 0.7, "grade": dirt, "transition": {"type": "smoothleft", "duration": 0.4}},  # C slide
 {"source": C, "in": 164.0, "out": 169.0, "grade": dirt, "motion": push(1.0, 1.06, 0.4)},                  # D mud tracking
 {"source": C, "in": 150.0, "out": 153.5, "grade": dirt},                                                   # E wheel in dust
 {"source": C, "in": 195.0, "out": 200.0, "speed": 0.8, "grade": dirt, "transition": {"type": "hblur", "duration": 0.3}},      # F drift
 {"source": C, "in": 205.5, "out": 208.5, "grade": dirt, "motion": push(1.0, 1.1)},                        # G past through dust
 {"source": C, "in": 238.5, "out": 244.3, "speed": 0.85, "grade": water, "transition": {"type": "zoomin", "duration": 0.4}},   # H river run
 {"source": C, "in": 250.0, "out": 254.0, "speed": 0.6, "grade": water},                                   # I splash, slow
 {"source": C, "in": 371.5, "out": 379.4, "grade": dirt, "motion": push(1.0, 1.05), "transition": {"type": "dissolve", "duration": 0.8}},  # K open road
 {"source": F, "in": 36.0, "out": 39.8, "grade": night, "motion": push(1.0, 1.06), "transition": {"type": "fadewhite", "duration": 0.5}},  # L reveal
]
for clip in clips:
    clip["audio"] = False  # the films carry narration; the sound is designed below
# Timeline marks, from the lengths and overlaps above.
marks = [0, 4.5, 8.77, 15.91, 20.91, 24.11, 30.36, 32.96, 39.78, 45.65, 53.05]
fx = lambda **k: {"role": "fx", **k}
whoosh = lambda t: fx(synth={"kind": "noise", "color": "pink"}, start=t - 0.55, duration=0.85, highpass=500, lowpass=6500, fadeIn=0.5, fadeOut=0.3, gain=-9)
impact = lambda t, g=-3: fx(synth={"kind": "sine", "frequency": 46, "decay": 6}, start=t, duration=1.4, gain=g)
audio = [
 {"role": "music", "synth": {"kind": "sine", "frequency": 41.2}, "start": 0, "duration": 60, "gain": -15, "fadeIn": 3, "fadeOut": 2},
 {"role": "music", "synth": {"kind": "sine", "frequency": 61.7}, "start": 6, "duration": 54, "gain": -20, "fadeIn": 6, "fadeOut": 2},
 {"role": "music", "synth": {"kind": "noise", "color": "brown"}, "start": 0, "duration": 60, "lowpass": 380, "gain": -24, "fadeIn": 4, "fadeOut": 2},
 # engine-like rumble and revs under the driving shots
 fx(synth={"kind": "sweep", "frequency": 70, "toFrequency": 190}, start=0.4, duration=4.2, lowpass=900, gain=-13, fadeIn=1.5, fadeOut=0.4),
 fx(synth={"kind": "noise", "color": "brown"}, start=8.8, duration=15, lowpass=260, gain=-12, fadeIn=1, fadeOut=1.5),
 fx(synth={"kind": "sweep", "frequency": 90, "toFrequency": 260}, start=24.1, duration=6.2, lowpass=1100, gain=-13, fadeIn=0.8, fadeOut=0.8),
 fx(synth={"kind": "noise", "color": "white"}, start=33.0, duration=6.7, highpass=1400, lowpass=7000, gain=-17, fadeIn=0.6, fadeOut=0.8),
 fx(synth={"kind": "noise", "color": "pink"}, start=39.8, duration=8.9, highpass=300, lowpass=2600, gain=-15, fadeIn=0.3, fadeOut=1.2),
 # riser into the reveal
 fx(synth={"kind": "sweep", "frequency": 180, "toFrequency": 1400}, start=48.6, duration=4.4, highpass=150, lowpass=5000, gain=-17, fadeIn=3.5, fadeOut=0.15),
] + [whoosh(t) for t in (4.5, 8.97, 15.91, 24.26, 33.16, 46.2, 53.3)] + [impact(t) for t in (4.5, 15.91, 33.16)] + [impact(53.3, 0), impact(55.4, -2),
 # the end card holds a low chord until the closing fade
 fx(synth={"kind": "sine", "frequency": 82.4}, start=55.4, duration=4.6, gain=-9, fadeIn=0.4, fadeOut=1.0),
 fx(synth={"kind": "sine", "frequency": 123.5}, start=55.6, duration=4.4, gain=-15, fadeIn=0.6, fadeOut=1.0)]
titles = [
 {"text": "SOME ROADS ARE FOUND.", "start": 1.0, "end": 4.2, "size": 70, "font": "Inter Display", "position": "center"},
 {"text": "OTHERS ARE MADE.", "start": 21.2, "end": 24.0, "size": 70, "font": "Inter Display", "position": "center"},
 {"text": "MUD. DUST. WATER. NOTHING STOPS IT.", "start": 40.4, "end": 45.6, "size": 44, "font": "Inter", "position": "lower_third"},
 {"text": "THE NEXT ROAD", "start": 55.8, "end": 59.6, "size": 92, "font": "Inter Display", "position": "top", "fadeIn": 1.0},
 {"text": "Spec film. Footage - Prelinger Archives 1960 (public domain). 3D car, sound - original, synthetic.",
  "start": 56.6, "end": 59.6, "size": 22, "font": "Inter", "position": "bottom", "fadeIn": 1.0},
]
overlays = [{"image": "supercar.png", "start": 55.2, "end": 60.0, "width": 1920, "x": 0.5, "y": 0.5, "fadeIn": 0.7, "fadeOut": 0.01, "zoomTo": 1.06}]
edit = {"output": "OCADE output/the-next-road.mp4", "duration": 60, "width": 1920, "height": 1080, "fps": 24,
        "clips": clips, "titles": titles, "overlays": overlays, "audio": audio, "letterbox": 2.39,
        "loudness": -14, "fadeIn": 0.8, "fadeOut": 1.0}
plan = {
 "task": "Edit authorized raw car footage into a cinematic 60.000-second car advertisement with camera-aware transitions, grade, typography and synchronized sound design (M2), phase 2: edit, render, verify.",
 "planAuthor": "Development AI agent (Claude, this engineering session) authored this edit after reading OCADE media.analyze shots and contact sheets; NOT the production Gemini planner and NOT an autonomous JARVIS task.",
 "acceptedAt": open("/tmp/m2/accepted.txt").read().strip(),
 "inputs": [C, F, "supercar.png"],
 "steps": [{"op": "media.render_timeline", "phase": "edit_and_render", "args": edit}],
 "checks": [
   {"id": "deliverable", "description": "Exactly 60 s, 1920x1080 H.264 + stereo AAC, broadcast loudness, no black or silent gaps", "kind": "media_quality",
    "params": {"path": "OCADE output/the-next-road.mp4", "value": 60, "width": 1920, "height": 1080}}],
 "deliver": ["OCADE output/the-next-road.mp4"], "deliverTo": "/tmp/m2/final",
}
json.dump(plan, open("/tmp/m2/edit.json", "w"), indent=1)
total = sum((c["out"] - c["in"]) / c.get("speed", 1) for c in clips) - sum(c.get("transition", {}).get("duration", 0) for c in clips)
print("timeline", round(total, 2), "layers", len(audio))
