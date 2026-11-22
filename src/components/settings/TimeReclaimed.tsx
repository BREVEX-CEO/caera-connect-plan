import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { requireSession } from "@/lib/security/session-middleware";
import {
  csv,
  reclaimed,
  record,
  recordsInPeriod,
  type Period,
  type TaskRecord,
} from "@/lib/jarvis/time-reclaimed";
import { useSession } from "@/lib/session";
import { Row } from "./rows";

/** The person's own live or background JARVIS tasks (RLS), newest first, at most 1,000. */
const listTaskRecords = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }): Promise<TaskRecord[]> => {
    const { data, error } = await context.supabase
      .from("jarvis_tasks")
      .select("title, status, mode, created_at, finished_at, user_wait_ms, outcome, checkpoint")
      .eq("user_id", context.userId)
      .in("mode", ["live", "background"])
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error("Your JARVIS results could not be read just now.");
    return (data ?? []).map(record);
  });

const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "Last 30 days" },
  { id: "all", label: "Most recent 1,000 tasks" },
];

/** Billing & Usage > What JARVIS finished (T12-12): verified results, never inflated. */
export function TimeReclaimed() {
  const { user } = useSession();
  const [period, setPeriod] = useState<Period>("month");
  const key = user ? `ocade.baseline.${user.id}` : null;
  const [storedBaseline, setBaseline] = useState<{ key: string; value: string } | null>(null);
  const baseline = storedBaseline?.key === key ? (storedBaseline?.value ?? "") : "";
  useEffect(() => {
    if (!key) return;
    try {
      setBaseline({ key, value: localStorage.getItem(key) ?? "" });
    } catch {
      // Time estimates are optional when browser storage is unavailable.
    }
  }, [key]);
  const tasks = useQuery({
    queryKey: ["jarvis", "records", user?.id ?? ""],
    queryFn: () => listTaskRecords(),
    enabled: Boolean(user),
  });
  const amount = Number(baseline);
  const minutes = amount >= 1 && amount <= 600 ? amount : null;
  const now = new Date();
  const view = reclaimed(tasks.data ?? [], period, minutes, now);
  const visible = recordsInPeriod(tasks.data ?? [], period, now);
  return (
    <Row
      label="What JARVIS finished"
      description={
        tasks.isError
          ? "Your JARVIS results could not be read just now."
          : tasks.isPending
            ? "Loading your JARVIS results…"
            : `${view.verified} verified, ${view.failed} not finished as asked, ${view.other} other, of ${view.total}. ` +
              (view.savedMinutes === null
                ? "Time saved: unavailable until you say how long a task takes you by hand."
                : `About ${view.savedMinutes} minutes saved, from your estimate of ${minutes} minutes per task, minus the time JARVIS waited on you.`)
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          aria-label="Period"
          value={period}
          onChange={(event) => setPeriod(event.target.value as Period)}
          className="rounded-md border border-border bg-background px-2 py-1"
        >
          {PERIODS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={600}
          value={baseline}
          disabled={!key}
          onChange={(event) => {
            if (!key) return;
            const value = event.target.value;
            setBaseline({ key, value });
            try {
              localStorage.setItem(key, value);
            } catch {
              // The estimate still works for this visit.
            }
          }}
          aria-label="Your minutes per task by hand"
          placeholder="Minutes by hand"
          className="w-28 rounded-md border border-border bg-background px-2 py-1"
        />
        <button
          type="button"
          disabled={!visible.length || tasks.isError}
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([csv(visible)], { type: "text/csv;charset=utf-8" }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "ocade-jarvis-results.csv";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
          className="rounded-full border border-border px-3 py-1 hover:bg-accent disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>
    </Row>
  );
}
