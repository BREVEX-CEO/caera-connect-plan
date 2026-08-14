// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import {
  hardenDesktopShell,
  inDesktopShell,
  isDeveloperShortcut,
} from "@/lib/security/shell-hardening";

type TauriWindow = Window & { __TAURI_INTERNALS__?: unknown };

function pretendDesktop() {
  (window as TauriWindow).__TAURI_INTERNALS__ = {};
}

afterEach(() => {
  delete (window as TauriWindow).__TAURI_INTERNALS__;
});

describe("which keystrokes count as developer tooling", () => {
  const press = (over: Partial<Parameters<typeof isDeveloperShortcut>[0]>) =>
    isDeveloperShortcut({ key: "a", ctrlKey: false, metaKey: false, shiftKey: false, ...over });

  it("catches F12 and the inspector shortcuts on both platforms", () => {
    expect(press({ key: "F12" })).toBe(true);
    expect(press({ key: "I", ctrlKey: true, shiftKey: true })).toBe(true);
    expect(press({ key: "j", metaKey: true, shiftKey: true })).toBe(true);
    expect(press({ key: "c", ctrlKey: true, shiftKey: true })).toBe(true);
    expect(press({ key: "r", ctrlKey: true })).toBe(true);
    expect(press({ key: "u", metaKey: true })).toBe(true);
  });

  it("leaves copy, paste, select-all and find alone", () => {
    // THE ONES THAT MUST KEEP WORKING. A person has to be able to copy an answer
    // OCADE gave them; a product that fights its user for their clipboard has
    // mistaken them for an attacker.
    for (const key of ["c", "v", "x", "a", "f", "z"]) {
      expect(press({ key, ctrlKey: true })).toBe(false);
    }
  });

  it("does not treat a bare letter as a shortcut", () => {
    // Otherwise typing "r" into the composer would be swallowed.
    expect(press({ key: "r" })).toBe(false);
    expect(press({ key: "u" })).toBe(false);
    expect(press({ key: "i" })).toBe(false);
  });
});

describe("where the hardening applies", () => {
  it("installs nothing on the web", () => {
    // The web build must keep right-click: it is copy, open-in-new-tab, the
    // spell-checker and a screen reader's context actions.
    expect(inDesktopShell()).toBe(false);

    const remove = hardenDesktopShell();
    const event = new MouseEvent("contextmenu", { cancelable: true, bubbles: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    remove();
  });

  it("blocks the context menu inside the desktop shell", () => {
    pretendDesktop();
    const remove = hardenDesktopShell();

    const event = new MouseEvent("contextmenu", { cancelable: true, bubbles: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    remove();
  });

  it("blocks F12 but not Ctrl+C inside the desktop shell", () => {
    pretendDesktop();
    const remove = hardenDesktopShell();

    const devtools = new KeyboardEvent("keydown", { key: "F12", cancelable: true });
    window.dispatchEvent(devtools);
    expect(devtools.defaultPrevented).toBe(true);

    const copy = new KeyboardEvent("keydown", { key: "c", ctrlKey: true, cancelable: true });
    window.dispatchEvent(copy);
    expect(copy.defaultPrevented).toBe(false);

    remove();
  });

  it("removes its handlers when told to", () => {
    // A listener that outlives the component leaks, and on a route change it
    // would silently double up.
    pretendDesktop();
    const remove = hardenDesktopShell();
    remove();

    const event = new MouseEvent("contextmenu", { cancelable: true, bubbles: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
