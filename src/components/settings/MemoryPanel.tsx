import { useEffect, useState } from "react";
import { Brain, Loader2, Trash2, Pin, PinOff, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import {
  getMemoryEnabled,
  setMemoryEnabled,
  listMemory,
  addMemory,
  updateMemory,
  deleteMemory,
  clearAllMemory,
  purgeExpiredMemory,
  type OcadeProject,
  type OcadeMemoryRow,
} from "@/lib/ocade-projects.functions";
import { listLocalProjects } from "@/lib/projects/local-projects";
import { useSession } from "@/lib/session";
import {
  addLocalMemory,
  clearLocalMemory,
  deleteLocalMemory,
  inspectLocalMemory,
  purgeExpiredLocalMemory,
  setLocalMemoryEnabled,
  updateLocalMemory,
} from "@/lib/local-memory";

/**
 * OCADE memory review (Plan §19, decision #31).
 *
 * Memory is OPT-IN, and everything OCADE remembers is reviewable, editable and
 * deletable here. It is deliberately separate from ordinary conversation
 * history: deleting a memory does not delete a chat, and vice versa.
 *
 * Cloud rows use the ready-to-apply migration. When that dependency is absent,
 * the panel switches explicitly to on-device storage and never claims sync.
 */
export function MemoryPanel() {
  const { user } = useSession();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [rows, setRows] = useState<OcadeMemoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [backend, setBackend] = useState<"cloud" | "local">("cloud");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  /** Text for a new, user-authored memory. */
  const [newMemory, setNewMemory] = useState("");
  const [memoryScope, setMemoryScope] = useState<"user" | "project">("user");
  const [memoryProjectId, setMemoryProjectId] = useState("");
  const [memoryRetention, setMemoryRetention] = useState<"keep" | "7" | "30" | "90">("keep");
  const [projects, setProjects] = useState<OcadeProject[]>([]);

  async function refresh(forceLocal = false) {
    setError(null);
    if (forceLocal) {
      const local = inspectLocalMemory();
      if (!local.ok) {
        setError(local.reason);
        setEnabled(null);
        setRows(null);
        return;
      }
      setBackend("local");
      setEnabled(local.data.enabled);
      setRows(local.data.enabled ? local.data.rows : []);
      return;
    }
    try {
      const { enabled: on } = await getMemoryEnabled();
      setBackend("cloud");
      setNotice(null);
      setEnabled(on);
      setRows(on ? await listMemory({ data: {} }) : []);
    } catch (e) {
      const cloudReason = e instanceof Error ? e.message : "Cloud memory isn't available yet.";
      const local = inspectLocalMemory();
      if (!local.ok) {
        setError(`${cloudReason} Local fallback also failed: ${local.reason}`);
        setEnabled(null);
        setRows(null);
        return;
      }
      setBackend("local");
      setNotice(`Cloud memory is unavailable (${cloudReason}). Using explicit on-device memory.`);
      setEnabled(local.data.enabled);
      setRows(local.data.enabled ? local.data.rows : []);
    }
  }

  useEffect(() => {
    void refresh();
    if (user?.id) {
      void listLocalProjects(user.id)
        .then((available) => setProjects(available))
        .catch(() => setProjects([]));
    }
  }, [user?.id]);

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      if (backend === "local") {
        const result = setLocalMemoryEnabled(next);
        if (!result.ok) throw new Error(result.reason);
      } else {
        await setMemoryEnabled({ data: { enabled: next } });
      }
      toast.success(
        next
          ? `OCADE may now remember things you approve ${backend === "local" ? "on this device" : "in private sync"}.`
          : "Memory turned off.",
      );
      await refresh(backend === "local");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change the memory setting.");
    } finally {
      setBusy(false);
    }
  }

  /** Record a memory the user typed. Source is "user" — never inferred. */
  async function addOne() {
    const content = newMemory.trim();
    if (!content) return;
    setBusy(true);
    try {
      if (memoryScope === "project" && !memoryProjectId) {
        throw new Error("Choose a project for project memory.");
      }
      const expiresAt =
        memoryRetention === "keep"
          ? null
          : new Date(Date.now() + Number(memoryRetention) * 24 * 60 * 60 * 1_000).toISOString();
      if (backend === "local") {
        const result = addLocalMemory({
          content,
          scope: memoryScope,
          projectId: memoryScope === "project" ? memoryProjectId : null,
          source: "user",
          expiresAt,
        });
        if (!result.ok) throw new Error(result.reason);
      } else {
        await addMemory({
          data: {
            content,
            scope: memoryScope,
            projectId: memoryScope === "project" ? memoryProjectId : null,
            source: "user",
            expiresAt,
          },
        });
      }
      setNewMemory("");
      toast.success("OCADE will remember that.");
      await refresh(backend === "local");
    } catch (e) {
      // Includes the honest 409 when memory is switched off server-side.
      toast.error(e instanceof Error ? e.message : "Could not save that memory.");
    } finally {
      setBusy(false);
    }
  }

  async function save(row: OcadeMemoryRow) {
    const content = drafts[row.id]?.trim();
    if (!content || content === row.content) return;
    try {
      if (backend === "local") {
        const result = updateLocalMemory({ id: row.id, content });
        if (!result.ok) throw new Error(result.reason);
      } else {
        await updateMemory({ data: { id: row.id, content } });
      }
      toast.success("Memory updated.");
      await refresh(backend === "local");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update this memory.");
    }
  }

  async function togglePin(row: OcadeMemoryRow) {
    try {
      if (backend === "local") {
        const result = updateLocalMemory({ id: row.id, pinned: !row.pinned });
        if (!result.ok) throw new Error(result.reason);
      } else {
        await updateMemory({ data: { id: row.id, pinned: !row.pinned } });
      }
      await refresh(backend === "local");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update this memory.");
    }
  }

  async function remove(row: OcadeMemoryRow) {
    try {
      if (backend === "local") {
        const result = deleteLocalMemory(row.id);
        if (!result.ok) throw new Error(result.reason);
      } else {
        await deleteMemory({ data: { id: row.id } });
      }
      toast.success("Memory deleted.");
      await refresh(backend === "local");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete this memory.");
    }
  }

  async function clearAll() {
    const phrase = window.prompt(
      'This permanently deletes everything OCADE remembers. Your conversations are not affected. Type "delete memory" to confirm.',
    );
    if (phrase === null) return;
    if (phrase.trim().toLowerCase() !== "delete memory") {
      toast.error("Confirmation phrase did not match. Nothing was deleted.");
      return;
    }
    try {
      if (backend === "local") {
        const result = clearLocalMemory();
        if (!result.ok) throw new Error(result.reason);
      } else {
        await clearAllMemory();
      }
      toast.success("All memory deleted.");
      await refresh(backend === "local");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear memory.");
    }
  }

  async function removeExpired() {
    try {
      const result = backend === "local" ? purgeExpiredLocalMemory() : await purgeExpiredMemory();
      if ("ok" in result && !result.ok) throw new Error(result.reason);
      const removed = "ok" in result ? result.data.removed : result.removed;
      toast.success(
        removed > 0
          ? `${removed} expired ${removed === 1 ? "memory" : "memories"} deleted.`
          : "No expired memories to delete.",
      );
      await refresh(backend === "local");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove expired memory.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Privacy and Data"
        title="Memory"
        description="What OCADE remembers between conversations — opt-in, and always yours to review, edit or delete."
        actions={
          <div className="flex items-center gap-2">
            <span className="rounded border border-border/60 px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
              {backend === "local" ? "On-device" : "Private sync"}
            </span>
            <StatusBadge status={enabled ? "active" : "setup_required"} />
          </div>
        }
      />

      {notice ? (
        <GlassPanel className="mt-6 flex items-start gap-3 p-4">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 flex-none text-[color:var(--warning)]"
            aria-hidden
          />
          <div className="text-sm">
            <p className="font-medium text-foreground">On-device fallback is active</p>
            <p className="mt-1 text-muted-foreground">{notice}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              These items stay in this browser and do not claim to be synced.
            </p>
          </div>
        </GlassPanel>
      ) : null}

      {error ? (
        <GlassPanel className="mt-6 flex items-start gap-3 p-4">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 flex-none text-[color:var(--warning)]"
            aria-hidden
          />
          <div className="text-sm">
            <p className="font-medium text-foreground">Memory is unavailable</p>
            <p className="mt-1 text-muted-foreground">{error}</p>
            <p className="mt-1 text-xs text-muted-foreground">Nothing was stored or changed.</p>
          </div>
        </GlassPanel>
      ) : null}

      {!error ? (
        <GlassPanel className="mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-start gap-3">
            <Brain className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" aria-hidden />
            <div className="text-sm">
              <p className="font-medium text-foreground">Let OCADE remember</p>
              <p className="mt-0.5 text-muted-foreground">
                Off by default. When on, OCADE keeps durable notes you approve — separate from your
                chat history, and stored in the mode shown above.
              </p>
            </div>
          </div>
          <button
            onClick={() => void toggle(!enabled)}
            disabled={busy || enabled === null}
            className="rounded-md border border-border/70 px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : enabled ? "Turn off" : "Turn on"}
          </button>
        </GlassPanel>
      ) : null}

      {enabled && rows ? (
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">
              Remembered items {rows.length > 0 ? `(${rows.length})` : ""}
            </h2>
            {rows.length > 0 ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void removeExpired()}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Remove expired
                </button>
                <button
                  onClick={() => void clearAll()}
                  className="text-xs text-muted-foreground hover:text-[color:var(--destructive)]"
                >
                  Delete all
                </button>
              </div>
            ) : null}
          </div>

          {/*
            The writer for the memory system. Without this nothing ever creates
            a memory, so the list stays permanently empty and the whole feature
            is inert. Adding is deliberately a USER action — OCADE does not
            silently infer things about you.
          */}
          <GlassPanel className="mb-3 p-3">
            <label htmlFor="memory-add" className="text-xs font-medium text-foreground">
              Tell OCADE something to remember
            </label>
            <textarea
              id="memory-add"
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              rows={2}
              placeholder="I prefer short answers. I work in IST."
              className="mt-1.5 w-full resize-y rounded-md border border-border/60 bg-background/40 p-2 text-sm text-foreground"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                Scope
                <select
                  value={memoryScope}
                  onChange={(event) => {
                    const scope = event.target.value as "user" | "project";
                    setMemoryScope(scope);
                    if (scope === "project" && !memoryProjectId) {
                      setMemoryProjectId(projects[0]?.id ?? "");
                    }
                  }}
                  className="rounded border border-border/60 bg-background px-2 py-1 text-foreground"
                >
                  <option value="user">Private memory</option>
                  <option value="project" disabled={projects.length === 0}>
                    Project memory
                  </option>
                </select>
              </label>
              {memoryScope === "project" ? (
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  Project
                  <select
                    value={memoryProjectId}
                    onChange={(event) => setMemoryProjectId(event.target.value)}
                    className="rounded border border-border/60 bg-background px-2 py-1 text-foreground"
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                Retention
                <select
                  value={memoryRetention}
                  onChange={(event) =>
                    setMemoryRetention(event.target.value as "keep" | "7" | "30" | "90")
                  }
                  className="rounded border border-border/60 bg-background px-2 py-1 text-foreground"
                >
                  <option value="keep">Keep until deleted</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                </select>
              </label>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => void addOne()}
                disabled={busy || !newMemory.trim()}
                className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                Remember this
              </button>
              <span className="text-[11px] text-muted-foreground">
                Stored only for you. You can edit or delete it at any time.
              </span>
            </div>
          </GlassPanel>

          {rows.length === 0 ? (
            <GlassPanel className="p-4 text-sm text-muted-foreground">
              OCADE hasn&apos;t remembered anything yet.
            </GlassPanel>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li key={row.id}>
                  <GlassPanel className="p-3">
                    {/*
                      Every row renders an identical editor, so without a name a
                      screen reader announces a list of anonymous text boxes.
                    */}
                    <textarea
                      value={drafts[row.id] ?? row.content}
                      onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                      rows={2}
                      aria-label={`Edit remembered item: ${row.content.slice(0, 60)}`}
                      className="w-full resize-y rounded-md border border-border/60 bg-background/40 p-2 text-sm text-foreground"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded border border-border/60 px-1.5 py-0.5">
                        {row.scope}
                      </span>
                      <span className="rounded border border-border/60 px-1.5 py-0.5">
                        from {row.source}
                      </span>
                      {row.expires_at ? (
                        <span>expires {new Date(row.expires_at).toLocaleDateString()}</span>
                      ) : null}
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          onClick={() => void save(row)}
                          title="Save changes"
                          className="rounded p-1 hover:text-foreground"
                        >
                          <Save className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          onClick={() => void togglePin(row)}
                          title={row.pinned ? "Unpin" : "Pin"}
                          className="rounded p-1 hover:text-foreground"
                        >
                          {row.pinned ? (
                            <PinOff className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <Pin className="h-3.5 w-3.5" aria-hidden />
                          )}
                        </button>
                        <button
                          onClick={() => void remove(row)}
                          title="Delete"
                          className="rounded p-1 hover:text-[color:var(--destructive)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </GlassPanel>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </>
  );
}
