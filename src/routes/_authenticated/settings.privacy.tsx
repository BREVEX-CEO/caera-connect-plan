import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Shield, Cloud, HardDrive, Cpu } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { useSession } from "@/lib/session";
import { recordAction } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { DATA_CLASSES, loadAllModes, setModeFor } from "@/lib/storage/resolver";
import type { DataClass, StorageMode } from "@/lib/storage/types";
import { isUnlocked, isVaultConfigured } from "@/lib/storage/vault";
import { TelemetryPanel } from "@/components/settings/TelemetryPanel";

export const Route = createFileRoute("/_authenticated/settings/privacy")({
  head: () => ({
    meta: [{ title: "Privacy — CAERA CADANE" }, { name: "robots", content: "noindex" }],
  }),
  component: PrivacyPage,
});

const LABELS: Record<DataClass, { label: string; help: string }> = {
  chats: { label: "Chats", help: "OCADE conversations and threads." },
  files: { label: "Files", help: "Documents attached to OCADE conversations and projects." },
  images: { label: "Images", help: "Generated or uploaded images." },
  recordings: {
    label: "Recordings",
    help: "Optional screen/voice captures — always opt-in per session.",
  },
  copilot: { label: "Copilot history", help: "Plans, steps and results from Copilot runs." },
  learning_replays: { label: "Learning replays", help: "Intern-mode workflow captures." },
};

const MODES: { mode: StorageMode; label: string; icon: typeof Cloud }[] = [
  { mode: "browser_only", label: "Browser Only", icon: HardDrive },
  { mode: "pc_vault", label: "PC Vault", icon: Cpu },
  { mode: "private_sync", label: "Private Sync", icon: Cloud },
];

function PrivacyPage() {
  const { user } = useSession();
  const [values, setValues] = useState<Record<DataClass, StorageMode> | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vaultReady, setVaultReady] = useState<{ configured: boolean; unlocked: boolean }>({
    configured: false,
    unlocked: isUnlocked(),
  });

  useEffect(() => {
    if (!user) return;
    void loadAllModes(user.id).then(setValues);
    void isVaultConfigured(user.id).then((configured) =>
      setVaultReady((v) => ({ ...v, configured })),
    );
  }, [user]);

  async function change(key: DataClass, mode: StorageMode) {
    if (!user || !values) return;
    setBusyKey(key);
    setError(null);
    try {
      await setModeFor(user.id, key, mode);
      setValues({ ...values, [key]: mode });
      await recordAction({ actionId: "settings.privacy.change", metadata: { key, mode } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Account · Privacy"
        title="Per-data-class privacy"
        description="Pick where each kind of data lives. Browser Only writes never reach the cloud."
        actions={
          <Link
            to="/settings"
            className="inline-flex min-h-[24px] items-center px-1 py-1 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Settings
          </Link>
        }
      />

      {/* Opt-in failure reporting. Consent lives with the other privacy choices. */}
      <div className="mt-4">
        <TelemetryPanel />
      </div>

      <GlassPanel className="mt-4 flex items-start gap-3 p-4 text-xs text-muted-foreground">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1">
          <p>
            <strong className="text-foreground">Browser Only</strong> — encrypted in this browser
            (AES-GCM), never syncs. Requires the{" "}
            <Link to="/settings/vault" className="underline">
              Browser Vault
            </Link>{" "}
            to be set up and unlocked. Data is lost if you clear this browser's storage.
          </p>
          <p>
            <strong className="text-foreground">PC Vault</strong> — OS-level encrypted storage via
            the CAERA Native Companion. <em>Native Companion Required</em> — ships with the desktop
            package.
          </p>
          <p>
            <strong className="text-foreground">Private Sync</strong> — stored in your account with
            RLS enforced, synced across your approved devices.
          </p>
        </div>
      </GlassPanel>

      {!vaultReady.configured ? (
        <GlassPanel className="mt-3 flex items-start justify-between gap-3 p-4 text-xs">
          <span className="text-muted-foreground">
            Browser Vault is not set up yet. Browser Only writes will surface as “vault locked”
            until you finish setup.
          </span>
          <Link
            to="/settings/vault"
            className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90"
          >
            Set up vault
          </Link>
        </GlassPanel>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <GlassPanel className="mt-6 divide-y divide-border/40">
        {values === null ? (
          <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          DATA_CLASSES.map((dc) => {
            const v = values[dc];
            const meta = LABELS[dc];
            return (
              <div
                key={dc}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{meta.label}</div>
                  <div className="text-xs text-muted-foreground">{meta.help}</div>
                </div>
                <div className="flex gap-1 rounded-lg bg-muted/40 p-1">
                  {MODES.map(({ mode, label, icon: Icon }) => (
                    <button
                      key={mode}
                      disabled={busyKey === dc}
                      onClick={() => change(dc, mode)}
                      title={mode === "pc_vault" ? "Native Companion Required" : label}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                        v === mode
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                        mode === "pc_vault" && "opacity-70",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </GlassPanel>
    </>
  );
}
