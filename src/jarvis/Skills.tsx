import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteSkill,
  listSkills,
  restoreSkill,
  saveSkill,
  SKILL_NAME,
  type SkillRow,
} from "@/lib/jarvis/skills.functions";
import { useSession } from "@/lib/session";

/**
 * THE PERSON'S OWN SKILLS (plan 14E.6.6, REPO-57/67): write a procedure once, name it with /name
 * in a JARVIS request. Every edit keeps the earlier text; restoring brings back that exact text.
 * Nothing automatic changes a skill, and a skill never grants a permission.
 */
export function Skills() {
  const { user } = useSession();
  const client = useQueryClient();
  const queryKey = ["jarvis", "skills", user?.id ?? ""];
  const skills = useQuery({ queryKey, queryFn: () => listSkills() });
  const [editing, setEditing] = useState<SkillRow | "new" | null>(null);
  const [history, setHistory] = useState<string | null>(null);
  const refresh = () => void client.invalidateQueries({ queryKey });
  const remove = useMutation({
    mutationFn: (row: SkillRow) => deleteSkill({ data: { id: row.id } }),
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });
  const restore = useMutation({
    mutationFn: (input: { id: string; version: number }) => restoreSkill({ data: input }),
    onSuccess: ({ version }) => {
      toast.success(`Restored. That text is now version ${version}.`);
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-3 p-3 text-sm">
      <p className="text-muted-foreground">
        Your own ways of working. Name one with <code>/name</code> in a JARVIS request and JARVIS
        follows it where it fits. A skill never gives JARVIS a new permission.
      </p>
      {editing ? (
        <SkillForm
          row={editing === "new" ? null : editing}
          onDone={() => {
            setEditing(null);
            refresh();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="rounded-full border border-border px-3 py-1 hover:bg-accent"
        >
          New skill
        </button>
      )}
      {skills.isPending ? <p className="text-muted-foreground">Reading your skills…</p> : null}
      {skills.isError ? <p role="alert">Your skills could not be read. Try again.</p> : null}
      {skills.data && skills.data.length === 0 && !editing ? (
        <p className="text-muted-foreground">No skills yet.</p>
      ) : null}
      <ul className="space-y-2">
        {(skills.data ?? []).map((row) => (
          <li key={row.id} className="rounded-xl border border-border/60 p-2">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">/{row.name}</span>{" "}
                <span className="text-muted-foreground">
                  {row.title} · version {row.version}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Edit /${row.name}`}
                onClick={() => setEditing(row)}
                className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent"
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Earlier versions of /${row.name}`}
                aria-expanded={history === row.id}
                disabled={row.versions.length === 0}
                onClick={() => setHistory(history === row.id ? null : row.id)}
                className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent disabled:opacity-40"
              >
                <History className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Delete /${row.name}`}
                onClick={() => {
                  if (window.confirm(`Delete /${row.name} and its earlier versions?`))
                    remove.mutate(row);
                }}
                className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {history === row.id ? (
              <ol aria-label={`Earlier versions of /${row.name}`} className="mt-2 space-y-2">
                {row.versions.map((version) => (
                  <li key={version.version} className="rounded-lg bg-muted p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        Version {version.version} · {new Date(version.created_at).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => restore.mutate({ id: row.id, version: version.version })}
                        className="rounded-full border border-border px-2 py-0.5 hover:bg-accent"
                      >
                        Restore this text
                      </button>
                    </div>
                    <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap">
                      {version.body}
                    </pre>
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SkillForm({ row, onDone }: { row: SkillRow | null; onDone: () => void }) {
  const [name, setName] = useState(row?.name ?? "");
  const [title, setTitle] = useState(row?.title ?? "");
  const [body, setBody] = useState(row?.body ?? "");
  const save = useMutation({
    mutationFn: () => saveSkill({ data: { id: row?.id ?? null, name, title, body } }),
    onSuccess: onDone,
    onError: (error) => toast.error(error.message),
  });
  const nameOk = SKILL_NAME.test(name);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (nameOk && title.trim() && body.trim()) save.mutate();
  };
  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-border p-2">
      <label className="block">
        <span className="text-xs text-muted-foreground">Name (used as /name)</span>
        <input
          value={name}
          disabled={Boolean(row)}
          onChange={(event) => setName(event.target.value.toLowerCase())}
          maxLength={40}
          aria-invalid={name !== "" && !nameOk}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1"
          placeholder="weekly-report"
        />
      </label>
      {name !== "" && !nameOk ? (
        <p className="text-xs text-destructive">Use lowercase letters, digits and hyphens.</p>
      ) : null}
      <label className="block">
        <span className="text-xs text-muted-foreground">Title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1"
        />
      </label>
      <label className="block">
        <span className="text-xs text-muted-foreground">How JARVIS should do it</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={8000}
          rows={6}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={save.isPending || !nameOk || !title.trim() || !body.trim()}
          className="rounded-full bg-foreground px-3 py-1 text-background disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-full border border-border px-3 py-1 hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
