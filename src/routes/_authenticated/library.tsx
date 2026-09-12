import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({ meta: [{ title: "Library — OCADE" }] }),
  component: LibraryPage,
});

type Filter = "all" | "images" | "files";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "images", label: "Images" },
  { id: "files", label: "Files" },
];

export interface LibraryItem {
  id: string;
  name: string;
  kind: "image" | "file";
}

/**
 * Library replaces Artifacts and the scattered upload views.
 *
 * The shape is fixed by `docs/PRD.md`: All | Images | Files, a search box and
 * one content list. Phase 8 connects it to its Supabase table and private
 * storage bucket; the structure lands here with the rest of the routing so
 * that navigation is complete and there is one place for that work to go.
 */
function LibraryPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const items: LibraryItem[] = useMemo(() => [], []);

  const visible = items.filter((item) => {
    if (filter !== "all" && (filter === "images") !== (item.kind === "image")) return false;
    return item.name.toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl px-5 py-8">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Library</h1>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex rounded-md border border-border p-0.5" role="tablist">
            {FILTERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={filter === entry.id}
                onClick={() => setFilter(entry.id)}
                className={cn(
                  "h-7 rounded px-3 text-sm transition-colors",
                  filter === entry.id
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search your library</span>
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-8 w-full rounded-md border border-border bg-transparent pl-8 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            />
          </label>
        </div>

        {visible.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">
            {items.length === 0
              ? "Nothing here yet. Files and images you attach in Chat, and the ones OCADE produces, appear here."
              : "No matches."}
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-border/50 border-y border-border/50">
            {visible.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3 text-sm text-foreground">
                {item.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
