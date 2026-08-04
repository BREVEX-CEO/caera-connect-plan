import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Globe2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/country-packs")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Country Packs — CAERA CADANE Admin" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    if (!data)
      throw redirect({
        to: "/access-denied",
        search: { area: "Country Packs administration", reason: "This area requires the admin role on your CAERA CADANE account." },
      });
  },
  component: CountryPacksList,
});

type Pack = {
  id: string;
  country_code: string;
  name: string;
  status: string;
  description: string | null;
  updated_at: string;
};

type Version = {
  id: string;
  pack_id: string;
  version: string;
  effective_from: string;
  effective_to: string | null;
  status: string;
  ga_ready: boolean;
};

function statusKind(
  s: string,
): "success" | "beta" | "setup_required" | "failed" | "pending" | "running" {
  if (s === "ga") return "success";
  if (s === "pilot" || s === "approved") return "beta";
  if (s === "in_review") return "pending";
  if (s === "draft") return "setup_required";
  if (s === "stale" || s === "deprecated") return "failed";
  return "running";
}

function CountryPacksList() {
  const packs = useQuery({
    queryKey: ["country_packs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("country_packs")
        .select("id, country_code, name, status, description, updated_at")
        .order("country_code");
      if (error) throw error;
      return (data ?? []) as Pack[];
    },
  });

  const versions = useQuery({
    queryKey: ["country_pack_versions_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("country_pack_versions")
        .select("id, pack_id, version, effective_from, effective_to, status, ga_ready")
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Version[];
    },
  });

  return (
    <AppShell>
      <PageHeader
        eyebrow="FICIA Admin"
        title="Country Packs"
        description="Versioned compliance rule packs. Only admins can edit. India is the first pack; every other country is Planned."
      />

      <GlassPanel className="p-4 mb-6">
        <div className="flex items-start gap-3 text-sm">
          <ShieldAlert className="size-4 text-warning mt-0.5" />
          <p className="text-muted-foreground">
            Rules ship only as structural scaffolding. Nothing here is legal advice. A version
            cannot go GA without an approved professional review, pilot evidence, and all historical
            test cases passing (enforced by database trigger).
          </p>
        </div>
      </GlassPanel>

      <div className="grid gap-3">
        {(packs.data ?? []).map((p) => {
          const vs = (versions.data ?? []).filter((v) => v.pack_id === p.id);
          const isPlanned = p.status === "planned";
          return (
            <GlassPanel key={p.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {p.country_code}
                    </span>
                    <h3 className="text-base font-semibold">{p.name}</h3>
                    <StatusBadge status={statusKind(p.status)}>{p.status}</StatusBadge>
                  </div>
                  {p.description && (
                    <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
                  )}
                </div>
                {!isPlanned && (
                  <Link
                    to="/admin/country-packs/$packId"
                    params={{ packId: p.id }}
                    className="text-sm underline decoration-dotted hover:text-primary"
                  >
                    Open editor
                  </Link>
                )}
              </div>
              {vs.length > 0 && (
                <ul className="mt-3 grid gap-1 text-xs">
                  {vs.map((v) => (
                    <li key={v.id} className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-mono">v{v.version}</span>
                      <span>
                        · {v.effective_from} → {v.effective_to ?? "—"}
                      </span>
                      <StatusBadge status={statusKind(v.status)}>{v.status}</StatusBadge>
                      {v.ga_ready && (
                        <span className="inline-flex items-center gap-1 text-success">
                          <CheckCircle2 className="size-3" /> GA ready
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {isPlanned && vs.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  No versions authored yet. Planned country packs do not appear to FICIA users.
                </p>
              )}
            </GlassPanel>
          );
        })}
        {packs.isLoading && (
          <GlassPanel className="p-4 text-sm text-muted-foreground">Loading…</GlassPanel>
        )}
      </div>
    </AppShell>
  );
}
