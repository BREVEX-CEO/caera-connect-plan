import { useEffect, useRef, useState } from "react";
import { Archive, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { OcadeConversationRow } from "@/lib/ocade.functions";
import { cn } from "@/lib/utils";

/**
 * Recent conversations, in the shell's sidebar and nowhere else.
 *
 * The product had this list in three places at once — a rail, a contextual
 * sidebar and a search dashboard — each with its own idea of which
 * conversation was open. There is one list, the shell renders it, and Chat
 * owns the state behind it.
 *
 * ACTIONS ARE ON HOVER AND IN A MENU, not on every row all the time. A rename,
 * an archive and a delete button beside each of forty rows is a wall of
 * controls for something somebody does occasionally.
 */
export function ConversationList({
  conversations,
  activeId,
  loading,
  failed,
  onRetry,
  onOpen,
  onRename,
  onArchive,
  onTrash,
}: {
  conversations: OcadeConversationRow[];
  activeId: string | null;
  loading: boolean;
  /** The read failed. Silence here reads as "you have no chats", which is a lie. */
  failed: boolean;
  onRetry: () => void;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => Promise<void> | void;
  onArchive: (id: string) => Promise<void> | void;
  onTrash: (id: string) => Promise<void> | void;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  /** The open menu, so a pointer inside it is not treated as a pointer outside. */
  const menu = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const visible = conversations.filter((row) => !row.archived && !row.deleted_at);

  /*
   * CLOSE ON A POINTER OUTSIDE THE MENU, DECIDED BY WHERE IT LANDED.
   *
   * This used to close on any `pointerdown` and rely on `stopPropagation` in
   * the menu's own React handler to exempt itself. That does not work:
   * React attaches its listeners to the root container, so when the root and
   * this listener are on the same node, `stopPropagation` does not stop a
   * sibling listener there — only `stopImmediatePropagation` would. The menu
   * closed on the way down and the click that followed landed on nothing, so
   * Rename, Archive and Delete all silently did nothing. Found in a browser.
   */
  useEffect(() => {
    if (!menuFor) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setMenuFor(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuFor]);

  if (loading && visible.length === 0) {
    return (
      <p className="px-2.5 py-2 text-[13px] text-muted-foreground" role="status">
        Loading chats…
      </p>
    );
  }

  if (failed && visible.length === 0) {
    return (
      <div className="px-2.5 py-2" role="alert">
        <p className="text-[13px] text-muted-foreground">Your chats could not be loaded.</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 text-[13px] text-foreground underline underline-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  if (visible.length === 0) return null;

  return (
    <>
      <p className="px-2.5 pb-1 pt-3 text-[13px] text-muted-foreground">Recent</p>
      <ul>
        {visible.map((row) => (
          <li key={row.id} className="group relative">
            {renaming === row.id ? (
              <RenameField
                value={draft}
                onChange={setDraft}
                onCommit={async () => {
                  setRenaming(null);
                  await onRename(row.id, draft);
                }}
                onCancel={() => setRenaming(null)}
              />
            ) : (
              <button
                type="button"
                onClick={() => onOpen(row.id)}
                aria-current={activeId === row.id ? "true" : undefined}
                className={cn(
                  "flex h-9 w-full items-center rounded-lg pl-2.5 pr-8 text-left text-[14px] transition-colors",
                  activeId === row.id
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <span className="truncate">{row.title}</span>
              </button>
            )}

            <button
              type="button"
              aria-label={`More options for ${row.title}`}
              // The toggle runs on pointerdown for the same reason: by the time
              // a click would fire, the outside-pointer listener has already
              // decided this pointer was outside the menu that is about to open.
              onPointerDown={(event) => {
                event.preventDefault();
                setMenuFor((current) => (current === row.id ? null : row.id));
              }}
              className="absolute right-1 top-1.5 grid h-6 w-6 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </button>

            {menuFor === row.id ? (
              <div
                ref={menu}
                role="menu"
                className="glass-strong absolute right-1 top-8 z-10 w-40 overflow-hidden rounded-lg p-1"
              >
                <MenuItem
                  icon={Pencil}
                  label="Rename"
                  onSelect={() => {
                    setMenuFor(null);
                    setDraft(row.title);
                    setRenaming(row.id);
                  }}
                />
                <MenuItem
                  icon={Archive}
                  label="Archive"
                  onSelect={() => {
                    setMenuFor(null);
                    void onArchive(row.id);
                  }}
                />
                <MenuItem
                  icon={Trash2}
                  label="Delete"
                  onSelect={() => {
                    setMenuFor(null);
                    void onTrash(row.id);
                  }}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onSelect,
}: {
  icon: typeof Pencil;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-accent"
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      {label}
    </button>
  );
}

function RenameField({
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string;
  onChange: (next: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  /*
   * COMMIT ON BLUR, BUT NOT BEFORE THE FIELD HAS THE FOCUS.
   *
   * Choosing Rename unmounts the menu, and removing the focused menu item
   * moves focus to the body — which arrived as a blur on a field that had only
   * just appeared. The rename committed the unchanged title and closed itself
   * in the same frame, so the field flashed and nothing could be typed. Found
   * in a browser; no render test blurs anything.
   *
   * Focus is taken on the next frame, after that reshuffle has happened, and a
   * blur before then is ignored rather than treated as somebody finishing.
   */
  const focused = useRef(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.select();
      focused.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <input
      ref={input}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => {
        if (focused.current) onCommit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") onCommit();
        if (event.key === "Escape") onCancel();
      }}
      aria-label="Conversation name"
      className="h-9 w-full rounded-lg border border-border bg-transparent px-2.5 text-[14px] text-foreground outline-none focus-visible:border-ring"
    />
  );
}
