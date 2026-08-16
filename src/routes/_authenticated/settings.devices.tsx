import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Laptop,
  Smartphone,
  ShieldCheck,
  Loader2,
  XCircle,
  Pencil,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { listDevicesForCurrentUser, revokeDevice, renameDevice, type DeviceRow } from "@/lib/devices";
import { canRegisterDevice, entitlementState } from "@/lib/ocade-allowance";
import { getEntitlement } from "@/lib/ocade-usage.functions";
import { executeAction, recordAction, ActionConfirmationError } from "@/lib/actions";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/settings/devices")({
  head: () => ({
    meta: [{ title: "Devices — CAERA CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: DevicesPage,
});

function DevicesPage() {
  const { user } = useSession();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [phrase, setPhrase] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const fetchEntitlement = useServerFn(getEntitlement);

  const devicesQuery = useQuery<DeviceRow[]>({
    queryKey: ["devices", user?.id],
    enabled: !!user?.id,
    queryFn: () => listDevicesForCurrentUser(),
  });

  /**
   * The allowance shown must be the allowance enforced. Reading the real
   * subscription rather than passing `null` means a paid plan's extra slots
   * appear here instead of the free-plan default.
   */
  const entitlementQuery = useQuery({
    queryKey: ["entitlement", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchEntitlement(),
  });

  const devices = devicesQuery.data ?? null;
  const active = (devices ?? []).filter((d) => !d.revoked_at);
  const desktopCount = active.filter((d) => d.kind === "desktop").length;
  const mobileCount = active.filter((d) => d.kind === "mobile").length;

  const ent = entitlementQuery.data ?? null;
  const entitlement = entitlementState(
    ent
      ? {
          planId: ent.planId,
          startedAt: new Date(ent.startedAt),
          expiresAt: ent.expiresAt ? new Date(ent.expiresAt) : undefined,
        }
      : null,
  );
  const room = (kind: "desktop" | "mobile") =>
    canRegisterDevice({
      kind,
      currentDesktop: desktopCount,
      currentMobile: mobileCount,
      state: entitlement,
    });
  const desktopRoom = room("desktop");
  const mobileRoom = room("mobile");

  async function onRevoke(d: DeviceRow) {
    setBusyId(d.id);
    setError(null);
    try {
      await executeAction("devices.revoke", {
        confirmed: true,
        confirmPhrase: phrase,
        metadata: { device_id: d.id, kind: d.kind },
        run: async () => {
          const res = await revokeDevice(d.id);
          if (res.error) throw new Error(res.error);
        },
      });
      setConfirmId(null);
      setPhrase("");
      await devicesQuery.refetch();
    } catch (e) {
      if (e instanceof ActionConfirmationError) setError('Type "revoke" exactly to confirm.');
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function onRename(d: DeviceRow) {
    setBusyId(d.id);
    setError(null);
    try {
      const res = await renameDevice(d.id, editName);
      if (res.error) throw new Error(res.error);
      await recordAction({ actionId: "devices.rename", metadata: { device_id: d.id } });
      setEditId(null);
      setEditName("");
      await devicesQuery.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Account · Devices"
        title="Approved devices"
        description="One physical PC counts as one desktop device. Extra browsers on the same PC will share that slot once the Native Companion ships."
        actions={
          <Link to="/settings" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Settings
          </Link>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Allowance
          icon={Laptop}
          label="Desktop"
          count={desktopCount}
          limit={entitlement.desktopDevices}
          loading={entitlementQuery.isPending || devicesQuery.isPending}
          warning={desktopRoom.allowed ? null : (desktopRoom.reason ?? null)}
        />
        <Allowance
          icon={Smartphone}
          label="Mobile"
          count={mobileCount}
          limit={entitlement.mobileDevices}
          loading={entitlementQuery.isPending || devicesQuery.isPending}
          warning={mobileRoom.allowed ? null : (mobileRoom.reason ?? null)}
        />
      </div>

      {entitlementQuery.isError ? (
        <ErrorRow
          message="Could not read your plan, so the limits above show the default allowance."
          onRetry={() => void entitlementQuery.refetch()}
        />
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </div>
      ) : null}

      <GlassPanel className="mt-6 divide-y divide-border/40">
        {devicesQuery.isPending ? (
          <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading devices…
          </div>
        ) : devicesQuery.isError ? (
          <div className="p-4">
            <ErrorRow
              message={
                devicesQuery.error instanceof Error
                  ? devicesQuery.error.message
                  : "Could not load your devices."
              }
              onRetry={() => void devicesQuery.refetch()}
            />
          </div>
        ) : (devices ?? []).length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No devices registered yet. This device will register on next sign-in.
          </div>
        ) : (
          (devices ?? []).map((d) => (
            <div key={d.id} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  {d.kind === "mobile" ? (
                    <Smartphone className="h-5 w-5 flex-none text-muted-foreground" aria-hidden />
                  ) : (
                    <Laptop className="h-5 w-5 flex-none text-muted-foreground" aria-hidden />
                  )}
                  <div className="min-w-0">
                    {editId === d.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          aria-label="Device name"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-56 rounded-md border border-border/60 bg-background/50 px-2 py-1 text-sm text-foreground outline-none focus:border-primary/60"
                        />
                        <button
                          onClick={() => void onRename(d)}
                          disabled={busyId === d.id || !editName.trim()}
                          className="rounded-md border border-primary/50 bg-primary/15 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-primary/25 disabled:opacity-60"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-xs text-foreground hover:bg-accent"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="truncate text-sm font-medium text-foreground">
                        {d.name ?? "Unnamed device"}
                      </div>
                    )}
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <StatusBadge status={d.revoked_at ? "planned" : "active"} />
                      <span>
                        Last active{" "}
                        {d.last_active_at ? new Date(d.last_active_at).toLocaleString() : "—"}
                      </span>
                    </div>
                  </div>
                </div>
                {d.revoked_at ? (
                  <span className="text-xs text-muted-foreground">Revoked</span>
                ) : (
                  <div className="flex flex-none items-center gap-2">
                    {editId === d.id ? null : (
                      <button
                        onClick={() => {
                          setEditId(d.id);
                          setEditName(d.name ?? "");
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Rename
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setConfirmId(d.id);
                        setPhrase("");
                        setError(null);
                      }}
                      disabled={busyId === d.id}
                      className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60"
                    >
                      {busyId === d.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      Revoke
                    </button>
                  </div>
                )}
              </div>

              {confirmId === d.id ? (
                <div className="mt-3 rounded-md border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 p-3 text-xs text-foreground">
                  Revoking removes an approved access surface. The device stays revoked even if it
                  reconnects, so a lost or stolen device cannot let itself back in. Type{" "}
                  <strong>revoke</strong> to confirm.
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      aria-label="Type revoke to confirm"
                      value={phrase}
                      onChange={(e) => setPhrase(e.target.value)}
                      className="w-40 rounded-md border border-border/60 bg-background/50 px-2 py-1 text-xs text-foreground outline-none focus:border-primary/60"
                    />
                    <button
                      onClick={() => void onRevoke(d)}
                      disabled={busyId === d.id}
                      className="inline-flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/15 px-3 py-1 font-medium text-destructive hover:bg-destructive/25 disabled:opacity-60"
                    >
                      {busyId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Revoke device
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="rounded-md border border-border/60 bg-background/40 px-3 py-1 font-medium text-foreground hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
      </GlassPanel>

      <GlassPanel className="mt-4 flex items-start gap-3 p-4 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden />
        <p>
          Cross-browser grants on the same physical PC will consolidate into one desktop slot once
          the Native Companion is installed (planned slice P35+). Until then, each browser install
          registers as its own device.
        </p>
      </GlassPanel>
    </>
  );
}

function Allowance({
  icon: Icon,
  label,
  count,
  limit,
  loading,
  warning,
}: {
  icon: typeof Laptop;
  label: string;
  count: number;
  limit: number;
  loading: boolean;
  warning: string | null;
}) {
  return (
    <GlassPanel className="flex items-center gap-3 p-4">
      <Icon className="h-5 w-5 text-primary" aria-hidden />
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Reading plan…
            </span>
          ) : (
            `${count} / ${limit} active`
          )}
        </div>
        {!loading && warning ? (
          <div className="mt-0.5 text-[11px] text-[color:var(--state-warning)]">{warning}</div>
        ) : null}
      </div>
    </GlassPanel>
  );
}

function ErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mt-4 flex items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
    >
      <span className="flex items-center gap-2">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden /> {message}
      </span>
      <button onClick={onRetry} className="inline-flex items-center gap-1 underline underline-offset-2">
        <RefreshCw className="h-3 w-3" /> Retry
      </button>
    </div>
  );
}
