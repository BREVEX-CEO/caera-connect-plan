import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck, Plus, Loader2, X } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { executeAction } from "@/lib/actions";
import {
  listRoles,
  upsertCustomRole,
  grantRole,
  revokeRole,
  listPeople,
} from "@/lib/ficia-people.functions";

export const Route = createFileRoute("/_authenticated/ficia/$tenantId/roles")({
  head: () => ({ meta: [{ title: "Roles — FICIA" }, { name: "robots", content: "noindex" }] }),
  component: RolesPage,
});

const PERMISSION_CATALOG = [
  ["ficia.people.view", "See people list"],
  ["ficia.people.manage", "Invite / suspend / terminate people"],
  ["ficia.roles.manage", "Create custom roles and grant roles"],
  ["ficia.expense.view", "View expenses"],
  ["ficia.expense.create", "Create expenses"],
  ["ficia.expense.approve", "Approve expenses"],
  ["ficia.invoice.view", "View invoices"],
  ["ficia.invoice.create", "Create invoices"],
  ["ficia.invoice.approve", "Approve invoices"],
  ["ficia.payroll.view", "View payroll"],
  ["ficia.payroll.prepare", "Prepare payroll"],
  ["ficia.payroll.release", "Release payroll payments"],
  ["ficia.tax.view", "View tax"],
  ["ficia.tax.prepare", "Prepare tax filings"],
  ["ficia.tax.approve", "Approve tax filings"],
  ["ficia.payments.view", "View payments"],
  ["ficia.payments.approve", "Approve payments"],
  ["ficia.payments.release", "Release payments"],
  ["ficia.signatures.approve", "Approve signatures"],
  ["ficia.files.view", "View files"],
  ["ficia.files.approve", "Approve files"],
  ["ficia.export.approve", "Approve sensitive exports"],
  ["ficia.reports.view", "View reports"],
  ["ficia.audit.view", "View audit trail"],
] as const;

