import { describe, it, expect } from "vitest";
import {
  isRecordableInput,
  recordableInputs,
  actionStyleFor,
  captureMaskFor,
  redactReplay,
  undoableRange,
  describeUndo,
  REPLAY_CONTROLS,
  type InputEvent,
  type ReplayStep,
} from "../skills/session-recording";

const key = (label: string, inProtectedField = false): InputEvent => ({
  kind: "key",
  label,
  inProtectedField,
  at: 0,
});

/**
 * Protected keystrokes are never captured — not masked afterwards. Masking a
 * stored frame or log means the value existed somewhere first.
 */
describe("what may be recorded", () => {
  it("NEVER records anything typed in a protected field, even a safe key", () => {
    expect(isRecordableInput(key("Tab", true))).toBe(false);
    expect(isRecordableInput(key("Enter", true))).toBe(false);
    expect(
      isRecordableInput({ kind: "pointer", label: "click", inProtectedField: true, at: 0 }),
    ).toBe(false);
  });

  it("records navigation and command keys", () => {
    for (const k of ["Tab", "Enter", "Escape", "Ctrl+S", "ArrowDown", "F5"]) {
      expect(isRecordableInput(key(k))).toBe(true);
    }
  });

  /**
   * A stream of individual characters IS the typed content. Reconstructing a
   * password from a "safe" keystroke log is exactly the failure to avoid.
   */
  it("refuses printable characters even OUTSIDE a protected field", () => {
    for (const k of ["a", "Z", "7", "@", " "]) {
      expect(isRecordableInput(key(k))).toBe(false);
    }
  });

  it("filters a mixed stream down to what may be shown", () => {
    const stream = [key("Ctrl+S"), key("h"), key("u"), key("Tab", true), key("Escape")];
    expect(recordableInputs(stream).map((e) => e.label)).toEqual(["Ctrl+S", "Escape"]);
  });

  it("a full typed word never survives filtering", () => {
    const typed = "hunter2".split("").map((c) => key(c));
    expect(recordableInputs(typed)).toHaveLength(0);
  });
});

/**
 * With video on, an invisible shortcut produces a recording that does not
 * explain what happened — worse than no recording, because it looks like
 * evidence.
 */
describe("how OCADE acts in each mode", () => {
  it("video ON: visible pointer, no hidden shortcuts", () => {
    const s = actionStyleFor("video_on");
    expect(s.visiblePointer).toBe(true);
    expect(s.allowShortcuts).toBe(false);
    expect(s.reason).toMatch(/what you see is what it did/i);
  });

  it("video OFF: shortcuts allowed, with a key overlay so it stays followable", () => {
    const s = actionStyleFor("video_off");
    expect(s.allowShortcuts).toBe(true);
    expect(s.showKeyOverlay).toBe(true);
    expect(s.reason).toMatch(/never what you type into a protected field/i);
  });

  it("the two modes genuinely differ", () => {
    expect(actionStyleFor("video_on").allowShortcuts).not.toBe(
      actionStyleFor("video_off").allowShortcuts,
    );
  });
});

describe("masking before capture", () => {
  it("always blanks credential fields, even with nothing extra detected", () => {
    const m = captureMaskFor([]);
    expect(m.maskSelectors).toContain('input[type="password"]');
    expect(m.maskSelectors.some((s) => s.includes("one-time"))).toBe(true);
    expect(m.maskSelectors.some((s) => s.includes("cc-"))).toBe(true);
  });

  it("adds fields detected on this particular screen", () => {
    const m = captureMaskFor(["accountNumber", "otp"]);
    expect(m.maskSelectors).toContain('[name="accountNumber"]');
    expect(m.maskSelectors).toContain('[name="otp"]');
  });

  it("ignores empty ids rather than producing a selector that matches everything", () => {
    const m = captureMaskFor(["", "   "]);
    expect(m.maskSelectors.some((s) => s === '[name=""]')).toBe(false);
  });

  it("does not duplicate selectors", () => {
    const m = captureMaskFor(["a", "a"]);
    expect(new Set(m.maskSelectors).size).toBe(m.maskSelectors.length);
  });
});

describe("replay", () => {
  const steps: ReplayStep[] = [
    { index: 1, summary: "Opened the invoices folder", undoable: false, at: 1 },
    { index: 2, summary: "Renamed march.pdf", undoable: true, at: 2 },
    { index: 3, summary: "Moved april.pdf", undoable: true, at: 3 },
  ];

  it("offers every control the user needs", () => {
    for (const c of ["pause", "resume", "cancel", "emergency_stop", "undo", "replay"]) {
      expect(REPLAY_CONTROLS).toContain(c);
    }
  });

  it("replaces a step containing protected content entirely", () => {
    const redacted = redactReplay([
      ...steps,
      { index: 4, summary: "typed the password hunter2", undoable: true, at: 4 },
    ]);
    const last = redacted[3];
    expect(last.summary).not.toContain("hunter2");
    expect(last.summary).not.toMatch(/password/i);
    expect(last.summary).toMatch(/details not recorded/i);
  });

  it("leaves ordinary steps readable", () => {
    expect(redactReplay(steps)[0].summary).toBe("Opened the invoices folder");
  });

  /**
   * Undoing past an irreversible step would leave the machine matching neither
   * the before state nor the after state.
   */
  it("stops undo at the first step that cannot be reversed", () => {
    expect(undoableRange(steps).map((s) => s.index)).toEqual([3, 2]);
  });

  it("reports nothing undoable when the most recent step is irreversible", () => {
    const s = [...steps, { index: 4, summary: "Emptied the recycle bin", undoable: false, at: 4 }];
    expect(undoableRange(s)).toHaveLength(0);
    expect(describeUndo(s)).toMatch(/nothing here can be undone/i);
  });

  it("says how much can be undone, honestly", () => {
    expect(describeUndo(steps)).toMatch(/last 2 of 3/i);
    const allUndoable = steps.map((s) => ({ ...s, undoable: true }));
    expect(describeUndo(allUndoable)).toMatch(/all 3 steps/i);
  });
});
