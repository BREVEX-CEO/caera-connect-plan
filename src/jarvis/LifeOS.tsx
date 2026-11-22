import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { listObligations, removeObligation, saveObligation } from "@/lib/jarvis/lifeos.functions";
import {
  civilDate,
  obligationSignal,
  obligationView,
  type ObligationView,
} from "@/lib/jarvis/lifeos";
import { useSession } from "@/lib/session";
import { ProblemRadar } from "./ProblemRadar";
import { saveFile } from "@/lib/utils";

type Item = Awaited<ReturnType<typeof listObligations>>[number];
type Draft = Omit<Item, "id" | "created_at"> & { id: string | null };
const empty: Draft = {
  id: null,
  title: "",
  source: "",
  due_on: null,
  snoozed_until: null,
  completed: false,
};
const views: ObligationView[] = ["Today", "Upcoming", "Waiting", "Completed"];
const field = "min-h-11 w-full rounded-md border border-border bg-background px-2 text-sm";
const button =
  "min-h-11 rounded-md border border-border px-2 text-xs hover:bg-accent disabled:opacity-60";

export function LifeOS() {
  const { user } = useSession();
  return user ? (
    <div key={user.id} className="grid gap-4">
      <ProblemRadar account={user.id} />
      <ObligationList account={user.id} />
    </div>
  ) : null;
}

function ObligationList({ account }: { account: string }) {
  const cache = useQueryClient();
  const queryKey = ["jarvis", "lifeos", account];
  const items = useQuery({ queryKey, queryFn: () => listObligations() });
  const [view, setView] = useState<ObligationView>("Today");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const titleInput = useRef<HTMLInputElement>(null);
  const editing = draft !== null;
  useEffect(() => {
    if (editing) titleInput.current?.focus();
  }, [editing]);
  const today = civilDate(new Date());
  const week = new Date();
  week.setDate(week.getDate() + 7);
  const soon = civilDate(week);
  const save = useMutation({
    mutationFn: (data: Draft) => saveObligation({ data }),
    onSuccess: (_, item) => {
      setDraft(null);
      setView(obligationView(item, today));
      setSearch("");
      setFeedback("Obligation saved.");
      void cache.invalidateQueries({ queryKey });
    },
    onError: () => setFeedback("Could not save. Your draft is still here."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeObligation({ data: { id } }),
    onSuccess: () => {
      setConfirm(null);
      setFeedback("Obligation removed.");
      void cache.invalidateQueries({ queryKey });
    },
    onError: () => setFeedback("Could not remove that obligation."),
  });
  const rows = (items.data ?? [])
    .filter((item) => obligationView(item, today) === view)
    .filter((item) =>
      [item.title, item.source].some((text) =>
        text.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    )
    .sort(
      (a, b) =>
        (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999") ||
        a.created_at.localeCompare(b.created_at),
    );
  const busy = save.isPending || remove.isPending;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !draft.title.trim() || busy) return;
    setFeedback("");
    save.mutate(draft);
  }

  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">
        Track obligations you add yourself. LifeOS does not read files or connected accounts.
      </p>
      <div className="flex flex-wrap gap-1">
        <button
          className={button}
          type="button"
          onClick={() => setDraft(empty)}
          disabled={!!draft || busy}
        >
          Add obligation
        </button>
        <button
          className={button}
          type="button"
          disabled={!items.data?.length || busy || items.isError}
          onClick={() =>
            saveFile(
              "ocade-lifeos.json",
              new Blob([JSON.stringify(items.data, null, 2)], { type: "application/json" }),
            )
          }
        >
          Export obligations
        </button>
      </div>
      <p role="status" className="text-xs">
        {feedback}
      </p>
      {draft ? (
        <form className="grid gap-2 rounded-lg border border-border p-2" onSubmit={submit}>
          <label className="grid gap-1 text-xs">
            Obligation
            <input
              ref={titleInput}
              className={field}
              value={draft.title}
              required
              maxLength={120}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label className="grid gap-1 text-xs">
            Source reference (optional)
            <input
              className={field}
              value={draft.source}
              maxLength={300}
              onChange={(e) => setDraft({ ...draft, source: e.target.value })}
            />
          </label>
          <label className="grid gap-1 text-xs">
            Due date (optional)
            <input
              className={field}
              type="date"
              value={draft.due_on ?? ""}
              onChange={(e) => setDraft({ ...draft, due_on: e.target.value || null })}
            />
          </label>
          <label className="grid gap-1 text-xs">
            Snooze until (optional)
            <input
              className={field}
              type="date"
              value={draft.snoozed_until ?? ""}
              onChange={(e) => setDraft({ ...draft, snoozed_until: e.target.value || null })}
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={draft.completed}
              onChange={(e) => setDraft({ ...draft, completed: e.target.checked })}
            />
            Completed
          </label>
          <div className="flex gap-2">
            <button className={button} type="submit" disabled={busy}>
              {save.isPending ? "Saving…" : "Save obligation"}
            </button>
            <button className={button} type="button" disabled={busy} onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      <label className="grid gap-1 text-xs">
        Find an obligation
        <input
          className={field}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-1" aria-label="Obligation views" role="group">
        {views.map((name) => (
          <button
            className={`${button} aria-pressed:bg-accent`}
            key={name}
            type="button"
            aria-pressed={view === name}
            onClick={() => setView(name)}
          >
            {name}
          </button>
        ))}
      </div>
      {items.isLoading ? (
        <p role="status">Loading obligations…</p>
      ) : items.isError ? (
        <div>
          <p>Could not read your obligations.</p>
          <button className={button} type="button" onClick={() => void items.refetch()}>
            Retry
          </button>
        </div>
      ) : rows.length ? (
        <ul className="grid gap-2">
          {rows.map((item) => (
            <li
              className="grid gap-1 rounded-lg border border-border p-2 text-xs [overflow-wrap:anywhere]"
              key={item.id}
            >
              <strong className="text-sm">{item.title}</strong>
              <p>{item.due_on ? `Due ${item.due_on}` : "Due date unknown"}</p>
              {item.source ? <p>Source: {item.source}</p> : null}
              {item.snoozed_until && item.snoozed_until > today ? (
                <p>Snoozed until {item.snoozed_until}</p>
              ) : null}
              {obligationSignal(item, today, soon) ? (
                <p>{obligationSignal(item, today, soon)}</p>
              ) : null}
              {confirm === item.id ? (
                <div>
                  <p>Remove this obligation?</p>
                  <div className="flex gap-2">
                    <button
                      className={button}
                      type="button"
                      disabled={busy}
                      onClick={() => remove.mutate(item.id)}
                    >
                      Remove
                    </button>
                    <button
                      className={button}
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirm(null)}
                    >
                      Keep
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    className={button}
                    type="button"
                    disabled={busy || !!draft}
                    onClick={() => {
                      const { created_at: _, ...editable } = item;
                      setDraft(editable);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className={button}
                    type="button"
                    disabled={busy || !!draft}
                    onClick={() => setConfirm(item.id)}
                  >
                    Remove…
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          No matching obligations in {view.toLowerCase()}.
        </p>
      )}
    </div>
  );
}
