import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Play, Square, Coffee, Plus, Send, Trash2, Settings2, ClipboardCheck, BarChart3, Loader2, ShieldCheck, ShieldAlert,
} from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { executeAction } from "@/lib/actions";
import {
  getPolicy, getMyConsent, saveConsent, revokeConsent,
  getRunningEntry, clockIn, clockOut, startBreak, endBreak,
  addManualEntry, updateEntry, deleteEntry, submitEntries,
  listEntries, listProjects, listTasks, recordActivitySamples,
} from "@/lib/timesheet.functions";

export const Route = createFileRoute("/_authenticated/ficia/$tenantId/time")({
  head: () => ({ meta: [{ title: "Timesheets — FICIA" }, { name: "robots", content: "noindex" }] }),
  component: TimesheetPage,
});

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function todayISO(tz?: string) {
  try {
    if (tz) {
      const d = new Date().toLocaleDateString("en-CA", { timeZone: tz });
      return d;
    }
  } catch { /* fall through */ }
  return new Date().toISOString().slice(0, 10);
}

function startOfWeekISO(tz?: string) {
  const today = new Date(todayISO(tz));
  const day = (today.getUTCDay() + 6) % 7; // Monday = 0
  today.setUTCDate(today.getUTCDate() - day);
  return today.toISOString().slice(0, 10);
}

