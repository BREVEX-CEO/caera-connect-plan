# OCADE JARVIS — working device runtime

This is the active JARVIS engine, created from the original source package
(preserved unchanged in `imports/ocade-jarvis/source-original/`). It runs on a
person's own computer, pairs with their OCADE account, and executes the browser
actions an OCADE JARVIS task asks for. It holds no provider key and makes no
model call: intelligence runs only in OCADE's server-side Online authority.

## Use

```
python setup.py                                   # dependencies + Playwright Chromium
python ocade_device.py pair --server https://ocade.in --code ABCD-2345
python ocade_device.py run                        # isolated JARVIS browser
python ocade_device.py run --real-browser-cdp http://127.0.0.1:9222   # also your own browser
```

The pairing code comes from OCADE JARVIS → Devices → Connect a device. The
device token is stored in `~/.ocade_jarvis/device.json` (owner-only). Removing
the device in OCADE revokes it at once.

`--real-browser-cdp` is the on-device authorization for your own browser: start
it yourself with `--remote-debugging-port=9222`, and turn on "Use my own browser"
for this device in OCADE. Without both, only the isolated browser exists.

## What is live

Browser control (`actions/browser_control.py`, OCADE structured control):
semantic DOM/accessibility targeting with per-observation element identity,
Playwright actions with fresh geometry, multi-tab work, a screenshot for visual
understanding, and coordinate clicks only while the observed geometry is still
on screen. Every action is verified from the page it leaves. Purchases are never
performed, sensitive submissions wait for a person's confirmation, passwords,
CAPTCHA, one-time codes and passkeys are left to the person, and payment card
fields are never filled.

## Preserved, not wired yet

Desktop and computer control (PyAutoGUI), files, screen and camera capture,
apps, messaging, reminders, system monitoring, the development agent, voice
(STT/TTS/wake word/echo guard), undo and confirmation modules, the generic
plugin loader, and the FastAPI phone dashboard remain in this runtime for later
phases. They are not reachable from OCADE today and are not offered as live
capabilities. Modules that used a device-side provider key now report that
capability as unavailable (`core/gemini.py`).

## Tests

```
OCADE_BROWSER_EXECUTABLE=/path/to/chromium python -m unittest discover -s tests
```
