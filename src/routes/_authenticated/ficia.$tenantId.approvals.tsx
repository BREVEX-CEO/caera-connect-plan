import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, GitBranch, Send, CheckCircle2, XCircle, ShieldAlert, Loader2, Trash2, Plus } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { executeAction } from "@/lib/actions";
import {
  listApprovalPolicies,
  upsertApprovalPolicy,
  listApprovalRequests,
  submitApprovalRequest,
  decideApproval,
  releaseApproval,
  listRoles,
} from "@/lib/ficia-people.functions";

export const Route = createFileRoute("/_authenticated/ficia/$tenantId/approvals")({
  head: () => ({ meta: [{ title: "Approvals — FICIA" }, { name: "robots", content: "noindex" }] }),
  component: ApprovalsPage,
});

const SUBJECTS = ["expense", "invoice", "payroll", "tax", "files", "payments", "signatures", "export"] as const;
type Subject = typeof SUBJECTS[number];

function ApprovalsPage() {
  const { tenantId } = Route.useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"requests" | "policies">("requests");

  const requests = useQuery({ queryKey: ["ficia_approvals", tenantId], queryFn: () => listApprovalRequests({ data: { tenant_id: tenantId } }) });
  const policies = useQuery({ queryKey: ["ficia_policies", tenantId], queryFn: () => listApprovalPolicies({ data: { tenant_id: tenantId } }) });
  const roles = useQuery({ queryKey: ["ficia_roles", tenantId], queryFn: () => listRoles({ data: { tenant_id: tenantId } }) });

  const allRoles = [...((roles.data as any)?.templates ?? []), ...((roles.data as any)?.custom ?? [])];

  function refresh() {
    qc.invalidateQueries({ queryKey: ["ficia_approvals", tenantId] });
    qc.invalidateQueries({ queryKey: ["ficia_policies", tenantId] });
  }

  return (
    <AppShell>
      <div className="mb-4">
        <Link to="/ficia/$tenantId" params={{ tenantId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to company
        </Link>
      </div>
      <PageHeader
        eyebrow="FICIA — approvals"
        title="Approval chains & segregation of duties"
        description="Configure who must approve which sensitive actions (expense, invoice, payroll, tax, files, payments, signatures, exports). Segregation of duties prevents the submitter from approving or releasing without a documented override."
      />

      <GlassPanel className="p-2 mt-4 mb-4 flex gap-1">
        {(["requests", "policies"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-md text-sm capitalize ${tab === k ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
            {k}
          </button>
        ))}
      </GlassPanel>

      {tab === "requests" && (
        <>
          <SubmitForm tenantId={tenantId} onSubmitted={refresh} />
          <RequestsTable
            requests={(requests.data as any)?.requests ?? []}
            loading={requests.isLoading}
            onChange={refresh}
          />
        </>
      )}
      {tab === "policies" && (
        <PoliciesEditor tenantId={tenantId} policies={(policies.data as any)?.policies ?? []} roles={allRoles} onSaved={refresh} />
      )}
    </AppShell>
  );
}

function SubmitForm({ tenantId, onSubmitted }: { tenantId: string; onSubmitted: () => void }) {
  const [subject, setSubject] = useState<Subject>("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) { setMsg("Give it a short title."); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await executeAction("ficia.approvals.submit", {
        run: () => submitApprovalRequest({
          data: {
            tenant_id: tenantId,
            subject,
            title,
            amount: amount ? Number(amount) : undefined,
            currency: amount ? currency : undefined,
            payload: {},
          },
        }),
      });
      if (r.ok) { setTitle(""); setAmount(""); setMsg("Submitted."); onSubmitted(); }
      else setMsg(r.message);
    } finally { setBusy(false); }
  }

  return (
    <GlassPanel className="p-4 mb-4">
      <h3 className="text-sm font-semibold flex items-center gap-2"><Send className="size-4" /> New approval request</h3>
      <div className="grid gap-3 md:grid-cols-5 mt-3">
        <div className="grid gap-1">
          <Label>Subject</Label>
          <select value={subject} onChange={(e) => setSubject(e.target.value as Subject)} className="rounded-md border border-border bg-background px-2 py-2 text-sm">
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="grid gap-1 md:col-span-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q3 travel expense" /></div>
        <div className="grid gap-1"><Label>Amount (optional)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div className="grid gap-1"><Label>Currency</Label><Input maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></div>
      </div>
      <div className="mt-3">
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
          <span className="ml-1">Submit</span>
        </Button>
        {msg && <span className="text-xs text-muted-foreground ml-3">{msg}</span>}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Requires an active policy for the chosen subject. If none exists, an owner must configure one in the Policies tab.
      </p>
    </GlassPanel>
  );
}