function TimesheetPage() {
  const { tenantId } = Route.useParams();
  const qc = useQueryClient();

  const policyQ = useQuery({
    queryKey: ["time.policy", tenantId],
    queryFn: () => getPolicy({ data: { tenant_id: tenantId } }),
  });
  const consentQ = useQuery({
    queryKey: ["time.consent", tenantId],
    queryFn: () => getMyConsent({ data: { tenant_id: tenantId } }),
  });
  const runningQ = useQuery({
    queryKey: ["time.running", tenantId],
    queryFn: () => getRunningEntry({ data: { tenant_id: tenantId } }),
    refetchInterval: 15_000,
  });
  const projectsQ = useQuery({
    queryKey: ["time.projects", tenantId],
    queryFn: () => listProjects({ data: { tenant_id: tenantId } }),
  });

  const tz = (policyQ.data?.policy as any)?.timezone ?? "UTC";
  const weekStart = startOfWeekISO(tz);
  const weekEnd = todayISO(tz);

  const weekQ = useQuery({
    queryKey: ["time.week", tenantId, weekStart, weekEnd],
    queryFn: () => listEntries({ data: { tenant_id: tenantId, from: weekStart, to: weekEnd } }),
  });

  const consent = consentQ.data?.consent ?? null;
  const running = runningQ.data?.entry ?? null;
  const policy = policyQ.data?.policy;

  // ---------- Live timer clock ----------
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running?.id]);

  const runningSecs = useMemo(() => {
    if (!running) return 0;
    const start = new Date(running.started_at).getTime();
    let breakMs = 0;
    for (const b of (running.breaks ?? []) as Array<{ start: string; end?: string }>) {
      const bs = new Date(b.start).getTime();
      const be = b.end ? new Date(b.end).getTime() : now;
      breakMs += Math.max(0, be - bs);
    }
    return Math.max(0, Math.floor((now - start - breakMs) / 1000));
  }, [now, running]);

  const onBreak = !!((running?.breaks ?? []) as Array<{ start: string; end?: string }>).some((b) => !b.end);

  // ---------- Idle / activity monitoring (consent-gated) ----------
  const lastActiveRef = useRef(Date.now());
  const samplesBufferRef = useRef<Array<{ at: string; state: any; idle_seconds: number; window_focus: boolean }>>([]);
  useEffect(() => {
    if (!running || !consent?.activity_monitoring) return;
    const bump = () => { lastActiveRef.current = Date.now(); };
    const onVis = () => {
      const state = document.visibilityState === "hidden" ? "minimized" : "active";
      samplesBufferRef.current.push({
        at: new Date().toISOString(), state,
        idle_seconds: Math.floor((Date.now() - lastActiveRef.current) / 1000),
        window_focus: document.hasFocus(),
      });
    };
    window.addEventListener("mousemove", bump);
    window.addEventListener("keydown", bump);
    window.addEventListener("touchstart", bump);
    document.addEventListener("visibilitychange", onVis);
    const sampleTimer = setInterval(() => {
      const idleSec = Math.floor((Date.now() - lastActiveRef.current) / 1000);
      const state = document.visibilityState === "hidden" ? "minimized" :
                    idleSec > 60 ? "idle" : "active";
      samplesBufferRef.current.push({
        at: new Date().toISOString(), state, idle_seconds: idleSec, window_focus: document.hasFocus(),
      });
    }, 30_000);
    const flushTimer = setInterval(async () => {
      if (samplesBufferRef.current.length === 0) return;
      const batch = samplesBufferRef.current.splice(0);
      try {
        await recordActivitySamples({ data: { tenant_id: tenantId, entry_id: running.id, samples: batch } });
      } catch (e) { console.warn("[timesheet] sample flush failed", e); }
    }, 60_000);
    // Auto-pause loop
    const autoTimer = policy?.auto_pause_enabled && consent.auto_pause ? setInterval(async () => {
      const idleMin = (Date.now() - lastActiveRef.current) / 60000;
      const threshold = policy?.idle_threshold_minutes ?? 10;
      if (idleMin >= threshold) {
        const lastActive = new Date(lastActiveRef.current).toISOString();
        try {
          await executeAction("ficia.time.auto_pause", {
            confirmed: true,
            tenantId,
            metadata: { entry_id: running.id, idle_minutes: Math.round(idleMin) },
            run: () => clockOut({ data: { tenant_id: tenantId, entry_id: running.id, at: lastActive, reason: "auto_pause" } }),
          });
          toast("Timer auto-paused — you were idle beyond the company threshold.");
          qc.invalidateQueries({ queryKey: ["time.running", tenantId] });
          qc.invalidateQueries({ queryKey: ["time.week", tenantId] });
        } catch (e) { console.warn("[timesheet] auto-pause failed", e); }
      }
    }, 60_000) : undefined;

    return () => {
      window.removeEventListener("mousemove", bump);
      window.removeEventListener("keydown", bump);
      window.removeEventListener("touchstart", bump);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(sampleTimer);
      clearInterval(flushTimer);
      if (autoTimer) clearInterval(autoTimer);
    };
  }, [running?.id, consent?.activity_monitoring, consent?.auto_pause, policy?.idle_threshold_minutes, policy?.auto_pause_enabled, qc, tenantId]);

  // ---------- Actions ----------
  const [busy, setBusy] = useState<string | null>(null);
  async function run(id: string, fn: () => Promise<any>, opts: { confirmPhrase?: string } = {}) {
    setBusy(id);
    try {
      const res = await executeAction(id, { confirmed: true, tenantId, run: fn, ...opts });
      if (res && (res as any).ok === false) toast.error((res as any).message ?? "Failed");
      else {
        qc.invalidateQueries({ queryKey: ["time.running", tenantId] });
        qc.invalidateQueries({ queryKey: ["time.week", tenantId] });
      }
    } catch (e: any) { toast.error(e?.message ?? String(e)); }
    finally { setBusy(null); }
  }

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link to="/ficia/$tenantId" params={{ tenantId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Company workspace
        </Link>
        <div className="flex gap-2">
          <Link to="/ficia/$tenantId/time/approvals" params={{ tenantId }}>
            <Button size="sm" variant="outline"><ClipboardCheck className="size-4 mr-1" /> Approvals</Button>
          </Link>
          <Link to="/ficia/$tenantId/time/reports" params={{ tenantId }}>
            <Button size="sm" variant="outline"><BarChart3 className="size-4 mr-1" /> Reports</Button>
          </Link>
          <Link to="/ficia/$tenantId/time/settings" params={{ tenantId }}>
            <Button size="sm" variant="outline"><Settings2 className="size-4 mr-1" /> Settings</Button>
          </Link>
        </div>
      </div>
      <PageHeader eyebrow="FICIA — Timesheets" title="My timesheet" description={`Timezone: ${tz} · Week of ${weekStart}`} />

      {/* Consent gate */}
      {!consent ? (
        <ConsentGate tenantId={tenantId} onSaved={() => qc.invalidateQueries({ queryKey: ["time.consent", tenantId] })} />
      ) : (
        <div className="grid gap-4 mt-4 lg:grid-cols-3">
          <GlassPanel className="p-5 lg:col-span-2">
            <div className="flex items-center gap-3">
              <StatusBadge status={running ? (onBreak ? "paused" : "running") : "planned"}>
                {running ? (onBreak ? "On break" : "Running") : "Stopped"}
              </StatusBadge>
              <span className="font-mono text-3xl tabular-nums">{fmt(runningSecs)}</span>
              {consent.activity_monitoring && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5" /> Activity monitoring on · auto-pause at {policy?.idle_threshold_minutes ?? 10} min
                </span>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {!running && (
                <Button size="sm" disabled={busy === "clock_in"} onClick={() =>
                  run("ficia.time.clock_in", () => clockIn({ data: { tenant_id: tenantId, ai_time_source: "manual" } }))
                }>
                  {busy === "clock_in" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Clock in
                </Button>
              )}
              {running && !onBreak && (
                <>
                  <Button size="sm" variant="outline" disabled={busy === "break"} onClick={() =>
                    run("ficia.time.break_start", () => startBreak({ data: { tenant_id: tenantId, entry_id: running.id } }))
                  }><Coffee className="size-4 mr-1" /> Start break</Button>
                  <Button size="sm" variant="destructive" disabled={busy === "clock_out"} onClick={() =>
                    run("ficia.time.clock_out", () => clockOut({ data: { tenant_id: tenantId, entry_id: running.id, reason: "manual" } }))
                  }><Square className="size-4 mr-1" /> Clock out</Button>
                </>
              )}
              {running && onBreak && (
                <Button size="sm" onClick={() =>
                  run("ficia.time.break_end", () => endBreak({ data: { tenant_id: tenantId, entry_id: running.id } }))
                }>End break</Button>
              )}
            </div>

            {running && (
              <RunningDetails
                tenantId={tenantId}
                entry={running}
                projects={projectsQ.data?.projects ?? []}
                onChange={() => qc.invalidateQueries({ queryKey: ["time.running", tenantId] })}
              />
            )}
          </GlassPanel>

          <GlassPanel className="p-5">
            <h3 className="text-sm font-semibold">Add manual entry</h3>
            <ManualEntryForm
              tenantId={tenantId}
              projects={projectsQ.data?.projects ?? []}
              onCreated={() => {
                qc.invalidateQueries({ queryKey: ["time.week", tenantId] });
              }}
            />
          </GlassPanel>

          <GlassPanel className="p-5 lg:col-span-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">This week</h3>
              <ConsentBadge consent={consent} onRevoke={async () => {
                await executeAction("ficia.time.consent.revoke", {
                  confirmed: true, tenantId,
                  run: () => revokeConsent({ data: { tenant_id: tenantId } }),
                });
                qc.invalidateQueries({ queryKey: ["time.consent", tenantId] });
              }} />
            </div>
            <WeekEntries
              tenantId={tenantId}
              entries={weekQ.data?.entries ?? []}
              onChanged={() => qc.invalidateQueries({ queryKey: ["time.week", tenantId] })}
            />
          </GlassPanel>
        </div>
      )}
    </AppShell>
  );
}

// ---------- Consent gate ----------

const CONSENT_TERMS =
  "I understand CAERA CADANE records only my clock events, break windows and — if I opt in below — active / idle / minimized / closed window states used to auto-pause the timer. Screens, keystrokes and window titles are never captured without a per-session opt-in and a visible indicator. I can revoke consent at any time.";

function ConsentGate({ tenantId, onSaved }: { tenantId: string; onSaved: () => void }) {
  const [activity, setActivity] = useState(true);
  const [autoPause, setAutoPause] = useState(true);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <GlassPanel className="mt-6 p-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-4 text-[color:var(--state-warning)]" />
        <h3 className="text-sm font-semibold">Timesheet consent required</h3>
      </div>
      <p className="text-sm text-muted-foreground mt-2">{CONSENT_TERMS}</p>
      <div className="grid gap-2 mt-4 text-sm">
        <label className="flex items-start gap-2"><input type="checkbox" checked={activity} onChange={(e) => setActivity(e.target.checked)} className="mt-1" />
          <span>Detect active / idle / minimized / closed states while the timer runs. Nothing else is captured.</span></label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={autoPause} onChange={(e) => setAutoPause(e.target.checked)} className="mt-1" />
          <span>Auto-pause the timer when I am idle past the company threshold.</span></label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={recording} onChange={(e) => setRecording(e.target.checked)} className="mt-1" />
          <span>Make per-session screen recording available. Each recording still needs a fresh opt-in and shows a red indicator.</span></label>
      </div>
      <div className="mt-4 flex gap-2">
        <Button size="sm" disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            const res = await executeAction("ficia.time.consent.save", {
              confirmed: true, tenantId,
              run: () => saveConsent({ data: {
                tenant_id: tenantId,
                activity_monitoring: activity,
                auto_pause: autoPause,
                screen_recording_optin: recording,
                accepted_terms: CONSENT_TERMS,
                user_agent: navigator.userAgent,
              } }),
            });
            if ((res as any).ok === false) toast.error((res as any).message);
            else { toast.success("Consent recorded."); onSaved(); }
          } catch (e: any) { toast.error(e?.message ?? String(e)); }
          finally { setBusy(false); }
        }}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Accept & continue"}</Button>
      </div>
    </GlassPanel>
  );
}

