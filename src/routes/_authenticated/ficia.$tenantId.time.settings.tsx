import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Plus } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { executeAction } from "@/lib/actions";
import { getPolicy, savePolicy, listProjects, upsertProject, listTasks, upsertTask } from "@/lib/timesheet.functions";

export const Route = createFileRoute("/_authenticated/ficia/$tenantId/time/settings")({
  head: () => ({ meta: [{ title: "Timesheet Settings — FICIA" }, { name: "robots", content: "noindex" }] }),
  component: TimeSettingsPage,
});

function TimeSettingsPage() {
  const { tenantId } = Route.useParams();
  const qc = useQueryClient();
  const policyQ = useQuery({ queryKey: ["time.policy", tenantId], queryFn: () => getPolicy({ data: { tenant_id: tenantId } }) });
  const projectsQ = useQuery({ queryKey: ["time.projects", tenantId], queryFn: () => listProjects({ data: { tenant_id: tenantId } }) });

  return (
    <AppShell>
      <div className="mb-4">
        <Link to="/ficia/$tenantId/time" params={{ tenantId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Timesheets
        </Link>
      </div>
      <PageHeader eyebrow="FICIA — Time" title="Timesheet settings" description="Workdays, shifts, breaks, holidays, overtime, billable policy and idle threshold." />

      <div className="grid gap-4 mt-4 lg:grid-cols-2">
        <GlassPanel className="p-5">
          <h3 className="text-sm font-semibold mb-3">Company time policy</h3>
          {policyQ.isLoading ? <Loader2 className="size-4 animate-spin" /> : (
            <PolicyForm
              tenantId={tenantId}
              initial={policyQ.data?.policy ?? null}
              onSaved={() => qc.invalidateQueries({ queryKey: ["time.policy", tenantId] })}
            />
          )}
        </GlassPanel>

        <GlassPanel className="p-5">
          <h3 className="text-sm font-semibold mb-3">Projects & tasks</h3>
          <ProjectsEditor
            tenantId={tenantId}
            projects={projectsQ.data?.projects ?? []}
            onChanged={() => qc.invalidateQueries({ queryKey: ["time.projects", tenantId] })}
          />
        </GlassPanel>
      </div>
    </AppShell>
  );
}

function PolicyForm({ tenantId, initial, onSaved }: { tenantId: string; initial: any; onSaved: () => void }) {
  const [timezone, setTimezone] = useState(initial?.timezone ?? "Asia/Kolkata");
  const [workdays, setWorkdays] = useState<number[]>(initial?.workdays ?? [1,2,3,4,5]);
  const [dailyMin, setDailyMin] = useState<number>(initial?.default_daily_minutes ?? 480);
  const [weeklyMin, setWeeklyMin] = useState<number>(initial?.default_weekly_minutes ?? 2400);
  const [idle, setIdle] = useState<number>(initial?.idle_threshold_minutes ?? 10);
  const [autoPause, setAutoPause] = useState<boolean>(initial?.auto_pause_enabled ?? true);
  const [otEnabled, setOtEnabled] = useState<boolean>(initial?.overtime_enabled ?? true);
  const [otAfter, setOtAfter] = useState<number>(initial?.overtime_after_minutes_daily ?? 480);
  const [otMult, setOtMult] = useState<number>(initial?.overtime_multiplier ?? 1.5);
  const [billableDefault, setBillableDefault] = useState<boolean>(initial?.billable_default ?? false);
  const [holidays, setHolidays] = useState<string>((initial?.holidays ?? []).join("\n"));
  const [shifts, setShifts] = useState<string>(JSON.stringify(initial?.shifts ?? [{ name: "Standard", start: "09:00", end: "18:00", break_minutes: 60 }], null, 2));
  const [busy, setBusy] = useState(false);

  const days = [
    { v: 0, l: "Sun" }, { v: 1, l: "Mon" }, { v: 2, l: "Tue" }, { v: 3, l: "Wed" },
    { v: 4, l: "Thu" }, { v: 5, l: "Fri" }, { v: 6, l: "Sat" },
  ];

  async function save() {
    setBusy(true);
    try {
      let parsedShifts: any = [];
      try { parsedShifts = JSON.parse(shifts); } catch { toast.error("Shifts JSON is invalid."); setBusy(false); return; }
      const holArr = holidays.split("\n").map((s) => s.trim()).filter(Boolean);

      const res = await executeAction("ficia.time.policy.save", {
        confirmed: true, tenantId,
        run: () => savePolicy({ data: {
          tenant_id: tenantId,
          policy: {
            timezone, workdays, default_daily_minutes: dailyMin, default_weekly_minutes: weeklyMin,
            idle_threshold_minutes: idle, auto_pause_enabled: autoPause,
            overtime_enabled: otEnabled, overtime_after_minutes_daily: otAfter, overtime_multiplier: otMult,
            billable_default: billableDefault, shifts: parsedShifts, holidays: holArr,
          },
        } }),
      });
      if ((res as any).ok === false) toast.error((res as any).message);
      else { toast.success("Time policy saved."); onSaved(); }
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-1"><Label>Timezone</Label><Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Kolkata" /></div>
        <div className="grid gap-1"><Label>Idle threshold (min)</Label><Input type="number" min={1} value={idle} onChange={(e) => setIdle(Number(e.target.value))} /></div>
      </div>
      <div>
        <Label>Workdays</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {days.map((d) => (
            <label key={d.v} className="inline-flex items-center gap-1 text-sm">
              <input type="checkbox" checked={workdays.includes(d.v)} onChange={(e) => {
                setWorkdays((cur) => e.target.checked ? [...cur, d.v].sort() : cur.filter((x) => x !== d.v));
              }} /> {d.l}
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-1"><Label>Default daily minutes</Label><Input type="number" value={dailyMin} onChange={(e) => setDailyMin(Number(e.target.value))} /></div>
        <div className="grid gap-1"><Label>Default weekly minutes</Label><Input type="number" value={weeklyMin} onChange={(e) => setWeeklyMin(Number(e.target.value))} /></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoPause} onChange={(e) => setAutoPause(e.target.checked)} /> Auto-pause on idle</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={otEnabled} onChange={(e) => setOtEnabled(e.target.checked)} /> Overtime enabled</label>
      {otEnabled && (
        <div className="grid gap-2 md:grid-cols-2">
          <div className="grid gap-1"><Label>Overtime after (min/day)</Label><Input type="number" value={otAfter} onChange={(e) => setOtAfter(Number(e.target.value))} /></div>
          <div className="grid gap-1"><Label>Overtime multiplier</Label><Input type="number" step="0.1" value={otMult} onChange={(e) => setOtMult(Number(e.target.value))} /></div>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={billableDefault} onChange={(e) => setBillableDefault(e.target.checked)} /> New entries default to billable</label>
      <div className="grid gap-1"><Label>Shifts (JSON array)</Label><Textarea rows={5} value={shifts} onChange={(e) => setShifts(e.target.value)} className="font-mono text-xs" /></div>
      <div className="grid gap-1"><Label>Holidays (one YYYY-MM-DD per line)</Label><Textarea rows={4} value={holidays} onChange={(e) => setHolidays(e.target.value)} className="font-mono text-xs" /></div>
      <div><Button size="sm" onClick={save} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 mr-1" />} Save policy</Button></div>
    </div>
  );
}

function ProjectsEditor({ tenantId, projects, onChanged }: { tenantId: string; projects: any[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [client, setClient] = useState("");
  const [billable, setBillable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) { toast.error("Name required."); return; }
    setBusy(true);
    try {
      const res = await executeAction("ficia.time.project.upsert", {
        confirmed: true, tenantId,
        run: () => upsertProject({ data: { tenant_id: tenantId, project: { name, code: code || null, client_name: client || null, billable_default: billable } } }),
      });
      if ((res as any).ok === false) toast.error((res as any).message);
      else { setName(""); setCode(""); setClient(""); setBillable(false); onChanged(); }
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 md:grid-cols-2">
        <div className="grid gap-1"><Label>Project name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid gap-1"><Label>Code (optional)</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
        <div className="grid gap-1"><Label>Client (optional)</Label><Input value={client} onChange={(e) => setClient(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} /> Billable by default</label>
      </div>
      <div><Button size="sm" onClick={create} disabled={busy}><Plus className="size-4 mr-1" /> Add project</Button></div>

      <ul className="mt-2 divide-y divide-border/40">
        {projects.map((p) => (
          <li key={p.id} className="py-2 text-sm">
            <button className="w-full text-left flex items-center gap-2" onClick={() => setSelected(selected === p.id ? null : p.id)}>
              <span className="font-medium">{p.name}</span>
              {p.code && <span className="text-xs text-muted-foreground">· {p.code}</span>}
              {p.client_name && <span className="text-xs text-muted-foreground">· {p.client_name}</span>}
              {p.billable_default && <span className="text-xs text-[color:var(--state-info)] ml-auto">billable</span>}
            </button>
            {selected === p.id && <TasksEditor tenantId={tenantId} projectId={p.id} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TasksEditor({ tenantId, projectId }: { tenantId: string; projectId: string }) {
  const qc = useQueryClient();
  const tasksQ = useQuery({ queryKey: ["time.tasks", tenantId, projectId], queryFn: () => listTasks({ data: { tenant_id: tenantId, project_id: projectId } }) });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await executeAction("ficia.time.task.upsert", {
        confirmed: true, tenantId,
        run: () => upsertTask({ data: { tenant_id: tenantId, task: { project_id: projectId, name } } }),
      });
      setName("");
      qc.invalidateQueries({ queryKey: ["time.tasks", tenantId, projectId] });
    } finally { setBusy(false); }
  }
  return (
    <div className="mt-2 ml-3 border-l border-border/40 pl-3">
      <div className="flex gap-2">
        <Input placeholder="New task name" value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
        <Button size="sm" variant="outline" onClick={add} disabled={busy}>Add</Button>
      </div>
      <ul className="mt-2 text-xs text-muted-foreground">
        {(tasksQ.data?.tasks ?? []).map((t: any) => <li key={t.id}>· {t.name}</li>)}
      </ul>
    </div>
  );
}
