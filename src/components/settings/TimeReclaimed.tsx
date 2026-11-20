import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { requireSession } from "@/lib/security/session-middleware";
import { csv, reclaimed, record, type Period, type TaskRecord } from "@/lib/jarvis/time-reclaimed";
import { useSession } from "@/lib/session";
import { Row } from "./rows";

/** The person's own JARVIS tasks (RLS), newest first, at most 1,000. */
const listTaskRecords = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }): Promise<TaskRecord[]> => {
    const { data, error } = await context.supabase
      .from("jarvis_tasks")
      .select("title, status, created_at, finished_at, user_wait_ms, outcome, checkpoint")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error("Your JARVIS results could not be read just now.");
    return (data ?? []).map(record);
  });

const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "all", label: "All time" },
];

/** Billing & Usage > What JARVIS finished (T12-12): verified results, never inflated. */
export function TimeReclaimed() {
  const { user } = useSession();
  const [period, setPeriod] = useState<Period>("month");
  const key = `ocade.baseline.${user?.id ?? ""}`;
  const [baseline, setBaseline] = useState<string>(() =>
    typeof window === "undefined" ? "" : (window.localStorage.getItem(key) ?? ""),
  );
  const tasks = useQuery({
    queryKey: ["jarvis", "records", user?.id ?? ""],
    queryFn: () => listTaskRecords(),
    enabled: Boolean(user),
  });
  const minutes = Number(baseline) > 0 ? Number(baseline) : null;
  const view = reclaimed(tasks.data ?? [], period, minutes);
  return (
    <Row
      label="What JARVIS finished"
      description={
        tasks.isError
          ? "Your JARVIS results could not be read just now."
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
          onChange={(event) => {
            setBaseline(event.target.value);
            window.localStorage.setItem(key, event.target.value);
          }}
          aria-label="Your minutes per task by hand"
          placeholder="Minutes by hand"
          className="w-28 rounded-md border border-border bg-background px-2 py-1"
        />
        <button
          type="button"
          disabled={!tasks.data?.length}
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([csv(tasks.data ?? [])], { type: "text/csv;charset=utf-8" }),
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