function ConsentBadge({ consent, onRevoke }: { consent: any; onRevoke: () => void }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">Consent: {new Date(consent.accepted_at).toLocaleDateString()}</span>
      <Button size="sm" variant="ghost" onClick={onRevoke}>Revoke</Button>
    </div>
  );
}

// ---------- Running entry classification ----------

function RunningDetails({ tenantId, entry, projects, onChange }: {
  tenantId: string; entry: any; projects: any[]; onChange: () => void;
}) {
  const [projectId, setProjectId] = useState<string>(entry.project_id ?? "");
  const [taskId, setTaskId] = useState<string>(entry.task_id ?? "");
  const [description, setDescription] = useState(entry.description ?? "");
  const [billable, setBillable] = useState<boolean>(!!entry.billable);
  const [mode, setMode] = useState<string>(entry.work_mode ?? "");
  const [busy, setBusy] = useState(false);

  const tasksQ = useQuery({
    queryKey: ["time.tasks", tenantId, projectId],
    queryFn: () => listTasks({ data: { tenant_id: tenantId, project_id: projectId || undefined } }),
    enabled: !!projectId,
  });

  async function save() {
    setBusy(true);
    try {
      await executeAction("ficia.time.entry.update", {
        confirmed: true, tenantId,
        run: () => updateEntry({ data: {
          tenant_id: tenantId, id: entry.id,
          patch: {
            project_id: projectId || null,
            task_id: taskId || null,
            description: description || null,
            billable,
            work_mode: (mode as any) || null,
          },
        } }),
      });
      onChange();
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      <div className="grid gap-1"><Label>Project</Label>
        <select className="h-9 rounded-md border border-border bg-background px-2 text-sm" value={projectId} onChange={(e) => { setProjectId(e.target.value); setTaskId(""); }}>
          <option value="">— None —</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.client_name ? ` · ${p.client_name}` : ""}</option>)}
        </select>
      </div>
      <div className="grid gap-1"><Label>Task</Label>
        <select className="h-9 rounded-md border border-border bg-background px-2 text-sm" value={taskId} onChange={(e) => setTaskId(e.target.value)} disabled={!projectId}>
          <option value="">— None —</option>
          {(tasksQ.data?.tasks ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="grid gap-1 md:col-span-2"><Label>Description</Label>
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What are you doing right now?" />
      </div>
      <div className="grid gap-1"><Label>Work mode</Label>
        <select className="h-9 rounded-md border border-border bg-background px-2 text-sm" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="">—</option>
          <option value="office">Office</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="field">Field</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} /> Billable to client</label>
      <div className="md:col-span-2"><Button size="sm" onClick={save} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Save details"}</Button></div>
    </div>
  );
}

