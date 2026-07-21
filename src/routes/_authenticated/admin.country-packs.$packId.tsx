import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PlayCircle, ExternalLink, Loader2 } from "lucide-react";
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
import {
  updatePackVersion,
  addRuleSource,
  addPackReview,
  runVersionTests,
  promotePackVersion,
} from "@/lib/country-packs.functions";

export const Route = createFileRoute("/_authenticated/admin/country-packs/$packId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Country Pack editor — CAERA CADANE Admin" },
      { name: "robots", content: "noindex" },
    ],
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
    if (!data) throw redirect({ to: "/home" });
  },
  component: PackEditor,
});

type Version = {
  id: string;
  pack_id: string;
  version: string;
  effective_from: string;
  effective_to: string | null;
  jurisdiction: string;
  business_types: string[];
  applicability: any;
  rules: any;
  status: string;
  ga_ready: boolean;
  review_required_count: number;
  pilot_evidence_url: string | null;
  changelog: string | null;
  updated_at: string;
};

function statusKind(s: string): "success" | "beta" | "setup_required" | "failed" | "pending" | "running" {
  if (s === "ga") return "success";
  if (s === "pilot" || s === "approved") return "beta";
  if (s === "in_review") return "pending";
  if (s === "draft") return "setup_required";
  if (s === "stale" || s === "deprecated") return "failed";
  return "running";
}

