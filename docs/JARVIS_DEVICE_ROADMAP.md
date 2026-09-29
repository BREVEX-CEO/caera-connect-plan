# OCADE JARVIS Device and Execution Roadmap

## Authority

This roadmap implements the current owner direction in `PLAN.md` and replaces older conflicting browser/device plans.

The website/JARVIS UI remains the primary interaction surface. Desktop and Android execution are OCADE-owned runtimes, not developer tools.

## Donor-first implementation

The preserved JARVIS source is the execution donor. Before implementing a capability, inspect its donor path, then copy/adapt useful logic into active `jarvis-runtime/`.

Key donor families include:
- `actions/browser_control.py`;
- `actions/computer_control.py`;
- `actions/computer_settings.py`;
- `actions/open_app.py`;
- `actions/file_controller.py`;
- `actions/file_processor.py`;
- `actions/code_helper.py`;
- `actions/dev_agent.py`;
- `actions/screen_processor.py`;
- `actions/send_message.py`;
- `actions/reminder.py`;
- `actions/background_monitor.py`;
- `actions/system_monitor.py`;
- `core/action_loader.py`;
- `core/confirm.py`;
- `core/undo.py`;
- `core/hotkey.py`;
- `core/stt.py`;
- `core/tts.py`;
- `core/wake_word.py`;
- donor remote-control/dashboard concepts.

The old GUI/provider-key/plugin product paths are not copied into active product behavior.

## Shared action broker

One device-side action broker owns:
- dispatch-time authorization;
- account/device/task binding;
- permission/capability checks;
- app/site scope;
- confirmation;
- idempotency/retry authority;
- cancellation;
- user-control lease;
- path/network safety;
- result verification;
- settlement.

Model output never becomes executable authority by itself.

## Control hierarchy

Use the strongest safe method available:
1. native/direct API or file/document operation;
2. application scripting/CLI/macros;
3. browser DOM/CDP/accessibility;
4. OS accessibility/UI Automation;
5. local vision;
6. freshly observed coordinates/PyAutoGUI.

Never reuse coordinates after state/layout/focus/monitor changes.

## Existing browser

Use the user's existing appropriate browser/profile for user-requested work when possible.

Chrome is first-class. Support other installed/default browsers where technically sound.

Existing session state is used by operating the authorized browser itself, not by extracting browser credential stores.

Human auth boundaries pause for the person.

For risky untrusted browsing that needs no personal session, an isolated context may be chosen deliberately.

## Windows Device Agent

Windows 10/11 is the first real desktop proof target.

The Device Agent:
- installs once;
- autostarts lightweight;
- uses one tray identity;
- remains dormant when idle;
- discovers useful installed apps;
- supports browser/apps/files/terminal/screen/system work;
- updates from verified releases;
- health-checks and rolls back;
- exits/uninstalls cleanly;
- removes local authority on disconnect/uninstall.

No floating desktop mini-control is required.

Tray provides status, Open OCADE, STOP, Pause/Resume where applicable, Exit.

## Real PC control

Support:
- application discovery and aliases;
- existing-window preference;
- focus/window verification;
- multi-monitor;
- DPI scaling;
- mouse, drag, scroll and keyboard;
- clipboard with restoration where practical;
- direct files;
- Office;
- IDEs;
- professional apps;
- process control;
- system operations;
- user takeover and Co-work.

Avoid unnecessary visible terminals.

STOP locally cancels active owned work immediately.

## Files and projects

Normal scope is user-granted folder/workspace. Explicit task language can grant a clear named folder such as Downloads for that task. Whole-disk access is never a silent default.

Prefer Trash/Recycle Bin. Protect overwrites. Preserve donor undo concepts where reliable.

## Office

Excel execution is a first-class acceptance target. Use workbook understanding, formulas, fill, tables, direct operations and real Excel UI appropriately. Preserve unrelated workbook features and macros.

Apply the same hybrid direct/API + real UI + verification model to Word and PowerPoint. Read/search PDFs directly before visual fallback.

## Development

Use filesystem, terminal, Git and tests directly. Open/use VS Code when helpful rather than forcing every edit through GUI.

Remote publish/destructive Git actions follow stronger authorization.

## Voice and wake

JARVIS converses during work.

Hey OCADE is locally detected after the user enables it. Download/verify the model once and retain it.

User voice can ask status, pause, continue, stop or change direction while a task is active.

## Background and recovery

Authorized long tasks checkpoint.

On network/process/reboot recovery, reconcile completed work before resuming. Never blindly repeat destructive actions.

Multiple devices are supported. One UI-control lease exists per device, while different devices may work concurrently.

## Android

OCADE installed mobile experience is acquired from `ocade.in`, presents one OCADE identity, and may use native Android components required for true overlay/accessibility/background behavior.

Bubble supports chat, voice, status/progress, STOP and full JARVIS.

Control order: intents/native APIs -> accessibility -> vision -> fresh coordinates.

Android-owned permission/security prompts are never bypassed.

## Apple

iPhone/iPad: PWA/Home Screen + Siri/Shortcuts + notifications/share + Remote PC.

macOS: trusted Device Agent/menu-bar + native scripting/accessibility + files/browser/vision.

WebKit is compatibility evidence only. Real hardware/cloud-device proof is recorded separately and billed testing requires owner approval.

## Evidence

A capability is not complete from source inspection alone.

Use LOCAL TEST, REAL BROWSER, REAL WINDOWS, REAL ANDROID, REAL APPLE, DATABASE TEST, LIVE, BLOCKED and UNTESTED distinctly.

Each phase reports commercial-launch readiness percentage and exact evidence.


## Relationship to the master plan

This device roadmap is implemented through the unified `PLAN.md` Phase 1–49 sequence. Earlier device foundations are revalidated in the earlier phases; commercial hardening and final evidence occur in the later phases. If this document conflicts with a newer explicit Phase 1–49 requirement, `PLAN.md` wins.
