import { toBase64 } from "@/lib/chat/attachments";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Download, FileText, ImageIcon, Search, Trash2, Upload } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Pending } from "@/components/settings/rows";
import {
  addLibraryItem,
  beginLibraryUpload,
  cancelLibraryUpload,
  deleteLibraryItem,
  finishLibraryUpload,
  listLibraryItems,
  signLibraryItem,
  LIBRARY_MAX_BYTES,
  type LibraryItemRow,
} from "@/lib/library/library.functions";
import { cn } from "@/lib/utils";
import { fingerprint, resumable, uploadResumable } from "@/lib/library/resumable-upload";
import { getSupabaseBrowserConfiguration, supabase } from "@/integrations/supabase/client";

/** Files above this go straight to Storage, resumably, instead of through a server function. */
const DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024;

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
  const [notice, setNotice] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [fallback, setFallback] = useState<{ name: string; url: string } | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const client = useQueryClient();

  const items = useQuery<LibraryItemRow[]>({
    queryKey: ["library", "items"],
    queryFn: () => listLibraryItems(),
  });

  const refresh = () => client.invalidateQueries({ queryKey: ["library", "items"] });

  const [progress, setProgress] = useState<{ accepted: number; total: number } | null>(null);
  const transfer = useRef<AbortController | null>(null);

  /** A large file goes straight to Storage, resumably, then is checked (plan 14E.4). */
  async function uploadLarge(file: File) {
    const configuration = getSupabaseBrowserConfiguration();
    const { data: session } = await supabase.auth.getSession();
    if (!configuration.url || !configuration.publishableKey || !session.session)
      throw new Error("Sign in again to add a large file.");
    const endpoint = new URL(`${configuration.url}/storage/v1/upload/resumable`);
    const begun = await beginLibraryUpload({
      data: { size: file.size, resume: resumable(file, endpoint)?.id ?? null },
    });
    const controller = new AbortController();
    transfer.current = controller;
    setNotice("Uploading file…");
    setProgress({ accepted: 0, total: file.size });
    try {
      await uploadResumable({
        file,
        endpoint: endpoint.href,
        apiKey: configuration.publishableKey,
        accessToken: session.session.access_token,
        objectName: begun.objectName,
        id: begun.id,
        signal: controller.signal,
        onProgress: (accepted, total) => setProgress({ accepted, total }),
      });
      controller.signal.throwIfAborted();
      transfer.current = null;
      setProgress(null);
      setNotice("Checking file…");
      return await finishLibraryUpload({
        data: { id: begun.id, name: file.name, mime: file.type || "application/octet-stream" },
      });
    } catch (error) {
      if (!controller.signal.aborted) throw error;
      const result = await cancelLibraryUpload({ data: { id: begun.id } });
      window.localStorage.removeItem(fingerprint(file));
      return result.cancelled ? "cancelled" : "already-added";
    } finally {
      transfer.current = null;
      setProgress(null);
    }
  }

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > LIBRARY_MAX_BYTES) {
        throw new Error("That file is larger than OCADE can keep in your library.");
      }
      if (file.size > DIRECT_UPLOAD_BYTES) return uploadLarge(file);
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
    onSuccess: (item) => {
      setNotice(
        item === "cancelled"
          ? "Upload cancelled."
          : item === "already-added"
            ? "The file was already added."
            : `Added ${item.name} to your library.`,
      );
      if (item !== "cancelled") void refresh();
    },
    onError: (error: Error) => {
      setNotice("");
      setProblem(error.message);
    },
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
      setNotice(pending ? "" : "File deleted.");
      void refresh();
      search.current?.focus();
    },
    onError: (error: Error) => setProblem(error.message),
  });

  /**
   * The tab opens in the click itself (a browser lets only a click open one) and is pointed at
   * the signed link once it exists; a download is a link the browser saves where it is. Either
   * way a link that could not open is offered to press instead of nothing happening.
   */
  async function open(item: LibraryItemRow, download = false) {
    setProblem(null);
    setFallback(null);
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
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Library</h1>
          <button
            type="button"
            onClick={() => picker.current?.click()}
            disabled={upload.isPending}
            className="flex h-11 items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            <Upload className="h-4 w-4" aria-hidden />
            Add
          </button>
          <input
            ref={picker}
            type="file"
            className="hidden"
            aria-label="Add a file to your library"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                setProblem(null);
                setNotice("Preparing file…");
                upload.mutate(file);
              }
            }}
          />
        </div>
        <div
          role="status"
          className={cn(notice && "mt-3 break-words text-sm text-muted-foreground")}
        >
          {notice}
        </div>
        {progress ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <progress
              className="min-w-24 flex-1"
              aria-label="Upload received by Storage"
              max={progress.total}
              value={progress.accepted}
            />
            <button
              type="button"
              onClick={() => {
                transfer.current?.abort();
                setProgress(null);
                setNotice("Stopping upload…");
              }}
              className="h-11 rounded-md px-3 text-sm text-foreground hover:bg-accent"
            >
              Cancel upload
            </button>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div
            className="flex rounded-md border border-border p-0.5"
            role="group"
            aria-label="Filter library"
          >
            {FILTERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={filter === entry.id}
                onClick={() => setFilter(entry.id)}
                className={cn(
                  "h-11 rounded px-3 text-sm transition-colors",
                  filter === entry.id
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <label className="relative min-w-32 flex-1">
            <span className="sr-only">Search your library</span>
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              ref={search}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-11 w-full rounded-md border border-border bg-transparent pl-8 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            />
          </label>
        </div>

        {problem ? (
          <p className="mt-4 text-[0.8125rem] text-foreground" role="alert">
            {problem}
          </p>
        ) : null}
        {fallback ? (
          <p className="mt-4 text-[0.8125rem] text-foreground" role="status">
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
          <p className="mt-10 text-sm text-muted-foreground" role="status">
            {(items.data ?? []).length === 0
              ? "Nothing here yet. Files and images you add, and the ones OCADE produces, appear here."
              : "No matches."}
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-border/50 border-y border-border/50">
            {visible.map((item) => (
              <li key={item.id} className="flex items-center gap-2 py-2 sm:gap-3">
                {item.kind === "image" ? (
                  <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <button
                  type="button"
                  onClick={() => void open(item)}
                  className="min-h-11 min-w-0 flex-1 break-words text-left text-sm text-foreground hover:underline"
                >
                  {item.name}
                </button>
                <span className="shrink-0 text-[0.8125rem] text-muted-foreground">
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

const ROW_ACTION =
  "grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

/** "2.4 MB" — a size somebody can judge, not a byte count. */
function describeSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
