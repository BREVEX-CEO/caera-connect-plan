export type ControlDomainId =
  | "apps"
  | "browser"
  | "files"
  | "voice"
  | "vision"
  | "mobile"
  | "system"
  | "automations";

export interface ControlLauncher {
  id: string;
  label: string;
  description: string;
  prompt: string;
  risk: "read" | "low" | "confirm" | "high";
}

export interface ControlDomain {
  id: ControlDomainId;
  label: string;
  shortLabel: string;
  description: string;
  launchers: readonly ControlLauncher[];
}

const action = (
  id: string,
  label: string,
  description: string,
  prompt: string,
  risk: ControlLauncher["risk"] = "read",
): ControlLauncher => ({ id, label, description, prompt, risk });

/**
 * The command deck is a discovery layer over OCADE's typed tool registry. It
 * does not bypass the planner or invoke raw mouse/shell actions: selecting an
 * item writes a plain-language instruction into the composer where it is
 * visible and editable. Sending still passes scope, permission, risk,
 * protected-input, emergency-stop and postcondition checks.
 */
export const CONTROL_DOMAINS: readonly ControlDomain[] = [
  {
    id: "apps",
    label: "Apps & windows",
    shortLabel: "Apps",
    description: "Find, open, focus and arrange installed software.",
    launchers: [
      action("apps-observe", "Inspect active app", "Read the focused window before acting.", "Inspect the active application and tell me what is visible."),
      action("apps-list", "List open windows", "Show the real windows currently open.", "List the windows currently open on this computer."),
      action("apps-installed", "Installed apps", "Read the installed application catalogue.", "List the applications installed on this computer."),
      action("apps-open", "Open an app", "Choose an installed app after reviewing the prompt.", "Open the application I name after asking me which one.", "confirm"),
      action("apps-focus", "Focus a window", "Bring an existing window to the front.", "Bring the window I name to the front after asking which one.", "low"),
      action("apps-arrange", "Arrange workspace", "Place windows using verified screen geometry.", "Arrange my current work windows side by side and verify the result.", "confirm"),
      action("apps-displays", "Map displays", "Read connected displays and their bounds.", "List every connected display with its size and position."),
    ],
  },
  {
    id: "browser",
    label: "Browser control",
    shortLabel: "Web",
    description: "Navigate and interact through named, permissioned elements.",
    launchers: [
      action("browser-read", "Read this page", "Read the current page without changing it.", "Read the current browser page and summarise what it contains."),
      action("browser-tabs", "List tabs", "Show the current browser tabs.", "List the browser tabs that OCADE is allowed to see."),
      action("browser-open", "Open a website", "Navigate to a reviewed address.", "Open the website I specify after asking for the address.", "confirm"),
      action("browser-find", "Find on page", "Locate visible text or controls.", "Ask what I want to find, then locate it on the current page."),
      action("browser-click", "Select a control", "Map named elements before clicking.", "Map the controls on this page, ask which one I mean, then select it.", "confirm"),
      action("browser-form", "Fill a form", "Fill ordinary fields but refuse protected inputs.", "Help fill the visible non-sensitive fields on this page and stop before submitting.", "confirm"),
      action("browser-verify", "Verify page change", "Read back the page after an action.", "Verify the last browser action by reading the resulting page state."),
    ],
  },
  {
    id: "files",
    label: "Files & documents",
    shortLabel: "Files",
    description: "Work only inside folders the user has approved.",
    launchers: [
      action("files-list", "List a folder", "Read an approved folder.", "Ask which approved folder I want, then list its files."),
      action("files-find", "Find a file", "Search approved folders by name or pattern.", "Ask what file I am looking for, then find it inside approved folders."),
      action("files-read", "Read a document", "Parse PDF, Word, Excel, CSV or text.", "Ask which document I want, then read and summarise it."),
      action("files-create", "Create a note", "Create a new file with visible content.", "Ask for a note name and content, then create it in my approved workspace.", "confirm"),
      action("files-organise", "Organise a folder", "Preview moves before applying them.", "Inspect an approved folder and propose an organisation plan without moving anything yet."),
      action("files-rename", "Rename safely", "Rename one selected file with verification.", "Ask which approved file to rename and the new name, then verify it.", "confirm"),
      action("files-recycle", "Move to recycle bin", "Never permanently delete; always confirm.", "Ask which approved file I want moved to the recycle bin, then wait for confirmation.", "high"),
    ],
  },
  {
    id: "voice",
    label: "Voice & conversation",
    shortLabel: "Voice",
    description: "Prompt, dictation, hands-free listening and local speech.",
    launchers: [
      action("voice-dictate", "Dictate a command", "Use the selected microphone once.", "Start a one-time dictated command when I press the microphone button."),
      action("voice-handsfree", "Hands-free mode", "Keep stop and pause phrases available.", "Switch this task to voice mode and explain the emergency stop phrase.", "confirm"),
      action("voice-local", "Use local speech", "Prefer an installed offline voice.", "Use an on-device female voice for spoken replies when one is installed."),
      action("voice-language", "Match my language", "Detect the language without changing control rules.", "Reply and speak in the language I use while keeping technical terms unchanged."),
      action("voice-devices", "List microphones", "Read available input devices on demand.", "List the microphones available on this device."),
      action("voice-read", "Read aloud", "Speak a selected answer after redaction.", "Read the most recent OCADE answer aloud using my selected voice."),
      action("voice-stop", "Stop listening", "Release the microphone immediately.", "Stop voice listening now.", "low"),
    ],
  },
  {
    id: "vision",
    label: "Vision & gestures",
    shortLabel: "Vision",
    description: "Accessibility tree first, local camera gestures when enabled.",
    launchers: [
      action("vision-screen", "Describe screen", "Read structure and visible text.", "Describe the active screen using the accessibility map first."),
      action("vision-map", "Number controls", "Create a fresh expiring element map.", "Number the actionable controls in the focused window."),
      action("vision-ocr", "Read drawn text", "Use OCR only when structure is insufficient.", "Read the visible text in the current window, using OCR only if needed."),
      action("vision-preview", "Camera preview", "Open a local preview without cursor control.", "Open hand-gesture camera preview only; do not control the cursor."),
      action("vision-cursor", "Hand cursor", "Require the separate two-step activation.", "Open the hand-control activation panel and wait for my confirmation.", "high"),
      action("vision-verify", "Verify an action", "Compare before and after observations.", "Verify the last computer action from the current screen state."),
      action("vision-stop", "Emergency stop", "Release held keys, buttons, camera and tasks.", "Emergency stop all computer and gesture control now.", "high"),
    ],
  },
  {
    id: "mobile",
    label: "Mobile companion",
    shortLabel: "Mobile",
    description: "Supervise PC tasks from a short-lived signed phone session.",
    launchers: [
      action("mobile-status", "Connection status", "Show paired and revoked devices.", "Show the current mobile companion connection and trust status."),
      action("mobile-pair", "Pair a phone", "Open the signed pairing flow.", "Open mobile pairing and explain each security step.", "confirm"),
      action("mobile-task", "Send PC task", "Create a scoped task from the paired phone.", "Prepare a PC task that can be sent from my paired phone.", "confirm"),
      action("mobile-approve", "Review approvals", "Show waiting high-risk decisions.", "Show approvals waiting for a decision from my paired phone."),
      action("mobile-pause", "Pause remotely", "Pause only the currently scoped task.", "Pause the current PC task from the paired mobile session.", "confirm"),
      action("mobile-output", "Collect output", "Download only a task-scoped result.", "Show outputs available to my paired phone for the current task."),
      action("mobile-revoke", "Revoke session", "Invalidate the paired session and key.", "Revoke the current mobile control session after confirmation.", "high"),
    ],
  },
  {
    id: "system",
    label: "System & hardware",
    shortLabel: "System",
    description: "Measured health, devices, media and reversible controls.",
    launchers: [
      action("system-health", "System health", "Measure CPU, memory, storage and uptime.", "Measure this computer's current CPU, memory, storage and uptime."),
      action("system-battery", "Battery status", "Read charge and power state.", "Read the current battery and charging status."),
      action("system-storage", "Storage space", "Read mounted-drive free space.", "Show free and used storage for every available fixed drive."),
      action("system-bluetooth", "Bluetooth devices", "List adapter and paired device state.", "Show Bluetooth status and connected devices."),
      action("system-audio", "Audio devices", "List available input and output endpoints.", "List the audio devices currently enabled."),
      action("system-brightness", "Set brightness", "Set and independently read back the result.", "Ask for a brightness level, set it, then verify the display reports it.", "confirm"),
      action("system-media", "Media controls", "Use OS media keys with an honest receipt.", "Ask whether I want play, pause, next or previous, then perform it.", "confirm"),
    ],
  },
  {
    id: "automations",
    label: "Automations & safety",
    shortLabel: "Runs",
    description: "Bounded plans, reminders, pause, recovery and receipts.",
    launchers: [
      action("runs-plan", "Rehearse a task", "Check apps, permissions and recovery first.", "Rehearse my next task without changing anything and list every blocker."),
      action("runs-remind", "Create reminder", "Use the operating system scheduler.", "Ask for a reminder date, time and message, then show it before scheduling.", "confirm"),
      action("runs-list", "List reminders", "Read only reminders created by OCADE.", "List the reminders OCADE has scheduled."),
      action("runs-automation", "Create automation", "Preview scope and permissions before saving.", "Help design an automation and show a dry-run without enabling it."),
      action("runs-pause", "Pause current task", "Stop before the next action.", "Pause the current OCADE task.", "low"),
      action("runs-receipts", "Show receipts", "Show what was observed, changed and verified.", "Show the verification receipts for the current task."),
      action("runs-stop", "Stop everything", "Cancel tasks and release input immediately.", "Emergency stop every OCADE control session now.", "high"),
    ],
  },
] as const;

export const CONTROL_LAUNCHER_COUNT = CONTROL_DOMAINS.reduce(
  (total, domain) => total + domain.launchers.length,
  0,
);

/**
 * Twenty-eight objects distributed across eight operational rings. The 4/3
 * split is intentional: 4 + 4 + 4 + 4 + 3 + 3 + 3 + 3 = 28.
 */
export const CONTROL_CONSTELLATION = CONTROL_DOMAINS.flatMap((domain, domainIndex) =>
  domain.launchers
    .slice(0, domainIndex < 4 ? 4 : 3)
    .map((launcher, objectIndex) => ({
      id: launcher.id,
      label: launcher.label,
      domainId: domain.id,
      domainIndex,
      objectIndex,
    })),
);

if (CONTROL_LAUNCHER_COUNT !== 56 || CONTROL_CONSTELLATION.length !== 28) {
  throw new Error("The OCADE command deck must expose 56 launchers and a 28-object constellation.");
}
