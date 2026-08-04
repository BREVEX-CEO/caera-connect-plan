/**
 * Session recording, input display and replay safety.
 *
 * When OCADE works on the user's machine they should be able to watch it, and
 * afterwards prove what happened. Two modes, with genuinely different rules:
 *
 *  - VIDEO ON  — the user is watching. OCADE moves the pointer visibly and uses
 *                observable actions, so what they see is what happened. Hidden
 *                keyboard shortcuts are avoided: a shortcut that silently does
 *                something the viewer cannot see defeats the point of watching.
 *  - VIDEO OFF — nobody is watching, so fast shortcuts are fine. A small corner
 *                overlay shows which non-sensitive keys are being used, so the
 *                user can glance over and understand.
 *
 * The rule that overrides both: protected keystrokes are NEVER recorded,
 * displayed or replayed — not masked afterwards, not captured at all. Masking
 * after capture still means the value existed in a buffer.
 */
import { isProtectedText } from "@/lib/native/companion-bridge";

export type RecordingMode = "video_on" | "video_off";

export interface InputEvent {
  kind: "key" | "pointer";
  /** Key name or pointer action. Never a character the user typed into a field. */
  label: string;
  /** True when this happened inside a field OCADE classified as protected. */
  inProtectedField: boolean;
  at: number;
}

/** Keys that are safe to show: navigation and command keys, never content. */
const SAFE_KEYS = new Set([
  "Tab",
  "Enter",
  "Escape",
  "Backspace",
  "Delete",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Ctrl",
  "Alt",
  "Shift",
  "Meta",
  "Cmd",
  "Ctrl+C",
  "Ctrl+V",
  "Ctrl+S",
  "Ctrl+Z",
  "Ctrl+A",
  "Ctrl+F",
  "F1",
  "F2",
  "F3",
  "F5",
  "F11",
  "F12",
]);

/**
 * Whether an input event may be shown or stored.
 *
 * A single printable character is refused even outside a protected field: a
 * stream of individual characters IS the typed content, and reconstructing a
 * password from a "safe" keystroke log is exactly the failure to avoid.
 */
export function isRecordableInput(event: InputEvent): boolean {
  if (event.inProtectedField) return false;
  if (event.kind === "pointer") return true;
  if (SAFE_KEYS.has(event.label)) return true;
  // Anything else is treated as content, not a command.
  return false;
}

/** Filter an input stream down to what may be shown. */
export function recordableInputs(events: InputEvent[]): InputEvent[] {
  return events.filter(isRecordableInput);
}

export interface ActionStyle {
  /** Move the pointer visibly so the user can follow along. */
  visiblePointer: boolean;
  /** Keyboard shortcuts permitted. */
  allowShortcuts: boolean;
  /** Show the corner key overlay. */
  showKeyOverlay: boolean;
  reason: string;
}

/**
 * How OCADE should perform actions in each mode.
 *
 * These are not cosmetic. With video on, an invisible shortcut produces a
 * recording that does not explain what happened — which is worse than no
 * recording, because it looks like evidence.
 */
export function actionStyleFor(mode: RecordingMode): ActionStyle {
  if (mode === "video_on") {
    return {
      visiblePointer: true,
      allowShortcuts: false,
      showKeyOverlay: false,
      reason:
        "You're watching, so OCADE moves the pointer visibly and avoids hidden shortcuts — what you see is what it did.",
    };
  }
  return {
    visiblePointer: false,
    allowShortcuts: true,
    showKeyOverlay: true,
    reason:
      "Recording is off, so OCADE uses faster keyboard shortcuts. The corner overlay shows which keys — never what you type into a protected field.",
  };
}

/* ------------------------------------------------------------- capture -- */

export interface CaptureRegion {
  /** Selectors or accessibility ids to blank out before capture. */
  maskSelectors: string[];
  reason: string;
}

/**
 * Regions that must be blanked before a frame is captured.
 *
 * Applied BEFORE capture, never after: masking a stored frame means the
 * unmasked pixels existed on disk, however briefly.
 */
export function captureMaskFor(protectedFieldIds: string[]): CaptureRegion {
  const base = [
    'input[type="password"]',
    'input[autocomplete*="one-time"]',
    'input[autocomplete*="cc-"]',
    "[data-ocade-protected]",
  ];
  const extra = protectedFieldIds
    .filter((id) => id.trim().length > 0)
    .map((id) => `[name="${id}"]`);
  return {
    maskSelectors: [...new Set([...base, ...extra])],
    reason:
      extra.length > 0
        ? "Protected fields on this screen are blanked before anything is captured."
        : "Credential fields are blanked before anything is captured.",
  };
}

/* -------------------------------------------------------------- replay -- */

export type ReplayControl = "pause" | "resume" | "cancel" | "emergency_stop" | "undo" | "replay";

export const REPLAY_CONTROLS: ReplayControl[] = [
  "pause",
  "resume",
  "cancel",
  "emergency_stop",
  "undo",
  "replay",
];

export interface ReplayStep {
  index: number;
  summary: string;
  /** True when this step changed something and can be reversed. */
  undoable: boolean;
  at: number;
}

/**
 * Redact a replay log before it is shown or exported.
 *
 * Any step whose summary looks like protected content is replaced entirely
 * rather than partially masked: partial masking still leaks length and context.
 */
export function redactReplay(steps: ReplayStep[]): ReplayStep[] {
  return steps.map((s) =>
    isProtectedText(s.summary)
      ? { ...s, summary: "[step involving protected information — details not recorded]" }
      : s,
  );
}

/**
 * Which steps can actually be undone, newest first.
 *
 * Undo stops at the first step that cannot be reversed: continuing past it
 * would leave the machine in a state that matches neither before nor after,
 * which is worse than not undoing at all.
 */
export function undoableRange(steps: ReplayStep[]): ReplayStep[] {
  const out: ReplayStep[] = [];
  for (const s of [...steps].sort((a, b) => b.index - a.index)) {
    if (!s.undoable) break;
    out.push(s);
  }
  return out;
}

export function describeUndo(steps: ReplayStep[]): string {
  const range = undoableRange(steps);
  if (range.length === 0) return "Nothing here can be undone automatically.";
  const total = steps.length;
  return range.length === total
    ? `All ${total} steps can be undone.`
    : `The last ${range.length} of ${total} steps can be undone — earlier ones can't be reversed automatically.`;
}