function RequestsTable({ requests, loading, onChange }: { requests: any[]; loading: boolean; onChange: () => void }) {
  async function decide(r: any, decision: "approve" | "reject") {
    const reason = decision === "reject" ? prompt("Reason for rejection?") ?? "" : prompt("Approval note (optional):") ?? "";
    let sod = undefined;
    // Optimistic client-side SoD hint; server enforces truthfully
    const res = await executeAction(`ficia.approvals.${decision}`, {
      confirmed: true,
      run: () => decideApproval({ data: { request_id: r.id, decision, reason, sod_override_reason: sod } }),
    });
    if (!res.ok) {
      if ((res as any).code === "sod_blocked") {
        sod = prompt("Segregation of duties — you're the submitter. Type OVERRIDE on the confirm and enter a documented reason:") ?? "";
        if (!sod) return;
        const override = await executeAction("ficia.approvals.sod_override", {
          confirmed: true,
          confirmPhrase: "OVERRIDE",
          run: () => decideApproval({ data: { request_id: r.id, decision, reason, sod_override_reason: sod } }),
        });
        if (!override.ok) alert(override.message); else onChange();
      } else alert(res.message);
    } else onChange();
  }

  async function release(r: any) {
    let sod: string | undefined = undefined;
    const res = await executeAction("ficia.approvals.release", {
      confirmed: true,
      confirmPhrase: "RELEASE",
      run: () => releaseApproval({ data: { request_id: r.id, sod_override_reason: sod } }),
    });
    if (!res.ok) {
      if ((res as any).code === "sod_blocked") {
        sod = prompt("Segregation of duties — you also submitted / approved. Type OVERRIDE and give a reason:") ?? "";
        if (!sod) return;
        const override = await executeAction("ficia.approvals.sod_override", {
          confirmed: true,
          confirmPhrase: "OVERRIDE",
          run: () => releaseApproval({ data: { request_id: r.id, sod_override_reason: sod } }),
        });
        if (!override.ok) alert(override.message); else onChange();
      } else alert(res.message);
    } else onChange();
  }

  return (
    <GlassPanel className="p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b border-border">
            <th className="p-3">Title</th>
            <th className="p-3">Subject</th>
            <th className="p-3">Amount</th>
            <th className="p-3">Status</th>
            <th className="p-3">Step</th>
            <th className="p-3">SoD</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Loading…</td></tr>}
          {!loading && requests.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No requests yet.</td></tr>}
          {requests.map((r) => {
            const steps = (r.steps ?? []) as any[];
            const cur = steps[r.current_step];
            return (
              <tr key={r.id} className="border-b border-border/40 last:border-0 align-top">
                <td className="p-3 font-medium">{r.title}</td>
                <td className="p-3 capitalize">{r.subject}</td>
                <td className="p-3">{r.amount ? `${r.amount} ${r.currency ?? ""}` : "—"}</td>
                <td className="p-3">
                  <StatusBadge status={r.status === "released" ? "success" : r.status === "approved" ? "success" : r.status === "rejected" ? "planned" : "beta"}>{r.status}</StatusBadge>
                </td>
                <td className="p-3 text-xs">
                  {r.status === "pending" && cur ? `Step ${r.current_step + 1}/${steps.length}: needs ${cur.min_approvals} × ${cur.role_key}` : "—"}
                </td>
                <td className="p-3 text-xs">
                  {r.sod_override_reason ? <span title={r.sod_override_reason} className="text-warning inline-flex items-center gap-1"><ShieldAlert className="size-3" /> override</span> : "—"}
                </td>
                <td className="p-3 whitespace-nowrap text-right">
                  {r.status === "pending" && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => decide(r, "approve")}><CheckCircle2 className="size-3" /> Approve</Button>
                      <Button size="sm" variant="ghost" onClick={() => decide(r, "reject")}><XCircle className="size-3" /> Reject</Button>
                    </>
                  )}
                  {r.status === "approved" && (
                    <Button size="sm" onClick={() => release(r)}><Send className="size-3" /> Release</Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </GlassPanel>
  );
}

function PoliciesEditor({ tenantId, policies, roles, onSaved }: { tenantId: string; policies: any[]; roles: any[]; onSaved: () => void }) {
  const [subject, setSubject] = useState<Subject>("expense");
  const [minAmt, setMinAmt] = useState("");
  const [maxAmt, setMaxAmt] = useState("");
  const [currency, setCurrency] = useState("");
  const [sod, setSod] = useState(true);
  const [steps, setSteps] = useState<Array<{ role_key: string; min_approvals: number }>>([{ role_key: roles[0]?.key ?? "manager", min_approvals: 1 }]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    if (!steps.length) { setMsg("Add at least one step."); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await executeAction("ficia.approvals.policy_upsert", {
        confirmed: true,
        run: () => upsertApprovalPolicy({
          data: {
            tenant_id: tenantId,
            subject,
            currency: currency || undefined,
            min_amount: minAmt ? Number(minAmt) : undefined,
            max_amount: maxAmt ? Number(maxAmt) : undefined,
            steps,
            sod_enforced: sod,
            is_active: true,
          },
        }),
      });
      if (!r.ok) setMsg(r.message); else { setMsg("Saved."); onSaved(); }
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2"><GitBranch className="size-4" /> New / edit policy</h3>
        <div className="grid gap-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Subject</Label>
              <select value={subject} onChange={(e) => setSubject(e.target.value as Subject)} className="rounded-md border border-border bg-background px-2 py-2 text-sm">
                {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid gap-1"><Label>Currency (optional)</Label><Input maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></div>
            <div className="grid gap-1"><Label>Min amount</Label><Input type="number" value={minAmt} onChange={(e) => setMinAmt(e.target.value)} /></div>
            <div className="grid gap-1"><Label>Max amount</Label><Input type="number" value={maxAmt} onChange={(e) => setMaxAmt(e.target.value)} /></div>
          </div>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={sod} onChange={(e) => setSod(e.target.checked)} />
            Enforce segregation of duties (submitter cannot approve / release without documented override)
          </label>

          <div>
            <div className="flex items-center justify-between">
              <Label>Approval chain</Label>
              <Button size="sm" variant="outline" onClick={() => setSteps([...steps, { role_key: roles[0]?.key ?? "manager", min_approvals: 1 }])}><Plus className="size-3" /> Add step</Button>
            </div>
            <div className="mt-2 grid gap-2">
              {steps.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                  <select value={s.role_key} onChange={(e) => { const ns = [...steps]; ns[i] = { ...s, role_key: e.target.value }; setSteps(ns); }}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
                    {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                  </select>
                  <Input type="number" min={1} max={5} value={s.min_approvals} onChange={(e) => { const ns = [...steps]; ns[i] = { ...s, min_approvals: Number(e.target.value) }; setSteps(ns); }} className="w-16" />
                  <Button size="sm" variant="ghost" onClick={() => setSteps(steps.filter((_, j) => j !== i))}><Trash2 className="size-3" /></Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={save} disabled={busy}>{busy ? <Loader2 className="size-3 animate-spin" /> : <GitBranch className="size-3" />}<span className="ml-1">Save policy</span></Button>
            {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold">Active policies ({policies.length})</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {policies.length === 0 && <li className="text-xs text-muted-foreground">No policies yet.</li>}
          {policies.map((p) => (
            <li key={p.id} className="border border-border rounded-md p-2">
              <div className="flex items-center justify-between">
                <div className="capitalize font-medium">{p.subject}</div>
                {p.sod_enforced ? <StatusBadge status="success">SoD on</StatusBadge> : <StatusBadge status="planned">SoD off</StatusBadge>}
              </div>
              <div className="text-xs text-muted-foreground">
                {p.min_amount != null && <>Min {p.min_amount} </>}{p.max_amount != null && <>Max {p.max_amount} </>}{p.currency ?? ""}
              </div>
              <div className="text-xs mt-1">
                Chain: {(p.steps ?? []).map((s: any, i: number) => `${i + 1}. ${s.min_approvals}×${s.role_key}`).join(" → ")}
              </div>
            </li>
          ))}
        </ul>
      </GlassPanel>
    </div>
  );
}
