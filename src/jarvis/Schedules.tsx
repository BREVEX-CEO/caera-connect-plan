import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Pencil, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteJarvisSchedule,
  listJarvisDevices,
  listJarvisSchedules,
  saveJarvisSchedule,
  setJarvisScheduleActive,
} from "@/lib/jarvis/functions";
import { wallTime, zonedInstant, type ScheduleRepeat } from "@/lib/jarvis/schedule-time";
import { useSession } from "@/lib/session";

/**
 * SCHEDULED JARVIS WORK AND REMINDERS, AS THE PERSON MANAGES THEM.
 *
 * Create, edit, pause, resume and delete one-time or repeating schedules. A run on a computer
 * starts a new task at its time with fresh permission checks, so a computer that was removed or
 * lost its permissions refuses the run and the person is told. Times are in the person's own
 * time zone, which is shown and saved with the schedule.
 */
const REPEATS: { id: ScheduleRepeat; label: string }[] = [
  { id: "none", label: "Once" },
  { id: "daily", label: "Every day" },
  { id: "weekdays", label: "Every weekday" },
  { id: "weekly", label: "Every week" },
];

type Row = Awaited<ReturnType<typeof listJarvisSchedules>>[number];

const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** "2026-11-21T09:00" in a zone, for the date-time field. */
function fieldValue(iso: string, zone: string): string {
  const w = wallTime(new Date(iso), zone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

function fieldInstant(value: string, zone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  return zonedInstant({ year: y!, month: mo!, day: d!, hour: h!, minute: mi! }, zone);
}

function describe(row: Row): string {
  const when = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: row.time_zone,
  }).format(new Date(row.next_at));
  const repeat = REPEATS.find((r) => r.id === row.repeat)?.label ?? row.repeat;
  return `${repeat} · next ${when} (${row.time_zone})${stopRule(row)}`;
}

/** The goal's stop condition in plain words (Outcome Autopilot, plan 28.1.2). */
function stopRule(row: Pick<Row, "run_until" | "max_runs" | "runs_done" | "time_zone">): string {
  const parts: string[] = [];
  if (row.max_runs) parts.push(`stops after ${row.max_runs} runs (${row.runs_done} done)`);
  if (row.run_until) {
    const until = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeZone: row.time_zone,
    }).format(new Date(row.run_until));
    parts.push(`ends ${until}`);
  }
  return parts.length ? ` · ${parts.join(", ")}` : "";
}

type Stop = "never" | "count" | "date";

/** The end of a calendar day in a zone, so "ends 30 Nov" includes that day's run. */
function dayEnd(value: string, zone: string): Date | null {
  return fieldInstant(`${value}T23:59`, zone);
}

