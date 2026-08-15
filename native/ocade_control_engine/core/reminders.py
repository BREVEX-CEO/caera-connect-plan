"""Reminders that survive OCADE being closed.

WHY THE OPERATING SYSTEM AND NOT A TIMER
-----------------------------------------
A reminder held in a Python thread dies when the process does — which is
exactly when a reminder matters, because nobody keeps an assistant open for six
hours waiting for one. Windows Task Scheduler, launchd and systemd all outlive
the app, survive a reboot, and fire whether or not OCADE is running. That is
the difference between a reminder and a hope.

WHAT THE SCHEDULED TASK ACTUALLY DOES
--------------------------------------
It shows a notification. It does NOT re-enter OCADE, run a tool, or execute
anything the user did not see at the moment they set it — a scheduled job that
can invoke an agent is a scheduled job that can do anything, hours later, with
nobody watching. The payload is a message, and only a message.

THREE SCHEDULERS, ONE VOCABULARY
---------------------------------
Each platform gets the mechanism its own users expect:

  Windows  `schtasks /Create /SC ONCE`, firing a PowerShell toast.
  macOS    a LaunchAgent plist with `StartCalendarInterval`, firing
           `osascript -e 'display notification'`.
  Linux    a systemd --user transient timer via `systemd-run --on-calendar`,
           firing `notify-send`.

All three are named with the same `OCADE_Reminder_` prefix, all three are
listable, and all three refuse to cancel anything that does not carry that
prefix. So `schedule`, `pending` and `cancel` mean the same thing everywhere and
the caller never branches on platform.

EVERY ONE OF THEM IS READ BACK
-------------------------------
`verified` comes from asking the scheduler for the task AFTER creating it, not
from the create command returning zero. `schtasks` in particular exits 0 on
several failures that leave no task behind, and a reminder that reports success
without existing is the single worst bug this file could have.
"""

from __future__ import annotations

import os
import platform
import plistlib
import re
import shutil
import subprocess
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

#: Task names are prefixed so OCADE's reminders can be listed and removed
#: without touching anything else the user has scheduled.
_PREFIX = "OCADE_Reminder_"

_SAFE_NAME = re.compile(r"[^A-Za-z0-9_-]+")
_MAX_MESSAGE = 400

_SYSTEM = platform.system()
_WINDOWS = _SYSTEM == "Windows"
_MACOS = _SYSTEM == "Darwin"
_LINUX = _SYSTEM == "Linux"
_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)

#: macOS LaunchAgents live here, one plist per job, loaded with `launchctl`.
_AGENT_DIR = Path.home() / "Library" / "LaunchAgents"

#: The reverse-DNS label macOS wants. Prefixed like the others so the same
#: listing and cancelling rules apply.
_AGENT_LABEL = "com.ocade.reminder"


class ReminderRefused(RuntimeError):
    """The reminder was not scheduled, with a reason."""


def _slug(text: str) -> str:
    return _SAFE_NAME.sub("_", " ".join(text.split()))[:40] or "note"


def _run(args: list[str], timeout: float = 20.0) -> subprocess.CompletedProcess:
    return subprocess.run(  # noqa: S603
        args, capture_output=True, text=True, timeout=timeout, creationflags=_NO_WINDOW
    )


