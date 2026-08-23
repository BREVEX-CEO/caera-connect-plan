import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export interface CommandEntry {
  to: string;
  label: string;
  group: "Primary" | "Tools" | "System";
  keywords?: string;
}

/** Every destination below has a route file. */
export const COMMAND_ENTRIES: CommandEntry[] = [
  { to: "/ocade", label: "Chat", group: "Primary", keywords: "conversation ask" },
  { to: "/ocade/projects", label: "Projects", group: "Primary", keywords: "folders workspace" },
  {
    to: "/ocade/work",
    label: "Control + Work",
    group: "Primary",
    keywords: "pc computer control agent",
  },
  { to: "/ocade/code", label: "Code", group: "Primary", keywords: "terminal shell repository" },
  {
    to: "/ocade/automations",
    label: "Automations",
    group: "Tools",
    keywords: "schedule recurring",
  },
  {
    to: "/ocade/artifacts",
    label: "Files & artifacts",
    group: "Tools",
    keywords: "outputs exports files",
  },
  { to: "/ocade/tasks", label: "Tasks", group: "Tools", keywords: "runs queue pause stop" },
  {
    to: "/ocade/inbox",
    label: "Inbox",
    group: "Tools",
    keywords: "approvals outcomes notifications",
  },
  {
    to: "/ocade/search",
    label: "Search",
    group: "Tools",
    keywords: "messages projects outputs universal",
  },
  { to: "/ocade/monitors", label: "Monitors", group: "Tools", keywords: "watch alerts sources" },
  {
    to: "/ocade/studio",
    label: "Studio",
    group: "Tools",
    keywords: "creative documents reports apps",
  },
  {
    to: "/ocade/models",
    label: "Models",
    group: "System",
    keywords: "local intelligence engines providers",
  },
  {
    to: "/ocade/devices",
    label: "Devices",
    group: "System",
    keywords: "approved revoke machine phone",
  },
  {
    to: "/ocade/connectors",
    label: "Connectors",
    group: "System",
    keywords: "browser cloud sync integrations",
  },
  {
    to: "/ocade/permissions",
    label: "Permissions",
    group: "System",
    keywords: "approval privacy access",
  },
  { to: "/ocade/activity", label: "Activity", group: "System", keywords: "logs audit history" },
  {
    to: "/ocade/health",
    label: "Health",
    group: "System",
    keywords: "status capability diagnostics",
  },
  {
    to: "/ocade/lab",
    label: "Lab",
    group: "System",
    keywords: "engineering diagnostics research sandbox",
  },
  { to: "/settings", label: "Settings", group: "System", keywords: "preferences account" },
];

export function filterCommands(entries: CommandEntry[], query: string): CommandEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((entry) =>
    `${entry.label} ${entry.group} ${entry.keywords ?? ""} ${entry.to}`.toLowerCase().includes(q),
  );
}

function tabbables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((node) => !node.hasAttribute("hidden") && node.getAttribute("aria-hidden") !== "true");
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const results = useMemo(() => filterCommands(COMMAND_ENTRIES, query), [query]);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setActive(0);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(id);
      requestAnimationFrame(() => returnFocusRef.current?.focus());
    };
  }, [open]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  const go = (entry: CommandEntry | undefined) => {
    if (!entry) return;
    onClose();
    void navigate({ to: entry.to });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border/60 bg-popover shadow-2xl"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => (results.length ? (index + 1) % results.length : 0));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) =>
              results.length ? (index - 1 + results.length) % results.length : 0,
            );
          } else if (event.key === "Enter") {
            event.preventDefault();
            go(results[active]);
          } else if (event.key === "Tab") {
            const nodes = tabbables(dialogRef.current);
            if (!nodes.length) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
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
          role="listbox"
          aria-label="Pages"
          className="max-h-[50vh] overflow-y-auto py-1"
        >
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nothing here matches “{query}”.
            </li>
          ) : (
            results.map((entry, index) => (
              <li
                key={entry.to}
                id={`command-option-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  go(entry);
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm",
                  index === active ? "bg-accent text-foreground" : "text-muted-foreground",
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
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-[10px] text-muted-foreground">
          <span>↑ ↓ navigate · Enter open · Esc close</span>
          <span>Ctrl/⌘ K</span>
        </div>
      </div>
    </div>
  );
}
