import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PublicPage, PublicSection } from "@/components/public/PublicPage";
import { OcadeBanner } from "@/components/ui/ocade-banner";
import { OcadeDataTable } from "@/components/ui/ocade-data-table";
import { OcadeSkeleton } from "@/components/ui/ocade-skeleton";

export const Route = createFileRoute("/status")({
  head: () => ({ meta: [{ title: "OCADE status — pre-launch checks" }, { name: "description", content: "Honest current-browser and pre-launch service checks for OCADE." }] }),
  component: StatusPage,
});

type Probe = { state: "checking" | "available" | "unavailable"; checkedAt: string | null; detail: string };

function StatusPage() {
  const [probe, setProbe] = useState<Probe>({ state: "checking", checkedAt: null, detail: "Checking this deployment's health endpoint…" });
  const check = useCallback(async () => {
    setProbe({ state: "checking", checkedAt: null, detail: "Checking this deployment's health endpoint…" });
    try {
      const response = await fetch("/api/health", { headers: { accept: "application/json" } });
      setProbe({ state: response.ok ? "available" : "unavailable", checkedAt: new Date().toISOString(), detail: response.ok ? `Health endpoint responded ${response.status} in this browser.` : `Health endpoint responded ${response.status}.` });
    } catch {
      setProbe({ state: "unavailable", checkedAt: new Date().toISOString(), detail: "This browser could not reach the health endpoint." });
    }
  }, []);
  useEffect(() => { void check(); }, [check]);
  const components = [
    { name: "Public web surface", state: probe.state, detail: probe.detail },
    { name: "Account authentication", state: "unavailable" as const, detail: "Production Supabase target is not verified in this build." },
    { name: "Private Sync", state: "unavailable" as const, detail: "Not claimed until the correct production data project is verified." },
    { name: "On-device intelligence", state: "checking" as const, detail: "Device-specific; open the demo to run a real engine check." },
  ];
  return (
    <PublicPage eyebrow="Pre-launch service checks" title="OCADE status" summary="Current browser observations and known pre-launch dependencies. This is not a historical uptime report and does not claim production availability.">
      <OcadeBanner title="Pre-launch status scope" kind="warning" action={{ label: "Refresh", onClick: () => void check() }} dismissible>These checks describe this browser and deployment only. They are not an uptime SLA.</OcadeBanner>
      {probe.state === "checking" ? <OcadeSkeleton label="Checking OCADE components" lines={4} /> : <OcadeDataTable caption="OCADE component status" columns={[{ key: "name", label: "Component" }, { key: "state", label: "State" }, { key: "detail", label: "Observation" }]} rows={components.map((component, index) => ({ id: String(index), ...component }))} onAction={() => void check()} actionLabel="Check again" />}
      {probe.checkedAt ? <p className="text-xs text-muted-foreground">Last checked <time dateTime={probe.checkedAt}>{new Date(probe.checkedAt).toLocaleString()}</time></p> : null}
      <PublicSection title="Incidents and uptime"><p>No public incident feed or independently measured uptime history is connected. A blank feed must not be read as zero incidents, and no uptime percentage is claimed.</p></PublicSection>
      <PublicSection title="Scheduled maintenance"><p>No maintenance window is declared. The planned public launch remains 28 August 2026 at 8:28 AM Asia/Kolkata, subject to the fail-closed readiness gate.</p></PublicSection>
      <PublicSection title="Updates"><p>Status email subscription and a separate status domain are not enabled because no verified delivery provider or production status service is connected.</p></PublicSection>
    </PublicPage>
  );
}
