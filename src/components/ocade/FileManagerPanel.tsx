import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  searchFilesFn,
  copyFileFn,
  deleteToTrashFn,
  restoreFromTrashFn,
} from "@/lib/files.functions";
import type { SearchHit, TrashRecord } from "@/lib/files/manager";

/**
 * Production owner for real file management (G1-G4).
 *
 * The operations underneath were proven against the real filesystem — search,
 * read, create, copy, move, rename, reversible delete and restore, with every
 * result verified by re-reading the disk and comparing content hashes. This is
 * the surface that makes them reachable rather than script-only.
 *
 * WHAT IT DELIBERATELY WILL NOT DO
 *
 * There is no permanent delete. Deleting moves the file to a trash folder and
 * hands back a record; restoring puts it back and refuses unless the content
 * hashes match what was recorded. A file cannot be destroyed from here.
 *
 * The approved folder is typed by the user, not inferred, and every operation
 * is confined to it. System locations are refused even if typed in — that check
 * lives in the file layer, not in this component, so it cannot be bypassed by
 * calling the server function another way.
 */
export function FileManagerPanel() {
  const [root, setRoot] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [trashed, setTrashed] = useState<TrashRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const short = (p: string) => p.replace(/\\/g, "/").split("/").slice(-2).join("/");

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      await fn();
    } catch (error) {
      setProblem(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const search = useCallback(
    () =>
      run("Search", async () => {
        const result = await searchFilesFn({ data: { root, match: query } });
        if (!result.ok) {
          setProblem(result.reason);
          setHits(null);
          return;
        }
        setHits(result.hits);
        if (result.truncated) toast.info("Showing the first matches only.");
      }),
    [root, query, run],
  );

  const duplicate = useCallback(
    (path: string) =>
      run("Copy", async () => {
        const result = await copyFileFn({ data: { root, from: path, to: `${path}.copy` } });
        if (!result.ok) setProblem(result.reason);
        else toast.success("Copied, and the copy was verified byte for byte.");
      }),
    [root, run],
  );

  const remove = useCallback(
    (path: string) =>
      run("Delete", async () => {
        const result = await deleteToTrashFn({
          data: { root, trashDir: `${root}/.ocade-trash`, target: path },
        });
        if (!result.ok) {
          setProblem(result.reason);
          return;
        }
        setTrashed((t) => [...t, result.record]);
        setHits((h) => h?.filter((x) => x.path !== path) ?? null);
        toast.success("Moved to trash. You can put it back.");
      }),
    [root, run],
  );

  const restore = useCallback(
    (record: TrashRecord) =>
      run("Restore", async () => {
        const result = await restoreFromTrashFn({ data: { root, record } });
        if (!result.ok) {
          setProblem(result.reason);
          return;
        }
        setTrashed((t) => t.filter((r) => r.id !== record.id));
        toast.success("Restored, and the contents match exactly.");
      }),
    [root, run],
  );

  return (
    <section className="mt-5 rounded-lg border border-border p-4" aria-labelledby="files-heading">
      <h3 id="files-heading" className="text-sm font-medium">
        Files
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Works only inside a folder you name here. System folders are refused even if you type one,
        and deleting always moves to a recoverable trash folder rather than destroying anything.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="files-root">
          Approved folder
        </label>
        <input
          id="files-root"
          className="min-w-64 flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
          placeholder="Folder to work in, e.g. C:\Users\you\Documents\project"
          value={root}
          onChange={(e) => setRoot(e.target.value)}
        />
        <label className="sr-only" htmlFor="files-query">
          Search for
        </label>
        <input
          id="files-query"
          className="w-40 rounded border border-border bg-background px-2 py-1 text-xs"
          placeholder="name contains…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
          onClick={() => void search()}
          disabled={busy || root.trim() === "" || query.trim() === ""}
        >
          {busy ? "Working…" : "Search"}
        </button>
      </div>

      {problem && (
        <p className="mt-3 text-xs text-destructive" role="alert">
          {problem}
        </p>
      )}

      {hits && hits.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">Nothing matched in that folder.</p>
      )}

      {hits && hits.length > 0 && (
        <ul className="mt-3 space-y-1">
          {hits.map((hit) => (
            <li key={hit.path} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate" title={hit.path}>
                {short(hit.path)}
              </span>
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className="rounded border border-border px-2 py-0.5 disabled:opacity-50"
                  onClick={() => void duplicate(hit.path)}
                  disabled={busy}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="rounded border border-border px-2 py-0.5 disabled:opacity-50"
                  onClick={() => void remove(hit.path)}
                  disabled={busy}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {trashed.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium">Recently deleted — recoverable</h4>
          <ul className="mt-2 space-y-1">
            {trashed.map((record) => (
              <li key={record.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate" title={record.originalPath}>
                  {short(record.originalPath)}
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded border border-border px-2 py-0.5 disabled:opacity-50"
                  onClick={() => void restore(record)}
                  disabled={busy}
                >
                  Put back
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
