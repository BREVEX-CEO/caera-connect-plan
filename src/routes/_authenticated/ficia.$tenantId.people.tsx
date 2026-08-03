import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  UserPlus,
  Building,
  MapPin,
  Users2,
  Ban,
  Undo2,
  Trash2,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { executeAction } from "@/lib/actions";
import {
  listPeople,
  listOrgUnits,
  invitePerson,
  setEmploymentStatus,
  createOrgUnit,
} from "@/lib/ficia-people.functions";

export const Route = createFileRoute("/_authenticated/ficia/$tenantId/people")({
  head: () => ({ meta: [{ title: "People — FICIA" }, { name: "robots", content: "noindex" }] }),
  component: PeoplePage,
});

function PeoplePage() {
  const { tenantId } = Route.useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"people" | "org">("people");

  const people = useQuery({
    queryKey: ["ficia_people", tenantId],
    queryFn: () => listPeople({ data: { tenant_id: tenantId } }),
  });
  const org = useQuery({
    queryKey: ["ficia_org", tenantId],
    queryFn: () => listOrgUnits({ data: { tenant_id: tenantId } }),
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["ficia_people", tenantId] });
    qc.invalidateQueries({ queryKey: ["ficia_org", tenantId] });
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
        eyebrow="FICIA — people"
        title="People, employments & org units"
        description="Invite employees, contractors, advisors and auditors. Manage departments, teams and locations. Suspending or terminating a person immediately removes their access."
      />

      <GlassPanel className="p-2 mt-4 mb-4 flex gap-1">
        {(["people", "org"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-md text-sm capitalize ${tab === k ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
          >
            {k === "org" ? "Departments / teams / locations" : "People"}
          </button>
        ))}
      </GlassPanel>

      {tab === "people" && (
        <>
          <InvitePersonForm tenantId={tenantId} onDone={refresh} />
          <PeopleTable
            tenantId={tenantId}
            loading={people.isLoading}
            people={(people.data as any)?.people ?? []}
            org={org.data as any}
            onChange={refresh}
          />
        </>
      )}

      {tab === "org" && <OrgUnits tenantId={tenantId} data={org.data as any} onChange={refresh} />}
    </AppShell>
  );
}

