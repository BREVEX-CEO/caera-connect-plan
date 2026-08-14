/**
 * Product-surface polish for the packaged desktop shell.
 *
 * WHAT THIS IS, STATED PLAINLY: it is not a security boundary. Anyone who wants
 * the running code can attach a debugger to a local process, and no key handler
 * in a webview changes that. What stops binary tampering is code signing; what
 * stops a hostile page reaching the engine is the CSP and the origin lock; what
 * stops an injected command running is the allow-list. Those are the boundaries.
 *
 * What this stops is the accidental and the casual: an Inspect Element in a
 * right-click menu that hands a customer the internals of a product they bought,
 * and a stray Ctrl+R that reloads the shell into a state the native host is not
 * expecting mid-task. That is worth having, and it is worth not mistaking for
 * armour.
 *
 * DESKTOP ONLY, AND DELIBERATELY.
 * -------------------------------
 * The same code shipped to the website would be user-hostile and pointless.
 * Pointless because the page source is already served to the browser and
 * "view source" is one menu away regardless; hostile because right-click on the
 * web is how people copy text, open links in new tabs, use a spell-checker, and
 * drive a screen reader's context actions. Breaking all of that to inconvenience
 * somebody who can press Ctrl+U anyway is a bad trade. So it is gated on the
 * Tauri shell being present, and the web app is left alone.
 *
 * TEXT SELECTION AND COPY ARE NOT TOUCHED, on the desktop either. A person must
 * be able to copy an answer OCADE gave them; a product that fights its own user
 * over their clipboard has confused them with an attacker.
 */

/** True only inside the packaged Tauri shell. */
export function inDesktopShell(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in (window as Window & { __TAURI_INTERNALS__?: unknown })
  );
}

/** Keystrokes that open developer tooling or reload the shell. */
export function isDeveloperShortcut(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): boolean {
  const key = (event.key || "").toLowerCase();
  const mod = event.ctrlKey || event.metaKey;

  // F12 on its own.
  if (key === "f12") return true;
  // Ctrl/Cmd+Shift+I / J / C — inspector, console, element picker.
  if (mod && event.shiftKey && ["i", "j", "c"].includes(key)) return true;
  // Ctrl/Cmd+R reloads; Ctrl/Cmd+U shows source.
  if (mod && !event.shiftKey && ["r", "u"].includes(key)) return true;

  return false;
}

/**
 * Install the handlers. Returns a function that removes them again.
 *
 * A no-op outside the desktop shell, so calling it unconditionally from the app
 * root is safe — the web build installs nothing.
 */
export function hardenDesktopShell(target: Window | null = typeof window !== "undefined" ? window : null): () => void {
  if (!target || !inDesktopShell()) return () => {};

  const onContextMenu = (event: Event) => event.preventDefault();
  const onKeyDown = (event: KeyboardEvent) => {
    if (isDeveloperShortcut(event)) event.preventDefault();
  };

  target.addEventListener("contextmenu", onContextMenu);
  target.addEventListener("keydown", onKeyDown);

  return () => {
    target.removeEventListener("contextmenu", onContextMenu);
    target.removeEventListener("keydown", onKeyDown);
  };
}
