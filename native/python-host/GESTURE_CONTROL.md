# OCADE Gesture Control

This is an opt-in local camera mode. Importing OCADE does not open the camera,
and preview mode does not move the pointer. Frames are displayed locally and
are never saved or transmitted by this module.

## Install

Use a separate environment because MediaPipe and the normal native host use
different OpenCV distributions:

```powershell
python -m venv .venv-gesture
.venv-gesture\Scripts\python -m pip install -r requirements-gesture.txt
.venv-gesture\Scripts\python -m ocade_host.gesture.download_model
```

## Verify the camera without retaining a frame

```powershell
.venv-gesture\Scripts\python -m ocade_host.gesture --probe-camera
```

## Preview safely

```powershell
.venv-gesture\Scripts\python -m ocade_host.gesture
```

## Arm cursor control explicitly

```powershell
.venv-gesture\Scripts\python -m ocade_host.gesture --enable-control
```

Press **Escape** or **Q** to stop. Moving the pointer to a PyAutoGUI fail-safe
corner is a second stop path. Losing the tracked hand releases any held mouse
button. A short thumb/index pinch clicks; holding the pinch starts a drag; two
raised fingers with the others folded scroll.

This is not claimed to match headset tracking. Accuracy depends on camera
quality, lighting, occlusion, skin/background contrast and per-user tuning.