function InvitePersonForm({ tenantId, onDone }: { tenantId: string; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [type, setType] = useState<
    "employee" | "contractor" | "advisor" | "auditor" | "consultant"
  >("employee");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    if (!email.includes("@")) {
      setMsg("Enter a valid email.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await executeAction("ficia.people.invite", {
        confirmed: true,
        run: () =>
          invitePerson({
            data: {
              tenant_id: tenantId,
              invited_email: email,
              worker_type: type,
              title: title || undefined,
            },
          }),
      });
      if (r.ok) {
        setEmail("");
        setTitle("");
        setMsg("Invitation recorded.");
        onDone();
      } else setMsg(r.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassPanel className="p-4 mb-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <UserPlus className="size-4" /> Invite person
      </h3>
      <div className="grid gap-3 md:grid-cols-4 mt-3">
        <div className="grid gap-1">
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
          />
        </div>
        <div className="grid gap-1">
          <Label>Type</Label>
          <select
            aria-label="Person type"
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            {["employee", "contractor", "advisor", "auditor", "consultant"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label>Title (optional)</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Senior accountant"
          />
        </div>
        <div className="grid gap-1 justify-end">
          <Label>&nbsp;</Label>
          <Button size="sm" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            <span className="ml-1">Invite</span>
          </Button>
        </div>
      </div>
      {msg && <p className="text-xs text-muted-foreground mt-2">{msg}</p>}
      <p className="text-xs text-muted-foreground mt-2">
        Invited people appear as <b>invited</b> until they sign in and are linked. Actual signup /
        email delivery ships with the invite-mail slice.
      </p>
    </GlassPanel>
  );
}

function PeopleTable({
  tenantId: _tenantId,
  loading,
  people,
  org,
  onChange,
}: {
  tenantId: string;
  loading: boolean;
  people: any[];
  org: any;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function change(
    id: string,
    action: string,
    status: "suspended" | "terminated" | "active",
    reason?: string,
  ) {
    setBusy(id);
    try {
      const r = await executeAction(action, {
        confirmed: true,
        confirmPhrase: status === "terminated" ? "TERMINATE" : undefined,
        run: () => setEmploymentStatus({ data: { employment_id: id, status, reason } }),
      });
      if (!r.ok) alert(r.message);
      else onChange();
    } finally {
      setBusy(null);
    }
  }

  const depMap = new Map((org?.departments ?? []).map((d: any) => [d.id, d.name]));
  const teamMap = new Map((org?.teams ?? []).map((t: any) => [t.id, t.name]));
  const locMap = new Map((org?.locations ?? []).map((l: any) => [l.id, l.label]));

  return (
    <GlassPanel className="p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b border-border">
            <th className="p-3">Person</th>
            <th className="p-3">Type</th>
            <th className="p-3">Status</th>
            <th className="p-3">Title</th>
            <th className="p-3">Department / team / location</th>
            <th className="p-3">Dates</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={7} className="p-4 text-center text-muted-foreground">
                Loading…
              </td>
            </tr>
          )}
          {!loading && people.length === 0 && (
            <tr>
              <td colSpan={7} className="p-4 text-center text-muted-foreground">
                No people yet — invite the first one above.
              </td>
            </tr>
          )}
          {people.map((p) => (
            <tr key={p.id} className="border-b border-border/40 last:border-0">
              <td className="p-3">
                <div className="font-medium">
                  {p.invited_email ?? (p.user_id ? `${p.user_id.slice(0, 8)}…` : "—")}
                </div>
              </td>
              <td className="p-3 capitalize">{p.worker_type}</td>
              <td className="p-3">
                <StatusBadge
                  status={
                    p.status === "active"
                      ? "success"
                      : p.status === "invited"
                        ? "beta"
                        : p.status === "suspended"
                          ? "planned"
                          : "planned"
                  }
                >
                  {p.status}
                </StatusBadge>
              </td>
              <td className="p-3">{p.title ?? "—"}</td>
              <td className="p-3 text-xs text-muted-foreground">
                {[depMap.get(p.department_id), teamMap.get(p.team_id), locMap.get(p.location_id)]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </td>
              <td className="p-3 text-xs text-muted-foreground">
                {p.start_date ?? "—"}
                {p.end_date ? ` → ${p.end_date}` : ""}
              </td>
              <td className="p-3 whitespace-nowrap text-right">
                {p.status === "active" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === p.id}
                    onClick={() => {
                      const r = prompt("Suspend — reason?");
                      if (r != null) change(p.id, "ficia.people.suspend", "suspended", r);
                    }}
                  >
                    <Ban className="size-3" /> Suspend
                  </Button>
                )}
                {p.status === "suspended" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === p.id}
                    onClick={() => change(p.id, "ficia.people.restore", "active")}
                  >
                    <Undo2 className="size-3" /> Restore
                  </Button>
                )}
                {(p.status === "active" || p.status === "suspended") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === p.id}
                    onClick={() => {
                      const r = prompt(
                        "Terminate — reason? (Type TERMINATE on the confirm screen.)",
                      );
                      if (r != null) change(p.id, "ficia.people.terminate", "terminated", r);
                    }}
                  >
                    <Trash2 className="size-3" /> Terminate
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </GlassPanel>
  );
}

function OrgUnits({
  tenantId,
  data,
  onChange,
}: {
  tenantId: string;
  data: any;
  onChange: () => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <OrgList
        title="Departments"
        icon={<Building className="size-4" />}
        items={data?.departments ?? []}
        field="name"
        onCreate={async (name) => {
          const r = await executeAction("ficia.org.create", {
            confirmed: true,
            run: () => createOrgUnit({ data: { kind: "department", tenant_id: tenantId, name } }),
          });
          if (!r.ok) alert(r.message);
          else onChange();
        }}
      />
      <OrgList
        title="Teams"
        icon={<Users2 className="size-4" />}
        items={data?.teams ?? []}
        field="name"
        onCreate={async (name) => {
          const r = await executeAction("ficia.org.create", {
            confirmed: true,
            run: () => createOrgUnit({ data: { kind: "team", tenant_id: tenantId, name } }),
          });
          if (!r.ok) alert(r.message);
          else onChange();
        }}
      />
      <OrgList
        title="Locations"
        icon={<MapPin className="size-4" />}
        items={data?.locations ?? []}
        field="label"
        onCreate={async (name) => {
          const r = await executeAction("ficia.org.create", {
            confirmed: true,
            run: () =>
              createOrgUnit({ data: { kind: "location", tenant_id: tenantId, label: name } }),
          });
          if (!r.ok) alert(r.message);
          else onChange();
        }}
      />
    </div>
  );
}

function OrgList({
  title,
  icon,
  items,
  field,
  onCreate,
}: {
  title: string;
  icon: React.ReactNode;
  items: any[];
  field: string;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  return (
    <GlassPanel className="p-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        {icon} {title}
      </h3>
      <div className="mt-3 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`New ${title.toLowerCase().slice(0, -1)}`}
        />
        <Button
          size="sm"
          onClick={async () => {
            if (name.trim()) {
              await onCreate(name.trim());
              setName("");
            }
          }}
        >
          Add
        </Button>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {items.length === 0 && <li className="text-xs text-muted-foreground">None yet.</li>}
        {items.map((it) => (
          <li key={it.id} className="border-b border-border/40 py-1 last:border-0">
            {it[field]}
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