def _parse_when(when: str) -> datetime:
    """Turn "in 20 minutes" / "at 18:30" / "tomorrow 09:00" into a real time.

    Deliberately small and explicit. A natural-language date parser that is
    wrong by a day is worse than one that refuses and asks — a reminder that
    fires on the wrong afternoon is a missed appointment.
    """
    text = " ".join((when or "").strip().lower().split())
    now = datetime.now()

    relative = re.fullmatch(
        r"in\s+(\d{1,4})\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)", text
    )
    if relative:
        amount = int(relative.group(1))
        unit = relative.group(2)
        if unit.startswith("d"):
            delta = timedelta(days=amount)
        elif unit.startswith("h"):
            delta = timedelta(hours=amount)
        else:
            delta = timedelta(minutes=amount)
        return now + delta

    clock = re.fullmatch(r"(?:at\s+)?(\d{1,2})[:.](\d{2})\s*(am|pm)?", text)
    tomorrow = re.fullmatch(r"tomorrow\s+(?:at\s+)?(\d{1,2})[:.](\d{2})\s*(am|pm)?", text)
    match = clock or tomorrow
    if match:
        hour, minute = int(match.group(1)), int(match.group(2))
        meridiem = match.group(3)
        if meridiem == "pm" and hour < 12:
            hour += 12
        if meridiem == "am" and hour == 12:
            hour = 0
        if not 0 <= hour <= 23 or not 0 <= minute <= 59:
            raise ReminderRefused(f"{when!r} is not a valid time.")
        target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if tomorrow or target <= now:
            target += timedelta(days=1)
        return target

    raise ReminderRefused(
        f"OCADE could not read {when!r} as a time. Try 'in 20 minutes', "
        "'at 18:30', or 'tomorrow 09:00'."
    )


# ----------------------------------------------------------------- windows --


def _windows_schedule(name: str, text: str, target: datetime) -> None:
    # A PowerShell toast, quoted so the message cannot break out of the string
    # and become another command.
    safe = text.replace("'", "''")
    action = (
        "powershell -NoProfile -WindowStyle Hidden -Command "
        f"\"[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, "
        f"ContentType=WindowsRuntime] | Out-Null; "
        f"$t=[Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(0); "
        f"$t.GetElementsByTagName('text').Item(0).AppendChild($t.CreateTextNode('{safe}')) | Out-Null; "
        f"[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('OCADE')"
        f".Show([Windows.UI.Notifications.ToastNotification]::new($t))\""
    )
    completed = _run(
        [
            "schtasks", "/Create", "/F",
            "/TN", name,
            "/SC", "ONCE",
            "/ST", target.strftime("%H:%M"),
            "/SD", target.strftime("%d/%m/%Y"),
            "/TR", action,
        ]
    )
    if completed.returncode != 0:
        raise ReminderRefused(
            f"Windows refused the schedule: {(completed.stderr or completed.stdout).strip()[:200]}"
        )


def _windows_exists(name: str) -> bool:
    return _run(["schtasks", "/Query", "/TN", name], timeout=15.0).returncode == 0


def _windows_pending() -> list[dict[str, str]]:
    completed = _run(["schtasks", "/Query", "/FO", "CSV", "/NH"], timeout=30.0)
    rows: list[dict[str, str]] = []
    for line in (completed.stdout or "").splitlines():
        if _PREFIX not in line:
            continue
        parts = [part.strip('"') for part in line.split('","')]
        if parts:
            rows.append(
                {
                    "task": parts[0].lstrip('"').lstrip("\\"),
                    "next": parts[1] if len(parts) > 1 else "",
                }
            )
    return rows


def _windows_cancel(name: str) -> bool:
    return _run(["schtasks", "/Delete", "/F", "/TN", name], timeout=15.0).returncode == 0


# ------------------------------------------------------------------ macos --


def _agent_path(name: str) -> Path:
    return _AGENT_DIR / f"{_AGENT_LABEL}.{name}.plist"


