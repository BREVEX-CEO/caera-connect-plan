import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, AlertTriangle, Loader2, ExternalLink, History, Lock } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { executeAction, ActionConfirmationError } from "@/lib/actions";
import { updateLaunchGateItem, upsertFeatureFlag } from "@/lib/launch-gate.functions";
import { cn } from "@/lib/utils";
import { BlockerResolutionPolicy } from "@/components/admin/BlockerResolutionPolicy";
import { StakeholderResearchBoundary } from "@/components/admin/StakeholderResearchBoundary";
import { LaunchAuthorityBoundary } from "@/components/admin/LaunchAuthorityBoundary";

type Status =
  "not_started" | "in_progress" | "pending_review" | "evidence_required" | "complete" | "waived";

type Stage = "demo" | "private_alpha" | "beta" | "ga";

type Item = {
  id: string;
  key: string;
  category: string;
  title: string;
  description: string | null;
  status: Status;
  owner: string | null;
  reviewer: string | null;
  evidence_url: string | null;
  applicable_modules: string[];
  due_date: string | null;
  blocker: boolean;
  notes: string | null;
  updated_at: string;
};

type Flag = {
  id: string;
  enabled: boolean;
  description: string | null;
  stage: Stage;
  applicable_modules: string[];
  updated_at: string;
};

const STATUS_OPTIONS: Status[] = [
  "not_started",
  "in_progress",
  "pending_review",
  "evidence_required",
  "complete",
  "waived",
];

const STAGE_OPTIONS: Stage[] = ["demo", "private_alpha", "beta", "ga"];

export const Route = createFileRoute("/_authenticated/admin/launch-gate")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Launch Gate — CAERA CADANE Admin" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/home" });
  },
  component: LaunchGatePage,
});

function statusBadgeKind(
  s: Status,
): "success" | "beta" | "setup_required" | "failed" | "pending" | "running" {
  if (s === "complete") return "success";
  if (s === "waived") return "beta";
  if (s === "evidence_required") return "setup_required";
  if (s === "not_started") return "failed";
  if (s === "pending_review") return "pending";
  return "running";
}