function RolesPage() {
  const { tenantId } = Route.useParams();
  const qc = useQueryClient();
  const roles = useQuery({
    queryKey: ["ficia_roles", tenantId],
    queryFn: () => listRoles({ data: { tenant_id: tenantId } }),
  });
  const people = useQuery({
    queryKey: ["ficia_people", tenantId],
    queryFn: () => listPeople({ data: { tenant_id: tenantId } }),
  });

  const templates = (roles.data as any)?.templates ?? [];
  const custom = (roles.data as any)?.custom ?? [];
  const grants: any[] = (roles.data as any)?.grants ?? [];
  const allRoles = useMemo(() => [...templates, ...custom], [templates, custom]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["ficia_roles", tenantId] });
  }

  return (
    <AppShell>
      <div className="mb-4">
        <Link
          to="/ficia/$tenantId"
          params={{ tenantId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to company
        </Link>
      </div>
      <PageHeader
        eyebrow="FICIA — roles"
        title="Roles, templates & permissions"
        description="Multiple roles per user. Multiple users per role. Templates seed common roles (CEO, CA, CMA, accountant, payroll, HR, tax, auditor, finance, treasury, procurement, manager, employee, consultant, advisor). Copy any template to a custom role and tune permissions."
      />

      <div className="grid gap-4 lg:grid-cols-3 mt-6">
        <TemplateList templates={templates} tenantId={tenantId} onCloned={refresh} />
        <CustomRoleEditor tenantId={tenantId} custom={custom} onSaved={refresh} />
        <RoleGrants
          tenantId={tenantId}
          people={(people.data as any)?.people ?? []}
          roles={allRoles}
          grants={grants}
          onChange={refresh}
        />
      </div>
    </AppShell>
  );
}

function TemplateList({
  templates,
  tenantId,
  onCloned,
}: {
  templates: any[];
  tenantId: string;
  onCloned: () => void;
}) {
  async function clone(t: any) {
    const key = prompt(`Custom role key (a-z, digits, underscore):`, t.key);
    if (!key) return;
    const r = await executeAction("ficia.roles.upsert", {
      confirmed: true,
      run: () =>
        upsertCustomRole({
          data: {
            tenant_id: tenantId,
            key,
            name: `${t.name} (custom)`,
            description: t.description ?? undefined,
            permissions: t.permissions ?? {},
          },
        }),
    });
    if (!r.ok) alert(r.message);
    else onCloned();
  }
  return (
    <GlassPanel className="p-4">
      <h3 className="text-sm font-semibold">Templates</h3>
      <ul className="mt-2 space-y-1 text-sm max-h-96 overflow-y-auto">
        {templates.map((t) => (
          <li
            key={t.key}
            className="flex items-center justify-between border-b border-border/40 py-1.5"
          >
            <div>
              <div className="font-medium">{t.name}</div>
              <div className="text-xs text-muted-foreground">
                {Object.keys(t.permissions ?? {}).length} permissions
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => clone(t)}>
              Clone
            </Button>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}

function CustomRoleEditor({
  tenantId,
  custom,
  onSaved,
}: {
  tenantId: string;
  custom: any[];
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(custom[0]?.key ?? null);
  const current = custom.find((c) => c.key === selected);
  const [key, setKey] = useState(current?.key ?? "");
  const [name, setName] = useState(current?.name ?? "");
  const [desc, setDesc] = useState(current?.description ?? "");
  const [perms, setPerms] = useState<Record<string, boolean>>(current?.permissions ?? {});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function reset(c: any) {
    setSelected(c.key);
    setKey(c.key);
    setName(c.name);
    setDesc(c.description ?? "");
    setPerms(c.permissions ?? {});
  }
  function newRole() {
    setSelected(null);
    setKey("");
    setName("");
    setDesc("");
    setPerms({});
  }

  async function save() {
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      setMsg("Key must be lowercase letters, digits, underscore.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await executeAction("ficia.roles.upsert", {
        confirmed: true,
        run: () =>
          upsertCustomRole({
            data: {
              tenant_id: tenantId,
              key,
              name,
              description: desc || undefined,
              permissions: perms,
            },
          }),
      });
      if (!r.ok) setMsg(r.message);
      else {
        setMsg("Saved.");
        onSaved();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassPanel className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Custom roles</h3>
        <Button size="sm" variant="outline" onClick={newRole}>
          <Plus className="size-3" /> New
        </Button>
      </div>
      {custom.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2">
          {custom.map((c) => (
            <button
              key={c.key}
              onClick={() => reset(c)}
              className={`px-2 py-1 text-xs rounded-md border ${selected === c.key ? "border-primary bg-primary/10" : "border-border"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-2 mt-3">
        <div className="grid gap-1">
          <Label>Key</Label>
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={!!selected}
            placeholder="e.g. senior_accountant"
          />
        </div>
        <div className="grid gap-1">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label>Description</Label>
          <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-xs font-medium mb-1">Permissions</p>
        <div className="max-h-64 overflow-y-auto border border-border rounded-md p-2">
          {PERMISSION_CATALOG.map(([p, label]) => (
            <label key={p} className="flex items-center gap-2 text-sm py-0.5">
              <input
                type="checkbox"
                checked={!!perms[p]}
                onChange={(e) => setPerms({ ...perms, [p]: e.target.checked })}
              />
              <span className="flex-1">{label}</span>
              <code className="text-[10px] text-muted-foreground">{p}</code>
            </label>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-3 animate-spin" /> : <ShieldCheck className="size-3" />}
          <span className="ml-1">Save role</span>
        </Button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </GlassPanel>
  );
}

function RoleGrants({
  tenantId,
  people,
  roles,
  grants,
  onChange,
}: {
  tenantId: string;
  people: any[];
  roles: any[];
  grants: any[];
  onChange: () => void;
}) {
  const [userId, setUserId] = useState<string>("");
  const [roleKey, setRoleKey] = useState<string>(roles[0]?.key ?? "");
  const [busy, setBusy] = useState(false);

  const linkedPeople = people.filter((p) => p.user_id);

  async function grant() {
    if (!userId || !roleKey) return;
    setBusy(true);
    try {
      const r = await executeAction("ficia.roles.grant", {
        confirmed: true,
        run: () => grantRole({ data: { tenant_id: tenantId, user_id: userId, role_key: roleKey } }),
      });
      if (!r.ok) alert(r.message);
      else onChange();
    } finally {
      setBusy(false);
    }
  }
  async function revoke(g: any) {
    const r = await executeAction("ficia.roles.revoke", {
      confirmed: true,
      run: () =>
        revokeRole({ data: { tenant_id: tenantId, user_id: g.user_id, role_key: g.role_key } }),
    });
    if (!r.ok) alert(r.message);
    else onChange();
  }

  return (
    <GlassPanel className="p-4">
      <h3 className="text-sm font-semibold">Grants</h3>
      <div className="grid gap-2 mt-3">
        <div className="grid gap-1">
          <Label>Person</Label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            <option value="">Select…</option>
            {linkedPeople.map((p) => (
              <option key={p.id} value={p.user_id}>
                {p.invited_email ?? p.user_id.slice(0, 8)} · {p.title ?? p.worker_type}
              </option>
            ))}
          </select>
          {linkedPeople.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              No signed-up members yet. Invited emails become grantable after they sign in.
            </p>
          )}
        </div>
        <div className="grid gap-1">
          <Label>Role</Label>
          <select
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
                {r.is_template ? " (template)" : ""}
              </option>
            ))}
          </select>
        </div>
        <Button size="sm" onClick={grant} disabled={busy || !userId}>
          <Plus className="size-3" /> Grant role
        </Button>
      </div>
      <div className="mt-4">
        <p className="text-xs font-medium">Current grants ({grants.length})</p>
        <ul className="mt-1 space-y-1 text-sm max-h-64 overflow-y-auto">
          {grants.length === 0 && <li className="text-xs text-muted-foreground">None yet.</li>}
          {grants.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between border-b border-border/40 py-1"
            >
              <span className="text-xs">
                <span className="font-mono">{g.user_id.slice(0, 8)}…</span> → <b>{g.role_key}</b>
              </span>
              <Button size="sm" variant="ghost" onClick={() => revoke(g)}>
                <X className="size-3" />
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </GlassPanel>
  );
}
