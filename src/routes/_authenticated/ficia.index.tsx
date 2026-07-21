import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Info, MailCheck } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listMyCompanies, respondAccessRequest } from "@/lib/ficia-companies.functions";
import { executeAction } from "@/lib/actions";
import { useDemo } from "@/lib/demo/demo-provider";

export const Route = createFileRoute("/_authenticated/ficia/")({
  head: () => ({
    meta: [
      { title: "FICIA — Companies" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FiciaIndex,
});

const DEMO_COMPANIES = [
  { id: "demo-1", name: "Ashwin Consultancy LLP", country: "IN", currency: "INR", status: "active", legal_name: "Ashwin Consultancy LLP" },
  { id: "demo-2", name: "Nova Bakery", country: "IN", currency: "INR", status: "active", legal_name: "Nova Bakery Pvt. Ltd." },
];

function FiciaIndex() {
  const demo = useDemo();
  const qc = useQueryClient();

  const companies = useQuery({
    queryKey: ["ficia_companies", demo.isDemo],
    queryFn: async () => {
      if (demo.isDemo) return { companies: DEMO_COMPANIES };
      return listMyCompanies();
    },
  });

  const pendingRequests = useQuery({
    queryKey: ["ficia_access_requests_incoming"],
    enabled: !demo.isDemo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_requests")
        .select("id, tenant_id, requester_user_id, requested_role, message, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function decide(reqId: string, decision: "approved" | "rejected") {
    await executeAction("ficia.access.decide", {
      confirmed: true,
      run: () => respondAccessRequest({ data: { request_id: reqId, decision } }),
    });
    qc.invalidateQueries({ queryKey: ["ficia_access_requests_incoming"] });
    qc.invalidateQueries({ queryKey: ["ficia_companies"] });
  }

  const list = (companies.data as any)?.companies ?? [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="FICIA — commerce & finance"
        title="Your companies"
        description="Pick a company to work in, or create a new one. FICIA keeps each company isolated and only shows you data you belong to."
        actions={
          demo.isDemo ? (
            <StatusBadge status="beta">Demo data</StatusBadge>
          ) : (
            <Link to="/ficia/new">
              <Button size="sm"><Plus className="size-4" /> New company</Button>
            </Link>
          )
        }
      />

      <GlassPanel className="p-4 mt-6 mb-4">
        <div className="flex items-start gap-3 text-sm">
          <Info className="size-4 text-[color:var(--state-info)] mt-0.5" />
          <div>
            <p className="font-medium">Explain this page</p>
            <p className="text-muted-foreground mt-1">
              A company is an isolated workspace. Only members you approve can see its records.
              Before you create one, FICIA checks the country + official registration number
              (and GSTIN / PAN where applicable) to avoid duplicates. If a match exists,
              you'll be offered a safe access request instead.
            </p>
          </div>
        </div>
      </GlassPanel>

      {companies.isLoading && (
        <GlassPanel className="p-4 text-sm text-muted-foreground">Loading…</GlassPanel>
      )}

      {!companies.isLoading && list.length === 0 && (
        <GlassPanel className="p-8 text-center">
          <Building2 className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            You don't belong to any company yet.
          </p>
          {!demo.isDemo && (
            <Link to="/ficia/new" className="mt-3 inline-block">
              <Button size="sm"><Plus className="size-4" /> Create your first company</Button>
            </Link>
          )}
        </GlassPanel>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {list.map((c: any) => (
          demo.isDemo ? (
            <GlassPanel key={c.id} className="p-4">
              <CompanyRow c={c} disabled />
            </GlassPanel>
          ) : (
            <Link
              key={c.id}
              to="/ficia/$tenantId"
              params={{ tenantId: c.id }}
              className="block"
            >
              <GlassPanel className="p-4 hover:border-primary/40 transition">
                <CompanyRow c={c} />
              </GlassPanel>
            </Link>
          )
        ))}
      </div>

      {!demo.isDemo && (pendingRequests.data?.length ?? 0) > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <MailCheck className="size-4" /> Pending access requests
          </h3>
          <div className="grid gap-2">
            {pendingRequests.data!.map((r: any) => (
              <GlassPanel key={r.id} className="p-3 text-sm flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <div className="font-mono text-xs text-muted-foreground">{r.tenant_id.slice(0, 8)}…</div>
                  <p>Role requested: <b>{r.requested_role}</b></p>
                  {r.message && <p className="text-muted-foreground text-xs">"{r.message}"</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => decide(r.id, "rejected")}>Reject</Button>
                  <Button size="sm" onClick={() => decide(r.id, "approved")}>Approve</Button>
                </div>
              </GlassPanel>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function CompanyRow({ c, disabled }: { c: any; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {c.logo_url ? (
        <img src={c.logo_url} alt="" className="size-10 rounded-md object-cover" />
      ) : (
        <div className="size-10 rounded-md bg-muted flex items-center justify-center">
          <Building2 className="size-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold truncate">{c.name}</p>
          <StatusBadge status={c.status === "active" ? "success" : "planned"}>{c.status ?? "active"}</StatusBadge>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {c.legal_name ? `${c.legal_name} · ` : ""}{c.country} · {c.currency}
        </p>
      </div>
      {disabled && <StatusBadge status="beta">Demo</StatusBadge>}
    </div>
  );
}
