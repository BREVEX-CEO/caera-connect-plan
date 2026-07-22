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
  updateMemory,
  deleteMemory,
  clearAllMemory,
  type OcadeMemoryRow,
} from "@/lib/ocade-projects.functions";

/**
 * OCADE memory review (Plan §19, decision #31).
 *
 * Memory is OPT-IN, and everything OCADE remembers is reviewable, editable and
 * deletable here. It is deliberately separate from ordinary conversation
 * history: deleting a memory does not delete a chat, and vice versa.
 *
 * The backing tables ship in a ready-to-apply migration. Until it is applied
 * this panel shows an honest unavailable state — it never pretends to remember.
 */
export function MemoryPanel() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [rows, setRows] = useState<OcadeMemoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function refresh() {
    setError(null);
    try {
      const { enabled: on } = await getMemoryEnabled();
      setEnabled(on);
      setRows(on ? await listMemory({ data: {} }) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Memory isn't available yet.");
      setEnabled(null);
      setRows(null);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      await setMemoryEnabled({ data: { enabled: next } });
      toast.success(next ? "OCADE may now remember things you approve." : "Memory turned off.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change the memory setting.");
    } finally {
      setBusy(false);
    }
  }

  async function save(row: OcadeMemoryRow) {
    const content = drafts[row.id]?.trim();
    if (!content || content === row.content) return;
    try {
      await updateMemory({ data: { id: row.id, content } });
      toast.success("Memory updated.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update this memory.");
    }
  }

  async function togglePin(row: OcadeMemoryRow) {
    try {
      await updateMemory({ data: { id: row.id, pinned: !row.pinned } });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update this memory.");
    }
  }

  async function remove(row: OcadeMemoryRow) {
    try {
      await deleteMemory({ data: { id: row.id } });
      toast.success("Memory deleted.");
      await refresh();
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
      await clearAllMemory();
      toast.success("All memory deleted.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear memory.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Privacy and Data"
        title="Memory"
        description="What OCADE remembers between conversations — opt-in, and always yours to review, edit or delete."
        actions={<StatusBadge status={enabled ? "active" : "setup_required"} />}
      />

      {error ? (
        <GlassPanel className="mt-6 flex items-start gap-3 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-[color:var(--warning)]" aria-hidden />
          <div className="text-sm">
            <p className="font-medium text-foreground">Memory isn&apos;t available yet</p>
            <p className="mt-1 text-muted-foreground">{error}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              This feature needs a pending database update. Nothing is stored until it is applied.
            </p>
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
                chat history, and stored under your current privacy mode.
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
              <button
                onClick={() => void clearAll()}
                className="text-xs text-muted-foreground hover:text-[color:var(--destructive)]"
              >
                Delete all
              </button>
            ) : null}
          </div>

          {rows.length === 0 ? (
            <GlassPanel className="p-4 text-sm text-muted-foreground">
              OCADE hasn&apos;t remembered anything yet.
            </GlassPanel>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li key={row.id}>
                  <GlassPanel className="p-3">
                    <textarea
                      value={drafts[row.id] ?? row.content}
                      onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                      rows={2}
                      className="w-full resize-y rounded-md border border-border/60 bg-background/40 p-2 text-sm text-foreground"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded border border-border/60 px-1.5 py-0.5">{row.scope}</span>
                      <span className="rounded border border-border/60 px-1.5 py-0.5">from {row.source}</span>
                      {row.expires_at ? (
                        <span>expires {new Date(row.expires_at).toLocaleDateString()}</span>
                      ) : null}
                      <div className="ml-auto flex items-center gap-1">
                        <button onClick={() => void save(row)} title="Save changes" className="rounded p-1 hover:text-foreground">
                          <Save className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          onClick={() => void togglePin(row)}
                          title={row.pinned ? "Unpin" : "Pin"}
                          className="rounded p-1 hover:text-foreground"
                        >
                          {row.pinned ? <PinOff className="h-3.5 w-3.5" aria-hidden /> : <Pin className="h-3.5 w-3.5" aria-hidden />}
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