function LaunchGatePage() {
  const qc = useQueryClient();
  const items = useQuery({
    queryKey: ["launch_gate_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("launch_gate_items")
        .select("*")
        .order("category")
        .order("title");
      if (error) throw error;
      return (data ?? []) as unknown as Item[];
    },
  });

  const flags = useQuery({
    queryKey: ["feature_flags_admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("feature_flags").select("*").order("id");
      if (error) throw error;
      return (data ?? []) as unknown as Flag[];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const i of items.data ?? []) {
      const list = map.get(i.category) ?? [];
      list.push(i);
      map.set(i.category, list);
    }
    return Array.from(map.entries());
  }, [items.data]);

  const summary = useMemo(() => {
    const all = items.data ?? [];
    return {
      total: all.length,
      complete: all.filter((i) => i.status === "complete").length,
      blockers: all.filter((i) => i.blocker && i.status !== "complete" && i.status !== "waived")
        .length,
    };
  }, [items.data]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admin"
        title="Launch Gate"
        description="Pre-launch safeguards that block General Availability for regulated modules. Every change is recorded in the compliance audit log."
        actions={
          <Link
            to="/settings/activity"
            className="rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-foreground hover:bg-accent"
          >
            View audit log
          </Link>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Items" value={summary.total} tone="neutral" />
        <SummaryCard label="Complete" value={summary.complete} tone="success" />
        <SummaryCard
          label="Open blockers"
          value={summary.blockers}
          tone={summary.blockers > 0 ? "danger" : "success"}
        />
      </div>
      <BlockerResolutionPolicy />
      <StakeholderResearchBoundary />
      <LaunchAuthorityBoundary />

      {items.isLoading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading launch gate…
        </div>
      ) : null}

      {items.error ? (
        <GlassPanel className="mt-6 p-4 text-sm text-destructive">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          Failed to load launch gate items.
        </GlassPanel>
      ) : null}

      <div className="mt-8 space-y-6">
        {grouped.map(([category, list]) => (
          <section key={category}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {category}
            </h2>
            <div className="space-y-3">
              {list.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onSaved={() => qc.invalidateQueries({ queryKey: ["launch_gate_items"] })}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Lock className="h-4 w-4" aria-hidden /> Feature flag stages
        </h2>
        <p className="mb-3 max-w-2xl text-xs text-muted-foreground">
          Flags advance one stage at a time from Demo → Private alpha → Beta → GA. Enabled rollout
          requires explicit capability:* and platform:* coverage, independent evidence, and distinct
          owner/reviewer approval. Missing or waived controlled-rollout evidence is refused.
        </p>
        <FeatureFlagsPanel
          flags={flags.data ?? []}
          onSaved={() => qc.invalidateQueries({ queryKey: ["feature_flags_admin"] })}
        />
      </section>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "neutral";
}) {
  return (
    <GlassPanel className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold",
          tone === "danger" && "text-destructive",
          tone === "success" && "text-[color:var(--accent-ficia,theme(colors.emerald.400))]",
        )}
      >
        {value}
      </div>
    </GlassPanel>
  );
}

function ItemRow({ item, onSaved }: { item: Item; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>(item.status);
  const [owner, setOwner] = useState(item.owner ?? "");
  const [reviewer, setReviewer] = useState(item.reviewer ?? "");
  const [evidence, setEvidence] = useState(item.evidence_url ?? "");
  const [modules, setModules] = useState(item.applicable_modules.join(","));
  const [due, setDue] = useState(item.due_date ?? "");
  const [blocker, setBlocker] = useState(item.blocker);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<
    | {
        id: string;
        from_status: Status | null;
        to_status: Status;
        changed_at: string;
        note: string | null;
        evidence_url: string | null;
      }[]
    | null
  >(null);

  async function loadHistory() {
    const { data } = await supabase
      .from("launch_gate_history")
      .select("id, from_status, to_status, changed_at, note, evidence_url")
      .eq("item_id", item.id)
      .order("changed_at", { ascending: false });
    setHistory((data ?? []) as never);
  }

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      const result = await executeAction("admin.launch_gate.update", {
        confirmed: true,
        metadata: { item_key: item.key, to_status: status },
        run: () =>
          updateLaunchGateItem({
            data: {
              id: item.id,
              status,
              owner: owner || null,
              reviewer: reviewer || null,
              evidence_url: evidence || null,
              applicable_modules: modules
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              due_date: due || null,
              blocker,
              history_note: note || undefined,
            },
          }),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNote("");
      onSaved();
      if (history !== null) await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  const openBlocker = item.blocker && item.status !== "complete" && item.status !== "waived";

  return (
    <GlassPanel className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
            <StatusBadge status={statusBadgeKind(item.status)}>
              {item.status.replace("_", " ")}
            </StatusBadge>
            {openBlocker ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-destructive">
                <AlertTriangle className="h-3 w-3" /> Blocker
              </span>
            ) : null}
          </div>
          {item.description ? (
            <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span>Owner: {item.owner ?? "—"}</span>
            <span>Reviewer: {item.reviewer ?? "—"}</span>
            <span>Due: {item.due_date ?? "—"}</span>
            {item.applicable_modules.length > 0 ? (
              <span>Modules: {item.applicable_modules.join(", ")}</span>
            ) : (
              <span>Modules: all</span>
            )}
            {item.evidence_url ? (
              <a
                href={item.evidence_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Evidence <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (history === null) loadHistory();
              setOpen((v) => !v);
            }}
            className="rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-foreground hover:bg-accent"
          >
            {open ? "Close" : "Edit"}
          </button>
        </div>
      </div>

      {open ? (
        <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
          <label className="text-xs">
            <span className="text-muted-foreground">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="mt-1 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="text-muted-foreground">Owner</span>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Name or team"
              className="mt-1 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="text-muted-foreground">Reviewer</span>
            <input
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              placeholder="Independent reviewer"
              className="mt-1 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="text-muted-foreground">Due date</span>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="mt-1 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs sm:col-span-2">
            <span className="text-muted-foreground">Evidence URL</span>
            <input
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="https://…"
              className="mt-1 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs sm:col-span-2">
            <span className="text-muted-foreground">
              Applicable modules (comma-separated: ocade, ficia, madee, cania, core, admin)
            </span>
            <input
              value={modules}
              onChange={(e) => setModules(e.target.value)}
              placeholder="ocade,ficia"
              className="mt-1 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs sm:col-span-2 inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={blocker}
              onChange={(e) => setBlocker(e.target.checked)}
            />
            <span className="text-muted-foreground">Blocks enabled rollout expansion</span>
          </label>
          <label className="text-xs sm:col-span-2">
            <span className="text-muted-foreground">History note (recorded on status change)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why did this change?"
              className="mt-1 w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm"
            />
          </label>

          <div className="sm:col-span-2 flex items-center justify-between gap-2">
            <div className="text-xs text-destructive">{error}</div>
            <div className="flex gap-2">
              <button
                onClick={onSave}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3 w-3" />
                )}
                Save & audit
              </button>
            </div>
          </div>

          <div className="sm:col-span-2">
            <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <History className="h-3 w-3" /> Completion history
            </div>
            <ul className="mt-2 space-y-1 text-xs">
              {(history ?? []).length === 0 ? (
                <li className="text-muted-foreground">No transitions recorded yet.</li>
              ) : (
                (history ?? []).map((h) => (
                  <li key={h.id} className="text-muted-foreground">
                    <span className="text-foreground">
                      {new Date(h.changed_at).toLocaleString()}
                    </span>{" "}
                    — {h.from_status ?? "∅"} → {h.to_status}
                    {h.note ? ` · ${h.note}` : ""}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </GlassPanel>
  );
}

function FeatureFlagsPanel({ flags, onSaved }: { flags: Flag[]; onSaved: () => void }) {
  const [newId, setNewId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {flags.length === 0 ? (
        <GlassPanel className="p-4 text-sm text-muted-foreground">
          No feature flags yet. Create one to gate a module's public rollout.
        </GlassPanel>
      ) : null}

      {flags.map((f) => (
        <FlagRow key={f.id} flag={f} onSaved={onSaved} />
      ))}

      <GlassPanel className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label="New feature flag ID"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="new.flag.id"
            className="flex-1 rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm"
          />
          <button
            onClick={async () => {
              if (!newId.trim()) return;
              setBusy(true);
              setError(null);
              try {
                const phrase = window.prompt(
                  `Create disabled Demo flag "${newId.trim()}"? Type "activate" to confirm.`,
                );
                const result = await executeAction("admin.feature_flag.upsert", {
                  confirmed: true,
                  confirmPhrase: phrase ?? "",
                  metadata: { flag_id: newId, stage: "demo" },
                  run: () =>
                    upsertFeatureFlag({
                      data: {
                        id: newId.trim(),
                        enabled: false,
                        stage: "demo",
                        applicable_modules: [],
                      },
                    }),
                });
                if (!result.ok) setError(result.message);
                else {
                  setNewId("");
                  onSaved();
                }
              } catch (cause) {
                if (cause instanceof ActionConfirmationError) setError(cause.message);
                else setError(cause instanceof Error ? cause.message : "Flag creation failed");
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            {busy ? "Creating…" : "Create flag"}
          </button>
        </div>
        {error ? (
          <div className="mt-2 text-xs text-destructive">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            {error}
          </div>
        ) : null}
        <p className="mt-2 text-[11px] text-muted-foreground">
          New flags start in Demo stage, disabled. Advance them through Private alpha → Beta → GA as
          launch-gate items complete.
        </p>
      </GlassPanel>
    </div>
  );
}

function FlagRow({ flag, onSaved }: { flag: Flag; onSaved: () => void }) {
  const [stage, setStage] = useState<Stage>(flag.stage);
  const [enabled, setEnabled] = useState(flag.enabled);
  const [modules, setModules] = useState(flag.applicable_modules.join(","));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const phrase = window.prompt(
        `Update rollout flag "${flag.id}" to ${stage} (${enabled ? "enabled" : "disabled"})? Type "activate" to confirm.`,
      );
      const res = await executeAction("admin.feature_flag.upsert", {
        confirmed: true,
        confirmPhrase: phrase ?? "",
        metadata: { flag_id: flag.id, to_stage: stage, to_enabled: enabled },
        run: () =>
          upsertFeatureFlag({
            data: {
              id: flag.id,
              enabled,
              stage,
              applicable_modules: modules
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            },
          }),
      });
      if (!res.ok) setError(res.message);
      else onSaved();
    } catch (e) {
      if (e instanceof ActionConfirmationError) setError(e.message);
      else setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassPanel className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{flag.id}</div>
          <div className="text-[11px] text-muted-foreground">
            Updated {new Date(flag.updated_at).toLocaleString()}
          </div>
        </div>
        <label className="text-xs">
          <span className="text-muted-foreground">Stage</span>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as Stage)}
            className="ml-2 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-sm"
          >
            {STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-xs">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span className="text-muted-foreground">Enabled</span>
        </label>
        <input
          aria-label="Feature flag modules"
          value={modules}
          onChange={(e) => setModules(e.target.value)}
          placeholder="modules (comma-separated)"
          className="w-48 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-sm"
        />
        <button
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      {error ? (
        <div className="mt-2 text-xs text-destructive">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          {error}
        </div>
      ) : null}
    </GlassPanel>
  );
}
