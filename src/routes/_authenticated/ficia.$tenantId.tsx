import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Save, Loader2, Users } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { executeAction } from "@/lib/actions";
import { getCompany, updateCompany } from "@/lib/ficia-companies.functions";

export const Route = createFileRoute("/_authenticated/ficia/$tenantId")({
  head: () => ({
    meta: [
      { title: "Company workspace — FICIA" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: CompanyWorkspace,
});

function CompanyWorkspace() {
  const { tenantId } = Route.useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "settings" | "members">("overview");

  const q = useQuery({
    queryKey: ["ficia_company", tenantId],
    queryFn: () => getCompany({ data: { id: tenantId } }),
  });

  if (q.isLoading) {
    return <AppShell><GlassPanel className="p-4">Loading…</GlassPanel></AppShell>;
  }
  if (q.isError || !q.data) {
    return (
      <AppShell>
        <GlassPanel className="p-6 text-center">
          <p className="text-sm">Company not found or you don't have access.</p>
          <Link to="/ficia" className="text-sm text-primary mt-2 inline-block">← All companies</Link>
        </GlassPanel>
      </AppShell>
    );
  }

  const { company, members } = q.data as any;
  const isOwner = (members ?? []).some((m: any) => m.role === "owner");

  return (
    <AppShell>
      <div className="mb-4">
        <Link to="/ficia" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All companies
        </Link>
      </div>
      <PageHeader
        eyebrow="FICIA — company"
        title={company.name}
        description={[company.legal_name, company.country, company.currency].filter(Boolean).join(" · ")}
        actions={<StatusBadge status={company.status === "active" ? "success" : "planned"}>{company.status ?? "active"}</StatusBadge>}
      />

      <div className="mt-4 mb-4 flex flex-wrap items-center gap-1 border-b border-border/60 pb-0">
        {(["overview", "settings", "members"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px px-3 py-2 text-[13px] capitalize border-b-2 transition-colors ${
              tab === k
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {k}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-1 pb-1 text-[12px]">
          <Link to="/ficia/$tenantId/people" params={{ tenantId }} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">People</Link>
          <Link to="/ficia/$tenantId/roles" params={{ tenantId }} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">Roles</Link>
          <Link to="/ficia/$tenantId/approvals" params={{ tenantId }} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">Approvals</Link>
          <Link to="/ficia/$tenantId/messenger" params={{ tenantId }} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">Messenger</Link>
          <Link to="/ficia/$tenantId/time" params={{ tenantId }} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">Timesheets</Link>
        </div>
      </div>

      {tab === "overview" && <Overview company={company} />}
      {tab === "settings" && <Settings company={company} isOwner={isOwner} onSaved={() => qc.invalidateQueries({ queryKey: ["ficia_company", tenantId] })} />}
      {tab === "members" && <Members members={members ?? []} />}
    </AppShell>
  );
}

function Overview({ company }: { company: any }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Building2 className="size-4" /> Legal identity</h3>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Legal name</dt><dd>{company.legal_name ?? "—"}</dd>
          <dt className="text-muted-foreground">Entity type</dt><dd>{company.entity_type ?? "—"}</dd>
          <dt className="text-muted-foreground">Country</dt><dd>{company.country}</dd>
          <dt className="text-muted-foreground">Registration #</dt><dd>{company.registration_number ?? "—"}</dd>
          <dt className="text-muted-foreground">GSTIN</dt><dd>{company.tax_ids?.gstin ?? "—"}</dd>
          <dt className="text-muted-foreground">PAN</dt><dd>{company.tax_ids?.pan ?? "—"}</dd>
          <dt className="text-muted-foreground">Currency</dt><dd>{company.currency}</dd>
          <dt className="text-muted-foreground">Fiscal year start</dt><dd>Month {company.fiscal_year_start_month}</dd>
        </dl>
      </GlassPanel>

      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold">Address & contact</h3>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Address</dt>
          <dd>{[company.address?.line1, company.address?.line2, company.address?.city, company.address?.postal_code].filter(Boolean).join(", ") || "—"}</dd>
          <dt className="text-muted-foreground">Email</dt><dd>{company.contact?.email ?? "—"}</dd>
          <dt className="text-muted-foreground">Phone</dt><dd>{company.contact?.phone ?? "—"}</dd>
          <dt className="text-muted-foreground">Website</dt><dd>{company.contact?.website ?? "—"}</dd>
        </dl>
      </GlassPanel>

      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold">Branches ({(company.branches ?? []).length})</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {(company.branches ?? []).map((b: any, i: number) => (
            <li key={i} className="border-l border-border pl-3">
              <p className="font-medium">{b.label}</p>
              <p className="text-xs text-muted-foreground">{[b.city, b.region, b.country].filter(Boolean).join(", ")}</p>
            </li>
          ))}
          {(company.branches ?? []).length === 0 && <li className="text-xs text-muted-foreground">None.</li>}
        </ul>
      </GlassPanel>

      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold">Subsidiaries ({(company.subsidiaries ?? []).length})</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {(company.subsidiaries ?? []).map((s: any, i: number) => (
            <li key={i} className="border-l border-border pl-3">
              <p className="font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">
                {s.country ?? ""} {s.ownership_percent != null ? `· ${s.ownership_percent}% owned` : ""}
              </p>
            </li>
          ))}
          {(company.subsidiaries ?? []).length === 0 && <li className="text-xs text-muted-foreground">None.</li>}
        </ul>
      </GlassPanel>

      <GlassPanel className="p-4 md:col-span-2">
        <h3 className="text-sm font-semibold">FICIA modules</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Timesheets, invoices, banking, tax preparation, filings and family-planning modules ship in upcoming slices.
          Legal-identity, tenant isolation and audit trail are already active for this workspace.
        </p>
      </GlassPanel>
    </div>
  );
}

function Settings({ company, isOwner, onSaved }: { company: any; isOwner: boolean; onSaved: () => void }) {
  const [name, setName] = useState(company.name);
  const [legal, setLegal] = useState(company.legal_name ?? "");
  const [industry, setIndustry] = useState(company.industry ?? "");
  const [logo, setLogo] = useState(company.logo_url ?? "");
  const [desc, setDesc] = useState(company.description ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!isOwner) {
    return (
      <GlassPanel className="p-4 text-sm text-muted-foreground">
        Only the owner can edit company settings. Ask your owner to update the profile.
      </GlassPanel>
    );
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await executeAction("ficia.company.update", {
        confirmed: true,
        run: () => updateCompany({
          data: {
            id: company.id,
            patch: {
              name,
              legal_name: legal || null,
              industry: industry || null,
              logo_url: logo || null,
              description: desc || null,
            },
          },
        }),
      });
      setMsg(res.ok ? "Saved." : res.message);
      if (res.ok) onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassPanel className="p-5 grid gap-3">
      <div className="grid gap-2"><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="grid gap-2"><Label>Legal name</Label><Input value={legal} onChange={(e) => setLegal(e.target.value)} /></div>
      <div className="grid gap-2"><Label>Industry</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} /></div>
      <div className="grid gap-2"><Label>Logo URL</Label><Input type="url" value={logo} onChange={(e) => setLogo(e.target.value)} /></div>
      <div className="grid gap-2"><Label>Description</Label><Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
      <p className="text-xs text-muted-foreground">
        Country, entity type, official registration number and tax IDs are locked to preserve legal identity integrity.
        Contact support (or a future admin flow) if a correction is needed.
      </p>
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          <span className="ml-1">Save</span>
        </Button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </GlassPanel>
  );
}

function Members({ members }: { members: any[] }) {
  return (
    <GlassPanel className="p-4">
      <h3 className="text-sm font-semibold flex items-center gap-2"><Users className="size-4" /> Members ({members.length})</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 border-b border-border/40 pb-2 last:border-0">
            <span className="font-mono text-xs text-muted-foreground">{m.user_id.slice(0, 8)}…</span>
            <StatusBadge status={m.role === "owner" ? "success" : "planned"}>{m.role}</StatusBadge>
            <span className="text-xs text-muted-foreground ml-auto">since {new Date(m.created_at).toLocaleDateString()}</span>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