function PackEditor() {
  const { packId } = Route.useParams();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const pack = useQuery({
    queryKey: ["country_pack", packId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("country_packs")
        .select("*")
        .eq("id", packId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const versions = useQuery({
    queryKey: ["country_pack_versions", packId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("country_pack_versions")
        .select("*")
        .eq("pack_id", packId)
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Version[];
    },
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const ver = useMemo(() => {
    const list = versions.data ?? [];
    return list.find((v) => v.id === selectedId) ?? list[0] ?? null;
  }, [versions.data, selectedId]);

  const sources = useQuery({
    queryKey: ["rule_sources", ver?.id],
    enabled: !!ver?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rule_sources")
        .select("*")
        .eq("version_id", ver!.id)
        .order("rule_key");
      if (error) throw error;
      return data ?? [];
    },
  });

  const events = useQuery({
    queryKey: ["compliance_events", ver?.id],
    enabled: !!ver?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_events")
        .select("*")
        .eq("version_id", ver!.id)
        .order("category")
        .order("title");
      if (error) throw error;
      return data ?? [];
    },
  });

  const tests = useQuery({
    queryKey: ["historical_test_cases", ver?.id],
    enabled: !!ver?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historical_test_cases")
        .select("*")
        .eq("version_id", ver!.id)
        .order("calculator")
        .order("case_key");
      if (error) throw error;
      return data ?? [];
    },
  });

  const reviews = useQuery({
    queryKey: ["pack_reviews", ver?.id],
    enabled: !!ver?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pack_reviews")
        .select("*")
        .eq("version_id", ver!.id)
        .order("signed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const allTestsPass =
    (tests.data ?? []).length > 0 &&
    (tests.data ?? []).every((t: any) => t.last_status === "pass");
  const approvedReviews = (reviews.data ?? []).filter((r: any) => r.decision === "approved").length;
  const canGa =
    ver &&
    approvedReviews >= (ver.review_required_count ?? 1) &&
    !!ver.pilot_evidence_url &&
    allTestsPass;
  const stale = ver && new Date(ver.effective_from).getTime() < Date.now() - 400 * 24 * 3600 * 1000;

  async function runTests() {
    if (!ver) return;
    setBusy(true);
    setFlash(null);
    try {
      const res = await executeAction("admin.country_pack.run_tests", {
        run: () => runVersionTests({ data: { version_id: ver.id } }),
      });
      if (res && res.ok && res.summary) {
        const s = res.summary;
        setFlash(`Tests: ${s.pass}/${s.total} pass · ${s.fail} fail · ${s.error} error`);
      } else if (res && !res.ok) {
        setFlash(res.message ?? "Test run failed.");
      }
      qc.invalidateQueries({ queryKey: ["historical_test_cases", ver.id] });
    } catch (e) {
      setFlash((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function promote(target: Version["status"]) {
    if (!ver) return;
    setBusy(true);
    setFlash(null);
    try {
      const res = await executeAction("admin.country_pack.promote", {
        run: () => promotePackVersion({ data: { version_id: ver.id, target_status: target as any, ga_ready: target === "ga" ? true : undefined } }),
      });
      if (res && !("ok" in res && res.ok)) {
        setFlash((res as any).message ?? "Promotion refused by GA gate.");
      } else {
        setFlash(`Promoted to ${target}.`);
        qc.invalidateQueries({ queryKey: ["country_pack_versions", packId] });
        qc.invalidateQueries({ queryKey: ["country_packs"] });
      }
    } catch (e) {
      setFlash((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-4">
        <Link to="/admin/country-packs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All country packs
        </Link>
      </div>
      <PageHeader
        eyebrow="FICIA Admin"
        title={pack.data ? `${(pack.data as any).name} pack` : "Loading…"}
        description="Edit versions, sources, deterministic tests and professional reviews. GA is trigger-gated."
      />

      {flash && (
        <GlassPanel className="p-3 mb-4 text-sm">{flash}</GlassPanel>
      )}

      <GlassPanel className="p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          {(versions.data ?? []).map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedId(v.id)}
              className={`px-3 py-1.5 rounded-md text-sm border transition ${
                (ver?.id ?? "") === v.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-foreground/40"
              }`}
            >
              <span className="font-mono">v{v.version}</span>
              <span className="ml-2 text-xs text-muted-foreground">{v.status}</span>
            </button>
          ))}
        </div>
      </GlassPanel>

      {ver && (
        <>
          <GlassPanel className="p-4 mb-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">Version {ver.version}</h3>
                  <StatusBadge status={statusKind(ver.status)}>{ver.status}</StatusBadge>
                  {stale && <StatusBadge status="failed">stale &gt; 400d</StatusBadge>}
                  {!canGa && ver.status !== "ga" && (
                    <StatusBadge status="setup_required">GA blocked</StatusBadge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Effective {ver.effective_from} → {ver.effective_to ?? "—"} · Jurisdiction {ver.jurisdiction} ·
                  Business types: {ver.business_types.join(", ") || "—"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={runTests} disabled={busy}>
                  {busy ? <Loader2 className="size-3 animate-spin" /> : <PlayCircle className="size-3" />}
                  <span className="ml-1">Run tests</span>
                </Button>
                <Button size="sm" variant="outline" onClick={() => promote("in_review")} disabled={busy}>
                  → In review
                </Button>
                <Button size="sm" variant="outline" onClick={() => promote("approved")} disabled={busy}>
                  → Approved
                </Button>
                <Button size="sm" variant="outline" onClick={() => promote("pilot")} disabled={busy}>
                  → Pilot
                </Button>
                <Button
                  size="sm"
                  onClick={() => promote("ga")}
                  disabled={busy || !canGa}
                  title={canGa ? "Promote to GA" : "GA blocked — need approved review + pilot evidence + all tests passing"}
                >
                  → GA
                </Button>
              </div>
            </div>
            {ver.changelog && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{ver.changelog}</p>
            )}

            <VersionMeta ver={ver} onSaved={() => qc.invalidateQueries({ queryKey: ["country_pack_versions", packId] })} />
          </GlassPanel>

          <div className="grid gap-4 md:grid-cols-2">
            <GlassPanel className="p-4">
              <h4 className="text-sm font-semibold mb-2">Compliance calendar ({(events.data ?? []).length})</h4>
              <ul className="space-y-2 text-sm">
                {(events.data ?? []).map((e: any) => (
                  <li key={e.id} className="border-l border-border/60 pl-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground uppercase">{e.category}</span>
                      <span className="font-medium">{e.title}</span>
                    </div>
                    {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {e.cadence} · {e.form_ref ?? "—"}
                    </p>
                  </li>
                ))}
                {(events.data ?? []).length === 0 && (
                  <li className="text-xs text-muted-foreground">No events yet.</li>
                )}
              </ul>
            </GlassPanel>

            <GlassPanel className="p-4">
              <h4 className="text-sm font-semibold mb-2">Historical test cases ({(tests.data ?? []).length})</h4>
              <ul className="space-y-2 text-sm">
                {(tests.data ?? []).map((t: any) => (
                  <li key={t.id} className="border-l border-border/60 pl-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{t.case_key}</span>
                      {t.last_status ? (
                        <StatusBadge status={t.last_status === "pass" ? "success" : "failed"}>
                          {t.last_status}
                        </StatusBadge>
                      ) : (
                        <StatusBadge status="pending">not run</StatusBadge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{t.calculator} · {t.description}</p>
                  </li>
                ))}
                {(tests.data ?? []).length === 0 && (
                  <li className="text-xs text-muted-foreground">No test cases.</li>
                )}
              </ul>
            </GlassPanel>

            <GlassPanel className="p-4">
              <h4 className="text-sm font-semibold mb-2">Rule sources ({(sources.data ?? []).length})</h4>
              <ul className="space-y-2 text-sm">
                {(sources.data ?? []).map((s: any) => (
                  <li key={s.id} className="border-l border-border/60 pl-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs">{s.rule_key}</span>
                      <span className="text-xs text-muted-foreground uppercase">{s.source_type}</span>
                    </div>
                    <p className="text-xs">{s.citation}</p>
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">
                        source <ExternalLink className="size-3" />
                      </a>
                    )}
                  </li>
                ))}
                {(sources.data ?? []).length === 0 && (
                  <li className="text-xs text-muted-foreground">No sources cited yet — rules without citations cannot show green compliance.</li>
                )}
              </ul>
              <AddSourceForm versionId={ver.id} onSaved={() => qc.invalidateQueries({ queryKey: ["rule_sources", ver.id] })} />
            </GlassPanel>

            <GlassPanel className="p-4">
              <h4 className="text-sm font-semibold mb-2">
                Professional reviews ({approvedReviews}/{ver.review_required_count} approved)
              </h4>
              <ul className="space-y-2 text-sm">
                {(reviews.data ?? []).map((r: any) => (
                  <li key={r.id} className="border-l border-border/60 pl-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.reviewer_name}</span>
                      <span className="text-xs text-muted-foreground">{r.reviewer_credential}{r.credential_id ? ` · ${r.credential_id}` : ""}</span>
                      <StatusBadge status={r.decision === "approved" ? "success" : r.decision === "rejected" ? "failed" : "pending"}>
                        {r.decision}
                      </StatusBadge>
                    </div>
                    {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
                  </li>
                ))}
                {(reviews.data ?? []).length === 0 && (
                  <li className="text-xs text-muted-foreground">No reviews recorded.</li>
                )}
              </ul>
              <AddReviewForm versionId={ver.id} onSaved={() => qc.invalidateQueries({ queryKey: ["pack_reviews", ver.id] })} />
            </GlassPanel>
          </div>
        </>
      )}
    </AppShell>
  );
}

function VersionMeta({ ver, onSaved }: { ver: Version; onSaved: () => void }) {
  const [effTo, setEffTo] = useState(ver.effective_to ?? "");
  const [pilot, setPilot] = useState(ver.pilot_evidence_url ?? "");
  const [changelog, setChangelog] = useState(ver.changelog ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await executeAction("admin.country_pack.update_version", {
        run: () =>
          updatePackVersion({
            data: {
              version_id: ver.id,
              effective_to: effTo ? effTo : null,
              pilot_evidence_url: pilot || null,
              changelog: changelog || undefined,
            },
          }),
      });
      setMsg(res && "ok" in res && res.ok ? "Saved." : (res as any)?.message ?? "Save failed.");
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3 md:grid-cols-3 mt-3">
      <div>
        <Label className="text-xs">Effective to</Label>
        <Input type="date" value={effTo} onChange={(e) => setEffTo(e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <Label className="text-xs">Pilot evidence URL (required for GA)</Label>
        <Input type="url" placeholder="https://…" value={pilot} onChange={(e) => setPilot(e.target.value)} />
      </div>
      <div className="md:col-span-3">
        <Label className="text-xs">Changelog</Label>
        <Textarea rows={2} value={changelog} onChange={(e) => setChangelog(e.target.value)} />
      </div>
      <div className="md:col-span-3 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={saving}>Save</Button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}

function AddSourceForm({ versionId, onSaved }: { versionId: string; onSaved: () => void }) {
  const [ruleKey, setRuleKey] = useState("");
  const [citation, setCitation] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"statute" | "notification" | "circular" | "guidance" | "form" | "portal">("statute");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!ruleKey || !citation) return;
    setBusy(true);
    try {
      await executeAction("admin.country_pack.add_source", {
        run: () => addRuleSource({ data: { version_id: versionId, rule_key: ruleKey, source_type: type, citation, url: url || undefined } }),
      });
      setRuleKey(""); setCitation(""); setUrl("");
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 grid gap-2 md:grid-cols-2">
      <Input placeholder="rule.key (e.g. gst.slabs)" value={ruleKey} onChange={(e) => setRuleKey(e.target.value)} />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as any)}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
      >
        <option value="statute">statute</option>
        <option value="notification">notification</option>
        <option value="circular">circular</option>
        <option value="guidance">guidance</option>
        <option value="form">form</option>
        <option value="portal">portal</option>
      </select>
      <Input placeholder="Citation" value={citation} onChange={(e) => setCitation(e.target.value)} />
      <Input type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
      <div className="md:col-span-2">
        <Button size="sm" onClick={submit} disabled={busy || !ruleKey || !citation}>Add source</Button>
      </div>
    </div>
  );
}

function AddReviewForm({ versionId, onSaved }: { versionId: string; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [cred, setCred] = useState("");
  const [credId, setCredId] = useState("");
  const [decision, setDecision] = useState<"approved" | "changes_requested" | "rejected">("approved");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await executeAction("admin.country_pack.add_review", {
        run: () =>
          addPackReview({
            data: {
              version_id: versionId,
              reviewer_name: name,
              reviewer_credential: cred,
              credential_id: credId || undefined,
              decision,
              notes: notes || undefined,
            },
          }),
      });
      setMsg(res && "ok" in res && res.ok ? "Review recorded." : (res as any)?.message ?? "Failed.");
      if (res && "ok" in res && res.ok) {
        setName(""); setCred(""); setCredId(""); setNotes("");
        onSaved();
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 grid gap-2 md:grid-cols-2">
      <Input placeholder="Reviewer full name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="Credential (e.g. CA, CPA, Advocate)" value={cred} onChange={(e) => setCred(e.target.value)} />
      <Input placeholder="Credential ID (optional)" value={credId} onChange={(e) => setCredId(e.target.value)} />
      <select
        value={decision}
        onChange={(e) => setDecision(e.target.value as any)}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
      >
        <option value="approved">Approved</option>
        <option value="changes_requested">Changes requested</option>
        <option value="rejected">Rejected</option>
      </select>
      <Textarea rows={2} className="md:col-span-2" placeholder="Notes / scope" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="md:col-span-2 flex items-center gap-3">
        <Button size="sm" onClick={submit} disabled={busy || name.length < 2 || cred.length < 2}>
          Submit review (strong confirm: type "sign")
        </Button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}