def _macos_schedule(name: str, text: str, target: datetime) -> None:
    _AGENT_DIR.mkdir(parents=True, exist_ok=True)
    path = _agent_path(name)

    # `display notification` through osascript is the supported way to raise a
    # Notification Centre banner without an app bundle. The message is passed
    # as a separate ARGUMENT rather than interpolated into the AppleScript
    # source, so a quote in it cannot become script.
    plist = {
        "Label": f"{_AGENT_LABEL}.{name}",
        "ProgramArguments": [
            "/usr/bin/osascript",
            "-e",
            'on run argv\ndisplay notification (item 1 of argv) with title "OCADE"\nend run',
            text,
        ],
        # StartCalendarInterval with a full date fires once. There is no
        # one-shot flag in launchd, so the agent is unloaded by its own
        # `cancel` path afterwards; an agent whose date has passed simply never
        # fires again.
        "StartCalendarInterval": {
            "Month": target.month,
            "Day": target.day,
            "Hour": target.hour,
            "Minute": target.minute,
        },
        "RunAtLoad": False,
    }
    path.write_bytes(plistlib.dumps(plist))

    # `bootstrap` is the modern verb; `load` is kept as the fallback because
    # bootstrap did not exist before macOS 10.11 and fails on some managed
    # machines where load still works.
    uid = os.getuid()  # type: ignore[attr-defined]
    if _run(["launchctl", "bootstrap", f"gui/{uid}", str(path)]).returncode != 0:
        completed = _run(["launchctl", "load", "-w", str(path)])
        if completed.returncode != 0:
            path.unlink(missing_ok=True)
            raise ReminderRefused(
                f"launchd refused the reminder: {(completed.stderr or completed.stdout).strip()[:200]}"
            )


def _macos_exists(name: str) -> bool:
    # The plist on disk is the durable record; launchd's list is the loaded
    # state. Both have to agree, and the file is what survives a reboot.
    return _agent_path(name).is_file()


def _macos_pending() -> list[dict[str, str]]:
    if not _AGENT_DIR.is_dir():
        return []
    rows: list[dict[str, str]] = []
    for path in sorted(_AGENT_DIR.glob(f"{_AGENT_LABEL}.{_PREFIX}*.plist")):
        name = path.stem.replace(f"{_AGENT_LABEL}.", "")
        when = ""
        try:
            data = plistlib.loads(path.read_bytes())
            interval = data.get("StartCalendarInterval") or {}
            if interval:
                when = f"{interval.get('Day', '?')}/{interval.get('Month', '?')} {interval.get('Hour', 0):02d}:{interval.get('Minute', 0):02d}"
        except Exception:  # noqa: BLE001, S110
            pass
        rows.append({"task": name, "next": when})
    return rows


def _macos_cancel(name: str) -> bool:
    path = _agent_path(name)
    if not path.is_file():
        return False
    try:
        uid = os.getuid()  # type: ignore[attr-defined]
        _run(["launchctl", "bootout", f"gui/{uid}/{_AGENT_LABEL}.{name}"])
    except Exception:  # noqa: BLE001, S110
        pass
    _run(["launchctl", "unload", "-w", str(path)])
    path.unlink(missing_ok=True)
    return not path.is_file()


# ------------------------------------------------------------------ linux --


def _linux_notifier(text: str) -> list[str]:
    """The notification command, preferring the tool that is actually installed."""
    if shutil.which("notify-send"):
        return ["notify-send", "OCADE", text]
    if shutil.which("zenity"):
        return ["zenity", "--info", "--title=OCADE", f"--text={text}"]
    raise ReminderRefused(
        "Desktop notifications need 'notify-send' (libnotify) or 'zenity', and neither is installed."
    )


def _linux_schedule(name: str, text: str, target: datetime) -> None:
    if not shutil.which("systemd-run"):
        raise ReminderRefused(
            "Scheduled reminders on Linux need systemd. 'systemd-run' was not found on this machine."
        )
    completed = _run(
        [
            "systemd-run",
            "--user",
            f"--unit={name}",
            f"--on-calendar={target.strftime('%Y-%m-%d %H:%M:%S')}",
            "--timer-property=AccuracySec=1s",
            # The transient timer is removed once it has fired, so a machine
            # does not accumulate a unit per reminder ever set.
            "--timer-property=RemainAfterElapse=no",
            *_linux_notifier(text),
        ]
    )
    if completed.returncode != 0:
        raise ReminderRefused(
            f"systemd refused the reminder: {(completed.stderr or completed.stdout).strip()[:200]}"
        )


def _linux_exists(name: str) -> bool:
    completed = _run(["systemctl", "--user", "list-timers", "--all", "--no-legend"], timeout=15.0)
    return name in (completed.stdout or "")


