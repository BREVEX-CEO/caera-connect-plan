import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Shield, Activity as ActivityIcon, Trash2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { useSession } from "@/lib/session";
import { executeAction, getAction, ActionConfirmationError } from "@/lib/actions";
import { cn } from "@/lib/utils";
import {
  listLocalOutputActivity,
  type LocalOutputActivity,
} from "@/lib/artifacts/chat-output-flow";

export const Route = createFileRoute("/_authenticated/settings/activity")({
  head: () => ({
    meta: [{ title: "Activity — CARCC CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: ActivityPage,
});

type Tab = "operational" | "compliance";
type WindowKey = "7" | "30" | "90" | "all";

type OpRow = {
  id: string;
  created_at: string;
  action: string;
  feature_id: string | null;
  tenant_id: string | null;
  metadata: Record<string, unknown> | null;
};

type ComplianceRow = {
  id: string;
  created_at: string;
  action: string;
  feature_id: string | null;
  category: string | null;
  tenant_id: string | null;
  preview: Record<string, unknown> | null;
  result: string | null;
  prev_hash: string | null;
  row_hash: string | null;
};

function windowStart(w: WindowKey): string | null {
  if (w === "all") return null;
  const d = new Date();
  d.setDate(d.getDate() - Number(w));
  return d.toISOString();
}

function ActivityPage() {
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>("operational");
  const [win, setWin] = useState<WindowKey>("30");
  const [q, setQ] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [localOutputs, setLocalOutputs] = useState<LocalOutputActivity[] | null>(null);
  const [localOutputError, setLocalOutputError] = useState<string | null>(null);

  const from = useMemo(() => windowStart(win), [win]);

  const opQuery = useQuery<OpRow[]>({
    queryKey: ["activity", "operational", user?.id, from],
    enabled: !!user?.id && tab === "operational",
    queryFn: async () => {
      const supabase = await loadSupabaseClient();
      let query = supabase
        .from("activity_log")
        .select("id, created_at, action, feature_id, tenant_id, metadata")
        .order("created_at", { ascending: false })
        .limit(500);
      if (from) query = query.gte("created_at", from);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as OpRow[];
    },
  });

  const compQuery = useQuery<ComplianceRow[]>({
    queryKey: ["activity", "compliance", user?.id, from],
    enabled: !!user?.id && tab === "compliance",
    queryFn: async () => {
      const supabase = await loadSupabaseClient();
      let query = supabase
        .from("compliance_audit_log")
        .select(
          "id, created_at, action, feature_id, category, tenant_id, preview, result, prev_hash, row_hash",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (from) query = query.gte("created_at", from);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ComplianceRow[];
    },
  });

  const opRows = (opQuery.data ?? []).filter(
    (r) =>
      !q ||
      r.action.toLowerCase().includes(q.toLowerCase()) ||
      (r.feature_id ?? "").toLowerCase().includes(q.toLowerCase()),
  );
  const compRows = (compQuery.data ?? []).filter(
    (r) =>
      !q ||
      r.action.toLowerCase().includes(q.toLowerCase()) ||
      (r.feature_id ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  useEffect(() => {
    setMsg(null);
  }, [tab]);

  function refreshLocalOutputs() {
    const result = listLocalOutputActivity();
    if (result.ok) {
      setLocalOutputs(result.data);
      setLocalOutputError(null);
    } else {
      setLocalOutputs(null);
      setLocalOutputError(result.reason);
    }
  }

  useEffect(() => {
    refreshLocalOutputs();
  }, []);

  async function clearOldOperational() {
    const supabase = await loadSupabaseClient();
    try {
      await executeAction("activity.clear_operational", {
        confirmed: true,
        confirmPhrase: phrase,
        run: async () => {
          const supabase = await loadSupabaseClient();
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 30);
          const { error } = await supabase
            .from("activity_log")
            .delete()
            .lt("created_at", cutoff.toISOString());
          if (error) throw error;
        },
      });
      setMsg({ kind: "success", text: "Cleared operational activity older than 30 days." });
      setConfirmClear(false);
      setPhrase("");
      opQuery.refetch();
    } catch (e) {
      setMsg({
        kind: "error",
        text:
          e instanceof ActionConfirmationError
            ? e.message
            : e instanceof Error
              ? e.message
              : String(e),
      });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Account · Activity"
        title="Activity centre"
        description="See what happened on your account. Operational activity is short-lived. Compliance events are immutable and cannot be edited or cleared."
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-muted/40 p-1 text-xs">
          <button
            aria-pressed={tab === "operational"}
            onClick={() => setTab("operational")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5",
              tab === "operational"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ActivityIcon className="h-3.5 w-3.5" aria-hidden />
            Operational
          </button>
          <button
            aria-pressed={tab === "compliance"}
            onClick={() => setTab("compliance")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5",
              tab === "compliance"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Shield className="h-3.5 w-3.5" aria-hidden />
            Compliance
          </button>
        </div>
        <select
          aria-label="Activity time window"
          value={win}
          onChange={(e) => setWin(e.target.value as WindowKey)}
          className="rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 text-xs"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>
        <input
          aria-label="Filter activity"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter action or feature…"
          className="min-w-[220px] flex-1 rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs"
        />
        <button
          onClick={() => (tab === "operational" ? opQuery.refetch() : compQuery.refetch())}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Refresh
        </button>
      </div>

      {tab === "compliance" ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
          <Shield className="mt-0.5 h-3.5 w-3.5 flex-none text-primary" aria-hidden />
          <span>
            Compliance events are append-only. Each row is hash-chained to the previous one — they
            can be verified but never edited or deleted.
          </span>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
          <span>
            Retention: 30 days. You can clear operational activity older than 30 days at any time.
          </span>
          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-foreground hover:bg-accent"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Clear eligible…
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span>Type "clear" to confirm:</span>
              <input
                aria-label='Type "clear" to confirm'
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                className="w-20 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-foreground"
                autoFocus
              />
              <button
                onClick={clearOldOperational}
                className="rounded-md bg-destructive/80 px-2 py-1 font-medium text-white hover:bg-destructive"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setConfirmClear(false);
                  setPhrase("");
                }}
                className="rounded-md border border-border/60 bg-background/40 px-2 py-1"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {msg ? (
        <div
          className={cn(
            "mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
            msg.kind === "success"
              ? "border-[color:var(--state-success-line)] bg-[color:var(--state-success-surface)] text-[color:var(--state-success)]"
              : "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          {msg.text}
        </div>
      ) : null}

      {tab === "operational" ? (
        <GlassPanel className="mt-4 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
            <div>
              <h2 className="text-sm font-medium text-foreground">On-device output activity</h2>
              <p className="text-[11px] text-muted-foreground">
                Exact artifact ids and SHA-256 fingerprints recorded by Chat on this device.
              </p>
            </div>
            <button
              onClick={refreshLocalOutputs}
              className="rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Refresh local
            </button>
          </div>
          {localOutputError ? (
            <div className="p-3 text-xs text-destructive">{localOutputError}</div>
          ) : localOutputs === null ? (
            <div className="p-3 text-xs text-muted-foreground">Loading local activity…</div>
          ) : localOutputs.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              No Chat outputs have been saved on this device.
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {localOutputs.map((row) => (
                <li key={row.id} className="grid gap-1 p-3 text-xs sm:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{row.outputName}</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      artifact {row.artifactId} · sha256 {row.outputSha256}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.sourceFiles.length} source file
                      {row.sourceFiles.length === 1 ? "" : "s"} · {row.outputBytes} bytes ·{" "}
                      {row.result === "verified" ? "verified" : "not confirmed"}
                    </p>
                  </div>
                  <time className="text-[11px] text-muted-foreground">
                    {new Date(row.at).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      ) : null}

      <GlassPanel className="mt-4 overflow-hidden">
        {tab === "operational" ? (
          opQuery.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : opQuery.isError ? (
            <div className="p-6 text-sm text-destructive">
              Operational activity is unavailable:{" "}
              {opQuery.error instanceof Error
                ? opQuery.error.message
                : "the activity store did not respond."}
            </div>
          ) : opRows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No operational activity in this window.
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {opRows.map((r) => {
                const a = getAction(r.action);
                return (
                  <li
                    key={r.id}
                    className="grid grid-cols-[auto_1fr_auto] items-start gap-3 p-3 text-sm"
                  >
                    <ActivityIcon className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <div className="text-foreground">{a?.title ?? r.action}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {r.feature_id ?? "—"} ·{" "}
                        {(r.metadata as { result?: string } | null)?.result ?? "recorded"}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : compQuery.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : compQuery.isError ? (
          <div className="p-6 text-sm text-destructive">
            Compliance audit is unavailable:{" "}
            {compQuery.error instanceof Error
              ? compQuery.error.message
              : "the audit store did not respond."}
          </div>
        ) : compRows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No compliance events in this window.
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {compRows.map((r) => {
              const a = getAction(r.action);
              return (
                <li
                  key={r.id}
                  className="grid grid-cols-[auto_1fr_auto] items-start gap-3 p-3 text-sm"
                >
                  <Shield className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                  <div className="min-w-0">
                    <div className="text-foreground">{a?.title ?? r.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.category ?? "other"} · {r.feature_id ?? "—"}
                    </div>
                    {r.result ? (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Result: <code>{r.result}</code>
                      </div>
                    ) : null}
                    {r.row_hash ? (
                      <div className="mt-0.5 text-[10px] font-mono text-muted-foreground/70">
                        hash: {r.row_hash.slice(0, 16)}…
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </GlassPanel>

      <p className="mt-4 text-xs text-muted-foreground">
        Missing something? Some actions ship in later slices — the{" "}
        <Link to="/settings" className="underline underline-offset-4">
          Settings
        </Link>{" "}
        hub lists what is live today.
      </p>
    </>
  );
}
