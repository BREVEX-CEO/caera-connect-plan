import { toBase64 } from "@/lib/chat/attachments";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Download, FileText, ImageIcon, Search, Trash2, Upload } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Pending } from "@/components/settings/rows";
import {
  addLibraryItem,
  deleteLibraryItem,
  listLibraryItems,
  signLibraryItem,
  LIBRARY_MAX_BYTES,
  type LibraryItemRow,
} from "@/lib/library/library.functions";
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

/**
 * LIBRARY: EVERYTHING A PERSON KEEPS, IN ONE PLACE.
 *
 * `docs/PRD.md` fixes the shape — All | Images | Files, a search box, one list —
 * and this is the first version with anything behind it. It replaces Artifacts,
 * the project file views and the scattered upload panes.
 *
 * WHAT IS DELIBERATELY NOT HERE. No provenance column, no version history, no
 * lineage, no verification badge: `PLAN.md` Phase 8 says to keep technical
 * provenance out of the default UI, and the answer to "where did this come
 * from" is the name and the date for almost everybody who asks.
 *
 * SEARCH FILTERS WHAT IS LOADED rather than asking the server again. A library
 * is tens of items; a round trip per keystroke would be slower and would tell
 * the server what somebody is looking for.
 */
function LibraryPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [fallback, setFallback] = useState<{ name: string; url: string } | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const client = useQueryClient();

  const items = useQuery<LibraryItemRow[]>({
    queryKey: ["library", "items"],
    queryFn: () => listLibraryItems(),
  });

  const refresh = () => client.invalidateQueries({ queryKey: ["library", "items"] });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > LIBRARY_MAX_BYTES) {
        throw new Error("That file is larger than OCADE can keep in your library.");
      }
      return addLibraryItem({
        data: {
          name: file.name,
          mime: file.type || "application/octet-stream",
          kind: file.type.startsWith("image/") ? "image" : "file",
          source: "upload",
          contentBase64: await toBase64(file),
        },
      });
    },
    onSuccess: () => {
      setProblem(null);
      void refresh();
    },
    onError: (error: Error) => setProblem(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteLibraryItem({ data: { id } }),
    onSuccess: ({ pending }) => {
      // Gone from the list is not the same as erased: say which, never just "done".
      setProblem(
        pending
          ? "Removed from your library. Its file is still being erased and will be retried."
          : null,
      );
      void refresh();
    },
    onError: (error: Error) => setProblem(error.message),
  });

  /**
   * The tab opens in the click itself (a browser lets only a click open one) and is pointed at
   * the signed link once it exists; a download is a link the browser saves where it is. Either
   * way a link that could not open is offered to press instead of nothing happening.
   */
  async function open(item: LibraryItemRow, download = false) {
    const tab = download ? null : window.open("", "_blank");
    if (tab) tab.opener = null;
    try {
      const { url } = await signLibraryItem({ data: { id: item.id, download } });
      if (download) {
        const link = document.createElement("a");
        link.href = url;
        link.rel = "noopener noreferrer";
        link.click();
      } else if (tab) {
        tab.location.href = url;
      } else {
        setFallback({ name: item.name, url });
      }
    } catch (error) {
      tab?.close();
      setProblem(error instanceof Error ? error.message : "That could not be opened.");
    }
  }

  const visible = (items.data ?? []).filter((item) => {
    if (filter !== "all" && (filter === "images") !== (item.kind === "image")) return false;
    return item.name.toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Library</h1>
          <button
            type="button"
            onClick={() => picker.current?.click()}
            disabled={upload.isPending}
            className="flex h-8 items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            <Upload className="h-4 w-4" aria-hidden />
            {upload.isPending ? "Adding…" : "Add"}
          </button>
          <input
            ref={picker}
            type="file"
            className="hidden"
            aria-label="Add a file to your library"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) upload.mutate(file);
            }}
          />
        </div>

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

        {problem ? (
          <p className="mt-4 text-[13px] text-foreground" role="alert">
            {problem}
          </p>
        ) : null}
        {fallback ? (
          <p className="mt-4 text-[13px] text-foreground" role="status">
            Your browser kept a new tab from opening.{" "}
            <a
              href={fallback.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setFallback(null)}
              className="underline underline-offset-2"
            >
              Open {fallback.name}
            </a>{" "}
            (this link works for a minute).
          </p>
        ) : null}

        {/*
          A FAILED READ IS NOT AN EMPTY LIBRARY. "Nothing here yet" was shown
          both when the account genuinely had nothing and when the read failed,
          so somebody whose files were unreachable was told they had none.
        */}
        {items.isPending || items.isError ? (
          <div className="mt-6">
            <Pending
              query={items}
              loading="Opening your library…"
              problem="Your library could not be opened just now."
            />
          </div>
        ) : visible.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">
            {(items.data ?? []).length === 0
              ? "Nothing here yet. Files and images you add, and the ones OCADE produces, appear here."
              : "No matches."}
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-border/50 border-y border-border/50">
            {visible.map((item) => (
              <li key={item.id} className="group flex items-center gap-3 py-3">
                {item.kind === "image" ? (
                  <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <button
                  type="button"
                  onClick={() => void open(item)}
                  className="min-w-0 flex-1 truncate text-left text-sm text-foreground hover:underline"
                >
                  {item.name}
                </button>
                <span className="shrink-0 text-[13px] text-muted-foreground">
                  {describeSize(item.size_bytes)}
                </span>
                <button
                  type="button"
                  aria-label={`Download ${item.name}`}
                  onClick={() => void open(item, true)}
                  className={ROW_ACTION}
                >
                  <Download className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${item.name}`}
                  onClick={() => {
                    // Deletion removes the stored file too and cannot be undone.
                    if (window.confirm(`Delete ${item.name}? This cannot be undone.`)) {
                      remove.mutate(item.id);
                    }
                  }}
                  className={ROW_ACTION}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

/** Always visible on touch screens (there is no hover there); revealed on hover or focus elsewhere. */
const ROW_ACTION =
  "grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 [@media(hover:hover)]:h-7 [@media(hover:hover)]:w-7 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100";

/** "2.4 MB" — a size somebody can judge, not a byte count. */
function describeSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