export function Schedules() {
  const { user } = useSession();
  const client = useQueryClient();
  const queryKey = ["jarvis", "schedules", user?.id ?? ""];
  const schedules = useQuery({ queryKey, queryFn: () => listJarvisSchedules() });
  const devices = useQuery({
    queryKey: ["jarvis", "devices", user?.id ?? ""],
    queryFn: () => listJarvisDevices(),
  });
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const newSchedule = useRef<HTMLButtonElement>(null);
  const refresh = () => void client.invalidateQueries({ queryKey });

  const toggle = useMutation({
    mutationFn: (row: Row) =>
      setJarvisScheduleActive({ data: { id: row.id, active: !row.active } }),
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (row: Row) => deleteJarvisSchedule({ data: { id: row.id } }),
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });

  if (schedules.isPending) return <p className="text-muted-foreground">Loading schedules…</p>;
  if (schedules.isError) {
    return (
      <p className="text-muted-foreground" role="alert">
        Your schedules could not be loaded.{" "}
        <button type="button" className="underline" onClick={() => void schedules.refetch()}>
          Try again
        </button>
      </p>
    );
  }
  const computers = (devices.data ?? []).filter((device) => !device.revoked_at);
  const deviceName = (id: string | null) =>
    id ? (computers.find((d) => d.id === id)?.name ?? "A removed computer") : "Reminder only";

  return (
    <div className="flex flex-col gap-2">
      {editing ? (
        <ScheduleForm
          key={editing === "new" ? "new" : editing.id}
          row={editing === "new" ? null : editing}
          computers={computers.map((d) => ({ id: d.id, name: d.name }))}
          onDone={() => {
            setEditing(null);
            refresh();
            requestAnimationFrame(() => newSchedule.current?.focus());
          }}
        />
      ) : (
        <button
          type="button"
          ref={newSchedule}
          onClick={() => setEditing("new")}
          className="min-h-11 rounded-md border border-border px-2 text-sm hover:bg-accent"
        >
          New schedule
        </button>
      )}
      {schedules.data.length === 0 ? (
        <p className="text-muted-foreground">
          Nothing scheduled. Ask JARVIS to do something later, or set a reminder.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {schedules.data.map((row) => {
            const finished =
              !row.active &&
              row.last_run_at !== null &&
              (row.repeat === "none" ||
                (row.max_runs !== null && row.runs_done >= row.max_runs) ||
                row.last_outcome === "Ended on its end date" ||
                (row.run_until !== null && Date.parse(row.next_at) > Date.parse(row.run_until)));
            const changing =
              (toggle.isPending && toggle.variables?.id === row.id) ||
              (remove.isPending && remove.variables?.id === row.id);
            return (
              <li key={row.id} className="rounded-md border border-border/60 p-2">
                <p className="break-words text-foreground">{row.what}</p>
                <p className="text-xs text-muted-foreground">
                  {row.active ? describe(row) : finished ? "Ended" : "Paused"} ·{" "}
                  {deviceName(row.device_id)}
                </p>
                {row.last_outcome ? (
                  <p className="text-xs text-muted-foreground">Last run: {row.last_outcome}</p>
                ) : null}
                <div className="mt-1 flex gap-1">
                  {!finished ? (
                    <IconAction
                      label={row.active ? `Pause ${row.what}` : `Resume ${row.what}`}
                      onClick={() => toggle.mutate(row)}
                      disabled={changing}
                    >
                      {row.active ? (
                        <Pause className="h-4 w-4" aria-hidden />
                      ) : (
                        <Play className="h-4 w-4" aria-hidden />
                      )}
                    </IconAction>
                  ) : null}
                  <IconAction
                    label={`Edit ${row.what}`}
                    onClick={() => setEditing(row)}
                    disabled={changing}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </IconAction>
                  <IconAction
                    label={`Delete ${row.what}`}
                    disabled={changing}
                    onClick={() => {
                      if (
                        window.confirm("Delete this schedule? Runs already started are not undone.")
                      ) {
                        remove.mutate(row);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </IconAction>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function IconAction({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function ScheduleForm({
  row,
  computers,
  onDone,
}: {
  row: Row | null;
  computers: { id: string; name: string }[];
  onDone: () => void;
}) {
  const zone = row?.time_zone ?? localZone();
  const [problem, setProblem] = useState<string | null>(null);
  const [repeats, setRepeats] = useState((row?.repeat ?? "none") !== "none");
  const [stop, setStop] = useState<Stop>(
    row?.max_runs ? "count" : row?.run_until ? "date" : "never",
  );
  const what = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    what.current?.focus();
  }, []);
  const save = useMutation({
    mutationFn: saveJarvisSchedule,
    onSuccess: onDone,
    onError: (error) => setProblem(error.message),
  });
  const initial = row
    ? fieldValue(row.next_at, zone)
    : fieldValue(new Date(Date.now() + 60 * 60 * 1000).toISOString(), zone);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const at = fieldInstant(String(form.get("when") ?? ""), zone);
    if (!at || at.getTime() < Date.now()) return setProblem("Choose a time in the future.");
    const device = String(form.get("device") ?? "");
    const repeat = String(form.get("repeat")) as ScheduleRepeat;
    let runUntil: string | null = null;
    let maxRuns: number | null = null;
    if (repeat !== "none" && stop === "count") {
      maxRuns = Number(form.get("runs"));
      if (!Number.isInteger(maxRuns) || maxRuns < 1 || maxRuns > 1000)
        return setProblem("Choose between 1 and 1000 runs.");
    }
    if (repeat !== "none" && stop === "date") {
      const end = dayEnd(String(form.get("until") ?? ""), zone);
      if (!end || end.getTime() < at.getTime())
        return setProblem("Choose an end date on or after the first run.");
      runUntil = end.toISOString();
    }
    setProblem(null);
    save.mutate({
      data: {
        ...(row ? { id: row.id, conversationId: row.conversation_id } : {}),
        deviceId: device || null,
        what: String(form.get("what") ?? "").trim(),
        nextAt: at.toISOString(),
        repeat,
        timeZone: zone,
        runUntil,
        maxRuns,
      },
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-md border border-border p-2">
      <label className="text-xs text-muted-foreground" htmlFor="schedule-what">
        What should JARVIS do, or remind you about?
      </label>
      <textarea
        ref={what}
        id="schedule-what"
        name="what"
        required
        maxLength={500}
        defaultValue={row?.what ?? ""}
        rows={2}
        className="w-full resize-none rounded-md border border-border bg-transparent px-2 py-1 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <label className="text-xs text-muted-foreground" htmlFor="schedule-when">
        When ({zone})
      </label>
      <input
        id="schedule-when"
        name="when"
        type="datetime-local"
        required
        defaultValue={initial}
        className="h-8 rounded-md border border-border bg-transparent px-2 text-sm"
      />
      <label className="text-xs text-muted-foreground" htmlFor="schedule-repeat">
        Repeat
      </label>
      <select
        id="schedule-repeat"
        name="repeat"
        defaultValue={row?.repeat ?? "none"}
        onChange={(event) => setRepeats(event.target.value !== "none")}
        className="h-8 rounded-md border border-border bg-background px-2 text-sm"
      >
        {REPEATS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      {repeats ? (
        <>
          <label className="text-xs text-muted-foreground" htmlFor="schedule-stop">
            Stop
          </label>
          <select
            id="schedule-stop"
            value={stop}
            onChange={(event) => setStop(event.target.value as Stop)}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="never">When I pause or delete it</option>
            <option value="count">After a number of runs</option>
            <option value="date">On a date</option>
          </select>
          {stop === "count" ? (
            <input
              aria-label="Number of runs"
              name="runs"
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              required
              defaultValue={row?.max_runs ?? 4}
              className="h-8 rounded-md border border-border bg-transparent px-2 text-sm"
            />
          ) : stop === "date" ? (
            <input
              aria-label={`Last day (${zone})`}
              name="until"
              type="date"
              required
              defaultValue={row?.run_until ? fieldValue(row.run_until, zone).slice(0, 10) : ""}
              className="h-8 rounded-md border border-border bg-transparent px-2 text-sm"
            />
          ) : null}
        </>
      ) : null}
      <label className="text-xs text-muted-foreground" htmlFor="schedule-device">
        Computer
      </label>
      <select
        id="schedule-device"
        name="device"
        defaultValue={row?.device_id ?? ""}
        className="h-8 rounded-md border border-border bg-background px-2 text-sm"
      >
        <option value="">Reminder only, no computer</option>
        {computers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        At its time JARVIS starts a new task on that computer and checks its permissions then. You
        are notified when it starts or if it cannot.
      </p>
      {problem ? (
        <p className="text-xs text-destructive" role="alert">
          {problem}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={save.isPending}
          className="min-h-11 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : row ? "Save changes" : "Schedule"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-11 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
