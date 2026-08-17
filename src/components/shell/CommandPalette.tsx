import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * Cmd/Ctrl+K navigation.
 *
 * EVERY DESTINATION IS A ROUTE THAT EXISTS. The obvious way to write this list
 * is to type out the product's ambitions — Inbox, Search, Lab, Permissions —
 * and let the palette 404 on the ones not built yet. A palette is the fastest
 * surface in the product; making it the fastest way to reach a broken page is
 * worse than leaving an entry out. Entries are added here when their route file
 * is added, not before.
 *
 * ACCESSIBILITY. It is a modal dialog containing a combobox over a listbox:
 * focus moves to the input on open, arrows move the active option, Enter
 * navigates, Escape closes and returns focus to whatever opened it. The active
 * option is announced through `aria-activedescendant` rather than by moving
 * focus, so the typed query is never interrupted.
 */

export interface CommandEntry {
  to: string;
  label: string;
  group: string;
  /** Extra words the query should match, e.g. an old name for the page. */
  keywords?: string;
}

export const COMMAND_ENTRIES: CommandEntry[] = [
  { to: "/ocade", label: "Chat", group: "OCADE", keywords: "conversation ask ocade" },
  { to: "/ocade/projects", label: "Projects", group: "OCADE", keywords: "folders workspaces" },
  {
    to: "/ocade/work",
    label: "Control + Work",
    group: "OCADE",
    keywords: "pc control computer automation agent",
  },
  { to: "/ocade/code", label: "Code", group: "OCADE", keywords: "terminal shell repository" },
  { to: "/ocade/automations", label: "Automations", group: "Tools", keywords: "schedule recurring" },
  { to: "/ocade/artifacts", label: "Files & artifacts", group: "Tools", keywords: "files outputs downloads" },
  { to: "/ocade/tasks", label: "Tasks", group: "Tools", keywords: "runs queue pause stop" },
  { to: "/ocade/monitors", label: "Monitors", group: "Tools", keywords: "watch alerts" },
  { to: "/ocade/studio", label: "Studio", group: "Tools", keywords: "images creative madee" },
  { to: "/ocade/models", label: "Local intelligence", group: "System", keywords: "models engines providers" },
  { to: "/ocade/health", label: "Health", group: "System", keywords: "status capabilities diagnostics" },
  { to: "/settings/devices", label: "Devices", group: "System", keywords: "approved devices revoke" },
  { to: "/settings/browser", label: "Browser control", group: "System", keywords: "connectors bridge" },
  { to: "/settings/activity", label: "Activity", group: "System", keywords: "logs audit history" },
  { to: "/settings/privacy", label: "Privacy", group: "System", keywords: "storage mode permissions" },
  { to: "/settings/security", label: "Security", group: "System", keywords: "sessions password" },
  { to: "/settings", label: "Settings", group: "System", keywords: "preferences" },
];

export function filterCommands(entries: CommandEntry[], query: string): CommandEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) =>
    `${e.label} ${e.group} ${e.keywords ?? ""} ${e.to}`.toLowerCase().includes(q),
  );
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const results = useMemo(() => filterCommands(COMMAND_ENTRIES, query), [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!open) return null;

  const go = (entry: CommandEntry | undefined) => {
    if (!entry) return;
    onClose();
    void navigate({ to: entry.to });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border/60 bg-popover shadow-2xl"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (results.length ? (i + 1) % results.length : 0));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            go(results[active]);
          }
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-list"
          aria-autocomplete="list"
          aria-activedescendant={results[active] ? `command-option-${active}` : undefined}
          placeholder="Go to…"
          aria-label="Search pages"
          className="w-full border-b border-border/60 bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <ul
          id="command-palette-list"
          ref={listRef}
          role="listbox"
          aria-label="Pages"
          className="max-h-[50vh] overflow-y-auto py-1"
        >
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nothing here matches “{query}”.
            </li>
          ) : (
            results.map((entry, i) => (
              <li
                key={entry.to}
                id={`command-option-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(entry);
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm",
                  i === active ? "bg-accent text-foreground" : "text-muted-foreground",
                )}
              >
                <span>{entry.label}</span>
                <span className="text-[11px] uppercase tracking-wide opacity-60">
                  {entry.group}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
