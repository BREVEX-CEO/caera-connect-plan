/**
 * Keyboard shortcuts for the chat screen.
 *
 * WHY THIS IS A PURE MATCHER AND NOT A PILE OF `onKeyDown`. A shortcut table
 * has exactly two ways to be wrong, and both are invisible until someone loses
 * work: it can fire while the user is typing a message, and it can steal a
 * combination the browser or the operating system already owns. Both are
 * properties of the KEY EVENT, so they are decided here, once, where they can
 * be tested — rather than in a listener that can only be exercised by hand.
 *
 * WHAT IS DELIBERATELY NOT BOUND. Ctrl+N, Ctrl+T, Ctrl+W, Ctrl+Shift+N and
 * Ctrl+L are browser or window-manager shortcuts. A web page that captures
 * them either fails silently or, worse, succeeds and takes away something the
 * user relies on everywhere else. New chat is Ctrl+Shift+O for that reason,
 * not because it is more memorable.
 */

export type ChatShortcutAction =
  "new_chat" | "focus_composer" | "search" | "toggle_sidebar" | "stop" | "show_help";

/** The fields of a KeyboardEvent this needs, so it can be tested without a DOM. */
export interface KeyEventLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  /** Where the keystroke landed. */
  target?: { tagName?: string; isContentEditable?: boolean } | null;
}

export interface ShortcutHelpEntry {
  action: ChatShortcutAction;
  /** Rendered as separate keycaps. */
  keys: string[];
  description: string;
}

/**
 * Shown in the help sheet, and the single source of truth for what exists.
 *
 * If a shortcut is added to the matcher and not to this list it is invisible,
 * which for a keyboard shortcut is the same as not existing.
 */
export const CHAT_SHORTCUTS: ShortcutHelpEntry[] = [
  { action: "new_chat", keys: ["Ctrl", "Shift", "O"], description: "Start a new chat" },
  { action: "search", keys: ["Ctrl", "K"], description: "Search your chats" },
  {
    action: "focus_composer",
    keys: ["Ctrl", "Shift", "L"],
    description: "Jump to the message box",
  },
  { action: "toggle_sidebar", keys: ["Ctrl", "Shift", "S"], description: "Show or hide history" },
  { action: "stop", keys: ["Esc"], description: "Stop the reply that is generating" },
  { action: "show_help", keys: ["Ctrl", "/"], description: "Show these shortcuts" },
];

/** Is the keystroke landing in something the user is writing in? */
export function isTypingTarget(target: KeyEventLike["target"]): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Decide what a keystroke means, or nothing at all.
 *
 * `Escape` is the one shortcut that works WHILE TYPING, and it has to: the
 * stop control exists for a reply that is going wrong, and the moment someone
 * wants to stop a reply is exactly the moment their cursor is already back in
 * the message box drafting the correction.
 */
export function matchChatShortcut(event: KeyEventLike): ChatShortcutAction | null {
  const mod = event.ctrlKey === true || event.metaKey === true;
  const key = event.key;

  if (key === "Escape") return "stop";

  // Everything else needs a modifier. Bare letters are text, always — binding
  // "n" to new chat would eat the letter out of every message containing it.
  if (!mod) return null;
  // Alt combinations belong to the operating system's menu system on Windows
  // and Linux; taking them produces shortcuts that work on one platform.
  if (event.altKey === true) return null;

  const lower = key.toLowerCase();
  if (event.shiftKey === true) {
    if (lower === "o") return "new_chat";
    if (lower === "l") return "focus_composer";
    if (lower === "s") return "toggle_sidebar";
    return null;
  }

  if (lower === "k") return "search";
  if (key === "/" || key === "?") return "show_help";
  return null;
}

/** Format one entry for a tooltip or a screen-reader description. */
export function describeShortcut(action: ChatShortcutAction): string | null {
  const entry = CHAT_SHORTCUTS.find((candidate) => candidate.action === action);
  return entry ? entry.keys.join(" + ") : null;
}
