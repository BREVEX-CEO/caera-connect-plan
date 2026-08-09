import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, MessageSquarePlus, ImagePlus, Paperclip, Link2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one `+` in the composer.
 *
 * WHAT IT REPLACED. Two bare icon buttons — a paperclip and a picture — sitting
 * next to the engine badge. Adding a link and starting a new chat had nowhere
 * to live, so they were somewhere else entirely, and the composer's own row of
 * controls grew every time a capability arrived.
 *
 * IT OPENS UPWARD. The composer is at the bottom of the screen and the menu is
 * anchored above the button, so it never covers the text the person is part-way
 * through writing. That is the whole reason a `+` menu in a chat feels wrong
 * when it is done the other way round.
 *
 * KEYBOARD AND FOCUS. Escape closes and returns focus to the trigger, arrow
 * keys move through the items, and a click outside dismisses. A menu that traps
 * focus or forgets where it came from is worse than four buttons in a row.
 */

export interface ComposerMenuAction {
  id: string;
  label: string;
  hint: string;
  icon: typeof Plus;
  onSelect: () => void;
  /** Present when the action cannot run. Shown instead of the hint. */
  disabledReason?: string | null;
  /**
   * This action needs an account.
   *
   * NOT THE SAME AS DISABLED, and the difference is the whole point. A greyed
   * item tells someone they cannot do a thing and leaves them to guess why; the
   * three upload actions were exactly that for every demo visitor. A gated item
   * stays pressable and answers the question — "Sign in to upload files", with
   * the button that does it. The dead control becomes a signpost.
   */
  requiresSignIn?: boolean;
}

export function ComposerMenu({
  onNewChat,
  onUploadImage,
  onUploadFile,
  onAddLink,
  imageDisabledReason,
  signedIn = true,
  className,
}: {
  onNewChat?: () => void;
  onUploadImage?: () => void;
  onUploadFile?: () => void;
  onAddLink?: () => void;
  imageDisabledReason?: string | null;
  /**
   * False on the demo. Text chat stays fully usable; only the actions that put
   * a file somewhere durable ask for an account.
   */
  signedIn?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  /** The label of a gated action the user pressed, or null for the menu. */
  const [gated, setGated] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const actions: ComposerMenuAction[] = [
    onNewChat && {
      id: "new-chat",
      label: "New chat",
      hint: "Start a fresh conversation",
      icon: MessageSquarePlus,
      onSelect: onNewChat,
    },
    onUploadImage && {
      id: "image",
      label: "Upload image",
      hint: "OCADE reads it on this device",
      icon: ImagePlus,
      onSelect: onUploadImage,
      // A capability limit still disables; only the ACCOUNT gate redirects.
      disabledReason: signedIn ? (imageDisabledReason ?? null) : null,
      requiresSignIn: !signedIn,
    },
    onUploadFile && {
      id: "file",
      label: "Upload file",
      hint: "Text, Markdown, CSV, JSON, code, PDF, DOCX",
      icon: Paperclip,
      onSelect: onUploadFile,
      requiresSignIn: !signedIn,
    },
    onAddLink && {
      id: "link",
      label: "Add link",
      hint: "Needs a connection the first time",
      icon: Link2,
      onSelect: onAddLink,
      requiresSignIn: !signedIn,
    },
  ].filter(Boolean) as ComposerMenuAction[];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        // Returning focus is not optional: without it the next Tab starts from
        // the top of the document.
        triggerRef.current?.focus();
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Move focus into the menu when it opens, so a keyboard user is not left
  // pressing Tab through the whole composer to reach it.
  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])");
    first?.focus();
  }, [open]);

  if (actions.length === 0) return null;

  function moveFocus(from: HTMLElement, delta: 1 | -1) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [],
    );
    const index = items.indexOf(from as HTMLButtonElement);
    if (index === -1) return;
    const next = items[(index + delta + items.length) % items.length];
    next?.focus();
  }

  return (
    <div className={cn("contents", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Add to this conversation"
        title="Add to this conversation"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition",
          "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-accent text-foreground",
        )}
      >
        <Plus
          className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-45")}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Add to this conversation"
          /*
           * ANCHORED TO THE COMPOSER CARD, NOT TO THE BUTTON.
           *
           * The + sits in the control row BELOW the text area, so a menu
           * anchored to the button with `bottom-full` still opened across the
           * message being written — measured at 50px of overlap. The wrapper is
           * `contents`, so this positions against the composer's own
           * `relative` card and `bottom-full` clears the whole thing.
           */
          className={cn(
            "absolute bottom-full left-0 z-50 mb-2 w-64 origin-bottom-left overflow-hidden rounded-xl",
            "border border-border/70 bg-popover/95 p-1 shadow-xl backdrop-blur",
            "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:slide-in-from-bottom-1",
          )}
        >
          {gated ? (
            /*
              The answer to a gated press, in place, without closing the menu or
              navigating away from a half-written message.
            */
            <div className="p-2.5">
              <p className="text-[13px] font-medium text-foreground">Sign in to {gated}</p>
              <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
                Text chat stays open for the whole demo.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Link
                  to="/auth"
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Sign in
                </Link>
                <button
                  type="button"
                  onClick={() => setGated(null)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowLeft className="h-3 w-3" aria-hidden />
                  Back
                </button>
              </div>
            </div>
          ) : null}

          {!gated &&
            actions.map((action) => {
              const Icon = action.icon;
              const disabled = Boolean(action.disabledReason);
              return (
                <button
                  key={action.id}
                  type="button"
                  role="menuitem"
                  disabled={disabled}
                  title={action.disabledReason ?? undefined}
                  onClick={() => {
                    if (action.requiresSignIn) {
                      // Stays open and swaps to the prompt: pressing an upload
                      // action must answer, not silently do nothing.
                      setGated(action.label.toLowerCase());
                      return;
                    }
                    setOpen(false);
                    action.onSelect();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      moveFocus(event.currentTarget, 1);
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      moveFocus(event.currentTarget, -1);
                    }
                  }}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    disabled
                      ? "cursor-not-allowed opacity-55"
                      : "hover:bg-accent focus-visible:bg-accent",
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-foreground">
                      {action.label}
                    </span>
                    <span className="block text-[11.5px] leading-snug text-muted-foreground">
                      {action.disabledReason ??
                        (action.requiresSignIn ? "Needs an account" : action.hint)}
                    </span>
                  </span>
                </button>
              );
            })}
        </div>
      ) : null}
    </div>
  );
}