// ---------- Manual entry form ----------

function ManualEntryForm({ tenantId, projects, onCreated }: { tenantId: string; projects: any[]; onCreated: () => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [projectId, setProjectId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [billable, setBillable] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (description.trim().length < 3) { toast.error("Description is required."); return; }
    setBusy(true);
    try {
      const started = new Date(`${date}T${start}:00`).toISOString();
      const ended = new Date(`${date}T${end}:00`).toISOString();
      const res = await executeAction("ficia.time.manual_entry", {
        confirmed: true, tenantId,
        run: () => addManualEntry({ data: {
          tenant_id: tenantId, entry_date: date, started_at: started, ended_at: ended,
          break_seconds: 0, project_id: projectId || null, description, billable,
        } }),
      });
      if ((res as any).ok === false) toast.error((res as any).message);
      else { toast.success("Entry added."); setDescription(""); onCreated(); }
    } catch (e: any) { toast.error(e?.message ?? String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid gap-2 mt-3 text-sm">
      <div className="grid grid-cols-3 gap-2">
        <div className="grid gap-1"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="grid gap-1"><Label>Start</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="grid gap-1"><Label>End</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
      <div className="grid gap-1"><Label>Project</Label>
        <select className="h-9 rounded-md border border-border bg-background px-2 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">— None —</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="grid gap-1"><Label>What did you do?</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} /> Billable</label>
      <Button size="sm" onClick={submit} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4 mr-1" />} Add entry
      </Button>
      <p className="text-xs text-muted-foreground">Manual entries are marked as manual in the audit trail. They still need approval.</p>
    </div>
  );
}

// ---------- Week list ----------

function WeekEntries({ tenantId, entries, onChanged }: { tenantId: string; entries: any[]; onChanged: () => void }) {
  const mine = entries; // RLS scopes to caller unless manager
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const drafts = mine.filter((e) => e.status === "draft" || e.status === "rejected");
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  async function submit() {
    if (selectedIds.length === 0) { toast.error("Select at least one entry."); return; }
    const res = await executeAction("ficia.time.entry.submit", {
      confirmed: true, tenantId,
      run: () => submitEntries({ data: { tenant_id: tenantId, ids: selectedIds } }),
    });
    if ((res as any).ok === false) toast.error((res as any).message);
    else { toast.success(`Submitted ${(res as any).count} entries.`); setSelected({}); onChanged(); }
  }

  async function del(id: string) {
    const res = await executeAction("ficia.time.entry.delete", {
      confirmed: true, tenantId,
      run: () => deleteEntry({ data: { tenant_id: tenantId, id } }),
    });
    if ((res as any).ok === false) toast.error((res as any).message);
    else onChanged();
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 mb-2">
        <Button size="sm" onClick={submit} disabled={selectedIds.length === 0}>
          <Send className="size-4 mr-1" /> Submit selected ({selectedIds.length})
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          Total: {fmt(mine.reduce((a, e) => a + (e.duration_seconds ?? 0), 0))}
        </span>
      </div>
      {mine.length === 0 && <p className="text-sm text-muted-foreground">No entries this week yet.</p>}
      <ul className="divide-y divide-border/40">
        {mine.map((e) => (
          <li key={e.id} className="py-2 flex items-center gap-3 text-sm">
            {(e.status === "draft" || e.status === "rejected") && (
              <input type="checkbox" checked={!!selected[e.id]} onChange={(ev) => setSelected((s) => ({ ...s, [e.id]: ev.target.checked }))} />
            )}
            <span className="w-24 text-muted-foreground">{e.entry_date}</span>
            <span className="font-mono w-20 tabular-nums">{fmt(e.duration_seconds ?? 0)}</span>
            <StatusBadge status={
              e.status === "approved" || e.status === "locked" ? "success"
              : e.status === "rejected" ? "failed"
              : e.status === "submitted" ? "pending" : "planned"
            }>{e.status}</StatusBadge>
            <span className="text-xs text-muted-foreground uppercase">{e.source}</span>
            {e.billable && <span className="text-xs text-[color:var(--state-info)]">billable</span>}
            <span className="truncate flex-1">{e.description ?? <span className="text-muted-foreground italic">no description</span>}</span>
            {e.rejected_reason && <span className="text-xs text-destructive">↻ {e.rejected_reason}</span>}
            {(e.status === "draft") && (
              <Button size="sm" variant="ghost" onClick={() => del(e.id)}><Trash2 className="size-3.5" /></Button>
            )}
          </li>
        ))}
      </ul>
      {drafts.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2">{drafts.length} draft / rejected entries ready to submit.</p>
      )}
    </div>
  );
}
