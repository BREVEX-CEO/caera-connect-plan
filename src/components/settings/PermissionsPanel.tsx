import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, Lock, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { PermissionRules } from "@/components/settings/PermissionRules";
import {
  loadComputerUseSettings,
  normalizeComputerUseSettings,
  persistComputerUseSettings,
  type ComputerUsePermission,
  type ComputerUseSettings,
} from "@/lib/computer-use-settings";

const PERMISSION_OPTIONS: Array<{
  value: ComputerUsePermission;
  label: string;
  description: string;
}> = [
  { value: "blocked", label: "Blocked", description: "Never act." },
  { value: "read_only", label: "Read-only", description: "Observe approved state; no mutation." },
  {
    value: "ask_every_mutation",
    label: "Ask Every Mutation",
    description: "Confirm every change, type, open, upload, download or command.",
  },
  {
    value: "ask_risky",
    label: "Ask Risky Actions",
    description: "Low-risk actions may proceed; risky actions still require approval.",
  },
  {
    value: "bounded_workflow",
    label: "Bounded Workflow",
    description: "Allow only the reviewed steps, apps, files and time window.",
  },
  {
    value: "session_allowance",
    label: "Session Allowance",
    description: "Allow selected capabilities until this session ends.",
  },
  {
    value: "time_limited",
    label: "Time-Limited Allowance",
    description: "Allow selected capabilities for a short fixed duration.",
  },
  {
    value: "always_selected_low_risk",
    label: "Always Allow Selected Low-Risk Capabilities",
    description: "Only explicitly selected low-risk capabilities; never a blanket app grant.",
  },
];

export function PermissionsPanel() {
  const [settings, setSettings] = useState(loadComputerUseSettings);
  const [message, setMessage] = useState<string | null>(null);

  function update(patch: Partial<ComputerUseSettings>) {
    const next = normalizeComputerUseSettings({ ...settings, ...patch });
    setSettings(next);
    const result = persistComputerUseSettings(next);
    setMessage(result.ok ? "Permission defaults saved on this device." : result.error);
  }

  return (
    <>
      <PageHeader
        eyebrow="OCADE · Computer Use"
        title="Permissions"
        description="Set the default posture for new app and workflow requests. Runtime risk, protected-input and scope checks can only make this stricter."
      />

      {message ? (
        <p role="status" className="mb-4 rounded-md border border-border/60 px-3 py-2 text-xs">
          {message}
        </p>
      ) : null}

      <GlassPanel className="p-5">
        <label className="block">
          <span className="text-sm font-semibold">Default computer-use permission</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            “Any App” is only a routing choice. It never bypasses app identity, signatures,
            capability checks, risk, scope or confirmation.
          </span>
          <select
            value={settings.defaultPermission}
            onChange={(event) =>
              update({ defaultPermission: event.target.value as ComputerUsePermission })
            }
            className="mt-3 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
          >
            {PERMISSION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          {
            PERMISSION_OPTIONS.find((option) => option.value === settings.defaultPermission)
              ?.description
          }
        </p>

        {settings.defaultPermission === "time_limited" ? (
          <label className="mt-4 block text-xs">
            <span className="mb-1 flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden /> Allowance duration
            </span>
            <select
              value={settings.allowanceMinutes}
              onChange={(event) => update({ allowanceMinutes: Number(event.target.value) })}
              className="h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm"
            >
              {[5, 15, 30, 60, 120, 240, 480].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hours`}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </GlassPanel>

      <GlassPanel className="mt-4 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4" aria-hidden /> Non-overridable boundaries
        </h3>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>Protected inputs and protected fields are always refused.</li>
          <li>Expired, revoked, unsigned or mismatched permissions fail closed.</li>
          <li>High-risk actions still need explicit confirmation.</li>
          <li>Execution acknowledgement is not independent verification.</li>
          <li>An unavailable connector never becomes simulated success.</li>
        </ul>
      </GlassPanel>

      <GlassPanel className="mt-4 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Lock className="h-4 w-4" aria-hidden /> App and site-specific permissions
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          No authenticated native application inventory is available in this browser runtime, so
          OCADE does not invent app identities or grants. Site permissions and known adapter
          coverage remain inspectable now.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <Link to="/settings/browser" className="underline underline-offset-4">
            Browser site permissions
          </Link>
          <Link to="/settings/skills" className="underline underline-offset-4">
            Adapter and app coverage
          </Link>
          <Link
            to="/settings/$section"
            params={{ section: "work" }}
            className="underline underline-offset-4"
          >
            Computer Use channels
          </Link>
        </div>
      </GlassPanel>
      <PermissionRules />
    </>
  );
}
