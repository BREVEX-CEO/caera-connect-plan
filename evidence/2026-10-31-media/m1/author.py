"""Scratch authoring of the M1 scene by the development agent (Claude). Emits plan.json."""
import json, sys
W, H, S = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
out = sys.argv[4]
def sh(shape, size, mat=None, pos=None, rot=None, **kw):
    d = {"shape": shape, "size": size}
    if mat: d["material"] = mat
    if pos: d["position"] = pos
    if rot: d["rotation"] = rot
    d.update(kw); return d
m = [
 {"id": "paint", "color": [0.6, 0.012, 0.018], "metallic": 0.45, "roughness": 0.45, "clearcoat": 1},
 {"id": "carbon", "color": [0.05, 0.05, 0.056], "roughness": 0.32, "clearcoat": 1, "pattern": "carbon", "patternScale": 1.4},
 {"id": "glass", "color": [0.006, 0.006, 0.008], "roughness": 0.04, "clearcoat": 1},
 {"id": "trim", "color": [0.012, 0.012, 0.012], "roughness": 0.55},
 {"id": "grille", "color": [0.04, 0.04, 0.04], "roughness": 0.45, "pattern": "grille", "patternScale": 1.2},
 {"id": "rubber", "color": [0.025, 0.025, 0.027], "roughness": 0.82},
 {"id": "rim", "color": [0.035, 0.035, 0.04], "metallic": 0.9, "roughness": 0.22},
 {"id": "disc", "color": [0.5, 0.5, 0.52], "metallic": 1, "roughness": 0.32, "pattern": "brushed"},
 {"id": "caliper", "color": [0.85, 0.02, 0.02], "roughness": 0.3, "clearcoat": 0.7},
 {"id": "headlight", "color": [0.9, 0.9, 0.95], "emission": [1, 0.97, 0.92], "emissionStrength": 7},
 {"id": "taillight", "color": [0.5, 0, 0], "emission": [1, 0.04, 0.02], "emissionStrength": 9},
 {"id": "chrome", "color": [0.8, 0.8, 0.82], "metallic": 1, "roughness": 0.12},
]
FA, RA, TR, WR = 1.38, -1.32, 0.86, 0.36   # axles, track, wheel radius
body = {"id": "body", "mirror": ["z"], "shapes": [
  # hull: a flattened ellipsoid with sculpted fenders and haunches, then sliced into a wedge
  sh("ellipsoid", [2.32, 0.5, 0.96], "paint", [0, 0.58, 0]),
  sh("box", [2.4, 0.42, 0.93], None, [0, 0.6, 0], op="intersect", round=0.06),
  sh("ellipsoid", [0.9, 0.3, 0.34], "paint", [RA + 0.05, 0.64, 0.66], op="smooth_union", k=0.2),
  sh("ellipsoid", [0.78, 0.22, 0.3], "paint", [FA - 0.05, 0.58, 0.66], op="smooth_union", k=0.18),
  sh("halfspace", [], None, [2.28, 0.5, 0], [0, 0, -14], op="intersect"),            # nose slope
  sh("halfspace", [], None, [-2.3, 0.84, 0], [0, 0, 7], op="intersect"),             # tail slope
  sh("halfspace", [], None, [0, 0, 0.97], [90, 0, 0], op="intersect"),              # flat flanks
  # cabin: black glass canopy and carbon roof
  sh("ellipsoid", [1.25, 0.4, 0.66], "glass", [-0.25, 0.84, 0], op="smooth_union", k=0.07),
  sh("ellipsoid", [0.7, 0.08, 0.46], "carbon", [-0.4, 1.2, 0], op="smooth_union", k=0.04),
  # wheel arches, black liners
  sh("cylinder", [0.43, 0.4], "trim", [FA, WR, 0.98], [90, 0, 0], op="subtract"),
  sh("cylinder", [0.44, 0.4], "trim", [RA, WR, 0.98], [90, 0, 0], op="subtract"),
  # side intake behind the door, grille inside
  sh("ellipsoid", [0.5, 0.14, 0.26], "grille", [-0.62, 0.55, 0.97], [0, 0, 6], op="smooth_subtract", k=0.04),
  # door shut lines
  sh("box", [0.004, 0.3, 0.3], "trim", [0.72, 0.62, 0.95], [0, 0, 8], op="subtract"),
  sh("box", [0.004, 0.25, 0.3], "trim", [-0.98, 0.64, 0.95], [0, 0, -12], op="subtract"),
  # front intakes and the centre mouth
  sh("ellipsoid", [0.3, 0.09, 0.4], "grille", [2.24, 0.33, 0.52], op="smooth_subtract", k=0.03),
  sh("ellipsoid", [0.25, 0.07, 0.3], "grille", [2.27, 0.31, 0], op="smooth_subtract", k=0.03),
  # lamps carved into the bodywork: the cut surface itself glows
  sh("ellipsoid", [0.24, 0.035, 0.1], "headlight", [1.98, 0.58, 0.6], [0, -16, -14], op="subtract"),
  sh("box", [0.04, 0.016, 0.72], "taillight", [-2.31, 0.8, 0], op="subtract", round=0.005),
  sh("box", [0.04, 0.03, 0.08], "taillight", [-2.29, 0.78, 0.76], op="subtract", round=0.005),
  # hood vents
  sh("box", [0.2, 0.03, 0.11], "grille", [1.42, 0.85, 0.3], [0, 0, -14], op="subtract", round=0.02),
]}
aero = {"id": "aero", "mirror": ["z"], "shapes": [
  sh("box", [0.16, 0.01, 0.56], "carbon", [2.02, 0.15, 0], round=0.008),                 # splitter
  sh("box", [0.95, 0.03, 0.035], "carbon", [0.0, 0.2, 0.9], round=0.012),              # side skirt
  sh("box", [0.3, 0.12, 0.9], "carbon", [-2.12, 0.24, 0], [0, 0, -12], round=0.02),      # diffuser
  sh("box", [0.28, 0.1, 0.006], "carbon", [-2.12, 0.24, 0.3], [0, 0, -12], op="union"),  # diffuser fins
  sh("box", [0.28, 0.1, 0.006], "carbon", [-2.12, 0.24, 0.6], [0, 0, -12]),
  sh("box", [0.24, 0.018, 1.0], "carbon", [-2.08, 1.16, 0], [0, 0, 5], round=0.01),     # rear wing
  sh("box", [0.08, 0.16, 0.012], "carbon", [-2.02, 1.0, 0.45], [0, 0, -10]),           # wing struts
  sh("box", [0.16, 0.08, 0.012], "carbon", [-2.1, 1.18, 1.0], round=0.005),             # end plates
  sh("ellipsoid", [0.12, 0.05, 0.06], "carbon", [0.55, 0.98, 0.98]),                    # mirror pod
  sh("box", [0.04, 0.05, 0.08], "trim", [0.55, 0.93, 0.9]),                             # mirror stalk
  sh("cylinder", [0.055, 0.08, ], "chrome", [-2.3, 0.3, 0.14], [0, 0, 90], shell=0.008),  # exhausts
  sh("cylinder", [0.055, 0.08], "chrome", [-2.3, 0.3, 0.3], [0, 0, 90], shell=0.008),
]}
wheel = {"id": "wheels", "mirror": ["x", "z"], "shapes": [
  sh("cylinder", [0.36, 0.13], "rubber", [1.35, WR, 0.86], [90, 0, 0], round=0.05),
  sh("cylinder", [0.285, 0.2], "trim", [1.35, WR, 0.98], [90, 0, 0], op="subtract"),
  sh("cylinder", [0.27, 0.1], "rim", [1.35, WR, 0.84], [90, 0, 0], op="union"),
  sh("cylinder", [0.23, 0.2], "trim", [1.35, WR, 0.98], [90, 0, 0], op="subtract"),
  sh("box", [0.115, 0.018, 0.02], "rim", [1.35, WR, 0.93], repeat={"axis": "z", "count": 10}, offset=[0.135, 0, 0], round=0.006),
  sh("cylinder", [0.24, 0.012], "disc", [1.35, WR, 0.86], [90, 0, 0]),
  sh("box", [0.06, 0.1, 0.03], "caliper", [1.18, WR + 0.06, 0.9], [0, 0, 35], round=0.02),
  sh("cylinder", [0.045, 0.03], "chrome", [1.35, WR, 0.95], [90, 0, 0]),
]}
scene = {
 "camera": {"position": [5.0, 0.72, 3.9], "target": [0.15, 0.48, 0.05], "fov": 26, "aperture": 0.012},
 "environment": {"sky": [[0.015, 0.015, 0.02], [0.05, 0.05, 0.06]], "ground": [0.045, 0.045, 0.05],
   "floor": {"color": [0.025, 0.025, 0.03], "roughness": 0.16, "reflectance": 0.3},
   "softboxes": [
     {"direction": [0.1, 1, 0], "width": 60, "height": 14, "intensity": 3},
     {"direction": [0.35, 0.55, 1], "width": 30, "height": 5, "intensity": 3},
     {"direction": [1, 0.5, -0.35], "width": 26, "height": 6, "intensity": 3},
     {"direction": [-1, 0.35, 0.25], "width": 14, "height": 22, "intensity": 2.5, "color": [1, 0.92, 0.9]}]},
 "lights": [
   {"kind": "sun", "direction": [0.45, 1, 0.55], "color": [1, 0.97, 0.94], "intensity": 1.5, "softness": 0.12},
   {"kind": "point", "position": [-4, 2.2, -2.5], "color": [1, 0.85, 0.8], "intensity": 14, "softness": 0.2}],
 "materials": m,
 "parts": [body, aero, wheel],
 "render": {"width": W, "height": H, "samples": S, "exposure": 1.35},
}
plan = {
 "task": "Starting from an empty scene, create a detailed, realistic red-and-black supercar in 3D and deliver a dramatic 3840x2160 studio render plus the editable 3D project.",
 "planAuthor": "Development AI agent (Claude, this engineering session) authored the scene data after inspecting preview renders; NOT the production Gemini planner and NOT an autonomous JARVIS task.",
 "acceptedAt": open('/tmp/m1/accepted.txt').read().strip(),
 "inputs": [],
 "steps": [{"op": "scene.render", "phase": "model_and_render", "args": {"scene": scene, "output": "OCADE output/supercar.png", "project": "OCADE output/supercar.ocade-scene.json"}}],
 "checks": [
   {"id": "scene_bound", "description": "The still was rendered from a complete saved 3D scene", "kind": "scene_render", "params": {"path": "OCADE output/supercar.png"}},
   {"id": "uhd", "description": "The still is 3840 x 2160", "kind": "image_size", "params": {"path": "OCADE output/supercar.png", "width": 3840, "height": 2160}},
   {"id": "project_saved", "description": "The editable scene project was saved", "kind": "file_exists", "params": {"path": "OCADE output/supercar.ocade-scene.json"}}],
 "deliver": ["OCADE output/supercar.png", "OCADE output/supercar.ocade-scene.json"],
}
json.dump(plan, open(out, "w"), indent=1)
