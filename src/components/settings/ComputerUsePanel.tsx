import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Globe, Laptop, OctagonX, Radio, ShieldCheck, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { cn } from "@/lib/utils";
import {
  loadComputerUseSettings,
  normalizeComputerUseSettings,
  persistComputerUseSettings,
  type ComputerUseSettings,
} from "@/lib/computer-use-settings";
import {
  COMPANION_UNAVAILABLE_REASON,
  getCompanion,
  subscribeCompanionAdapter,
  type CompanionStatus,
  type CompanionApplication,
} from "@/lib/native/companion-bridge";
import { perceptionRuntimeReadiness } from "@/lib/control/perception";

export function ComputerUsePanel() {
  const [settings, setSettings] = useState(loadComputerUseSettings);
  const [status, setStatus] = useState<CompanionStatus>({
    available: false,
    reason: COMPANION_UNAVAILABLE_REASON,
  });
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [stopping, setStopping] = useState(false);
  const [applications, setApplications] = useState<CompanionApplication[]>([]);
  const perception = perceptionRuntimeReadiness({
    companionAvailable: status.available,
    permissions: status.permissions,
  });

  useEffect(() => {
    let current = true;
    const inspect = (adapter = getCompanion()) => {
      void adapter.status().then(async (next) => {
        if (!current) return;
        setStatus(next);
        if (!next.available || !adapter.applications) {
          setApplications([]);
          return;
        }
        try {
          const discovered = await adapter.applications();
          if (current) setApplications(discovered);
        } catch {
          if (current) setApplications([]);
        }
      });
    };
    inspect();
    const unsubscribe = subscribeCompanionAdapter(inspect);
    return () => {
      current = false;
      unsubscribe();
    };
  }, []);

  function update(patch: Partial<ComputerUseSettings>) {
    const next = normalizeComputerUseSettings({ ...settings, ...patch });
    setSettings(next);
    const result = persistComputerUseSettings(next);
    setMessage(
      result.ok
        ? { tone: "ok", text: "Computer Use policy saved on this device." }
        : { tone: "error", text: result.error },
    );
    if (result.ok && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ocade:computer-use-settings"));
    }
  }

  async function emergencyStop() {
    setStopping(true);
    setMessage(null);
    try {
      await getCompanion().emergencyStop();
      setMessage({
        tone: "ok",
        text: "The Native Companion acknowledged the emergency stop.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : "No companion acknowledged the emergency stop.",
      });
    } finally {
      setStopping(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="OCADE · Computer Use"
        title="Work and Computer Control"
        description="Choose where OCADE may act. These preferences narrow access; every action still passes runtime permission, risk and verification checks."
        actions={
          <button
            type="button"
            onClick={() => void emergencyStop()}
            disabled={stopping}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 text-xs font-medium text-destructive hover:bg-destructive/15 disabled:opacity-50"
          >
            <OctagonX className="h-3.5 w-3.5" aria-hidden />
            {stopping ? "Stopping…" : "Emergency stop"}
          </button>
        }
      />

      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={cn(
            "mb-4 rounded-md border px-3 py-2 text-xs",
            message.tone === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-[color:var(--state-success)]/30 bg-[color:var(--state-success)]/10 text-[color:var(--state-success)]",
          )}
        >
          {message.text}
        </p>
      ) : null}

      <GlassPanel className="p-5">
        <SwitchRow
          label="Computer Use"
          description="Master permission for browser, this computer, paired devices and background work. Off by default."
          checked={settings.enabled}
          onChange={(enabled) => update({ enabled })}
        />
      </GlassPanel>

      <GlassPanel className="mt-4 p-5">
        <h3 className="text-sm font-semibold">Control channels</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          A channel can be selected only while the master switch is on. A selected channel still
          fails closed when its signed connector is unavailable.
        </p>
        <div className="mt-3 divide-y divide-border/50">
          <SwitchRow
            icon={Globe}
            label="Web Control"
            description="Use an OCADE-managed Chrome or Edge session on sites allowed in Browser control."
            checked={settings.webControl}
            disabled={!settings.enabled}
            onChange={(webControl) => update({ webControl })}
          />
          <SwitchRow
            icon={Laptop}
            label="This Computer"
            description="Use the signed Native Companion for approved apps, files and windows."
            checked={settings.thisComputer}
            disabled={!settings.enabled}
            onChange={(thisComputer) => update({ thisComputer })}
          />
          <SwitchRow
            icon={Smartphone}
            label="Paired Devices"
            description="Allow paired devices to monitor, approve, pause, cancel and stop work."
            checked={settings.pairedDevices}
            disabled={!settings.enabled}
            onChange={(pairedDevices) => update({ pairedDevices })}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link to="/settings/browser" className="underline underline-offset-4">
            Browser permissions
          </Link>
          <Link to="/settings/mobile" className="underline underline-offset-4">
            Mobile pairing
          </Link>
          <Link to="/settings/devices" className="underline underline-offset-4">
            Device revocation
          </Link>
        </div>
      </GlassPanel>

      <GlassPanel className="mt-4 p-5">
        <h3 className="text-sm font-semibold">Sessions and background work</h3>
        <div className="mt-2 divide-y divide-border/50">
          <SwitchRow
            icon={Radio}
            label="Background tasks"
            description="Allow eligible scheduled tasks while OCADE is not the active window."
            checked={settings.backgroundTasks}
            disabled={!settings.enabled}
            onChange={(backgroundTasks) => update({ backgroundTasks })}
          />
          <SwitchRow
            icon={Smartphone}
            label="Remote sessions"
            description="Allow a paired phone to supervise the same task. It never grants arbitrary computer control."
            checked={settings.remoteSessions}
            disabled={!settings.enabled || !settings.pairedDevices}
            onChange={(remoteSessions) => update({ remoteSessions })}
          />
        </div>
      </GlassPanel>

      <GlassPanel className="mt-4 p-5">
        <h3 className="text-sm font-semibold">Recording and replay</h3>
        <label className="mt-3 block text-xs">
          <span className="mb-1 block text-muted-foreground">Session record</span>
          <select
            value={settings.recordingMode}
            onChange={(event) =>
              update({
                recordingMode: event.target.value as ComputerUseSettings["recordingMode"],
              })
            }
            disabled={!settings.enabled}
            className="h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm disabled:opacity-50"
          >
            <option value="off">Off</option>
            <option value="receipts_only">Receipts and redacted evidence only</option>
            <option value="approved_replay">Approved workflow replay</option>
          </select>
        </label>
        <SwitchRow
          label="Allow approved replays"
          description="A replay remains bounded to its version, apps, permissions and protected-input rules."
          checked={settings.replayEnabled}
          disabled={!settings.enabled || settings.recordingMode !== "approved_replay"}
          onChange={(replayEnabled) => update({ replayEnabled })}
        />
      </GlassPanel>

      <GlassPanel className="mt-4 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4" aria-hidden /> Protected inputs are always blocked
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Passwords, one-time codes, CAPTCHAs, biometrics, payment details, recovery codes and legal
          confirmations must be completed by you. This protection cannot be disabled by a setting,
          connector or app policy.
        </p>
      </GlassPanel>

      <GlassPanel className="mt-4 p-5">
        <h3 className="text-sm font-semibold">Companion permissions</h3>
        {status.permissions && status.permissions.length > 0 ? (
          <div className="mt-3 space-y-2">
            {status.permissions.map((permission) => (
              <div
                key={permission.id}
                className="flex items-start justify-between gap-3 rounded border border-border/60 p-2"
              >
                <div>
                  <p className="text-xs font-medium">{permission.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{permission.guidance}</p>
                </div>
                <span className="rounded border border-border/60 px-2 py-0.5 text-[10px] uppercase">
                  {permission.state.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            {status.reason ?? COMPANION_UNAVAILABLE_REASON}
          </p>
        )}
        {status.installGuidance && status.installGuidance.length > 0 ? (
          <div className="mt-3 rounded border border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning)]/5 p-3">
            <p className="text-xs font-medium">Setup needed</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
              {status.installGuidance.map((guidance) => (
                <li key={guidance}>{guidance}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </GlassPanel>

      <GlassPanel className="mt-4 p-5">
        <h3 className="text-sm font-semibold">Fused screen perception</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {
            "The redaction, state-fingerprint and numbered-target pipeline is source-ready. Live UIA/OCR/icon/vision control remains blocked until every authenticated dependency below is available."
          }
        </p>
        <p
          className={cn(
            "mt-3 text-xs font-medium",
            perception.liveReady
              ? "text-[color:var(--state-success)]"
              : "text-[color:var(--state-warning)]",
          )}
        >
          {perception.liveReady ? "Live perception ready" : "Live perception setup required"}
        </p>
        {!perception.liveReady ? (
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
            {perception.missing.map((dependency) => (
              <li key={dependency}>{dependency}</li>
            ))}
          </ul>
        ) : null}
      </GlassPanel>

      <GlassPanel className="mt-4 p-5">
        <h3 className="text-sm font-semibold">Detected applications</h3>
        {applications.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {applications.map((application) => (
              <div
                key={`${application.processId}:${application.appId}`}
                className="rounded border border-border/60 p-2"
              >
                <p className="truncate text-xs font-medium">{application.label}</p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                  {application.appId} · PID {application.processId}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            {status.available
              ? "The authenticated inventory returned no visible applications. No app-specific permission is inferred."
              : (status.reason ?? COMPANION_UNAVAILABLE_REASON)}
          </p>
        )}
        <Link
          to="/settings/skills"
          className="mt-3 inline-flex text-xs underline underline-offset-4"
        >
          Review verified adapters and learned app maps
        </Link>
      </GlassPanel>
    </>
  );
}

function SwitchRow({
  icon: Icon,
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  icon?: typeof Globe;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 gap-2">
        {Icon ? (
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border border-border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          checked ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
