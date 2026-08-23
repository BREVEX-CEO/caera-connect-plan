import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, Loader2, RefreshCw, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { TruthfulFailurePanel } from "@/components/ocade/TruthfulFailurePanel";
import { listDevicesForCurrentUser, revokeDevice } from "@/lib/devices";

export const Route = createFileRoute("/_authenticated/ocade/devices")({
  head: () => ({ meta: [{ title: "Devices — OCADE" }, { name: "robots", content: "noindex" }] }),
  component: DevicesPage,
});

function DevicesPage() {
  const qc = useQueryClient();
  const devices = useQuery({ queryKey: ["ocade-devices"], queryFn: listDevicesForCurrentUser });
  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const result = await revokeDevice(id);
      if (result.error) throw new Error(result.error);
      return id;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ocade-devices"] }),
  });

  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Devices"
        description="Devices actually registered to this account. Revocation is persistent: a revoked browser cannot silently register itself back in."
        actions={
          <button
            type="button"
            onClick={() => void devices.refetch()}
            className="inline-flex min-h-[24px] items-center gap-1.5 px-1 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
          </button>
        }
      />

      {devices.isError ? (
        <TruthfulFailurePanel
          className="mt-6"
          title="Devices could not be read"
          failed={devices.error instanceof Error ? devices.error.message : String(devices.error)}
          safe="This read failure did not register, revoke or modify a device."
          notDone="OCADE did not infer device state from stale UI and did not claim any device was revoked."
          alternative="Device settings use the same account-scoped device records."
          retry={() => void devices.refetch()}
        />
      ) : null}

      {revoke.isError ? (
        <TruthfulFailurePanel
          className="mt-4"
          title="Device revocation did not complete"
          failed={revoke.error instanceof Error ? revoke.error.message : String(revoke.error)}
          safe="The device remains in its previous authoritative state until the revocation write succeeds."
          notDone="OCADE did not mark the device revoked in the interface and did not claim the revocation succeeded."
          alternative="Refresh the device list before retrying if the account or network state changed."
          retry={revoke.variables ? () => revoke.mutate(revoke.variables) : undefined}
          retryLabel="Retry revocation"
        />
      ) : null}

      {!devices.isError ? (
        <GlassPanel className="mt-6 overflow-hidden p-0">
          {devices.isPending ? (
            <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading devices…
            </div>
          ) : devices.data.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              No devices are registered to this account.
            </p>
          ) : (
            <ul className="divide-y divide-border/40">
              {devices.data.map((device) => {
                const Icon = device.kind === "mobile" ? Smartphone : Laptop;
                const revoked = Boolean(device.revoked_at);
                const revokingThisDevice = revoke.isPending && revoke.variables === device.id;
                return (
                  <li key={device.id} className="flex items-center gap-3 px-4 py-3">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {device.name ?? `${device.kind} device`}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {revoked
                          ? `Revoked ${new Date(device.revoked_at!).toLocaleString()}`
                          : device.last_active_at
                            ? `Last active ${new Date(device.last_active_at).toLocaleString()}`
                            : "No activity timestamp"}
                      </p>
                    </div>
                    {revoked ? (
                      <span className="text-xs text-muted-foreground">Revoked</span>
                    ) : (
                      <button
                        type="button"
                        disabled={revoke.isPending}
                        onClick={() => {
                          revoke.reset();
                          revoke.mutate(device.id);
                        }}
                        className="rounded-md border border-destructive/30 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        {revokingThisDevice ? "Revoking…" : "Revoke"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </GlassPanel>
      ) : null}

      <Link
        to="/settings/devices"
        className="mt-4 inline-block text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Open full device settings
      </Link>
    </>
  );
}
