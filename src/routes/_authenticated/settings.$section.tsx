import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ExternalLink, Info } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { findSection } from "@/lib/settings-sections";
import { useSettingsAccess } from "@/components/settings/use-settings-access";
import { MemoryPanel } from "@/components/settings/MemoryPanel";
import { ComputerUsePanel } from "@/components/settings/ComputerUsePanel";
import { PermissionsPanel } from "@/components/settings/PermissionsPanel";
import { ConnectorsPanel } from "@/components/settings/ConnectorsPanel";
import { AccessibilityPanel } from "@/components/settings/AccessibilityPanel";
import { UpdatePolicyPanel } from "@/components/settings/UpdatePolicyPanel";
import { ChatSettingsPanel } from "@/components/settings/ChatSettingsPanel";
import { LocalEngineSettingsPanel } from "@/components/settings/LocalEngineSettingsPanel";
import { MotionPanel } from "@/components/settings/MotionPanel";
import { OfflineSection } from "@/components/settings/OfflineSection";
import { AccountPanel } from "@/components/settings/AccountPanel";
import { ImageSettingsPanel } from "@/components/settings/ImageSettingsPanel";
import { AboutLicencesPanel } from "@/components/settings/AboutLicencesPanel";
import { DiagnosticsSettingsPanel } from "@/components/settings/DiagnosticsSettingsPanel";

/**
 * Settings sections that are REAL and rendered here rather than falling through
 * to the Setup-Required state. Keep in sync with settings-sections.ts statuses.
 */
const IMPLEMENTED_SECTIONS: Record<string, () => React.ReactElement> = {
  memory: () => <MemoryPanel />,
  work: () => <ComputerUsePanel />,
  permissions: () => <PermissionsPanel />,
  connectors: () => <ConnectorsPanel />,
  accessibility: () => <AccessibilityPanel />,
  updates: () => <UpdatePolicyPanel />,
  chat: () => <ChatSettingsPanel />,
  "local-engine": () => <LocalEngineSettingsPanel />,
  motion: () => <MotionPanel />,
  offline: () => <OfflineSection />,
  account: () => <AccountPanel />,
  images: () => <ImageSettingsPanel />,
  diagnostics: () => <DiagnosticsSettingsPanel />,
  about: () => <AboutLicencesPanel />,
};

export const Route = createFileRoute("/_authenticated/settings/$section")({
  head: ({ params }) => {
    const found = findSection(params.section);
    const label = found?.item.label ?? "Settings";
    return {
      meta: [{ title: `${label} — CAERA CADANE` }, { name: "robots", content: "noindex" }],
    };
  },
  component: SectionCatchall,
});

function SectionCatchall() {
  const { section } = Route.useParams();
  const found = findSection(section);
  // Signed out, every section is readable but nothing may be opened that sits
  // behind the gate — see the external-section comment below.
  const { canEdit: canEditSettings } = useSettingsAccess();

  if (!found) {
    return (
      <>
        <PageHeader
          eyebrow="Settings"
          title="Section not found"
          description="This settings page does not exist."
        />
        <GlassPanel className="p-5 text-sm text-muted-foreground">
          <Link to="/settings" className="text-primary underline underline-offset-4">
            Back to Settings
          </Link>
        </GlassPanel>
      </>
    );
  }

  const { group, item } = found;

  /*
   * External sections (e.g. Model Settings → /ocade/models) forward to a real
   * page — but ONLY for someone who can actually open it.
   *
   * THE DEAD ROUTE THIS FIXES. `/settings/ocade-models` redirected
   * unconditionally, and its destination is behind the authentication gate. A
   * signed-out visitor reading through Settings clicked "Model Settings" and
   * was thrown out to the sign-in page — no explanation, and the settings
   * screen they were reading was gone. Every other section shows itself
   * read-only, so this one entry silently punished the person exploring the
   * product before signing up.
   *
   * Signed out, it now renders the same descriptive panel as every other
   * unavailable section, with the destination offered as a link they can
   * choose rather than a redirect that happens to them.
   */
  if (item.status === "external" && item.externalTo && canEditSettings) {
    return <Navigate to={item.externalTo} replace />;
  }

  // Real, implemented sections render their own UI.
  const Implemented = IMPLEMENTED_SECTIONS[section];
  if (Implemented) return Implemented();

  const Icon = item.icon;

  return (
    <>
      <PageHeader
        eyebrow={group.label}
        title={item.label}
        description={item.description}
        actions={<StatusBadge status="planned">Setup Required</StatusBadge>}
      />

      <GlassPanel className="flex items-start gap-3 p-5 text-sm">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-foreground">
            This page is planned. Nothing here is enabled yet, so we do not show fake controls or
            fake data.
          </p>
          <p className="text-xs text-muted-foreground">{item.description}</p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              to="/settings"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-3 text-xs text-foreground hover:bg-accent"
            >
              Back to Settings
            </Link>
            {item.externalTo ? (
              <Link
                to={item.externalTo}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
                {item.externalHint ?? "Open"}
              </Link>
            ) : null}
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="mt-4 flex items-start gap-3 p-4 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <p>
          No feedback or support connector is configured in this build. This destination remains
          unavailable until the named source slice is implemented and verified.
        </p>
      </GlassPanel>
    </>
  );
}