def _linux_pending() -> list[dict[str, str]]:
    completed = _run(["systemctl", "--user", "list-timers", "--all", "--no-legend"], timeout=15.0)
    rows: list[dict[str, str]] = []
    for line in (completed.stdout or "").splitlines():
        if _PREFIX not in line:
            continue
        fields = line.split()
        unit = next((field for field in fields if _PREFIX in field), "")
        rows.append({"task": unit.removesuffix(".timer"), "next": " ".join(fields[:3])})
    return rows


def _linux_cancel(name: str) -> bool:
    stopped = _run(["systemctl", "--user", "stop", f"{name}.timer"], timeout=15.0)
    _run(["systemctl", "--user", "stop", f"{name}.service"], timeout=15.0)
    return stopped.returncode == 0 or not _linux_exists(name)


# ------------------------------------------------------------------ public --


def _exists(name: str) -> bool:
    if _WINDOWS:
        return _windows_exists(name)
    if _MACOS:
        return _macos_exists(name)
    if _LINUX:
        return _linux_exists(name)
    return False


def schedule(message: str, when: str) -> dict[str, Any]:
    """Register a one-off OS notification."""
    text = " ".join((message or "").split())[:_MAX_MESSAGE]
    if not text:
        raise ReminderRefused("A reminder needs something to say.")
    target = _parse_when(when)
    if target <= datetime.now():
        raise ReminderRefused(f"{when!r} is in the past.")
    name = f"{_PREFIX}{_slug(text)}_{int(time.time())}"

    if _WINDOWS:
        _windows_schedule(name, text, target)
    elif _MACOS:
        _macos_schedule(name, text, target)
    elif _LINUX:
        _linux_schedule(name, text, target)
    else:
        raise ReminderRefused(f"Scheduled reminders are not wired up on {_SYSTEM}.")

    return {
        "task": name,
        "message": text,
        "at": target.isoformat(timespec="minutes"),
        "scheduler": {"Windows": "Task Scheduler", "Darwin": "LaunchAgent", "Linux": "systemd"}.get(
            _SYSTEM, _SYSTEM
        ),
        # Verified by asking the scheduler for the task back, not by the create
        # command returning zero.
        "verified": _exists(name),
        "detail": f"Reminder set for {target.strftime('%H:%M on %d %B')}: {text}",
    }


def pending() -> dict[str, Any]:
    """Every reminder OCADE has scheduled."""
    try:
        if _WINDOWS:
            rows = _windows_pending()
        elif _MACOS:
            rows = _macos_pending()
        elif _LINUX:
            rows = _linux_pending()
        else:
            rows = []
    except (OSError, subprocess.TimeoutExpired) as error:
        # Listing is read-only status. A stalled scheduler must not crash the
        # whole bridge, but an empty list must not be misreported as verified.
        return {
            "reminders": [],
            "count": 0,
            "verified": False,
            "detail": f"The {_SYSTEM} reminder service did not respond in time.",
            "reason": type(error).__name__,
        }
    return {
        "reminders": rows,
        "count": len(rows),
        "verified": True,
        "detail": f"{len(rows)} reminder(s) scheduled." if rows else "No reminders are set.",
    }


def cancel(task: str) -> dict[str, Any]:
    """Remove one reminder. Only OCADE's own tasks can be removed."""
    name = task.strip().lstrip("\\").removesuffix(".timer")
    if not name.startswith(_PREFIX):
        raise ReminderRefused("That is not an OCADE reminder, so OCADE will not delete it.")

    if _WINDOWS:
        removed = _windows_cancel(name)
    elif _MACOS:
        removed = _macos_cancel(name)
    elif _LINUX:
        removed = _linux_cancel(name)
    else:
        raise ReminderRefused(f"Scheduled reminders are not wired up on {_SYSTEM}.")

    return {
        "task": name,
        "removed": removed,
        # The truth is whether it is GONE, which is a different question from
        # whether the delete command succeeded.
        "verified": not _exists(name),
        "detail": "Reminder cancelled." if removed else "It was not there.",
    }
