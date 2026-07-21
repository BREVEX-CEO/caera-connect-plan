import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Laptop, Smartphone, ShieldCheck, Loader2, XCircle } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { listDevicesForCurrentUser, revokeDevice, type DeviceRow } from "@/lib/devices";
import { recordAction } from "@/lib/actions";

export const Route = createFileRoute("/_authenticated/settings/devices")({
  head: () => ({
    meta: [
      { title: "Devices — CAERA CADANE" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DevicesPage,
});

function DevicesPage() {
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setDevices(await listDevicesForCurrentUser());
  }
  useEffect(() => {
    refresh();
  }, []);

  const active = (devices ?? []).filter((d) => !d.revoked_at);
  const desktopCount = active.filter((d) => d.kind === "desktop").length;
  const mobileCount = active.filter((d) => d.kind === "mobile").length;

  async function onRevoke(d: DeviceRow) {
    setBusyId(d.id);
    setError(null);
    const res = await revokeDevice(d.id);
    if (res.error) setError(res.error);
    else {
      await recordAction({ actionId: "devices.revoke", metadata: { device_id: d.id, kind: d.kind } });
      await refresh();
    }
    setBusyId(null);
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Account · Devices"
        title="Approved devices"
        description="One physical PC counts as one desktop device. Extra browsers on the same PC will share that slot once the Native Companion ships."
        actions={
          <Link
            to="/settings"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Settings
          </Link>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <GlassPanel className="flex items-center gap-3 p-4">
          <Laptop className="h-5 w-5 text-primary" aria-hidden />
          <div>
            <div className="text-sm font-medium text-foreground">Desktop</div>
            <div className="text-xs text-muted-foreground">{desktopCount} / 2 active</div>
          </div>
        </GlassPanel>
        <GlassPanel className="flex items-center gap-3 p-4">
          <Smartphone className="h-5 w-5 text-primary" aria-hidden />
          <div>
            <div className="text-sm font-medium text-foreground">Mobile</div>
            <div className="text-xs text-muted-foreground">{mobileCount} / 2 active</div>
          </div>
        </GlassPanel>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <GlassPanel className="mt-6 divide-y divide-border/40">
        {devices === null ? (
          <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading devices…
          </div>
        ) : devices.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No devices registered yet. This device will register on next sign-in.
          </div>
        ) : (
          devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-4 p-4">
              <div className="flex min-w-0 items-center gap-3">
                {d.kind === "mobile" ? (
                  <Smartphone className="h-5 w-5 flex-none text-muted-foreground" aria-hidden />
                ) : (
                  <Laptop className="h-5 w-5 flex-none text-muted-foreground" aria-hidden />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {d.name ?? "Unnamed device"}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge status={d.revoked_at ? "planned" : "active"} />
                    <span>
                      Last active {d.last_active_at ? new Date(d.last_active_at).toLocaleString() : "—"}
                    </span>
                  </div>
                </div>
              </div>
              {d.revoked_at ? (
                <span className="text-xs text-muted-foreground">Revoked</span>
              ) : (
                <button
                  onClick={() => onRevoke(d)}
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
              )}
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
    </AppShell>
  );
}
