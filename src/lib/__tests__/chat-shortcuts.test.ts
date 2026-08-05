import { describe, it, expect } from "vitest";
import {
  matchChatShortcut,
  isTypingTarget,
  describeShortcut,
  CHAT_SHORTCUTS,
  type KeyEventLike,
} from "../chat-shortcuts";

/**
 * The two ways a shortcut table ruins someone's day:
 *   1. it fires while they are writing, eating letters out of a message;
 *   2. it steals a combination the browser already owns, so a habit that works
 *      everywhere else stops working here.
 *
 * Both are asserted below, because neither is visible in review.
 */

const key = (over: Partial<KeyEventLike> & { key: string }): KeyEventLike => ({
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...over,
});

describe("a shortcut never eats a letter out of a message", () => {
  it("ignores bare letters entirely", () => {
    for (const letter of ["o", "k", "l", "s", "n", "/"]) {
      expect(matchChatShortcut(key({ key: letter })), letter).toBeNull();
    }
  });

  it("recognises the text controls a person types into", () => {
    expect(isTypingTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingTarget({ tagName: "input" })).toBe(true);
    expect(isTypingTarget({ isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it("still allows Escape while typing, because that is when Stop is wanted", () => {
    // Someone stopping a bad reply already has their cursor back in the box
    // writing the correction. A stop shortcut that only works outside the
    // composer is a stop shortcut nobody can reach.
    expect(matchChatShortcut(key({ key: "Escape" }))).toBe("stop");
  });
});

describe("a shortcut never steals a combination the browser owns", () => {
  it("leaves the tab and window shortcuts alone", () => {
    // Ctrl+N / Ctrl+T / Ctrl+W open or close windows and tabs. A page that
    // captures them either does nothing visible or takes away a habit the user
    // relies on in every other application.
    for (const letter of ["n", "t", "w"]) {
      expect(matchChatShortcut(key({ key: letter, ctrlKey: true })), letter).toBeNull();
    }
  });

  it("leaves the address bar alone", () => {
    expect(matchChatShortcut(key({ key: "l", ctrlKey: true }))).toBeNull();
  });

  it("declines Alt combinations, which belong to the system menus", () => {
    expect(matchChatShortcut(key({ key: "o", ctrlKey: true, shiftKey: true, altKey: true }))).toBe(
      null,
    );
  });
});

describe("the shortcuts that exist", () => {
  it("starts a new chat on Ctrl+Shift+O", () => {
    expect(matchChatShortcut(key({ key: "O", ctrlKey: true, shiftKey: true }))).toBe("new_chat");
  });

  it("searches on Ctrl+K", () => {
    expect(matchChatShortcut(key({ key: "k", ctrlKey: true }))).toBe("search");
  });

  it("focuses the message box on Ctrl+Shift+L", () => {
    expect(matchChatShortcut(key({ key: "L", ctrlKey: true, shiftKey: true }))).toBe(
      "focus_composer",
    );
  });

  it("toggles history on Ctrl+Shift+S", () => {
    expect(matchChatShortcut(key({ key: "s", ctrlKey: true, shiftKey: true }))).toBe(
      "toggle_sidebar",
    );
  });

  it("shows help on Ctrl+/ and on Ctrl+?", () => {
    expect(matchChatShortcut(key({ key: "/", ctrlKey: true }))).toBe("show_help");
    expect(matchChatShortcut(key({ key: "?", ctrlKey: true }))).toBe("show_help");
  });

  it("treats Cmd the same as Ctrl, so a Mac user is not left out", () => {
    expect(matchChatShortcut(key({ key: "k", metaKey: true }))).toBe("search");
    expect(matchChatShortcut(key({ key: "o", metaKey: true, shiftKey: true }))).toBe("new_chat");
  });

  it("is case-insensitive, because Shift changes the reported letter", () => {
    // With Shift held, `key` arrives as "O" not "o". Matching on the lowercase
    // form only would leave every Shift shortcut dead.
    expect(matchChatShortcut(key({ key: "O", ctrlKey: true, shiftKey: true }))).toBe("new_chat");
    expect(matchChatShortcut(key({ key: "o", ctrlKey: true, shiftKey: true }))).toBe("new_chat");
  });
});

describe("every shortcut is discoverable", () => {
  it("lists each action the matcher can produce", () => {
    // A shortcut absent from the help sheet is, for a keyboard shortcut,
    // indistinguishable from one that does not exist.
    const produced = new Set(
      [
        matchChatShortcut(key({ key: "O", ctrlKey: true, shiftKey: true })),
        matchChatShortcut(key({ key: "k", ctrlKey: true })),
        matchChatShortcut(key({ key: "L", ctrlKey: true, shiftKey: true })),
        matchChatShortcut(key({ key: "S", ctrlKey: true, shiftKey: true })),
        matchChatShortcut(key({ key: "Escape" })),
        matchChatShortcut(key({ key: "/", ctrlKey: true })),
      ].filter((action): action is NonNullable<typeof action> => action !== null),
    );
    const documented = new Set(CHAT_SHORTCUTS.map((entry) => entry.action));
    for (const action of produced) expect(documented.has(action), action).toBe(true);
    expect(documented.size).toBe(produced.size);
  });

  it("can describe a shortcut for a tooltip", () => {
    expect(describeShortcut("new_chat")).toBe("Ctrl + Shift + O");
    expect(describeShortcut("stop")).toBe("Esc");
  });
});
