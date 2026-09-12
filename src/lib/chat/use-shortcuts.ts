import { useEffect } from "react";

/**
 * THE TWO KEYBOARD SHORTCUTS THE PRODUCT ACTUALLY HAS.
 *
 * `PLAN.md` Phase 11 asks for keyboard shortcuts as useful polish, and the
 * emphasis is on useful: a product with four destinations does not need a
 * command palette, and a shortcut nobody can discover is a key that surprises
 * somebody once.
 *
 *   `/`                    put the cursor in the composer.
 *   Ctrl/Cmd + Shift + O   start a new chat.
 *
 * Both are listed in Help, which is the only place a person would look.
 *
 * TYPING ALWAYS WINS. A bare `/` is a character, and stealing it from somebody
 * writing a path or a fraction is worse than not having the shortcut — so it is
 * ignored whenever the focus is already in a field, and `preventDefault` stops
 * the slash itself from being typed into the composer it just opened.
 *
 * The modified one is checked for Ctrl OR Meta, because the same person uses
 * both depending on the machine, and for `code` rather than `key`: with Shift
 * held, `key` is "O" on one layout and something else on another, while
 * `code` is the physical key in every case.
 */
export function useChatShortcuts(input: {
  composer: () => HTMLTextAreaElement | null;
  onNewChat: () => void;
}): void {
  const { composer, onNewChat } = input;

  useEffect(() => {
    const typing = (target: EventTarget | null): boolean => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      const tag = element.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable;
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === "KeyO") {
        event.preventDefault();
        onNewChat();
        composer()?.focus();
        return;
      }

      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (typing(event.target)) return;
        const field = composer();
        if (!field) return;
        event.preventDefault();
        field.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [composer, onNewChat]);
}
