import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { recordAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — CAERA CADANE" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrivacyPage,
});

type Mode = "device_only" | "private_sync";

const CLASSES: { key: string; label: string; help: string }[] = [
  { key: "privacy_chats", label: "Chats", help: "OCADE conversations and threads." },
  { key: "privacy_files", label: "Files", help: "Documents you upload to OCADE / FICIA / MADEE." },
  { key: "privacy_images", label: "Images", help: "Images you generate or upload." },
  { key: "privacy_copilot", label: "Copilot history", help: "Plans, steps and results from Copilot runs." },
  { key: "privacy_recordings", label: "Recordings", help: "Optional screen/voice captures. Always opt-in per session." },
  { key: "privacy_resumes", label: "Resumes", help: "MADEE resume projects and versions." },
  { key: "privacy_company", label: "Company records", help: "FICIA company documents and configuration." },
  { key: "privacy_timesheets", label: "Timesheets", help: "Attendance and time entries." },
];

function PrivacyPage() {
  const { user } = useSession();
  const [values, setValues] = useState<Record<string, Mode> | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_settings")
        .select(CLASSES.map((c) => c.key).join(","))
        .eq("user_id", user.id)
        .maybeSingle();
      const record: Record<string, Mode> = {};
      for (const c of CLASSES) {
        record[c.key] = (data?.[c.key as keyof typeof data] as Mode) ?? "private_sync";
      }
      setValues(record);
    })();
  }, [user]);

  async function change(key: string, mode: Mode) {
    if (!user || !values) return;
    setBusyKey(key);
    setError(null);
    const next = { ...values, [key]: mode };
    const { error: err } = await supabase
      .from("user_settings")
      .update({ [key]: mode } as never)
      .eq("user_id", user.id);
    if (err) setError(err.message);
    else {
      setValues(next);
      await recordAction({
        actionId: "settings.privacy.change",
        metadata: { key, mode },
      });
    }
    setBusyKey(null);
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Account · Privacy"
        title="Per-data-class privacy"
        description="Choose where each kind of data lives. Device Only never leaves this browser (encrypted local vault ships in P5). Private Sync stores data in your account with RLS enforced."
        actions={
          <Link to="/settings" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Settings
          </Link>
        }
      />

      {error ? (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <GlassPanel className="mt-6 divide-y divide-border/40">
        {values === null ? (
          <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          CLASSES.map((c) => {
            const v = values[c.key];
            return (
              <div key={c.key} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{c.label}</div>
                  <div className="text-xs text-muted-foreground">{c.help}</div>
                </div>
                <div className="flex gap-1 rounded-lg bg-muted/40 p-1">
                  {(["device_only", "private_sync"] as const).map((mode) => (
                    <button
                      key={mode}
                      disabled={busyKey === c.key}
                      onClick={() => change(c.key, mode)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        v === mode
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {mode === "device_only" ? "Device Only" : "Private Sync"}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </GlassPanel>

      <p className="mt-4 text-xs text-muted-foreground">
        Device Only currently uses an unencrypted browser store. Encrypted local vault
        (WebAuthn / passphrase / recovery kit) ships in slice P5.
      </p>
    </AppShell>
  );
}
