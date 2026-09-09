import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound, Mic, MonitorUp, ShieldCheck, Globe2 } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { CapabilityBadge } from "@/components/capability/CapabilityBadge";
import { useCapabilityReports } from "@/lib/capabilities/use-capabilities";
import type { CapabilityId } from "@/lib/capabilities/types";

export const Route = createFileRoute("/_authenticated/ocade/permissions")({
  head: () => ({
    meta: [{ title: "Permissions — OCADE" }, { name: "robots", content: "noindex" }],
  }),
  component: PermissionsPage,
});

const POLICIES: Array<{
  id: CapabilityId;
  label: string;
  description: string;
  to: string;
  icon: typeof KeyRound;
}> = [
  {
    id: "computerControl",
    label: "Computer control",
    description:
      "Native machine actions are permissioned and require a connected companion. Approval remains separate from connection status.",
    to: "/ocade/cowork",
    icon: MonitorUp,
  },
  {
    id: "browser",
    label: "Browser control",
    description: "Browser access uses the browser bridge and its real pairing state.",
    to: "/settings/browser",
    icon: Globe2,
  },
  {
    id: "voice",
    label: "Microphone & voice",
    description:
      "Microphone access is controlled by browser/OS permissions and OCADE voice settings.",
    to: "/settings/voice",
    icon: Mic,
  },
  {
    id: "accountStorage",
    label: "Storage & sync",
    description:
      "Your selected storage mode determines whether chat content stays local or may sync.",
    to: "/settings/privacy",
    icon: ShieldCheck,
  },
];

function PermissionsPage() {
  const reports = useCapabilityReports();
  const byId = new Map(reports.map((report) => [report.id, report]));
  return (
    <>
      <PageHeader
        eyebrow="OCADE"
        title="Permissions"
        description="A truthful overview of the permission-bearing capabilities OCADE can observe. Policy editing stays in the existing dedicated settings until a single universal policy writer can safely own every platform."
      />
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {POLICIES.map((policy) => {
          const report = byId.get(policy.id);
          const Icon = policy.icon;
          if (!report) return null;
          return (
            <div key={policy.id} className="rounded-xl border border-border/60 bg-card/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <h2 className="text-sm font-medium">{policy.label}</h2>
                </div>
                <CapabilityBadge status={report.status} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{policy.description}</p>
              <p className="mt-2 text-xs text-muted-foreground/80">
                Current evidence: {report.detail}
              </p>
              <Link
                to={policy.to}
                className="mt-3 inline-block text-xs underline underline-offset-4"
              >
                Review controls
              </Link>
            </div>
          );
        })}
      </div>
      <div className="mt-5 rounded-xl border border-border/60 p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="h-4 w-4" /> Default rule
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Connection is not permission, and permission is not proof of execution. OCADE must verify
          an action result before presenting it as completed.
        </p>
        <Link
          to="/settings/security"
          className="mt-3 inline-block text-xs underline underline-offset-4"
        >
          Security settings
        </Link>
      </div>
    </>
  );
}
